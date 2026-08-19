import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import { isCloudEnabled, supabase } from '../lib/supabase';

/**
 * Who the player currently is, as far as Supabase is concerned.
 *
 * Anonymous accounts are real rows in auth.users, so "not registered" does not
 * mean "no account" — it means the account has no identity attached and dies
 * with this device's localStorage. Converting keeps the same user id, and
 * therefore the same profile row, which is the whole reason the anonymous-first
 * flow works.
 */

export type AuthStatus =
  /** No Supabase keys in this build; the app is running purely local. */
  | 'off'
  /** Still resolving the session on boot. */
  | 'loading'
  /** Signed in, but with nothing that survives a reinstall. */
  | 'anonymous'
  /** Has a verified email or a linked provider. */
  | 'registered';

interface AuthState {
  status: AuthStatus;
  /** Confirmed email, once verification has gone through. */
  email: string | null;
  /** Address awaiting confirmation. Postgres keeps it out of `email` until the
   *  link is clicked, so this is the only way to show "check your inbox". */
  pendingEmail: string | null;
  /** Last failure, in Spanish, ready to render. */
  error: string | null;
  /** Set while a link attempt is in flight. */
  busy: boolean;

  init: () => void;
  linkEmail: (email: string) => Promise<boolean>;
  linkProvider: (provider: 'google' | 'apple') => Promise<void>;
  clearError: () => void;
}

function applySession(session: Session | null): Partial<AuthState> {
  if (!session) return { status: 'loading', email: null, pendingEmail: null };
  const user = session.user;
  // is_anonymous is absent on older sessions; treat a linked identity or a
  // confirmed email as registered either way.
  const anonymous = user.is_anonymous === true;
  return {
    status: anonymous ? 'anonymous' : 'registered',
    email: user.email ?? null,
    pendingEmail: user.new_email ?? null,
  };
}

/** Supabase speaks English; the player doesn't. */
function translate(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('already') && m.includes('registered')) return 'Ese correo ya tiene cuenta. Inicia sesión con él.';
  if (m.includes('invalid') && m.includes('email')) return 'Ese correo no parece válido.';
  if (m.includes('rate limit') || m.includes('too many')) return 'Demasiados intentos. Espera un momento y vuelve a probar.';
  if (m.includes('manual linking')) return 'Falta activar "Manual Linking" en Supabase (ver supabase/README.md).';
  if (m.includes('provider') && m.includes('not enabled')) return 'Ese proveedor aún no está activado en Supabase.';
  return message;
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  status: isCloudEnabled ? 'loading' : 'off',
  email: null,
  pendingEmail: null,
  error: null,
  busy: false,

  init: () => {
    if (!supabase) return;

    void supabase.auth.getSession().then(({ data }) => set(applySession(data.session)));

    // Fires when the confirmation link is clicked in another tab, or when an
    // OAuth redirect lands, so the banner disappears without a reload.
    supabase.auth.onAuthStateChange((_event, session) => set(applySession(session)));
  },

  linkEmail: async (email) => {
    if (!supabase) return false;
    set({ busy: true, error: null });

    // updateUser on an anonymous account attaches the address and sends the
    // confirmation. Until the link is clicked it lives in new_email, so the
    // account stays anonymous and nothing is lost if they never confirm.
    const { error } = await supabase.auth.updateUser(
      { email: email.trim() },
      { emailRedirectTo: `${window.location.origin}/home` }
    );

    if (error) {
      set({ busy: false, error: translate(error.message) });
      return false;
    }
    set({ busy: false, pendingEmail: email.trim() });
    return true;
  },

  linkProvider: async (provider) => {
    if (!supabase) return;
    set({ busy: true, error: null });

    // linkIdentity, not signInWithOAuth: signing in would abandon the anonymous
    // account and every lesson played on it. Requires "Manual Linking" enabled.
    const { error } = await supabase.auth.linkIdentity({
      provider,
      options: { redirectTo: `${window.location.origin}/home` },
    });

    if (error) set({ busy: false, error: translate(error.message) });
    // On success the browser navigates away, so there is no state to settle.
  },

  clearError: () => {
    if (get().error) set({ error: null });
  },
}));
