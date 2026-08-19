import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * Whether this build is wired to a Supabase project.
 *
 * Deliberately optional: with no keys the app runs exactly as it did before,
 * entirely on localStorage. That keeps the repo cloneable and the dev server
 * usable without credentials, and it means a misconfigured deploy degrades to
 * "progress stays on this device" rather than to a blank screen.
 */
export const isCloudEnabled = Boolean(url && anonKey);

export const supabase: SupabaseClient | null = isCloudEnabled
  ? createClient(url as string, anonKey as string, {
      auth: {
        // The session lives in localStorage, which is also what the Capacitor
        // webview persists, so a phone stays signed in between launches.
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    })
  : null;
