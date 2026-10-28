import { registerSW } from 'virtual:pwa-register';
import { useUiStore } from '@/store/useUiStore';

let updateServiceWorker: ((reloadPage?: boolean) => Promise<void>) | null = null;

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
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      // Check for a new deployment once an hour while the app stays open.
      window.setInterval(() => void registration.update(), 60 * 60 * 1000);
    },
    onRegisterError(error) {
      console.warn('[SubTranslate] Service worker registration failed', error);
    },
  });
}

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
