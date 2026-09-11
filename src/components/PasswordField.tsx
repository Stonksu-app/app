import { useState } from 'react';
import Icon from './Icon';

export const PASSWORD_MIN = 8;

/** Null when the pair is usable. */
export function validatePassword(password: string, confirm?: string): string | null {
  if (!password) return null;
  if (password.length < PASSWORD_MIN) return `Al menos ${PASSWORD_MIN} caracteres.`;
  if (confirm !== undefined && confirm && password !== confirm) return 'Las dos contraseñas no coinciden.';
  return null;
}

/**
 * A password input with a reveal toggle.
 *
 * Being able to see what you typed is the difference between a password field
 * and a guessing game, especially on a phone keyboard. The toggle is a button
 * rather than a checkbox so it can sit inside the field without stealing the
 * tap target from the text.
 */
export default function PasswordField({
  value,
  onChange,
  placeholder,
  autoComplete,
  invalid,
  autoFocus,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  /** "current-password" when signing in, "new-password" when choosing one —
   *  it decides whether a password manager offers to fill or to generate. */
  autoComplete: 'current-password' | 'new-password';
  invalid?: boolean;
  autoFocus?: boolean;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        type={visible ? 'text' : 'password'}
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        aria-invalid={invalid}
        className={`w-full h-[50px] pl-4 pr-12 rounded-xl bg-carbon-850 border-2 outline-none text-carbon-50 font-bold placeholder:text-carbon-600 placeholder:font-medium transition-colors ${
          invalid ? 'border-danger-500' : 'border-carbon-700 focus:border-lime-500'
        }`}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        aria-pressed={visible}
        className="absolute right-1 top-1/2 -translate-y-1/2 p-2.5 text-carbon-500 hover:text-carbon-200 transition"
      >
        <Icon name={visible ? 'eye-off' : 'eye'} size={20} />
      </button>
    </div>
  );
}
