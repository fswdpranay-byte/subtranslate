import { Activity, ArrowRight, Languages, Loader2, Mic, MicOff, Square } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { LevelMeter } from '@/components/LevelMeter';
import { SubtitleCard } from '@/components/SubtitleCard';
import { useTranscription } from '@/features/transcription/TranscriptionProvider';
import { useSessionStore } from '@/store/useSessionStore';
import { usePreferencesStore } from '@/store/usePreferencesStore';
import { useElapsed } from '@/hooks/useElapsed';
import { getEngineDescriptors } from '@/services/transcription';
import { cn } from '@/lib/utils';

export function LiveControlCard() {
  const { start, stop, isLive, status } = useTranscription();
  const startedAt = useSessionStore((state) => state.startedAt);
  const inputLevel = useSessionStore((state) => state.inputLevel);
  const segments = useSessionStore((state) => state.segments);
  const interim = useSessionStore((state) => state.interim);
  const error = useSessionStore((state) => state.error);
  const detail = useSessionStore((state) => state.lastEngineDetail);
  const preferences = usePreferencesStore((state) => state.preferences);
  const elapsed = useElapsed(startedAt);

  const latest = [...segments].reverse().find((segment) => segment.isFinal);
  const original = interim || latest?.original || '';
  const translated = interim ? undefined : latest?.translated;
  const pending = Boolean(latest && latest.translationState === 'pending' && !interim);
  const engine = getEngineDescriptors().find((item) => item.id === preferences.engine);
  const permissionBlocked = Boolean(
    error && /blocked|not-allowed|permission|denied/i.test(error),
  );

  const handleToggle = async () => {
    if (isLive) {
      await stop();
      return;
    }
    await start();
  };

  return (
    <Card className="relative overflow-hidden p-4 sm:p-5">
      <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-brand-500/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-20 h-56 w-56 rounded-full bg-accent-500/10 blur-3xl" />

      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex shrink-0 items-center justify-center">
          {isLive ? (
            <>
              <span className="absolute inset-0 rounded-full bg-brand-400/30 animate-pulse-ring" />
              <span className="absolute inset-0 rounded-full bg-brand-400/20 animate-pulse-ring [animation-delay:600ms]" />
            </>
          ) : null}
          <button
            type="button"
            onClick={() => void handleToggle()}
            disabled={status === 'starting' || status === 'stopping'}
            aria-label={isLive ? 'Stop live captions' : 'Start live captions'}
            className={cn(
              'relative z-10 flex h-20 w-20 items-center justify-center rounded-full border transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 focus-visible:ring-offset-4 focus-visible:ring-offset-ink-900 disabled:opacity-70',
              isLive
                ? 'border-rose-300/40 bg-gradient-to-br from-rose-500 to-rose-600 text-white shadow-[0_18px_50px_-15px_rgba(244,63,94,0.9)]'
                : 'border-brand-300/40 bg-gradient-to-br from-brand-400 to-brand-600 text-ink-950 shadow-[0_18px_50px_-15px_rgba(34,211,238,0.9)] hover:scale-[1.03]',
            )}
          >
            {status === 'starting' || status === 'stopping' ? (
              <Loader2 className="h-8 w-8 animate-spin" />
            ) : isLive ? (
              <Square className="h-7 w-7 fill-current" />
            ) : (
              <Mic className="h-8 w-8" />
            )}
          </button>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold tracking-tight text-white">
              {isLive ? 'Captions are live' : status === 'error' ? 'Engine stopped' : 'Ready when you are'}
            </h2>
            {isLive ? (
              <span className="flex items-center gap-1 rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-rose-300 ring-1 ring-inset ring-rose-400/30">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-400" />
                Recording
              </span>
            ) : null}
            <Badge tone="brand" icon={<Activity className="h-2.5 w-2.5" />}>
              {engine?.mode === 'trial' ? 'Trial API' : 'On-device'}
            </Badge>
          </div>

          <p className="mt-1.5 max-w-prose text-xs leading-relaxed text-ink-400">
            {isLive
              ? (detail ?? 'Listening through your microphone. Open any app — captions stay in this session.')
              : status === 'error'
                ? 'Fix the issue below, then start again. Your transcript is preserved.'
                : 'Tap the mic and allow microphone access. Your first captions appear in a few seconds.'}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-lg bg-ink-950/60 px-2.5 py-1.5 ring-1 ring-inset ring-white/[0.07]">
              <span className={cn('h-1.5 w-1.5 rounded-full', isLive ? 'bg-emerald-400' : 'bg-ink-500')} />
              <span className="font-mono text-xs tabular-nums text-ink-200">{elapsed}</span>
              <span className="text-[10px] text-ink-400">{isLive ? 'elapsed' : 'idle'}</span>
            </div>
            <LevelMeter level={inputLevel} active={isLive} />
            <span className="text-[10px] font-medium text-ink-400">
              {engine?.shortName ?? 'Engine'} · {preferences.sourceLang === 'auto' ? 'auto-detect' : preferences.sourceLang.toUpperCase()}
              {preferences.targetLang !== 'none' ? ` → ${preferences.targetLang.toUpperCase()}` : ''}
            </span>
            <Link
              to="/overlay"
              className="ml-auto inline-flex items-center gap-1 text-[11px] font-semibold text-brand-300 transition hover:text-brand-200"
            >
              Overlay simulator <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>

      <div className="relative mt-4">
        <div className="rounded-xl bg-gradient-to-br from-ink-800 via-ink-900 to-ink-950 p-3 ring-1 ring-inset ring-white/[0.06]">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-ink-400">
              <Languages className="h-3 w-3" /> Live subtitle preview
            </span>
            <span className="text-[10px] text-ink-400">drag &amp; style in the simulator</span>
          </div>
          <SubtitleCard
            original={original || 'Tap the microphone to see your speech appear here in real time.'}
            translated={translated}
            style={preferences.subtitle}
            compact
            pending={pending}
            className="mx-auto max-w-xl"
          />
        </div>
      </div>

      {error ? (
        <div className="relative mt-3 rounded-xl border border-rose-400/20 bg-rose-950/40 px-3 py-2.5">
          <p className="flex items-start gap-2 text-[11px] leading-relaxed text-rose-200">
            <MicOff className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {error}
          </p>
          {permissionBlocked ? (
            <>
              <p className="mt-1.5 pl-[22px] text-[10px] leading-relaxed text-rose-200/70">
                Allow the microphone for <span className="font-mono text-rose-100">{window.location.host}</span>,
                then reload. Browsers do not re-prompt on the same page after a block.
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-7 px-2 text-[10px]"
                  onClick={() => window.location.reload()}
                >
                  Reload page
                </Button>
                <a
                  href="https://support.google.com/chrome/answer/114662"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[10px] font-medium text-rose-200/80 underline underline-offset-2 hover:text-rose-100"
                >
                  How to allow a microphone
                </a>
              </div>
            </>
          ) : (
            <Button
              size="sm"
              variant="secondary"
              className="mt-2 h-7 px-2 text-[10px]"
              onClick={() => void start()}
            >
              Try again
            </Button>
          )}
        </div>
      ) : null}
    </Card>
  );
}
