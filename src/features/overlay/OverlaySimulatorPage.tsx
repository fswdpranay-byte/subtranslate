import { useMemo } from 'react';
import {
  ArrowLeft,
  Bookmark,
  Check,
  Clapperboard,
  Heart,
  Layers,
  MessageCircle,
  MonitorSmartphone,
  Play,
  Radio,
  RotateCcw,
  Send,
  Sparkles,
  Square,
  Volume2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Slider } from '@/components/ui/Slider';
import { Segmented } from '@/components/ui/Segmented';
import { Switch } from '@/components/ui/Switch';
import { SubtitleCard } from '@/components/SubtitleCard';
import { LevelMeter } from '@/components/LevelMeter';
import { DraggableSubtitle } from './DraggableSubtitle';
import { useDemoCaptions } from './useDemoCaptions';
import { useTranscription } from '@/features/transcription/TranscriptionProvider';
import { usePreferencesStore } from '@/store/usePreferencesStore';
import { useSessionStore } from '@/store/useSessionStore';
import { useNativeOverlay } from '@/hooks/useNativeOverlay';
import { baseLanguage, languageLabel } from '@/config/languages';
import { cn } from '@/lib/utils';
import type { SubtitlePosition } from '@/types';

const SAMPLE_TRANSLATIONS: Record<string, string> = {
  es: 'Así se verán tus subtítulos en vivo.',
  fr: 'Voici à quoi ressembleront vos sous-titres en direct.',
  de: 'So sehen deine Live-Untertitel aus.',
  pt: 'É assim que suas legendas ao vivo vão aparecer.',
  hi: 'आपके लाइव सबटाइटल ऐसे दिखेंगे।',
  ja: 'ライブ字幕はこのように表示されます。',
  ko: '라이브 자막은 이렇게 표시됩니다.',
  zh: '实时字幕将会这样显示。',
  ar: 'هكذا ستظهر ترجمتك المباشرة.',
  ru: 'Так будут выглядеть ваши живые субтитры.',
  it: 'Ecco come appariranno i tuoi sottotitoli live.',
  tr: 'Canlı altyazılarınız böyle görünecek.',
};

const COLORS = ['#FFFFFF', '#FDE68A', '#67E8F9', '#A7F3D0', '#FBCFE8', '#FCA5A5'];

