/**
 * The day a moment belongs to, in the player's own timezone.
 *
 * The streak used to be kept in UTC while the calendar drew local days, so a
 * session at half past midnight in Madrid landed on today's square and
 * yesterday's streak. Four squares could be two days. Everything about the
 * streak now speaks this one domain — the one the player is actually living
 * in, because that's the one they count with.
 */
export function localDayKey(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${m}-${d}`;
}

/** Today as a local YYYY-MM-DD. `offsetDays` shifts by whole days. */
export function todayLocal(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return localDayKey(d);
}

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
): {
  streak: number;
  lastActiveDate: string;
  protectorsUsed: number;
  /** Days skipped since the last active one. Reported so a lost streak can
   *  say why it was lost, instead of the number silently becoming 1. */
  missed: number;
} {
  if (lastActiveDate === today) {
    return { streak: currentStreak, lastActiveDate: today, protectorsUsed: 0, missed: 0 };
  }
  if (!lastActiveDate) {
    return { streak: 1, lastActiveDate: today, protectorsUsed: 0, missed: 0 };
  }

  const gap = daysBetween(lastActiveDate, today);
  if (gap === 1) {
    return { streak: currentStreak + 1, lastActiveDate: today, protectorsUsed: 0, missed: 0 };
  }

  /*
   * One protector per missed day, spent as those days go by.
   *
   * They're spent even when they can't cover the whole gap. Holding them back
   * kept them safe, but from the outside it looked like they had never
   * existed: the streak vanished, the protectors sat untouched, and the
   * calendar showed nothing. Now they cover the days they can, those days
   * show frozen, and running out is something you watch happen.
   */
  const missed = gap - 1;
  const protectorsUsed = Math.min(missed, Math.max(0, protectors));

  return {
    streak: protectorsUsed === missed ? currentStreak + 1 : 1,
    lastActiveDate: today,
    protectorsUsed,
    missed,
  };
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

/**
 * Whether today's activity is already in the bag.
 *
 * The flame used to go grey only at zero, so a streak of nine looked
 * identical whether you'd practised today or were about to lose it at
 * midnight. Grey with the number still on it says both things at once: what
 * you have, and that it isn't safe yet.
 */
export function practisedToday(lastActiveDate: string | null): boolean {
  return lastActiveDate === todayLocal();
}

/**
 * The frozen days the streak itself implies.
 *
 * frozenDates is only written at the moment a protector is spent, and it lives
 * on the device — so a restored streak, a reinstall, or a second device all
 * end up with a number that counts days the calendar draws as blank. The
 * calendar then contradicts the number printed right above it, which is
 * exactly how "why aren't my days blue" starts.
 *
 * A streak of N ending on a given day spans those N days by definition. Any
 * of them without activity had to be covered by something, or the streak
 * wouldn't be standing. So the calendar can work them out rather than needing
 * to have witnessed them.
 */
export function inferredFrozenDays(
  streak: number,
  lastActiveDate: string | null,
  activeDays: Set<string>
): string[] {
  if (!lastActiveDate || streak <= 1) return [];
  const out: string[] = [];
  for (let back = 1; back < streak; back++) {
    const day = shiftDay(lastActiveDate, -back);
    if (!activeDays.has(day)) out.push(day);
  }
  return out;
}
