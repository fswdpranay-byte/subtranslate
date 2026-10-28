import { appConfig } from '@/config/appConfig';
import { deepgramLanguage } from '@/config/languages';
import { startPcmCapture, type PcmCaptureHandle } from '@/services/audio/pcmCapture';
import type { EngineStartOptions, TranscriptionEngine } from './types';

interface DeepgramResultMessage {
  type: string;
  is_final?: boolean;
  speech_final?: boolean;
  channel?: {
    alternatives?: Array<{ transcript?: string; confidence?: number }>;
  };
  description?: string;
  message?: string;
}

/**
 * Deepgram streaming fallback.
 *
 * Uses raw 16 kHz linear16 PCM over a browser WebSocket. The API key is passed
 * as a query param because browsers cannot set an Authorization header on a
 * WebSocket. For production, point `VITE_DEEPGRAM_PROXY_URL` at a Supabase Edge
 * Function so the key never reaches the client.
 */
export class DeepgramEngine implements TranscriptionEngine {
  readonly id = 'deepgram' as const;
  readonly mode = 'trial' as const;
  readonly label = 'Deepgram Nova-2';

  private socket: WebSocket | null = null;
  private capture: PcmCaptureHandle | null = null;
  private options: EngineStartOptions | null = null;
  private active = false;
  private keepAliveTimer: number | null = null;
  private lastFinalText = '';
  private lastFinalAt = 0;

  isSupported(): boolean {
    return (
      typeof WebSocket !== 'undefined' &&
      Boolean(navigator.mediaDevices?.getUserMedia) &&
      appConfig.deepgram.configured
    );
  }

  async start(options: EngineStartOptions): Promise<void> {
    if (!appConfig.deepgram.configured) {
      throw new Error(
        'Deepgram is not configured. Add VITE_DEEPGRAM_API_KEY (free sign-up credit) or VITE_DEEPGRAM_PROXY_URL to .env.local.',
      );
    }

    this.options = options;
    this.active = true;

    const params = new URLSearchParams({
      model: appConfig.deepgram.model,
      smart_format: 'true',
      punctuate: 'true',
      interim_results: 'true',
      utterance_end_ms: '1000',
      vad_events: 'true',
      encoding: 'linear16',
      sample_rate: String(appConfig.deepgram.sampleRate),
      channels: '1',
    });

    if (options.language === 'auto') {
      params.set('detect_language', 'true');
    } else {
      const language = deepgramLanguage(options.language);
      if (language) params.set('language', language);
    }

    let url: string;
    if (appConfig.deepgram.proxyUrl) {
      const separator = appConfig.deepgram.proxyUrl.includes('?') ? '&' : '?';
      url = `${appConfig.deepgram.proxyUrl}${separator}${params.toString()}`;
    } else {
      params.set('token', appConfig.deepgram.apiKey!);
      url = `${appConfig.deepgram.endpoint}?${params.toString()}`;
    }

    await this.openSocket(url);
    if (!this.active) return;

    this.capture = await startPcmCapture({
      targetSampleRate: appConfig.deepgram.sampleRate,
      onChunk: (samples) => {
        if (this.socket?.readyState === WebSocket.OPEN) {
          this.socket.send(samples.buffer);
        }
      },
      onLevel: options.onLevel,
    });

    this.keepAliveTimer = window.setInterval(() => {
      if (this.socket?.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify({ type: 'KeepAlive' }));
      }
    }, appConfig.deepgram.keepAliveMs);

    options.onEvent({ type: 'status', status: 'listening' });
  }

  private openSocket(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(url);
      socket.binaryType = 'arraybuffer';
      let settled = false;

      const timeout = window.setTimeout(() => {
        if (settled) return;
        settled = true;
        socket.close();
        reject(new Error('Timed out connecting to Deepgram. Check your network and API key.'));
      }, 12000);

      const settle = (error?: Error) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        if (error) reject(error);
        else resolve();
      };

      socket.onopen = () => {
        this.socket = socket;
        settle();
      };

      socket.onerror = () => {
        settle(
          new Error(
            'Could not open the Deepgram stream. Verify the API key, free-credit balance and network.',
          ),
        );
      };

      socket.onmessage = (event) => this.handleMessage(event);

      socket.onclose = (event) => {
        if (this.keepAliveTimer !== null) {
          window.clearInterval(this.keepAliveTimer);
          this.keepAliveTimer = null;
        }
        this.socket = null;

        if (!settled) {
          settle(new Error(`Deepgram closed the connection (${event.code}).`));
          return;
        }

        if (this.active) {
          this.active = false;
          void this.capture?.stop();
          this.capture = null;
          this.options?.onEvent({
            type: 'error',
            message: `Deepgram disconnected (${event.code}${event.reason ? `: ${event.reason}` : ''}). Tap start to reconnect.`,
            fatal: true,
          });
          this.options?.onEvent({ type: 'status', status: 'error' });
        }
      };
    });
  }

  private handleMessage(event: MessageEvent): void {
    if (typeof event.data !== 'string') return;

    let data: DeepgramResultMessage;
    try {
      data = JSON.parse(event.data) as DeepgramResultMessage;
    } catch {
      return;
    }

    if (data.type === 'Results') {
      const alternative = data.channel?.alternatives?.[0];
      const text = alternative?.transcript?.trim() ?? '';
      if (!text) return;

      if (data.is_final) {
        const now = Date.now();
        const duplicate =
          text.toLowerCase() === this.lastFinalText.toLowerCase() && now - this.lastFinalAt < 2000;
        if (!duplicate) {
          this.lastFinalText = text;
          this.lastFinalAt = now;
          this.options?.onEvent({ type: 'final', text, confidence: alternative?.confidence });
        }
        this.options?.onEvent({ type: 'partial', text: '' });
      } else {
        this.options?.onEvent({ type: 'partial', text });
      }
      return;
    }

    if (data.type === 'Error') {
      this.options?.onEvent({
        type: 'error',
        message: data.description ?? data.message ?? 'Deepgram reported an error.',
        fatal: false,
      });
      return;
    }

    if (data.type === 'Metadata') {
      this.options?.onEvent({ type: 'info', message: 'Deepgram stream connected.' });
    }
  }

  async stop(): Promise<void> {
    this.active = false;

    if (this.keepAliveTimer !== null) {
      window.clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = null;
    }

    const socket = this.socket;
    this.socket = null;
    if (socket) {
      if (socket.readyState === WebSocket.OPEN) {
        try {
          socket.send(JSON.stringify({ type: 'CloseStream' }));
        } catch {
          /* noop */
        }
      }
      window.setTimeout(() => {
        try {
          socket.close(1000, 'client stopped');
        } catch {
          /* noop */
        }
      }, 250);
    }

    await this.capture?.stop();
    this.capture = null;
    this.options?.onEvent({ type: 'partial', text: '' });
    this.options?.onEvent({ type: 'status', status: 'idle' });
  }
}
