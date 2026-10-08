import { NavLink } from 'react-router-dom';
import { IconActivity, IconHome, IconScan, IconSettings } from './Icons';

const TABS = [
  { to: '/home', label: 'Home', Icon: IconHome },
  { to: '/activity', label: 'Activity', Icon: IconActivity },
  { to: '/scan', label: 'Scan', Icon: IconScan },
  { to: '/settings', label: 'Settings', Icon: IconSettings },
];

export function TabBar() {
  return (
    <nav
      aria-label="Wallet"
      className="grid h-[72px] shrink-0 grid-cols-4 border-t border-surface bg-ground px-2 pt-1.5 pb-[env(safe-area-inset-bottom)]"
    >
      {TABS.map(({ to, label, Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `flex flex-col items-center justify-center gap-1 text-[11px] ${isActive ? 'font-semibold text-accent' : 'font-medium text-dim hover:text-muted'}`
          }
        >
          <Icon className="h-[22px] w-[22px]" />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
