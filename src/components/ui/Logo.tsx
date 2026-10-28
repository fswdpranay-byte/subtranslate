import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  withText?: boolean;
}

export function Logo({ className, size = 'md', withText = true }: LogoProps) {
  const dimensions = size === 'sm' ? 'h-8 w-8' : size === 'lg' ? 'h-12 w-12' : 'h-10 w-10';
  const iconSize = size === 'sm' ? 'h-4 w-4' : size === 'lg' ? 'h-6 w-6' : 'h-5 w-5';
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <span
        className={cn(
          'relative flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-brand-400 via-brand-500 to-accent-500 text-ink-950 shadow-[0_10px_30px_-12px_rgba(34,211,238,0.8)]',
          dimensions,
        )}
        aria-hidden
      >
        <svg viewBox="0 0 24 24" fill="none" className={iconSize}>
          <rect x="3" y="5" width="18" height="14" rx="3" stroke="currentColor" strokeWidth="2" />
          <path d="M7 10h10M7 14h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <circle cx="18" cy="14" r="1.6" fill="currentColor" />
        </svg>
      </span>
      {withText ? (
        <span className="flex flex-col leading-none">
          <span className="text-[15px] font-bold tracking-tight text-white">
            Sub<span className="text-brand-300">Translate</span>
          </span>
          <span className="mt-0.5 text-[9px] font-medium uppercase tracking-[0.18em] text-ink-400">
            Live · Private
          </span>
        </span>
      ) : null}
    </div>
  );
}
