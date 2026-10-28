import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { appConfig } from '@/config/appConfig';

/**
 * Supabase client (Free Tier).
 *
 * The app deliberately works with `supabase === null`: local-only mode lets a
 * tester use the full transcription pipeline before creating a project.
 */
export const supabase: SupabaseClient | null = appConfig.supabase.configured
  ? createClient(appConfig.supabase.url!, appConfig.supabase.anonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
      global: {
        headers: { 'x-application-name': 'subtranslate' },
      },
    })
  : null;

export const AUTH_CALLBACK_PATH = '/auth';
export const AUTH_REDIRECT_URL =
  typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}#/auth` : '';

export function assertSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error(
      'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local.',
    );
  }
  return supabase;
}
