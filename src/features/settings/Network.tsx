import { useState } from 'react';
import { useActiveAccount, useSession } from '@/app/session';
import { useRefreshAccount } from '@/app/queries';
import { useToast } from '@/app/toast';
import { NETWORK } from '@/config';
import { fundWithFriendbot, FriendbotError } from '@/core/stellar';
import { BackButton, Header, Main, Screen } from '@/ui/Screen';
import { ListRow, Section } from '@/ui/Row';
import { IconCheck, IconGlobe, IconStar, Spinner } from '@/ui/Icons';

/** Network: fixed to Testnet in this build. The badge can't be hidden; Mainnet is listed as coming soon. */
export function Network() {
  const toast = useToast();
  const session = useSession();
  const acct = useActiveAccount();
  const refresh = useRefreshAccount(acct?.publicKey);
  const [funding, setFunding] = useState(false);

  const fund = async () => {
    if (!acct || funding) return;
    setFunding(true);
    try {
      await fundWithFriendbot(acct.publicKey);
      await new Promise((r) => setTimeout(r, 2000));
      await refresh();
      toast(`10,000 XLM arrived for ${acct.name}`);
    } catch (e) {
      toast(e instanceof FriendbotError ? e.message : "Friendbot didn't answer", 'warn');
    } finally {
      setFunding(false);
    }
  };

  const back = session.status === 'unlocked' ? '/home' : session.status === 'locked' ? '/unlock' : '/welcome';

  return (
    <Screen>
      <Header left={<BackButton to={back} />} title="Network" />
      <Main className="pb-5">
        <section className="card flex items-start gap-3.5 border border-testnet/25 p-[18px]">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-testnet/[0.12]">
            <span className="h-3.5 w-3.5 rounded-full bg-testnet shadow-[0_0_0_4px_rgba(56,189,248,0.2)]" />
          </span>
          <span className="flex flex-col gap-1">
            <span className="text-base font-semibold">You&apos;re on Stellar Testnet</span>
            <span className="text-[13px] leading-relaxed text-muted">A practice network. XLM and USDC here are free and worth nothing. Everything else works exactly like Mainnet.</span>
          </span>
        </section>

        <Section title="Choose a network" foot="Your address is the same on every network. Balances and assets are separate.">
          <NetRow dot="bg-good" name="Mainnet" sub="Real XLM and USDC · the live Stellar network" soon onClick={() => toast('Mainnet is coming soon. Your keys will work there as they are.')} />
          <NetRow dot="bg-testnet" name="Testnet" sub="Free test assets · resets a few times a year" selected onClick={() => toast('Already on Testnet')} />
          <NetRow dot="bg-dim" name="Custom network" sub="Your own Horizon and RPC URLs" soon onClick={() => toast('Custom networks are coming soon')} />
        </Section>

        <Section title="Testnet tools">
          {acct ? (
            <ListRow
              icon={funding ? <Spinner className="h-4 w-4" /> : <IconStar className="h-[17px] w-[17px]" />}
              label={funding ? 'Asking Friendbot…' : `Fund ${acct.name} with Friendbot`}
              sub="Friendbot sends 10,000 XLM to a new account"
              onClick={fund}
              trailing={<span />}
            />
          ) : null}
          <ListRow icon={<span className="font-bold">$</span>} label="Get test USDC" sub="Circle's faucet · needs the USDC asset added first" href={NETWORK.usdcFaucetUrl} />
          <ListRow icon={<IconGlobe className="h-[17px] w-[17px]" />} label="Testnet explorer" sub="Stellar Expert · look up any account or transaction" href={NETWORK.explorerUrl} />
          <ListRow icon={<IconStar className="h-[17px] w-[17px]" />} label="Stellar Lab faucet" sub="Backup when Friendbot is rate-limited" href={NETWORK.labFaucetUrl} />
        </Section>
      </Main>
    </Screen>
  );
}

function NetRow({ dot, name, sub, selected, soon, onClick }: { dot: string; name: string; sub: string; selected?: boolean; soon?: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`flex min-h-16 w-full items-center gap-3 px-4 text-left [&+&]:border-t [&+&]:border-line ${soon ? 'text-dim' : 'text-text'}`}>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-2">
        <span className={`h-3 w-3 rounded-full ${dot}`} />
      </span>
      <span className="flex flex-1 flex-col gap-0.5">
        <span className="text-[15px] font-semibold">{name}</span>
        <span className="text-xs text-muted">{sub}</span>
      </span>
      {selected && (
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-accent-ink">
          <IconCheck className="h-3.5 w-3.5" strokeWidth={3} />
        </span>
      )}
      {soon && <span className="shrink-0 rounded-full bg-surface-3 px-2.5 py-1 text-[11px] font-semibold text-muted">Coming soon</span>}
    </button>
  );
}
