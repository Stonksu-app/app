interface MascotProps {
  size?: number;
  mood?: 'happy' | 'hype' | 'sad' | 'neutral';
  className?: string;
}

export default function Mascot({ size = 96, mood = 'happy', className = '' }: MascotProps) {
  const mouthPath =
    mood === 'sad'
      ? 'M 38 68 Q 50 60 62 68'
      : mood === 'hype'
      ? 'M 36 62 Q 50 80 64 62 Q 50 70 36 62'
      : 'M 36 62 Q 50 74 64 62';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={`${mood === 'hype' ? 'animate-float' : ''} ${className}`}
      role="img"
      aria-label="Stonksu, el toro mascota"
    >
      <ellipse cx="50" cy="58" rx="34" ry="30" fill="#C6FF34" />
      <ellipse cx="27" cy="40" rx="9" ry="9" fill="#C6FF34" />
      <ellipse cx="73" cy="40" rx="9" ry="9" fill="#C6FF34" />
      <path d="M 15 30 Q 25 15 38 28" stroke="#171717" strokeWidth="5" fill="none" strokeLinecap="round" />
      <path d="M 85 30 Q 75 15 62 28" stroke="#171717" strokeWidth="5" fill="none" strokeLinecap="round" />
      <rect x="22" y="46" width="56" height="16" rx="8" fill="#171717" />
      <circle cx="38" cy="54" r="7" fill="#171717" />
      <circle cx="62" cy="54" r="7" fill="#171717" />
      <circle cx="36" cy="52" r="2" fill="#C6FF34" opacity="0.9" />
      <circle cx="60" cy="52" r="2" fill="#C6FF34" opacity="0.9" />
      <path d={mouthPath} stroke="#171717" strokeWidth="3" fill="none" strokeLinecap="round" />
      <circle cx="24" cy="66" r="5" fill="#171717" opacity="0.15" />
      <circle cx="76" cy="66" r="5" fill="#171717" opacity="0.15" />
      <ellipse cx="50" cy="70" rx="6" ry="4" fill="#91BF1F" />
    </svg>
  );
}

export const MASCOT_LINES = {
  correct: [
    '¡To the moon! 🚀',
    'Diamond hands, fren 💎🙌',
    '¡Ese sí fue un pip perfecto!',
    'Bullish AF 📈',
    '¡Gg easy!',
  ],
  incorrect: [
    'Ouch, eso fue un rekt 📉',
    'Paper hands momentáneas, no pasa nada',
    'Hasta Warren Buffett falló alguna vez',
    'Stop loss activado, sigue adelante',
  ],
  lessonComplete: [
    '¡Lección cerrada en verde! 🟢',
    'Otro nivel para el portafolio de conocimiento',
    '¡Certified degen scholar!',
  ],
  outOfHearts: [
    'Te quedaste sin vidas, fren... margin call 😅',
    'Rekt total. Vuelve en un rato o repasa.',
  ],
  streak: [
    '¡Racha en fuego! 🔥',
    'Consistencia > suerte, fren',
  ],
};

export function randomLine(key: keyof typeof MASCOT_LINES): string {
  const lines = MASCOT_LINES[key];
  return lines[Math.floor(Math.random() * lines.length)];
}
