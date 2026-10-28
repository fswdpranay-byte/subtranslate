import { appConfig } from '@/config/appConfig';
import { baseLanguage, isSameLanguage, translationLanguage } from '@/config/languages';
import type { TranslationResult } from '@/types';

/**
 * Free translation layer.
 *
 * Priority:
 *   1. LibreTranslate (only if VITE_LIBRETRANSLATE_URL is configured — self-host for zero cost)
 *   2. MyMemory (no API key, anonymous free quota)
 *   3. Bundled offline phrasebook (demo + emergency fallback)
 *
 * Every successful result is cached in localStorage, which keeps repeat phrases
 * instant and stays well inside the anonymous MyMemory quota.
 */

const CACHE_LIMIT = 500;
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const REQUEST_TIMEOUT_MS = 8000;

interface CacheEntry {
  text: string;
  at: number;
}

const memoryCache = new Map<string, CacheEntry>();
let cacheLoaded = false;
let persistTimer: number | null = null;
let queue: Promise<unknown> = Promise.resolve();
let lastRequestAt = 0;

const OFFLINE_PHRASES: Record<string, Record<string, string>> = {
  hello: { es: 'hola', fr: 'bonjour', de: 'hallo', pt: 'olá', hi: 'नमस्ते', ja: 'こんにちは', ko: '안녕하세요', zh: '你好', ar: 'مرحبا' },
  'thank you': { es: 'gracias', fr: 'merci', de: 'danke', pt: 'obrigado', hi: 'धन्यवाद', ja: 'ありがとう', ko: '감사합니다', zh: '谢谢', ar: 'شكراً' },
  'thank you for watching': { es: 'gracias por ver', fr: 'merci d’avoir regardé', de: 'danke fürs Zuschauen', pt: 'obrigado por assistir', hi: 'देखने के लिए धन्यवाद' },
  'good morning': { es: 'buenos días', fr: 'bonjour', de: 'guten Morgen', pt: 'bom dia', hi: 'सुप्रभात' },
  'good evening': { es: 'buenas tardes', fr: 'bonsoir', de: 'guten Abend', pt: 'boa noite', hi: 'शुभ संध्या' },
  'how are you': { es: '¿cómo estás?', fr: 'comment allez-vous ?', de: 'wie geht es dir?', pt: 'como você está?', hi: 'आप कैसे हैं?' },
  'welcome to my channel': { es: 'bienvenido a mi canal', fr: 'bienvenue sur ma chaîne', de: 'willkommen auf meinem Kanal', pt: 'bem-vindo ao meu canal', hi: 'मेरे चैनल पर स्वागत है' },
  'please subscribe': { es: 'por favor suscríbete', fr: 'abonnez-vous', de: 'bitte abonnieren', pt: 'por favor inscreva-se', hi: 'कृपया सब्सक्राइब करें' },
  'see you next time': { es: 'hasta la próxima', fr: 'à la prochaine', de: 'bis zum nächsten Mal', pt: 'até a próxima', hi: 'फिर मिलेंगे' },
  "let's get started": { es: 'vamos a empezar', fr: 'commençons', de: 'fangen wir an', pt: 'vamos começar', hi: 'चलिए शुरू करते हैं' },
  'nice to meet you': { es: 'mucho gusto', fr: 'enchanté', de: 'freut mich', pt: 'prazer em conhecer você', hi: 'आपसे मिलकर खुशी हुई' },
  'what is your name': { es: '¿cómo te llamas?', fr: 'comment vous appelez-vous ?', de: 'wie heißt du?', pt: 'qual é o seu nome?', hi: 'आपका नाम क्या है?' },
  'my name is': { es: 'me llamo', fr: 'je m’appelle', de: 'ich heiße', pt: 'meu nome é', hi: 'मेरा नाम है' },
  goodbye: { es: 'adiós', fr: 'au revoir', de: 'auf Wiedersehen', pt: 'tchau', hi: 'अलविदा' },
  'i love you': { es: 'te quiero', fr: 'je t’aime', de: 'ich liebe dich', pt: 'eu te amo', hi: 'मैं तुमसे प्यार करता हूँ' },
};

function cacheKey(text: string, source: string, target: string): string {
  return `${source}|${target}|${text}`;
}

