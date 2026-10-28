import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import { isSameLanguage } from '@/config/languages';
import { toast } from '@/store/useUiStore';
import { usePreferencesStore } from '@/store/usePreferencesStore';
import { useSessionStore } from '@/store/useSessionStore';
import { createEngine, type EngineEvent, type TranscriptionEngine } from '@/services/transcription';
import { translateText } from '@/services/translation';
import { mergeStreamingText, streamingDelta } from '@/lib/transcript';
import type { EngineId, EngineStatus } from '@/types';
import { uid } from '@/lib/utils';

interface TranscriptionContextValue {
  start: () => Promise<void>;
  stop: () => Promise<void>;
  toggle: () => Promise<void>;
  restart: () => Promise<void>;
  isLive: boolean;
  status: EngineStatus;
  activeEngine: EngineId | null;
}

const TranscriptionContext = createContext<TranscriptionContextValue | null>(null);

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return 'An unexpected error stopped the audio engine.';
}

/**
 * Owns the engine lifecycle for the whole app session.
 *
 * Living above the router means captions keep running while you open Settings or
 * the overlay simulator — and the same store renders both the dashboard and the
 * floating subtitle card.
 */
export function TranscriptionProvider({ children }: { children: ReactNode }) {
  const engineRef = useRef<TranscriptionEngine | null>(null);
  const generationRef = useRef(0);
  const startingRef = useRef(false);
  const lastConfigRef = useRef({ engine: 'web-speech' as EngineId, sourceLang: 'auto' });
  const lastNonFatalToastRef = useRef(0);

  const status = useSessionStore((state) => state.status);
  const activeEngine = useSessionStore((state) => state.activeEngine);
  const enginePreference = usePreferencesStore((state) => state.preferences.engine);
  const sourceLangPreference = usePreferencesStore((state) => state.preferences.sourceLang);

  const handleEvent = useCallback((event: EngineEvent, generation: number) => {
    if (generation !== generationRef.current) return;
    const session = useSessionStore.getState();

    switch (event.type) {
      case 'status': {
        if (event.status === 'listening') {
          const engine = engineRef.current;
          session.startSession(engine?.id ?? 'web-speech', event.detail);
        } else if (event.status === 'starting') {
          session.setStatus('starting', event.detail ?? null);
        } else if (event.status === 'error') {
          session.setStatus('error');
        } else if (event.status === 'idle') {
          session.setStatus('idle');
        } else {
          session.setStatus(event.status, event.detail ?? null);
        }
        break;
      }

      case 'partial':
        session.setInterim(event.text);
        break;

      case 'final': {
        const preferences = usePreferencesStore.getState().preferences;
        const autoTranslate =
          preferences.autoTranslate &&
          preferences.targetLang !== 'none' &&
          !isSameLanguage(preferences.sourceLang, preferences.targetLang);

        // Cumulative recognizers re-send the whole utterance on every result.
        // Ignore results that add no new words so the same phrase is not
        // stored — and translated — again and again.
        const shown = session.segments.reduce(
          (text, segment) => mergeStreamingText(text, segment.original),
          '',
        );
        const newWords = streamingDelta(shown, event.text);
        if (!newWords) break;

        const segmentId = uid('seg');

        session.addSegment({
          id: segmentId,
          original: event.text,
          isFinal: true,
          at: Date.now(),
          confidence: event.confidence,
          translationState: autoTranslate ? 'pending' : 'skipped',
        });

        if (!autoTranslate) break;

        const targetAtRequest = preferences.targetLang;
        const sourceAtRequest = preferences.sourceLang;

        void translateText(event.text, sourceAtRequest, targetAtRequest)
          .then((result) => {
            if (generation !== generationRef.current) return;
            if (usePreferencesStore.getState().preferences.targetLang !== targetAtRequest) return;

            const current = useSessionStore.getState();
            current.updateSegment(segmentId, {
              translated: result.text,
              translationState: result.ok ? 'done' : 'error',
              translationProvider: result.provider,
            });
            current.setTranslationNotice(
              result.ok
                ? null
                : 'Translation is unavailable right now — showing the original transcript only.',
            );
          })
          .catch(() => {
            if (generation !== generationRef.current) return;
            useSessionStore.getState().updateSegment(segmentId, { translationState: 'error' });
          });
        break;
      }

      case 'error': {
        if (event.fatal) {
          generationRef.current += 1;
          session.setError(event.message);
          session.setInterim('');
          session.setInputLevel(0);
          const engine = engineRef.current;
          engineRef.current = null;
          void engine?.stop().catch(() => undefined);
          toast('Caption engine stopped', event.message, 'error');
        } else {
          const now = Date.now();
          if (now - lastNonFatalToastRef.current > 12_000) {
            lastNonFatalToastRef.current = now;
            toast('Speech engine warning', event.message, 'info');
          }
        }
        break;
      }

      case 'info':
        break;

      default:
        break;
    }
  }, []);

  const start = useCallback(async () => {
    if (startingRef.current) return;

    const preferences = usePreferencesStore.getState().preferences;
    startingRef.current = true;
    generationRef.current += 1;
    const generation = generationRef.current;

    const previous = engineRef.current;
    engineRef.current = null;
    if (previous) {
      await previous.stop().catch(() => undefined);
    }
    if (generation !== generationRef.current) {
      startingRef.current = false;
      return;
    }

    const engine = createEngine(preferences.engine);
    engineRef.current = engine;
    lastConfigRef.current = {
      engine: preferences.engine,
      sourceLang: preferences.sourceLang,
    };

    const session = useSessionStore.getState();
    session.setError(null);
    session.setTranslationNotice(null);
    session.setStatus('starting', 'Requesting microphone access…');
    session.setInputLevel(0);

    try {
      await engine.start({
        language: preferences.sourceLang,
        onEvent: (event) => handleEvent(event, generation),
        onLevel: (level) => useSessionStore.getState().setInputLevel(level),
      });

      if (generation === generationRef.current) {
        const current = useSessionStore.getState();
        if (current.status === 'starting') {
          current.startSession(engine.id, 'Listening');
        }
      }
    } catch (error) {
      const message = errorMessage(error);
      // stop() emits an `idle` status; apply the error afterwards so the UI
      // does not flip back to "Ready" while the error panel is visible.
      await engine.stop().catch(() => undefined);
      if (engineRef.current === engine) engineRef.current = null;

      if (generation === generationRef.current) {
        const current = useSessionStore.getState();
        current.setError(message);
        current.setStatus('error');
        current.setInputLevel(0);
        toast('Could not start captions', message, 'error');
      }
    } finally {
      startingRef.current = false;
    }
  }, [handleEvent]);

  const stop = useCallback(async () => {
    generationRef.current += 1;
    startingRef.current = false;

    const engine = engineRef.current;
    engineRef.current = null;

    const session = useSessionStore.getState();
    session.setInputLevel(0);
    if (engine) {
      session.setStatus('stopping');
      await engine.stop().catch(() => undefined);
    }
    useSessionStore.getState().stopSession();
  }, []);

  const restart = useCallback(async () => {
    await stop();
    await start();
  }, [start, stop]);

  const toggle = useCallback(async () => {
    const current = useSessionStore.getState().status;
    if (current === 'listening' || current === 'starting' || current === 'stopping') {
      await stop();
    } else {
      await start();
    }
  }, [start, stop]);

  useEffect(() => {
    const isLive = status === 'listening' || status === 'starting' || status === 'stopping';
    if (!isLive) {
      lastConfigRef.current = {
        engine: enginePreference,
        sourceLang: sourceLangPreference,
      };
      return;
    }

    const configChanged =
      lastConfigRef.current.engine !== enginePreference ||
      lastConfigRef.current.sourceLang !== sourceLangPreference;

    if (configChanged) {
      lastConfigRef.current = {
        engine: enginePreference,
        sourceLang: sourceLangPreference,
      };
      void restart();
    }
  }, [enginePreference, sourceLangPreference, status, restart]);

  useEffect(() => {
    return () => {
      generationRef.current += 1;
      void engineRef.current?.stop().catch(() => undefined);
      engineRef.current = null;
    };
  }, []);

  const value = useMemo<TranscriptionContextValue>(
    () => ({
      start,
      stop,
      toggle,
      restart,
      isLive: status === 'listening' || status === 'starting' || status === 'stopping',
      status,
      activeEngine,
    }),
    [start, stop, toggle, restart, status, activeEngine],
  );

  return <TranscriptionContext.Provider value={value}>{children}</TranscriptionContext.Provider>;
}

export function useTranscription(): TranscriptionContextValue {
  const context = useContext(TranscriptionContext);
  if (!context) {
    throw new Error('useTranscription must be used inside <TranscriptionProvider>.');
  }
  return context;
}
