/**
 * Guards the glossary and its practice.
 *
 * Two failures this exists to catch. First, duplicate flashcard ids: mastery
 * is keyed on the id, so two terms sharing one would appear to master each
 * other, and the guide would light up tiles nobody has practised. Second, the
 * mastery arithmetic itself — it has to cap, it has to floor at zero, and a
 * wrong answer has to cost less than a right one gives, or a bad run would
 * wipe out a term you know well.
 *
 * Run: npm run check -- terms
 */
import { SKILL_TREE } from '../src/data/lessons';
import { TERM_MASTERY_GOAL, useUserStore } from '../src/store/useUserStore';

let failed = 0;
const check = (name: string, cond: boolean, detail = '') => {
  if (cond) console.log(`  ok  ${name}`);
  else {
    failed++;
    console.log(`FALLA  ${name}${detail ? ` — ${detail}` : ''}`);
  }
};

// ------------------------------------------------------- ids are unique
const seen = new Map<string, string>();
for (const node of SKILL_TREE) {
  for (const card of node.intro?.flashcards ?? []) {
    const owner = seen.get(card.id);
    if (owner) {
      failed++;
      console.log(`FALLA  el id "${card.id}" lo usan "${owner}" y "${node.title}"`);
    } else {
      seen.set(card.id, node.title);
    }
  }
}
check(`los ${seen.size} términos tienen ids únicos`, seen.size > 0);

// The practice needs four options, so a topic with fewer than four revealed
// terms can only be practised as part of the whole guide. Worth knowing.
for (const node of SKILL_TREE) {
  const cards = node.intro?.flashcards ?? [];
  if (cards.length === 0) continue;
  check(
    `"${node.title}" tiene términos suficientes para un repaso propio`,
    cards.length >= 4,
    `solo ${cards.length}`
  );
}

// ------------------------------------------------ the mastery arithmetic
const { recordTermAnswer, getTermMastery, isTermMastered } = useUserStore.getState();
const id = 'check-terms-sample';

check('un término empieza sin dominio', getTermMastery(id) === 0);

for (let i = 0; i < TERM_MASTERY_GOAL; i++) recordTermAnswer(id, true);
check(`${TERM_MASTERY_GOAL} aciertos lo dominan`, isTermMastered(id));

recordTermAnswer(id, true);
check(
  'seguir acertando no lo lleva por encima del tope',
  getTermMastery(id) === TERM_MASTERY_GOAL,
  `quedó en ${getTermMastery(id)}`
);

recordTermAnswer(id, false);
check(
  'un fallo cuesta uno, no todo lo acumulado',
  getTermMastery(id) === TERM_MASTERY_GOAL - 1,
  `quedó en ${getTermMastery(id)}`
);

for (let i = 0; i < 10; i++) recordTermAnswer(id, false);
check('fallar de más no deja el dominio en negativo', getTermMastery(id) === 0);

console.log(failed === 0 ? '\nTodo correcto.' : `\n${failed} problema(s).`);
process.exit(failed === 0 ? 0 : 1);
