import { useEffect, useRef, useState } from 'react';
import { useUserStore } from '../store/useUserStore';

export function useComboFeedback() {
  const { hearts, loseHeart } = useUserStore();
  const [combo, setCombo] = useState(0);
  const [celebration, setCelebration] = useState<1 | 2 | 3 | null>(null);
  const [heartsLost, setHeartsLost] = useState(0);
  const [outOfHearts, setOutOfHearts] = useState(false);
  const [totalCorrect, setTotalCorrect] = useState(0);
  const [totalAttempts, setTotalAttempts] = useState(0);
  const [lastResult, setLastResult] = useState<{ correct: boolean; nonce: number } | null>(null);
  const celebrationTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nonceRef = useRef(0);

  useEffect(() => {
    return () => {
      if (celebrationTimeout.current) clearTimeout(celebrationTimeout.current);
    };
  }, []);

  const registerResult = (correct: boolean) => {
    nonceRef.current += 1;
    setLastResult({ correct, nonce: nonceRef.current });
    setTotalAttempts((n) => n + 1);

    if (correct) {
      setTotalCorrect((n) => n + 1);
      const newCombo = combo + 1;
      setCombo(newCombo);
      if (newCombo % 3 === 0) {
        const tier = Math.min(newCombo / 3, 3) as 1 | 2 | 3;
        setCelebration(tier);
        if (celebrationTimeout.current) clearTimeout(celebrationTimeout.current);
        celebrationTimeout.current = setTimeout(() => setCelebration(null), 1700);
      }
    } else {
      loseHeart();
      setHeartsLost((h) => h + 1);
      setCombo(0);
      if (hearts <= 1) setOutOfHearts(true);
    }
  };

  const shakeClass = celebration === 3 ? 'animate-shake-strong' : celebration === 2 ? 'animate-shake-mild' : '';

  return {
    hearts,
    combo,
    celebration,
    heartsLost,
    outOfHearts,
    registerResult,
    shakeClass,
    totalCorrect,
    totalAttempts,
    lastResult,
  };
}
