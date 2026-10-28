import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Layers, MonitorSmartphone, Play, Square } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useNativeOverlay } from '@/hooks/useNativeOverlay';
import { usePreferencesStore } from '@/store/usePreferencesStore';
import { toast } from '@/store/useUiStore';

export function OverlayLauncher() {
  const { isSupported, running, busy, start, stop, permission } = useNativeOverlay();
  const preferences = usePreferencesStore((state) => state.preferences);
  const [starting, setStarting] = useState(false);

  const handleNativeToggle = async () => {
    if (running) {
      await stop();
      return;
    }
    setStarting(true);
    await start();
    setStarting(false);
  };

  return (
    <Card className="relative overflow-hidden p-4">
      <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-accent-500/15 blur-2xl" />
      <div className="relative">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400/20 to-accent-500/20 text-brand-200 ring-1 ring-inset ring-white/10">
            <Layers className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <h2 className="text-sm font-semibold text-white">Floating overlay</h2>
              <Badge tone="violet">Android</Badge>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-ink-400">
              Keep captions above Instagram, TikTok or YouTube while SubTranslate runs in the
              background.
            </p>
          </div>
        </div>

        <div className="mt-3 rounded-xl border border-white/[0.06] bg-ink-950/50 p-3">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-ink-400">
            <MonitorSmartphone className="h-3 w-3" /> Subtitle settings
          </p>
          <p className="mt-1.5 text-xs text-ink-300">
            {preferences.subtitle.fontSize}px ·{' '}
            {preferences.subtitle.backgroundOpacity}% background ·{' '}
            {preferences.subtitle.showOriginal ? 'dual-language' : 'translation only'} ·{' '}
            {preferences.subtitle.position}
          </p>
          <p className="mt-1 text-[10px] text-ink-400">
            {preferences.sourceLang === 'auto' ? 'Auto-detect' : preferences.sourceLang.toUpperCase()} →{' '}
            {preferences.targetLang === 'none' ? 'No translation' : preferences.targetLang.toUpperCase()}
          </p>
        </div>

        <div className="mt-3 grid gap-2">
          <Link to="/overlay" className="block">
            <Button fullWidth rightIcon={<ArrowUpRight className="h-4 w-4" />} variant="secondary">
              Open PWA overlay simulator
            </Button>
          </Link>

          {isSupported ? (
            <Button
              fullWidth
              variant={running ? 'danger' : 'primary'}
              loading={busy || starting}
              onClick={() => void handleNativeToggle()}
              leftIcon={running ? <Square className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4" />}
            >
              {running ? 'Stop floating overlay' : 'Launch floating overlay'}
            </Button>
          ) : (
            <button
              type="button"
              onClick={() =>
                toast(
                  'Native overlay is Android-only',
                  'The PWA simulator reproduces the overlay UI in any browser. The Play Store build enables the system-wide overlay.',
                  'info',
                )
              }
              className="flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-white/15 text-[11px] font-medium text-ink-400 transition hover:border-white/25 hover:text-ink-200"
            >
              System overlay requires the Android app
            </button>
          )}
        </div>

        {isSupported && permission === false ? (
          <p className="mt-2 text-[10px] leading-relaxed text-amber-300/80">
            “Display over other apps” is off. Launching will open the Android setting for you.
          </p>
        ) : null}
      </div>
    </Card>
  );
}
