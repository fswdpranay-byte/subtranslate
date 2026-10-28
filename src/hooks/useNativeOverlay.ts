import { useCallback, useEffect, useState } from 'react';
import { toast } from '@/store/useUiStore';
import { usePreferencesStore } from '@/store/usePreferencesStore';
import {
  buildOverlayConfig,
  checkOverlayPermission,
  isAndroidNative,
  isNativeOverlayRunning,
  requestOverlayPermission,
  startNativeOverlay,
  stopNativeOverlay,
  updateNativeOverlay,
} from '@/lib/nativeOverlay';

export function useNativeOverlay() {
  const [permission, setPermission] = useState<boolean | null>(null);
  const [running, setRunning] = useState(false);
  const [busy, setBusy] = useState(false);
  const preferences = usePreferencesStore((state) => state.preferences);

  const refresh = useCallback(async () => {
    if (!isAndroidNative) {
      setPermission(false);
      setRunning(false);
      return;
    }
    setPermission(await checkOverlayPermission());
    setRunning(await isNativeOverlayRunning());
  }, []);

  useEffect(() => {
    void refresh();
    if (!isAndroidNative) return;

    const onVisibility = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [refresh]);

  const config = useCallback(
    () =>
      buildOverlayConfig(
        {
          ...preferences.subtitle,
          // The native service positions itself; keep the shared style fields only.
        },
        preferences.sourceLang,
        preferences.targetLang,
        preferences.autoTranslate && preferences.targetLang !== 'none',
      ),
    [preferences],
  );

  const start = useCallback(async (): Promise<boolean> => {
    if (!isAndroidNative) {
      toast(
        'Android only',
        'A PWA cannot draw over other apps. Open the overlay simulator to test the design, or install the Android build.',
        'info',
      );
      return false;
    }
    setBusy(true);
    try {
      const granted = await checkOverlayPermission();
      setPermission(granted);
      if (!granted) {
        await requestOverlayPermission();
        toast(
          'Enable "Display over other apps"',
          'Turn on SubTranslate in Android settings, then return and tap start again.',
          'info',
        );
        return false;
      }
      await startNativeOverlay(config());
      setRunning(true);
      toast('Floating overlay started', 'Drag the card to reposition it. Tap ✕ to stop.', 'success');
      return true;
    } catch (error) {
      toast(
        'Could not start overlay',
        error instanceof Error ? error.message : 'The native overlay service rejected the request.',
        'error',
      );
      return false;
    } finally {
      setBusy(false);
      void refresh();
    }
  }, [config, refresh]);

  const stop = useCallback(async (): Promise<void> => {
    setBusy(true);
    try {
      await stopNativeOverlay();
      setRunning(false);
    } catch {
      /* service already stopped */
    } finally {
      setBusy(false);
      void refresh();
    }
  }, [refresh]);

  const update = useCallback(async (): Promise<void> => {
    if (!isAndroidNative || !running) return;
    try {
      await updateNativeOverlay(config());
    } catch {
      /* ignore styling race */
    }
  }, [config, running]);

  return {
    isSupported: isAndroidNative,
    permission,
    running,
    busy,
    start,
    stop,
    update,
    refresh,
  };
}
