const COLORS = ['#C6FF34', '#D4FF5E', '#E2FF8C', '#F5F5F5', '#91BF1F'];

export default function Confetti({ count = 60 }: { count?: number }) {
  const pieces = Array.from({ length: count }).map((_, i) => {
    const left = Math.random() * 100;
    const delay = Math.random() * 0.6;
    const duration = 2 + Math.random() * 1.5;
    const color = COLORS[i % COLORS.length];
    const size = 6 + Math.random() * 6;
    const rotate = Math.random() * 360;
    return (
      <span
        key={i}
        className="animate-confetti fixed top-0 pointer-events-none"
        style={{
          left: `${left}%`,
          width: size,
          height: size * 0.6,
          background: color,
          animationDelay: `${delay}s`,
          animationDuration: `${duration}s`,
          transform: `rotate(${rotate}deg)`,
          borderRadius: 2,
          zIndex: 100,
        }}
      />
    );
  });
  return <div className="fixed inset-0 overflow-hidden pointer-events-none z-50" aria-hidden="true">{pieces}</div>;
}
