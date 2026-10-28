import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Cpu,
  Languages,
  Layers,
  Lock,
  Mic,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { DEFAULT_PREFERENCES, usePreferencesStore } from '@/store/usePreferencesStore';
import { useMicrophonePermission } from '@/hooks/useMicrophonePermission';
import { useTranscription } from '@/features/transcription/TranscriptionProvider';
import { useSessionStore } from '@/store/useSessionStore';
import { SubtitleCard } from '@/components/SubtitleCard';
import { toast } from '@/store/useUiStore';
import { isAndroidNative, openAppSettings, requestOverlayPermission } from '@/lib/nativeOverlay';
import { useNativeOverlay } from '@/hooks/useNativeOverlay';

const STEPS = ['Welcome', 'Microphone', 'Overlay', 'Test'];

interface StepProps {
  onContinue: () => void;
}

export function OnboardingFlow() {
  const [step, setStep] = useState(0);
  const navigate = useNavigate();
  const { stop, isLive } = useTranscription();
  const completeOnboarding = usePreferencesStore((state) => state.completeOnboarding);
  const clearSession = useSessionStore((state) => state.clearSession);

  const finish = async () => {
    if (isLive) await stop();
    clearSession();
    completeOnboarding();
    navigate('/', { replace: true });
  };

  const goNext = () => setStep((current) => Math.min(STEPS.length - 1, current + 1));
  const goBack = () => setStep((current) => Math.max(0, current - 1));

  return (
    <div className="relative min-h-dvh overflow-hidden bg-ink-950 text-ink-100">
      <div className="pointer-events-none absolute -top-32 left-1/2 h-96 w-[36rem] -translate-x-1/2 rounded-full bg-brand-500/15 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-40 right-0 h-96 w-96 rounded-full bg-accent-500/10 blur-[100px]" />

      <div className="relative mx-auto flex min-h-dvh w-full max-w-lg flex-col px-5 pb-8 pt-5 sm:px-8">
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {step > 0 ? (
              <button
                type="button"
                onClick={goBack}
                aria-label="Previous step"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-400 transition hover:bg-white/5 hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            ) : null}
            <Logo size="sm" />
          </div>
          <button
            type="button"
            onClick={() => void finish()}
            className="text-[11px] font-medium text-ink-400 transition hover:text-white"
          >
            Skip setup
          </button>
        </header>

        <div className="mt-6 flex items-center gap-1.5" aria-hidden>
          {STEPS.map((label, index) => (
            <div key={label} className="flex flex-1 flex-col gap-1.5">
              <span
                className={`h-1 rounded-full transition-all duration-300 ${
                  index <= step ? 'bg-brand-400' : 'bg-white/10'
                }`}
              />
              <span
                className={`text-[9px] font-medium uppercase tracking-wider transition-colors ${
                  index === step ? 'text-brand-300' : 'text-ink-400'
                }`}
              >
                {label}
              </span>
            </div>
          ))}
        </div>

        <main className="mt-7 flex flex-1 flex-col">
          {step === 0 ? <WelcomeStep onContinue={goNext} /> : null}
          {step === 1 ? <MicrophoneStep onContinue={goNext} /> : null}
          {step === 2 ? <OverlayStep onContinue={goNext} /> : null}
          {step === 3 ? <TestPlayerStep onContinue={() => void finish()} /> : null}
        </main>

        <p className="mt-6 text-center text-[10px] text-ink-400">
          No account required · Free on-device engines · Your audio stays yours
        </p>
      </div>
    </div>
  );
}

