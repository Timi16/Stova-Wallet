import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useActiveAccount } from '@/app/session';
import { useAccountInfo, usePayments } from '@/app/queries';
import { sendDraft } from '@/app/drafts';
import { readClipboard } from '@/app/clipboard';
import { useToast } from '@/app/toast';
import { STELLAR } from '@/config';
import { classifyAddress, shortAddress } from '@/core/keys';
import {
  assetKey,
  buildPayment,
  checkRecipient,
  compareAmounts,
  formatAmount,
  horizon,
  isNative,
  isPayLink,
  memoBytes,
  parseAmount,
  parseAssetKey,
  parsePayLink,
  PaymentBlockedError,
  sameAsset,
  subAmounts,
  feeToXlm,
  XLM,
  type AssetRef,
  type RecipientCheck,
} from '@/core/stellar';
import { BackButton, Header, Screen } from '@/ui/Screen';
import { AssetLogo } from '@/ui/AssetLogo';
import { Field, Input } from '@/ui/Field';
import { Orb } from '@/ui/Orb';
import { IconCheck, IconPaste, IconScan, IconWarn, Spinner } from '@/ui/Icons';

/** Send · form. Recipient checks run as you type; every blocking case is explained before Review. */
export function SendForm() {
  const acct = useActiveAccount();
  const pk = acct?.publicKey ?? '';
  const info = useAccountInfo(pk);
  const payments = usePayments(pk);
  const toast = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const prev = sendDraft.get();

  // Query params (from Scan, a tx sheet's Repeat/Reply, or a pay link) win over a stale draft; the draft wins over nothing.
  const fromLink = params.has('to');
  const [to, setTo] = useState(fromLink ? (params.get('to') ?? '') : (prev?.destination ?? ''));
  const [asset, setAsset] = useState<AssetRef>(fromLink ? (params.get('asset') ? parseAssetKey(params.get('asset')!) : XLM) : (prev?.asset ?? (params.get('asset') ? parseAssetKey(params.get('asset')!) : XLM)));
  const [amt, setAmt] = useState(fromLink ? (params.get('amount') ?? '') : (prev?.amount ?? ''));
  const [memo, setMemo] = useState(fromLink ? (params.get('memo') ?? '') : (prev?.memo ?? ''));
  const [tried, setTried] = useState(false);
  const [checking, setChecking] = useState(false);
  const [recipient, setRecipient] = useState<RecipientCheck | null>(fromLink ? null : (prev?.recipient ?? null));
  const [recipientErr, setRecipientErr] = useState<string | null>(null);
  const [building, setBuilding] = useState(false);
  const [blocked, setBlocked] = useState<string | null>(null);
  const [fee, setFee] = useState<string>('0.00001');
  const checkSeq = useRef(0);

  useEffect(() => {
    horizon
      .fetchBaseFee()
      .then((f) => setFee(feeToXlm(f)))
      .catch(() => {});
  }, []);

  const data = info.data;
  const balances = data?.balances ?? [{ asset: XLM, balance: '0', limit: null, sellingLiabilities: '0', authorized: true }];
  const bal = balances.find((b) => sameAsset(b.asset, asset)) ?? balances[0];
  const native = isNative(asset);
  const spendable = native ? (data?.xlm.spendable ?? '0') : subAmounts(bal.balance, bal.sellingLiabilities);
  const maxSend = native ? (compareAmounts(spendable, fee) > 0 ? subAmounts(spendable, fee) : '0') : spendable;

  // ---- recipient ------------------------------------------------------------
  const toTrim = to.trim();
  const toKind = classifyAddress(toTrim);
  let toErr = '';
  if (toKind === 'empty') toErr = 'Enter the recipient address.';
  else if (toKind === 'secret') toErr = "That's a secret key, not an address. Never share it.";
  else if (toKind === 'muxed') toErr = 'Muxed (M…) addresses are not supported yet. Ask for the G… address.';
  else if (toKind === 'federation') toErr = 'Federation names (name*domain) are not supported yet. Ask for the G… address.';
  else if (toKind === 'length') toErr = `A Stellar address has 56 characters. This has ${toTrim.length}.`;
  else if (toKind === 'invalid') toErr = "That doesn't look like a Stellar address.";
  else if (toTrim === pk) toErr = "That's this wallet. Pick someone else.";
  const toOk = !toErr;

  useEffect(() => {
    if (!toOk) {
      setRecipient(null);
      setChecking(false);
      return;
    }
    if (recipient && recipient.info.publicKey === toTrim && sameAssetCheck(recipient, asset)) return;
    const seq = ++checkSeq.current;
    setChecking(true);
    setRecipientErr(null);
    const t = setTimeout(async () => {
      try {
        const r = await checkRecipient(toTrim, asset);
        if (seq === checkSeq.current) setRecipient(r);
      } catch {
        if (seq === checkSeq.current) setRecipientErr("Couldn't check this account on Testnet. Check your connection.");
      } finally {
        if (seq === checkSeq.current) setChecking(false);
      }
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toTrim, toOk, assetKey(asset)]);

  const applyPaste = (text: string) => {
    const s = text.trim();
    if (isPayLink(s)) {
      const p = parsePayLink(s);
      if ('error' in p) {
        toast(p.error, 'warn');
        return;
      }
      setTo(p.destination);
      if (p.amount) setAmt(p.amount);
      if (p.memo && p.memoType === 'text') setMemo(p.memo);
      const held = balances.find((b) => sameAsset(b.asset, p.asset));
      if (held) setAsset(p.asset);
      else if (!isNative(p.asset)) toast(`This link asks for ${p.asset.code}, which this account doesn't hold.`, 'warn');
      toast('Payment link filled in');
      return;
    }
    setTo(s);
  };

  // ---- amount ------------------------------------------------------------------
  const parsed = parseAmount(amt);
  let amtErr = parsed.ok ? '' : parsed.message;
  if (parsed.ok && compareAmounts(parsed.value, maxSend) > 0) amtErr = `That's more than you can spend (${formatAmount(maxSend)} ${asset.code}).`;
  const amtOk = !amtErr;
  const bytes = memoBytes(memo);
  const memoOk = bytes <= STELLAR.memoMaxBytes;

  const r = recipient;
  const recipientBlocks = !!r && r.info.publicKey === toTrim && !native && (!r.exists || !r.hasTrustline);
  const needsMin = !!r && !r.exists && native && parsed.ok && compareAmounts(parsed.value, '1') < 0;
  const valid = toOk && amtOk && memoOk && !checking && !!r && !recipientBlocks && !needsMin && !!data?.exists;

  const recents = useMemo(() => {
    const items = payments.data?.pages.flatMap((p) => p.items) ?? [];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const i of items) {
      if ((i.kind === 'out' || i.kind === 'created') && i.counterparty.startsWith('G') && !seen.has(i.counterparty)) {
        seen.add(i.counterparty);
        out.push(i.counterparty);
      }
      if (out.length === 4) break;
    }
    return out;
  }, [payments.data]);

  if (!acct) return <Navigate to="/home" replace />;

  const review = async (e?: FormEvent) => {
    e?.preventDefault();
    setTried(true);
    setBlocked(null);
    if (!valid || !r || !parsed.ok) return;
    setBuilding(true);
    try {
      const built = await buildPayment({ source: pk, destination: toTrim, asset, amount: parsed.value, memo: memo.trim() }, r);
      sendDraft.set({ destination: toTrim, asset, amount: parsed.value, memo: memo.trim(), recipient: r, built });
      navigate('/send/review');
    } catch (ex) {
      if (ex instanceof PaymentBlockedError) setBlocked(`${ex.friendly.title}. ${ex.friendly.message}`);
      else setBlocked((ex as Error).message || "Couldn't build the transaction.");
    } finally {
      setBuilding(false);
    }
  };

  const after = parsed.ok && amtOk ? subAmounts(spendable, parsed.value) : spendable;

  return (
    <Screen>
      <Header
        left={<BackButton to="/home" onClick={() => { sendDraft.clear(); navigate('/home'); }} />}
        title="Send"
        right={
          <Link to="/scan" aria-label="Scan a QR code" className="icon-btn">
            <IconScan />
          </Link>
        }
      />
      <main className="scroll-y flex flex-col gap-4 px-4 pb-3 pt-2">
        <form onSubmit={review} noValidate className="flex flex-col gap-4">
          <Field
            label="To"
            right={
              recents.length > 0 && !to ? null : (
                <span className="text-xs text-dim">
                  From <span className="font-semibold text-muted">{acct.name}</span>
                </span>
              )
            }
            error={tried && toErr ? toErr : recipientErr}
          >
            {(id) => (
              <div className="flex flex-col gap-1.5">
                <div className="relative">
                  <Input
                    id={id}
                    value={to}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (isPayLink(v)) applyPaste(v);
                      else setTo(v);
                    }}
                    onPaste={(e) => {
                      const text = e.clipboardData.getData('text');
                      if (isPayLink(text)) {
                        e.preventDefault();
                        applyPaste(text);
                      }
                    }}
                    placeholder="G… address or payment link"
                    mono
                    autoCapitalize="characters"
                    autoCorrect="off"
                    spellCheck={false}
                    className="pr-14"
                    bad={tried && !toOk}
                  />
                  <button
                    type="button"
                    aria-label="Paste"
                    onClick={async () => {
                      const t = await readClipboard();
                      if (t) applyPaste(t);
                      else toast('Clipboard is empty or blocked. Paste into the field instead.', 'warn');
                    }}
                    className="absolute right-1.5 top-1 flex h-11 w-11 items-center justify-center text-muted hover:text-text"
                  >
                    <IconPaste />
                  </button>
                </div>
                {toOk && checking && (
                  <span className="flex items-center gap-2 text-[13px] text-muted">
                    <Spinner className="h-3.5 w-3.5" />
                    Checking this account on Testnet…
                  </span>
                )}
                {toOk && !checking && r && r.exists && (
                  <span className="flex items-center gap-2 text-[13px] font-medium text-good">
                    <IconCheck className="h-3.5 w-3.5" />
                    Account is active{native ? '' : r.hasTrustline ? ` · can receive ${asset.code}` : ` · has no ${asset.code} trustline yet`}
                  </span>
                )}
                {toOk && !checking && r && !r.exists && (
                  <div className="flex gap-2.5 rounded-xl border border-warn/30 bg-warn/10 px-3 py-2.5 text-[13px] leading-relaxed">
                    <IconWarn className="h-[18px] w-[18px] shrink-0 text-warn" />
                    <span>
                      {native
                        ? "This account isn't on Stellar yet. Sending at least 1 XLM will create it."
                        : `This account isn't on Stellar yet, so it can't receive ${asset.code}. Send it 1 XLM first, or ask them to activate it.`}
                    </span>
                  </div>
                )}
              </div>
            )}
          </Field>

          {!to && recents.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="hint px-1">Recent</span>
              <div className="flex gap-2 overflow-x-auto pb-0.5">
                {recents.map((g) => (
                  <button key={g} type="button" onClick={() => setTo(g)} className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full border border-line bg-surface py-0 pl-1 pr-3 text-[13px] font-semibold">
                    <Orb publicKey={g} size={32} />
                    <span className="font-mono text-xs text-muted">{shortAddress(g)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <span id="asset-label" className="label">
              Asset
            </span>
            <div role="group" aria-labelledby="asset-label" className="grid grid-cols-2 gap-2">
              {balances.map((b) => {
                const on = sameAsset(b.asset, asset);
                const sp = isNative(b.asset) ? (data?.xlm.spendable ?? '0') : subAmounts(b.balance, b.sellingLiabilities);
                return (
                  <button
                    key={assetKey(b.asset)}
                    type="button"
                    aria-pressed={on}
                    onClick={() => {
                      setAsset(b.asset);
                      setTried(false);
                    }}
                    className={`flex h-14 min-w-0 items-center gap-2.5 overflow-hidden rounded-[16px] bg-surface px-3 text-left ${on ? 'border-[1.5px] border-accent' : 'border border-line'}`}
                  >
                    <AssetLogo asset={b.asset} size={30} />
                    <span className="flex min-w-0 flex-col items-start">
                      <span className="text-sm font-semibold">{b.asset.code}</span>
                      <span className="truncate text-xs text-muted">{formatAmount(sp)} spendable</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <Field
            label="Amount"
            right={
              <button type="button" onClick={() => setAmt(maxSend)} className="h-8 px-2.5 text-[13px] font-semibold text-accent">
                Max {formatAmount(maxSend)}
              </button>
            }
            error={tried && amtErr ? amtErr : null}
            hint={
              amtOk && parsed.ok
                ? needsMin
                  ? 'New accounts need at least 1 XLM to be created.'
                  : `${formatAmount(after)} ${asset.code} left after this send${native ? ' (fee not included)' : ''}`
                : native
                  ? 'Max keeps the reserve and the fee intact.'
                  : undefined
            }
          >
            {(id) => (
              <div className="relative">
                <Input id={id} value={amt} onChange={(e) => setAmt(e.target.value)} placeholder="0.00" inputMode="decimal" className="pr-[70px] text-xl font-semibold tabular" bad={tried && !amtOk} />
                <span className="absolute right-4 top-[15px] text-[15px] font-semibold text-muted">{asset.code}</span>
              </div>
            )}
          </Field>

          <Field
            label={
              <>
                Memo <span className="font-medium text-dim">(optional)</span>
              </>
            }
            right={<span className={`text-xs font-semibold ${memoOk ? 'text-dim' : 'text-bad'}`}>{bytes}/{STELLAR.memoMaxBytes}</span>}
            error={!memoOk ? `Memos are limited to ${STELLAR.memoMaxBytes} bytes. Emoji count as 4.` : null}
            hint="Some exchanges and apps need a memo to credit you. Don't add one unless they asked."
          >
            {(id) => <Input id={id} value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="A note the recipient can see" bad={!memoOk} />}
          </Field>
          <button type="submit" className="hidden" />
        </form>
      </main>
      <footer className="flex flex-col gap-1.5 border-t border-surface px-4 pb-5 pt-2">
        {blocked && (
          <span role="alert" className="error-text px-1">
            {blocked}
          </span>
        )}
        {data && !data.exists && <span className="error-text px-1">This account isn&apos;t activated yet. Fund it with Friendbot first.</span>}
        <div className="flex justify-between px-1 text-[13px] text-muted">
          <span>Network fee</span>
          <span className="tabular">{fee} XLM</span>
        </div>
        <button type="button" onClick={() => review()} disabled={building} className={valid ? 'btn-primary' : 'btn-primary bg-surface-2 text-dim'}>
          {building ? (
            <>
              <Spinner /> Building…
            </>
          ) : checking ? (
            'Checking recipient…'
          ) : recipientBlocks ? (
            r?.exists ? `They need to add ${asset.code} first` : `Recipient can't receive ${asset.code}`
          ) : (
            'Review'
          )}
        </button>
      </footer>
    </Screen>
  );
}

function sameAssetCheck(r: RecipientCheck, asset: AssetRef): boolean {
  // The check result is asset-specific only through hasTrustline; recompute cheaply from the cached account info.
  const isIssuer = !isNative(asset) && asset.issuer === r.info.publicKey;
  const has = isNative(asset) || isIssuer || r.info.balances.some((b) => sameAsset(b.asset, asset));
  return r.hasTrustline === has && r.isIssuer === isIssuer;
}
