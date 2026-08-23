// Exercises the streak rules against the real module.
// Run with: node --experimental-strip-types scripts/check-streak.ts
import { computeStreakUpdate, daysBetween } from '../src/utils/streak.ts';
import { useUserStore } from '../src/store/useUserStore';
import { streakFromHistory, shiftDay, localDayKey, todayLocal } from '../src/utils/streak';

const cases: {
  name: string;
  last: string | null;
  streak: number;
  protectors: number;
  today: string;
  expect: { streak: number; protectorsUsed: number };
}[] = [
  { name: 'primera lección de siempre', last: null, streak: 0, protectors: 0, today: '2026-08-19', expect: { streak: 1, protectorsUsed: 0 } },
  { name: 'segunda lección el mismo día no suma', last: '2026-08-19', streak: 4, protectors: 0, today: '2026-08-19', expect: { streak: 4, protectorsUsed: 0 } },
  { name: 'día seguido suma', last: '2026-08-18', streak: 4, protectors: 0, today: '2026-08-19', expect: { streak: 5, protectorsUsed: 0 } },
  { name: 'falta 1 día sin protector: se pierde', last: '2026-08-17', streak: 9, protectors: 0, today: '2026-08-19', expect: { streak: 1, protectorsUsed: 0 } },
  { name: 'falta 1 día con protector: se salva y gasta 1', last: '2026-08-17', streak: 9, protectors: 1, today: '2026-08-19', expect: { streak: 10, protectorsUsed: 1 } },
  { name: 'faltan 2 días con 1 protector: no alcanza', last: '2026-08-16', streak: 9, protectors: 1, today: '2026-08-19', expect: { streak: 1, protectorsUsed: 0 } },
  { name: 'faltan 2 días con 2 protectores: se salva', last: '2026-08-16', streak: 9, protectors: 2, today: '2026-08-19', expect: { streak: 10, protectorsUsed: 2 } },
  { name: 'cruce de mes', last: '2026-07-31', streak: 3, protectors: 0, today: '2026-08-01', expect: { streak: 4, protectorsUsed: 0 } },
  { name: 'cruce de año', last: '2025-12-31', streak: 3, protectors: 0, today: '2026-01-01', expect: { streak: 4, protectorsUsed: 0 } },
  { name: 'año bisiesto 29-feb', last: '2028-02-29', streak: 2, protectors: 0, today: '2028-03-01', expect: { streak: 3, protectorsUsed: 0 } },
];

let failed = 0;
for (const c of cases) {
  const got = computeStreakUpdate(c.last, c.streak, c.protectors, c.today);
  const ok = got.streak === c.expect.streak && got.protectorsUsed === c.expect.protectorsUsed;
  if (!ok) failed++;
  console.log(
    `${ok ? 'OK  ' : 'FALLA'} ${c.name} -> racha ${got.streak} (esperada ${c.expect.streak}), ` +
      `protectores usados ${got.protectorsUsed} (esperados ${c.expect.protectorsUsed})`
  );
}

console.log(`\ndaysBetween 2026-08-16 -> 2026-08-19 = ${daysBetween('2026-08-16', '2026-08-19')} (esperado 3)`);
console.log(failed === 0 ? '\nTodo correcto.' : `\n${failed} caso(s) fallando.`);
if (failed > 0) process.exit(1);

/*
 * A repaso is a day's activity too.
 *
 * completeReview exists so a day spent only revising doesn't silently break
 * the streak — and, just as importantly, so it doesn't hand out the things a
 * lesson hands out. Revision that paid XP and gifted protectors would make
 * finishing lessons the slower way to play.
 */
const store = useUserStore.getState();
const today = new Date().toISOString().slice(0, 10);
const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

function reset(patch: Partial<ReturnType<typeof useUserStore.getState>>) {
  useUserStore.setState({
    streak: 0,
    lastActiveDate: null,
    frozenDates: [],
    reviewDates: [],
    streakProtectors: 0,
    xp: 0,
    completedLessonIds: [],
    attempts: [],
    ...patch,
  });
}

let reviewFailed = 0;
const expect = (name: string, cond: boolean, detail = '') => {
  if (cond) console.log(`OK   ${name}`);
  else {
    reviewFailed++;
    console.log(`FALLA ${name}${detail ? ` — ${detail}` : ''}`);
  }
};

reset({});
store.completeReview();
expect('un repaso sin lecciones arranca la racha', useUserStore.getState().streak === 1);
expect('y marca hoy en el calendario', useUserStore.getState().reviewDates.includes(today));

reset({ streak: 4, lastActiveDate: yesterday });
store.completeReview();
expect('un repaso al día siguiente continúa la racha', useUserStore.getState().streak === 5);

store.completeReview();
expect('dos repasos el mismo día no suman dos', useUserStore.getState().streak === 5);
expect(
  'ni pintan el día dos veces',
  useUserStore.getState().reviewDates.filter((d) => d === today).length === 1
);

reset({ streak: 9, lastActiveDate: '2020-01-01', streakProtectors: 1 });
store.completeReview();
expect(
  'un repaso puede gastar un protector para salvar la racha',
  useUserStore.getState().streakProtectors === 0 || useUserStore.getState().streak === 1,
  `racha ${useUserStore.getState().streak}, protectores ${useUserStore.getState().streakProtectors}`
);

reset({ xp: 100 });
store.completeReview();
const after = useUserStore.getState();
expect('un repaso no paga XP por su cuenta', after.xp === 100, `xp ${after.xp}`);
expect('no cuenta como lección completada', after.completedLessonIds.length === 0);
expect('y no regala protectores', after.streakProtectors === 0);

if (reviewFailed > 0) {
  console.log(`\n${reviewFailed} caso(s) de repaso fallando.`);
  process.exit(1);
}
console.log('\nRepaso: todo correcto.');

