export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

/**
 * A shuffle that never hands back the answer.
 *
 * With four items, one shuffle in 24 lands on the solved order — and the
 * player can't tell that's what happened; the exercise just becomes a button
 * they press. Retries a few times, then falls back to reversing, which is
 * never the answer for more than one item.
 */
export function shuffleUnsolved<T>(items: T[], solved: T[]): T[] {
  if (items.length < 2) return [...items];
  for (let attempt = 0; attempt < 20; attempt++) {
    const candidate = shuffle(items);
    if (candidate.some((item, i) => item !== solved[i])) return candidate;
  }
  return [...solved].reverse();
}
