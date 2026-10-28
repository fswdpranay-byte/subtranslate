import type { EngineId, EngineMode, EngineStatus } from '@/types';

export type EngineEvent =
  | { type: 'status'; status: EngineStatus; detail?: string }
  | { type: 'partial'; text: string }
  | { type: 'final'; text: string; confidence?: number }
  | { type: 'error'; message: string; fatal: boolean }
  | { type: 'info'; message: string };

export interface EngineStartOptions {
  /** BCP-47 tag or "auto". */
  language: string;
  onEvent: (event: EngineEvent) => void;
  /** Normalized microphone level (0..1). */
  onLevel?: (level: number) => void;
}

export interface TranscriptionEngine {
  readonly id: EngineId;
  readonly mode: EngineMode;
  readonly label: string;
  isSupported: () => boolean;
  start: (options: EngineStartOptions) => Promise<void>;
  stop: () => Promise<void>;
}
