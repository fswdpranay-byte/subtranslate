import { Capacitor, registerPlugin } from '@capacitor/core';
import type { SubtitleStyle } from '@/types';

/**
 * Bridge to the native Android floating-overlay service (see native/android/).
 * On the web these methods are never invoked; the PWA simulator is used instead.
 */

export type CaptureMode = 'microphone' | 'system';

export interface NativeOverlayConfig {
  fontSize: number;
  /** 0 - 100 */
  backgroundOpacity: number;
  textColor: string;
  position: 'top' | 'center' | 'bottom';
  showOriginal: boolean;
  sourceLang: string;
  targetLang: string;
  translate: boolean;
  /**
   * `microphone` uses Android's SpeechRecognizer.
   * `system` uses MediaProjection + AudioPlaybackCapture and an on-device Vosk
   * model, which hears the audio Instagram is playing (Android 10+).
   */
  captureMode: CaptureMode;
}

interface PermissionResult {
  granted: boolean;
}

interface RunningResult {
  running: boolean;
}

interface SystemAudioResult {
  supported: boolean;
}

interface SubtitleOverlayPlugin {
  checkPermission: () => Promise<PermissionResult>;
  requestPermission: () => Promise<PermissionResult>;
  openSettings: () => Promise<void>;
  isSystemAudioSupported: () => Promise<SystemAudioResult>;
  start: (options: NativeOverlayConfig) => Promise<void>;
  stop: () => Promise<void>;
  update: (options: NativeOverlayConfig) => Promise<void>;
  isRunning: () => Promise<RunningResult>;
}

const SubtitleOverlay = registerPlugin<SubtitleOverlayPlugin>('SubtitleOverlay');

export const isAndroidNative =
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';

export function buildOverlayConfig(
  style: SubtitleStyle,
  sourceLang: string,
  targetLang: string,
  translate: boolean,
  captureMode: CaptureMode = 'microphone',
): NativeOverlayConfig {
  return {
    fontSize: style.fontSize,
    backgroundOpacity: style.backgroundOpacity,
    textColor: style.textColor,
    position: style.position,
    showOriginal: style.showOriginal,
    sourceLang,
    targetLang,
    translate,
    captureMode,
  };
}

export async function checkOverlayPermission(): Promise<boolean> {
  if (!isAndroidNative) return false;
  try {
    const result = await SubtitleOverlay.checkPermission();
    return result.granted;
  } catch {
    return false;
  }
}

export async function requestOverlayPermission(): Promise<boolean> {
  if (!isAndroidNative) return false;
  try {
    const result = await SubtitleOverlay.requestPermission();
    return result.granted;
  } catch {
    return false;
  }
}

export async function openOverlaySettings(): Promise<boolean> {
  if (!isAndroidNative) return false;
  try {
    await SubtitleOverlay.openSettings();
    return true;
  } catch {
    return false;
  }
}

export async function isSystemAudioSupported(): Promise<boolean> {
  if (!isAndroidNative) return false;
  try {
    const result = await SubtitleOverlay.isSystemAudioSupported();
    return result.supported;
  } catch {
    return false;
  }
}

export async function startNativeOverlay(config: NativeOverlayConfig): Promise<void> {
  await SubtitleOverlay.start(config);
}

export async function stopNativeOverlay(): Promise<void> {
  await SubtitleOverlay.stop();
}

export async function updateNativeOverlay(config: NativeOverlayConfig): Promise<void> {
  await SubtitleOverlay.update(config);
}

export async function isNativeOverlayRunning(): Promise<boolean> {
  if (!isAndroidNative) return false;
  try {
    const result = await SubtitleOverlay.isRunning();
    return result.running;
  } catch {
    return false;
  }
}