function WelcomeStep({ onContinue }: StepProps) {
  return (
    <div className="animate-fade-up">
      <div className="mx-auto max-w-[320px]">
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-violet-900/80 via-ink-900 to-brand-900/60 p-3 shadow-2xl">
          <div className="relative h-52 overflow-hidden rounded-2xl bg-gradient-to-br from-fuchsia-900/50 via-ink-900 to-brand-900/60">
            <div className="absolute -left-8 top-4 h-32 w-32 rounded-full bg-fuchsia-500/30 blur-2xl" />
            <div className="absolute -right-8 bottom-4 h-32 w-32 rounded-full bg-brand-400/25 blur-2xl" />
            <div className="absolute inset-x-0 top-0 flex items-center justify-between p-3 text-[9px] text-white/70">
              <span className="font-semibold">Live captions</span>
              <span className="flex items-center gap-1 rounded-full bg-black/30 px-2 py-0.5 backdrop-blur">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-400" /> LIVE
              </span>
            </div>
            <div className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10 bg-white/[0.04]">
              <div className="absolute left-1/2 top-1/4 h-7 w-7 -translate-x-1/2 rounded-full bg-white/10" />
              <div className="absolute left-1/2 top-1/2 h-10 w-16 -translate-x-1/2 rounded-t-full bg-white/10" />
            </div>
            <div className="absolute inset-x-3 bottom-3">
              <SubtitleCard
                original="You're watching a video in another language."
                translated="Estás viendo un video en otro idioma."
                style={DEFAULT_PREFERENCES.subtitle}
                compact
              />
            </div>
          </div>
          <div className="flex items-center justify-between px-1 pt-2.5">
            <div className="flex items-center gap-1.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-400 text-[8px] font-bold text-ink-950">
                ST
              </span>
              <span className="text-[9px] text-white/70">@subtranslate</span>
            </div>
            <span className="flex items-center gap-1 text-[8px] text-white/50">
              <Sparkles className="h-2.5 w-2.5" /> On-device
            </span>
          </div>
        </div>
      </div>

      <div className="mt-7 text-center">
        <Badge tone="brand" icon={<Sparkles className="h-2.5 w-2.5" />}>
          Live subtitles for every app
        </Badge>
        <h1 className="mt-3 text-balance text-3xl font-bold leading-[1.1] tracking-tight text-white">
          Understand every video,
          <span className="bg-gradient-to-r from-brand-300 to-accent-400 bg-clip-text text-transparent">
            {' '}
            in your language.
          </span>
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-ink-400">
          Real-time captions and translation that float over Instagram, TikTok and YouTube — with a
          private on-device engine and no subscription.
        </p>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2">
        {[
          { icon: Languages, label: '50+ languages' },
          { icon: Cpu, label: 'On-device AI' },
          { icon: Layers, label: 'Floating overlay' },
        ].map(({ icon: Icon, label }) => (
          <div
            key={label}
            className="flex flex-col items-center gap-1.5 rounded-xl border border-white/[0.06] bg-white/[0.02] px-2 py-3 text-center"
          >
            <Icon className="h-4 w-4 text-brand-300" />
            <span className="text-[10px] font-medium text-ink-300">{label}</span>
          </div>
        ))}
      </div>

      <div className="mt-6">
        <Button fullWidth size="lg" onClick={onContinue} rightIcon={<ArrowRight className="h-4 w-4" />}>
          Get started
        </Button>
        <p className="mt-2 text-center text-[10px] text-ink-400">
          Takes 30 seconds. You can change everything later.
        </p>
      </div>
    </div>
  );
}

