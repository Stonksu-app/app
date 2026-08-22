/**
 * The splash is the one screen whose whole job is a duration, and a duration is
 * exactly what a screenshot can't show. So it gets checked here instead.
 *
 * Run: npm run check -- splash
 */
import { COLD_MS, WARM_FOR_MS, WARM_MS, splashDuration } from '../src/utils/splash';

let failed = 0;
const check = (name: string, cond: boolean, detail = '') => {
  if (cond) console.log(`  ok  ${name}`);
  else {
    failed++;
    console.log(`FALLA  ${name}${detail ? ` — ${detail}` : ''}`);
  }
};

const now = Date.UTC(2026, 7, 22, 12, 0, 0);
const min = 60 * 1000;

check('la primera vez dura la versión larga', splashDuration(null, now) === COLD_MS);
check(
  'volver a entrar al minuto es casi instantáneo',
  splashDuration(now - min, now) === WARM_MS,
  `${splashDuration(now - min, now)}ms`
);
check('a las 11 horas sigue siendo rápido', splashDuration(now - 11 * 60 * min, now) === WARM_MS);
check('pasado el margen vuelve la presentación', splashDuration(now - WARM_FOR_MS - min, now) === COLD_MS);
check('un valor corrupto no acorta nada', splashDuration(NaN, now) === COLD_MS);
check('un reloj que va hacia atrás tampoco', splashDuration(now + 60 * min, now) === COLD_MS);
check('la versión corta se nota pero no parpadea', WARM_MS >= 600 && WARM_MS <= 1500, `${WARM_MS}ms`);
check('la larga da tiempo a leer el consejo', COLD_MS >= 3000, `${COLD_MS}ms`);
check('la corta es mucho más corta que la larga', WARM_MS * 3 < COLD_MS);

console.log(failed === 0 ? '\nTodo correcto.' : `\n${failed} problema(s).`);
process.exit(failed === 0 ? 0 : 1);
