import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSession } from '@/app/session';
import { looksLikePrivateMode, storageAvailable } from '@/core/vault';
import { Screen } from '@/ui/Screen';
import { StovaMark, Wordmark } from '@/ui/Logo';
import { NetworkPill } from '@/ui/NetworkPill';
import { IconGlobe, IconKey, IconLock, IconWarn } from '@/ui/Icons';

const POINTS = [
  { Icon: IconKey, title: 'Non-custodial', text: "Only you hold the keys. We can't touch your funds." },
  { Icon: IconGlobe, title: 'Testnet today, Mainnet soon', text: 'Practice with free test money first.' },
  { Icon: IconLock, title: 'Locked with your password', text: 'Encrypted on this device. Nothing is sent to a server.' },
];

export function Welcome() {
  const session = useSession();
  const [privateMode, setPrivateMode] = useState(false);
  const [storageOk, setStorageOk] = useState(true);
  useEffect(() => {
    void looksLikePrivateMode().then(setPrivateMode);
    void storageAvailable().then(setStorageOk);
  }, []);
  const blocked = !storageOk || !!session.storageError;

  return (
    <Screen>
      <header className="flex justify-end px-4 pt-4">
        <NetworkPill />
      </header>
      <main className="scroll-y flex flex-col gap-7 px-6 pt-6">
        <div className="flex flex-col items-center gap-[18px] pt-9 text-center">
          <StovaMark size={84} />
          <div className="flex flex-col gap-2">
            <Wordmark />
            <p className="m-0 max-w-[280px] text-[17px] text-muted">A Stellar wallet that lives in your browser. Your keys never leave your device.</p>
          </div>
        </div>
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {POINTS.map(({ Icon, title, text }) => (
            <li key={title} className="card flex items-center gap-3 px-4 py-3.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-accent">
                <Icon />
              </span>
              <span className="flex flex-col">
                <span className="text-[15px] font-semibold">{title}</span>
                <span className="text-[13px] text-muted">{text}</span>
              </span>
            </li>
          ))}
        </ul>
        {blocked && (
          <div className="flex gap-3 rounded-2xl border border-bad/25 bg-bad/[0.08] p-3.5 text-[13px] leading-relaxed">
            <IconWarn className="h-5 w-5 shrink-0 text-bad" />
            <span>
              This browser won&apos;t let STOVA store anything, so a wallet can&apos;t be created here. Private browsing and full storage do this. STOVA never falls back to
              unencrypted storage.
            </span>
          </div>
        )}
      </main>
      <footer className="flex flex-col gap-2.5 px-6 pb-7 pt-4">
        <Link to="/create/backup" className={`btn-primary ${blocked ? 'pointer-events-none opacity-50' : ''}`} aria-disabled={blocked}>
          Create a new wallet
        </Link>
        <Link to="/import" className={`btn-secondary ${blocked ? 'pointer-events-none opacity-50' : ''}`} aria-disabled={blocked}>
          I already have a wallet
        </Link>
        <span className="text-center text-xs text-dim">
          {privateMode ? 'This looks like a private window. It forgets the wallet when the window closes.' : 'Private browsing forgets this wallet when the window closes.'}
        </span>
      </footer>
    </Screen>
  );
}
