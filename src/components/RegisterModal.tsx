import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from './Button';
import Icon from './Icon';
import Avatar from './Avatar';
import { useAuthStore } from '../store/useAuthStore';
import { useUserStore } from '../store/useUserStore';
import PasswordField, { validatePassword } from './PasswordField';
import ProviderButton from './ProviderButton';
import { ACTIVE_PROVIDERS } from '../lib/providers';

/**
 * The "save your progress" gate for anonymous accounts.
 *
 * Deliberately not dismissible into silence: closing it hides this instance,
 * but the nag reopens it on the next move. What it never blocks is the three
 * buttons inside it, since those are the way out.
 */
export default function RegisterModal({ onClose }: { onClose: () => void }) {
  const { linkEmail, linkProvider, signInExisting, error, errorCode, busy, pendingEmail, clearError } =
    useAuthStore();
  const { xp, streak, coins } = useUserStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [sent, setSent] = useState(false);

  const passwordError = validatePassword(password, confirm);
  const canSubmit = !!email.trim() && !!password && password === confirm && !passwordError;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || busy) return;
    if (await linkEmail(email, password)) setSent(true);
  };

  // linkEmail clears pendingEmail when the server confirmed the address on the
  // spot — which it does when confirmations are turned off. Reading it back
  // rather than assuming keeps the modal from sending anyone to an inbox that
  // will never receive anything.
  const waitingFor = pendingEmail;
  const finished = sent && !pendingEmail;
  /** That Google account belongs to a Stonksu profile already, so linking can
   *  never work — the only move left is to go to that profile instead. */
  const alreadyTaken = errorCode === 'identity_already_exists';

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

        {finished ? (
          <>
            <h2 className="text-2xl font-black text-carbon-50 mt-3">¡Cuenta guardada!</h2>
            <p className="text-sm text-carbon-400 mt-2">
              Tu progreso ya no depende de este dispositivo. Puedes entrar con{' '}
              <span className="font-black text-lime-400">{email.trim()}</span> desde donde quieras.
            </p>
            <div className="mt-5">
              <Button onClick={onClose} fullWidth>
                Seguir jugando
              </Button>
            </div>
          </>
        ) : waitingFor ? (
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

            {alreadyTaken && (
              <div className="mt-4 rounded-2xl border-2 border-[#FFC93C]/40 bg-[#FFC93C]/10 p-4">
                <p className="text-sm font-bold text-[#FFC93C]">
                  Esa cuenta ya tiene un perfil de Stonksu.
                </p>
                <p className="text-sm text-carbon-300 mt-1.5">
                  Puedes entrar en él, pero el progreso de este dispositivo
                  {xp > 0 ? ` (${xp} XP)` : ''} se quedará aquí: no se puede fusionar con el otro.
                </p>
                <div className="mt-3">
                  <Button size="sm" variant="secondary" onClick={() => void signInExisting('google')} disabled={busy}>
                    Entrar en esa cuenta
                  </Button>
                </div>
              </div>
            )}

            <div className="mt-5 space-y-2.5">
              {ACTIVE_PROVIDERS.map((provider) => (
                <ProviderButton
                  key={provider.id}
                  provider={provider}
                  verb="Continuar con"
                  disabled={busy}
                  onClick={() => void linkProvider(provider.id)}
                />
              ))}
            </div>

            <div className="flex items-center gap-3 my-4">
              <span className="h-0.5 flex-1 bg-carbon-800" />
              <span className="text-[11px] font-black uppercase tracking-wide text-carbon-600">o con tu correo</span>
              <span className="h-0.5 flex-1 bg-carbon-800" />
            </div>

            <form onSubmit={submit} className="space-y-2.5">
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
              <PasswordField
                value={password}
                onChange={setPassword}
                placeholder="Contraseña"
                autoComplete="new-password"
                invalid={!!passwordError && !!password}
              />
              <PasswordField
                value={confirm}
                onChange={setConfirm}
                placeholder="Repite la contraseña"
                autoComplete="new-password"
                invalid={!!confirm && password !== confirm}
              />

              {passwordError && password && (
                <p className="text-sm font-bold text-danger-400">{passwordError}</p>
              )}

              <Button type="submit" disabled={busy || !canSubmit} fullWidth>
                {busy ? 'Creando…' : 'Crear cuenta'}
              </Button>
            </form>

            <p className="mt-4 text-sm text-carbon-400 text-center">
              ¿Ya tienes cuenta?{' '}
              <Link to="/entrar" className="font-black text-lime-400 hover:text-lime-300">
                Inicia sesión
              </Link>
            </p>

            {/* Suppressed when the callout above is already saying it, with a
                button attached. */}
            {error && !alreadyTaken && <p className="mt-3 text-sm font-bold text-danger-400">{error}</p>}

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
