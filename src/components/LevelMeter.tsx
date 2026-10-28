import { cn } from '@/lib/utils';

interface LevelMeterProps {
  level: number;
  active: boolean;
  bars?: number;
  className?: string;
}

/** A lightweight CSS waveform driven by real microphone RMS. */
export function LevelMeter({ level, active, bars = 7, className }: LevelMeterProps) {
  return (
    <div
      className={cn('flex h-6 items-center justify-center gap-[3px]', className)}
      aria-hidden
    >
      {Array.from({ length: bars }).map((_, index) => {
        const phase = Math.sin((index / bars) * Math.PI);
        const height = active
          ? Math.max(12, Math.min(100, 18 + level * 190 * (0.45 + phase * 0.75)))
          : 14 + phase * 10;
        return (
          <span
            key={index}
            className={cn(
              'w-[3px] rounded-full transition-[height,opacity] duration-100',
              active ? 'bg-brand-300' : 'bg-ink-600',
            )}
            style={{ height: `${height}%`, opacity: active ? 0.55 + phase * 0.45 : 0.7 }}
          />
        );
      })}
    </div>
  );
}
