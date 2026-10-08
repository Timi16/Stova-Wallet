import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useActiveAccount } from '@/app/session';
import { useAccountInfo, useRefreshAccount } from '@/app/queries';
import { shortHash } from '@/app/format';
import { PRESET_ASSETS, STELLAR } from '@/config';
import { classifyAddress, shortAddress } from '@/core/keys';
import {
  buildChangeTrust,
  compareAmounts,
  describeError,
  fetchDirectory,
  formatAmount,
  isValidAssetCode,
  sameAsset,
  subAmounts,
  submitSigned,
  type AssetRef,
  type DirectoryAsset,
  type SubmitResult,
} from '@/core/stellar';
import { signTransaction } from '@/core/vault';
import { BackButton, Footer, Header, Main, Screen } from '@/ui/Screen';
import { AssetLogo } from '@/ui/AssetLogo';
import { Field, Input } from '@/ui/Field';
import { KV, KVCard } from '@/ui/Row';
import { Sheet } from '@/ui/Sheet';
import { DoneHero, FailHero, StepOverlay, useJob } from '@/ui/StepOverlay';
import { IconCheck, IconLock, IconShield, Spinner } from '@/ui/Icons';

/**
 * Add asset: USDC preset, a browsable Testnet directory (search, logos,
 * trustline counts), and a custom code + issuer form. Every path ends in the
 * same confirm sheet → build → sign → submit.
 */
