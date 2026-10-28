import { toast, useUiStore } from '@/store/useUiStore';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;

export function initInstallPrompt(): void {
  if (typeof window === 'undefined') return;

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    useUiStore.getState().setCanInstall(true);
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    useUiStore.getState().setCanInstall(false);
    toast('SubTranslate installed', 'Launch it from your home screen.', 'success');
  });
}

export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferredPrompt) {
    toast(
      'Use your browser menu',
      'Choose "Install app" or "Add to Home screen" to install SubTranslate.',
      'info',
    );
    return 'unavailable';
  }
  await deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  if (outcome === 'accepted') {
    useUiStore.getState().setCanInstall(false);
  }
  deferredPrompt = null;
  return outcome;
}
