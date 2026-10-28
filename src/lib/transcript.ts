import type { TranscriptSegment } from '@/types';

export interface ContinuousTranscriptOptions {
  /** Only include segments that already have a translation. */
  translatedOnly?: boolean;
  /** Keep only the last N segments. */
  limit?: number;
}

const clean = (value?: string): string => value?.trim() ?? '';

/** Tidy joining punctuation without rewriting words the engine produced. */
const tidy = (value: string): string =>
  value
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();

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
  const parts: string[] = [];

  for (const segment of scope) {
    const translated = clean(segment.translated);
    const original = clean(segment.original);
    const value = translated || (translatedOnly ? '' : original);
    if (!value) continue;
    if (parts[parts.length - 1] === value) continue;
    parts.push(value);
  }

  return tidy(parts.join(' '));
}

/** Append the live interim phrase to the tail of the flowing transcript. */
export function appendInterim(text: string, interim: string): string {
  const tail = clean(interim);
  if (!tail) return text;
  if (!text) return tail;
  return tidy(`${text} ${tail}`);
}
