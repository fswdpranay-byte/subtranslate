import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronRight,
  Cloud,
  Cpu,
  Database,
  Download,
  Languages,
  LogIn,
  RotateCcw,
  Shield,
  Trash2,
  UserRound,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { usePreferencesStore } from '@/store/usePreferencesStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useUiStore, toast } from '@/store/useUiStore';
import { appConfig, isSupabaseConfigured } from '@/config/appConfig';
import { languageLabel } from '@/config/languages';
import { clearTranslationCache } from '@/services/translation';
import { promptInstall } from '@/lib/install';
import { isStandalone } from '@/lib/pwa';
import { supabase } from '@/lib/supabase';

export function SettingsPage() {
  const navigate = useNavigate();
  const preferences = usePreferencesStore((state) => state.preferences);
  const resetPreferences = usePreferencesStore((state) => state.resetPreferences);
  const resetOnboarding = usePreferencesStore((state) => state.resetOnboarding);
  const canInstall = useUiStore((state) => state.canInstall);
  const profile = useAuthStore((state) => state.profile);
  const user = useAuthStore((state) => state.user);
  const signOut = useAuthStore((state) => state.signOut);
  const [busyBackup, setBusyBackup] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const backupPreferences = async () => {
    if (!supabase || !user) return;
    setBusyBackup(true);
    const { error } = await supabase.from('user_preferences').upsert({
      user_id: user.id,
      preferences,
      updated_at: new Date().toISOString(),
    });
    setBusyBackup(false);
    if (error) {
      toast('Backup failed', error.message, 'error');
    } else {
      toast('Preferences backed up', 'Stored in your Supabase project.', 'success');
    }
  };

  return (
    <div className="px-4 pb-32 pt-4 sm:px-6">
      <PageHeader
        title="Settings"
        subtitle="Account, engines and privacy"
        showLogo
        right={
          <Badge tone="neutral" className="normal-case">
            v{appConfig.version}
          </Badge>
        }
      />

      <div className="space-y-4">
        <Card className="p-4">
          <CardHeader
            icon={<UserRound className="h-4 w-4" />}
            title="Account"
            description={
              isSupabaseConfigured
                ? 'Supabase Free Tier · email magic link or anonymous guest.'
                : 'Local-only mode. No account required.'
            }
            action={
              <Badge tone={isSupabaseConfigured ? 'success' : 'warning'}>
                {isSupabaseConfigured ? 'Connected' : 'Local'}
              </Badge>
            }
          />

          <div className="mt-3 rounded-xl border border-white/[0.06] bg-ink-950/50 px-3 py-3">
            {isSupabaseConfigured ? (
              user ? (
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-accent-500 text-sm font-bold text-ink-950">
                    {(profile?.display_name ?? user.email ?? 'G').charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-white">
                      {profile?.display_name ?? (user.is_anonymous ? 'Guest' : user.email)}
                    </p>
                    <p className="truncate text-[10px] text-ink-400">
                      {user.is_anonymous ? 'Anonymous session · this device' : user.email}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void signOut()}
                    className="text-[10px] font-medium text-rose-300/80 hover:text-rose-200"
                  >
                    Sign out
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-ink-100">Not signed in</p>
                    <p className="text-[10px] text-ink-400">Sign in to sync preferences and history.</p>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => navigate('/auth')}
                    leftIcon={<LogIn className="h-3.5 w-3.5" />}
                  >
                    Sign in
                  </Button>
                </div>
              )
            ) : (
              <div className="space-y-2">
                <p className="text-xs font-medium text-ink-200">Supabase isn’t configured yet</p>
                <p className="text-[10px] leading-relaxed text-ink-400">
                  Add <code className="rounded bg-white/5 px-1 text-brand-200">VITE_SUPABASE_URL</code>{' '}
                  and{' '}
                  <code className="rounded bg-white/5 px-1 text-brand-200">VITE_SUPABASE_ANON_KEY</code>{' '}
                  to <code className="rounded bg-white/5 px-1">.env.local</code>, then run the SQL in{' '}
                  <code className="rounded bg-white/5 px-1">supabase/schema.sql</code>. The app keeps
                  working without it.
                </p>
              </div>
            )}
          </div>

          {isSupabaseConfigured && user ? (
            <Button
              fullWidth
              size="sm"
              variant="outline"
              className="mt-2"
              loading={busyBackup}
              onClick={() => void backupPreferences()}
              leftIcon={<Cloud className="h-3.5 w-3.5" />}
            >
              Back up preferences to Supabase
            </Button>
          ) : null}
        </Card>

        <Card className="p-4">
          <CardHeader
            icon={<Cpu className="h-4 w-4" />}
            title="Speech & translation engines"
            description="Defaults keep every request free."
          />
          <div className="mt-3 divide-y divide-white/[0.06] rounded-xl border border-white/[0.06] bg-ink-950/40">
            <InfoRow
              label="Active engine"
              value={
                preferences.engine === 'whisper'
                  ? 'Whisper WASM (on-device)'
                  : preferences.engine === 'deepgram'
                    ? 'Deepgram (trial credit)'
                    : 'Browser speech (free)'
              }
            />
            <InfoRow label="Source audio" value={languageLabel(preferences.sourceLang)} />
            <InfoRow label="Subtitles" value={languageLabel(preferences.targetLang)} />
            <InfoRow
              label="Translation provider"
              value={
                appConfig.translation.provider === 'libretranslate' && appConfig.translation.libreTranslateUrl
                  ? 'LibreTranslate'
                  : 'MyMemory (free)'
              }
            />
            <InfoRow
              label="Deepgram trial"
              value={appConfig.deepgram.configured ? 'Configured' : 'Add an API key to enable'}
            />
            <InfoRow label="Whisper model" value={appConfig.whisper.model} />
          </div>
          <Button
            fullWidth
            size="sm"
            variant="secondary"
            className="mt-3"
            onClick={() => navigate('/')}
            rightIcon={<ChevronRight className="h-3.5 w-3.5" />}
          >
            Open caption controls
          </Button>
        </Card>

        <Card className="p-4">
          <CardHeader
            icon={<Shield className="h-4 w-4" />}
            title="Privacy & data"
            description="Captions live in memory unless you export them."
          />
          <div className="mt-3 space-y-2">
            <Button
              fullWidth
              size="sm"
              variant="secondary"
              onClick={() => {
                clearTranslationCache();
                toast('Translation cache cleared', 'Cached phrases were removed from this device.', 'success');
              }}
              leftIcon={<Trash2 className="h-3.5 w-3.5" />}
            >
              Clear translation cache
            </Button>
            <Button
              fullWidth
              size="sm"
              variant="secondary"
              onClick={() => {
                resetOnboarding();
                navigate('/onboarding');
              }}
              leftIcon={<RotateCcw className="h-3.5 w-3.5" />}
            >
              Replay onboarding & permissions
            </Button>
            <Button
              fullWidth
              size="sm"
              variant="danger"
              onClick={() => {
                if (!confirmReset) {
                  setConfirmReset(true);
                  return;
                }
                resetPreferences();
                setConfirmReset(false);
                toast('Preferences reset', 'Languages, engine and subtitle style are back to defaults.', 'success');
              }}
            >
              {confirmReset ? 'Tap again to confirm reset' : 'Reset all preferences'}
            </Button>
          </div>
          <p className="mt-3 flex items-start gap-1.5 text-[10px] leading-relaxed text-ink-400">
            <Database className="mt-0.5 h-3 w-3 shrink-0" />
            Microphone audio is never written to disk. Browser speech may be processed by the
            browser vendor; Whisper is fully local. Transcript history is only stored in the cloud if
            you enable it in the database and explicitly save it.
          </p>
        </Card>

        <Card className="p-4">
          <CardHeader
            icon={<Download className="h-4 w-4" />}
            title="Install & offline"
            description="PWA on the web, Capacitor on Android."
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge tone={isStandalone() ? 'success' : 'neutral'}>
              {isStandalone() ? 'Installed / standalone' : 'Browser mode'}
            </Badge>
            <Badge tone={canInstall ? 'brand' : 'neutral'}>
              {canInstall ? 'Install available' : 'Use browser install menu'}
            </Badge>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => void promptInstall()}
              leftIcon={<Download className="h-3.5 w-3.5" />}
            >
              Install PWA
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate('/overlay')}
              leftIcon={<Languages className="h-3.5 w-3.5" />}
            >
              Open overlay simulator
            </Button>
          </div>
          <p className="mt-3 text-[10px] leading-relaxed text-ink-400">
            Android release bundles are documented in <code className="text-ink-300">ANDROID_GUIDE.md</code>.
            App ID: <code className="text-ink-300">{appConfig.overlay.androidAppId}</code>.
          </p>
        </Card>

        <p className="pb-2 text-center text-[10px] leading-relaxed text-ink-400">
          SubTranslate {appConfig.version} · Built with React, Vite, Tailwind and Capacitor.
          <br />
          Free-tier infrastructure only. No analytics, no ad SDKs.
        </p>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2.5">
      <span className="text-[11px] text-ink-400">{label}</span>
      <span className="truncate text-right text-[11px] font-medium text-ink-200">{value}</span>
    </div>
  );
}
