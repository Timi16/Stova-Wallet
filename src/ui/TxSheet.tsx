import { useNavigate } from 'react-router-dom';
import { useTransaction } from '@/app/queries';
import { copyText } from '@/app/clipboard';
import { useToast } from '@/app/toast';
import { shortHash, whenLabel } from '@/app/format';
import { shortAddress } from '@/core/keys';
import { explorerTxUrl, formatAmount, type HistoryItem } from '@/core/stellar';
import { Sheet } from './Sheet';
import { KV, KVCard } from './Row';
import { IconCheck, IconClose, IconCopy, IconExternal, IconSend, Spinner } from './Icons';

export function txIconClass(kind: HistoryItem['kind']) {
  return kind === 'in' || kind === 'funded' ? 'text-good' : kind === 'out' || kind === 'created' ? 'text-text' : 'text-accent';
}

export function txSign(kind: HistoryItem['kind']) {
  return kind === 'in' || kind === 'funded' ? '+' : kind === 'out' || kind === 'created' ? '−' : '·';
}

export function txAmountLabel(item: HistoryItem) {
  if (!item.amount || !item.asset) return '';
  return `${txSign(item.kind)}${formatAmount(item.amount)} ${item.asset.code}`;
}

/** Transaction detail as a bottom sheet: status, party, memo, fee, ledger, hash, explorer link. */
export function TxSheet({ item, onClose }: { item: HistoryItem | null; onClose: () => void }) {
  const toast = useToast();
  const navigate = useNavigate();
  const detail = useTransaction(item?.txHash ?? null);
  if (!item) return null;
  const out = item.kind === 'out' || item.kind === 'created';
  return (
    <Sheet open={!!item} onClose={onClose}>
      <div className="flex items-center gap-3">
        <span className={`flex h-11 w-11 items-center justify-center rounded-full bg-surface-2 text-lg font-semibold ${txIconClass(item.kind)}`}>{txSign(item.kind)}</span>
        <span className="flex flex-1 flex-col">
          <h2 className="m-0 text-lg font-semibold">{item.title}</h2>
          <span className="text-xs text-muted">{whenLabel(item.createdAt)}</span>
        </span>
        <span className="text-lg font-semibold tabular">{txAmountLabel(item)}</span>
      </div>
      <KVCard className="card-inner">
        <KV
          k="Status"
          v={
            item.successful ? (
              <span className="inline-flex items-center gap-1.5 text-good">
                <IconCheck className="h-3.5 w-3.5" />
                Confirmed
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-bad">
                <IconClose className="h-3.5 w-3.5" />
                Failed
              </span>
            )
          }
        />
        <KV k={out ? 'To' : 'From'} v={item.counterparty.startsWith('G') ? shortAddress(item.counterparty, 6, 6) : item.counterparty} mono />
        <KV k="Memo" v={detail.data ? detail.data.memo || 'none' : detail.isLoading ? <Spinner className="h-3.5 w-3.5 text-muted" /> : '—'} />
        <KV k="Fee" v={detail.data ? `${detail.data.feeXlm} XLM` : '…'} />
        <KV k="Ledger" v={detail.data ? detail.data.ledger.toLocaleString() : '…'} mono />
        <KV k="Hash" v={shortHash(item.txHash)} mono />
      </KVCard>
      <div className="grid grid-cols-3 gap-2">
        <button type="button" onClick={async () => toast((await copyText(item.txHash)) ? 'Transaction hash copied' : "Couldn't copy")} className="btn-secondary h-[46px] px-2 text-[13px]">
          <IconCopy className="h-[15px] w-[15px]" />
          Hash
        </button>
        <a href={explorerTxUrl(item.txHash)} target="_blank" rel="noopener noreferrer" className="btn-secondary h-[46px] px-2 text-[13px]">
          <IconExternal className="h-[15px] w-[15px]" />
          Explorer
        </a>
        {item.counterparty.startsWith('G') ? (
          <button
            type="button"
            onClick={() => {
              onClose();
              navigate(`/send?to=${item.counterparty}${item.asset?.issuer ? `&asset=${item.asset.code}:${item.asset.issuer}` : ''}`);
            }}
            className="btn-secondary h-[46px] px-2 text-[13px]"
          >
            <IconSend className="h-[15px] w-[15px]" />
            {out ? 'Repeat' : 'Reply'}
          </button>
        ) : (
          <span />
        )}
      </div>
    </Sheet>
  );
}
