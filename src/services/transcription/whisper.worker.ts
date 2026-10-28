/**
 * Whisper inference worker.
 *
 * transformers.js is loaded from jsDelivr with a variable specifier so Vite does
 * not try to bundle ~50 MB of ONNX runtime into the app shell. The service
 * worker caches both the runtime and the model weights, so subsequent runs are
 * offline. To ship a fully self-contained bundle instead, install
 * `@xenova/transformers` and replace the dynamic import with a static one.
 */

const TRANSFORMERS_CDN = 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let transcriber: any = null;
let loadingModel: string | null = null;

interface InitMessage {
  type: 'init';
  model: string;
}

interface TranscribeMessage {
  type: 'transcribe';
  id: number;
  audio: Float32Array;
  language: string | null;
}

type IncomingMessage = InitMessage | TranscribeMessage;

function post(message: unknown): void {
  (self as unknown as Worker).postMessage(message);
}

async function loadPipeline(model: string): Promise<void> {
  if (transcriber) return;
  if (loadingModel === model) return;
  loadingModel = model;

  const module = await import(/* @vite-ignore */ TRANSFORMERS_CDN);
  const { pipeline, env } = module;

  // Never look for models on the local origin: weights come from the HF hub and
  // are then served from the browser Cache API by the service worker.
  env.allowLocalModels = false;
  env.useBrowserCache = true;

  transcriber = await pipeline('automatic-speech-recognition', model, {
    quantized: true,
    progress_callback: (progress: {
      status?: string;
      progress?: number;
      file?: string;
      name?: string;
    }) => {
      if (progress.status === 'progress' || progress.status === 'download') {
        post({
          type: 'progress',
          progress: typeof progress.progress === 'number' ? progress.progress / 100 : 0,
          file: progress.file ?? progress.name ?? 'model',
        });
      }
    },
  });

  loadingModel = null;
}

self.onmessage = async (event: MessageEvent<IncomingMessage>) => {
  const message = event.data;
  if (!message) return;

  if (message.type === 'init') {
    try {
      await loadPipeline(message.model);
      post({ type: 'ready' });
    } catch (error) {
      post({
        type: 'error',
        message:
          error instanceof Error
            ? `Could not load Whisper: ${error.message}`
            : 'Could not load Whisper.',
      });
    }
    return;
  }

  if (message.type === 'transcribe') {
    if (!transcriber) {
      post({ type: 'error', id: message.id, message: 'Whisper is not initialised.' });
      return;
    }
    try {
      const output = await transcriber(message.audio, {
        task: 'transcribe',
        language: message.language ?? undefined,
        chunk_length_s: 30,
        stride_length_s: 5,
        return_timestamps: false,
      });
      const text =
        typeof output === 'string'
          ? output
          : Array.isArray(output)
            ? output.map((part: { text?: string }) => part.text ?? '').join(' ')
            : (output?.text ?? '');
      post({ type: 'result', id: message.id, text });
    } catch (error) {
      post({
        type: 'error',
        id: message.id,
        message:
          error instanceof Error ? `Whisper inference failed: ${error.message}` : 'Whisper inference failed.',
      });
    }
  }
};

export {};
