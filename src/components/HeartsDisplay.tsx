import { useEffect, useRef, useState } from 'react';
import { MAX_HEARTS } from '../store/useUserStore';
import Icon from './Icon';

export default function HeartsDisplay({ hearts, compact }: { hearts: number; compact?: boolean }) {
  const size = compact ? 16 : 22;
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