function MicrophoneStep({ onContinue }: StepProps) {
  const { permission, isRequesting, error, request } = useMicrophonePermission();
  const markMicGranted = usePreferencesStore((state) => state.markMicGranted);
  const granted = permission === 'granted';

  const handleAllow = async () => {
    const ok = await request();
    markMicGranted(ok);
    if (!ok) return;
    toast(
      'Microphone ready',
      isAndroidNative
        ? 'Android granted microphone access to SubTranslate. Captions run in the floating overlay.'
        : 'You can revoke access any time in your browser settings.',
      'success',
    );
  };

  return (
    <div className="animate-fade-up">
      <div className="mx-auto flex h-32 w-32 items-center justify-center">
        <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-brand-400/20 to-accent-500/15 ring-1 ring-inset ring-brand-400/30">
          {granted ? (
            <Check className="h-9 w-9 text-emerald-300" strokeWidth={2.5} />
          ) : (
            <Mic className="h-9 w-9 text-brand-300" />
          )}
        </div>
      </div>

      <div className="text-center">
        <Badge tone={granted ? 'success' : 'brand'}>
          {granted ? 'Microphone connected' : 'Permission required'}
        </Badge>
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-white">
          Let SubTranslate listen
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink-400">
          Your microphone is the audio source for live captions. We need access to transcribe the
          sound around you — nothing is recorded or uploaded.
        </p>
      </div>

      <div className="mt-5 space-y-2">
        {[
          {
            icon: Cpu,
            title: isAndroidNative ? 'Native speech on your phone' : 'Whisper runs 100% on-device',
            text: isAndroidNative
              ? 'Android’s speech service handles live captions, with an optional offline Vosk model for Instagram audio.'
              : 'Model inference happens locally in WebAssembly. No audio leaves your phone.',
          },
          {
            icon: Lock,
            title: 'No recordings, ever',
            text: 'Only text is kept in memory (and optional history you choose to save).',
          },
          {
            icon: ShieldCheck,
            title: 'Revoke any time',
            text: 'Android and browser settings can cut access instantly.',
          },
        ].map(({ icon: Icon, title, text }) => (
          <div
            key={title}
            className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5"
          >
            <Icon className="mt-0.5 h-4 w-4 shrink-0 text-brand-300" />
            <div>
              <p className="text-xs font-semibold text-ink-100">{title}</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-ink-400">{text}</p>
            </div>
          </div>
        ))}
      </div>

      {permission === 'unsupported' && !isAndroidNative ? (
        <p className="mt-3 rounded-xl border border-amber-400/15 bg-amber-400/5 px-3 py-2 text-[11px] leading-relaxed text-amber-200/80">
          This browser build does not expose microphone capture. You can still explore the demo in
          the next step.
        </p>
      ) : null}

      {isAndroidNative ? (
        <p className="mt-3 rounded-xl border border-brand-400/15 bg-brand-400/5 px-3 py-2 text-[11px] leading-relaxed text-brand-200/80">
          Android asks for microphone access directly. Once granted, captions run in a floating card
          above Instagram and other apps — no browser permission prompt is involved.
        </p>
      ) : null}

      {error ? (
        <div className="mt-3 rounded-xl border border-rose-400/15 bg-rose-400/5 px-3 py-2">
          <p className="text-[11px] leading-relaxed text-rose-200/90">{error}</p>
          {isAndroidNative ? (
            <button
              type="button"
              onClick={() => void openAppSettings()}
              className="mt-2 text-[11px] font-semibold text-rose-200 underline underline-offset-2 hover:text-rose-100"
            >
              Open Android app settings
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="mt-5 space-y-2">
        {granted ? (
          <Button fullWidth size="lg" onClick={onContinue} rightIcon={<ArrowRight className="h-4 w-4" />}>
            Continue
          </Button>
        ) : (
          <Button
            fullWidth
            size="lg"
            loading={isRequesting}
            onClick={() => void handleAllow()}
            leftIcon={<Mic className="h-4 w-4" />}
          >
            Allow microphone
          </Button>
        )}
        {!granted ? (
          <button
            type="button"
            onClick={() => {
              markMicGranted(false);
              onContinue();
            }}
            className="w-full py-1 text-center text-[11px] text-ink-400 transition hover:text-ink-300"
          >
            Maybe later — explore without microphone
          </button>
        ) : null}
      </div>

      <p className="mt-3 text-center text-[9px] leading-relaxed text-ink-400">
        {isAndroidNative
          ? 'Android uses its native speech service. Choose microphone mode for the mic, or system mode to hear Instagram’s audio.'
          : 'Heads-up: Chrome’s built-in SpeechRecognition may use the browser vendor’s cloud. Choose Whisper for fully local inference.'}
      </p>
    </div>
  );
}

function OverlayStep({ onContinue }: StepProps) {
  const markOverlayExplained = usePreferencesStore((state) => state.markOverlayExplained);
  const [nativeHope, setNativeHope] = useState(false);

  return (
    <div className="animate-fade-up">
      <div className="relative mx-auto w-full max-w-[300px]">
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-violet-900/70 via-ink-900 to-brand-900/50 p-2.5">
          <div className="relative h-48 overflow-hidden rounded-xl bg-gradient-to-br from-fuchsia-900/40 via-ink-900 to-brand-900/50">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(168,85,247,0.25),transparent_55%)]" />
            <div className="absolute right-2 top-2 flex flex-col gap-2 text-white/50">
              <span className="h-5 w-5 rounded-full border border-white/20" />
              <span className="h-5 w-5 rounded-full border border-white/20" />
              <span className="h-5 w-5 rounded-full border border-white/20" />
            </div>
            <div className="absolute left-2 top-2 text-[8px] text-white/50">TikTok · For You</div>
            <div className="absolute inset-x-2 top-1/2 -translate-y-1/2 rounded-lg border border-brand-300/30 bg-ink-950/75 px-2 py-1.5 text-center backdrop-blur">
              <p className="text-[10px] font-semibold leading-snug text-white">
                This caption floats above the app.
              </p>
              <p className="text-[9px] leading-snug text-brand-200">
                Esta leyenda flota sobre la aplicación.
              </p>
            </div>
            <div className="absolute inset-x-2 bottom-2 flex items-center justify-between text-[8px] text-white/50">
              <span>@creator · original audio</span>
              <span className="flex items-center gap-1 text-brand-300">
                <Layers className="h-2.5 w-2.5" /> overlay
              </span>
            </div>
          </div>
        </div>
        <span className="absolute -right-2 -top-2 rounded-full border border-white/15 bg-ink-900 px-2 py-0.5 text-[9px] font-medium text-brand-300 shadow-xl">
          Floating window
        </span>
      </div>

      <div className="mt-6 text-center">
        <Badge tone="violet" icon={<Layers className="h-2.5 w-2.5" />}>
          Android system overlay
        </Badge>
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-white">
          Subtitles over every app
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink-400">
          On Android, SubTranslate draws a small floating card above other apps. Grant “Display over
          other apps”, drag the caption where you like, and keep watching.
        </p>
      </div>

      {nativeHope ? (
        <p className="mt-4 rounded-xl border border-emerald-400/15 bg-emerald-400/5 px-3 py-2 text-[11px] leading-relaxed text-emerald-200/80">
          Android settings opened. Enable SubTranslate, return to the app, then start the overlay
          from the dashboard.
        </p>
      ) : (
        <p className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[11px] leading-relaxed text-ink-400">
          In this browser you can test the exact overlay in our PWA simulator. The system-wide
          floating window requires the Android build.
        </p>
      )}

      <div className="mt-5 space-y-2">
        <Button
          fullWidth
          size="lg"
          variant="secondary"
          leftIcon={<Layers className="h-4 w-4" />}
          onClick={() => {
            setNativeHope(true);
            if (!isAndroidNative) {
              toast(
                'Simulator available now',
                'Open “Overlay” from the dashboard to drag and style the caption over a mock feed.',
                'info',
              );
              return;
            }
            void requestOverlayPermission();
          }}
        >
          {nativeHope ? 'Open overlay settings again' : 'Open overlay settings'}
        </Button>
        <Button
          fullWidth
          size="lg"
          onClick={() => {
            markOverlayExplained();
            onContinue();
          }}
          rightIcon={<ArrowRight className="h-4 w-4" />}
        >
          Continue
        </Button>
      </div>
    </div>
  );
}

function TestPlayerStep({ onContinue }: StepProps) {
  const { start, stop, isLive, status } = useTranscription();
  const native = useNativeOverlay();
  const nativeMode = native.isSupported;
  const live = nativeMode ? native.running : isLive;
  const preferences = usePreferencesStore((state) => state.preferences);
  const segments = useSessionStore((state) => state.segments);
  const interim = useSessionStore((state) => state.interim);
  const inputLevel = useSessionStore((state) => state.inputLevel);
  const clearSession = useSessionStore((state) => state.clearSession);
  const [starting, setStarting] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const [demoText, setDemoText] = useState('');
  const demoTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (demoTimer.current !== null) window.clearInterval(demoTimer.current);
    };
  }, []);

  const demoLines = [
    ['Welcome to SubTranslate.', 'Bienvenido a SubTranslate.'],
    ['This is a live caption test.', 'Esta es una prueba de subtítulos en vivo.'],
    ['Drag the overlay anywhere you want.', 'Arrastra la superposición donde quieras.'],
  ];

  const latest = segments[segments.length - 1];
  const original = demoMode
    ? demoText
    : interim || latest?.original || 'Your speech appears here as captions.';
  const translated = demoMode
    ? demoLines.find(([line]) => line === demoText)?.[1]
    : latest?.translated;

  const playDemo = () => {
    clearSession();
    if (demoTimer.current !== null) window.clearInterval(demoTimer.current);
    setDemoMode(true);
    let index = 0;
    setDemoText(demoLines[0][0]);
    demoTimer.current = window.setInterval(() => {
      index += 1;
      if (index >= demoLines.length) {
        if (demoTimer.current !== null) window.clearInterval(demoTimer.current);
        demoTimer.current = null;
        return;
      }
      setDemoText(demoLines[index][0]);
    }, 2200);
  };

  const handleTest = async () => {
    if (nativeMode) {
      if (native.running) {
        await native.stop();
        return;
      }
      if (demoTimer.current !== null) {
        window.clearInterval(demoTimer.current);
        demoTimer.current = null;
      }
      setDemoMode(false);
      await native.start('microphone');
      return;
    }
    if (isLive) {
      await stop();
      return;
    }
    if (demoTimer.current !== null) {
      window.clearInterval(demoTimer.current);
      demoTimer.current = null;
    }
    setDemoMode(false);
    setStarting(true);
    await start();
    setStarting(false);
  };

  return (
    <div className="animate-fade-up">
      <div className="text-center">
        <Badge tone="success" icon={<Check className="h-2.5 w-2.5" />}>
          Final step
        </Badge>
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-white">Test live captions</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink-400">
          {nativeMode
            ? 'Launch the floating overlay, then open Instagram. Captions stay above the app. You can also play the demo first.'
            : 'Speak a sentence or play the demo. This is the exact subtitle card that floats over your other apps.'}
        </p>
      </div>

      <div className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-ink-800 to-ink-950 p-3">
        <div className="relative h-44 overflow-hidden rounded-xl bg-gradient-to-br from-brand-900/50 via-ink-900 to-accent-500/20">
          <div className="absolute -left-6 top-6 h-28 w-28 rounded-full bg-brand-400/20 blur-2xl" />
          <div className="absolute -right-8 bottom-4 h-28 w-28 rounded-full bg-accent-500/20 blur-2xl" />
          <div className="absolute left-1/2 top-1/3 flex h-14 w-14 -translate-x-1/2 items-center justify-center rounded-full border border-white/15 bg-black/25 backdrop-blur">
            <Mic className="h-6 w-6 text-white/70" />
          </div>
          <div className="absolute inset-x-3 bottom-3">
            <SubtitleCard
              original={original}
              translated={translated}
              style={preferences.subtitle}
              pending={Boolean(latest?.translationState === 'pending' && !demoMode)}
              compact
            />
          </div>
          <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-black/30 px-2 py-0.5 text-[9px] text-white/80 backdrop-blur">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                live ? 'animate-pulse bg-rose-400' : demoMode ? 'bg-brand-400' : 'bg-white/40'
              }`}
            />
            {live ? 'Listening' : demoMode ? 'Demo' : 'Ready'}
          </div>
          {live && !nativeMode ? (
            <div className="absolute right-3 top-3 flex items-end gap-0.5">
              {[6, 10, 14, 8].map((height, index) => (
                <span
                  key={index}
                  className="w-0.5 rounded-full bg-brand-300"
                  style={{
                    height: Math.max(4, inputLevel * height * 2),
                    transition: 'height 120ms',
                  }}
                />
              ))}
            </div>
          ) : null}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant={live ? 'danger' : 'primary'}
            loading={
              nativeMode
                ? native.busy
                : starting || status === 'starting' || status === 'stopping'
            }
            onClick={() => {
              void handleTest();
            }}
            leftIcon={<Mic className="h-3.5 w-3.5" />}
          >
            {live
              ? nativeMode
                ? 'Stop floating overlay'
                : 'Stop test'
              : nativeMode
                ? 'Launch floating overlay'
                : 'Start microphone test'}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              if (live) {
                if (nativeMode) void native.stop();
                else void stop();
              }
              playDemo();
            }}
            leftIcon={<Sparkles className="h-3.5 w-3.5" />}
          >
            Play demo
          </Button>
          <span className="ml-auto text-[10px] text-ink-400">
            {nativeMode
              ? 'Android native speech'
              : preferences.engine === 'whisper'
                ? 'Whisper · on-device'
                : 'Browser speech · free'}
          </span>
        </div>
      </div>

      <div className="mt-5 space-y-2">
        <Button fullWidth size="lg" onClick={onContinue} rightIcon={<ArrowRight className="h-4 w-4" />}>
          Enter SubTranslate
        </Button>
        <p className="text-center text-[10px] text-ink-400">
          You can set your languages and engine on the dashboard.
        </p>
      </div>
    </div>
  );
}
