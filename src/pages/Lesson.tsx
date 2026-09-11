import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, optionLip } from '../components/Button';
import CandleChart from '../components/CandleChart';
import DirectionBadge from '../components/DirectionBadge';
import Icon from '../components/Icon';
import LessonHeader from '../components/LessonHeader';
import Avatar from '../components/Avatar';
import { randomLine } from '../components/Mascot';
import MatchPairsGame from '../components/MatchPairsGame';
import OutOfHeartsScreen from '../components/OutOfHeartsScreen';
import ParticleBurst from '../components/ParticleBurst';
import SentenceRoundCard from '../components/SentenceRoundCard';
import SequenceGame from '../components/SequenceGame';
import SortClassifyGame from '../components/SortClassifyGame';
import StreakPill from '../components/StreakPill';
import { getLessonById, getNodeById, getReviewPool } from '../data/lessons';
import { canPlayUltraLessons } from '../data/plans';
import { useComboFeedback } from '../hooks/useComboFeedback';
import { useUserStore } from '../store/useUserStore';
import { buildStage, mistakeKey } from '../utils/buildActivityStream';
import { shuffle } from '../utils/shuffle';
import type { Activity, IconName } from '../types';

const XP_PER_CORRECT = 10;

const ACTIVITY_BADGE: Partial<Record<Activity['type'], { icon: IconName; label: string }>> = {
  match: { icon: 'shuffle', label: 'Emparejar' },
  classify: { icon: 'target', label: 'Clasificar' },
  sequence: { icon: 'clipboard', label: 'Ordenar' },
  sentence: { icon: 'pencil', label: 'Completar' },
};

