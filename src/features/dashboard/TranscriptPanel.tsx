import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownToLine,
  Clipboard,
  Copy,
  Languages,
  ListChecks,
  Loader2,
  Sparkles,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { useSessionStore } from '@/store/useSessionStore';
import { usePreferencesStore } from '@/store/usePreferencesStore';
import { useTranscription } from '@/features/transcription/TranscriptionProvider';
import { toast } from '@/store/useUiStore';
import { downloadTextFile, formatTime } from '@/lib/utils';
import { languageLabel } from '@/config/languages';

export function TranscriptPanel() {
  const segments = useSessionStore((state) => state.segments);
  const interim = useSessionStore((state) => state.interim);
  const notice = useSessionStore((state) => state.translationNotice);
  const clearSession = useSessionStore((state) => state.clearSession);
  const preferences = usePreferencesStore((state) => state.preferences);
  const { isLive } = useTranscription();
  const scrollRef = useRef<HTMLDivElement>(null);
  const shouldAutoScroll = useRef(true);
  const [copied, setCopied] = useState(false);

  const plainText = useMemo(
    () =>
      segments
        .map((segment) =>
          segment.translated && preferences.subtitle.showOriginal
            ? `${segment.original}\n${segment.translated}`
            : (segment.translated ?? segment.original),
        )
        .join('\n\n'),
    [segments, preferences.subtitle.showOriginal],
  );

  useEffect(() => {
    if (!shouldAutoScroll.current) return;
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTo({ top: node.scrollHeight, behavior: 'smooth' });
  }, [segments, interim]);

  const handleScroll = () => {
    const node = scrollRef.current;
    if (!node) return;
    const distance = node.scrollHeight - node.scrollTop - node.clientHeight;
    shouldAutoScroll.current = distance < 80;
  };

  const copyAll = async () => {
    if (!plainText) return;
    try {
      await navigator.clipboard.writeText(plainText);
      setCopied(true);
      toast('Transcript copied', `${segments.length} lines in your clipboard.`, 'success');
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast('Clipboard blocked', 'Your browser denied clipboard access.', 'error');
    }
  };

  const download = () => {
    if (!plainText) return;
    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
    downloadTextFile(`subtranslate-${stamp}.txt`, plainText);
    toast('Transcript exported', 'Saved as a .txt file.', 'success');
  };

  const clear = () => {
    clearSession();
    toast('Transcript cleared', 'The engine keeps listening.', 'info');
  };

  const activeProvider = [...segments]
    .reverse()
    .find((segment) => segment.translationProvider)?.translationProvider;

  return (
    <Card className="flex min-h-[420px] flex-col overflow-hidden">
      <div className="flex items-start justify-between gap-3 border-b border-white/[0.06] px-4 py-3">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-500/10 text-accent-400 ring-1 ring-inset ring-accent-500/20">
            <ListChecks className="h-4 w-4" />
          </span>
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
              Live transcript
              {isLive ? (
                <span className="flex items-center gap-1 text-[10px] font-medium text-rose-300">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-400" /> live
                </span>
              ) : null}
            </h2>
            <p className="mt-0.5 text-[11px] text-ink-400">
              {segments.length} line{segments.length === 1 ? '' : 's'} ·{' '}
              {preferences.targetLang === 'none'
                ? 'transcript only'
                : languageLabel(preferences.targetLang)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Copy transcript"
            title="Copy transcript"
            disabled={segments.length === 0}
            onClick={() => void copyAll()}
            className="rounded-lg p-2 text-ink-400 transition hover:bg-white/5 hover:text-white disabled:opacity-30"
          >
            {copied ? <Clipboard className="h-3.5 w-3.5 text-emerald-300" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
          <button
            type="button"
            aria-label="Download transcript"
            title="Download transcript"
            disabled={segments.length === 0}
            onClick={download}
            className="rounded-lg p-2 text-ink-400 transition hover:bg-white/5 hover:text-white disabled:opacity-30"
          >
            <ArrowDownToLine className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            aria-label="Clear transcript"
            title="Clear transcript"
            disabled={segments.length === 0 && !interim}
            onClick={clear}
            className="rounded-lg p-2 text-ink-400 transition hover:bg-rose-500/10 hover:text-rose-300 disabled:opacity-30"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {notice ? (
        <div className="flex items-start gap-2 border-b border-amber-400/10 bg-amber-400/[0.05] px-4 py-2 text-[10px] leading-relaxed text-amber-200/90">
          <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0" />
          {notice}
        </div>
      ) : null}

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-4"
      >
        {segments.length === 0 && !interim ? (
          <div className="flex h-full min-h-[300px] flex-col items-center justify-center px-6 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-400/15 to-accent-500/10 text-brand-300 ring-1 ring-inset ring-white/10">
              <Languages className="h-6 w-6" />
            </span>
            <p className="mt-3 text-sm font-semibold text-ink-200">Your transcript starts here</p>
            <p className="mt-1 max-w-xs text-[11px] leading-relaxed text-ink-400">
              Tap the microphone above, then play a video or speak. Finalized lines are translated
              automatically; partial words appear in italic.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-1.5">
              <Badge tone="brand" icon={<Sparkles className="h-2.5 w-2.5" />}>
                {preferences.engine === 'whisper' ? 'Whisper on-device' : 'Live captions'}
              </Badge>
              <Badge tone="success">Auto-save off</Badge>
            </div>
          </div>
        ) : (
          <>
            {segments.map((segment) => (
              <div
                key={segment.id}
                className="group animate-fade-up rounded-xl border border-white/[0.05] bg-white/[0.02] px-3 py-2.5 transition hover:border-white/10 hover:bg-white/[0.04]"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[13px] font-medium leading-relaxed text-ink-100">
                    {segment.original}
                  </p>
                  <span className="mt-0.5 shrink-0 font-mono text-[9px] text-ink-400">
                    {formatTime(segment.at)}
                  </span>
                </div>

                {segment.translationState === 'pending' ? (
                  <p className="mt-1 flex items-center gap-1.5 text-[11px] text-ink-400">
                    <Loader2 className="h-3 w-3 animate-spin" /> translating…
                  </p>
                ) : segment.translationState === 'error' ? (
                  <p className="mt-1 flex items-center gap-1.5 text-[11px] text-amber-300/70">
                    <TriangleAlert className="h-3 w-3" /> translation unavailable
                  </p>
                ) : segment.translated ? (
                  <p className="mt-1 border-l-2 border-brand-400/25 pl-2 text-[12px] leading-relaxed text-brand-100/90">
                    {segment.translated}
                  </p>
                ) : null}
              </div>
            ))}

            {interim ? (
              <div className="rounded-xl border border-dashed border-brand-400/20 bg-brand-400/[0.03] px-3 py-2.5">
                <p className="text-[13px] italic leading-relaxed text-ink-300">{interim}</p>
                <p className="mt-1 flex items-center gap-1.5 text-[10px] text-brand-300/70">
                  <span className="h-1 w-1 animate-pulse rounded-full bg-brand-300" /> listening…
                </p>
              </div>
            ) : null}
          </>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-white/[0.06] px-4 py-2.5">
        <span className="flex items-center gap-1.5 text-[10px] text-ink-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/80" />
          {activeProvider && activeProvider !== 'none'
            ? `Translated with ${providerLabel(activeProvider)}`
            : 'On-device transcript'}
        </span>
        <span className="text-[10px] text-ink-400">Auto-scroll</span>
      </div>
    </Card>
  );
}

function providerLabel(provider: string): string {
  switch (provider) {
    case 'mymemory':
      return 'MyMemory (free)';
    case 'libretranslate':
      return 'LibreTranslate';
    case 'offline-phrasebook':
      return 'offline phrasebook';
    case 'cache':
      return 'cached translation';
    case 'unavailable':
      return 'offline fallback';
    default:
      return provider;
  }
}
