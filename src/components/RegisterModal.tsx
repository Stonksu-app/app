import { useState } from 'react';
import { Button } from './Button';
import Icon from './Icon';
import Avatar from './Avatar';
import { useAuthStore } from '../store/useAuthStore';
import { useUserStore } from '../store/useUserStore';

/* Provider marks. Neither logo exists in the app's icon set, and both are
 * expected to appear as-is on their own sign-in buttons. */

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-3.2-.4-4.7H24v8.9h11.8c-.5 2.8-2 5.1-4.4 6.7v5.5h7.1c4.2-3.8 6.6-9.5 6.6-16.4z" />
      <path fill="#34A853" d="M24 46c6 0 11-2 14.6-5.4l-7.1-5.5c-2 1.3-4.5 2.1-7.5 2.1-5.8 0-10.6-3.9-12.4-9.1H4.3v5.7C7.9 41.1 15.4 46 24 46z" />
      <path fill="#FBBC05" d="M11.6 28.1c-.5-1.3-.7-2.7-.7-4.1s.3-2.8.7-4.1V14H4.3A22 22 0 0 0 2 24c0 3.6.9 6.9 2.3 10l7.3-5.9z" />
      <path fill="#EA4335" d="M24 9.5c3.3 0 6.2 1.1 8.5 3.3l6.3-6.3C35 2.9 30 1 24 1 15.4 1 7.9 5.9 4.3 14l7.3 5.9c1.8-5.2 6.6-9.1 12.4-9.1z" />
    </svg>
  );
}

function AppleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M16.4 12.8c0-2.4 2-3.6 2.1-3.6-1.1-1.7-2.9-1.9-3.5-1.9-1.5-.2-2.9.9-3.6.9s-1.9-.9-3.1-.8c-1.6 0-3.1.9-3.9 2.4-1.7 2.9-.4 7.2 1.2 9.5.8 1.1 1.7 2.4 3 2.4 1.2 0 1.6-.8 3.1-.8s1.9.8 3.1.7c1.3 0 2.1-1.1 2.9-2.3.9-1.3 1.3-2.6 1.3-2.7-.1 0-2.6-1-2.6-3.8zM14 5.4c.7-.8 1.1-1.9 1-3-1 0-2.2.6-2.9 1.4-.6.7-1.2 1.9-1 3 1.1.1 2.2-.6 2.9-1.4z" />
    </svg>
  );
}

/**
 * Sign in with Apple needs a paid Apple Developer Program membership to set up,
 * so the button is hidden until there is one. Everything behind it already
 * works — useAuthStore.linkProvider takes 'apple' — so turning this back on is
 * this one line, plus enabling the provider in Supabase.
 *
 * It becomes mandatory rather than optional the day Stonksu ships on the App
 * Store offering Google, so this is a "not yet", not a "no".
 */
const SHOW_APPLE = false;

/**
 * The "save your progress" gate for anonymous accounts.
 *
 * Deliberately not dismissible into silence: closing it hides this instance,
 * but the nag reopens it on the next move. What it never blocks is the three
 * buttons inside it, since those are the way out.
 */
