import { useCallback, useEffect, useState } from 'react';
import type { MicrophonePermission } from '@/types';
import { requestMicrophoneAccess } from '@/services/audio/pcmCapture';
import {
  checkNativeMicrophonePermission,
  isAndroidNative,
  requestNativeMicrophonePermission,
} from '@/lib/nativeOverlay';

const ANDROID_DENIED_MESSAGE =
  'Android blocked the microphone. Open Settings → Apps → SubTranslate → Permissions → Microphone and choose “Allow”, then try again.';

function readPermissionState(): Promise<MicrophonePermission> {
  if (!navigator.permissions?.query || !navigator.mediaDevices?.getUserMedia) {
    return Promise.resolve('unsupported');
  }
  return navigator.permissions
    .query({ name: 'microphone' as PermissionName })
    .then((status) => status.state as MicrophonePermission)
    .catch(() => 'prompt' as MicrophonePermission);
}

function webErrorMessage(cause: unknown): string {
  const name = (cause as DOMException)?.name;
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'Microphone access was denied. Allow it in your browser site settings (the lock icon in the address bar).';
  }
  if (name === 'NotFoundError') return 'No microphone was found on this device.';
  if (name === 'NotReadableError') {
    return 'The microphone is busy in another app. Close it and try again.';
  }
  // Keep descriptive messages from pcmCapture instead of a generic fallback.
  if (cause instanceof Error && cause.message) return cause.message;
  return 'Could not access the microphone.';
}

/**
 * Tracks the microphone permission without prompting on mount.
 * `request()` is the only place that triggers the OS/browser prompt.
 *
 * On Android we ask the native runtime directly: WebView `getUserMedia` is
 * unreliable across OEM builds, and the captions themselves run in the native
 * overlay service.
 */
export function useMicrophonePermission() {
  const [permission, setPermission] = useState<MicrophonePermission>('unknown');
  const [isRequesting, setIsRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isAndroidNative) {
      let mounted = true;
      const sync = () => {
        void checkNativeMicrophonePermission().then((granted) => {
          if (mounted) setPermission(granted ? 'granted' : 'prompt');
        });
      };
      sync();

      // Android grants are changed on a different screen; refresh on return.
      const onVisibility = () => {
        if (document.visibilityState === 'visible') sync();
      };
      document.addEventListener('visibilitychange', onVisibility);
      return () => {
        mounted = false;
        document.removeEventListener('visibilitychange', onVisibility);
      };
    }

    let mounted = true;
    void readPermissionState().then((state) => {
      if (mounted) setPermission(state);
    });

    let listener: PermissionStatus | null = null;
    if (navigator.permissions?.query) {
      void navigator.permissions
        .query({ name: 'microphone' as PermissionName })
        .then((status) => {
          listener = status;
          status.onchange = () => {
            if (mounted) setPermission(status.state as MicrophonePermission);
          };
        })
        .catch(() => undefined);
    }

    return () => {
      mounted = false;
      if (listener) listener.onchange = null;
    };
  }, []);

  const request = useCallback(async (): Promise<boolean> => {
    setIsRequesting(true);
    setError(null);

    try {
      if (isAndroidNative) {
        const granted = await requestNativeMicrophonePermission();
        setPermission(granted ? 'granted' : 'prompt');
        if (!granted) setError(ANDROID_DENIED_MESSAGE);
        return granted;
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        setPermission('unsupported');
        setError('This browser does not expose microphone capture.');
        return false;
      }

      const stream = await requestMicrophoneAccess();
      stream.getTracks().forEach((track) => track.stop());
      setPermission('granted');
      return true;
    } catch (cause) {
      const name = (cause as DOMException)?.name;
      const message = isAndroidNative ? ANDROID_DENIED_MESSAGE : webErrorMessage(cause);
      setPermission(name === 'NotAllowedError' ? 'denied' : 'prompt');
      setError(message);
      return false;
    } finally {
      setIsRequesting(false);
    }
  }, []);

  return { permission, isRequesting, error, request };
}
