import { useEffect, useRef, useState } from 'react';
import { useUserStore } from '../store/useUserStore';
import { comboTier, isTierUp, type ComboTier } from '../utils/combo';

export function useComboFeedback() {
  const { hearts, loseHeart } = useUserStore();
  const [combo, setCombo] = useState(0);
  /** Brief, and only when the bar actually changes tier. */
  const [tierUp, setTierUp] = useState(false);
  const [heartsLost, setHeartsLost] = useState(0);
  const [outOfHearts, setOutOfHearts] = useState(false);
  const [totalCorrect, setTotalCorrect] = useState(0);
  const [totalAttempts, setTotalAttempts] = useState(0);
  const [lastResult, setLastResult] = useState<{ correct: boolean; nonce: number } | null>(null);
  const tierUpTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nonceRef = useRef(0);

  useEffect(() => {
    return () => {
      if (tierUpTimeout.current) clearTimeout(tierUpTimeout.current);
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
      if (isTierUp(newCombo)) {
        setTierUp(true);
        if (tierUpTimeout.current) clearTimeout(tierUpTimeout.current);
        tierUpTimeout.current = setTimeout(() => setTierUp(false), 600);
      }
    } else {
      loseHeart();
      setHeartsLost((h) => h + 1);
      setCombo(0);
      setTierUp(false);
      if (hearts <= 1) setOutOfHearts(true);
    }
  };

  // A short nudge on reaching a tier, nothing on the answers between: a screen
  // that shakes on every third answer stops reading as a reward.
  const shakeClass = tierUp ? 'animate-shake-mild' : '';
  const tier: ComboTier = comboTier(combo);

  return {
    hearts,
    combo,
    tier,
    tierUp,
    heartsLost,
    outOfHearts,
    registerResult,
    shakeClass,
    totalCorrect,
    totalAttempts,
    lastResult,
  };
}
