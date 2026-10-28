/**
 * Central runtime configuration.
 *
 * Design rule: every engine shipped here must be usable without a credit card.
 * `isPaidMode` stays false so the default path is 100% on-device / browser APIs.
 * The Deepgram trial is opt-in by adding a key (or proxy URL) to the env file.
 */

const env = import.meta.env;

/** Treat values like `your_free_supabase_url` or an empty string as "not set". */
const clean = (value?: string): string | undefined => {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  if (/^your[_-]/i.test(trimmed)) return undefined;
  if (/^<.*>$/.test(trimmed)) return undefined;
  return trimmed;
};

const supabaseUrl = clean(env.VITE_SUPABASE_URL);
const supabaseAnonKey = clean(env.VITE_SUPABASE_ANON_KEY);
const deepgramApiKey = clean(env.VITE_DEEPGRAM_API_KEY);
const deepgramProxyUrl = clean(env.VITE_DEEPGRAM_PROXY_URL);
const libreTranslateUrl = clean(env.VITE_LIBRETRANSLATE_URL);

export const appConfig = {
  appName: 'SubTranslate',
  version: '0.1.0',
  tagline: 'Live subtitles for every app. On your device.',

  /**
   * Master switch for paid infrastructure. Keep this false: the app never
   * requires a paid API. Set only if you later add premium providers.
   */
  isPaidMode: env.VITE_PAID_MODE === 'true',

  supabase: {
    url: supabaseUrl,
    anonKey: supabaseAnonKey,
    configured: Boolean(supabaseUrl && supabaseAnonKey),
  },

  deepgram: {
    apiKey: deepgramApiKey,
    proxyUrl: deepgramProxyUrl,
    configured: Boolean(deepgramApiKey || deepgramProxyUrl),
    endpoint: 'wss://api.deepgram.com/v1/listen',
    model: 'nova-2',
    sampleRate: 16000,
    keepAliveMs: 8000,
  },

  whisper: {
    /** transformers.js runs Whisper through ONNX Runtime WebAssembly (no server). */
    cdnUrl: 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2',
    model: clean(env.VITE_WHISPER_MODEL) ?? 'Xenova/whisper-tiny',
    chunkSeconds: Math.min(
      15,
      Math.max(2, Number.parseInt(env.VITE_WHISPER_CHUNK_SECONDS ?? '5', 10) || 5),
    ),
    sampleRate: 16000,
  },

  translation: {
    provider: env.VITE_TRANSLATION_PROVIDER ?? 'mymemory',
    myMemoryEmail: clean(env.VITE_MYMEMORY_EMAIL),
    libreTranslateUrl,
    /** Max characters per HTTP request; both free APIs enforce short payloads. */
    maxChunkChars: 450,
    minRequestGapMs: 260,
  },

  overlay: {
    /** Keep in sync with capacitor.config.json. */
    androidAppId: 'com.subtranslate.app',
    defaultWidthPercent: 92,
    maxSegments: 3,
  },

  storage: {
    preferences: 'subtranslate:preferences:v1',
    translations: 'subtranslate:translation-cache:v1',
    onboarding: 'subtranslate:onboarding:v1',
    installDismissed: 'subtranslate:install-dismissed:v1',
  },
} as const;

export const isSupabaseConfigured = appConfig.supabase.configured;
export const isDeepgramConfigured = appConfig.deepgram.configured;
export const isDev = env.DEV;
