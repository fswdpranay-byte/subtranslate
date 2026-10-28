import { cn } from '@/lib/utils';
import type { SubtitleStyle } from '@/types';

interface SubtitleCardProps {
  original: string;
  translated?: string;
  style: SubtitleStyle;
  /** Smaller typography for dashboard previews. */
  compact?: boolean;
  pending?: boolean;
  className?: string;
  showOriginalOverride?: boolean;
  maxLines?: number;
}

/**
 * The single source of truth for subtitle rendering.
 * Used by the dashboard preview, the PWA simulator and (mirrored in Kotlin) the
 * native Android overlay.
 */
export function SubtitleCard({
  original,
  translated,
  style,
  compact = false,
  pending = false,
  className,
  showOriginalOverride,
  maxLines = 4,
}: SubtitleCardProps) {
  const showOriginal = showOriginalOverride ?? style.showOriginal;
  const hasText = Boolean(original.trim());
  const fontSize = compact ? Math.max(12, style.fontSize - 5) : style.fontSize;
  const showTranslationLine = Boolean(translated?.trim());

  return (
    <div
      className={cn(
        'pointer-events-none w-full rounded-xl border border-white/10 px-3.5 py-2.5 text-center backdrop-blur-md transition-colors duration-200',
        className,
      )}
      style={{
        backgroundColor: `rgba(2, 6, 23, ${style.backgroundOpacity / 100})`,
        color: style.textColor,
        fontSize,
        textShadow: '0 2px 10px rgba(0,0,0,0.9), 0 1px 2px rgba(0,0,0,0.9)',
      }}
    >
      {hasText ? (
        <div className="space-y-0.5">
          {showOriginal || !showTranslationLine ? (
            <p className="line-clamp-3 font-semibold leading-snug">
              {original}
              {pending ? (
                <span className="ml-1 inline-block animate-pulse text-brand-300">…</span>
              ) : null}
            </p>
          ) : null}
          {showTranslationLine ? (
            <p
              className={cn(
                'leading-snug',
                showOriginal && 'mt-1 font-medium opacity-90',
                compact && 'text-[0.95em]',
              )}
              style={{ color: style.textColor }}
            >
              {translated}
            </p>
          ) : null}
        </div>
      ) : (
        <p className="py-1.5 text-[0.8em] font-medium opacity-70" style={{ maxHeight: maxLines * 24 }}>
          Subtitles will appear here…
        </p>
      )}
    </div>
  );
}

export function subtitlePositionClass(position: SubtitleStyle['position']): string {
  switch (position) {
    case 'top':
      return 'items-start pt-6';
    case 'center':
      return 'items-center';
    case 'bottom':
    default:
      return 'items-end pb-6';
  }
}
