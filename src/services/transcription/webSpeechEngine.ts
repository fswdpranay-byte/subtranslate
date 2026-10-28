import type { SpeechRecognitionInstance, SpeechRecognitionErrorEvent } from '@/types/speech';
import type { EngineStartOptions, TranscriptionEngine } from './types';

const FATAL_ERRORS = new Set(['not-allowed', 'service-not-allowed', 'audio-capture']);

function explainError(code: string): string {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Microphone access is blocked for this site. Click the tune or lock icon in the address bar, set Microphone to Allow, then reload the page.';
    case 'audio-capture':
      return 'No working microphone was found. Check that another app is not holding the microphone.';
    case 'network':
      return 'Chrome’s Web Speech engine needs a network connection. Switch to the Whisper engine for fully offline captions.';
    case 'language-not-supported':
      return 'This language is not supported by the browser’s speech engine. Pick another source language or use Whisper.';
    default:
      return `Speech recognition error: ${code}.`;
  }
}

/**
 * A persisted browser block never re-prompts on the same page. Detect it before
 * spawning so the UI can offer "reload" instead of a retry that cannot work.
 */
async function assertMicrophoneAllowed(): Promise<void> {
  let state: PermissionState | null = null;
  try {
    const status = await navigator.permissions.query({ name: 'microphone' as PermissionName });
    state = status.state;
  } catch {
    // Permissions API does not expose "microphone" in every browser; let the
    // SpeechRecognition constructor handle the prompt in that case.
    state = null;
  }
  if (state === 'denied') {
    throw new Error(
      'Microphone access is blocked for this site. Click the tune or lock icon in the address bar, set Microphone to Allow, then reload the page.',
    );
  }
}

/**
 * Browser-native streaming speech recognition.
 * Free, low latency, but Chrome/Safari send audio to their vendor cloud.
 */
export class WebSpeechEngine implements TranscriptionEngine {
  readonly id = 'web-speech' as const;
  readonly mode = 'on-device' as const;
  readonly label = 'Web Speech (browser)';

  private recognition: SpeechRecognitionInstance | null = null;
  private options: EngineStartOptions | null = null;
  private active = false;
  private restartTimer: number | null = null;
  private restartAttempts = 0;
  private lastFinalText = '';
  private lastFinalAt = 0;

  isSupported(): boolean {
    return (
      typeof window !== 'undefined' &&
      Boolean(window.SpeechRecognition ?? window.webkitSpeechRecognition)
    );
  }

  async start(options: EngineStartOptions): Promise<void> {
    if (!this.isSupported()) {
      throw new Error(
        'The Web Speech API is not available here. Use Chrome/Edge, or switch to the on-device Whisper engine.',
      );
    }
    this.options = options;
    this.restartAttempts = 0;
    await assertMicrophoneAllowed();
    this.active = true;
    this.spawn();
  }

  private spawn(): void {
    if (!this.active || !this.options) return;
    const Constructor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Constructor) return;

    const recognition = new Constructor();
    recognition.lang = this.options.language === 'auto' ? navigator.language || 'en-US' : this.options.language;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      this.restartAttempts = 0;
      this.options?.onEvent({ type: 'status', status: 'listening' });
    };

    recognition.onresult = (event) => {
      let interim = '';
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const alternative = result?.[0];
        if (!result || !alternative) continue;

        const text = alternative.transcript.trim();
        if (!text) continue;

        if (result.isFinal) {
          this.emitFinal(text, alternative.confidence);
        } else {
          interim += ` ${text}`;
        }
      }
      this.options?.onEvent({ type: 'partial', text: interim.trim() });
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      const code = event.error;
      if (code === 'no-speech' || code === 'aborted') return;

      const message = explainError(code);
      if (FATAL_ERRORS.has(code)) {
        this.active = false;
        this.options?.onEvent({ type: 'error', message, fatal: true });
        this.options?.onEvent({ type: 'status', status: 'error' });
        return;
      }

      // Non-fatal: let onend schedule a restart. Chrome fires network errors
      // after silence even when the connection is healthy.
      this.options?.onEvent({ type: 'error', message, fatal: false });
    };

    recognition.onend = () => {
      this.recognition = null;
      if (this.active) this.scheduleRestart();
    };

    try {
      recognition.start();
      this.recognition = recognition;
    } catch {
      // InvalidStateError happens when a previous instance is still closing.
      this.scheduleRestart(650);
    }
  }

  private scheduleRestart(delay = 400): void {
    if (!this.active) return;
    if (this.restartAttempts > 10) {
      this.active = false;
      this.options?.onEvent({
        type: 'error',
        message: 'Speech recognition stopped repeatedly. Tap start to retry.',
        fatal: true,
      });
      this.options?.onEvent({ type: 'status', status: 'error' });
      return;
    }
    this.restartAttempts += 1;
    this.clearRestartTimer();
    this.restartTimer = window.setTimeout(() => this.spawn(), delay);
  }

  private emitFinal(text: string, confidence?: number): void {
    const now = Date.now();
    if (
      text.toLowerCase() === this.lastFinalText.toLowerCase() &&
      now - this.lastFinalAt < 2000
    ) {
      return;
    }
    this.lastFinalText = text;
    this.lastFinalAt = now;
    this.options?.onEvent({ type: 'final', text, confidence });
  }

  private clearRestartTimer(): void {
    if (this.restartTimer !== null) {
      window.clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
  }

  async stop(): Promise<void> {
    this.active = false;
    this.clearRestartTimer();
    const recognition = this.recognition;
    this.recognition = null;

    if (recognition) {
      recognition.onend = null;
      recognition.onresult = null;
      recognition.onerror = null;
      try {
        recognition.stop();
      } catch {
        try {
          recognition.abort();
        } catch {
          /* noop */
        }
      }
    }

    this.options?.onEvent({ type: 'partial', text: '' });
    this.options?.onEvent({ type: 'status', status: 'idle' });
  }
}
