import { useEffect, useState } from 'react';

const STEP_MS = 16;

export function useCountUp(target: number, duration = 900): number {
  const [value, setValue] = useState(0);

  useEffect(() => {
    const start = Date.now();

    const interval = setInterval(() => {
      const progress = Math.min((Date.now() - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress >= 1) clearInterval(interval);
    }, STEP_MS);

    return () => clearInterval(interval);
  }, [target, duration]);

  return value;
}
