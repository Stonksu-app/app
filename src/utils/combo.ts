/*
 * The answer streak inside a lesson, and what it does to the progress bar.
 *
 * Replaces a full-screen banner that announced each milestone. The banner was
 * unmissable, which sounds like praise until you're on a phone: it covered the
 * question, arrived while you were reading, and had to be waited out three
 * times a lesson. Duolingo puts this in the bar you're already watching — the
 * colour tells you you're on a run without taking the screen to say it.
 */

/** Correct answers in a row needed for each tier. */
export const COMBO_STEP = 3;
/** Tiers above normal. Two, so the bar means something at 3 and again at 6;
 *  a third step would arrive so rarely in a short lesson that most players
 *  would never see it. */
export const COMBO_MAX_TIER = 2;

export type ComboTier = 0 | 1 | 2;

export function comboTier(streak: number): ComboTier {
  if (streak < COMBO_STEP) return 0;
  return Math.min(Math.floor(streak / COMBO_STEP), COMBO_MAX_TIER) as ComboTier;
}

/** True when this answer is the one that lifts the bar to a new tier — the
 *  moment worth a small flourish, rather than every correct answer. */
export function isTierUp(streak: number): boolean {
  return streak > 0 && streak % COMBO_STEP === 0 && comboTier(streak) !== comboTier(streak - 1);
}
