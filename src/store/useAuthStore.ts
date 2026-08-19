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
  /** Machine-readable form of the same failure, so the UI can offer a way out
   *  of the specific problem instead of only describing it. */
  errorCode: string | null;
  /** Set while a link attempt is in flight. */
  busy: boolean;

  init: () => void;
  linkEmail: (email: string) => Promise<boolean>;
  linkProvider: (provider: 'google' | 'apple') => Promise<void>;
  /** Signs in to the account a provider is already attached to, abandoning this
   *  device's anonymous one. The only way out of identity_already_exists. */
  signInExisting: (provider: 'google' | 'apple') => Promise<void>;
  clearError: () => void;
}

function applySession(session: Session | null): Partial<AuthState> {
  if (!session) return { status: 'loading', email: null, pendingEmail: null };
  const user = session.user;

  // Three independent signals rather than trusting is_anonymous alone. The
  // claim lives in the JWT, so it can lag a freshly linked identity until the
  // token is refreshed — and a stale "still anonymous" would keep nagging
  // someone who has just finished signing up, which is the worst moment to
  // get it wrong. A linked provider or a confirmed address is proof enough.
  const hasProvider = (user.identities ?? []).some((i) => i.provider !== 'anonymous');
  const hasConfirmedEmail = Boolean(user.email && user.email_confirmed_at);
  const registered = user.is_anonymous === false || hasProvider || hasConfirmedEmail;

  return {
    status: registered ? 'registered' : 'anonymous',
    email: user.email || null,
    pendingEmail: user.new_email || null,
  };
}

/**
 * Pulls an OAuth failure out of the redirect URL.
 *
 * A failed provider round trip comes back as parameters rather than as a
 * rejected promise — there is no call in flight any more to reject. Left
 * unread it looks like nothing happened at all, so the prompt reopens and the
 * player tries again, forever.
 *
 * Supabase writes them into both the query string and the fragment, so both are
 * checked, and the URL is cleaned afterwards so a refresh doesn't replay it.
 */
function readRedirectError(): { code: string; message: string } | null {
  if (typeof window === 'undefined') return null;

  const fromQuery = new URLSearchParams(window.location.search);
  const fromHash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const source = fromQuery.get('error') || fromQuery.get('error_code') ? fromQuery : fromHash;

  const error = source.get('error');
  const code = source.get('error_code');
  if (!error && !code) return null;

  const description = (source.get('error_description') || '').replace(/\+/g, ' ');
  window.history.replaceState({}, '', window.location.pathname);
  return { code: code || error || 'unknown', message: description || error || '' };
}

/** Supabase speaks English; the player doesn't. */
function translate(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('already') && m.includes('registered')) return 'Ese correo ya tiene cuenta. Inicia sesión con él.';
  if (m.includes('identity') && (m.includes('already') || m.includes('linked')))
    return 'Esa cuenta de Google ya está vinculada a otro perfil de Stonksu.';
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
  errorCode: null,
  busy: false,

  init: () => {
    if (!supabase) return;

    const failure = readRedirectError();
    if (failure) {
      set({ errorCode: failure.code, error: translate(failure.message || failure.code) });
    }

    void supabase.auth.getSession().then(({ data }) => set(applySession(data.session)));

    // Fires when the confirmation link is clicked in another tab, or when an
    // OAuth redirect lands, so the banner disappears without a reload.
    supabase.auth.onAuthStateChange((_event, session) => set(applySession(session)));
  },

  linkEmail: async (email) => {
    if (!supabase) return false;
    set({ busy: true, error: null, errorCode: null });

    // updateUser on an anonymous account attaches the address and sends the
    // confirmation. Until the link is clicked it lives in new_email, so the
    // account stays anonymous and nothing is lost if they never confirm.
    const { error } = await supabase.auth.updateUser(
      { email: email.trim() },
      { emailRedirectTo: `${window.location.origin}/home` }
    );

    if (error) {
      set({ busy: false, error: translate(error.message), errorCode: 'link_failed' });
      return false;
    }
    set({ busy: false, pendingEmail: email.trim() });
    return true;
  },

  linkProvider: async (provider) => {
    if (!supabase) return;
    set({ busy: true, error: null, errorCode: null });

    // linkIdentity, not signInWithOAuth: signing in would abandon the anonymous
    // account and every lesson played on it. Requires "Manual Linking" enabled.
    const { error } = await supabase.auth.linkIdentity({
      provider,
      options: { redirectTo: `${window.location.origin}/home` },
    });

    if (error) set({ busy: false, error: translate(error.message), errorCode: 'link_failed' });
    // On success the browser navigates away, so there is no state to settle.
  },

  signInExisting: async (provider) => {
    if (!supabase) return;
    set({ busy: true, error: null, errorCode: null });

    // signInWithOAuth, not linkIdentity: the point here is to land on the
    // account the provider already belongs to. Whatever this device holds
    // anonymously is left behind, so only call this once the player has been
    // told that in plain words.
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/home` },
    });

    if (error) set({ busy: false, error: translate(error.message), errorCode: 'link_failed' });
  },

  clearError: () => {
    if (get().error || get().errorCode) set({ error: null, errorCode: null });
  },
}));
