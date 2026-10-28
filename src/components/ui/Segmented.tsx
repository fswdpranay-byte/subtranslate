import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
}

interface SegmentedProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  size?: 'sm' | 'md';
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  size = 'md',
}: SegmentedProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="flex min-w-0 rounded-xl bg-ink-950/60 p-1 ring-1 ring-inset ring-white/[0.07]"
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              'flex min-w-0 flex-1 basis-0 items-center justify-center gap-1 rounded-lg font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/60',
              size === 'md'
                ? 'h-9 px-1.5 text-[11px] sm:px-2 sm:text-xs'
                : 'h-8 px-1 text-[10px] sm:px-1.5 sm:text-[11px]',
              selected
                ? 'bg-white/10 text-white shadow-sm ring-1 ring-inset ring-white/10'
                : 'text-ink-400 hover:text-ink-200',
            )}
          >
            {option.icon ? (
              <span className="shrink-0 [&>svg]:h-3 [&>svg]:w-3">{option.icon}</span>
            ) : null}
            <span className="truncate">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
