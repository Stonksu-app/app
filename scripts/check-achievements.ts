// Checks the tiered achievements against the real module.
// Bundle first: npx esbuild scripts/check-achievements.ts --bundle --platform=node --format=esm --outfile=/tmp/a.mjs
import { computeAchievements, type AchievementInput } from '../src/data/achievements.ts';
import type { LessonAttempt } from '../src/types.ts';

let failed = 0;
const check = (label: string, ok: boolean, detail = '') => {
  if (!ok) failed++;
  console.log(`${ok ? 'OK  ' : 'FALLA'} ${label}${detail ? ` — ${detail}` : ''}`);
};

const attempt = (correct: number, total: number): LessonAttempt => ({
  lessonId: 'x', nodeId: 'fundamentos', completedAt: new Date().toISOString(),
  xpEarned: 10, correctCount: correct, totalQuestions: total,
});

const empty: AchievementInput = { streak: 0, xp: 0, attempts: [], nodeStageProgress: {}, openedChestIds: [] };

// A brand-new player: everything at level 0, aiming at the first threshold.
const fresh = computeAchievements(empty);
check('jugador nuevo: todo a nivel 0', fresh.every((a) => a.level === 0));
check('jugador nuevo: nada marcado como completo', fresh.every((a) => !a.maxed));
const streakFresh = fresh.find((a) => a.id === 'streak')!;
check('primer objetivo de racha es 3', streakFresh.target === 3, `objetivo ${streakFresh.target}`);

// Crossing thresholds raises the level.
const mid = computeAchievements({ ...empty, streak: 15, xp: 600 });
const streakMid = mid.find((a) => a.id === 'streak')!;
check('racha 15 -> nivel 3', streakMid.level === 3, `nivel ${streakMid.level}`);
check('racha 15 apunta a 30', streakMid.target === 30, `objetivo ${streakMid.target}`);
const xpMid = mid.find((a) => a.id === 'xp')!;
check('600 XP -> nivel 2', xpMid.level === 2, `nivel ${xpMid.level}`);

// Only flawless runs count towards the flawless achievement.
const flawless = computeAchievements({
  ...empty,
  attempts: [attempt(10, 10), attempt(9, 10), attempt(5, 5)],
});
const fl = flawless.find((a) => a.id === 'flawless')!;
check('2 de 3 lecciones sin fallo cuentan', fl.value === 2, `valor ${fl.value}`);
const lessons = flawless.find((a) => a.id === 'lessons')!;
check('las 3 cuentan como lecciones', lessons.value === 3, `valor ${lessons.value}`);

// Platinum counts only topics at or past their stage ceiling.
const plat = computeAchievements({
  ...empty,
  nodeStageProgress: { fundamentos: 5, 'velas-japonesas': 2, 'soportes-resistencias': 3 },
});
const pl = plat.find((a) => a.id === 'platinum')!;
check('platino cuenta solo los temas al tope', pl.value === 2, `valor ${pl.value} (fundamentos 5/5 y soportes 3/3)`);

// Maxing out stops advancing and reports completion.
const maxed = computeAchievements({ ...empty, streak: 9999 });
const mx = maxed.find((a) => a.id === 'streak')!;
check('racha enorme queda al máximo', mx.maxed && mx.level === 6, `nivel ${mx.level}, maxed ${mx.maxed}`);
check('al máximo, valor no supera el objetivo', mx.value === mx.target, `${mx.value}/${mx.target}`);

console.log(failed === 0 ? '\nTodo correcto.' : `\n${failed} problema(s).`);
process.exit(failed === 0 ? 0 : 1);
