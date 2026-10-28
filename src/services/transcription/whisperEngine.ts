import { appConfig } from '@/config/appConfig';
import { baseLanguage } from '@/config/languages';
import { startPcmCapture, type PcmCaptureHandle } from '@/services/audio/pcmCapture';
import type { EngineStartOptions, TranscriptionEngine } from './types';

interface WhisperWorkerMessage {
  type: 'ready' | 'progress' | 'result' | 'error';
  id?: number;
  text?: string;
  message?: string;
  progress?: number;
  file?: string;
  status?: string;
}

/**
 * Fully local Whisper inference.
 *
 * Audio never leaves the phone: PCM is posted to a module worker, which loads
 * transformers.js + Whisper ONNX weights from the CDN (cached by the service
 * worker after the first run). On Android, Capacitor's WebView runs the same
 * WASM backend, so the exact same engine works in the Play Store build.
 */
export class WhisperEngine implements TranscriptionEngine {
  readonly id = 'whisper' as const;
  readonly mode = 'on-device' as const;
  readonly label = 'Whisper WASM (on-device)';

  private worker: Worker | null = null;
  private capture: PcmCaptureHandle | null = null;
  private options: EngineStartOptions | null = null;
  private active = false;
  private ready = false;
  private readyResolve: (() => void) | null = null;
  private readyReject: ((error: Error) => void) | null = null;
  private buffered: Float32Array[] = [];
  private bufferedSamples = 0;
  private inFlight = false;
  private queuedChunk: Float32Array | null = null;
  private sequence = 0;
  private lastProgressBucket = -1;
  private terminateTimer: number | null = null;

  isSupported(): boolean {
    return (
      typeof Worker !== 'undefined' &&
      typeof WebAssembly !== 'undefined' &&
      Boolean(navigator.mediaDevices?.getUserMedia)
    );
  }

