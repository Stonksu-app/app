// Checks that stages of a topic serve different content, that the last one is a
// review drawing from the whole topic, and that runs stay short.
// Run with: node --experimental-strip-types scripts/check-stages.ts
import { SKILL_TREE } from '../src/data/lessons.ts';
import { buildStage } from '../src/utils/buildActivityStream.ts';
import { stagesForDifficulty } from '../src/utils/mastery.ts';

let failed = 0;
const fail = (msg: string) => {
  console.log(`FALLA  ${msg}`);
  failed++;
};

for (const node of SKILL_TREE) {
  const questions = node.lessons[0]?.questions ?? [];
  if (!questions.length) continue;

  const maxStage = stagesForDifficulty(node.difficulty);
  const plans = Array.from({ length: maxStage }, (_, i) => buildStage(node, questions, i, maxStage));

  console.log(`\n=== ${node.title} (${maxStage} etapas) ===`);
  plans.forEach((p, i) => {
    const quiz = p.activities.filter((a) => a.type === 'quiz').length;
    const games = p.activities.length - quiz;
    console.log(
      `  etapa ${i + 1}: "${p.title}"${p.isReview ? ' [REPASO]' : ''} — ` +
        `${p.activities.length} actividades (${quiz} preguntas, ${games} minijuegos), ${p.flashcards.length} tarjetas`
    );
  });

  // 1. Runs stay short.
  for (const [i, p] of plans.entries()) {
    if (p.activities.length > 10) fail(`${node.title} etapa ${i + 1} tiene ${p.activities.length} actividades (>10)`);
    if (p.activities.length === 0) fail(`${node.title} etapa ${i + 1} está vacía`);
  }

  // 2. Teaching stages don't repeat each other's quiz questions.
  const teaching = plans.filter((p) => !p.isReview);
  const seen = new Map<string, number>();
  teaching.forEach((p, i) => {
    for (const a of p.activities) {
      if (a.type !== 'quiz') continue;
      if (seen.has(a.id)) fail(`${node.title}: pregunta ${a.id} repetida en etapas ${seen.get(a.id)! + 1} y ${i + 1}`);
      else seen.set(a.id, i);
    }
  });

  // 3. Exactly one review, and it's last.
  const reviews = plans.filter((p) => p.isReview).length;
  if (reviews !== 1) fail(`${node.title}: hay ${reviews} etapas de repaso (esperada 1)`);
  if (!plans[plans.length - 1].isReview) fail(`${node.title}: la última etapa no es el repaso`);

  // 4. The review pulls from more than one teaching slice.
  const review = plans[plans.length - 1];
  const reviewQuiz = review.activities.filter((a) => a.type === 'quiz').map((a) => a.id);
  const slicesTouched = new Set(reviewQuiz.map((id) => seen.get(id)).filter((v) => v !== undefined));
  if (slicesTouched.size < 2) {
    fail(`${node.title}: el repaso solo toca ${slicesTouched.size} tramo(s); debería abarcar varios`);
  } else {
    console.log(`  repaso abarca ${slicesTouched.size} de ${teaching.length} tramos`);
  }

  // 5. Teaching stages preview only their own terms.
  const totalCards = node.intro?.flashcards.length ?? 0;
  const previewed = teaching.reduce((n, p) => n + p.flashcards.length, 0);
  if (totalCards && previewed !== totalCards) {
    fail(`${node.title}: las etapas muestran ${previewed} tarjetas de ${totalCards}`);
  }
}

console.log(failed === 0 ? '\nTodo correcto.' : `\n${failed} problema(s).`);
process.exit(failed === 0 ? 0 : 1);
