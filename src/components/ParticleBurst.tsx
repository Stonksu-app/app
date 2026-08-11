interface ParticleBurstProps {
  show: boolean;
  count?: number;
  colorClass?: string;
}

export default function ParticleBurst({ show, count = 12, colorClass = 'bg-lime-400' }: ParticleBurstProps) {
  if (!show) return null;

  const particles = Array.from({ length: count }).map((_, i) => {
    const angle = (i / count) * 360 + Math.random() * 20;
    const distance = 36 + Math.random() * 28;
    const dx = Math.cos((angle * Math.PI) / 180) * distance;
    const dy = Math.sin((angle * Math.PI) / 180) * distance;
    const size = 4 + Math.random() * 4;
    const delay = Math.random() * 0.08;
    return (
      <span
        key={i}
        className={`absolute left-1/2 top-1/2 rounded-full ${colorClass} animate-particle`}
        style={
          {
            width: size,
            height: size,
            '--dx': `${dx}px`,
            '--dy': `${dy}px`,
            animationDelay: `${delay}s`,
          } as React.CSSProperties
        }
      />
    );
  });

  return (
    <div className="pointer-events-none absolute inset-0 overflow-visible" aria-hidden="true">
      {particles}
    </div>
  );
}
