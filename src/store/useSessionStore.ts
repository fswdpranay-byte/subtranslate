import { create } from 'zustand';
import type { EngineId, EngineStatus, TranscriptSegment, TranscriptSegment as Segment } from '@/types';

const MAX_SEGMENTS = 250;

interface SessionStore {
  status: EngineStatus;
  activeEngine: EngineId | null;
  segments: Segment[];
  interim: string;
  error: string | null;
  translationNotice: string | null;
  startedAt: number | null;
  lastEngineDetail: string | null;
  inputLevel: number;

  startSession: (engine: EngineId, detail?: string) => void;
  stopSession: () => void;
  setStatus: (status: EngineStatus, detail?: string | null) => void;
  addSegment: (segment: TranscriptSegment) => void;
  updateSegment: (id: string, patch: Partial<TranscriptSegment>) => void;
  setInterim: (text: string) => void;
  setError: (message: string | null) => void;
  setTranslationNotice: (message: string | null) => void;
  setInputLevel: (level: number) => void;
  clearSession: () => void;
}

export const useSessionStore = create<SessionStore>()((set) => ({
  status: 'idle',
  activeEngine: null,
  segments: [],
  interim: '',
  error: null,
  translationNotice: null,
  startedAt: null,
  lastEngineDetail: null,
  inputLevel: 0,

  startSession: (engine, detail) =>
    set((state) => ({
      status: 'listening',
      activeEngine: engine,
      startedAt: state.startedAt ?? Date.now(),
      error: null,
      lastEngineDetail: detail ?? null,
    })),

  stopSession: () =>
    set({
      status: 'idle',
      activeEngine: null,
      interim: '',
      startedAt: null,
      lastEngineDetail: null,
      inputLevel: 0,
    }),

  setStatus: (status, detail) =>
    set((state) => ({
      status,
      lastEngineDetail: detail === undefined ? state.lastEngineDetail : detail,
    })),

  addSegment: (segment) =>
    set((state) => {
      const normalized = segment.original.trim();
      if (!normalized) return state;

      const recentDuplicate = state.segments
        .slice(-4)
        .some(
          (existing) =>
            existing.original.trim().toLowerCase() === normalized.toLowerCase() &&
            Math.abs(existing.at - segment.at) < 2500,
        );
      if (recentDuplicate) return state;

      const segments = [...state.segments, { ...segment, original: normalized }];
      return {
        segments:
          segments.length > MAX_SEGMENTS ? segments.slice(segments.length - MAX_SEGMENTS) : segments,
        interim: '',
        error: null,
      };
    }),

  updateSegment: (id, patch) =>
    set((state) => ({
      segments: state.segments.map((segment) =>
        segment.id === id ? { ...segment, ...patch } : segment,
      ),
    })),

  setInterim: (text) => set({ interim: text }),

  setError: (message) =>
    set({
      error: message,
      ...(message ? { status: 'error' as const } : {}),
    }),

  setTranslationNotice: (message) => set({ translationNotice: message }),

  setInputLevel: (level) => set({ inputLevel: Math.max(0, Math.min(1, level)) }),

  clearSession: () =>
    set((state) => ({
      segments: [],
      interim: '',
      error: null,
      translationNotice: null,
      startedAt: state.status === 'listening' ? state.startedAt : null,
    })),
}));
