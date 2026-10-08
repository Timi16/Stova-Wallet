import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useSession } from './session';
import { onboardingDraft } from './drafts';
import { Welcome } from '@/features/onboarding/Welcome';
import { Backup } from '@/features/onboarding/Backup';
import { Confirm } from '@/features/onboarding/Confirm';
import { Import } from '@/features/onboarding/Import';
import { SetPassword } from '@/features/onboarding/SetPassword';
import { Unlock } from '@/features/onboarding/Unlock';
import { Home } from '@/features/dashboard/Home';
import { AssetDetail } from '@/features/dashboard/AssetDetail';
import { AddAsset } from '@/features/assets/AddAsset';
import { Receive } from '@/features/receive/Receive';
import { SendForm } from '@/features/send/SendForm';
import { SendReview } from '@/features/send/SendReview';
import { Scan } from '@/features/scan/Scan';
import { History } from '@/features/history/History';
import { Settings } from '@/features/settings/Settings';
import { Export } from '@/features/settings/Export';
import { Network } from '@/features/settings/Network';
import { Accounts } from '@/features/settings/Accounts';
import { StovaMark } from '@/ui/Logo';

function Splash() {
  return (
    <div className="flex h-dvh items-center justify-center bg-ground">
      <StovaMark size={64} className="animate-pulse-soft" />
    </div>
  );
}

/** Wallet must exist (locked or unlocked). */
function RequireWallet({ children }: { children: ReactNode }) {
  const s = useSession();
  if (s.status === 'loading') return <Splash />;
  if (s.status === 'none') return <Navigate to="/welcome" replace />;
  return <>{children}</>;
}

/** Wallet must be unlocked; otherwise go to Unlock and come back afterwards. */
function RequireUnlocked({ children }: { children: ReactNode }) {
  const s = useSession();
  const loc = useLocation();
  if (s.status === 'loading') return <Splash />;
  if (s.status === 'none') return <Navigate to="/welcome" replace />;
  if (s.status === 'locked') return <Navigate to="/unlock" replace state={{ from: loc.pathname + loc.search }} />;
  return <>{children}</>;
}

/** Onboarding screens are only for browsers without a wallet (or add-account flows while unlocked). */
function OnboardingOnly({ children }: { children: ReactNode }) {
  const s = useSession();
  const loc = useLocation();
  const adding = new URLSearchParams(loc.search).get('add') === '1';
  // While a create/import draft is still open the password screen is showing its result; let it finish.
  const finishing = !!onboardingDraft.get();
  if (s.status === 'loading') return <Splash />;
  if (s.status === 'unlocked' && !adding && !finishing) return <Navigate to="/home" replace />;
  if (s.status === 'locked' && !adding && !finishing) return <Navigate to="/unlock" replace />;
  return <>{children}</>;
}

function Root() {
  const s = useSession();
  if (s.status === 'loading') return <Splash />;
  if (s.status === 'none') return <Navigate to="/welcome" replace />;
  if (s.status === 'locked') return <Navigate to="/unlock" replace />;
  return <Navigate to="/home" replace />;
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Root />} />
      <Route path="/welcome" element={<OnboardingOnly><Welcome /></OnboardingOnly>} />
      <Route path="/create/backup" element={<OnboardingOnly><Backup /></OnboardingOnly>} />
      <Route path="/create/confirm" element={<OnboardingOnly><Confirm /></OnboardingOnly>} />
      <Route path="/create/password" element={<OnboardingOnly><SetPassword /></OnboardingOnly>} />
      <Route path="/import" element={<OnboardingOnly><Import /></OnboardingOnly>} />
      <Route path="/import/password" element={<OnboardingOnly><SetPassword /></OnboardingOnly>} />
      <Route path="/unlock" element={<RequireWallet><Unlock /></RequireWallet>} />

      <Route path="/home" element={<RequireUnlocked><Home /></RequireUnlocked>} />
      <Route path="/asset/:key" element={<RequireUnlocked><AssetDetail /></RequireUnlocked>} />
      <Route path="/add-asset" element={<RequireUnlocked><AddAsset /></RequireUnlocked>} />
      <Route path="/receive" element={<RequireUnlocked><Receive /></RequireUnlocked>} />
      <Route path="/send" element={<RequireUnlocked><SendForm /></RequireUnlocked>} />
      {/* Review handles a lock that fires mid-review with its own unlock sheet, so it only needs a wallet. */}
      <Route path="/send/review" element={<RequireWallet><SendReview /></RequireWallet>} />
      <Route path="/scan" element={<RequireUnlocked><Scan /></RequireUnlocked>} />
      <Route path="/activity" element={<RequireUnlocked><History /></RequireUnlocked>} />
      <Route path="/settings" element={<RequireUnlocked><Settings /></RequireUnlocked>} />
      <Route path="/settings/export" element={<RequireUnlocked><Export /></RequireUnlocked>} />
      <Route path="/settings/network" element={<Network />} />
      <Route path="/settings/accounts" element={<RequireUnlocked><Accounts /></RequireUnlocked>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
