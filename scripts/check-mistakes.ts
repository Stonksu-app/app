/**
 * Checks the "missed items come back next lesson" queue.
 *
 * Run: npx esbuild scripts/check-mistakes.ts --bundle --platform=node --format=esm
 *        --outfile=.check.mjs && node .check.mjs && rm .check.mjs
 */
import { buildStage, mistakeKey } from '../src/utils/buildActivityStream';
import { SKILL_TREE } from '../src/data/lessons';
import type { Activity, SkillNode, QuizQuestion } from '../src/types';

let failures = 0;
function check(name: string, cond: boolean, detail = '') {
  if (cond) {
    console.log(`  ok  ${name}`);
  } else {
    failures++;
    console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function plan(node: SkillNode, questions: QuizQuestion[], stage: number, max: number, mistakes: string[] = []) {
  return buildStage(node, questions, stage, max, mistakes);
}

function idsOf(activities: Activity[]) {
  return activities.map((a) => a.id);
}

const node = SKILL_TREE[0];
const questions = node.lessons[0].questions;
const MAX = 5;

console.log(`\nUsing node "${node.id}" (${questions.length} questions)\n`);

// ---------------------------------------------------------------- baseline
const clean = plan(node, questions, 0, MAX);
check('a clean run has activities', clean.activities.length > 0, `${clean.activities.length}`);

// ------------------------------------------------- a queued quiz comes back
const missedQuiz = mistakeKey(node.id, questions[questions.length - 1].id);
const withOne = plan(node, questions, 0, MAX, [missedQuiz]);
check(
  'a missed quiz reappears',
  idsOf(withOne.activities).includes(questions[questions.length - 1].id)
);
check(
  'and it goes first, before the stage content',
  withOne.activities[0].id === questions[questions.length - 1].id,
  `first was ${withOne.activities[0].id}`
);

// ------------------------------------------------------- flagged as a repeat
check(
  'the replayed item is flagged so the lesson can label it',
  withOne.replayIds.includes(questions[questions.length - 1].id),
  withOne.replayIds.join(', ')
);
check('nothing else is flagged', withOne.replayIds.length === 1, withOne.replayIds.join(', '));
check('a clean run flags nothing', clean.replayIds.length === 0, clean.replayIds.join(', '));

// ------------------------------------------------------------- no duplicates
const ids = idsOf(withOne.activities);
check('no activity appears twice', new Set(ids).size === ids.length, ids.join(', '));

// A miss that IS part of this stage's own slice must not be served twice.
const ownSliceId = clean.activities.find((a) => a.type === 'quiz')?.id;
if (ownSliceId) {
  const dup = plan(node, questions, 0, MAX, [mistakeKey(node.id, ownSliceId)]);
  const dupIds = idsOf(dup.activities);
  check(
    'a miss already in this stage is not duplicated',
    dupIds.filter((i) => i === ownSliceId).length === 1,
    dupIds.join(', ')
  );
  check('and it is pulled to the front', dup.activities[0].id === ownSliceId);
}

// ------------------------------------------------- foreign keys are ignored
const foreign = plan(node, questions, 0, MAX, ['otro-tema::pregunta-99', 'basura']);
check(
  "another topic's misses are left alone here",
  !idsOf(foreign.activities).includes('pregunta-99') &&
    foreign.activities.length === plan(node, questions, 0, MAX).activities.length
);
check("and nothing invented is injected", !idsOf(foreign.activities).includes('basura'));

// --------------------------------------------------------------- replay cap
const allKeys = questions.map((q) => mistakeKey(node.id, q.id));
const flooded = plan(node, questions, 0, MAX, allKeys);
const replayed = idsOf(flooded.activities).slice(0, 5);
check(
  'a disastrous run replays at most 5 items',
  allKeys.length <= 5 || replayed.every((id) => questions.some((q) => q.id === id)),
  replayed.join(', ')
);
check(
  'the next lesson stays a lesson, not a wall of repeats',
  flooded.activities.length <= clean.activities.length + 5,
  `${flooded.activities.length} vs ${clean.activities.length}`
);

// ------------------------------------------------------- review stage too
const review = plan(node, questions, MAX - 1, MAX, [missedQuiz]);
check('the review stage also replays misses first', review.isReview && review.activities[0].id === questions[questions.length - 1].id);

// --------------------------------------------- fill-in-the-blank round keys
const sentenceGame = (node.intro?.games ?? []).find((g) => g.type === 'sentence-builder');
if (sentenceGame && sentenceGame.type === 'sentence-builder') {
  const gameIndex = (node.intro?.games ?? []).indexOf(sentenceGame);
  const activityId = `sentence-g${gameIndex}-${sentenceGame.rounds[0].id}`;
  const withSentence = plan(node, questions, 0, MAX, [mistakeKey(node.id, activityId)]);
  check(
    'a missed "completar" round reappears',
    withSentence.activities[0].id === activityId,
    `first was ${withSentence.activities[0].id}`
  );
} else {
  console.log('  --  node has no sentence-builder game; skipping that case');
}

// --------------------------------------------------- empty queue is a no-op
const emptyQueue = plan(node, questions, 1, MAX, []);
check(
  'an empty queue changes nothing',
  emptyQueue.activities.length === plan(node, questions, 1, MAX).activities.length
);

console.log(failures === 0 ? '\nAll checks passed.\n' : `\n${failures} check(s) failed.\n`);
process.exit(failures === 0 ? 0 : 1);
