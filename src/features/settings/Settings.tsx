import { useMemo, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAccounts, useActiveAccount, useSession } from '@/app/session';
import { clearQueryCache } from '@/app/queryClient';
import { copyText } from '@/app/clipboard';
import { useToast } from '@/app/toast';
import { APP, SECURITY } from '@/config';
import { shortAddress } from '@/core/keys';
import { explorerAccountUrl } from '@/core/stellar';
import { changePassword, disablePasskey, enablePasskey, hasPasskey, lock, passkeySupport, removeWallet, updateSettings, WrongPasswordError } from '@/core/vault';
import { Screen } from '@/ui/Screen';
import { Orb } from '@/ui/Orb';
import { TabBar } from '@/ui/TabBar';
import { ListRow, Section } from '@/ui/Row';
import { NetworkDot } from '@/ui/NetworkPill';
import { Sheet } from '@/ui/Sheet';
import { Input, PasswordInput } from '@/ui/Field';
import { IconChevronRight, IconClock, IconCopy, IconExternal, IconEyeOff, IconFingerprint, IconGlobe, IconKey, IconLock, IconShield, IconStar, IconTrash, IconUsers } from '@/ui/Icons';
import { passwordStrength } from '../onboarding/password';

export function Settings() {
  const acct = useActiveAccount();
  const accounts = useAccounts();
  const session = useSession();
  const toast = useToast();
  const navigate = useNavigate();
  const [rmOpen, setRmOpen] = useState(false);
  const [rmText, setRmText] = useState('');
  const [pwOpen, setPwOpen] = useState(false);
  const [cur, setCur] = useState('');
  const [np, setNp] = useState('');
  const [np2, setNp2] = useState('');
  const [pwErr, setPwErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [pkOpen, setPkOpen] = useState(false);
  const [pkPw, setPkPw] = useState('');
  const [pkErr, setPkErr] = useState('');
  const [pkBusy, setPkBusy] = useState(false);
  const support = useMemo(() => passkeySupport(), []);
  const passkeyOn = hasPasskey(session.vault);

  if (!acct) return <Navigate to="/home" replace />;
  const settings = session.vault!.settings;
  const tail = acct.publicKey.slice(-4);
  const rmOk = rmText.trim().toUpperCase() === tail;

  const savePw = async () => {
    const st = passwordStrength(np);
    if (!cur) return setPwErr('Enter your current password.');
    if (!st.longEnough) return setPwErr(`New password needs at least ${SECURITY.minPasswordLength} characters.`);
    if (!st.mixed) return setPwErr('Use letters and numbers in the new password.');
    if (np === cur) return setPwErr('Pick a different password from the current one.');
    if (np !== np2) return setPwErr("The new passwords don't match.");
    setBusy(true);
    try {
      await changePassword(cur, np);
      setPwOpen(false);
      setCur('');
      setNp('');
      setNp2('');
      toast('Password updated on this device');
    } catch (e) {
      setPwErr(e instanceof WrongPasswordError ? 'Current password is wrong.' : (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const chip = (on: boolean) => `h-8 rounded-full px-2.5 text-xs font-semibold ${on ? 'bg-accent text-accent-ink' : 'bg-surface-3 text-muted'}`;

  return (
    <Screen>
      <header className="flex items-center px-4 pb-1.5 pt-3.5">
        <h1 className="m-0 flex-1 text-[22px] font-bold">Settings</h1>
      </header>
      <main className="scroll-y flex flex-col gap-4 px-4 pb-4 pt-1">
        <Link to="/settings/accounts" className="card flex items-center gap-3 py-3 pl-3 pr-3.5 text-text">
          <Orb publicKey={acct.publicKey} size={44} />
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-base font-semibold leading-[1.1]">{acct.name}</span>
            <span className="font-mono text-xs leading-[1.1] text-muted">{shortAddress(acct.publicKey)}</span>
            <span className="mt-0.5 text-xs text-dim">
              {accounts.length} {accounts.length === 1 ? 'account' : 'accounts'} · {session.vault?.hasPhrase ? 'one recovery phrase' : 'secret key wallet'}
            </span>
          </span>
          <button
            type="button"
            onClick={async (e) => {
              e.preventDefault();
              toast((await copyText(acct.publicKey)) ? `${acct.name} address copied` : "Couldn't copy");
            }}
            aria-label="Copy address"
            className="icon-btn bg-surface-2"
          >
            <IconCopy className="h-4 w-4" />
          </button>
          <IconChevronRight className="h-4 w-4 text-dim" />
        </Link>

        <Section title="Wallet" foot="Mainnet is coming soon. Your keys will work there without changes.">
          <ListRow icon={<IconUsers className="h-[17px] w-[17px]" />} label="Accounts" value={String(accounts.length)} to="/settings/accounts" />
          <ListRow
            icon={<IconGlobe className="h-[17px] w-[17px]" />}
            label="Stellar network"
            value={
              <span className="inline-flex items-center gap-[7px] font-semibold">
                <NetworkDot />
                Testnet
              </span>
            }
            to="/settings/network"
          />
          <ListRow icon={<IconStar className="h-[17px] w-[17px]" />} label="Get test XLM" value="Friendbot" to="/settings/network" />
        </Section>

        <Section title="Security">
          <ListRow
            icon={<IconFingerprint className="h-[17px] w-[17px]" />}
            label="Unlock with fingerprint or face"
            sub={passkeyOn ? 'On · password still needed to export or remove' : support.ok ? 'Off · password every time' : support.reason}
            trailing={
              <button
                type="button"
                role="switch"
                aria-checked={passkeyOn}
                aria-label="Unlock with fingerprint or face"
                disabled={!support.ok || pkBusy}
                onClick={async () => {
                  if (passkeyOn) {
                    setPkBusy(true);
                    try {
                      await disablePasskey();
                      toast('Fingerprint unlock turned off. You can delete the passkey in your device settings.');
                    } catch (e) {
                      toast((e as Error).message, 'warn');
                    } finally {
                      setPkBusy(false);
                    }
                  } else {
                    setPkPw('');
                    setPkErr('');
                    setPkOpen(true);
                  }
                }}
                className={`relative h-[30px] w-[50px] shrink-0 rounded-full transition-colors disabled:opacity-50 ${passkeyOn ? 'bg-accent' : 'bg-surface-3'}`}
              >
                <span className={`absolute top-[3px] h-6 w-6 rounded-full transition-[left] ${passkeyOn ? 'left-[23px] bg-accent-ink' : 'left-[3px] bg-muted'}`} />
              </button>
            }
          />
          <ListRow
            icon={<IconClock className="h-[17px] w-[17px]" />}
            label="Auto-lock after"
            trailing={
              <div role="group" aria-label="Auto-lock time" className="flex gap-1.5">
                {SECURITY.autoLockOptions.map((m) => (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={settings.autoLockMinutes === m}
                    onClick={() => {
                      void updateSettings({ autoLockMinutes: m });
                      toast(`Auto-lock set to ${m} min`);
                    }}
                    className={chip(settings.autoLockMinutes === m)}
                  >
                    {m} min
                  </button>
                ))}
              </div>
            }
          />
          <ListRow
            icon={<IconEyeOff className="h-[17px] w-[17px]" />}
            label="Hide balances"
            trailing={
              <button
                type="button"
                role="switch"
                aria-checked={settings.hideBalances}
                aria-label="Hide balances"
                onClick={() => updateSettings({ hideBalances: !settings.hideBalances })}
                className={`relative h-[30px] w-[50px] shrink-0 rounded-full transition-colors ${settings.hideBalances ? 'bg-accent' : 'bg-surface-3'}`}
              >
                <span className={`absolute top-[3px] h-6 w-6 rounded-full transition-[left] ${settings.hideBalances ? 'left-[23px] bg-accent-ink' : 'left-[3px] bg-muted'}`} />
              </button>
            }
          />
          <ListRow
            icon={<IconLock className="h-[17px] w-[17px]" />}
            label="Lock now"
            onClick={() => {
              lock();
              navigate('/unlock', { replace: true });
            }}
          />
          <ListRow icon={<IconKey className="h-[17px] w-[17px]" />} label={session.vault?.hasPhrase ? 'Show recovery phrase' : 'Show secret key'} value="Needs password" to="/settings/export" />
          <ListRow icon={<IconShield className="h-[17px] w-[17px]" />} label="Change password" onClick={() => { setPwOpen(true); setPwErr(''); }} />
        </Section>

        <Section title="About">
          <ListRow icon={<IconExternal className="h-[17px] w-[17px]" />} label="This account on Stellar Expert" value="Open" href={explorerAccountUrl(acct.publicKey)} />
          <ListRow icon={<IconGlobe className="h-[17px] w-[17px]" />} label="Version" value={`${APP.version} · open source`} trailing={<span />} />
        </Section>

        <Section foot="Your funds stay on Stellar. You can bring the wallet back with your recovery phrase or secret key.">
          <ListRow icon={<IconTrash className="h-[17px] w-[17px]" />} label="Remove wallet from this device" danger onClick={() => { setRmOpen(true); setRmText(''); }} />
        </Section>
      </main>
      <TabBar />

      <Sheet open={rmOpen} onClose={() => setRmOpen(false)} title="Remove this wallet?" danger>
        <span className="text-sm leading-relaxed text-muted">
          STOVA will forget the encrypted keys on this device. Without your recovery phrase{session.vault?.hasPhrase ? '' : ' or secret key'}, all {accounts.length}{' '}
          {accounts.length === 1 ? 'account' : 'accounts'} and everything in them are gone for good.
        </span>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="confirm" className="label">
            Type the last 4 characters of your address to confirm
          </label>
          <Input id="confirm" value={rmText} onChange={(e) => setRmText(e.target.value)} placeholder={tail} mono className="uppercase" autoCapitalize="characters" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setRmOpen(false)} className="btn-secondary">
            Keep wallet
          </button>
          <button
            type="button"
            disabled={!rmOk}
            onClick={async () => {
              await removeWallet();
              await clearQueryCache(); // the public balance/activity cache goes with it
              navigate('/welcome', { replace: true });
            }}
            className="btn-danger disabled:opacity-50"
          >
            Remove
          </button>
        </div>
      </Sheet>

      <Sheet open={pkOpen} onClose={() => setPkOpen(false)} title="Turn on fingerprint or face unlock">
        <span className="text-sm leading-relaxed text-muted">
          Your device will create a passkey for STOVA and use it to unlock the wallet. Enter your password once to allow it. Export, change password and remove wallet
          always ask for the password.
        </span>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setPkBusy(true);
            setPkErr('');
            try {
              await enablePasskey(pkPw, `STOVA · ${acct.name}`);
              setPkOpen(false);
              setPkPw('');
              toast('Fingerprint unlock is on');
            } catch (ex) {
              setPkErr(ex instanceof WrongPasswordError ? 'Wrong password.' : (ex as Error).message || 'Passkey setup was cancelled.');
            } finally {
              setPkBusy(false);
            }
          }}
          className="flex flex-col gap-3"
        >
          <PasswordInput value={pkPw} onChange={(e) => { setPkPw(e.target.value); setPkErr(''); }} placeholder="Password" aria-label="Password" autoFocus autoComplete="current-password" bad={!!pkErr} className="bg-surface-2" />
          {pkErr && <span className="error-text">{pkErr}</span>}
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setPkOpen(false)} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={pkBusy || !pkPw} className="btn-primary">
              <IconFingerprint />
              {pkBusy ? 'Setting up…' : 'Continue'}
            </button>
          </div>
        </form>
      </Sheet>

      <Sheet open={pwOpen} onClose={() => setPwOpen(false)} title="Change password">
        <div className="flex flex-col gap-2">
          <PasswordInput value={cur} onChange={(e) => { setCur(e.target.value); setPwErr(''); }} placeholder="Current password" aria-label="Current password" autoComplete="current-password" className="bg-surface-2" />
          <PasswordInput value={np} onChange={(e) => { setNp(e.target.value); setPwErr(''); }} placeholder={`New password (${SECURITY.minPasswordLength}+ characters)`} aria-label="New password" autoComplete="new-password" className="bg-surface-2" />
          <PasswordInput value={np2} onChange={(e) => { setNp2(e.target.value); setPwErr(''); }} placeholder="Repeat new password" aria-label="Repeat new password" autoComplete="new-password" className="bg-surface-2" />
          {pwErr && <span className="error-text">{pwErr}</span>}
        </div>
        <span className="hint">This re-encrypts your keys on this device. Your recovery phrase stays the same.</span>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setPwOpen(false)} className="btn-secondary">
            Cancel
          </button>
          <button type="button" onClick={savePw} disabled={busy} className="btn-primary">
            {busy ? 'Updating…' : 'Update'}
          </button>
        </div>
      </Sheet>
    </Screen>
  );
}
