const TIER_COLOR: Record<1 | 2 | 3, string> = {
  1: '#C6FF34',
  2: '#FFC93C',
  3: '#FFFFFF',
};

const TIER_COUNT: Record<1 | 2 | 3, number> = {
  1: 10,
  2: 18,
  3: 28,
};

export default function StreakRays({ tier }: { tier: 1 | 2 | 3 }) {
  const color = TIER_COLOR[tier];
  const count = TIER_COUNT[tier];

  const rays = Array.from({ length: count }).map((_, i) => {
    const angle = -90 + (Math.random() - 0.5) * 170;
    const distance = 46 + Math.random() * 56;
    const length = 14 + Math.random() * 16;
    const width = tier === 3 ? 3 : 2.5;
    const delay = Math.random() * 0.3;

    return (
      <div
        key={i}
        className="absolute left-1/2 top-1/2"
        style={{ transform: `translate(-50%, -50%) rotate(${angle + 90}deg)` }}
      >
        <span
          className="block animate-ray-fly rounded-full"
          style={
            {
              '--dist': `${distance}px`,
              width,
              height: length,
              background: color,
              boxShadow: `0 0 8px ${color}`,
              animationDelay: `${delay}s`,
            } as React.CSSProperties
          }
        />
      </div>
    );
  });

  return (
    <div className="pointer-events-none absolute inset-0 overflow-visible" aria-hidden="true">
      {rays}
    </div>
  );
}