export function OverlaySimulatorPage() {
  const navigate = useNavigate();
  const preferences = usePreferencesStore((state) => state.preferences);
  const updateSubtitle = usePreferencesStore((state) => state.updateSubtitle);
  const setOverlayPosition = usePreferencesStore((state) => state.setOverlayPosition);
  const segments = useSessionStore((state) => state.segments);
  const interim = useSessionStore((state) => state.interim);
  const inputLevel = useSessionStore((state) => state.inputLevel);
  const { isLive, start, stop, status } = useTranscription();
  const demo = useDemoCaptions();
  const nativeOverlay = useNativeOverlay();

  const latest = segments[segments.length - 1];
  const original = interim || latest?.original || 'This is how your live subtitles will look.';
  const translated = interim
    ? undefined
    : (latest?.translated ??
      SAMPLE_TRANSLATIONS[baseLanguage(preferences.targetLang)] ??
      (preferences.targetLang === 'none'
        ? undefined
        : 'Translated captions appear here in real time.'));
  const pending = Boolean(latest && latest.translationState === 'pending' && !interim);

  const modeLabel = useMemo(() => {
    if (isLive) return 'Live microphone';
    if (demo.running) return 'Demo playback';
    return 'Idle';
  }, [isLive, demo.running]);

  const snapToPosition = (position: SubtitlePosition) => {
    updateSubtitle({ position });
    setOverlayPosition({
      x: 50,
      y: position === 'top' ? 16 : position === 'center' ? 50 : 82,
    });
  };

  const handleGoLive = async () => {
    if (isLive) {
      await stop();
      return;
    }
    demo.stop();
    await start();
  };

  return (
    <div className="px-4 pb-28 pt-4 sm:px-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label="Go back"
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.05] text-ink-300 ring-1 ring-inset ring-white/10 transition hover:bg-white/10 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="flex items-center gap-2 text-base font-semibold text-white">
              Overlay simulator
              <Badge tone="brand">PWA</Badge>
            </h1>
            <p className="text-[11px] text-ink-400">
              Preview the floating subtitle card over a social feed.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10px] text-ink-300">
            <span
              className={cn(
                'h-1.5 w-1.5 rounded-full',
                isLive ? 'animate-pulse bg-rose-400' : demo.running ? 'bg-brand-400' : 'bg-ink-500',
              )}
            />
            {modeLabel}
          </span>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => (demo.running ? demo.stop() : demo.start())}
            disabled={isLive}
            leftIcon={demo.running ? <Square className="h-3 w-3 fill-current" /> : <Clapperboard className="h-3 w-3" />}
          >
            {demo.running ? 'Stop demo' : 'Demo captions'}
          </Button>
          <Button
            size="sm"
            variant={isLive ? 'danger' : 'primary'}
            loading={status === 'starting' || status === 'stopping'}
            onClick={() => void handleGoLive()}
            leftIcon={isLive ? <Square className="h-3 w-3 fill-current" /> : <Radio className="h-3 w-3" />}
          >
            {isLive ? 'Stop mic' : 'Go live'}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <div className="flex flex-col items-center">
          <div className="relative w-full max-w-[420px]">
            <div className="absolute inset-x-8 bottom-2 h-16 rounded-full bg-brand-500/20 blur-3xl" />
            <div className="relative mx-auto flex h-[min(74dvh,700px)] w-full max-w-[360px] flex-col overflow-hidden rounded-[2.4rem] border-[7px] border-ink-800 bg-ink-950 shadow-[0_40px_90px_-30px_rgba(0,0,0,0.9)] ring-1 ring-white/10">
              {/* Fake social video feed */}
              <div className="group/sim relative flex-1 overflow-hidden bg-gradient-to-br from-violet-900 via-ink-900 to-brand-900">
                <div className="absolute -left-16 top-10 h-56 w-56 rounded-full bg-fuchsia-500/25 blur-3xl" />
                <div className="absolute -right-20 top-1/3 h-72 w-72 rounded-full bg-brand-400/20 blur-3xl" />
                <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-ink-950 via-ink-950/60 to-transparent" />
                <div className="absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10 bg-white/[0.03] backdrop-blur-sm">
                  <div className="absolute left-1/2 top-1/3 h-10 w-10 -translate-x-1/2 rounded-full bg-white/10" />
                  <div className="absolute left-1/2 top-1/2 h-16 w-24 -translate-x-1/2 rounded-t-full bg-white/10" />
                </div>

                {/* Status bar */}
                <div className="absolute inset-x-0 top-0 z-30 flex items-center justify-between px-5 pt-3 text-[10px] font-semibold text-white/90">
                  <span>9:41</span>
                  <div className="flex items-center gap-1">
                    <span className="flex items-end gap-[2px]">
                      {[3, 5, 7, 9].map((height) => (
                        <span key={height} className="w-[2px] rounded-sm bg-white/80" style={{ height }} />
                      ))}
                    </span>
                    <span className="ml-1 h-2.5 w-4 rounded-[3px] border border-white/60" />
                  </div>
                </div>

                {/* App chrome */}
                <div className="absolute inset-x-0 top-8 z-30 flex items-center justify-between px-4 pt-2">
                  <span className="text-sm font-bold text-white">Reels</span>
                  <div className="flex items-center gap-2 text-[10px] font-semibold text-white/60">
                    <span>Following</span>
                    <span className="rounded-full bg-white/15 px-2 py-0.5 text-white">For You</span>
                  </div>
                </div>

                {/* Right action rail */}
                <div className="absolute bottom-28 right-3 z-30 flex flex-col items-center gap-4 text-white">
                  {[
                    { icon: Heart, label: '24.1K' },
                    { icon: MessageCircle, label: '892' },
                    { icon: Send, label: 'Share' },
                    { icon: Bookmark, label: 'Save' },
                  ].map(({ icon: Icon, label }) => (
                    <div key={label} className="flex flex-col items-center gap-0.5">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-black/20 backdrop-blur-sm">
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="text-[8px] font-medium">{label}</span>
                    </div>
                  ))}
                </div>

                {/* Creator */}
                <div className="absolute bottom-[8.5rem] left-3 z-30 flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-brand-300 to-accent-500 text-[10px] font-bold text-ink-950 ring-2 ring-white/70">
                    ST
                  </span>
                  <div>
                    <p className="text-[10px] font-semibold text-white">@subtranslate</p>
                    <p className="text-[8px] text-white/70">Original audio · live captions</p>
                  </div>
                </div>

                <div className="absolute bottom-16 left-3 right-12 z-20 space-y-1">
                  <p className="text-[9px] leading-relaxed text-white/80">
                    Testing SubTranslate over a real social feed. The subtitle card is draggable —
                    move it anywhere on screen.
                  </p>
                  <p className="flex items-center gap-1 text-[8px] font-medium text-white/60">
                    <Volume2 className="h-2.5 w-2.5" /> Original audio
                  </p>
                </div>

                {/* The overlay itself */}
                <div className="pointer-events-none absolute inset-0 z-40">
                  <div className="pointer-events-auto relative h-full w-full">
                    <DraggableSubtitle>
                      <SubtitleCard
                        original={original}
                        translated={translated}
                        style={preferences.subtitle}
                        pending={pending}
                        className="border-white/20 shadow-[0_16px_40px_-15px_rgba(0,0,0,0.9)]"
                      />
                    </DraggableSubtitle>
                  </div>
                </div>
              </div>

              {/* Fake bottom navigation */}
              <div className="relative z-20 flex items-center justify-around border-t border-white/5 bg-ink-950 px-6 py-2.5">
                <span className="h-1.5 w-1.5 rounded-full bg-white" />
                <span className="text-white/40"><Play className="h-3.5 w-3.5" /></span>
                <span className="text-white/40"><Layers className="h-3.5 w-3.5" /></span>
                <span className="text-white/40"><Sparkles className="h-3.5 w-3.5" /></span>
                <span className="h-5 w-5 rounded-full bg-white/10" />
              </div>
            </div>
          </div>

          <p className="mt-3 flex items-center gap-1.5 text-center text-[10px] text-ink-400">
            <MonitorSmartphone className="h-3 w-3" />
            Simulated feed · drag the subtitle card to test placement
          </p>
        </div>

        <div className="space-y-3">
          <Card className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="flex items-center gap-1.5 text-sm font-semibold text-white">
                  <Layers className="h-4 w-4 text-brand-300" /> Overlay controls
                </h2>
                <p className="mt-0.5 text-[11px] text-ink-400">
                  Changes apply instantly to the card.
                </p>
              </div>
              <button
                type="button"
                onClick={() => snapToPosition(preferences.subtitle.position)}
                className="flex items-center gap-1 rounded-lg bg-white/5 px-2 py-1 text-[10px] text-ink-300 ring-1 ring-inset ring-white/10 hover:bg-white/10"
              >
                <RotateCcw className="h-2.5 w-2.5" /> Reset
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div className="flex items-center justify-between gap-3 rounded-xl bg-ink-950/50 px-3 py-2.5 ring-1 ring-inset ring-white/[0.06]">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-ink-200">Live status</p>
                  <p className="text-[10px] capitalize text-ink-400">{status} · {modeLabel}</p>
                </div>
                <LevelMeter level={inputLevel} active={isLive} className="w-20" />
              </div>

              <Switch
                id="sim-dual"
                checked={preferences.subtitle.showOriginal}
                onChange={(showOriginal) => updateSubtitle({ showOriginal })}
                label="Dual-language"
                description="Original + translated line."
              />

              <Slider
                label="Font size"
                value={preferences.subtitle.fontSize}
                min={12}
                max={36}
                suffix="px"
                onChange={(fontSize) => updateSubtitle({ fontSize })}
              />

              <Slider
                label="Background opacity"
                value={preferences.subtitle.backgroundOpacity}
                min={0}
                max={100}
                suffix="%"
                onChange={(backgroundOpacity) => updateSubtitle({ backgroundOpacity })}
              />

              <div className="space-y-2">
                <span className="text-xs font-medium text-ink-300">Text color</span>
                <div className="flex flex-wrap items-center gap-2">
                  {COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      aria-label={`Use ${color}`}
                      onClick={() => updateSubtitle({ textColor: color })}
                      className={cn(
                        'h-6 w-6 rounded-full border-2 transition hover:scale-110',
                        preferences.subtitle.textColor.toUpperCase() === color.toUpperCase()
                          ? 'border-brand-300'
                          : 'border-white/20',
                      )}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                  <label className="relative flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border border-dashed border-white/30 text-[8px] text-ink-300">
                    +
                    <input
                      type="color"
                      aria-label="Custom subtitle color"
                      value={preferences.subtitle.textColor}
                      onChange={(event) => updateSubtitle({ textColor: event.target.value })}
                      className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    />
                  </label>
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-xs font-medium text-ink-300">Snap position</span>
                <Segmented<SubtitlePosition>
                  ariaLabel="Subtitle position"
                  value={preferences.subtitle.position}
                  onChange={snapToPosition}
                  options={[
                    { value: 'top', label: 'Top' },
                    { value: 'center', label: 'Center' },
                    { value: 'bottom', label: 'Bottom' },
                  ]}
                />
              </div>

              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[10px] leading-relaxed text-ink-400">
                Target: <span className="text-ink-200">{languageLabel(preferences.targetLang)}</span>
                {preferences.targetLang !== 'none' ? ' · translations via the free provider' : ''}
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold text-white">
                <MonitorSmartphone className="h-4 w-4 text-accent-400" /> Android floating overlay
              </h2>
              <Badge tone={nativeOverlay.isSupported ? 'success' : 'neutral'}>
                {nativeOverlay.isSupported ? 'Native' : 'Preview'}
              </Badge>
            </div>
            <p className="mt-1.5 text-[11px] leading-relaxed text-ink-400">
              {nativeOverlay.isSupported
                ? 'Launch the real system-wide overlay. It keeps captions above other apps using the native Android service.'
                : 'A PWA cannot draw above other apps. This simulator mirrors the native card pixel-for-pixel; the Play Store build enables the real overlay.'}
            </p>

            {nativeOverlay.isSupported ? (
              <div className="mt-3 space-y-2">
                {nativeOverlay.permission === false ? (
                  <p className="flex items-start gap-1.5 rounded-lg border border-amber-400/15 bg-amber-400/5 px-2.5 py-2 text-[10px] text-amber-200/80">
                    Overlay permission is off. Launching opens the Android setting.
                  </p>
                ) : null}

                {nativeOverlay.running ? (
                  <Button
                    fullWidth
                    size="sm"
                    variant="danger"
                    loading={nativeOverlay.busy}
                    onClick={() => void nativeOverlay.stop()}
                  >
                    Stop floating overlay
                  </Button>
                ) : (
                  <>
                    <Button
                      fullWidth
                      size="sm"
                      variant="secondary"
                      loading={nativeOverlay.busy}
                      onClick={() => void nativeOverlay.start('microphone')}
                    >
                      Launch microphone overlay
                    </Button>

                    {nativeOverlay.systemAudioSupported ? (
                      <div className="space-y-1.5">
                        <Button
                          fullWidth
                          size="sm"
                          variant="primary"
                          loading={nativeOverlay.busy}
                          leftIcon={<Volume2 className="h-3.5 w-3.5" />}
                          onClick={() => void nativeOverlay.start('system')}
                        >
                          Capture Instagram audio
                        </Button>
                        <p className="rounded-lg border border-accent-400/15 bg-accent-400/5 px-2.5 py-2 text-[10px] leading-relaxed text-ink-300">
                          Accept Android&apos;s screen-capture prompt, then open Instagram and play a
                          video. The audio is transcribed on-device — the first run downloads a small
                          speech model (~40–80 MB) for your source language. Use headphones if you
                          like; the video&apos;s sound does not need to reach the mic.
                        </p>
                      </div>
                    ) : (
                      <p className="rounded-lg border border-white/[0.06] bg-ink-950/40 px-2.5 py-2 text-[10px] text-ink-400">
                        System-audio capture requires Android 10 or newer. Use the microphone
                        overlay on older devices.
                      </p>
                    )}
                  </>
                )}
              </div>
            ) : (
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-white/[0.06] bg-ink-950/40 px-2.5 py-2">
                <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-400" />
                <p className="text-[10px] leading-relaxed text-ink-400">
                  Design validated here → packaged with Capacitor → system overlay enabled by the
                  native plugin. See <span className="text-ink-200">ANDROID_GUIDE.md</span>.
                </p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
