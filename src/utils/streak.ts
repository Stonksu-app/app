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

/**
 * The streak the history proves, counting back from today.
 *
 * The streak normally lives in two fields — the number and the last active
 * date — and nothing recomputes it. That's fine until those two are lost or
 * overwritten: a profile arriving from the cloud with no last_active_date, a
 * device syncing an older row, a reset. The number collapses to 1 while the
 * app is still holding every day you played in its lesson history.
 *
 * So: count consecutive days back from today. A run that ends yesterday counts
 * too — the streak is alive, you just haven't practised yet today.
 *
 * @param days  active days as YYYY-MM-DD, in the same UTC domain as lastActiveDate
 */
export function streakFromHistory(days: Iterable<string>, today: string): number {
  const set = new Set(days);
  // Start from today if it's there, otherwise yesterday: anything older means
  // the streak is already broken and there's nothing to prove.
  const yesterday = shiftDay(today, -1);
  let cursor = set.has(today) ? today : set.has(yesterday) ? yesterday : null;
  if (!cursor) return 0;

  let run = 0;
  while (set.has(cursor)) {
    run++;
    cursor = shiftDay(cursor, -1);
  }
  return run;
}

/** YYYY-MM-DD shifted by whole days, in UTC. */
export function shiftDay(day: string, delta: number): string {
  const d = new Date(
    Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10)) + delta * 86_400_000
  );
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(
    d.getUTCDate()
  ).padStart(2, '0')}`;
}