export default function RegisterModal({ onClose }: { onClose: () => void }) {
  const { linkEmail, linkProvider, error, busy, pendingEmail, clearError } = useAuthStore();
  const { xp, streak, coins } = useUserStore();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || busy) return;
    if (await linkEmail(email)) setSent(true);
  };

  const waitingFor = sent ? email.trim() : pendingEmail;

  return (
    <div className="fixed inset-0 z-[60] bg-carbon-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-carbon-900 border-2 border-carbon-800 rounded-3xl p-6 animate-pop-in max-h-[92dvh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3">
          <Avatar size={64} mood="happy" />
          <button
            onClick={onClose}
            aria-label="Ahora no"
            className="text-carbon-600 hover:text-carbon-300 transition p-1 -mr-1 -mt-1"
          >
            <Icon name="close" size={22} strokeWidth={2.4} />
          </button>
        </div>

        {waitingFor ? (
          <>
            <h2 className="text-2xl font-black text-carbon-50 mt-3">Revisa tu correo</h2>
            <p className="text-sm text-carbon-400 mt-2">
              Hemos enviado un enlace a <span className="font-black text-lime-400">{waitingFor}</span>. Ábrelo para
              confirmar la cuenta — puedes seguir jugando mientras tanto.
            </p>
            <p className="text-xs text-carbon-500 mt-3">
              ¿No llega? Mira en spam, o cierra esto y prueba con otro correo.
            </p>
            <div className="mt-5">
              <Button onClick={onClose} variant="secondary" fullWidth>
                Seguir jugando
              </Button>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-2xl font-black text-carbon-50 mt-3">Guarda tu progreso</h2>
            <p className="text-sm text-carbon-400 mt-2">
              Tu cuenta solo vive en este dispositivo. Si reinstalas la app o cambias de móvil, lo pierdes todo.
            </p>

            {(xp > 0 || streak > 0 || coins > 0) && (
              <div className="flex items-center gap-4 mt-4 bg-carbon-850 border-2 border-carbon-800 rounded-2xl px-4 py-3">
                <span className="flex items-center gap-1.5 font-black text-carbon-50 tabular-nums">
                  <Icon name="star" size={17} className="text-lime-500" />
                  {xp}
                </span>
                <span className="flex items-center gap-1.5 font-black text-carbon-50 tabular-nums">
                  <Icon name="flame" size={17} className={streak > 0 ? 'text-lime-500' : 'text-carbon-600'} />
                  {streak}
                </span>
                <span className="flex items-center gap-1.5 font-black text-carbon-50 tabular-nums">
                  <Icon name="coins" size={17} className="text-lime-500" />
                  {coins}
                </span>
                <span className="ml-auto text-[11px] font-black uppercase tracking-wide text-carbon-500">
                  En juego
                </span>
              </div>
            )}

            <div className="mt-5 space-y-2.5">
              <button
                onClick={() => void linkProvider('google')}
                disabled={busy}
                className="btn-3d w-full h-[50px] rounded-xl bg-white hover:enabled:bg-carbon-100 text-carbon-900 font-bold text-[15px] uppercase tracking-[0.8px] inline-flex items-center justify-center gap-2.5 disabled:opacity-60"
                style={{ ['--btn-lip' as string]: '#b8b8b8' }}
              >
                <GoogleMark />
                Continuar con Google
              </button>

              {SHOW_APPLE && (
                <button
                  onClick={() => void linkProvider('apple')}
                  disabled={busy}
                  className="btn-3d w-full h-[50px] rounded-xl bg-carbon-50 hover:enabled:bg-white text-carbon-950 font-bold text-[15px] uppercase tracking-[0.8px] inline-flex items-center justify-center gap-2.5 disabled:opacity-60"
                  style={{ ['--btn-lip' as string]: '#b8b8b8' }}
                >
                  <AppleMark />
                  Continuar con Apple
                </button>
              )}
            </div>

            <div className="flex items-center gap-3 my-4">
              <span className="h-0.5 flex-1 bg-carbon-800" />
              <span className="text-[11px] font-black uppercase tracking-wide text-carbon-600">o con tu correo</span>
              <span className="h-0.5 flex-1 bg-carbon-800" />
            </div>

            <form onSubmit={submit}>
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  clearError();
                }}
                placeholder="tu@correo.com"
                autoComplete="email"
                required
                className="w-full h-[50px] px-4 rounded-xl bg-carbon-850 border-2 border-carbon-700 focus:border-lime-500 outline-none text-carbon-50 font-bold placeholder:text-carbon-600 placeholder:font-medium"
              />
              <div className="mt-2.5">
                <Button type="submit" disabled={busy || !email.trim()} fullWidth>
                  {busy ? 'Enviando…' : 'Enviarme el enlace'}
                </Button>
              </div>
            </form>

            {error && <p className="mt-3 text-sm font-bold text-danger-400">{error}</p>}

            <button
              onClick={onClose}
              className="mt-4 w-full text-xs font-black uppercase tracking-wide text-carbon-500 hover:text-carbon-300 transition"
            >
              Ahora no
            </button>
          </>
        )}
      </div>
    </div>
  );
}
