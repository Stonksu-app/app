/** Whole days between two YYYY-MM-DD strings. */
export function daysBetween(from: string, to: string): number {
  const a = Date.UTC(+from.slice(0, 4), +from.slice(5, 7) - 1, +from.slice(8, 10));
  const b = Date.UTC(+to.slice(0, 4), +to.slice(5, 7) - 1, +to.slice(8, 10));
  return Math.round((b - a) / 86_400_000);
}

/** A streak survives missed days if the player owns enough protectors to cover
 *  them — one protector per missed day, spent automatically. */
export function computeStreakUpdate(
  lastActiveDate: string | null,
  currentStreak: number,
  protectors: number,
  today: string
): { streak: number; lastActiveDate: string; protectorsUsed: number } {
  if (lastActiveDate === today) {
    return { streak: currentStreak, lastActiveDate: today, protectorsUsed: 0 };
  }
  if (!lastActiveDate) {
    return { streak: 1, lastActiveDate: today, protectorsUsed: 0 };
  }

  const gap = daysBetween(lastActiveDate, today);
  if (gap === 1) {
    return { streak: currentStreak + 1, lastActiveDate: today, protectorsUsed: 0 };
  }

  const missed = gap - 1;
  if (missed > 0 && missed <= protectors) {
    return { streak: currentStreak + 1, lastActiveDate: today, protectorsUsed: missed };
  }
  return { streak: 1, lastActiveDate: today, protectorsUsed: 0 };
}
