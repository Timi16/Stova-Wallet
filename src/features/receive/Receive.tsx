import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useActiveAccount } from '@/app/session';
import { useAccountInfo } from '@/app/queries';
import { copyText } from '@/app/clipboard';
import { useToast } from '@/app/toast';
import { buildPayLink, parseAmount, XLM, type AssetRef } from '@/core/stellar';
import { BackButton, Header, Screen } from '@/ui/Screen';
import { AccountChip, AccountSheet } from '@/ui/AccountChip';
import { NetworkPill } from '@/ui/NetworkPill';
import { QR } from '@/ui/QR';
import { IconChevronDown, IconCopy, IconShare } from '@/ui/Icons';

/** Address with copy, QR code, share, and an optional SEP-7 request with an amount. */
export function Receive() {
  const acct = useActiveAccount();
  const pk = acct?.publicKey ?? '';
  const info = useAccountInfo(pk);
  const toast = useToast();
  const [acctOpen, setAcctOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [reqOn, setReqOn] = useState(false);
  const [amt, setAmt] = useState('');
  const [asset, setAsset] = useState<AssetRef>(XLM);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  const assets: AssetRef[] = info.data?.balances.map((b) => b.asset) ?? [XLM];
  const parsed = parseAmount(amt);
  const link = useMemo(() => (parsed.ok ? buildPayLink(pk, parsed.value, asset) : null), [parsed, pk, asset]);
  if (!acct) return <Navigate to="/home" replace />;
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const share = async () => {
    if (!canShare) {
      toast((await copyText(pk)) ? 'Sharing not supported here. Address copied instead.' : "Couldn't copy");
      return;
    }
    try {
      await navigator.share({ title: `${acct.name} · Stellar Testnet`, text: pk });
    } catch {
      /* cancelled */
    }
  };

  return (
    <Screen>
      <Header
        left={<BackButton to="/home" />}
        title="Receive"
        right={
          <button type="button" onClick={share} aria-label="Share address" className="icon-btn">
            <IconShare />
          </button>
        }
      />
      <main className="scroll-y flex flex-col items-center gap-4 px-5 pb-5 pt-2">
        <div className="flex items-center justify-center gap-0.5 self-stretch">
          <AccountChip onOpen={() => setAcctOpen(true)} />
          <span className="w-1.5" />
          <NetworkPill quiet linkTo={null} />
        </div>

        <QR value={link ?? pk} label={link ? 'QR code of your payment request' : 'QR code of your Stellar address'} />

        <div className="card flex flex-col gap-2.5 self-stretch px-4 py-3.5">
          <span className="label">{acct.name} address</span>
          <span className="font-mono text-[13px] leading-[1.7] break-all select-all">{pk}</span>
          <button
            type="button"
            onClick={async () => {
              const ok = await copyText(pk);
              setCopied(ok);
              toast(ok ? 'Address copied' : "Couldn't copy");
            }}
            className="btn-primary h-12 text-[15px]"
          >
            <IconCopy className="h-4 w-4" />
            {copied ? 'Copied' : 'Copy address'}
          </button>
        </div>

        <div className="card self-stretch overflow-hidden">
          <button type="button" onClick={() => setReqOn((v) => !v)} aria-expanded={reqOn} className="flex h-[52px] w-full items-center justify-between px-4 text-[15px] font-semibold">
            <span>Request a specific amount</span>
            <IconChevronDown className={`h-[18px] w-[18px] text-muted transition-transform ${reqOn ? 'rotate-180' : ''}`} />
          </button>
          {reqOn && (
            <div className="flex flex-col gap-2.5 px-4 pb-4 animate-pop">
              <div className="flex gap-2">
                <input
                  value={amt}
                  onChange={(e) => setAmt(e.target.value)}
                  placeholder="0.00"
                  inputMode="decimal"
                  aria-label="Amount"
                  className={`input min-w-0 flex-1 text-lg font-semibold tabular ${amt && !parsed.ok ? 'input-bad' : ''}`}
                />
                <select
                  aria-label="Asset"
                  value={asset.issuer ? `${asset.code}:${asset.issuer}` : 'native'}
                  onChange={(e) => setAsset(assets.find((a) => (a.issuer ? `${a.code}:${a.issuer}` : 'native') === e.target.value) ?? XLM)}
                  className="h-[52px] rounded-[16px] border border-line bg-surface-2 px-3.5 text-sm font-semibold"
                >
                  {assets.map((a) => (
                    <option key={a.issuer ? `${a.code}:${a.issuer}` : 'native'} value={a.issuer ? `${a.code}:${a.issuer}` : 'native'}>
                      {a.code}
                    </option>
                  ))}
                </select>
              </div>
              {amt && !parsed.ok && <span className="error-text">{parsed.message}</span>}
              {link && (
                <div className="flex flex-col gap-2">
                  <span className="hint">Payment link · opens in any Stellar wallet. The QR above now encodes it.</span>
                  <span className="rounded-xl bg-surface-2 px-3 py-2.5 font-mono text-xs leading-relaxed break-all">{link}</span>
                  <button type="button" onClick={async () => toast((await copyText(link)) ? 'Payment link copied' : "Couldn't copy")} className="btn-secondary h-11 text-sm">
                    <IconCopy className="h-4 w-4" />
                    Copy payment link
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
        <span className="text-center text-xs text-dim">Only send Stellar Testnet assets to this address. Mainnet assets sent here are lost.</span>
      </main>
      <AccountSheet open={acctOpen} onClose={() => setAcctOpen(false)} />
    </Screen>
  );
}
