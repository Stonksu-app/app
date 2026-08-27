/**
 * Structural checks over every topic's content.
 *
 * These are the mistakes that are easy to make by hand and invisible until a
 * player hits them: an answer id that points at nothing, a blank that falls off
 * the end of a sentence, a pool of pairs that doesn't divide into whole batches.
 *
 * Run: npx esbuild scripts/check-content.ts --bundle --platform=node --format=esm
 *        --outfile=.check.mjs && node .check.mjs && rm .check.mjs
 */
import { SKILL_TREE } from '../src/data/lessons';
import { buildStage } from '../src/utils/buildActivityStream';
import { stagesForDifficulty } from '../src/utils/mastery';
import { shuffleUnsolved } from '../src/utils/shuffle';

const BATCH_SIZE = 5;

let failures = 0;
function fail(where: string, msg: string) {
  failures++;
  console.log(`FAIL  ${where} — ${msg}`);
}

function dupes(ids: string[]): string[] {
  const seen = new Set<string>();
  const dup = new Set<string>();
  for (const id of ids) (seen.has(id) ? dup : seen).add(id);
  return [...dup];
}

const nodeIds = SKILL_TREE.map((n) => n.id);
const dupNodes = dupes(nodeIds);
if (dupNodes.length) fail('SKILL_TREE', `duplicate node ids: ${dupNodes.join(', ')}`);

for (const node of SKILL_TREE) {
  const where = node.id;

  // ------------------------------------------------------------ prerequisites
  for (const req of node.requires ?? []) {
    if (!nodeIds.includes(req)) fail(where, `requires "${req}", which doesn't exist`);
  }

  if (node.lessons.length === 0) {
    fail(where, 'has no lessons — the topic is still a stub');
    continue;
  }

  // ------------------------------------------------------------------- quizzes
  const questions = node.lessons.flatMap((l) => l.questions);
  const dupQ = dupes(questions.map((q) => q.id));
  if (dupQ.length) fail(where, `duplicate question ids: ${dupQ.join(', ')}`);

  for (const q of questions) {
    const optIds = q.options.map((o) => o.id);
    if (!optIds.includes(q.correctOptionId)) {
      fail(where, `question "${q.id}" answers "${q.correctOptionId}", not in [${optIds.join(', ')}]`);
    }
    if (dupes(optIds).length) fail(where, `question "${q.id}" has duplicate option ids`);
    if (q.type === 'true-false' && (optIds.length !== 2 || !optIds.includes('true') || !optIds.includes('false'))) {
      fail(where, `question "${q.id}" is true-false but its options are [${optIds.join(', ')}]`);
    }
    if (!q.explanation.trim()) fail(where, `question "${q.id}" has no explanation`);
  }

  // --------------------------------------------------------------------- intro
  const games = node.intro?.games ?? [];
  const cards = node.intro?.flashcards ?? [];
  if (!cards.length) fail(where, 'has no flashcards');
  if (dupes(cards.map((c) => c.id)).length) fail(where, 'duplicate flashcard ids');

  // The orphan-card bug: match and classify items are pooled across the node and
  // then chunked into fixed batches, so a total that isn't a whole number of
  // batches leaves a short, lonely group at the end.
  const pairCount = games.filter((g) => g.type === 'match-pairs').reduce((n, g) => n + (g.type === 'match-pairs' ? g.pairs.length : 0), 0);
  const itemCount = games.filter((g) => g.type === 'sort-classify').reduce((n, g) => n + (g.type === 'sort-classify' ? g.items.length : 0), 0);
  if (pairCount % BATCH_SIZE !== 0) fail(where, `${pairCount} match pairs isn't a whole number of ${BATCH_SIZE}-card batches`);
  if (itemCount % BATCH_SIZE !== 0) fail(where, `${itemCount} classify items isn't a whole number of ${BATCH_SIZE}-item batches`);

  for (const game of games) {
    if (game.type === 'sequence') {
      const orders = game.steps.map((s) => s.order).sort((a, b) => a - b);
      const expected = game.steps.map((_, i) => i + 1);
      if (orders.join(',') !== expected.join(',')) {
        fail(where, `a sequence has orders [${orders.join(', ')}], expected 1..${game.steps.length}`);
      }
      if (dupes(game.steps.map((s) => s.id)).length) fail(where, 'duplicate sequence step ids');

      /*
       * Four steps, no more.
       *
       * Six steps is 720 possible answers, and the ones people actually
       * struggled with were the sequences whose middle steps described the
       * same moment twice — unorderable, because the answer lived in our
       * phrasing rather than in the market. Four leaves 24, and every step
       * has to be a distinct event.
       */
      if (game.steps.length !== 4) {
        fail(where, `a sequence has ${game.steps.length} steps, expected 4`);
      }
      // Two lines on a 375px phone. Longer and the row clips the sentence
      // you're being asked to place.
      for (const step of game.steps) {
        if (step.label.length > 52) {
          fail(where, `a sequence step is ${step.label.length} chars: "${step.label}"`);
        }
      }
    }

    if (game.type === 'sort-classify') {
      const a = game.items.filter((i) => i.bucket === 'a').length;
      const b = game.items.length - a;
      if (a === 0 || b === 0) fail(where, 'a classify game has an empty bucket');
      if (Math.abs(a - b) > 2) fail(where, `classify buckets are lopsided (${a} vs ${b})`);
    }

    if (game.type === 'sentence-builder') {
      for (const r of game.rounds) {
        if (r.blankIndex < 0 || r.blankIndex >= r.chunks.length) {
          fail(where, `round "${r.id}" blanks index ${r.blankIndex} of ${r.chunks.length} chunks`);
        }
        const answer = r.chunks[r.blankIndex];
        if (r.distractors.includes(answer)) {
          fail(where, `round "${r.id}" lists the correct word "${answer}" as a distractor`);
        }
        if (dupes(r.distractors).length) fail(where, `round "${r.id}" has duplicate distractors`);
        if (r.distractors.length < 2) fail(where, `round "${r.id}" has only ${r.distractors.length} distractor(s)`);
      }
    }
  }

  // ------------------------------------------------------- every stage is playable
  const maxStage = stagesForDifficulty(node.difficulty);
  for (let stage = 0; stage < maxStage; stage++) {
    const plan = buildStage(node, questions, stage, maxStage);
    if (plan.activities.length === 0) {
      fail(where, `stage ${stage + 1}/${maxStage} builds an empty lesson`);
      continue;
    }
    if (plan.activities.length < 3) {
      fail(where, `stage ${stage + 1}/${maxStage} is only ${plan.activities.length} activities long`);
    }
    const ids = plan.activities.map((a) => a.id);
    if (dupes(ids).length) fail(where, `stage ${stage + 1} repeats an activity: ${dupes(ids).join(', ')}`);
    if (!plan.isReview && plan.flashcards.length === 0) {
      fail(where, `teaching stage ${stage + 1} introduces no flashcards`);
    }
  }
}

