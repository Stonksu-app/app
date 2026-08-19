import { Link } from 'react-router-dom';

/* One source of truth for every button in the app. The metrics come from
 * es.duolingo.com: 50px tall, 12px radius, 15px/700 uppercase with 0.8px
 * tracking, sitting on a 4px lip it squashes into when pressed. */

type Variant = 'primary' | 'secondary' | 'danger';
type Size = 'md' | 'sm';

const VARIANTS: Record<Variant, { classes: string; lip: string }> = {
  primary: {
    classes: 'bg-lime-500 hover:enabled:bg-lime-400 text-carbon-900',
    lip: 'var(--color-lime-700)',
  },
  secondary: {
    classes: 'bg-carbon-850 hover:enabled:bg-carbon-800 text-lime-400 border-2 border-carbon-700',
    lip: 'var(--color-carbon-950)',
  },
  danger: {
    classes: 'bg-danger-500 hover:enabled:bg-danger-600 text-white',
    lip: '#8f1d1d',
  },
};

const SIZES: Record<Size, string> = {
  md: 'h-[50px] text-[15px]',
  sm: 'h-[42px] text-[13px]',
};

/** Disabled buttons lose the lip — a button you can't press shouldn't look
 *  like it's standing proud of the surface. */
const DISABLED = 'disabled:bg-carbon-800 disabled:text-carbon-500 disabled:border-carbon-800 disabled:cursor-not-allowed disabled:shadow-none';

function classesFor(variant: Variant, size: Size, fullWidth: boolean, extra: string) {
  return [
    'btn-3d inline-flex items-center justify-center gap-2 rounded-xl font-bold uppercase tracking-[0.8px] text-center',
    SIZES[size],
    VARIANTS[variant].classes,
    DISABLED,
    fullWidth ? 'w-full' : 'px-8',
    extra,
  ].join(' ');
}

interface CommonProps {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = true,
  className = '',
  onClick,
  disabled,
  children,
}: CommonProps & { onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{ ['--btn-lip' as string]: VARIANTS[variant].lip }}
      className={classesFor(variant, size, fullWidth, className)}
    >
      {children}
    </button>
  );
}

/** Answer options are slabs too. Their lip tracks the border colour so the
 * option reads as solid rather than an outline with a shadow stuck under it. */
export function optionLip(correct: boolean, incorrect: boolean) {
  if (correct) return 'var(--color-lime-700)';
  if (incorrect) return 'var(--color-danger-600)';
  return 'var(--color-carbon-950)';
}

export function ButtonLink({
  variant = 'primary',
  size = 'md',
  fullWidth = true,
  className = '',
  to,
  children,
}: CommonProps & { to: string }) {
  return (
    <Link
      to={to}
      style={{ ['--btn-lip' as string]: VARIANTS[variant].lip }}
      className={classesFor(variant, size, fullWidth, className)}
    >
      {children}
    </Link>
  );
}
