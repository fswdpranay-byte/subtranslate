import { appConfig } from '@/config/appConfig';
import { isSecureRuntime } from '@/lib/utils';
import type { EngineDescriptor, EngineId } from '@/types';
import type { TranscriptionEngine } from './types';
import { WebSpeechEngine } from './webSpeechEngine';
import { DeepgramEngine } from './deepgramEngine';
import { WhisperEngine } from './whisperEngine';

export type { EngineEvent, EngineStartOptions, TranscriptionEngine } from './types';

export function createEngine(id: EngineId): TranscriptionEngine {
  switch (id) {
    case 'deepgram':
      return new DeepgramEngine();
    case 'whisper':
      return new WhisperEngine();
    case 'web-speech':
    default:
      return new WebSpeechEngine();
  }
}

const webSpeechProbe = new WebSpeechEngine();
const whisperProbe = new WhisperEngine();
const deepgramProbe = new DeepgramEngine();

function secureReason(): string | undefined {
  if (isSecureRuntime()) return undefined;
  return 'Requires HTTPS (or localhost) for microphone access.';
}

export function getEngineDescriptors(): EngineDescriptor[] {
  const secure = secureReason();
  return [
    {
      id: 'web-speech',
      name: 'Fast on-device captions',
      shortName: 'Browser speech',
      mode: 'on-device',
      badge: 'Fastest',
      description:
        'Uses the browser’s built-in SpeechRecognition. Instant partial results, zero setup. Chrome processes audio in its vendor cloud.',
      available: webSpeechProbe.isSupported() && !secure,
      reason: webSpeechProbe.isSupported()
        ? secure
        : 'Not available in this browser. Use Chrome/Edge or switch to Whisper.',
    },
    {
      id: 'whisper',
      name: 'Private Whisper (WASM)',
      shortName: 'Whisper WASM',
      mode: 'on-device',
      badge: '100% offline',
      description:
        `Whisper ${appConfig.whisper.model.split('/').pop()} runs locally in a Web Worker. ~${appConfig.whisper.chunkSeconds}s chunks, first run downloads the model once.`,
      available: whisperProbe.isSupported() && !secure,
      reason: whisperProbe.isSupported()
        ? secure
        : 'Needs WebAssembly, Web Workers and a microphone.',
    },
    {
      id: 'deepgram',
      name: 'Deepgram free credit',
      shortName: 'Deepgram',
      mode: 'trial',
      badge: '$200 trial',
      description:
        'Cloud streaming with low latency and strong accuracy. Uses your $200 Deepgram sign-up credit; needs an API key or proxy URL.',
      available: deepgramProbe.isSupported() && !secure,
      reason: !appConfig.deepgram.configured
        ? 'Add VITE_DEEPGRAM_API_KEY or VITE_DEEPGRAM_PROXY_URL to enable the trial.'
        : secure,
    },
  ];
}

export function defaultEngineId(): EngineId {
  const descriptors = getEngineDescriptors();
  const onDevice = descriptors.find((engine) => engine.id === 'web-speech' && engine.available);
  if (onDevice) return 'web-speech';
  const whisper = descriptors.find((engine) => engine.id === 'whisper' && engine.available);
  if (whisper) return 'whisper';
  const deepgram = descriptors.find((engine) => engine.id === 'deepgram' && engine.available);
  if (deepgram) return 'deepgram';
  return 'whisper';
}
