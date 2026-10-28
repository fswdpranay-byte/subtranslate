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
import { Button } from '@/components/ui/Button';
import { useSessionStore } from '@/store/useSessionStore';
import { usePreferencesStore } from '@/store/usePreferencesStore';
import { useTranscription } from '@/features/transcription/TranscriptionProvider';
import { toast } from '@/store/useUiStore';
import { downloadTextFile } from '@/lib/utils';
import { appendInterim, buildContinuousTranscript } from '@/lib/transcript';
import { languageLabel } from '@/config/languages';
import { cn } from '@/lib/utils';

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

  // One continuous block: finalized captions flow together, and the live
  // partial phrase is appended at the end while the speaker is still talking.
  const converted = useMemo(() => buildContinuousTranscript(segments), [segments]);
  const displayText = useMemo(() => appendInterim(converted, interim), [converted, interim]);
  // Live partials from cumulative recognizers also repeat finalized words.
  // appendInterim() de-duplicates them; render only the genuinely new tail.
  const interimTail =
    displayText.length > converted.length ? displayText.slice(converted.length).trimStart() : '';
  const hasContent = displayText.length > 0;
  const hasSomethingToClear = segments.length > 0 || interim.length > 0;
  const wordCount = converted ? converted.split(/\s+/).filter(Boolean).length : 0;
  const translating = segments.some((segment) => segment.translationState === 'pending');

  useEffect(() => {
    if (!shouldAutoScroll.current) return;
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTo({ top: node.scrollHeight, behavior: 'smooth' });
  }, [displayText]);

  const handleScroll = () => {
    const node = scrollRef.current;
    if (!node) return;
    const distance = node.scrollHeight - node.scrollTop - node.clientHeight;
    shouldAutoScroll.current = distance < 80;
  };

  const copyAll = async () => {
    if (!displayText) return;
    try {
      await navigator.clipboard.writeText(displayText);
      setCopied(true);
      toast('Converted text copied', `${wordCount} words in your clipboard.`, 'success');
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast('Clipboard blocked', 'Your browser denied clipboard access.', 'error');
    }
  };

  const download = () => {
    if (!displayText) return;
    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
    downloadTextFile(`subtranslate-${stamp}.txt`, displayText);
    toast('Converted text exported', 'Saved as a .txt file.', 'success');
  };

  const clear = () => {
    clearSession();
    shouldAutoScroll.current = true;
    toast('Converted text cleared', 'The session keeps listening.', 'info');
  };

  const activeProvider = [...segments]
    .reverse()
    .find((segment) => segment.translationProvider)?.translationProvider;

  return (
    <Card className="flex min-h-[420px] flex-col overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-white/[0.06] px-4 py-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-500/10 text-accent-400 ring-1 ring-inset ring-accent-500/20">
            <ListChecks className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h2 className="flex flex-wrap items-center gap-2 text-sm font-semibold text-white">
              Converted text
              {isLive ? (
                <span className="flex items-center gap-1 text-[10px] font-medium text-rose-300">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-400" /> live
                </span>
              ) : null}
            </h2>
            <p className="mt-0.5 text-[11px] text-ink-400">
              {wordCount} word{wordCount === 1 ? '' : 's'} ·{' '}
              {preferences.targetLang === 'none'
                ? 'original language'
                : languageLabel(preferences.targetLang)}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            aria-label="Copy converted text"
            title="Copy converted text"
            disabled={!hasContent}
            onClick={() => void copyAll()}
            className="rounded-lg p-2 text-ink-400 transition hover:bg-white/5 hover:text-white disabled:opacity-30"
          >
            {copied ? (
              <Clipboard className="h-3.5 w-3.5 text-emerald-300" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
          <button
            type="button"
            aria-label="Download converted text"
            title="Download converted text"
            disabled={!hasContent}
            onClick={download}
            className="rounded-lg p-2 text-ink-400 transition hover:bg-white/5 hover:text-white disabled:opacity-30"
          >
            <ArrowDownToLine className="h-3.5 w-3.5" />
          </button>
          <Button
            size="sm"
            variant="secondary"
            disabled={!hasSomethingToClear}
            onClick={clear}
            leftIcon={<Trash2 className="h-3 w-3" />}
            className="h-8 px-2.5 text-[10px]"
          >
            Clear
          </Button>
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
        aria-live="polite"
        aria-label="Converted transcript"
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4"
      >
        {!hasContent ? (
          <div className="flex h-full min-h-[300px] flex-col items-center justify-center px-6 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-400/15 to-accent-500/10 text-brand-300 ring-1 ring-inset ring-white/10">
              <Languages className="h-6 w-6" />
            </span>
            <p className="mt-3 text-sm font-semibold text-ink-200">Your converted text starts here</p>
            <p className="mt-1 max-w-xs text-[11px] leading-relaxed text-ink-400">
              Tap the microphone above, then play a video or speak. Finalized phrases flow into one
              continuous paragraph — no broken cards, and you can clear it any time.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-1.5">
              <Badge tone="brand" icon={<Sparkles className="h-2.5 w-2.5" />}>
                {preferences.engine === 'whisper' ? 'Whisper on-device' : 'Live captions'}
              </Badge>
              <Badge tone="success">Auto-save off</Badge>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p
              className={cn(
                'whitespace-pre-wrap break-words text-[14px] leading-relaxed text-ink-100',
                'selection:bg-brand-400/30',
              )}
            >
              {converted}
              {interimTail ? (
                <span className="italic text-ink-300">
                  {converted ? ' ' : ''}
                  {interimTail}
                </span>
              ) : null}
              {isLive ? (
                <span className="ml-1 inline-block h-4 w-[2px] animate-pulse rounded-full bg-brand-300 align-middle" />
              ) : null}
            </p>

            {translating ? (
              <p className="flex items-center gap-1.5 text-[10px] text-ink-400">
                <Loader2 className="h-3 w-3 animate-spin" /> translating the newest phrase…
              </p>
            ) : null}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] px-4 py-2.5">
        <span className="flex items-center gap-1.5 text-[10px] text-ink-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/80" />
          {activeProvider && activeProvider !== 'none'
            ? `Translated with ${providerLabel(activeProvider)}`
            : 'On-device transcript'}
        </span>
        <span className="text-[10px] text-ink-400">Auto-scroll · clear anytime</span>
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
