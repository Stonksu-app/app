// Exercises the streak rules against the real module.
// Run with: node --experimental-strip-types scripts/check-streak.ts
import { computeStreakUpdate, daysBetween } from '../src/utils/streak.ts';

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
process.exit(failed === 0 ? 0 : 1);
