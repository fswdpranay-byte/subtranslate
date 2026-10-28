import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Layers, LayoutDashboard, Settings2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const TABS = [
  { to: '/', label: 'Captions', icon: LayoutDashboard, end: true },
  { to: '/overlay', label: 'Overlay', icon: Layers, end: false },
  { to: '/settings', label: 'Settings', icon: Settings2, end: false },
];

export function AppLayout() {
  const location = useLocation();
  const hideNav = location.pathname === '/overlay';

  return (
    <div className="relative min-h-dvh bg-ink-950 text-ink-100">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -top-40 left-1/2 h-[28rem] w-[40rem] -translate-x-1/2 rounded-full bg-brand-500/[0.08] blur-[120px]" />
        <div className="absolute -bottom-52 right-[-10rem] h-[28rem] w-[28rem] rounded-full bg-accent-500/[0.06] blur-[110px]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,transparent_20%,rgba(7,11,20,0.7)_75%)]" />
      </div>

      <div className="relative mx-auto min-h-dvh w-full max-w-6xl">
        <Outlet />
      </div>

      {!hideNav ? (
        <nav
          aria-label="Primary"
          className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))]"
        >
          <div className="flex w-full max-w-xs items-center gap-1 rounded-2xl border border-white/10 bg-ink-900/85 p-1.5 shadow-[0_20px_50px_-15px_rgba(0,0,0,0.9)] backdrop-blur-xl">
            {TABS.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    'flex flex-1 flex-col items-center gap-1 rounded-xl px-2 py-1.5 transition',
                    isActive
                      ? 'bg-white/[0.07] text-brand-200'
                      : 'text-ink-500 hover:bg-white/[0.04] hover:text-ink-200',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon className="h-4 w-4" strokeWidth={isActive ? 2.2 : 1.8} />
                    <span className="text-[9px] font-semibold uppercase tracking-wider">{label}</span>
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </nav>
      ) : null}
    </div>
  );
}