function ensureCacheLoaded(): void {
  if (cacheLoaded || typeof localStorage === 'undefined') return;
  cacheLoaded = true;
  try {
    const raw = localStorage.getItem(appConfig.storage.translations);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, CacheEntry>;
    const now = Date.now();
    Object.entries(parsed)
      .filter(([, entry]) => entry && typeof entry.text === 'string' && now - entry.at < CACHE_TTL_MS)
      .slice(-CACHE_LIMIT)
      .forEach(([key, entry]) => memoryCache.set(key, entry));
  } catch {
    // Corrupted cache: start clean.
    memoryCache.clear();
  }
}

function schedulePersist(): void {
  if (typeof window === 'undefined') return;
  if (persistTimer !== null) window.clearTimeout(persistTimer);
  persistTimer = window.setTimeout(() => {
    try {
      const entries = Array.from(memoryCache.entries()).slice(-CACHE_LIMIT);
      localStorage.setItem(appConfig.storage.translations, JSON.stringify(Object.fromEntries(entries)));
    } catch {
      // Storage full / private mode: caching is best-effort.
    }
  }, 600);
}

function getCached(key: string): string | undefined {
  ensureCacheLoaded();
  const entry = memoryCache.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.at > CACHE_TTL_MS) {
    memoryCache.delete(key);
    return undefined;
  }
  return entry.text;
}

function setCached(key: string, text: string): void {
  ensureCacheLoaded();
  memoryCache.set(key, { text, at: Date.now() });
  schedulePersist();
}

export function clearTranslationCache(): void {
  memoryCache.clear();
  cacheLoaded = true;
  try {
    localStorage.removeItem(appConfig.storage.translations);
  } catch {
    /* noop */
  }
}

function decodeEntities(value: string): string {
  if (!/[&<>]/.test(value)) return value;
  if (typeof document === 'undefined') {
    return value
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');
  }
  const element = document.createElement('textarea');
  element.innerHTML = value;
  return element.value;
}

function guessSourceLanguage(text: string): string {
  if (/[\u3040-\u30ff]/.test(text)) return 'ja';
  if (/[\uac00-\ud7af]/.test(text)) return 'ko';
  if (/[\u4e00-\u9fff]/.test(text)) return 'zh-CN';
  if (/[\u0900-\u097f]/.test(text)) return 'hi';
  if (/[\u0600-\u06ff]/.test(text)) return 'ar';
  if (/[\u0400-\u04ff]/.test(text)) return 'ru';
  if (/[\u0e00-\u0e7f]/.test(text)) return 'th';
  return 'en';
}

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function rateLimited<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const elapsed = Date.now() - lastRequestAt;
    const wait = appConfig.translation.minRequestGapMs - elapsed;
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    lastRequestAt = Date.now();
    return task();
  });
  queue = run.catch(() => undefined);
  return run;
}

async function translateWithLibre(
  text: string,
  source: string,
  target: string,
): Promise<string> {
  if (!appConfig.translation.libreTranslateUrl) {
    throw new Error('LibreTranslate is not configured.');
  }
  const endpoint = appConfig.translation.libreTranslateUrl.replace(/\/$/, '');
  const response = await fetchWithTimeout(`${endpoint}/translate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      q: text,
      source: source === 'auto' ? 'auto' : translationLanguage(source),
      target: translationLanguage(target),
      format: 'text',
    }),
  });
  if (!response.ok) throw new Error(`LibreTranslate HTTP ${response.status}`);
  const data = (await response.json()) as { translatedText?: string };
  if (!data.translatedText) throw new Error('LibreTranslate returned an empty response.');
  return data.translatedText;
}

async function translateWithMyMemory(
  text: string,
  source: string,
  target: string,
): Promise<string> {
  const sourceCode = source === 'auto' ? guessSourceLanguage(text) : translationLanguage(source);
  const targetCode = translationLanguage(target);
  if (sourceCode === targetCode) return text;

  const params = new URLSearchParams({
    q: text,
    langpair: `${sourceCode}|${targetCode}`,
  });
  if (appConfig.translation.myMemoryEmail) {
    params.set('de', appConfig.translation.myMemoryEmail);
  }

  const response = await fetchWithTimeout(
    `https://api.mymemory.translated.net/get?${params.toString()}`,
  );
  if (!response.ok) throw new Error(`MyMemory HTTP ${response.status}`);
  const data = (await response.json()) as {
    responseData?: { translatedText?: string };
    responseStatus?: number | string;
  };
  const translated = data.responseData?.translatedText?.trim();
  if (!translated) throw new Error('MyMemory returned an empty response.');
  if (
    /MYMEMORY WARNING|PLEASE SELECT TWO DISTINCT|INVALID LANGUAGE|QUERY LENGTH LIMIT|NO TRANSLATION/i.test(
      translated,
    )
  ) {
    throw new Error(translated);
  }
  return decodeEntities(translated);
}

