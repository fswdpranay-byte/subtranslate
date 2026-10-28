/** Shared domain types for SubTranslate. */

export type EngineId = 'web-speech' | 'whisper' | 'deepgram';
export type EngineMode = 'on-device' | 'trial';
export type EngineStatus = 'idle' | 'starting' | 'listening' | 'stopping' | 'error';
export type SubtitlePosition = 'top' | 'center' | 'bottom';
export type TranslationState = 'pending' | 'done' | 'error' | 'skipped';

export interface SubtitleStyle {
  fontSize: number;
  /** 0 - 100 */
  backgroundOpacity: number;
  textColor: string;
  position: SubtitlePosition;
  showOriginal: boolean;
}

export interface OverlayPosition {
  /** Percentage of the viewport width (0 - 100). */
  x: number;
  /** Percentage of the viewport height (0 - 100). */
  y: number;
}

export interface Preferences {
  sourceLang: string;
  targetLang: string;
  engine: EngineId;
  autoTranslate: boolean;
  subtitle: SubtitleStyle;
  overlay: OverlayPosition;
  saveHistoryToCloud: boolean;
}

export interface OnboardingState {
  completed: boolean;
  micGranted: boolean;
  overlayExplained: boolean;
  overlayGranted: boolean;
  completedAt: string | null;
}

export interface TranscriptSegment {
  id: string;
  original: string;
  translated?: string;
  isFinal: boolean;
  at: number;
  confidence?: number;
  translationState: TranslationState;
  translationProvider?: string;
}

export interface Profile {
  id: string;
  display_name: string | null;
  locale: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface EngineDescriptor {
  id: EngineId;
  name: string;
  shortName: string;
  mode: EngineMode;
  description: string;
  available: boolean;
  reason?: string;
  badge?: string;
}

export type MicrophonePermission = 'unknown' | 'prompt' | 'granted' | 'denied' | 'unsupported';

export interface TranslationResult {
  text: string;
  provider: string;
  ok: boolean;
  cached: boolean;
}
