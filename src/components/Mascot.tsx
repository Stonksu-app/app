import type { EyeStyle, HornStyle, MascotLook } from '../types';

/** The brand look. Every logo usage renders this; only the profile avatar
 *  passes something else. */
export const DEFAULT_LOOK: MascotLook = {
  body: '#C6FF34',
  mask: '#171717',
  horns: 'curvos',
  eyes: 'arco',
};

const HORNS: Record<HornStyle, { left: string; right: string }> = {
  curvos: {
    left: 'M16 16 C11 22 10 30 14 36.5 C17 38 21 38 24 36.5 C19 31 17 23 16 16 Z',
    right: 'M84 16 C89 22 90 30 86 36.5 C83 38 79 38 76 36.5 C81 31 83 23 84 16 Z',
  },
  rectos: {
    left: 'M13 12 L24 36.5 C21 38 17 38 14 36.5 Z',
    right: 'M87 12 L76 36.5 C79 38 83 38 86 36.5 Z',
  },
  cortos: {
    left: 'M20 25 C16 28 15 32 17 36.5 C19 37.6 22 37.6 25 36.5 C22 33 20.5 29 20 25 Z',
    right: 'M80 25 C84 28 85 32 83 36.5 C81 37.6 78 37.6 75 36.5 C78 33 79.5 29 80 25 Z',
  },
};

interface MascotProps {
  size?: number;
  mood?: 'happy' | 'hype' | 'sad' | 'neutral';
  className?: string;
  look?: MascotLook;
}

export default function Mascot({ size = 96, mood = 'happy', className = '', look = DEFAULT_LOOK }: MascotProps) {
  const horns = HORNS[look.horns] ?? HORNS.curvos;

  // Sad always falls back to downturned arcs whatever the chosen eye style,
  // because the feedback has to read as sad more than it has to stay on-style.
  const sad = mood === 'sad';
  const eyeStyle: EyeStyle = sad ? 'arco' : look.eyes;

  const mouthPath = sad ? 'M43 79 Q50 74 57 79' : mood === 'hype' ? 'M43 75 Q50 82 57 75' : null;

  const renderEyes = () => {
    if (eyeStyle === 'puntos') {
      return (
        <>
          <circle cx="38" cy="52.5" r="3.6" fill={look.body} />
          <circle cx="62" cy="52.5" r="3.6" fill={look.body} />
        </>
      );
    }
    if (eyeStyle === 'decididos') {
      return (
        <>
          <path d="M33 49.5 L43 54.5" stroke={look.body} strokeWidth="4.5" strokeLinecap="round" />
          <path d="M67 49.5 L57 54.5" stroke={look.body} strokeWidth="4.5" strokeLinecap="round" />
        </>
      );
    }
    const left = sad ? 'M34 51 Q38 57 42.1 51' : 'M34 55.8 Q38 50 42.1 55.8';
    const right = sad ? 'M57.9 51 Q62 57 66 51' : 'M57.9 55.8 Q62 50 66 55.8';
    return (
      <>
        <path d={left} stroke={look.body} strokeWidth="4.5" fill="none" strokeLinecap="round" />
        <path d={right} stroke={look.body} strokeWidth="4.5" fill="none" strokeLinecap="round" />
      </>
    );
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={`${mood === 'hype' ? 'animate-float' : ''} ${className}`}
      role="img"
      aria-label="Stonksu, el toro mascota"
    >
      <path d={horns.left} fill={look.body} />
      <path d={horns.right} fill={look.body} />
      <path d="M20 47 C15 48 10 51 7.5 55.5 C11 58 16 58.5 21 57.5 Z" fill={look.body} />
      <path d="M80 47 C85 48 90 51 92.5 55.5 C89 58 84 58.5 79 57.5 Z" fill={look.body} />
      <path
        d="M50 24 C64 24 75 29 79.5 37 C82 42 83 47 83 54 C83 72 69 85.5 50 85.5 C31 85.5 17 72 17 54 C17 47 18 42 20.5 37 C25 29 36 24 50 24 Z"
        fill={look.body}
      />
      <rect x="25.5" y="42.3" width="49" height="18.9" rx="9.5" fill={look.mask} />
      {renderEyes()}
      <path d="M45.5 66.5 C46.5 68 48 69.5 49.3 70.3 C48.5 68 47.3 66.6 45.5 66.5 Z" fill={look.mask} />
      <path d="M54.5 66.5 C53.5 68 52 69.5 50.7 70.3 C51.5 68 52.7 66.6 54.5 66.5 Z" fill={look.mask} />
      {mouthPath && <path d={mouthPath} stroke={look.mask} strokeWidth="3" fill="none" strokeLinecap="round" />}
    </svg>
  );
}

export const MASCOT_LINES = {
  correct: [
    '¡To the moon!',
    'Diamond hands, fren',
    '¡Ese sí fue un pip perfecto!',
    'Bullish AF',
    '¡Gg easy!',
  ],
  incorrect: [
    'Ouch, eso fue un rekt',
    'Paper hands momentáneas, no pasa nada',
    'Hasta Warren Buffett falló alguna vez',
    'Stop loss activado, sigue adelante',
  ],
  lessonComplete: [
    '¡Lección cerrada en verde!',
    'Otro nivel para el portafolio de conocimiento',
    '¡Certified degen scholar!',
  ],
  outOfHearts: [
    'Te quedaste sin vidas, fren... margin call',
    'Rekt total. Vuelve en un rato o repasa.',
  ],
  streak: [
    '¡Racha en fuego!',
    'Consistencia > suerte, fren',
  ],
};

export function randomLine(key: keyof typeof MASCOT_LINES): string {
  const lines = MASCOT_LINES[key];
  return lines[Math.floor(Math.random() * lines.length)];
}
