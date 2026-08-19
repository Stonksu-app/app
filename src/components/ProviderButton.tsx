import type { Provider } from '../lib/providers';

/**
 * One sign-in button, in the provider's own colours.
 *
 * The verb differs between the two places this appears and it matters: from
 * the sign-up prompt you are *attaching* an account to the profile you are
 * already playing, from the sign-in page you are *moving* to a different one.
 */
export default function ProviderButton({
  provider,
  verb,
  disabled,
  onClick,
}: {
  provider: Provider;
  verb: 'Continuar con' | 'Entrar con';
  disabled?: boolean;
  onClick: () => void;
}) {
  const { Mark, label, background, lip, text } = provider;

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{ background, color: text, ['--btn-lip' as string]: lip }}
      className="btn-3d w-full h-[50px] rounded-xl font-bold text-[15px] uppercase tracking-[0.8px] inline-flex items-center justify-center gap-2.5 disabled:opacity-60"
    >
      <Mark />
      {verb} {label}
    </button>
  );
}
