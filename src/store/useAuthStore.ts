import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import { isCloudEnabled, supabase } from '../lib/supabase';
import type { ProviderId } from '../lib/providers';
import { authRedirectUrl, isNative, listenForAuthCallback, openAuthUrl } from '../lib/nativeAuth';

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
  /** True when the address went up but the server refused the password, so
   *  it still has to be set once the email is confirmed. */
  passwordDeferred: boolean;
  /** Set while a link attempt is in flight. */
  busy: boolean;

  init: () => void;
  linkEmail: (email: string, password?: string) => Promise<boolean>;
  signInWithPassword: (email: string, password: string) => Promise<boolean>;
  setPassword: (password: string) => Promise<boolean>;
  linkProvider: (provider: ProviderId) => Promise<void>;
  /** Signs in to the account a provider is already attached to, abandoning this
   *  device's anonymous one. The only way out of identity_already_exists. */
  signInExisting: (provider: ProviderId) => Promise<void>;
  clearError: () => void;
}

// Three independent signals rather than trusting is_anonymous alone. The
// claim lives in the JWT, so it can lag a freshly linked identity until the
// token is refreshed — and a stale "still anonymous" would keep nagging
// someone who has just finished signing up, which is the worst moment to
// get it wrong. A linked provider or a confirmed address is proof enough.
function applyUser(user: User): Partial<AuthState> {
  const hasProvider = (user.identities ?? []).some((i) => i.provider !== 'anonymous');
  const hasConfirmedEmail = Boolean(user.email && user.email_confirmed_at);
  const registered = user.is_anonymous === false || hasProvider || hasConfirmedEmail;

  return {
    status: registered ? 'registered' : 'anonymous',
    email: user.email || null,
    pendingEmail: user.new_email || null,
  };
}

function applySession(session: Session | null): Partial<AuthState> {
  if (!session) return { status: 'loading', email: null, pendingEmail: null };
  return applyUser(session.user);
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
    return 'Esa cuenta ya está vinculada a otro perfil de Stonksu.';
  if (m.includes('invalid login credentials')) return 'Correo o contraseña incorrectos.';
  if (m.includes('email not confirmed')) return 'Aún no has confirmado ese correo. Mira tu bandeja.';
  if (m.includes('password') && m.includes('should be at least')) return 'La contraseña es demasiado corta.';
  if (m.includes('invalid') && m.includes('email')) return 'Ese correo no parece válido.';
  // The server refused to send. Naming the likely cause matters here: the raw
  // message says only "error sending email", and the answer is almost always
  // in the SMTP settings rather than anything the player did.
  if (m.includes('error sending') || m.includes('smtp'))
    return 'No pudimos enviar el correo. Es un problema de configuración nuestro, no tuyo — prueba con Google mientras tanto.';
  if (m.includes('rate limit') || m.includes('too many')) return 'Demasiados intentos. Espera un momento y vuelve a probar.';
  if (m.includes('manual linking')) return 'Falta activar "Manual Linking" en Supabase (ver supabase/README.md).';
  if (m.includes('provider') && m.includes('not enabled')) return 'Ese proveedor aún no está activado en Supabase.';
  return message;
}

/** Guards against a second subscription; effects run twice in development. */
let initialised = false;

