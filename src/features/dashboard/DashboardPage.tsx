import { Link } from 'react-router-dom';
import { Layers, UserRound, Wifi, WifiOff } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { LiveControlCard } from './LiveControlCard';
import { LanguageControls } from './LanguageControls';
import { EngineToggle } from './EngineToggle';
import { SubtitleCustomizer } from './SubtitleCustomizer';
import { OverlayLauncher } from './OverlayLauncher';
import { TranscriptPanel } from './TranscriptPanel';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useAuthStore } from '@/store/useAuthStore';
import { cn } from '@/lib/utils';

export function DashboardPage() {
  const online = useOnlineStatus();
  const user = useAuthStore((state) => state.user);
  const profile = useAuthStore((state) => state.profile);
  const initial =
    profile?.display_name?.trim().charAt(0).toUpperCase() ||
    user?.email?.charAt(0).toUpperCase() ||
    'G';

  return (
    <div className="px-4 pb-32 pt-4 sm:px-6">
      <header className="mb-4 flex items-center justify-between gap-3">
        <Logo />
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              'hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium xs:flex',
              online
                ? 'border-emerald-400/15 bg-emerald-400/[0.06] text-emerald-300'
                : 'border-amber-400/15 bg-amber-400/[0.06] text-amber-300',
            )}
          >
            {online ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            {online ? 'Online' : 'Offline'}
          </span>
          <Link
            to="/overlay"
            aria-label="Open overlay simulator"
            title="Overlay simulator"
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.04] text-ink-300 ring-1 ring-inset ring-white/10 transition hover:bg-white/10 hover:text-white"
          >
            <Layers className="h-4 w-4" />
          </Link>
          <Link
            to="/settings"
            aria-label="Settings and account"
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400/20 to-accent-500/20 text-xs font-bold text-brand-100 ring-1 ring-inset ring-white/10 transition hover:from-brand-400/30 hover:to-accent-500/30"
          >
            {user ? initial : <UserRound className="h-4 w-4" />}
          </Link>
        </div>
      </header>

      <div className="space-y-4">
        <LiveControlCard />

        <div className="grid gap-4 lg:grid-cols-12 lg:items-start">
          <div className="order-2 space-y-4 lg:order-1 lg:col-span-5">
            <LanguageControls />
            <EngineToggle />
            <SubtitleCustomizer />
            <OverlayLauncher />
          </div>

          <div className="order-1 lg:order-2 lg:col-span-7 lg:sticky lg:top-4">
            <TranscriptPanel />
          </div>
        </div>

        <footer className="flex flex-col items-center gap-1 pb-2 pt-3 text-center sm:flex-row sm:justify-between">
          <p className="text-[10px] text-ink-400">
            SubTranslate v0.1 · Free-tier infrastructure · No audio recordings
          </p>
          <p className="flex items-center gap-1 text-[10px] text-ink-400">
            <span className="h-1 w-1 rounded-full bg-emerald-400/70" />
            On-device by default · Deepgram trial opt-in
          </p>
        </footer>
      </div>
    </div>
  );
}
