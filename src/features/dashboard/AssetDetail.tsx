import { useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useActiveAccount } from '@/app/session';
import { useAccountInfo, usePayments, useRefreshAccount } from '@/app/queries';
import { copyText } from '@/app/clipboard';
import { useToast } from '@/app/toast';
import { dayLabel } from '@/app/format';
import { STELLAR } from '@/config';
import { shortAddress } from '@/core/keys';
import {
  assetDisplayName,
  assetKey,
  buildChangeTrust,
  describeError,
  explorerAssetUrl,
  formatAmount,
  isNative,
  isPositive,
  parseAssetKey,
  presetFor,
  sameAsset,
  submitSigned,
  toStroops,
  type HistoryItem,
} from '@/core/stellar';
import { signTransaction } from '@/core/vault';
import { BackButton, Header, Main, Screen } from '@/ui/Screen';
import { AssetLogo } from '@/ui/AssetLogo';
import { KV, KVCard } from '@/ui/Row';
import { NetworkDot } from '@/ui/NetworkPill';
import { Sheet } from '@/ui/Sheet';
import { TxSheet, txAmountLabel, txIconClass } from '@/ui/TxSheet';
import { DoneHero, FailHero, StepOverlay, useJob } from '@/ui/StepOverlay';
import { IconCopy, IconExternal, IconReceive, IconSend, IconShield } from '@/ui/Icons';

