/**
 * The ordering exercises.
 *
 * People were getting stuck on these, and the data is half the reason: an
 * exercise whose steps don't have a single unambiguous order can't be solved
 * by thinking, only by guessing until the app says yes. So the orders are
 * checked for being a clean 1..n, and the lists for being short enough to
 * hold in your head.
 *
 * Run: npm run check -- sequence
 */
import { SKILL_TREE } from '../src/data/lessons';

/** Above this, ordering stops being a memory task and becomes a chore. */
const MAX_STEPS = 6;

let failed = 0;
const check = (name: string, cond: boolean, detail = '') => {
  if (cond) console.log(`  ok  ${name}`);
  else {
    failed++;
    console.log(`FALLA  ${name}${detail ? ` — ${detail}` : ''}`);
  }
};

type Steps = { id: string; label: string; order: number }[];
const sequences: { where: string; instructions: string; steps: Steps }[] = [];

for (const node of SKILL_TREE) {
  for (const game of node.intro?.games ?? []) {
    if (game.type === 'sequence') {
      sequences.push({ where: node.title, instructions: game.instructions, steps: game.steps });
    }
  }
  for (const lesson of node.lessons) {
    for (const q of lesson.questions ?? []) {
      const anyQ = q as unknown as { type?: string; instructions?: string; steps?: Steps };
      if (anyQ.type === 'sequence' && anyQ.steps) {
        sequences.push({ where: node.title, instructions: anyQ.instructions ?? '', steps: anyQ.steps });
      }
    }
  }
}

check(`hay ejercicios de ordenar que comprobar`, sequences.length > 0, `${sequences.length}`);

for (const seq of sequences) {
  const label = `${seq.where}: "${seq.instructions.slice(0, 42)}…"`;
  const orders = seq.steps.map((s) => s.order).sort((a, b) => a - b);
  const esperado = seq.steps.map((_, i) => i + 1);

  check(
    `${label} numera del 1 al ${seq.steps.length} sin saltos ni repetidos`,
    JSON.stringify(orders) === JSON.stringify(esperado),
    orders.join(',')
  );
  check(
    `${label} no pasa de ${MAX_STEPS} pasos`,
    seq.steps.length <= MAX_STEPS,
    `${seq.steps.length} pasos`
  );
  check(
    `${label} no repite ids`,
    new Set(seq.steps.map((s) => s.id)).size === seq.steps.length
  );
  check(
    `${label} no repite textos`,
    new Set(seq.steps.map((s) => s.label)).size === seq.steps.length,
    'dos pasos idénticos no tienen un orden correcto'
  );
  // A step that reads the same either way round is a step you can only get
  // right by luck.
  check(
    `${label} tiene pasos con texto suficiente`,
    seq.steps.every((s) => s.label.trim().length >= 10),
    seq.steps.map((s) => s.label).find((l) => l.trim().length < 10) ?? ''
  );
}

console.log(failed === 0 ? '\nTodo correcto.' : `\n${failed} problema(s).`);
process.exit(failed === 0 ? 0 : 1);
