import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Trims a project URL back to its origin.
 *
 * The Supabase dashboard shows several URLs side by side, and the REST one
 * (`https://xxx.supabase.co/rest/v1/`) is the easy one to copy by mistake. The
 * client then builds `/rest/v1/auth/v1/signup` and every request 404s with no
 * error message at all, which is a miserable thing to debug. Normalising here
 * means the same slip in a Vercel env var can't reach production either.
 */
function projectOrigin(raw: string | undefined): string | undefined {
  if (!raw?.trim()) return undefined;
  try {
    return new URL(raw.trim()).origin;
  } catch {
    console.warn(`[supabase] VITE_SUPABASE_URL is not a valid URL: ${raw}`);
    return undefined;
  }
}

const url = projectOrigin(import.meta.env.VITE_SUPABASE_URL);
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

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
