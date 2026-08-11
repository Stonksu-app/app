import type { Activity, IntroGame, QuizQuestion } from '../types';
import { chunk, shuffle } from './shuffle';

const BATCH_SIZE = 5;

function nonBatchedActivities(game: IntroGame, gameIndex: number): Activity[] {
  if (game.type === 'sequence') {
    return [
      {
        type: 'sequence' as const,
        id: `sequence-g${gameIndex}`,
        instructions: game.instructions,
        steps: game.steps,
      },
    ];
  }

  if (game.type === 'sentence-builder') {
    return game.rounds.map((round) => ({
      type: 'sentence' as const,
      id: `sentence-g${gameIndex}-${round.id}`,
      instructions: game.instructions,
      round,
    }));
  }

  return [];
}

/** Match-pairs and sort-classify items are pooled across ALL games of that type in the node
 * (not chunked per-game) so a single game's leftover count never produces an undersized,
 * "left behind" batch — batches are always shuffled groups of exactly BATCH_SIZE. */
function batchedActivities(games: IntroGame[]): Activity[] {
  const matchGames = games.filter((g) => g.type === 'match-pairs');
  const classifyGames = games.filter((g) => g.type === 'sort-classify');

  const matchActivities: Activity[] = matchGames.length
    ? chunk(
        shuffle(matchGames.flatMap((g) => g.pairs)),
        BATCH_SIZE
      ).map((pairs, i) => ({
        type: 'match' as const,
        id: `match-b${i}`,
        instructions: matchGames[0].instructions,
        pairs,
      }))
    : [];

  const classifyActivities: Activity[] = classifyGames.length
    ? chunk(
        shuffle(classifyGames.flatMap((g) => g.items)),
        BATCH_SIZE
      ).map((items, i) => ({
        type: 'classify' as const,
        id: `classify-b${i}`,
        instructions: classifyGames[0].instructions,
        bucketALabel: classifyGames[0].bucketALabel,
        bucketBLabel: classifyGames[0].bucketBLabel,
        items,
      }))
    : [];

  return [...matchActivities, ...classifyActivities];
}

/** Interleaves two pools so the rhythm feels organic (sometimes switches right away, sometimes
 * holds for 2-3 in a row) rather than mechanically predictable. Each pick is normally biased
 * toward whichever pool is proportionally "due" (behind its fair share so far), which keeps both
 * pools depleting in sync; if a pool drifts too far off its fair schedule the bias briefly
 * hardens into a certainty so it self-corrects, which is what actually prevents one pool from
 * running dry early and leaving a long unbroken tail of the other. */
function interleave(primary: Activity[], secondary: Activity[]): Activity[] {
  const pools: Record<'a' | 'b', Activity[]> = { a: shuffle(primary), b: shuffle(secondary) };
  const idx: Record<'a' | 'b', number> = { a: 0, b: 0 };
  const len: Record<'a' | 'b', number> = { a: primary.length, b: secondary.length };
  const total = len.a + len.b;
  const hasMore = (p: 'a' | 'b') => idx[p] < len[p];
  const picked: Record<'a' | 'b', number> = { a: 0, b: 0 };

  const JITTER = 0.25;
  const MAX_DRIFT = 1.5;

  const result: Activity[] = [];

  while (hasMore('a') || hasMore('b')) {
    let pick: 'a' | 'b';

    if (!hasMore('a')) {
      pick = 'b';
    } else if (!hasMore('b')) {
      pick = 'a';
    } else {
      const idealA = total === 0 ? 0 : (len.a / total) * (picked.a + picked.b + 1);
      const deficitA = idealA - picked.a;
      const due = deficitA >= 0 ? 'a' : 'b';
      const other = due === 'a' ? 'b' : 'a';
      const effectiveJitter = Math.abs(deficitA) >= MAX_DRIFT ? 0 : JITTER;
      pick = Math.random() < effectiveJitter ? other : due;
    }

    result.push(pools[pick][idx[pick]++]);
    picked[pick]++;
  }

  return result;
}

export function buildActivityStream(baseQuestions: QuizQuestion[], games: IntroGame[] = []): Activity[] {
  const quizPool: Activity[] = baseQuestions.map((q) => ({ type: 'quiz', id: q.id, question: q }));
  const gamePool: Activity[] = [...batchedActivities(games), ...games.flatMap((g, i) => nonBatchedActivities(g, i))];

  return interleave(quizPool, gamePool);
}