export function AssetDetail() {
  const { key } = useParams();
  const asset = parseAssetKey(decodeURIComponent(key ?? 'native'));
  const acct = useActiveAccount();
  const pk = acct?.publicKey ?? '';
  const info = useAccountInfo(pk);
  const payments = usePayments(pk);
  const refresh = useRefreshAccount(pk);
  const toast = useToast();
  const navigate = useNavigate();
  const [tx, setTx] = useState<HistoryItem | null>(null);
  const [removeOpen, setRemoveOpen] = useState(false);
  const job = useJob();

  if (!acct) return <Navigate to="/home" replace />;
  const native = isNative(asset);
  const bal = info.data?.balances.find((b) => sameAsset(b.asset, asset));
  const balance = bal?.balance ?? '0';
  const preset = presetFor(asset);
  const zero = !isPositive(balance);
  const activity = (payments.data?.pages.flatMap((p) => p.items) ?? []).filter((i) => i.asset && sameAsset(i.asset, asset)).slice(0, 10);

  /** Build → sign → submit once. One signed XDR per confirmation. */
  const removeAsset = async () => {
    setRemoveOpen(false);
    let signed: ReturnType<typeof signTransaction> | null = null;
    await job.run([
      async () => {
        const built = await buildChangeTrust(pk, asset, '0');
        signed = built.tx;
      },
      async () => {
        signTransaction(signed!, pk);
      },
      async () => {
        await submitSigned(signed!);
        await refresh();
      },
    ]);
  };

  return (
    <Screen>
      <Header
        left={<BackButton to="/home" />}
        title={assetDisplayName(asset)}
        right={
          <button type="button" onClick={async () => toast((await copyText(pk)) ? 'Address copied' : "Couldn't copy")} aria-label="Copy address" className="icon-btn">
            <IconCopy />
          </button>
        }
      />
      <Main>
        <section className="flex flex-col items-center gap-2.5 pt-1">
          <AssetLogo asset={asset} size={64} />
          <div className="flex items-baseline gap-2">
            <span className="text-[44px] font-bold leading-none tracking-[-0.035em] tabular">{formatAmount(balance)}</span>
            <span className="text-lg font-medium text-muted">{asset.code}</span>
          </div>
          {native ? (
            <span className="pill">Native asset · pays network fees</span>
          ) : preset ? (
            <span className="pill text-text">
              <IconShield className="h-3.5 w-3.5 text-accent" />
              Issued by {preset.issuerName} · verified
            </span>
          ) : (
            <span className="pill font-mono">{shortAddress(asset.issuer!, 6, 6)}</span>
          )}
          {bal && !bal.authorized && <span className="pill text-warn">Waiting for issuer approval</span>}
        </section>

        <div className="grid grid-cols-2 gap-2.5">
          <Link to={`/send?asset=${encodeURIComponent(assetKey(asset))}`} className="btn-primary h-[52px] text-[15px]">
            <IconSend />
            Send
          </Link>
          <Link to="/receive" className="btn-secondary h-[52px] text-[15px]">
            <IconReceive />
            Receive
          </Link>
        </div>

        <KVCard>
          {native ? (
            <>
              <KV k="Spendable" v={`${formatAmount(info.data?.xlm.spendable ?? '0')} XLM`} />
              <KV k="Reserved by Stellar" v={`${formatAmount(info.data?.xlm.reserve ?? '0')} XLM`} />
              <KV k="Why reserved" v={<span className="text-[13px] font-normal text-muted">1.00 base + 0.50 per asset</span>} />
            </>
          ) : (
            <>
              <KV k="Issuer" v={shortAddress(asset.issuer!, 6, 6)} mono />
              <KV k="Trustline" v={bal ? (bal.limit && toStroops(bal.limit) < 9_223_372_036_854_775_807n ? `Active · limit ${formatAmount(bal.limit)}` : 'Active · no limit') : 'Not added'} />
              <KV k="XLM reserved for it" v={`${STELLAR.baseReserve.toFixed(2)} XLM`} />
            </>
          )}
          <KV
            k="Network"
            v={
              <span className="inline-flex items-center gap-[7px]">
                <NetworkDot />
                Stellar Testnet
              </span>
            }
          />
          {!native && (
            <a href={explorerAssetUrl(asset.code, asset.issuer!)} target="_blank" rel="noopener noreferrer" className="kv text-text">
              <span className="text-muted">Explorer</span>
              <span className="inline-flex items-center gap-1 font-semibold text-accent">
                View on Stellar Expert
                <IconExternal className="h-[13px] w-[13px]" />
              </span>
            </a>
          )}
        </KVCard>

        <section className="flex flex-col gap-0.5">
          <span className="label px-1 pb-1">{asset.code} activity</span>
          {activity.length === 0 && <span className="px-1 py-3 text-[13px] text-muted">No {asset.code} payments yet.</span>}
          {activity.map((f) => (
            <button key={f.id} type="button" onClick={() => setTx(f)} className="flex h-[58px] items-center gap-3 rounded-[14px] px-1 text-left hover:bg-surface">
              <span className={`flex h-9 w-9 items-center justify-center rounded-full bg-surface ${txIconClass(f.kind)}`}>{f.kind === 'in' || f.kind === 'funded' ? <IconReceive className="h-4 w-4" /> : <IconSend className="h-4 w-4" />}</span>
              <span className="flex flex-1 flex-col">
                <span className="text-sm font-semibold">{f.kind === 'in' ? 'Received' : f.kind === 'out' ? 'Sent' : f.title}</span>
                <span className="text-xs text-muted">
                  {f.kind === 'out' ? 'to ' : 'from '}
                  {f.counterparty.startsWith('G') ? shortAddress(f.counterparty) : f.counterparty} · {dayLabel(f.createdAt)}
                </span>
              </span>
              <span className={`text-sm font-semibold tabular ${txIconClass(f.kind)}`}>{txAmountLabel(f)}</span>
            </button>
          ))}
        </section>
      </Main>

      {!native && bal && (
        <footer className="flex flex-col items-center gap-1 px-4 pb-5 pt-2">
          <button type="button" disabled={!zero} onClick={() => setRemoveOpen(true)} className={`h-11 text-sm font-semibold ${zero ? 'text-bad' : 'text-dim'}`}>
            Remove asset
          </button>
          <span className="hint">{zero ? `Closes the trustline and frees ${STELLAR.baseReserve.toFixed(2)} XLM.` : `Send your ${asset.code} out first. Removing frees ${STELLAR.baseReserve.toFixed(2)} XLM.`}</span>
        </footer>
      )}

      <TxSheet item={tx} onClose={() => setTx(null)} />

      <Sheet open={removeOpen} onClose={() => setRemoveOpen(false)} title={`Remove ${asset.code} from this account?`}>
        <span className="text-sm leading-relaxed text-muted">This closes the trustline and frees {STELLAR.baseReserve.toFixed(2)} XLM. You can add {asset.code} again any time. Nothing is sent anywhere.</span>
        <KVCard className="card-inner">
          <KV k="Network fee" v="≈ 0.00001 XLM" />
        </KVCard>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setRemoveOpen(false)} className="btn-secondary">
            Keep it
          </button>
          <button type="button" onClick={removeAsset} className="btn-danger">
            Remove and sign
          </button>
        </div>
      </Sheet>

      <StepOverlay
        state={job.state}
        steps={[
          { label: 'Closing the trustline', text: 'A change-trust operation with the limit set to 0.' },
          { label: 'Signing on this device', text: 'Your key is used here, in this browser, and nowhere else.' },
          { label: 'Submitting to Stellar Testnet', text: 'Usually confirmed in about 5 seconds.' },
        ]}
        done={
          <>
            <DoneHero title={`${asset.code} removed`} text={`The trustline is closed and ${STELLAR.baseReserve.toFixed(2)} XLM is spendable again. Add ${asset.code} back any time.`} />
            <footer className="flex flex-col gap-2 px-4 pb-6 pt-2">
              <button type="button" className="btn-primary" onClick={() => navigate('/home')}>
                Back to wallet
              </button>
            </footer>
          </>
        }
        fail={(e) => {
          const f = describeError(e);
          return (
            <>
              <FailHero title={f.title} text={f.message} code={f.code} />
              <footer className="flex flex-col gap-2 px-4 pb-6 pt-2">
                <button type="button" className="btn-primary" onClick={job.reset}>
                  Back
                </button>
              </footer>
            </>
          );
        }}
      />
    </Screen>
  );
}
