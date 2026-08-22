import { useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Icon from '../components/Icon';
import { Button } from '../components/Button';
import { SKILL_TREE } from '../data/lessons';
import { TERM_MASTERY_GOAL, useUserStore } from '../store/useUserStore';
import type { Flashcard } from '../types';

/*
 * Practice for the glossary, separate from the lessons on purpose.
 *
 * Lessons cost hearts because they're the course; this is revision, and
 * charging for it would mean the answer to "I'm shaky on these terms" is
 * "come back in two and a half hours". Nothing is lost here — a wrong answer
 * costs the term one point of mastery and comes round again.
 */

const QUESTIONS_PER_SESSION = 10;
const OPTIONS = 4;
/** XP for finishing a round. Deliberately below a lesson's: revision should be
 *  worth doing, not worth doing *instead*. */
const XP_PER_SESSION = 20;

type Question = {
  card: Flashcard;
  /** Which way round it's asked, so a term is recognised rather than a
   *  position in a list memorised. */
  mode: 'term-to-definition' | 'definition-to-term';
  options: Flashcard[];
};

/** Deterministic per call, not per render — a shuffle that reran on every
 *  keystroke would move the options under the player's finger. */
function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export default function GuidePractice() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const topic = params.get('tema');

  const { isNodeUnlocked, getNodeStage, getNodeMaxStage, termMastery, recordTermAnswer, addXp } =
    useUserStore();

  /** Everything the guide has revealed, which is exactly what may be asked. */
  const pool = useMemo(() => {
    const cards: Flashcard[] = [];
    for (const node of SKILL_TREE) {
      if (!node.intro?.flashcards.length) continue;
      if (!isNodeUnlocked(node.id)) continue;
      if (topic && node.id !== topic) continue;
      const stage = getNodeStage(node.id);
      const max = getNodeMaxStage(node.id);
      if (max <= 0 || stage <= 0) continue;
      const revealed = stage >= max ? node.intro.flashcards.length : Math.max(1, Math.round((node.intro.flashcards.length * stage) / max));
      cards.push(...node.intro.flashcards.slice(0, revealed));
    }
    return cards;
  }, [isNodeUnlocked, getNodeStage, getNodeMaxStage, topic]);

  /**
   * Built once for the whole round.
   *
   * Weakest first: a round that asked at random would keep testing the terms
   * you already know, which is the failure mode of every flashcard app that
   * doesn't bother. Ties are shuffled so the same order doesn't repeat.
   */
  const [questions] = useState<Question[]>(() => {
    const byNeed = shuffle(pool).sort(
      (a, b) => (termMastery[a.id] ?? 0) - (termMastery[b.id] ?? 0)
    );
    return byNeed.slice(0, QUESTIONS_PER_SESSION).map((card, i) => {
      const others = shuffle(pool.filter((c) => c.id !== card.id)).slice(0, OPTIONS - 1);
      return {
        card,
        mode: i % 2 === 0 ? 'definition-to-term' : 'term-to-definition',
        options: shuffle([card, ...others]),
      };
    });
  });

  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [done, setDone] = useState(false);
  const locked = useRef(false);

  // Fewer than two terms means there's nothing to build wrong answers from.
  if (pool.length < OPTIONS || questions.length === 0) {
    return (
      <div className="min-h-dvh bg-carbon-900 flex items-center justify-center px-6 text-center">
        <div>
          <Icon name="book" size={40} className="text-carbon-600 mx-auto" />
          <p className="mt-4 text-carbon-200 font-black text-lg">Aún no hay bastantes términos</p>
          <p className="mt-1 text-sm text-carbon-400">
            Completa alguna etapa más y vuelve: el repaso necesita al menos {OPTIONS} términos
            desbloqueados.
          </p>
          <div className="mt-6 w-[220px] mx-auto">
            <Button onClick={() => navigate('/guia')}>Volver a la guía</Button>
          </div>
        </div>
      </div>
    );
  }

  const question = questions[index];
  const answered = picked !== null;
  const gotItRight = picked === question.card.id;

  /**
   * Locked the instant a choice lands, not on the next render.
   *
   * `picked` is state, so two taps inside the same frame both read it as null
   * and both score — which is how a session of ten questions reported
   * forty-five correct answers the first time this was tested.
   */
  const answer = (id: string) => {
    if (answered || locked.current) return;
    locked.current = true;
    setPicked(id);
    const right = id === question.card.id;
    recordTermAnswer(question.card.id, right);
    if (right) setCorrectCount((n) => n + 1);
  };

  const next = () => {
    locked.current = false;
    if (index + 1 >= questions.length) {
      addXp(XP_PER_SESSION);
      setDone(true);
      return;
    }
    setIndex((i) => i + 1);
    setPicked(null);
  };

  if (done) {
    const mastered = questions.filter((q) => (termMastery[q.card.id] ?? 0) >= TERM_MASTERY_GOAL).length;
    return (
      <div className="min-h-dvh bg-carbon-900 flex items-center justify-center px-6 text-center">
        <div className="animate-pop-in">
          <div className="w-24 h-24 rounded-3xl platinum-node relative flex items-center justify-center mx-auto">
            <Icon name="diamond" size={44} className="relative z-10 text-white" />
          </div>
          <p className="mt-5 text-2xl font-black text-carbon-50">¡Repaso terminado!</p>
          <p className="mt-1 text-carbon-400">
            {correctCount} de {questions.length} correctas
          </p>
          <p className="mt-3 flex items-center justify-center gap-1.5 text-lime-400 font-black">
            <Icon name="star" size={18} /> +{XP_PER_SESSION} XP
          </p>
          {mastered > 0 && (
            <p className="mt-1.5 flex items-center justify-center gap-1.5 text-sky-400 font-black text-[15px]">
              <Icon name="diamond" size={16} /> {mastered}{' '}
              {mastered === 1 ? 'término en platino' : 'términos en platino'}
            </p>
          )}
          <div className="mt-7 w-[240px] mx-auto space-y-3">
            <Button onClick={() => navigate('/guia')}>Volver a la guía</Button>
            <Button variant="secondary" onClick={() => window.location.reload()}>
              Otro repaso
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const asksForTerm = question.mode === 'definition-to-term';

  return (
    <div className="min-h-dvh bg-carbon-900 flex flex-col">
      <div className="px-4 pt-safe">
        <div className="max-w-2xl mx-auto flex items-center gap-3 py-3">
          <button
            onClick={() => navigate('/guia')}
            aria-label="Salir del repaso"
            className="text-carbon-500 hover:text-carbon-200 transition p-1 -ml-1"
          >
            <Icon name="close" size={24} strokeWidth={2.6} />
          </button>
          <div className="flex-1 h-4 rounded-full bg-carbon-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-lime-500 transition-all duration-300"
              style={{ width: `${(index / questions.length) * 100}%` }}
            />
          </div>
          <span className="text-[13px] font-black text-carbon-400 tabular-nums">
            {index + 1}/{questions.length}
          </span>
        </div>
      </div>

      <div className="flex-1 px-4 pb-40">
        <div className="max-w-2xl mx-auto">
          <p className="mt-6 text-[13px] font-black uppercase tracking-[0.8px] text-carbon-500">
            {asksForTerm ? '¿Qué término es?' : '¿Qué significa?'}
          </p>
          <p className="mt-2 text-xl font-black text-carbon-50 leading-snug">
            {asksForTerm ? question.card.definition : question.card.term}
          </p>

          <div className="mt-6 space-y-3">
            {question.options.map((option) => {
              const isAnswer = option.id === question.card.id;
              const isPicked = option.id === picked;
              // After answering, the right one is always shown — being told
              // only that you were wrong teaches nothing.
              const tone = !answered
                ? 'bg-carbon-850 border-carbon-800 text-carbon-100 hover:border-carbon-700'
                : isAnswer
                  ? 'bg-lime-500/10 border-lime-500 text-lime-300'
                  : isPicked
                    ? 'bg-danger-500/10 border-danger-500 text-danger-300'
                    : 'bg-carbon-850 border-carbon-800 text-carbon-500';
              return (
                <button
                  key={option.id}
                  onClick={() => answer(option.id)}
                  disabled={answered}
                  className={`w-full text-left rounded-2xl border-2 px-4 py-3.5 font-bold leading-snug transition ${tone}`}
                >
                  {asksForTerm ? option.term : option.definition}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {answered && (
        <div
          className={`fixed bottom-0 inset-x-0 border-t-2 pb-safe ${
            gotItRight ? 'bg-lime-500/10 border-lime-500/40' : 'bg-danger-500/10 border-danger-500/40'
          }`}
        >
          <div className="max-w-2xl mx-auto px-4 py-4">
            <p
              className={`flex items-center gap-2 font-black ${
                gotItRight ? 'text-lime-400' : 'text-danger-400'
              }`}
            >
              <Icon name={gotItRight ? 'check' : 'close'} size={20} strokeWidth={3} />
              {gotItRight ? '¡Correcto!' : question.card.term}
            </p>
            {!gotItRight && (
              <p className="mt-1 text-sm text-carbon-300 leading-snug">{question.card.definition}</p>
            )}
            <div className="mt-3">
              <Button onClick={next}>
                {index + 1 >= questions.length ? 'Terminar' : 'Continuar'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
