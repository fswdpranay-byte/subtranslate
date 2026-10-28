import { useEffect, useState } from 'react';
import { RefreshCw, Wifi, WifiOff, X } from 'lucide-react';
import { applyUpdate, isStandalone } from '@/lib/pwa';
import { promptInstall } from '@/lib/install';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useUiStore } from '@/store/useUiStore';
import { Button } from '@/components/ui/Button';

export function PwaBanners() {
  const online = useOnlineStatus();
  const updateAvailable = useUiStore((state) => state.updateAvailable);
  const offlineReady = useUiStore((state) => state.offlineReady);
  const canInstall = useUiStore((state) => state.canInstall);
  const installDismissed = useUiStore((state) => state.installDismissed);
  const dismissInstall = useUiStore((state) => state.dismissInstall);
  const setOfflineReady = useUiStore((state) => state.setOfflineReady);
  const setUpdateAvailable = useUiStore((state) => state.setUpdateAvailable);
  const [standalone, setStandalone] = useState(isStandalone());

  useEffect(() => {
    const interval = window.setInterval(() => setStandalone(isStandalone()), 2000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!offlineReady) return;
    const timer = window.setTimeout(() => setOfflineReady(false), 6000);
    return () => window.clearTimeout(timer);
  }, [offlineReady, setOfflineReady]);

  if (offlineReady) {
    return (
      <div className="fixed inset-x-0 top-0 z-[75] flex justify-center p-3">
        <div className="flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-950/90 px-3 py-1.5 text-[11px] text-emerald-200 shadow-xl backdrop-blur">
          <Wifi className="h-3 w-3" /> App shell cached — SubTranslate is ready offline.
          <button
            type="button"
            aria-label="Dismiss offline notice"
            onClick={() => setOfflineReady(false)}
            className="ml-1 opacity-60 hover:opacity-100"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>
    );
  }

  if (!online) {
    return (
      <div className="fixed inset-x-0 top-0 z-[75] flex justify-center p-3">
        <div className="flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-950/90 px-3 py-1.5 text-[11px] text-amber-200 shadow-xl backdrop-blur">
          <WifiOff className="h-3 w-3" /> Offline — on-device engines still work; translation may pause.
        </div>
      </div>
    );
  }

  if (updateAvailable) {
    return (
      <div className="fixed inset-x-0 top-0 z-[75] flex justify-center p-3">
        <div className="flex items-center gap-3 rounded-2xl border border-brand-400/20 bg-ink-900/95 px-3 py-2 text-[11px] text-ink-200 shadow-xl backdrop-blur">
          <RefreshCw className="h-3.5 w-3.5 text-brand-300" />
          <span>A new SubTranslate build is ready.</span>
          <Button size="sm" onClick={() => void applyUpdate()} className="h-7 px-2 text-[10px]">
            Reload
          </Button>
          <button
            type="button"
            aria-label="Dismiss update"
            onClick={() => setUpdateAvailable(false)}
            className="text-ink-500 hover:text-white"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>
    );
  }

  if (canInstall && !installDismissed && !standalone) {
    return (
      <div className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-[60] flex justify-center px-4 lg:bottom-6">
        <div className="flex w-full max-w-md items-center gap-3 rounded-2xl border border-white/10 bg-ink-900/95 p-3 shadow-2xl backdrop-blur-xl">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-400/10 text-brand-300">
            <Wifi className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-white">Install SubTranslate</p>
            <p className="text-[10px] text-ink-400">Full-screen, offline-ready, no app store needed.</p>
          </div>
          <Button size="sm" onClick={() => void promptInstall()}>
            Install
          </Button>
          <button
            type="button"
            aria-label="Dismiss install prompt"
            onClick={dismissInstall}
            className="rounded-md p-1 text-ink-500 hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return null;
}
