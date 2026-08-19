import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { supabase } from './supabase';

/**
 * Signing in from inside the packaged app.
 *
 * On the web a provider redirect is simply a page navigation. Inside a native
 * shell neither half of that works:
 *
 * - Google refuses OAuth in an embedded web view — `disallowed_useragent` —
 *   so the flow has to open in the real browser, which on Android is a Custom
 *   Tab and on iOS a Safari view controller.
 * - That browser has no way back into the app, so the redirect target is a
 *   custom scheme the system knows belongs to us, and the app listens for it.
 *
 * The tokens arrive in the fragment of that deep link and are handed straight
 * to Supabase, since nothing in the native shell parses a URL it never
 * navigated to.
 */

/** Registered in AndroidManifest.xml and Info.plist. Must match exactly. */
export const NATIVE_SCHEME = 'com.stonksu.app';
const NATIVE_REDIRECT = `${NATIVE_SCHEME}://auth`;

export const isNative = (): boolean => Capacitor.isNativePlatform();

/**
 * Where a provider should send the player back to.
 *
 * Both of these have to be in Supabase's Redirect URLs list, or it quietly
 * substitutes the Site URL and the app never sees the callback.
 */
export function authRedirectUrl(): string {
  return isNative() ? NATIVE_REDIRECT : `${window.location.origin}/home`;
}

/**
 * Runs a provider flow that has already been prepared as a URL.
 *
 * On the web there is nothing to do — the caller lets the page navigate. On a
 * device the URL is opened in the system browser and the session arrives later
 * through the deep link listener below.
 */
export async function openAuthUrl(url: string): Promise<void> {
  if (!isNative()) {
    window.location.href = url;
    return;
  }
  await Browser.open({ url, presentationStyle: 'popover' });
}

/**
 * Starts listening for the callback.
 *
 * Safe to call more than once; only the first listener is registered, because
 * a second would set the session twice for one sign-in.
 */
let listening = false;

export function listenForAuthCallback(): void {
  if (!isNative() || listening || !supabase) return;
  listening = true;

  void App.addListener('appUrlOpen', async ({ url }) => {
    if (!url.startsWith(NATIVE_SCHEME)) return;

    // The browser sheet stays over the app otherwise, hiding the very screen
    // the player is being returned to.
    await Browser.close().catch(() => undefined);

    const fragment = new URLSearchParams(url.split('#')[1] ?? '');
    const query = new URLSearchParams(url.split('?')[1]?.split('#')[0] ?? '');

    const accessToken = fragment.get('access_token');
    const refreshToken = fragment.get('refresh_token');
    if (accessToken && refreshToken) {
      await supabase!.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
      return;
    }

    // PKCE hands back a code instead of tokens.
    const code = query.get('code') ?? fragment.get('code');
    if (code) {
      await supabase!.auth.exchangeCodeForSession(code);
      return;
    }

    // Nothing usable: an error came back instead. Left on the URL for the
    // store's own reader to translate rather than swallowed here.
    const error = fragment.get('error_description') ?? query.get('error_description');
    if (error) console.warn('[auth] provider returned an error:', error.replace(/\+/g, ' '));
  });
}
