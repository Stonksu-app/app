import { useEffect, useRef, useState } from 'react';
import { MAX_HEARTS, useUserStore } from '../store/useUserStore';
import { hasUnlimitedHearts } from '../data/plans';
import Icon from './Icon';

export default function HeartsDisplay({ hearts, compact }: { hearts: number; compact?: boolean }) {
  const size = compact ? 16 : 22;
  // Read here rather than passed in: every caller that forgot the prop would
  // show an Ultra player a row of five hearts they can't spend.
  const unlimited = useUserStore((s) => hasUnlimitedHearts(s.plan));
  const prevHearts = useRef(hearts);
  const [losingIndex, setLosingIndex] = useState<number | null>(null);

  useEffect(() => {
    if (hearts < prevHearts.current) {
      setLosingIndex(hearts);
      const t = setTimeout(() => setLosingIndex(null), 550);
      prevHearts.current = hearts;
      return () => clearTimeout(t);
    }
    prevHearts.current = hearts;
  }, [hearts]);

  /* One heart and an infinity, in Ultra's violet. Five hearts would still be
     counting something, and the whole point is that there's nothing left to
     count — the row also stops being a thing that can visibly go down, which
     is what made it worth looking at in the first place. */
  if (unlimited) {
    return (
      <div className="flex items-center gap-1 shrink-0" aria-label="Vidas infinitas">
        <Icon name="heart" size={size} strokeWidth={2} className="text-ultra-400" />
        <span
          aria-hidden="true"
          className="font-black text-ultra-300 leading-none"
          style={{ fontSize: size + 2 }}
        >
          ∞
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-0.5 sm:gap-1 shrink-0" aria-label={`${hearts} vidas restantes`}>
      {Array.from({ length: MAX_HEARTS }).map((_, i) => (
        <Icon
          key={i}
          name="heart"
          size={size}
          strokeWidth={2}
          className={`${i < hearts ? 'text-lime-500' : 'text-carbon-700'} ${i === losingIndex ? 'animate-heart-lose' : ''}`}
        />
      ))}
    </div>
  );
}
