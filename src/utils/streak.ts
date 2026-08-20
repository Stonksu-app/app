/** Whole days between two YYYY-MM-DD strings. */
export function daysBetween(from: string, to: string): number {
  const a = Date.UTC(+from.slice(0, 4), +from.slice(5, 7) - 1, +from.slice(8, 10));
  const b = Date.UTC(+to.slice(0, 4), +to.slice(5, 7) - 1, +to.slice(8, 10));
  return Math.round((b - a) / 86_400_000);
}

/** The calendar dates strictly between two YYYY-MM-DD strings — the days a
 *  streak protector covered when a lesson bridges a gap. Same UTC-day domain
 *  as lastActiveDate, so a protected day lines up with the streak that saved
 *  it rather than a locally-shifted one. */
export function datesBetween(from: string, to: string): string[] {
  const start = Date.UTC(+from.slice(0, 4), +from.slice(5, 7) - 1, +from.slice(8, 10));
  const gap = daysBetween(from, to);
  const dates: string[] = [];
  for (let i = 1; i < gap; i++) {
    const d = new Date(start + i * 86_400_000);
    dates.push(
      `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
    );
  }
  return dates;
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
