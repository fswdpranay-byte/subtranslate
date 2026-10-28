import { registerSW } from 'virtual:pwa-register';
import { useUiStore } from '@/store/useUiStore';

let updateServiceWorker: ((reloadPage?: boolean) => Promise<void>) | null = null;
let registration: ServiceWorkerRegistration | null = null;
let lastUpdateCheck = 0;

/** Registers the service worker and wires update/offline notifications into the UI store. */
export function initPwa(): void {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

  updateServiceWorker = registerSW({
    immediate: true,
    onNeedRefresh() {
      useUiStore.getState().setUpdateAvailable(true);
    },
    onOfflineReady() {
      useUiStore.getState().setOfflineReady(true);
    },
    onRegisteredSW(_swUrl, registered) {
      if (!registered) return;
      registration = registered;
      // Check for a new deployment hourly while the app stays open.
      window.setInterval(() => void registration?.update(), 60 * 60 * 1000);

      // Returning to the app is a good moment to look for a new build.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState !== 'visible') return;
        const now = Date.now();
        if (now - lastUpdateCheck < 15 * 60 * 1000) return;
        lastUpdateCheck = now;
        void registration?.update();
      });
    },
    onRegisterError(error) {
      console.warn('[SubTranslate] Service worker registration failed', error);
    },
  });
}

/**
 * Ask the service worker to check for a new build right now.
 * Returns true when a new version is installed and waiting to activate.
 */
export async function checkWebUpdate(): Promise<boolean> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return useUiStore.getState().updateAvailable;
  }

  try {
    const active = registration ?? (await navigator.serviceWorker.getRegistration());
    if (!active) return useUiStore.getState().updateAvailable;

    registration = active;
    lastUpdateCheck = Date.now();
    await active.update();

    if (active.waiting) {
      useUiStore.getState().setUpdateAvailable(true);
      return true;
    }

    // The browser may finish installing the new worker just after update().
    await new Promise((resolve) => window.setTimeout(resolve, 1200));
    if (active.waiting) {
      useUiStore.getState().setUpdateAvailable(true);
      return true;
    }
  } catch (error) {
    console.warn('[SubTranslate] Update check failed', error);
  }

  return useUiStore.getState().updateAvailable;
}

/** Activate the waiting service worker and reload the page. */
export async function applyUpdate(): Promise<void> {
  useUiStore.getState().setUpdateAvailable(false);
  await updateServiceWorker?.(true);
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}