function translateOffline(text: string, target: string): string | null {
  const normalized = text
    .toLowerCase()
    .replace(/[\s.!?,;:]+$/g, '')
    .trim();
  const dictionary = OFFLINE_PHRASES[normalized];
  if (!dictionary) return null;
  return (
    dictionary[baseLanguage(target)] ??
    dictionary[translationLanguage(target)] ??
    null
  );
}

function splitForTranslation(text: string): string[] {
  const max = appConfig.translation.maxChunkChars;
  if (text.length <= max) return [text];

  const sentences = text.match(/[^.!?。！？]+[.!?。！？]?/g) ?? [text];
  const chunks: string[] = [];
  let current = '';

  const pushCurrent = () => {
    if (current.trim()) chunks.push(current.trim());
    current = '';
  };

  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (!trimmed) continue;

    if (trimmed.length > max) {
      pushCurrent();
      const words = trimmed.split(/\s+/);
      let longChunk = '';
      for (const word of words) {
        if ((longChunk + ' ' + word).trim().length > max) {
          if (longChunk.trim()) chunks.push(longChunk.trim());
          longChunk = word;
        } else {
          longChunk = longChunk ? `${longChunk} ${word}` : word;
        }
      }
      if (longChunk.trim()) chunks.push(longChunk.trim());
      continue;
    }

    if ((current + ' ' + trimmed).trim().length > max) {
      pushCurrent();
      current = trimmed;
    } else {
      current = current ? `${current} ${trimmed}` : trimmed;
    }
  }
  pushCurrent();
  return chunks.length > 0 ? chunks : [text];
}

interface ChunkOutcome {
  text: string;
  provider: string;
  ok: boolean;
  cached: boolean;
}

async function translateChunk(
  chunk: string,
  source: string,
  target: string,
): Promise<ChunkOutcome> {
  const key = cacheKey(chunk, source, target);
  const cached = getCached(key);
  if (cached) return { text: cached, provider: 'cache', ok: true, cached: true };

  const providers: Array<{ name: string; run: () => Promise<string> }> = [];

  if (
    appConfig.translation.provider === 'libretranslate' &&
    appConfig.translation.libreTranslateUrl
  ) {
    providers.push({
      name: 'libretranslate',
      run: () => translateWithLibre(chunk, source, target),
    });
  }

  providers.push({
    name: 'mymemory',
    run: () => translateWithMyMemory(chunk, source, target),
  });

  for (const provider of providers) {
    try {
      const text = await rateLimited(provider.run);
      if (!text.trim()) throw new Error('Empty translation');
      setCached(key, text);
      return { text, provider: provider.name, ok: true, cached: false };
    } catch (error) {
      console.warn(`[SubTranslate] ${provider.name} translation failed`, error);
    }
  }

  const offline = translateOffline(chunk, target);
  if (offline) {
    setCached(key, offline);
    return { text: offline, provider: 'offline-phrasebook', ok: true, cached: false };
  }

  return { text: chunk, provider: 'unavailable', ok: false, cached: false };
}

export async function translateText(
  text: string,
  source: string,
  target: string,
): Promise<TranslationResult> {
  const normalized = text.trim();
  if (!normalized) {
    return { text: '', provider: 'none', ok: true, cached: false };
  }
  if (target === 'none' || isSameLanguage(source, target)) {
    return { text: normalized, provider: 'none', ok: true, cached: false };
  }

  const chunks = splitForTranslation(normalized);
  const outcomes: ChunkOutcome[] = [];

  for (const chunk of chunks) {
    outcomes.push(await translateChunk(chunk, source, target));
  }

  const separator = /^(zh|ja|ko|th|lo|my|km)/.test(baseLanguage(target)) ? '' : ' ';
  const translated = outcomes
    .map((outcome) => outcome.text)
    .join(separator)
    .trim();

  return {
    text: translated || normalized,
    provider: outcomes.every((outcome) => outcome.cached)
      ? 'cache'
      : (outcomes.find((outcome) => !outcome.cached)?.provider ?? 'unknown'),
    ok: outcomes.every((outcome) => outcome.ok),
    cached: outcomes.every((outcome) => outcome.cached),
  };
}
