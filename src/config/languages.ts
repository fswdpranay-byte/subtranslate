/**
 * Languages supported by SubTranslate.
 *
 * `code` is a BCP-47 tag used by the Web Speech API and Whisper.
 * `target` languages can be any of these; source languages also accept "auto".
 */

export interface Language {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
  /** Deepgram uses a narrower set. `undefined` means "best effort / not listed". */
  deepgram?: string;
}

export const AUTO_LANGUAGE: Language = {
  code: 'auto',
  name: 'Auto-detect',
  nativeName: 'Automatic',
  flag: '✨',
};

export const NO_TRANSLATION = {
  code: 'none',
  name: 'No translation (transcript only)',
  nativeName: 'Transcript only',
  flag: '🚫',
} as const;

export const LANGUAGES: Language[] = [
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇺🇸', deepgram: 'en' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸', deepgram: 'es' },
  { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷', deepgram: 'fr' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪', deepgram: 'de' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', flag: '🇮🇹', deepgram: 'it' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', flag: '🇵🇹', deepgram: 'pt' },
  { code: 'pt-BR', name: 'Portuguese (Brazil)', nativeName: 'Português (Brasil)', flag: '🇧🇷', deepgram: 'pt-BR' },
  { code: 'nl', name: 'Dutch', nativeName: 'Nederlands', flag: '🇳🇱', deepgram: 'nl' },
  { code: 'pl', name: 'Polish', nativeName: 'Polski', flag: '🇵🇱', deepgram: 'pl' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', flag: '🇷🇺', deepgram: 'ru' },
  { code: 'uk', name: 'Ukrainian', nativeName: 'Українська', flag: '🇺🇦', deepgram: 'uk' },
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe', flag: '🇹🇷', deepgram: 'tr' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦', deepgram: 'ar' },
  { code: 'he', name: 'Hebrew', nativeName: 'עברית', flag: '🇮🇱', deepgram: 'he' },
  { code: 'fa', name: 'Persian', nativeName: 'فارسی', flag: '🇮🇷', deepgram: 'fa' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', flag: '🇮🇳', deepgram: 'hi' },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা', flag: '🇧🇩', deepgram: 'bn' },
  { code: 'ur', name: 'Urdu', nativeName: 'اردو', flag: '🇵🇰', deepgram: 'ur' },
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்', flag: '🇮🇳', deepgram: 'ta' },
  { code: 'te', name: 'Telugu', nativeName: 'తెలుగు', flag: '🇮🇳', deepgram: 'te' },
  { code: 'mr', name: 'Marathi', nativeName: 'मराठी', flag: '🇮🇳', deepgram: 'mr' },
  { code: 'gu', name: 'Gujarati', nativeName: 'ગુજરાતી', flag: '🇮🇳', deepgram: 'gu' },
  { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ', flag: '🇮🇳', deepgram: 'kn' },
  { code: 'ml', name: 'Malayalam', nativeName: 'മലയാളം', flag: '🇮🇳', deepgram: 'ml' },
  { code: 'pa', name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ', flag: '🇮🇳', deepgram: 'pa' },
  { code: 'ne', name: 'Nepali', nativeName: 'नेपाली', flag: '🇳🇵', deepgram: 'ne' },
  { code: 'si', name: 'Sinhala', nativeName: 'සිංහල', flag: '🇱🇰', deepgram: 'si' },
  { code: 'th', name: 'Thai', nativeName: 'ไทย', flag: '🇹🇭', deepgram: 'th' },
  { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt', flag: '🇻🇳', deepgram: 'vi' },
  { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia', flag: '🇮🇩', deepgram: 'id' },
  { code: 'ms', name: 'Malay', nativeName: 'Bahasa Melayu', flag: '🇲🇾', deepgram: 'ms' },
  { code: 'fil', name: 'Filipino', nativeName: 'Filipino', flag: '🇵🇭', deepgram: 'tl' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵', deepgram: 'ja' },
  { code: 'ko', name: 'Korean', nativeName: '한국어', flag: '🇰🇷', deepgram: 'ko' },
  { code: 'zh', name: 'Chinese (Simplified)', nativeName: '中文（简体）', flag: '🇨🇳', deepgram: 'zh-CN' },
  { code: 'zh-TW', name: 'Chinese (Traditional)', nativeName: '中文（繁體）', flag: '🇹🇼', deepgram: 'zh-TW' },
  { code: 'sv', name: 'Swedish', nativeName: 'Svenska', flag: '🇸🇪', deepgram: 'sv' },
  { code: 'no', name: 'Norwegian', nativeName: 'Norsk', flag: '🇳🇴', deepgram: 'no' },
  { code: 'da', name: 'Danish', nativeName: 'Dansk', flag: '🇩🇰', deepgram: 'da' },
  { code: 'fi', name: 'Finnish', nativeName: 'Suomi', flag: '🇫🇮', deepgram: 'fi' },
  { code: 'is', name: 'Icelandic', nativeName: 'Íslenska', flag: '🇮🇸' },
  { code: 'cs', name: 'Czech', nativeName: 'Čeština', flag: '🇨🇿', deepgram: 'cs' },
  { code: 'sk', name: 'Slovak', nativeName: 'Slovenčina', flag: '🇸🇰', deepgram: 'sk' },
  { code: 'hu', name: 'Hungarian', nativeName: 'Magyar', flag: '🇭🇺', deepgram: 'hu' },
  { code: 'ro', name: 'Romanian', nativeName: 'Română', flag: '🇷🇴', deepgram: 'ro' },
  { code: 'bg', name: 'Bulgarian', nativeName: 'Български', flag: '🇧🇬', deepgram: 'bg' },
  { code: 'hr', name: 'Croatian', nativeName: 'Hrvatski', flag: '🇭🇷', deepgram: 'hr' },
  { code: 'sr', name: 'Serbian', nativeName: 'Српски', flag: '🇷🇸', deepgram: 'sr' },
  { code: 'sl', name: 'Slovenian', nativeName: 'Slovenščina', flag: '🇸🇮', deepgram: 'sl' },
  { code: 'el', name: 'Greek', nativeName: 'Ελληνικά', flag: '🇬🇷', deepgram: 'el' },
  { code: 'et', name: 'Estonian', nativeName: 'Eesti', flag: '🇪🇪', deepgram: 'et' },
  { code: 'lv', name: 'Latvian', nativeName: 'Latviešu', flag: '🇱🇻', deepgram: 'lv' },
  { code: 'lt', name: 'Lithuanian', nativeName: 'Lietuvių', flag: '🇱🇹', deepgram: 'lt' },
  { code: 'sw', name: 'Swahili', nativeName: 'Kiswahili', flag: '🇰🇪', deepgram: 'sw' },
  { code: 'am', name: 'Amharic', nativeName: 'አማርኛ', flag: '🇪🇹', deepgram: 'am' },
  { code: 'af', name: 'Afrikaans', nativeName: 'Afrikaans', flag: '🇿🇦', deepgram: 'af' },
  { code: 'sq', name: 'Albanian', nativeName: 'Shqip', flag: '🇦🇱' },
  { code: 'hy', name: 'Armenian', nativeName: 'Հայերեն', flag: '🇦🇲' },
  { code: 'ka', name: 'Georgian', nativeName: 'ქართული', flag: '🇬🇪' },
  { code: 'az', name: 'Azerbaijani', nativeName: 'Azərbaycan', flag: '🇦🇿' },
  { code: 'kk', name: 'Kazakh', nativeName: 'Қазақша', flag: '🇰🇿' },
  { code: 'uz', name: 'Uzbek', nativeName: 'Oʻzbekcha', flag: '🇺🇿' },
  { code: 'mn', name: 'Mongolian', nativeName: 'Монгол', flag: '🇲🇳' },
  { code: 'km', name: 'Khmer', nativeName: 'ខ្មែរ', flag: '🇰🇭' },
  { code: 'lo', name: 'Lao', nativeName: 'ລາວ', flag: '🇱🇦' },
  { code: 'my', name: 'Burmese', nativeName: 'မြန်မာ', flag: '🇲🇲' },
];

const LANGUAGE_MAP = new Map(LANGUAGES.map((language) => [language.code, language]));

export function getLanguage(code: string): Language | undefined {
  if (code === AUTO_LANGUAGE.code) return AUTO_LANGUAGE;
  return LANGUAGE_MAP.get(code);
}

export function languageLabel(code: string): string {
  if (code === NO_TRANSLATION.code) return NO_TRANSLATION.name;
  const language = getLanguage(code);
  return language ? `${language.flag} ${language.name}` : code;
}

export function languageNativeLabel(code: string): string {
  if (code === NO_TRANSLATION.code) return NO_TRANSLATION.nativeName;
  return getLanguage(code)?.nativeName ?? code;
}

export function baseLanguage(code: string): string {
  return code.split('-')[0]?.toLowerCase() ?? code;
}

/** Best-effort check used to skip pointless translations. */
export function isSameLanguage(a: string, b: string): boolean {
  if (a === 'none' || b === 'none') return false;
  if (a === 'auto' || b === 'auto') return false;
  return baseLanguage(a) === baseLanguage(b);
}

/** Deepgram expects specific tags, e.g. `zh-CN` and `tl`. */
export function deepgramLanguage(code: string): string | undefined {
  if (code === 'auto') return undefined;
  const language = getLanguage(code);
  return language?.deepgram ?? baseLanguage(code);
}

/** MyMemory / LibreTranslate prefer ISO-639-1 two letter codes. */
export function translationLanguage(code: string): string {
  const base = baseLanguage(code);
  const aliases: Record<string, string> = {
    fil: 'tl',
    zh: 'zh-CN',
    he: 'he',
    no: 'no',
  };
  return aliases[base] ?? base;
}
