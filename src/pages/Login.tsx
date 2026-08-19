import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Mascot from '../components/Mascot';
import Icon from '../components/Icon';
import { Button } from '../components/Button';
import PasswordField from '../components/PasswordField';
import { GoogleMark } from '../components/ProviderMarks';
import { useAuthStore } from '../store/useAuthStore';
import { useUserStore } from '../store/useUserStore';

/**
 * Signing in to an account you already have.
 *
 * Distinct from the "save your progress" prompt on purpose: that one attaches
 * an identity to the account you are already playing on, this one moves you to
 * a different account entirely. Anything unsaved on this device is left behind,
 * so it says so rather than letting someone find out afterwards.
 */
export default function Login() {
  const navigate = useNavigate();
  const { signInExisting, signInWithPassword, error, busy, clearError } = useAuthStore();
  const xp = useUserStore((s) => s.xp);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password || busy) return;
    if (await signInWithPassword(email, password)) navigate('/home');
  };

  return (
    <div className="min-h-dvh bg-carbon-900 flex flex-col pt-safe pb-safe">
      <header className="shrink-0 max-w-md w-full mx-auto px-5 pt-4 flex items-center">
        <button
          onClick={() => navigate('/')}
          aria-label="Volver"
          className="text-carbon-500 hover:text-carbon-200 transition p-1 -ml-1"
        >
          <Icon name="chevron-left" size={24} strokeWidth={2.4} />
        </button>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-md w-full mx-auto px-5 py-6">
          <div className="flex flex-col items-center text-center">
            <Mascot size={92} mood="happy" />
            <h1 className="mt-3 text-2xl sm:text-3xl font-black text-carbon-50">Bienvenido de vuelta</h1>
            <p className="text-carbon-400 mt-1">Entra y recupera tu racha donde la dejaste.</p>
          </div>

          {xp > 0 && (
            <p className="mt-5 rounded-2xl border-2 border-[#FFC93C]/40 bg-[#FFC93C]/10 px-4 py-3 text-sm font-bold text-[#FFC93C]">
              Ojo: este dispositivo tiene {xp} XP sin guardar. Si entras en otra cuenta, se quedan aquí.
            </p>
          )}

          <button
            onClick={() => void signInExisting('google')}
            disabled={busy}
            className="btn-3d mt-6 w-full h-[50px] rounded-xl bg-white hover:enabled:bg-carbon-100 text-carbon-900 font-bold text-[15px] uppercase tracking-[0.8px] inline-flex items-center justify-center gap-2.5 disabled:opacity-60"
            style={{ ['--btn-lip' as string]: '#b8b8b8' }}
          >
            <GoogleMark />
            Entrar con Google
          </button>

          <div className="flex items-center gap-3 my-5">
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
              onChange={(v) => {
                setPassword(v);
                clearError();
              }}
              placeholder="Tu contraseña"
              autoComplete="current-password"
              invalid={!!error}
            />
            <Button type="submit" disabled={busy || !email.trim() || !password}>
              {busy ? 'Entrando…' : 'Entrar'}
            </Button>
          </form>

          {error && <p className="mt-3 text-sm font-bold text-danger-400 text-center">{error}</p>}

          <p className="mt-6 text-sm text-carbon-400 text-center">
            ¿Aún no tienes cuenta?{' '}
            <Link to="/onboarding" className="font-black text-lime-400 hover:text-lime-300">
              Empieza a aprender
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
