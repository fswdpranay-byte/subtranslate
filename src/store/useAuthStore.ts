import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/types';

interface AuthStore {
  initialized: boolean;
  loading: boolean;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  error: string | null;

  initialize: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  signInAnonymously: () => Promise<void>;
  signInWithEmail: (email: string) => Promise<{ ok: boolean; message?: string }>;
  signOut: () => Promise<void>;
  updateDisplayName: (name: string) => Promise<void>;
}

let listenerAttached = false;

function friendlyAuthError(message: string): string {
  if (/anonymous sign-ins? (are|is) disabled/i.test(message)) {
    return 'Anonymous sign-ins are disabled in your Supabase project. Enable them under Authentication → Providers → Anonymous.';
  }
  if (/redirect/i.test(message)) {
    return 'Magic link redirect failed. Add your app URL to Supabase → Authentication → URL Configuration → Redirect URLs.';
  }
  return message;
}

export const useAuthStore = create<AuthStore>()((set, get) => ({
  initialized: false,
  loading: false,
  session: null,
  user: null,
  profile: null,
  error: null,

  initialize: async () => {
    if (!supabase) {
      set({ initialized: true, loading: false });
      return;
    }
    if (get().initialized) return;

    set({ loading: true });
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      set({ session: data.session, user: data.session?.user ?? null });
      await get().refreshProfile();
    } catch (error) {
      set({ error: friendlyAuthError((error as Error).message) });
    } finally {
      set({ initialized: true, loading: false });
    }

    if (!listenerAttached) {
      listenerAttached = true;
      supabase.auth.onAuthStateChange((_event, session) => {
        set({ session, user: session?.user ?? null, error: null });
        if (session?.user) {
          void get().refreshProfile();
        } else {
          set({ profile: null });
        }
      });
    }
  },

  refreshProfile: async () => {
    if (!supabase) return;
    const user = get().user;
    if (!user) {
      set({ profile: null });
      return;
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('id, display_name, locale, created_at, updated_at')
      .eq('id', user.id)
      .maybeSingle<Profile>();

    if (error) {
      set({ error: friendlyAuthError(error.message) });
      return;
    }

    if (!data) {
      // The DB trigger normally creates this row; fall back for older projects.
      const fallbackName = user.email?.split('@')[0] ?? 'Guest';
      const { data: inserted } = await supabase
        .from('profiles')
        .insert({ id: user.id, display_name: fallbackName, locale: navigator.language })
        .select('id, display_name, locale, created_at, updated_at')
        .maybeSingle<Profile>();
      set({ profile: inserted ?? null });
      return;
    }

    set({ profile: data });
  },

  signInAnonymously: async () => {
    if (!supabase) {
      set({ error: 'Supabase is not configured.' });
      return;
    }
    set({ loading: true, error: null });
    try {
      const { error } = await supabase.auth.signInAnonymously();
      if (error) throw error;
    } catch (error) {
      set({ error: friendlyAuthError((error as Error).message) });
    } finally {
      set({ loading: false });
    }
  },

  signInWithEmail: async (email) => {
    if (!supabase) {
      return { ok: false, message: 'Supabase is not configured.' };
    }
    set({ loading: true, error: null });
    try {
      const redirectTo = `${window.location.origin}${window.location.pathname}#/auth`;
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: redirectTo, shouldCreateUser: true },
      });
      if (error) throw error;
      return { ok: true, message: 'Check your inbox for the magic link.' };
    } catch (error) {
      const message = friendlyAuthError((error as Error).message);
      set({ error: message });
      return { ok: false, message };
    } finally {
      set({ loading: false });
    }
  },

  signOut: async () => {
    if (!supabase) return;
    set({ loading: true });
    try {
      await supabase.auth.signOut();
      set({ session: null, user: null, profile: null, error: null });
    } finally {
      set({ loading: false });
    }
  },

  updateDisplayName: async (name) => {
    if (!supabase) return;
    const user = get().user;
    if (!user) return;
    const trimmed = name.trim().slice(0, 60);
    const { data, error } = await supabase
      .from('profiles')
      .update({ display_name: trimmed, updated_at: new Date().toISOString() })
      .eq('id', user.id)
      .select('id, display_name, locale, created_at, updated_at')
      .maybeSingle<Profile>();
    if (error) {
      set({ error: friendlyAuthError(error.message) });
      return;
    }
    set({ profile: data });
  },
}));
