import { useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Icon from '../components/Icon';
import Avatar from '../components/Avatar';
import DirectionBadge from '../components/DirectionBadge';
import ParticleBurst from '../components/ParticleBurst';
import ResultsScreen from '../components/ResultsScreen';
import { randomLine } from '../components/Mascot';
import { Button } from '../components/Button';
import { SKILL_TREE } from '../data/lessons';
import { TERM_MASTERY_GOAL, useUserStore } from '../store/useUserStore';
import { FREE_PRACTICE_PER_DAY } from '../data/plans';
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
  const topicTitle = topic ? (SKILL_TREE.find((n) => n.id === topic)?.title ?? null) : null;

  const { isNodeUnlocked, getNodeStage, getNodeMaxStage, termMastery, recordTermAnswer, addXp } =
    useUserStore();

  /**
   * The day's allowance, spent on arrival rather than on the last question.
   *
   * Charged once per mount and remembered, so a re-render can't spend a second
   * round and abandoning one mid-way still costs it — otherwise the limit is
   * just a suggestion you dismiss by pressing back.
   */
  const [allowed] = useState(() => useUserStore.getState().startPracticeRound());

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
  /** Picked once per answer, like a lesson's — the mascot saying the same
   *  sentence ten times running stops reading as a reaction. */
  const [mascotLine, setMascotLine] = useState('');
  /** Bumped on every answer so the full-screen flash replays even when two
   *  answers in a row land the same way. */
  const [flash, setFlash] = useState<{ correct: boolean; nonce: number } | null>(null);

  if (!allowed) {
    return (
      <div className="min-h-dvh bg-carbon-900 flex items-center justify-center px-6 text-center">
        <div className="max-w-sm">
          <div className="w-20 h-20 rounded-3xl relative platinum-node flex items-center justify-center mx-auto">
            <Icon name="cards" size={38} className="relative z-10 text-white" />
          </div>
          <p className="mt-5 text-2xl font-black text-carbon-50">Ya repasaste hoy</p>
          <p className="mt-1.5 text-sm text-carbon-400 leading-snug">
            El plan gratuito incluye {FREE_PRACTICE_PER_DAY}{' '}
            {FREE_PRACTICE_PER_DAY === 1 ? 'repaso al día' : 'repasos al día'}. Con Ultra repasas
            todas las veces que quieras.
          </p>
          <div className="mt-7 space-y-3">
            <Button variant="platinum" onClick={() => navigate('/planes')}>
              Ver Ultra
            </Button>
            <Button variant="secondary" onClick={() => navigate('/guia')}>
              Volver a la guía
            </Button>
          </div>
        </div>
      </div>
    );
  }

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
    setMascotLine(randomLine(right ? 'correct' : 'incorrect'));
    setFlash({ correct: right, nonce: Date.now() });
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
      <ResultsScreen
        title={correctCount === questions.length ? '¡Repaso perfecto!' : '¡Repaso terminado!'}
        subtitle={topicTitle ?? 'Guía'}
        icon="cards"
        xpEarned={XP_PER_SESSION}
        correctCount={correctCount}
        totalQuestions={questions.length}
        onContinue={() => navigate('/guia')}
        continueLabel="Volver a la guía"
        secondary={{ label: 'Otro repaso', onClick: () => window.location.reload() }}
      >
        {mastered > 0 && (
          <div className="mt-4 pt-4 border-t border-carbon-800">
            <p className="flex items-center justify-center gap-1.5 text-sm font-black text-carbon-50 animate-pop-in">
              <Icon name="diamond" size={16} className="text-carbon-100" /> {mastered}{' '}
              {mastered === 1 ? 'término en PLATINO' : 'términos en PLATINO'}
            </p>
          </div>
        )}
      </ResultsScreen>
    );
  }

  const asksForTerm = question.mode === 'definition-to-term';

  return (
    <div className="min-h-dvh bg-carbon-900 flex flex-col relative">
      {/* Keyed on the nonce so two right answers in a row flash twice rather
          than the animation being considered already played. */}
      {flash && (
        <div
          key={flash.nonce}
          className={`fixed inset-0 pointer-events-none z-30 ${
            flash.correct ? 'animate-flash-correct' : 'animate-flash-incorrect'
          }`}
        />
      )}

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

      {/* The same footer a lesson shows, mascot included. Revision that looked
          plainer than the lessons would read as the lesser activity, which is
          exactly the wrong signal to send about going back over things. */}
      {answered && (
        <div
          className={`fixed bottom-0 inset-x-0 border-t-2 pb-safe ${
            gotItRight ? 'bg-lime-500/5 border-lime-500/20' : 'bg-danger-950 border-danger-500/20'
          }`}
        >
          <div className="max-w-2xl mx-auto px-4 py-4">
            <div className="flex items-center gap-3 mb-3 animate-pop-in">
              <div className="relative shrink-0 flex items-center justify-center">
                <DirectionBadge direction={gotItRight ? 'long' : 'short'} />
                <Avatar
                  size={44}
                  mood={gotItRight ? 'hype' : 'sad'}
                  className={gotItRight ? '' : 'animate-shake'}
                />
                <ParticleBurst show={gotItRight} />
              </div>
              <div className="min-w-0">
                <p className={`font-black ${gotItRight ? 'text-lime-400' : 'text-danger-400'}`}>
                  {gotItRight ? '¡Correcto! ' : `${question.card.term}. `}
                  {mascotLine}
                </p>
                {!gotItRight && (
                  <p className="text-sm text-carbon-400 leading-snug">{question.card.definition}</p>
                )}
              </div>
            </div>
            <Button
              onClick={next}
              variant={gotItRight ? 'primary' : 'danger'}
              className={gotItRight ? 'animate-pulse-ring' : ''}
            >
              {index + 1 >= questions.length ? 'Terminar' : 'Continuar'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