export function AddAsset() {
  const acct = useActiveAccount();
  const pk = acct?.publicKey ?? '';
  const info = useAccountInfo(pk);
  const refresh = useRefreshAccount(pk);
  const [code, setCode] = useState('');
  const [issuer, setIssuer] = useState('');
  const [tried, setTried] = useState(false);
  const [sheet, setSheet] = useState<{ asset: AssetRef; meta?: DirectoryAsset } | null>(null);
  const [lastAdded, setLastAdded] = useState<AssetRef | null>(null);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const job = useJob();

  useEffect(() => {
    const t = setTimeout(() => setQuery(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const dir = useInfiniteQuery({
    queryKey: ['directory', query],
    queryFn: ({ pageParam }) => fetchDirectory({ search: query, cursor: pageParam }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    staleTime: 5 * 60_000,
  });

  const data = info.data;
  const held = (a: AssetRef) => !!data?.balances.some((b) => sameAsset(b.asset, a));
  const spendable = data?.xlm.spendable ?? '0';
  const needed = String(STELLAR.baseReserve + 0.0001);
  const enoughXlm = !!data?.exists && compareAmounts(spendable, needed) >= 0;

  const codeUp = code.trim().toUpperCase();
  const iss = issuer.trim();
  const codeErr = !codeUp ? 'Enter the asset code.' : !isValidAssetCode(codeUp) ? 'Letters and digits only, up to 12.' : '';
  const issuerKind = classifyAddress(iss);
  const issuerErr =
    issuerKind === 'empty'
      ? 'Enter the issuer address.'
      : issuerKind === 'secret'
        ? "That's a secret key. Never paste those here."
        : issuerKind === 'valid'
          ? iss === pk
            ? "That's this account. An issuer is a different account."
            : ''
          : 'A Stellar address starts with G and has 56 characters.';
  const customValid = !codeErr && !issuerErr;
  const customAsset = useMemo<AssetRef | null>(() => (customValid ? { code: codeUp, issuer: iss } : null), [customValid, codeUp, iss]);

  const listed = useMemo(() => {
    const seen = new Set<string>();
    const out: DirectoryAsset[] = [];
    for (const it of dir.data?.pages.flatMap((p) => p.items) ?? []) {
      const k = `${it.asset.code}:${it.asset.issuer}`;
      if (!seen.has(k) && !PRESET_ASSETS.some((p) => p.code === it.asset.code && p.issuer === it.asset.issuer)) {
        seen.add(k);
        out.push(it);
      }
    }
    return out;
  }, [dir.data]);

  if (!acct) return <Navigate to="/home" replace />;

  const confirmAdd = (asset: AssetRef, meta?: DirectoryAsset) => {
    if (!data?.exists || !enoughXlm) return;
    setSheet({ asset, meta });
  };

  const doAdd = async () => {
    const a = sheet?.asset;
    if (!a) return;
    setSheet(null);
    setLastAdded(a);
    let signed: Awaited<ReturnType<typeof buildChangeTrust>>['tx'] | null = null;
    await job.run([
      async () => {
        const built = await buildChangeTrust(pk, a);
        signed = built.tx;
      },
      async () => {
        signTransaction(signed!, pk);
      },
      async () => {
        const r = await submitSigned(signed!);
        setResult(r);
        await refresh();
      },
    ]);
    setCode('');
    setIssuer('');
    setTried(false);
  };

  const AddButton = ({ asset, meta }: { asset: AssetRef; meta?: DirectoryAsset }) =>
    held(asset) ? (
      <span className="inline-flex shrink-0 items-center gap-1.5 text-[13px] font-semibold text-good">
        <IconCheck className="h-3.5 w-3.5" />
        Added
      </span>
    ) : (
      <button
        type="button"
        disabled={!enoughXlm}
        aria-label={`Add ${asset.code}`}
        onClick={() => confirmAdd(asset, meta)}
        className="h-9 shrink-0 rounded-full bg-accent px-3.5 text-[13px] font-semibold text-accent-ink disabled:bg-surface-2 disabled:text-dim"
      >
        Add
      </button>
    );

  return (
    <Screen>
      <Header left={<BackButton to="/home" />} title="Add asset" />
      <Main className="gap-[18px] pb-5">
        <p className="m-0 px-1 text-sm leading-relaxed text-muted">
          Adding an asset opens a trustline so your account can hold it. Each one holds {STELLAR.baseReserve.toFixed(2)} XLM in reserve while it&apos;s open.
        </p>

        {data && !data.exists && (
          <div className="flex gap-3 rounded-2xl border border-warn/30 bg-warn/10 p-3.5 text-[13px] leading-relaxed">
            This account isn&apos;t activated yet. Fund it with Friendbot on the Home screen first, then come back to add assets.
          </div>
        )}
        {data?.exists && !enoughXlm && (
          <div className="flex gap-3 rounded-2xl border border-warn/30 bg-warn/10 p-3.5 text-[13px] leading-relaxed">
            Not enough XLM for the reserve. You have {formatAmount(spendable)} XLM spendable and a new asset needs {STELLAR.baseReserve.toFixed(2)} plus the fee.
          </div>
        )}

        <section className="flex flex-col gap-2">
          <span className="label px-1">Verified on Testnet</span>
          <div className="card px-2 py-1">
            {PRESET_ASSETS.map((p) => {
              const a: AssetRef = { code: p.code, issuer: p.issuer };
              return (
                <div key={p.code} className="flex h-[68px] items-center gap-3.5 border-b border-line px-2 last:border-b-0">
                  <AssetLogo asset={a} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="inline-flex items-center gap-1.5 text-[15px] font-semibold">
                      {p.name}
                      <IconShield className="h-3.5 w-3.5 text-accent" />
                    </span>
                    <span className="truncate text-xs text-muted">
                      {p.code} · {p.issuerName} · <span className="font-mono">{shortAddress(p.issuer)}</span>
                    </span>
                  </span>
                  <AddButton asset={a} />
                </div>
              );
            })}
          </div>
        </section>

        <section className="flex flex-col gap-2">
          <span className="label px-1">Browse Testnet assets</span>
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by code, name or issuer" aria-label="Search Testnet assets" autoCapitalize="characters" spellCheck={false} />
          <div className="card px-2 py-1">
            {dir.isLoading && (
              <div className="flex h-[68px] items-center justify-center gap-2 text-[13px] text-muted">
                <Spinner className="h-3.5 w-3.5" />
                Loading the Testnet directory…
              </div>
            )}
            {dir.error && (
              <div className="flex h-[68px] flex-col items-center justify-center gap-1 px-2 text-center text-[13px] text-muted">
                <span>Couldn&apos;t reach the asset directory.</span>
                <button type="button" onClick={() => dir.refetch()} className="font-semibold text-accent">
                  Retry
                </button>
              </div>
            )}
            {!dir.isLoading && !dir.error && listed.length === 0 && (
              <div className="flex h-[68px] items-center justify-center px-2 text-center text-[13px] text-muted">
                {query ? `Nothing on Testnet matches "${query}". Use the custom form below if you know the issuer.` : 'No assets listed right now.'}
              </div>
            )}
            {listed.map((it) => (
              <div key={`${it.asset.code}:${it.asset.issuer}`} className="flex min-h-[68px] items-center gap-3.5 border-b border-line px-2 py-2 last:border-b-0">
                <AssetLogo asset={it.asset} image={it.image} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[15px] font-semibold">{it.name ? `${it.name} (${it.asset.code})` : it.asset.code}</span>
                  <span className="truncate text-xs text-muted">
                    {it.orgName ?? it.domain ?? <span className="font-mono">{shortAddress(it.asset.issuer!, 6, 6)}</span>}
                    {' · '}
                    {it.trustlines.toLocaleString()} {it.trustlines === 1 ? 'holder' : 'holders'}
                  </span>
                </span>
                <AddButton asset={it.asset} meta={it} />
              </div>
            ))}
            {dir.hasNextPage && (
              <button type="button" onClick={() => dir.fetchNextPage()} disabled={dir.isFetchingNextPage} className="btn-ghost h-11 w-full text-sm">
                {dir.isFetchingNextPage ? 'Loading…' : 'Load more'}
              </button>
            )}
          </div>
          <span className="hint px-1">Listed by Stellar Expert. Anyone can issue an asset with any code, so check the issuer before you trust it.</span>
        </section>

        <section className="flex flex-col gap-2.5">
          <span className="label px-1">Custom asset</span>
          <Field label="Asset code" error={tried ? codeErr || null : null}>
            {(id) => <Input id={id} value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. NGNT" maxLength={12} autoCapitalize="characters" bad={tried && !!codeErr} />}
          </Field>
          <Field label="Issuer address" error={tried ? issuerErr || null : null} hint="Get the issuer from the asset's official site. Anyone can issue an asset with the same code, so the issuer is what makes it real.">
            {(id) => <Input id={id} value={issuer} onChange={(e) => setIssuer(e.target.value)} placeholder="G…" mono autoCapitalize="characters" spellCheck={false} bad={tried && !!issuerErr} />}
          </Field>
          {customAsset && held(customAsset) && <span className="text-[13px] font-medium text-good">Already added to this account.</span>}
          <button
            type="button"
            onClick={() => {
              if (!customValid) {
                setTried(true);
                return;
              }
              if (customAsset && !held(customAsset)) confirmAdd(customAsset);
            }}
            disabled={!!customAsset && (held(customAsset) || !enoughXlm)}
            className={customValid && enoughXlm ? 'btn-primary' : 'btn-primary bg-surface-2 text-dim'}
          >
            {customValid ? `Add ${codeUp}` : 'Add custom asset'}
          </button>
        </section>
      </Main>

      <Sheet open={!!sheet} onClose={() => setSheet(null)}>
        {sheet && (
          <>
            <div className="flex items-center gap-3">
              <AssetLogo asset={sheet.asset} size={44} image={sheet.meta?.image} />
              <span className="flex min-w-0 flex-col">
                <h2 className="m-0 text-lg font-semibold">Add {sheet.asset.code}?</h2>
                <span className="truncate text-xs text-muted">
                  {sheet.meta?.orgName ?? sheet.meta?.domain ?? PRESET_ASSETS.find((p) => p.issuer === sheet.asset.issuer)?.issuerName ?? 'Unknown issuer'} ·{' '}
                  <span className="font-mono">{shortAddress(sheet.asset.issuer!, 6, 6)}</span>
                </span>
              </span>
            </div>
            {sheet.meta && (
              <span className="text-[13px] text-muted">
                {sheet.meta.trustlines.toLocaleString()} accounts hold it · rating {sheet.meta.rating.toFixed(1)}/10 on Stellar Expert
              </span>
            )}
            <KVCard className="card-inner">
              <KV k="Holds in reserve" v={`${STELLAR.baseReserve.toFixed(2)} XLM`} />
              <KV k="Network fee" v="≈ 0.00001 XLM" />
              <KV k="Spendable XLM after" v={formatAmount(subAmounts(spendable, String(STELLAR.baseReserve)))} />
            </KVCard>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setSheet(null)} className="btn-secondary">
                Cancel
              </button>
              <button type="button" onClick={doAdd} className="btn-primary">
                <IconLock className="h-4 w-4" />
                Add and sign
              </button>
            </div>
          </>
        )}
      </Sheet>

      <StepOverlay
        state={job.state}
        steps={[
          { label: 'Building the trustline', text: `A change-trust operation for ${lastAdded?.code ?? 'the asset'}.` },
          { label: 'Signing on this device', text: 'Your key is used here, in this browser, and nowhere else.' },
          { label: 'Submitting to Stellar Testnet', text: 'Usually confirmed in about 5 seconds.' },
        ]}
        done={
          <>
            <DoneHero title={`${lastAdded?.code} added`} text={`Your account can hold it now. ${STELLAR.baseReserve.toFixed(2)} XLM stays reserved while the trustline is open.`}>
              <KVCard className="w-full text-left">
                <KV k="Transaction" v={result ? shortHash(result.hash) : '…'} mono />
                <KV k="Spendable XLM now" v={formatAmount(info.data?.xlm.spendable ?? '0')} />
              </KVCard>
            </DoneHero>
            <Footer>
              <Link to="/home" className="btn-primary">
                Done
              </Link>
              <button type="button" className="btn-ghost" onClick={job.reset}>
                Add another asset
              </button>
            </Footer>
          </>
        }
        fail={(e) => {
          const f = describeError(e);
          return (
            <>
              <FailHero title={f.title} text={f.message} code={f.code} />
              <Footer>
                <button type="button" className="btn-primary" onClick={job.reset}>
                  Back
                </button>
              </Footer>
            </>
          );
        }}
      />
    </Screen>
  );
}
