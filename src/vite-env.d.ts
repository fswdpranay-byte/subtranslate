/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_DEEPGRAM_API_KEY?: string;
  readonly VITE_DEEPGRAM_PROXY_URL?: string;
  readonly VITE_TRANSLATION_PROVIDER?: 'mymemory' | 'libretranslate';
  readonly VITE_LIBRETRANSLATE_URL?: string;
  readonly VITE_MYMEMORY_EMAIL?: string;
  readonly VITE_WHISPER_MODEL?: string;
  readonly VITE_WHISPER_CHUNK_SECONDS?: string;
  readonly VITE_PAID_MODE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
