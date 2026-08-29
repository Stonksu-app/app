import type { Activity, Flashcard, IntroGame, QuizQuestion, SkillNode } from '../types';
import { chunk, shuffle } from './shuffle';

const BATCH_SIZE = 5;

/** How much a single stage serves up. Short on purpose: a topic is covered
 *  across several stages rather than repeated whole every time. */
const TARGET_QUIZ = 4;
const TARGET_GAMES = 3;
/** The review pulls from everything, so it earns a little more length. */
const REVIEW_QUIZ = 5;
const REVIEW_GAMES = 4;

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

/** Contiguous, balanced split — contiguous so each group keeps the thematic
 *  ordering the content was authored in, balanced so no group is left tiny. */
function splitInto<T>(arr: T[], groups: number): T[][] {
  if (groups <= 1) return [arr];
  const out: T[][] = [];
  const base = Math.floor(arr.length / groups);
  let extra = arr.length % groups;
  let at = 0;
  for (let g = 0; g < groups; g++) {
    const take = base + (extra > 0 ? 1 : 0);
    if (extra > 0) extra--;
    out.push(arr.slice(at, at + take));
    at += take;
  }
  return out;
}

/** An even spread across the whole array rather than the first n, so a review
 *  touches every part of the topic instead of only its opening. */
function spread<T>(arr: T[], n: number): T[] {
  if (arr.length <= n) return [...arr];
  const step = arr.length / n;
  return Array.from({ length: n }, (_, i) => arr[Math.floor(i * step)]);
}

/** Namespaced by node so two topics can't collide on a shared question id, and
 *  so a stage only ever replays mistakes it actually knows how to rebuild. */
export function mistakeKey(nodeId: string, activityId: string): string {
  return `${nodeId}::${activityId}`;
}

/** Enough to make the misses sting, few enough that a bad run doesn't turn the
 *  next lesson into a wall of repeats. */
const MAX_REPLAY = 5;

export interface StagePlan {
  title: string;
  isReview: boolean;
  activities: Activity[];
  /** Ids pulled in from an earlier miss, so the lesson can flag them as repeats
   *  instead of letting them look like new material. */
  replayIds: string[];
  /** Ids pulled in from a *different, already-completed* lesson elsewhere in
   *  the tree, so the lesson can flag them as a memory refresher rather than
   *  new material for the current topic. */
  reviewIds: string[];
  /** Only the terms this stage introduces, so the intro stays short too. */
  flashcards: Flashcard[];
  /** This stage's terms explained in context, not as isolated definitions.
   *  Empty on a review stage — see NodeIntro.explanations. */
  explanation: string;
}

/**
 * Builds the run for one stage of a topic.
 *
 * Stages before the last each teach a different slice of the topic; the last
 * one reviews the whole thing. Replaying the same full lesson every stage is
 * what made mastery a grind.
 *
 * Anything missed in an earlier run comes back at the very front, before this
 * stage's own content — that's the point of dropping the in-place retry.
 *
 * @param stage 0-based index of the stage about to be played.
 * @param pendingMistakes keys from the store; ones belonging to other nodes are ignored here.
 * @param reviewPool questions from other, already-completed lessons; one is
 *   dropped in at random to keep older material from fading, Duolingo-style.
 */
export function buildStage(
  node: SkillNode,
  questions: QuizQuestion[],
  stage: number,
  maxStage: number,
  pendingMistakes: string[] = [],
  reviewPool: QuizQuestion[] = []
): StagePlan {
  const games = node.intro?.games ?? [];
  const cards = node.intro?.flashcards ?? [];

  const quizPool: Activity[] = questions.map((q) => ({ type: 'quiz', id: q.id, question: q }));
  const gamePool: Activity[] = [
    ...batchedActivities(games),
    ...games.flatMap((g, i) => nonBatchedActivities(g, i)),
  ];

  // Only single-answer activities can be pinned to one specific miss; a pooled
  // match/classify batch is graded item by item, so it isn't replayable as a unit.
  const replayable = new Map<string, Activity>();
  for (const a of quizPool) replayable.set(mistakeKey(node.id, a.id), a);
  for (const a of gamePool) if (a.type === 'sentence') replayable.set(mistakeKey(node.id, a.id), a);

  const replay = pendingMistakes
    .map((key) => replayable.get(key))
    .filter((a): a is Activity => a !== undefined)
    .slice(0, MAX_REPLAY);
  const replayIds = new Set(replay.map((a) => a.id));
  /** Keeps a replayed item from also showing up again inside the stage itself. */
  const withReplay = (rest: Activity[]) => [...replay, ...rest.filter((a) => !replayIds.has(a.id))];

  // One question from a different, already-completed lesson, dropped at a
  // random spot rather than pinned to an end — a review that only ever shows
  // up last would be easy to tune out as "the wrap-up question".
  const reviewQuestion = reviewPool.length ? reviewPool[Math.floor(Math.random() * reviewPool.length)] : null;
  const reviewIds = reviewQuestion ? [`review-${reviewQuestion.id}`] : [];
  const withReview = (rest: Activity[]) => {
    if (!reviewQuestion) return rest;
    const activity: Activity = { type: 'quiz', id: `review-${reviewQuestion.id}`, question: reviewQuestion };
    const at = Math.floor(Math.random() * (rest.length + 1));
    return [...rest.slice(0, at), activity, ...rest.slice(at)];
  };

  const teachingStages = Math.max(1, maxStage - 1);
  const isReview = stage >= teachingStages;

  if (isReview) {
    return {
      title: 'Repaso',
      isReview: true,
      activities: withReview(withReplay(interleave(spread(quizPool, REVIEW_QUIZ), spread(gamePool, REVIEW_GAMES)))),
      replayIds: [...replayIds],
      reviewIds,
      flashcards: [],
      explanation: '',
    };
  }

  const quizSlice = splitInto(quizPool, teachingStages)[stage] ?? [];
  const gameSlice = splitInto(gamePool, teachingStages)[stage] ?? [];
  const cardSlice = splitInto(cards, teachingStages)[stage] ?? [];

  const named = cardSlice.slice(0, 2).map((c) => c.term);
  const title = named.length ? named.join(' y ') : `Parte ${stage + 1}`;

  return {
    title,
    isReview: false,
    activities: withReview(withReplay(interleave(quizSlice.slice(0, TARGET_QUIZ), gameSlice.slice(0, TARGET_GAMES)))),
    replayIds: [...replayIds],
    reviewIds,
    flashcards: cardSlice,
    explanation: node.intro?.explanations?.[stage] ?? '',
  };
}
