import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Check,
  ExternalLink,
  KeyRound,
  Loader2,
  LogIn,
  LogOut,
  Mail,
  Shield,
  UserRound,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useAuthStore } from '@/store/useAuthStore';
import { isSupabaseConfigured } from '@/config/appConfig';
import { toast } from '@/store/useUiStore';

export function AuthPage() {
  const session = useAuthStore((state) => state.session);
  const user = useAuthStore((state) => state.user);
  const profile = useAuthStore((state) => state.profile);
  const loading = useAuthStore((state) => state.loading);
  const initialized = useAuthStore((state) => state.initialized);
  const error = useAuthStore((state) => state.error);
  const signInAnonymously = useAuthStore((state) => state.signInAnonymously);
  const signInWithEmail = useAuthStore((state) => state.signInWithEmail);
  const signOut = useAuthStore((state) => state.signOut);
  const updateDisplayName = useAuthStore((state) => state.updateDisplayName);

  const [email, setEmail] = useState('');
  const [linkSent, setLinkSent] = useState(false);
  const [name, setName] = useState('');
  const [savingName, setSavingName] = useState(false);

  useEffect(() => {
    if (profile?.display_name) setName(profile.display_name);
  }, [profile?.display_name]);

  const handleMagicLink = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email.trim()) return;
    const result = await signInWithEmail(email);
    if (result.ok) {
      setLinkSent(true);
    }
  };

  return (
    <div className="px-4 pb-32 pt-4 sm:px-6">
      <PageHeader
        title="Account"
        subtitle="Optional sync, zero-cost auth"
        showLogo
        right={
          <Badge tone={isSupabaseConfigured ? 'success' : 'warning'}>
            {isSupabaseConfigured ? 'Supabase' : 'Local only'}
          </Badge>
        }
      />

      <div className="mx-auto max-w-lg space-y-4">
        {!isSupabaseConfigured ? <SetupCard /> : null}

        {isSupabaseConfigured && !initialized ? (
          <Card className="flex items-center justify-center gap-2 p-8 text-xs text-ink-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Restoring session…
          </Card>
        ) : null}

        {isSupabaseConfigured && initialized && !session ? (
          <Card className="p-5">
            <div className="text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-400/10 text-brand-300 ring-1 ring-inset ring-brand-400/20">
                <UserRound className="h-5 w-5" />
              </span>
              <h2 className="mt-3 text-lg font-semibold text-white">Sign in to sync</h2>
              <p className="mx-auto mt-1 max-w-xs text-[11px] leading-relaxed text-ink-400">
                Email magic link or a one-tap anonymous guest. No passwords, no paid auth tier.
              </p>
            </div>

            {linkSent ? (
              <div className="mt-5 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] p-3 text-center">
                <p className="flex items-center justify-center gap-1.5 text-xs font-semibold text-emerald-200">
                  <Mail className="h-3.5 w-3.5" /> Magic link sent
                </p>
                <p className="mt-1 text-[10px] leading-relaxed text-emerald-100/70">
                  Check {email} and open the link on this device. You can close this screen.
                </p>
                <button
                  type="button"
                  onClick={() => setLinkSent(false)}
                  className="mt-2 text-[10px] font-medium text-emerald-300 underline-offset-2 hover:underline"
                >
                  Use a different email
                </button>
              </div>
            ) : (
              <form onSubmit={(event) => void handleMagicLink(event)} className="mt-5 space-y-2">
                <label className="block text-[11px] font-medium text-ink-300" htmlFor="auth-email">
                  Email address
                </label>
                <div className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-ink-950/60 px-3 focus-within:border-brand-400/40">
                  <Mail className="h-4 w-4 text-ink-400" />
                  <input
                    id="auth-email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                    className="h-11 w-full bg-transparent text-sm text-white placeholder:text-ink-400 focus:outline-none"
                  />
                </div>
                <Button
                  fullWidth
                  type="submit"
                  loading={loading}
                  disabled={!email.trim()}
                  rightIcon={<ArrowRight className="h-4 w-4" />}
                >
                  Send magic link
                </Button>
              </form>
            )}

            <div className="my-4 flex items-center gap-2">
              <span className="h-px flex-1 bg-white/[0.07]" />
              <span className="text-[9px] uppercase tracking-wider text-ink-400">or</span>
              <span className="h-px flex-1 bg-white/[0.07]" />
            </div>

            <Button
              fullWidth
              variant="secondary"
              loading={loading}
              onClick={() => void signInAnonymously()}
              leftIcon={<LogIn className="h-4 w-4" />}
            >
              Continue as guest
            </Button>
            <p className="mt-2 text-center text-[9px] leading-relaxed text-ink-400">
              Guest accounts are anonymous Supabase users. Clearing browser data can lose access —
              that’s fine, transcripts stay local.
            </p>

            {error ? (
              <p className="mt-3 rounded-lg border border-rose-400/15 bg-rose-400/5 px-2.5 py-2 text-[10px] leading-relaxed text-rose-200/90">
                {error}
              </p>
            ) : null}
          </Card>
        ) : null}

        {isSupabaseConfigured && session && user ? (
          <>
            <Card className="p-5">
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-accent-500 text-base font-bold text-ink-950">
                  {(profile?.display_name ?? user.email ?? 'G').charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">
                    {profile?.display_name ?? (user.is_anonymous ? 'Guest' : user.email)}
                  </p>
                  <p className="truncate text-[11px] text-ink-400">
                    {user.is_anonymous ? 'Anonymous guest' : user.email}
                  </p>
                  <Badge tone="success" className="mt-1">
                    {user.is_anonymous ? 'Guest session' : 'Email verified'}
                  </Badge>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                <label htmlFor="display-name" className="block text-[11px] font-medium text-ink-300">
                  Display name
                </label>
                <div className="flex gap-2">
                  <input
                    id="display-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    maxLength={60}
                    placeholder="Your name"
                    className="h-10 min-w-0 flex-1 rounded-xl border border-white/[0.08] bg-ink-950/60 px-3 text-sm text-white placeholder:text-ink-400 focus:border-brand-400/40 focus:outline-none"
                  />
                  <Button
                    size="sm"
                    loading={savingName}
                    disabled={!name.trim() || name === profile?.display_name}
                    onClick={async () => {
                      setSavingName(true);
                      await updateDisplayName(name);
                      setSavingName(false);
                      toast('Profile updated', 'Your display name is saved in Supabase.', 'success');
                    }}
                  >
                    Save
                  </Button>
                </div>
              </div>

              <Button
                fullWidth
                variant="danger"
                size="sm"
                className="mt-3"
                onClick={() => void signOut()}
                leftIcon={<LogOut className="h-3.5 w-3.5" />}
              >
                Sign out
              </Button>
            </Card>

            <Card className="p-4">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold text-white">
                <Shield className="h-4 w-4 text-emerald-300" /> What is stored
              </h2>
              <ul className="mt-2 space-y-1.5 text-[11px] leading-relaxed text-ink-400">
                <li className="flex items-start gap-1.5">
                  <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-400" /> Profile row: display
                  name, locale, timestamps.
                </li>
                <li className="flex items-start gap-1.5">
                  <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-400" /> Optional preference
                  backup when you press the button in Settings.
                </li>
                <li className="flex items-start gap-1.5">
                  <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-400" /> No audio, no raw
                  transcripts unless you explicitly enable history.
                </li>
              </ul>
            </Card>
          </>
        ) : null}

        <p className="text-center text-[10px] text-ink-400">
          Auth runs entirely on Supabase’s free tier · RLS enabled ·{' '}
          <Link to="/settings" className="text-ink-400 underline-offset-2 hover:underline">
            Back to settings
          </Link>
        </p>
      </div>
    </div>
  );
}

