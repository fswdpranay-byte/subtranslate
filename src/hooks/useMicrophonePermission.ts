import { useCallback, useEffect, useState } from 'react';
import type { MicrophonePermission } from '@/types';
import { requestMicrophoneAccess } from '@/services/audio/pcmCapture';

function readPermissionState(): Promise<MicrophonePermission> {
  if (!navigator.permissions?.query || !navigator.mediaDevices?.getUserMedia) {
    return Promise.resolve('unsupported');
  }
  return navigator.permissions
    .query({ name: 'microphone' as PermissionName })
    .then((status) => status.state as MicrophonePermission)
    .catch(() => 'prompt' as MicrophonePermission);
}

/**
 * Tracks the microphone permission without prompting on mount.
 * `request()` is the only place that triggers the OS/browser prompt.
 */
export function useMicrophonePermission() {
  const [permission, setPermission] = useState<MicrophonePermission>('unknown');
  const [isRequesting, setIsRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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
    if (!navigator.mediaDevices?.getUserMedia) {
      setPermission('unsupported');
      setError('This browser does not expose microphone capture.');
      return false;
    }

    setIsRequesting(true);
    setError(null);
    try {
      const stream = await requestMicrophoneAccess();
      stream.getTracks().forEach((track) => track.stop());
      setPermission('granted');
      return true;
    } catch (cause) {
      const name = (cause as DOMException)?.name;
      const message =
        name === 'NotAllowedError' || name === 'SecurityError'
          ? 'Microphone access was denied. Allow it in your browser site settings (the lock icon in the address bar).'
          : name === 'NotFoundError'
            ? 'No microphone was found on this device.'
            : name === 'NotReadableError'
              ? 'The microphone is busy in another app. Close it and try again.'
              : 'Could not access the microphone.';
      setPermission(name === 'NotAllowedError' ? 'denied' : 'prompt');
      setError(message);
      return false;
    } finally {
      setIsRequesting(false);
    }
  }, []);

  return { permission, isRequesting, error, request };
}
