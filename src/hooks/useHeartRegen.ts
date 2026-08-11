import { useEffect, useMemo, useState } from 'react';
import { HEART_REGEN_MINUTES, MAX_HEARTS, useUserStore } from '../store/useUserStore';

/** Ticks heart regeneration every second and exposes a live countdown to the next heart. */
export function useHeartRegen() {
  const { hearts, lastHeartLostAt, tickHeartRegen } = useUserStore();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    tickHeartRegen();
    const id = setInterval(() => {
      setNow(Date.now());
      tickHeartRegen();
    }, 1000);
    return () => clearInterval(id);
  }, [tickHeartRegen]);

  const msUntilNextHeart = useMemo(() => {
    if (hearts >= MAX_HEARTS || !lastHeartLostAt) return null;
    const regenMs = HEART_REGEN_MINUTES * 60_000;
    const elapsed = now - new Date(lastHeartLostAt).getTime();
    return Math.max(0, regenMs - (elapsed % regenMs));
  }, [hearts, lastHeartLostAt, now]);

  return { hearts, msUntilNextHeart };
}

export function formatCountdown(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