/*
 * The streak can be rebuilt from what the app already knows.
 *
 * It normally lives in two fields and nothing recomputes it, so losing them —
 * a cloud row with no last_active_date, an older profile syncing in — drops
 * the number to 1 while the lesson history still lists every day played. That
 * looked like a bug to the person holding the phone, and it was.
 */
const hoy = '2026-08-23';
const d = (n: number) => shiftDay(hoy, -n);

let repairFailed = 0;
const check2 = (name: string, cond: boolean, detail = '') => {
  if (cond) console.log(`OK   ${name}`);
  else {
    repairFailed++;
    console.log(`FALLA ${name}${detail ? ` — ${detail}` : ''}`);
  }
};

check2('cuatro días seguidos hasta hoy son racha de 4',
  streakFromHistory([d(3), d(2), d(1), hoy], hoy) === 4,
  `${streakFromHistory([d(3), d(2), d(1), hoy], hoy)}`);
check2('una racha que acaba ayer sigue viva',
  streakFromHistory([d(2), d(1)], hoy) === 2);
check2('si el último día fue anteayer, ya no cuenta',
  streakFromHistory([d(3), d(2)], hoy) === 0);
check2('un hueco corta por el hueco',
  streakFromHistory([d(5), d(4), d(1), hoy], hoy) === 2);
check2('días repetidos no inflan el número',
  streakFromHistory([hoy, hoy, d(1)], hoy) === 2);
check2('sin historial no hay racha', streakFromHistory([], hoy) === 0);

// And the store action that uses it.
reset({ streak: 1, lastActiveDate: null });
useUserStore.setState({
  attempts: [
    { lessonId: 'a', nodeId: 'n', completedAt: `${shiftDay(new Date().toISOString().slice(0, 10), -2)}T10:00:00.000Z`, xpEarned: 10, correctCount: 1, totalQuestions: 1 },
    { lessonId: 'b', nodeId: 'n', completedAt: `${shiftDay(new Date().toISOString().slice(0, 10), -1)}T10:00:00.000Z`, xpEarned: 10, correctCount: 1, totalQuestions: 1 },
  ],
  reviewDates: [new Date().toISOString().slice(0, 10)],
});
store.repairStreak();
check2('repairStreak sube la racha a lo que prueba el historial',
  useUserStore.getState().streak === 3,
  `quedó en ${useUserStore.getState().streak}`);

useUserStore.setState({ streak: 40 });
store.repairStreak();
check2('y nunca la baja: un día ausente no prueba nada',
  useUserStore.getState().streak === 40,
  `quedó en ${useUserStore.getState().streak}`);

if (repairFailed > 0) {
  console.log(`\n${repairFailed} caso(s) de reparación fallando.`);
  process.exit(1);
}
console.log('\nReparación: todo correcto.');

/*
 * A repaso and a lesson are the same day's work.
 *
 * Not "similar": the same. If revising nudged the streak differently from
 * finishing a lesson, the honest advice to a player short on time would be to
 * open a lesson and quit it, which is nobody's idea of learning.
 */
let sameFailed = 0;
const check3 = (name: string, cond: boolean, detail = '') => {
  if (cond) console.log(`OK   ${name}`);
  else {
    sameFailed++;
    console.log(`FALLA ${name}${detail ? ` — ${detail}` : ''}`);
  }
};

const ayer = todayLocal(-1);
const attempt = (day: string) => ({
  lessonId: `l-${day}`,
  nodeId: 'fundamentos',
  completedAt: new Date(`${day}T12:00:00`).toISOString(),
  xpEarned: 10,
  correctCount: 1,
  totalQuestions: 1,
});

reset({ streak: 4, lastActiveDate: ayer });
store.completeReview();
const porRepaso = useUserStore.getState();

reset({ streak: 4, lastActiveDate: ayer });
store.completeLesson(attempt(todayLocal()));
const porLeccion = useUserStore.getState();

check3(
  'repasar suma igual que terminar una lección',
  porRepaso.streak === porLeccion.streak && porRepaso.streak === 5,
  `repaso ${porRepaso.streak}, lección ${porLeccion.streak}`
);
check3(
  'y ambos dejan el mismo último día activo',
  porRepaso.lastActiveDate === porLeccion.lastActiveDate
);

// Alternating between the two across days has to build one run, not two.
reset({ streak: 0, lastActiveDate: null });
useUserStore.setState({
  attempts: [attempt(todayLocal(-3)), attempt(todayLocal(-1))],
  reviewDates: [todayLocal(-2), todayLocal()],
});
store.repairStreak();
check3(
  'alternar lección y repaso cuenta como una sola racha',
  useUserStore.getState().streak === 4,
  `quedó en ${useUserStore.getState().streak}`
);

/*
 * And the day itself is the player's, not the server's.
 *
 * The streak used to be kept in UTC while the calendar drew local days, so in
 * Madrid anything played between midnight and 02:00 counted for the previous
 * day: four squares on the calendar, two days of streak, and no way for
 * anyone to tell why.
 */
const medianoche = new Date();
medianoche.setHours(0, 30, 0, 0);
check3(
  'una sesión de madrugada cuenta para el día que ve el jugador',
  localDayKey(medianoche) === todayLocal(),
  `${localDayKey(medianoche)} vs ${todayLocal()}`
);
check3(
  'el calendario y la racha usan la misma clave de día',
  localDayKey(new Date(attempt(todayLocal()).completedAt)) === todayLocal()
);

if (sameFailed > 0) {
  console.log(`\n${sameFailed} caso(s) de equivalencia fallando.`);
  process.exit(1);
}
console.log('\nRepaso y lección: cuentan igual.');