  async start(options: EngineStartOptions): Promise<void> {
    if (!this.isSupported()) {
      throw new Error('Whisper needs WebAssembly, Web Workers and microphone access.');
    }

    this.options = options;
    this.active = true;
    this.ready = false;

    const worker = new Worker(new URL('./whisper.worker.ts', import.meta.url), {
      type: 'module',
      name: 'subtranslate-whisper',
    });
    this.worker = worker;
    worker.onmessage = (event: MessageEvent<WhisperWorkerMessage>) =>
      this.handleWorkerMessage(event.data);
    worker.onerror = (event) => {
      const message = event.message || 'The Whisper worker crashed.';
      if (!this.ready) this.readyReject?.(new Error(message));
      this.options?.onEvent({ type: 'error', message, fatal: true });
      this.options?.onEvent({ type: 'status', status: 'error' });
    };

    options.onEvent({
      type: 'status',
      status: 'starting',
      detail: `Loading ${appConfig.whisper.model} (cached after the first run)…`,
    });

    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        reject(
          new Error(
            'Whisper took too long to load. Check your connection for the first download, or use a smaller model (VITE_WHISPER_MODEL).',
          ),
        );
      }, 180_000);

      this.readyResolve = () => {
        window.clearTimeout(timeout);
        resolve();
      };
      this.readyReject = (error) => {
        window.clearTimeout(timeout);
        reject(error);
      };

      worker.postMessage({ type: 'init', model: appConfig.whisper.model });
    });

    if (!this.active) {
      this.terminate();
      return;
    }

    this.ready = true;
    this.capture = await startPcmCapture({
      targetSampleRate: appConfig.whisper.sampleRate,
      onChunk: (samples) => this.ingest(samples),
      onLevel: options.onLevel,
    });

    options.onEvent({ type: 'status', status: 'listening' });
  }

  private handleWorkerMessage(message: WhisperWorkerMessage): void {
    if (!message) return;

    if (message.type === 'progress') {
      const percent = Math.round((message.progress ?? 0) * 100);
      const bucket = Math.floor(percent / 10);
      if (bucket !== this.lastProgressBucket) {
        this.lastProgressBucket = bucket;
        this.options?.onEvent({
          type: 'status',
          status: 'starting',
          detail: `Downloading ${message.file ?? 'model'} · ${percent}%`,
        });
      }
      return;
    }

    if (message.type === 'ready') {
      this.options?.onEvent({ type: 'status', status: 'starting', detail: 'Warming up Whisper…' });
      this.readyResolve?.();
      this.readyResolve = null;
      this.readyReject = null;
      return;
    }

    if (message.type === 'result') {
      this.inFlight = false;
      const text = (message.text ?? '').trim();
      if (text && !/^\[(blank_audio|silence|music)\]/i.test(text)) {
        this.options?.onEvent({ type: 'final', text });
      }
      this.flushQueued();
      return;
    }

    if (message.type === 'error') {
      const error = new Error(message.message ?? 'Whisper inference failed.');
      if (!this.ready) {
        this.readyReject?.(error);
      } else {
        this.options?.onEvent({ type: 'error', message: error.message, fatal: false });
      }
      this.inFlight = false;
      this.flushQueued();
    }
  }

  private ingest(samples: Int16Array): void {
    if (!this.active) return;

    const floats = new Float32Array(samples.length);
    for (let i = 0; i < samples.length; i += 1) {
      floats[i] = (samples[i] ?? 0) / 32768;
    }
    this.buffered.push(floats);
    this.bufferedSamples += floats.length;

    const chunkSamples = appConfig.whisper.chunkSeconds * appConfig.whisper.sampleRate;
    if (this.bufferedSamples >= chunkSamples) {
      this.flushChunk(false);
    }
  }

  private flushChunk(final: boolean): void {
    if (!this.worker || !this.options) return;
    if (this.bufferedSamples === 0) return;

    // Avoid sending tiny tails (<0.4s) mid-stream; on stop they are still useful.
    const minSamples = final ? appConfig.whisper.sampleRate * 0.4 : 1;
    if (this.bufferedSamples < minSamples) return;

    const merged = new Float32Array(this.bufferedSamples);
    let offset = 0;
    for (const part of this.buffered) {
      merged.set(part, offset);
      offset += part.length;
    }
    this.buffered = [];
    this.bufferedSamples = 0;

    if (this.inFlight) {
      // Keep only the freshest audio; stale queues cause laggy "live" captions.
      this.queuedChunk = merged;
      return;
    }

    this.sendChunk(merged);
  }

  private sendChunk(audio: Float32Array): void {
    if (!this.worker || !this.options) return;
    this.inFlight = true;
    this.sequence += 1;
    this.worker.postMessage(
      {
        type: 'transcribe',
        id: this.sequence,
        audio,
        language:
          this.options.language === 'auto' ? null : baseLanguage(this.options.language),
      },
      [audio.buffer],
    );
  }

  private flushQueued(): void {
    if (this.queuedChunk && this.worker) {
      const next = this.queuedChunk;
      this.queuedChunk = null;
      this.sendChunk(next);
    }
  }

  async stop(): Promise<void> {
    this.active = false;

    if (this.capture) {
      await this.capture.stop();
      this.capture = null;
    }

    if (this.inFlight || this.bufferedSamples > 0) {
      this.flushChunk(true);
      // Give the last inference a moment to return before terminating.
      this.terminateTimer = window.setTimeout(() => this.terminate(), 8000);
    } else {
      this.terminate();
    }

    this.options?.onEvent({ type: 'partial', text: '' });
    this.options?.onEvent({ type: 'status', status: 'idle' });
  }

  private terminate(): void {
    if (this.terminateTimer !== null) {
      window.clearTimeout(this.terminateTimer);
      this.terminateTimer = null;
    }
    this.worker?.terminate();
    this.worker = null;
    this.ready = false;
    this.inFlight = false;
    this.queuedChunk = null;
    this.buffered = [];
    this.bufferedSamples = 0;
  }
}