export const useAuthStore = create<AuthState>()((set, get) => ({
  status: isCloudEnabled ? 'loading' : 'off',
  email: null,
  pendingEmail: null,
  error: null,
  errorCode: null,
  passwordDeferred: false,
  busy: false,

  init: () => {
    if (!supabase || initialised) return;
    // Subscribing twice would double every state change, and React runs effects
    // twice in development.
    initialised = true;

    // On a device the provider comes back through a custom scheme rather than
    // a page load, so the session has to be picked up from that deep link.
    listenForAuthCallback();

    const failure = readRedirectError();
    if (failure) {
      set({ errorCode: failure.code, error: translate(failure.message || failure.code) });
    }

    /*
     * The confirmation link is clicked on a phone; this tab never touches it.
     *
     * onAuthStateChange below only fires from something happening in *this*
     * browser session, so confirming the address on another device changes
     * the row in auth.users without this tab having any reason to know —
     * the "confirma tu correo" banner stayed up even across a reload, since
     * getSession() reads the session cached at sign-up time rather than
     * asking anything. getUser() always asks the server, so it's the one
     * call that can actually notice. Only worth making while there's a
     * confirmation to wait for, and run on whatever might mean it's worth
     * checking again — a cold start (including the reload someone tries
     * exactly because they expect it to have changed), regaining focus,
     * becoming visible again, or (since none of those fire when the tab was
     * never left, only switched away from at the OS level and back) a slow
     * poll that stops once resolved.
     */
    const recheckUser = () => {
      if (!supabase || get().status === 'registered' || !get().pendingEmail) return;
      void supabase.auth.getUser().then(({ data, error }) => {
        if (!error && data.user) set(applyUser(data.user));
      });
    };

    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) set(applySession(data.session));
      recheckUser();
    });

    // Fires when the confirmation link is clicked in another tab, or when an
    // OAuth redirect lands, so the banner disappears without a reload.
    supabase.auth.onAuthStateChange((event, session) => {
      // Subscribing emits an immediate INITIAL_SESSION, and it can carry null
      // while the session is still being restored from storage. Applying that
      // would overwrite the correct answer getSession just gave us and leave
      // the app stuck on "loading" — with a perfectly good session sitting
      // right there. Only an actual sign-out means "no session".
      if (!session && event !== 'SIGNED_OUT') return;
      set(applySession(session));
    });

    window.addEventListener('focus', recheckUser);
    document.addEventListener('visibilitychange', recheckUser);
    const pollId = setInterval(() => {
      if (get().status === 'registered') {
        clearInterval(pollId);
        return;
      }
      recheckUser();
    }, 20_000);
  },

  /**
   * Attaches an email — and a password when one is offered — to the account
   * currently being played.
   *
   * Supabase refuses to set a password on an anonymous account that has no
   * address yet: "Updating password of an anonymous user without an email or
   * phone is not allowed". Whether it accepts both in a single call depends on
   * the server, so both are sent together and the password is quietly dropped
   * if that is what's rejected. The address is what actually rescues the
   * account; a password can always be added afterwards from the profile.
   */
  linkEmail: async (email, password) => {
    if (!supabase) return false;
    set({ busy: true, error: null, errorCode: null });

    const address = email.trim();
    const redirect = { emailRedirectTo: `${window.location.origin}/home` };

    let { data, error } = await supabase.auth.updateUser(
      password ? { email: address, password } : { email: address },
      redirect
    );

    // Retry without it rather than losing the whole sign-up over a password
    // the server won't take yet.
    if (error && password && /anonymous user|password/i.test(error.message)) {
      ({ data, error } = await supabase.auth.updateUser({ email: address }, redirect));
      if (!error) {
        set({ busy: false, pendingEmail: address, passwordDeferred: true });
        return true;
      }
    }

    if (error) {
      set({ busy: false, error: translate(error.message), errorCode: 'link_failed' });
      return false;
    }

    // With confirmations turned off, Supabase applies the address on the spot
    // and sends nothing. Telling someone to go and check an inbox that will
    // stay empty is its own small betrayal, so this reads what the server
    // actually did rather than assuming a mail is on its way.
    const user = data?.user;
    const confirmed = Boolean(user?.email === address && user?.email_confirmed_at);

    set({
      busy: false,
      pendingEmail: confirmed ? null : address,
      passwordDeferred: false,
      // The account is already permanent, so the nag must stop immediately.
      ...(confirmed ? { status: 'registered' as const, email: address } : {}),
    });
    return true;
  },

  /** Sets or replaces the password once an address is confirmed. */
  setPassword: async (password) => {
    if (!supabase) return false;
    set({ busy: true, error: null, errorCode: null });

    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      set({ busy: false, error: translate(error.message), errorCode: 'password_failed' });
      return false;
    }
    set({ busy: false, passwordDeferred: false });
    return true;
  },

  linkProvider: async (provider) => {
    if (!supabase) return;
    set({ busy: true, error: null, errorCode: null });

    // linkIdentity, not signInWithOAuth: signing in would abandon the anonymous
    // account and every lesson played on it. Requires "Manual Linking" enabled.
    const { data, error } = await supabase.auth.linkIdentity({
      provider,
      options: { redirectTo: authRedirectUrl(), skipBrowserRedirect: isNative() },
    });

    if (error) {
      set({ busy: false, error: translate(error.message), errorCode: 'link_failed' });
      return;
    }

    // On the web the page has already navigated away and there is no state to
    // settle. On a device nothing has happened yet: the URL has to be opened
    // in the real browser, because Google rejects OAuth inside a web view.
    if (isNative() && data?.url) await openAuthUrl(data.url);
    set({ busy: false });
  },

  signInWithPassword: async (email, password) => {
    if (!supabase) return false;
    set({ busy: true, error: null, errorCode: null });

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      set({ busy: false, error: translate(error.message), errorCode: 'sign_in_failed' });
      return false;
    }
    set({ busy: false });
    return true;
  },

  signInExisting: async (provider) => {
    if (!supabase) return;
    set({ busy: true, error: null, errorCode: null });

    // signInWithOAuth, not linkIdentity: the point here is to land on the
    // account the provider already belongs to. Whatever this device holds
    // anonymously is left behind, so only call this once the player has been
    // told that in plain words.
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: authRedirectUrl(), skipBrowserRedirect: isNative() },
    });

    if (error) {
      set({ busy: false, error: translate(error.message), errorCode: 'link_failed' });
      return;
    }

    if (isNative() && data?.url) await openAuthUrl(data.url);
    set({ busy: false });
  },

  clearError: () => {
    if (get().error || get().errorCode) set({ error: null, errorCode: null });
  },
}));
