/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Supabase project URL. Absent means the app runs purely on localStorage. */
  readonly VITE_SUPABASE_URL?: string;
  /** Publishable anon key. Safe in the client — row level security is what
   *  actually protects the data. The service_role key must never appear here. */
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** Injected by vite.config.ts from `git describe`. */
declare const __BUILD_ID__: string;
