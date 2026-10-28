import type { TranscriptSegment } from '@/types';

export interface ContinuousTranscriptOptions {
  /** Only include segments that already have a translation. */
  translatedOnly?: boolean;
  /** Keep only the last N segments. */
  limit?: number;
}

const clean = (value?: string): string => value?.trim() ?? '';
const normalise = (value: string): string => value.replace(/\s+/g, ' ').trim();

/** Compare words without their surrounding punctuation, keeping apostrophes. */
const wordKey = (word: string): string =>
  word
    .replace(/^[.,!?;:"'“”‘’()[\]{}—–\-…]+/, '')
    .replace(/[.,!?;:"'“”‘’()[\]{}—–\-…]+$/, '')
    .toLowerCase();

const wordKeys = (value: string): string[] =>
  value
    .split(/\s+/)
    .map(wordKey)
    .filter(Boolean);

const sameRange = (a: string[], b: string[]): boolean =>
  a.length === b.length && a.every((word, index) => word === b[index]);

/**
 * Merge a streaming caption into the text already on screen.
 *
 * Speech engines differ in what they send: Chrome usually emits only the new
 * phrase, but Android's recognizer and Vosk often re-send the whole utterance
 * so far (`"hello"` → `"hello world"` → `"hello world how"`). Appending those
 * literally repeats every earlier word. This collapses cumulative results and
 * word-level overlap so each spoken word stays on screen exactly once.
 */
export function mergeStreamingText(base: string, incoming: string): string {
  const current = normalise(base);
  const next = normalise(incoming);

  if (!current) return next;
  if (!next) return current;

  const currentWords = wordKeys(current);
  const nextWords = wordKeys(next);

  if (sameRange(currentWords, nextWords)) return current;

  // The new text repeats everything shown so far, then continues.
  if (
    nextWords.length > currentWords.length &&
    sameRange(nextWords.slice(0, currentWords.length), currentWords)
  ) {
    return next;
  }

  // The new text is an older prefix of what is already displayed.
  if (
    currentWords.length > nextWords.length &&
    sameRange(currentWords.slice(0, nextWords.length), nextWords)
  ) {
    return current;
  }

  // Overlapping phrasing from two consecutive results: keep the shared words.
  const maxOverlap = Math.min(currentWords.length, nextWords.length, 16);
  for (let size = maxOverlap; size >= 2; size -= 1) {
    if (
      sameRange(currentWords.slice(-size), nextWords.slice(0, size))
    ) {
      const incomingWords = next.split(/\s+/);
      return normalise(`${current} ${incomingWords.slice(size).join(' ')}`);
    }
  }

  // A lone word that is already the last word on screen is a duplicate.
  if (
    nextWords.length === 1 &&
    currentWords.length > 0 &&
    currentWords[currentWords.length - 1] === nextWords[0]
  ) {
    return current;
  }

  return `${current} ${next}`;
}

/**
 * Return only the words in `incoming` that are not already shown in `base`.
 *
 * Cumulative recognizers repeat the whole utterance in every result, so
 * translating `incoming` verbatim translates the same words again and again.
 * This extracts the new tail (or the whole phrase when it is unrelated).
 */
export function streamingDelta(base: string, incoming: string): string {
  const current = normalise(base);
  const next = normalise(incoming);

  if (!next) return '';
  if (!current) return next;

  const currentWords = wordKeys(current);
  const nextWords = wordKeys(next);
  const incomingWords = next.split(/\s+/);

  if (sameRange(currentWords, nextWords)) return '';

  // The new result repeats everything shown so far, then continues.
  if (
    nextWords.length > currentWords.length &&
    sameRange(nextWords.slice(0, currentWords.length), currentWords)
  ) {
    return incomingWords.slice(currentWords.length).join(' ');
  }

  // An older prefix of what is already displayed adds nothing.
  if (
    nextWords.length <= currentWords.length &&
    sameRange(currentWords.slice(0, nextWords.length), nextWords)
  ) {
    return '';
  }

  // Consecutive results sometimes share a phrase boundary.
  const maxOverlap = Math.min(currentWords.length, nextWords.length, 16);
  for (let size = maxOverlap; size >= 2; size -= 1) {
    if (sameRange(currentWords.slice(-size), nextWords.slice(0, size))) {
      return incomingWords.slice(size).join(' ');
    }
  }

  return next;
}

/**
 * Join finalized captions into one flowing paragraph.
 *
 * Captions arrive one phrase at a time. Rendering them as separate cards makes
 * the transcript look broken, so this concatenates them with normal sentence
 * spacing instead. Translated text is preferred; the original is used while a
 * translation is still pending, or when translation is disabled.
 */
export function buildContinuousTranscript(
  segments: TranscriptSegment[],
  { translatedOnly = false, limit }: ContinuousTranscriptOptions = {},
): string {
  const scope = limit && limit > 0 ? segments.slice(-limit) : segments;
  let translated = '';
  let original = '';
  let originalAtLastTranslation = '';
  let lastTranslated = -1;

  scope.forEach((segment, index) => {
    const source = clean(segment.original);
    if (source) original = mergeStreamingText(original, source);

    const converted = clean(segment.translated);
    if (converted) {
      translated = mergeStreamingText(translated, converted);
      originalAtLastTranslation = original;
      lastTranslated = index;
    }
  });

  if (translatedOnly) return translated;
  if (!translated) return original;

  // Show only the words that are not translated yet. Cumulative engines repeat
  // the earlier phrase in `original`, which would otherwise show those words a
  // second time right after their translation.
  const sourceWords = original.split(/\s+/);
  const translatedSourceWords = originalAtLastTranslation.split(/\s+/).filter(Boolean);
  const pending =
    translatedSourceWords.length > 0 &&
    sourceWords.slice(0, translatedSourceWords.length).join(' ').toLowerCase() ===
      originalAtLastTranslation.toLowerCase()
      ? sourceWords.slice(translatedSourceWords.length).join(' ')
      : lastTranslated >= 0
        ? ''
        : original;

  return pending ? mergeStreamingText(translated, pending) : translated;
}

/** Append the live interim phrase to the tail of the flowing transcript. */
export function appendInterim(text: string, interim: string): string {
  if (!clean(interim)) return normalise(text);
  return mergeStreamingText(text, interim);
}
