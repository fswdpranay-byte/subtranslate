/**
 * Microphone -> 16 kHz mono Int16 PCM.
 *
 * Why not MediaRecorder? Deepgram's raw linear16 mode and Whisper both want
 * fixed-rate PCM. Using the Web Audio graph also gives us a live input level
 * for the waveform UI and avoids container/header handling for streamed chunks.
 */

import { appConfig } from '@/config/appConfig';

export interface PcmCaptureOptions {
  /** Audio chunks delivered as 16 kHz mono signed 16-bit PCM. */
  onChunk: (samples: Int16Array) => void;
  /** Normalized 0..1 input level, roughly 10x per second. */
  onLevel?: (level: number) => void;
  targetSampleRate?: number;
}

export interface PcmCaptureHandle {
  stop: () => Promise<void>;
  stream: MediaStream;
  sampleRate: number;
}

type AudioContextConstructor = typeof AudioContext;

function getAudioContextConstructor(): AudioContextConstructor {
  const ctor =
    window.AudioContext ??
    (window as Window & { webkitAudioContext?: AudioContextConstructor }).webkitAudioContext;
  if (!ctor) {
    throw new Error('This browser does not support the Web Audio API.');
  }
  return ctor;
}

/** Average-decimate to the target rate, then clamp to Int16. */
export function downsampleToInt16(
  input: Float32Array,
  inputRate: number,
  targetRate: number,
): Int16Array {
  if (inputRate <= targetRate) {
    const output = new Int16Array(input.length);
    for (let i = 0; i < input.length; i += 1) {
      output[i] = clampToInt16(input[i] ?? 0);
    }
    return output;
  }

  const ratio = inputRate / targetRate;
  const outputLength = Math.floor(input.length / ratio);
  const output = new Int16Array(outputLength);

  for (let i = 0; i < outputLength; i += 1) {
    const start = Math.floor(i * ratio);
    const end = Math.min(input.length, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let j = start; j < end; j += 1) {
      sum += input[j] ?? 0;
    }
    const average = end > start ? sum / (end - start) : 0;
    output[i] = clampToInt16(average);
  }
  return output;
}

function clampToInt16(value: number): number {
  const clamped = Math.max(-1, Math.min(1, value));
  return clamped < 0 ? Math.round(clamped * 0x8000) : Math.round(clamped * 0x7fff);
}

export async function requestMicrophoneAccess(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Microphone capture is unavailable in this browser context.');
  }
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    });
  } catch (error) {
    const name = error instanceof DOMException ? error.name : '';
    if (name === 'NotAllowedError' || name === 'SecurityError') {
      throw new Error(
        'Microphone access is blocked for this site. Click the tune or lock icon in the address bar, set Microphone to Allow, then reload the page.',
      );
    }
    if (name === 'NotFoundError' || name === 'OverconstrainedError') {
      throw new Error('No working microphone was found on this device.');
    }
    if (name === 'NotReadableError' || name === 'AbortError') {
      throw new Error(
        'The microphone is busy or unavailable. Close other apps that may be using it, then try again.',
      );
    }
    throw error instanceof Error ? error : new Error('Could not open the microphone.');
  }
}

export async function startPcmCapture(options: PcmCaptureOptions): Promise<PcmCaptureHandle> {
  const targetSampleRate = options.targetSampleRate ?? appConfig.deepgram.sampleRate;
  const stream = await requestMicrophoneAccess();
  const AudioContextCtor = getAudioContextConstructor();
  const context = new AudioContextCtor();
  await context.resume().catch(() => undefined);

  const source = context.createMediaStreamSource(stream);
  const processor = context.createScriptProcessor(4096, 1, 1);
  // A zero-gain sink is required on some browsers for the processor to run.
  const sink = context.createGain();
  sink.gain.value = 0;

  processor.onaudioprocess = (event) => {
    const channel = event.inputBuffer.getChannelData(0);
    const downsampled = downsampleToInt16(channel, context.sampleRate, targetSampleRate);
    if (downsampled.length > 0) options.onChunk(downsampled);

    if (options.onLevel) {
      let sum = 0;
      for (let i = 0; i < channel.length; i += 1) {
        sum += (channel[i] ?? 0) ** 2;
      }
      const rms = Math.sqrt(sum / channel.length);
      options.onLevel(Math.min(1, rms * 5));
    }
  };

  source.connect(processor);
  processor.connect(sink);
  sink.connect(context.destination);

  let stopped = false;
  const stop = async () => {
    if (stopped) return;
    stopped = true;
    processor.onaudioprocess = null;
    try {
      source.disconnect();
      processor.disconnect();
      sink.disconnect();
    } catch {
      /* already disconnected */
    }
    stream.getTracks().forEach((track) => track.stop());
    await context.close().catch(() => undefined);
  };

  return { stop, stream, sampleRate: targetSampleRate };
}
