/**
 * A lesson always pays, however many you've already done today.
 *
 * The bug this exists to catch shipped and survived: the daily-mission
 * counters were rolled by a helper that returned the *whole state* when the
 * date already matched, and every caller spread that into set() after the
 * fields it had just computed. The second lesson of a day therefore wrote a
 * snapshot of the state from before it over its own results — no XP, no
 * coins, no stage, the attempt never recorded. The first lesson of the day
 * worked, which is what made it look like "replaying doesn't advance".
 *
 * So: play the same lesson repeatedly and insist the numbers keep moving.
 *
 * Run: npm run check -- progress
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { useUserStore } from '../src/store/useUserStore';
import { SKILL_TREE } from '../src/data/lessons';
import { stagesForDifficulty } from '../src/utils/mastery';

let failed = 0;
const check = (name: string, cond: boolean, detail = '') => {
  if (cond) console.log(`  ok  ${name}`);
  else {
    failed++;
    console.log(`FALLA  ${name}${detail ? ` — ${detail}` : ''}`);
  }
};

const node = SKILL_TREE.find((n) => n.lessons.length > 0)!;
const lesson = node.lessons[0];
const maxStage = stagesForDifficulty(node.difficulty);

const play = (n: number) =>
  useUserStore.getState().completeLesson({
    lessonId: lesson.id,
    nodeId: node.id,
    completedAt: new Date(Date.now() + n * 1000).toISOString(),
    xpEarned: 10,
    correctCount: 5,
    totalQuestions: 5,
  });

useUserStore.setState({
  nodeStageProgress: {},
  completedLessonIds: [],
  attempts: [],
  xp: 0,
  coins: 0,
  weeklyXp: 0,
  streak: 0,
  lastActiveDate: null,
  dailyStatsDate: null,
  dailyXp: 0,
  dailyLessons: 0,
});

play(1);
const first = useUserStore.getState();
check('la primera lección del día sube la etapa', first.getNodeStage(node.id) === 1);
check('y paga XP', first.xp === 10, `${first.xp}`);

play(2);
const second = useUserStore.getState();
check(
  'la segunda del mismo día también sube la etapa',
  second.getNodeStage(node.id) === 2,
  `quedó en ${second.getNodeStage(node.id)}`
);
check('y también paga XP', second.xp === 20, `${second.xp}`);
check('y guarda el intento', second.attempts.length === 2, `${second.attempts.length}`);
check('y suma al XP semanal', second.weeklyXp === 20, `${second.weeklyXp}`);
check('y cuenta para las misiones diarias', second.dailyLessons === 2, `${second.dailyLessons}`);

// Right up to platinum, since that's the whole point of replaying a lesson.
for (let i = 3; i <= maxStage + 2; i++) play(i);
const last = useUserStore.getState();
check(
  `repetir la misma lección llega a platino (${maxStage}/${maxStage})`,
  last.getNodeStage(node.id) === maxStage,
  `quedó en ${last.getNodeStage(node.id)}`
);
check('y no lo pasa', last.isNodePlatinum(node.id));
check(
  'una lección repetida no se cuenta dos veces como completada',
  last.completedLessonIds.filter((id) => id === lesson.id).length === 1
);

// The shape of the bug, not just its symptom: the daily roll must never hand
// back anything but the day's own counters, or the next caller's spread will
// quietly undo whatever it was setting.
const source = readFileSync('src/store/useUserStore.ts', 'utf8');
check(
  'el contador diario nunca devuelve el estado entero',
  !/if \(s\.dailyStatsDate === today\) return s\b/.test(source),
  'volvería a pisar todo lo que el set calculó antes del spread'
);

/*
 * No shortcut anywhere can move the streak by hand.
 *
 * There was a dev button that rewound the last active day, so tapping it and
 * playing a lesson added a day without one passing. It was gated on the dev
 * environment rather than on test mode, so everyone testing on dev had it —
 * and a streak built that way syncs, then shows on other people's profiles as
 * a number their calendar cannot account for. It's gone; this keeps it gone,
 * and keeps the next one from arriving quietly.
 */
const sourceFiles = readdirSync('src/pages')
  .filter((f) => f.endsWith('.tsx'))
  .map((f) => readFileSync(join('src/pages', f), 'utf8'))
  .concat(readFileSync('src/store/useUserStore.ts', 'utf8'));
check(
  'ningun atajo rebobina el ultimo dia activo',
  !sourceFiles.some((f) => /debugRewind|Simular un día sin practicar/.test(f)),
  'un boton que reescribe la racha acaba en la pantalla de otra persona'
);

/*
 * A lesson records the day it happened, not just its timestamp.
 *
 * The timestamp is UTC and the streak counts local days, so anything
 * rebuilding the calendar from outside the device — a friend's profile — had
 * to guess, and guessed wrong for anything played after midnight. The result
 * was a streak of three over a calendar showing one day, which is how the
 * number stops being believed.
 */
useUserStore.setState({ activeDates: [], reviewDates: [] });
play(99);
const today = new Date();
const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(
  today.getDate()
).padStart(2, '0')}`;
check(
  'una lección deja escrito su día local',
  useUserStore.getState().activeDates.includes(todayKey),
  `quedó ${JSON.stringify(useUserStore.getState().activeDates)}`
);
play(100);
check(
  'dos el mismo día son un solo día en el calendario',
  useUserStore.getState().activeDates.filter((d) => d === todayKey).length === 1
);
useUserStore.getState().completeReview();
check(
  'y un repaso cuenta igual',
  useUserStore.getState().activeDates.includes(todayKey)
);

console.log(failed === 0 ? '\nTodo correcto.' : `\n${failed} problema(s).`);
process.exit(failed === 0 ? 0 : 1);
