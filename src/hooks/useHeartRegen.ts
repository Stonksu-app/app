import { useEffect, useMemo, useState } from 'react';
import { HEART_REGEN_MINUTES, MAX_HEARTS, useUserStore } from '../store/useUserStore';
import { hasUnlimitedHearts } from '../data/plans';

/** Ticks heart regeneration every second and exposes a live countdown to the next heart. */
export function useHeartRegen() {
  const { hearts, lastHeartLostAt, tickHeartRegen, plan } = useUserStore();
  /**
   * Answered here rather than at each screen.
   *
   * Every gate in the app — the lesson entry, the node dialog, the out-of-
   * hearts screen — asks this hook how many hearts there are, so a plan with
   * unlimited hearts answering "full" is what makes them all agree. It also
   * covers a profile that arrived from the cloud with an old number in it.
   */
  const unlimited = hasUnlimitedHearts(plan);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    tickHeartRegen();
    // Piggybacks on this hook's existing second-by-second tick — mounted on
    // TopBar, so it reaches nearly every screen — to catch a streak dying
    // from time alone (a session left open past midnight) without waiting
    // for the next app cold start.
    useUserStore.getState().settleStreak();
    const id = setInterval(() => {
      setNow(Date.now());
      tickHeartRegen();
      useUserStore.getState().settleStreak();
    }, 1000);
    return () => clearInterval(id);
  }, [tickHeartRegen]);

  const msUntilNextHeart = useMemo(() => {
    if (hearts >= MAX_HEARTS || !lastHeartLostAt) return null;
    const regenMs = HEART_REGEN_MINUTES * 60_000;
    const elapsed = now - new Date(lastHeartLostAt).getTime();
    return Math.max(0, regenMs - (elapsed % regenMs));
  }, [hearts, lastHeartLostAt, now]);

  return {
    hearts: unlimited ? MAX_HEARTS : hearts,
    msUntilNextHeart: unlimited ? null : msUntilNextHeart,
    unlimited,
  };
}

export function formatCountdown(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
