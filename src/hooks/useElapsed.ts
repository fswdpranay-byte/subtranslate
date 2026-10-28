import { useEffect, useState } from 'react';
import { formatDuration } from '@/lib/utils';

/** Ticks once per second while `startedAt` is set. */
export function useElapsed(startedAt: number | null): string {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!startedAt) return;
    const interval = window.setInterval(() => setTick((tick) => tick + 1), 1000);
    return () => window.clearInterval(interval);
  }, [startedAt]);

  return formatDuration(startedAt);
}
