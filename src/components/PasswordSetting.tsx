import { useState } from 'react';
import Icon from './Icon';
import { Button } from './Button';
import PasswordField, { validatePassword } from './PasswordField';
import { useAuthStore } from '../store/useAuthStore';

/**
 * Setting or changing the password, for accounts that have an address.
 *
 * Needed because a password cannot always be set at sign-up: Supabase refuses
 * one on an anonymous account that has no email yet, so depending on the
 * server it can end up deferred. Without somewhere to add it afterwards, you
 * would have an account you can only ever reach through a provider — which is
 * a strange thing to discover when the one thing you wanted was to sign in
 * with your email.
 */
export default function PasswordSetting() {
  const { status, email, passwordDeferred, setPassword, busy, error } = useAuthStore();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [confirm, setConfirm] = useState('');
  const [done, setDone] = useState(false);

  // Nothing to attach a password to until there is a confirmed address.
  if (status !== 'registered' || !email) return null;

  const problem = validatePassword(value, confirm);
  const ready = !!value && value === confirm && !problem;

  const save = async () => {
    if (!ready || busy) return;
    if (await setPassword(value)) {
      setDone(true);
      setValue('');
      setConfirm('');
      setOpen(false);
    }
  };

  return (
    <div className="mt-4 bg-carbon-850 border-2 border-carbon-800 rounded-2xl p-4">
      <div className="flex items-start gap-3">
        <Icon name="lock" size={24} className="text-lime-500 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <h2 className="text-[19px] font-black text-carbon-50">Contraseña</h2>
          <p className="text-sm text-carbon-400 mt-0.5 break-words">
            {done
              ? 'Guardada. Ya puedes entrar con tu correo.'
              : passwordDeferred
              ? 'Aún no tienes contraseña. Ponla y podrás entrar con tu correo.'
              : `Para entrar con ${email} desde otro dispositivo.`}
          </p>
        </div>

        {!open && (
          <button
            onClick={() => setOpen(true)}
            className="shrink-0 text-[13px] font-black uppercase tracking-[0.8px] text-lime-400 hover:text-lime-300"
          >
            {passwordDeferred ? 'Poner' : 'Cambiar'}
          </button>
        )}
      </div>

      {open && (
        <div className="mt-4 space-y-2.5">
          <PasswordField
            value={value}
            onChange={setValue}
            placeholder="Nueva contraseña"
            autoComplete="new-password"
            invalid={!!problem && !!value}
            autoFocus
          />
          <PasswordField
            value={confirm}
            onChange={setConfirm}
            placeholder="Repítela"
            autoComplete="new-password"
            invalid={!!confirm && value !== confirm}
          />

          {problem && value && <p className="text-sm font-bold text-danger-400">{problem}</p>}
          {error && <p className="text-sm font-bold text-danger-400">{error}</p>}

          <div className="flex gap-2">
            <Button onClick={() => void save()} disabled={!ready || busy}>
              {busy ? 'Guardando…' : 'Guardar'}
            </Button>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