export default function Lesson() {
  useUserStore.getState().tickHeartRegen();
  const { lessonId } = useParams<{ lessonId: string }>();
  const navigate = useNavigate();
  const {
    completeLesson,
    unlockBadge,
    attempts,
    streak,
    isLessonCompleted,
    getNodeStage,
    getNodeMaxStage,
    recordMistake,
    clearMistake,
    completedLessonIds,
    // Aliased: `plan` in this file already means the stage's activity plan.
    plan: subscription,
  } = useUserStore();
  const {
    hearts,
    combo,
    tier,
    heartsLost,
    outOfHearts,
    registerResult,
    shakeClass,
    totalCorrect,
    totalAttempts,
    lastResult,
  } = useComboFeedback();

  const data = useMemo(() => (lessonId ? getLessonById(lessonId) : undefined), [lessonId]);

  // The stage you're about to play is the one after what you've cleared, so
  // each attempt serves different content instead of replaying the whole topic.
  const [stageAtEntry] = useState(() => (data ? getNodeStage(data.node.id) : 0));
  // Frozen at entry: misses made during this run belong to the NEXT lesson, and
  // a live subscription would rebuild the plan mid-run.
  const [mistakesAtEntry] = useState(() => useUserStore.getState().pendingMistakes);
  // Same idea for the review pool: fixed at entry so the one dropped-in
  // question doesn't shuffle out from under the player mid-run.
  const [reviewPoolAtEntry] = useState(() =>
    data ? getReviewPool(completedLessonIds, data.node.id) : []
  );
  const plan = useMemo(
    () =>
      data
        ? buildStage(
            data.node,
            data.lesson.questions,
            stageAtEntry,
            getNodeMaxStage(data.node.id),
            mistakesAtEntry,
            reviewPoolAtEntry
          )
        : null,
    // getNodeMaxStage is a stable store getter; stageAtEntry/mistakesAtEntry/
    // reviewPoolAtEntry are all frozen for the run.
    [data, stageAtEntry, getNodeMaxStage, mistakesAtEntry, reviewPoolAtEntry]
  );
  const activities = plan?.activities ?? [];

  const [index, setIndex] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [mascotLine, setMascotLine] = useState('');
  const [showOutOfHearts, setShowOutOfHearts] = useState(false);
  const [enteredWithNoHearts] = useState(() => hearts <= 0);

  // A fixed answer position is a position to memorise instead of a question
  // to answer. Shuffled once per question, not on every render, so picking
  // an option doesn't reorder it out from under the tap.
  const currentActivity = activities[index];
  const shuffledOptions = useMemo(
    () => (currentActivity?.type === 'quiz' ? shuffle(currentActivity.question.options) : []),
    [currentActivity]
  );

  // Above the early returns below, and it has to stay there: those returns
  // skip everything after them, so a hook placed lower is called on some
  // renders and not others. React counts hooks by order, so the first render
  // where the condition flips crashes the lesson outright.
  useEffect(() => {
    if (!outOfHearts) return;
    // Just long enough for the red flash on the wrong answer to register —
    // any longer and there's a window to tap "continuar" or another option
    // before the lock screen takes over.
    const t = setTimeout(() => setShowOutOfHearts(true), 700);
    return () => clearTimeout(t);
  }, [outOfHearts]);

  if (!data || activities.length === 0) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center gap-4 bg-carbon-900 p-6 text-center">
        <p className="font-bold text-carbon-50">No encontramos esa lección.</p>
        <button onClick={() => navigate('/home')} className="text-lime-400 font-bold">
          Volver al mapa
        </button>
      </div>
    );
  }

  // Checked on the route, not only in the dialog that leads here: a topic
  // that's exclusive has to be exclusive to someone typing the URL too.
  if (data.node.ultra && !canPlayUltraLessons(subscription)) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center gap-4 bg-carbon-900 p-6 text-center">
        <div className="w-20 h-20 rounded-3xl relative platinum-node flex items-center justify-center">
          <Icon name="diamond" size={38} className="relative z-10 text-white" />
        </div>
        <p className="font-black text-xl text-carbon-50">Este tema es de Ultra</p>
        <p className="text-sm text-carbon-400 max-w-xs">
          Desbloquéalo con Stonksu Ultra, junto a las vidas infinitas y el repaso sin límite.
        </p>
        <div className="w-[240px] space-y-3 mt-2">
          <Button variant="platinum" onClick={() => navigate('/planes')}>
            Ver Ultra
          </Button>
          <Button variant="secondary" onClick={() => navigate('/home')}>
            Volver al mapa
          </Button>
        </div>
      </div>
    );
  }

  if (enteredWithNoHearts) {
    return <OutOfHeartsScreen blockedEntry />;
  }

  const { node, lesson } = data;
  const activity = activities[index];
  const progressPct = Math.round((index / activities.length) * 100);
  const badge = ACTIVITY_BADGE[activity.type];
  /** Coming back from an earlier miss. Flagged so it reads as a second chance
   *  rather than as new material you're inexplicably seeing twice. */
  const isRepeat = plan?.replayIds.includes(activity.id) ?? false;
  /** Pulled in from a different, already-completed lesson to keep it from
   *  fading — flagged so it reads as a memory check, not new material. */
  const isReviewQuestion = plan?.reviewIds.includes(activity.id) ?? false;

  const isQuiz = activity.type === 'quiz';
  const isCorrect = isQuiz && checked && selectedId === activity.question.correctOptionId;
  const isWrong = isQuiz && checked && selectedId !== null && selectedId !== activity.question.correctOptionId;
  const zoomPulse = lastResult?.correct ? 'animate-zoom-pulse' : '';

  const finishLesson = () => {
    const wasFirstEverLesson = attempts.length === 0;
    const alreadyCompleted = isLessonCompleted(lesson.id);

    const { protectorGifted, levelUp } = completeLesson({
      lessonId: lesson.id,
      nodeId: node.id,
      completedAt: new Date().toISOString(),
      xpEarned: totalCorrect * XP_PER_CORRECT,
      correctCount: totalCorrect,
      totalQuestions: totalAttempts,
    });

    const newBadges: string[] = [];
    if (wasFirstEverLesson) newBadges.push('first-green-candle');
    if (heartsLost > 0) newBadges.push('survived-stop-loss');
    if (heartsLost === 0 && totalCorrect === totalAttempts) newBadges.push('perfect-lesson');
    if (streak + 1 >= 7) newBadges.push('week-streak');
    if (!alreadyCompleted) {
      const node2 = getNodeById(node.id);
      if (node2 && node2.lessons.every((l) => l.id === lesson.id || isLessonCompleted(l.id))) {
        if (node.id === 'fundamentos') newBadges.push('fundamentals-master');
        if (node.id === 'velas-japonesas') newBadges.push('candle-reader');
      }
    }
    newBadges.forEach((b) => unlockBadge(b));

    navigate(`/lesson/${lesson.id}/results`, {
      state: {
        correctCount: totalCorrect,
        totalQuestions: totalAttempts,
        xpEarned: totalCorrect * XP_PER_CORRECT,
        nodeTitle: node.title,
        newBadgeIds: newBadges,
        stage: getNodeStage(node.id),
        maxStage: getNodeMaxStage(node.id),
        protectorGifted,
        levelUp,
      },
      replace: true,
    });
  };

  const advance = () => {
    if (outOfHearts) return;
    if (index === activities.length - 1) {
      finishLesson();
      return;
    }
    setIndex((i) => i + 1);
    setSelectedId(null);
    setChecked(false);
  };

  /** Wraps the combo tracker so a missed question also gets queued for the next
   *  lesson — and so getting it right retires it from that queue. Only quiz and
   *  fill-in-the-blank rounds are one answer apiece; pooled match/classify
   *  batches report per item, so there's no single activity to bring back. */
  const trackResult = (correct: boolean) => {
    registerResult(correct);
    if (!data) return;
    if (activity.type !== 'quiz' && activity.type !== 'sentence') return;
    const key = mistakeKey(data.node.id, activity.id);
    if (correct) clearMistake(key);
    else recordMistake(key);
  };

  const handleSelect = (optionId: string) => {
    if (!isQuiz || checked) return;
    const correct = optionId === activity.question.correctOptionId;
    setSelectedId(optionId);
    setChecked(true);
    setMascotLine(randomLine(correct ? 'correct' : 'incorrect'));
    trackResult(correct);
  };

  if (showOutOfHearts) return <OutOfHeartsScreen />;

  return (
    <div className={`h-dvh bg-carbon-900 flex flex-col relative overflow-hidden ${zoomPulse} ${shakeClass}`}>

      {lastResult && (
        <div
          key={lastResult.nonce}
          className={`fixed inset-0 pointer-events-none z-30 ${
            lastResult.correct ? 'animate-flash-correct' : 'animate-flash-incorrect'
          }`}
        />
      )}

      <LessonHeader progressPct={progressPct} hearts={hearts} comboTier={tier} combo={combo} />

      {/* min-h-0 lets this flex child actually shrink so it scrolls instead of
          pushing the footer button off-screen on short phone viewports. */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-xl w-full mx-auto px-4 py-5 flex flex-col relative">
        <div className="flex items-center justify-between mb-1 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <p className="text-xs font-black text-lime-400 uppercase tracking-wide truncate">
              {plan?.isReview ? `${node.title} · Repaso` : plan?.title ?? node.title}
            </p>
            {isRepeat ? (
              <span className="flex items-center gap-1 text-[10px] font-black text-[#FFC93C] bg-[#FFC93C]/15 border border-[#FFC93C]/30 px-2 py-0.5 rounded-full uppercase whitespace-nowrap">
                <Icon name="refresh" size={11} />
                Repetición
              </span>
            ) : isReviewQuestion ? (
              <span className="flex items-center gap-1 text-[10px] font-black text-lime-400 bg-lime-500/15 border border-lime-500/30 px-2 py-0.5 rounded-full uppercase whitespace-nowrap">
                <Icon name="brain" size={11} />
                Repaso
              </span>
            ) : (
              badge && (
                <span className="flex items-center gap-1 text-[10px] font-black text-carbon-300 bg-carbon-800 px-2 py-0.5 rounded-full uppercase">
                  <Icon name={badge.icon} size={11} />
                  {badge.label}
                </span>
              )
            )}
            <StreakPill combo={combo} />
          </div>
          {isCorrect && (
            <span key={`${activity.id}-xp`} className="text-sm font-black text-lime-400 animate-float-up">
              +{XP_PER_CORRECT} XP
            </span>
          )}
        </div>

        {isRepeat && (
          <p className="mb-3 text-sm font-bold text-[#FFC93C]">
            Esta la fallaste la vez pasada. ¡Inténtalo otra vez!
          </p>
        )}

        {isReviewQuestion && !isRepeat && (
          <p className="mb-3 text-sm font-bold text-lime-400">
            De una lección anterior. A ver si te acuerdas.
          </p>
        )}

        {isQuiz && (
          <>
            <h1 className="text-xl sm:text-2xl font-black text-carbon-50">{activity.question.prompt}</h1>
            {activity.question.helper && <p className="text-sm text-carbon-400 mt-1">{activity.question.helper}</p>}

            {activity.question.chart && (
              <div className="mt-4">
                <CandleChart kind={activity.question.chart} />
              </div>
            )}

            <div className="mt-6 grid grid-cols-1 gap-3">
              {shuffledOptions.map((opt) => {
                const isSelected = selectedId === opt.id;
                const showCorrect = checked && opt.id === activity.question.correctOptionId;
                const showIncorrect = checked && isSelected && opt.id !== activity.question.correctOptionId;
                return (
                  <button
                    key={opt.id}
                    onClick={() => handleSelect(opt.id)}
                    disabled={checked}
                    style={{ ['--btn-lip' as string]: optionLip(showCorrect, showIncorrect) }}
                    className={`btn-3d text-left px-4 py-3.5 rounded-2xl border-2 font-bold flex items-center gap-3 ${
                      showCorrect
                        ? 'border-lime-500 bg-lime-500/10 text-lime-300'
                        : showIncorrect
                        ? 'border-danger-500 bg-danger-950 text-danger-400 animate-shake'
                        : isSelected
                        ? 'border-carbon-400 bg-carbon-800 text-carbon-50'
                        : 'border-carbon-800 bg-carbon-850 text-carbon-200 hover:border-carbon-600'
                    }`}
                  >
                    {showCorrect && <Icon name="check" size={18} className="text-lime-400 shrink-0 animate-bounce-in" />}
                    {showIncorrect && <Icon name="close" size={18} className="text-danger-400 shrink-0 animate-bounce-in" />}
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </>
        )}

        {activity.type === 'match' && (
          <div key={activity.id} className="mt-2">
            <MatchPairsGame
              pairs={activity.pairs}
              instructions={activity.instructions}
              onResult={trackResult}
              onDone={advance}
            />
          </div>
        )}

        {activity.type === 'classify' && (
          <div key={activity.id} className="mt-2">
            <SortClassifyGame
              items={activity.items}
              instructions={activity.instructions}
              bucketALabel={activity.bucketALabel}
              bucketBLabel={activity.bucketBLabel}
              onResult={trackResult}
              onDone={advance}
            />
          </div>
        )}

        {activity.type === 'sequence' && (
          <div key={activity.id} className="mt-2">
            <SequenceGame
              steps={activity.steps}
              instructions={activity.instructions}
              onResult={trackResult}
              onDone={advance}
            />
          </div>
        )}

        {activity.type === 'sentence' && (
          <div key={activity.id} className="mt-2">
            <SentenceRoundCard
              round={activity.round}
              instructions={activity.instructions}
              onResult={trackResult}
              onDone={advance}
            />
          </div>
        )}
        </div>
      </div>

      {isQuiz && checked && (
        <div
          className={`shrink-0 w-full border-t-2 transition-colors pb-safe ${
            isCorrect ? 'bg-lime-500/5 border-lime-500/20' : 'bg-danger-950 border-danger-500/20'
          }`}
        >
          <div className="max-w-xl mx-auto px-4 py-4">
            <div className="flex items-center gap-3 mb-3 animate-pop-in">
              <div className="relative shrink-0 flex items-center justify-center">
                <DirectionBadge direction={isCorrect ? 'long' : 'short'} />
                <Avatar size={44} mood={isCorrect ? 'hype' : 'sad'} className={isWrong ? 'animate-shake' : ''} />
                <ParticleBurst show={isCorrect} />
              </div>
              <div>
                <p className={`font-black ${isCorrect ? 'text-lime-400' : 'text-danger-400'}`}>
                  {isCorrect ? '¡Correcto! ' : 'Incorrecto. '}
                  {mascotLine}
                </p>
                <p className="text-sm text-carbon-400">{activity.question.explanation}</p>
              </div>
            </div>
            <Button
              onClick={advance}
              variant={isCorrect ? 'primary' : 'danger'}
              className={isCorrect ? 'animate-pulse-ring' : ''}
            >
              Continuar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