function SetupCard() {
  return (
    <Card className="p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-400/10 text-amber-300 ring-1 ring-inset ring-amber-400/20">
          <KeyRound className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-sm font-semibold text-white">Connect Supabase (free)</h2>
          <p className="mt-1 text-[11px] leading-relaxed text-ink-400">
            SubTranslate runs fine without auth. To enable accounts, create a free project and add
            the keys to <code className="rounded bg-white/5 px-1">.env.local</code>.
          </p>
        </div>
      </div>

      <ol className="mt-4 space-y-2.5">
        {[
          'Create a project at supabase.com (Free Tier).',
          'Run supabase/schema.sql in the SQL Editor.',
          'Enable Authentication → Providers → Anonymous if you want guest mode.',
          'Copy Project URL + anon key into VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.',
          'Add your deployed URL to Authentication → URL Configuration → Redirect URLs.',
          'Restart the dev server.',
        ].map((step, index) => (
          <li key={step} className="flex items-start gap-2.5 text-[11px] leading-relaxed text-ink-300">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-[9px] font-bold text-brand-200">
              {index + 1}
            </span>
            {step}
          </li>
        ))}
      </ol>

      <a
        href="https://supabase.com/dashboard"
        target="_blank"
        rel="noreferrer"
        className="mt-4 inline-flex items-center gap-1.5 text-[11px] font-semibold text-brand-300 hover:text-brand-200"
      >
        Open Supabase dashboard <ExternalLink className="h-3 w-3" />
      </a>
    </Card>
  );
}
