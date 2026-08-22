/**
 * Keeps the pricing page honest.
 *
 * The failure this exists to catch is a perk that's advertised and not
 * enforced, or enforced and not advertised. Both are invisible in review — the
 * page renders, the app runs — and both are discovered by a paying customer,
 * which is the worst possible reviewer to find them.
 *
 * Run: npm run check -- plans
 */
import {
  PLAN_OFFERS,
  atLeast,
  canPlayUltraLessons,
  formatPrice,
  hasAllAccessories,
  hasUnlimitedHearts,
  hasUnlimitedPractice,
  planName,
  showsAds,
  type Plan,
} from '../src/data/plans';
import { LESSONS_PER_PITCH, useUserStore } from '../src/store/useUserStore';
import { SKILL_TREE } from '../src/data/lessons';

let failed = 0;
const check = (name: string, cond: boolean, detail = '') => {
  if (cond) console.log(`  ok  ${name}`);
  else {
    failed++;
    console.log(`FALLA  ${name}${detail ? ` — ${detail}` : ''}`);
  }
};

const ALL: Plan[] = ['free', 'premium', 'ultra'];

// ------------------------------------------------------------ the ladder
check('ultra incluye lo de premium', ALL.every((p) => !atLeast(p, 'premium') || atLeast('ultra', 'premium')));
check('gratis no alcanza a premium', !atLeast('free', 'premium'));
check('premium no alcanza a ultra', !atLeast('premium', 'ultra'));

// ------------------------------------------------- what each plan removes
check('los anuncios solo se ven en el plan gratuito', showsAds('free') && !showsAds('premium') && !showsAds('ultra'));
check('las vidas infinitas son solo de ultra', hasUnlimitedHearts('ultra') && !hasUnlimitedHearts('premium'));
check('el repaso ilimitado es solo de ultra', hasUnlimitedPractice('ultra') && !hasUnlimitedPractice('premium'));
check('los accesorios exclusivos son solo de ultra', hasAllAccessories('ultra') && !hasAllAccessories('free'));
check('las lecciones ultra son solo de ultra', canPlayUltraLessons('ultra') && !canPlayUltraLessons('premium'));

// --------------------------------- every promise on the page is enforced
// Matched by keyword rather than by exact sentence so the copy can be
// rewritten without the check going quiet.
const ENFORCED: { keyword: RegExp; holds: (p: Plan) => boolean }[] = [
  { keyword: /vidas infinitas/i, holds: hasUnlimitedHearts },
  { keyword: /repaso .*ilimitado/i, holds: hasUnlimitedPractice },
  { keyword: /accesorios/i, holds: hasAllAccessories },
  { keyword: /lecciones exclusivas/i, holds: canPlayUltraLessons },
  { keyword: /sin anuncios/i, holds: (p) => !showsAds(p) },
];

for (const offer of PLAN_OFFERS) {
  for (const perk of offer.perks) {
    const rule = ENFORCED.find((r) => r.keyword.test(perk.text));
    check(
      `"${offer.name}: ${perk.text}" está respaldado por código`,
      !!rule && rule.holds(offer.id),
      rule ? 'el plan lo anuncia pero la regla dice que no' : 'ninguna regla comprueba esta ventaja'
    );
  }
}

// The other direction: a rule nobody advertises is a perk being given away.
for (const rule of ENFORCED) {
  const advertised = PLAN_OFFERS.some((o) => o.perks.some((p) => rule.keyword.test(p.text)));
  check(`la regla ${rule.keyword} aparece en algún plan`, advertised);
}

// --------------------------------------------------------------- pricing
for (const offer of PLAN_OFFERS) {
  check(`${offer.name} cuesta algo`, offer.price > 0, `${offer.price}`);
  check(`${offer.name} tiene al menos una ventaja`, offer.perks.length > 0);
}
const ultra = PLAN_OFFERS.find((o) => o.id === 'ultra')!;
const premium = PLAN_OFFERS.find((o) => o.id === 'premium')!;
check('ultra cuesta más que premium', ultra.price > premium.price);
check('ultra ofrece más que premium', ultra.perks.length > premium.perks.length);
check('el precio se muestra en euros con coma', formatPrice(6.99) === '6,99 €', formatPrice(6.99));
check('el plan gratuito se llama Gratis', planName('free') === 'Gratis');

// --------------------------------------------- the store applies the plan
const store = useUserStore.getState();
useUserStore.setState({ plan: 'free', hearts: 5 });
store.loseHeart();
check('en gratis se pierde una vida al fallar', useUserStore.getState().hearts === 4);

useUserStore.setState({ plan: 'ultra', hearts: 5 });
store.loseHeart();
check('en ultra no se pierde ninguna', useUserStore.getState().hearts === 5);

useUserStore.setState({ plan: 'free', practiceDay: null, practiceRoundsToday: 0 });
check('el primer repaso del día entra', store.startPracticeRound());
check('el segundo ya no', !store.startPracticeRound());

useUserStore.setState({ plan: 'ultra' });
check('ultra repasa sin gastar cupo', store.startPracticeRound() && store.startPracticeRound());

store.setPlan('ultra');
check(
  'contratar ultra desbloquea los accesorios',
  useUserStore.getState().unlockedAccessories.includes('corona')
);
check('contratar deja fecha de inicio', !!useUserStore.getState().planStartedAt);
store.setPlan('free');
check('volver a gratis borra la fecha', useUserStore.getState().planStartedAt === null);
check(
  'lo ya desbloqueado no se pierde al cancelar',
  useUserStore.getState().unlockedAccessories.includes('corona')
);

// ---------------------------------------- how often Ultra gets pitched
useUserStore.setState({ plan: 'free', lessonsSincePitch: 0 });
check('no se ofrece Ultra nada más empezar', !store.shouldPitchUltra());

useUserStore.setState({ lessonsSincePitch: LESSONS_PER_PITCH });
check(`se ofrece cada ${LESSONS_PER_PITCH} lecciones`, store.shouldPitchUltra());

store.markUltraPitched();
check('tras ofrecerlo, el contador vuelve a empezar', !store.shouldPitchUltra());

useUserStore.setState({ plan: 'ultra', lessonsSincePitch: 99 });
check('a quien ya paga no se le ofrece nunca', !store.shouldPitchUltra());
useUserStore.setState({ plan: 'free', lessonsSincePitch: 0 });

// ------------------------------------- what the tree marks as ultra-only
const ultraNodes = SKILL_TREE.filter((n) => n.ultra);
console.log(
  ultraNodes.length === 0
    ? '  ok  ningún tema pide ultra todavía (el curso es gratis de punta a punta)'
    : `  ok  ${ultraNodes.length} tema(s) piden ultra: ${ultraNodes.map((n) => n.title).join(', ')}`
);
// A locked first topic would leave a new player staring at a paywall.
check(
  'el primer tema del árbol nunca pide ultra',
  !SKILL_TREE[0]?.ultra,
  'nadie debería toparse con el muro antes de jugar'
);

console.log(failed === 0 ? '\nTodo correcto.' : `\n${failed} problema(s).`);
process.exit(failed === 0 ? 0 : 1);
