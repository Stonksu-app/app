/**
 * The answer streak inside a lesson.
 *
 * Thresholds are the whole feature — the bar changing colour at the right
 * moment is what tells you you're on a run — and they're invisible in a
 * screenshot, so they're pinned here.
 *
 * Run: npm run check -- combo
 */
import { COMBO_MAX_TIER, COMBO_STEP, comboTier, isTierUp } from '../src/utils/combo';

let failed = 0;
const check = (name: string, cond: boolean, detail = '') => {
  if (cond) console.log(`  ok  ${name}`);
  else {
    failed++;
    console.log(`FALLA  ${name}${detail ? ` — ${detail}` : ''}`);
  }
};

check('sin aciertos seguidos, la barra es la normal', comboTier(0) === 0);
check('dos aciertos todavía no cambian nada', comboTier(2) === 0);
check(`a los ${COMBO_STEP} sube al primer nivel`, comboTier(COMBO_STEP) === 1);
check('entre niveles se mantiene', comboTier(COMBO_STEP + 1) === 1);
check(`a los ${COMBO_STEP * 2} sube al segundo`, comboTier(COMBO_STEP * 2) === 2);
check(
  'y ahí se queda: no hay un tercer color que casi nadie vería',
  comboTier(99) === COMBO_MAX_TIER,
  `${comboTier(99)}`
);

check('el destello salta justo al cambiar de nivel', isTierUp(COMBO_STEP));
check('y otra vez en el siguiente', isTierUp(COMBO_STEP * 2));
check('no salta en los aciertos intermedios', !isTierUp(COMBO_STEP + 1));
check(
  'ni una vez alcanzado el tope, por muchos aciertos que sigan',
  !isTierUp(COMBO_STEP * 3),
  'seguiría dando saltos sin que la barra cambie'
);
check('fallar vuelve a empezar', comboTier(0) === 0 && !isTierUp(0));

console.log(failed === 0 ? '\nTodo correcto.' : `\n${failed} problema(s).`);
process.exit(failed === 0 ? 0 : 1);