// ------------------------------------------------------------------ summary
console.log('');
for (const node of SKILL_TREE) {
  const questions = node.lessons.flatMap((l) => l.questions);
  const games = node.intro?.games ?? [];
  const maxStage = stagesForDifficulty(node.difficulty);
  const lens = Array.from({ length: maxStage }, (_, s) => buildStage(node, questions, s, maxStage).activities.length);
  console.log(
    `  ${node.id.padEnd(24)} ${String(questions.length).padStart(2)} preguntas  ` +
      `${String(games.length)} juegos  ${maxStage} etapas  actividades por etapa: ${lens.join('-')}`
  );
}

/*
 * The ordering game never opens on the answer.
 *
 * One shuffle in 24 lands solved with four steps, and from the player's side
 * that's indistinguishable from a broken exercise: press check, it's right,
 * learn nothing.
 */
{
  const solved = ['a', 'b', 'c', 'd'];
  let everSolved = false;
  for (let i = 0; i < 2000; i++) {
    const got = shuffleUnsolved(solved, solved);
    if (got.join('') === solved.join('')) everSolved = true;
    if ([...got].sort().join('') !== solved.join('')) {
      fail('sequence', 'a shuffle lost or duplicated a step');
      break;
    }
  }
  if (everSolved) fail('sequence', 'the shuffle handed back the solved order');
  const single = shuffleUnsolved(['solo'], ['solo']);
  if (single.length !== 1) fail('sequence', 'a one-step list should come back untouched');
}

console.log(failures === 0 ? '\nAll content checks passed.\n' : `\n${failures} problem(s) found.\n`);
process.exit(failures === 0 ? 0 : 1);
