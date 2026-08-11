interface MascotProps {
  size?: number;
  mood?: 'happy' | 'hype' | 'sad' | 'neutral';
  className?: string;
}

export default function Mascot({ size = 96, mood = 'happy', className = '' }: MascotProps) {
  // Sad flips the eye arcs downward; the mouth only appears for the expressive moods
  // so the default state stays identical to the brand logo.
  const leftEye = mood === 'sad' ? 'M34 51 Q38 57 42.1 51' : 'M34 55.8 Q38 50 42.1 55.8';
  const rightEye = mood === 'sad' ? 'M57.9 51 Q62 57 66 51' : 'M57.9 55.8 Q62 50 66 55.8';
  const mouthPath =
    mood === 'sad' ? 'M43 79 Q50 74 57 79' : mood === 'hype' ? 'M43 75 Q50 82 57 75' : null;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={`${mood === 'hype' ? 'animate-float' : ''} ${className}`}
      role="img"
      aria-label="Stonksu, el toro mascota"
    >
      <path d="M16 16 C11 22 10 30 14 36.5 C17 38 21 38 24 36.5 C19 31 17 23 16 16 Z" fill="#C6FF34" />
      <path d="M84 16 C89 22 90 30 86 36.5 C83 38 79 38 76 36.5 C81 31 83 23 84 16 Z" fill="#C6FF34" />
      <path d="M20 47 C15 48 10 51 7.5 55.5 C11 58 16 58.5 21 57.5 Z" fill="#C6FF34" />
      <path d="M80 47 C85 48 90 51 92.5 55.5 C89 58 84 58.5 79 57.5 Z" fill="#C6FF34" />
      <path
        d="M50 24 C64 24 75 29 79.5 37 C82 42 83 47 83 54 C83 72 69 85.5 50 85.5 C31 85.5 17 72 17 54 C17 47 18 42 20.5 37 C25 29 36 24 50 24 Z"
        fill="#C6FF34"
      />
      <rect x="25.5" y="42.3" width="49" height="18.9" rx="9.5" fill="#171717" />
      <path d={leftEye} stroke="#C6FF34" strokeWidth="4.5" fill="none" strokeLinecap="round" />
      <path d={rightEye} stroke="#C6FF34" strokeWidth="4.5" fill="none" strokeLinecap="round" />
      <path d="M45.5 66.5 C46.5 68 48 69.5 49.3 70.3 C48.5 68 47.3 66.6 45.5 66.5 Z" fill="#171717" />
      <path d="M54.5 66.5 C53.5 68 52 69.5 50.7 70.3 C51.5 68 52.7 66.6 54.5 66.5 Z" fill="#171717" />
      {mouthPath && <path d={mouthPath} stroke="#171717" strokeWidth="3" fill="none" strokeLinecap="round" />}
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
