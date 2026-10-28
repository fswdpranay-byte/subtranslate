import { useCallback, useEffect, useState } from 'react';
import { toast } from '@/store/useUiStore';
import { usePreferencesStore } from '@/store/usePreferencesStore';
import {
  buildOverlayConfig,
  checkOverlayPermission,
  isAndroidNative,
  isNativeOverlayRunning,
  isSystemAudioSupported,
  requestOverlayPermission,
  startNativeOverlay,
  stopNativeOverlay,
  updateNativeOverlay,
  type CaptureMode,
} from '@/lib/nativeOverlay';

export function useNativeOverlay() {
  const [permission, setPermission] = useState<boolean | null>(null);
  const [running, setRunning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [systemAudioSupported, setSystemAudioSupported] = useState(false);
  const preferences = usePreferencesStore((state) => state.preferences);

  const refresh = useCallback(async () => {
    if (!isAndroidNative) {
      setPermission(false);
      setRunning(false);
      setSystemAudioSupported(false);
      return;
    }
    setPermission(await checkOverlayPermission());
    setRunning(await isNativeOverlayRunning());
    setSystemAudioSupported(await isSystemAudioSupported());
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
    (captureMode: CaptureMode = 'microphone') =>
      buildOverlayConfig(
        preferences.subtitle,
        preferences.sourceLang,
        preferences.targetLang,
        preferences.autoTranslate && preferences.targetLang !== 'none',
        captureMode,
      ),
    [preferences],
  );

  const start = useCallback(
    async (captureMode: CaptureMode = 'microphone'): Promise<boolean> => {
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

        // Switching mic <-> system needs a fresh foreground-service type, so
        // stop any live overlay and wait for onDestroy before starting again.
        if (await isNativeOverlayRunning()) {
          await stopNativeOverlay();
          for (let attempt = 0; attempt < 15; attempt += 1) {
            if (!(await isNativeOverlayRunning())) break;
            await new Promise((resolve) => window.setTimeout(resolve, 100));
          }
        }

        await startNativeOverlay(config(captureMode));

        // startForegroundService resolves before the service finishes onCreate,
        // so give it a moment before reflecting the running state in the UI.
        for (let attempt = 0; attempt < 10; attempt += 1) {
          if (await isNativeOverlayRunning()) break;
          await new Promise((resolve) => window.setTimeout(resolve, 100));
        }

        setRunning(true);
        toast(
          captureMode === 'system' ? 'Instagram audio capture started' : 'Floating overlay started',
          captureMode === 'system'
            ? 'Accept the screen-capture prompt. The first run downloads a small offline speech model.'
            : 'Drag the card to reposition it. Tap ✕ to stop.',
          'success',
        );
        return true;
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : typeof error === 'object' && error && 'message' in error
              ? String((error as { message: unknown }).message)
              : 'The native overlay service rejected the request.';
        toast('Could not start overlay', message, 'error');
        return false;
      } finally {
        setBusy(false);
        void refresh();
      }
    },
    [config, refresh],
  );

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
    systemAudioSupported,
    permission,
    running,
    busy,
    start,
    stop,
    update,
    refresh,
  };
}
