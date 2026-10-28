import { useEffect, useRef, useState } from 'react';
import { usePreferencesStore } from '@/store/usePreferencesStore';
import { useSessionStore } from '@/store/useSessionStore';
import { useTranscription } from '@/features/transcription/TranscriptionProvider';
import { isSameLanguage } from '@/config/languages';
import { translateText } from '@/services/translation';
import { toast } from '@/store/useUiStore';
import { uid } from '@/lib/utils';

const DEMO_SCRIPT = [
  'Welcome back to the stream, everyone.',
  'Today we are testing live subtitles in real time.',
  'This overlay floats above Instagram, TikTok and YouTube.',
  'Whisper transcribes everything locally on your device.',
  'Your audio never leaves your phone.',
  'Tap the microphone to try it with your own voice.',
];

/**
 * Scripted captions for the simulator so the overlay can be evaluated without
 * granting microphone access or playing a video.
 */
export function useDemoCaptions() {
  const [running, setRunning] = useState(false);
  const timers = useRef<number[]>([]);
  const runId = useRef(0);
  const { isLive } = useTranscription();

  const clearTimers = () => {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    timers.current = [];
  };

  const stop = () => {
    runId.current += 1;
    clearTimers();
    setRunning(false);
  };

  const start = () => {
    if (isLive) {
      toast('Live captions are already running', 'Stop the microphone first to play the demo.', 'info');
      return;
    }

    clearTimers();
    runId.current += 1;
    const run = runId.current;
    const preferences = usePreferencesStore.getState().preferences;

    useSessionStore.getState().clearSession();
    setRunning(true);

    const needsTranslation =
      preferences.autoTranslate &&
      preferences.targetLang !== 'none' &&
      !isSameLanguage(preferences.sourceLang, preferences.targetLang);

    DEMO_SCRIPT.forEach((line, index) => {
      const timer = window.setTimeout(() => {
        if (run !== runId.current) return;

        const id = uid('demo');
        useSessionStore.getState().addSegment({
          id,
          original: line,
          isFinal: true,
          at: Date.now(),
          translationState: needsTranslation ? 'pending' : 'skipped',
        });

        if (needsTranslation) {
          void translateText(line, preferences.sourceLang === 'auto' ? 'en' : preferences.sourceLang, preferences.targetLang)
            .then((result) => {
              if (run !== runId.current) return;
              useSessionStore.getState().updateSegment(id, {
                translated: result.text,
                translationState: result.ok ? 'done' : 'error',
                translationProvider: result.provider,
              });
            })
            .catch(() => undefined);
        }

        if (index === DEMO_SCRIPT.length - 1) {
          window.setTimeout(() => {
            if (run !== runId.current) return;
            setRunning(false);
          }, 2200);
        }
      }, 700 + index * 2900);

      timers.current.push(timer);
    });
  };

  useEffect(() => {
    return () => {
      runId.current += 1;
      timers.current.forEach((timer) => window.clearTimeout(timer));
      timers.current = [];
    };
  }, []);

  return { running, start, stop };
}
