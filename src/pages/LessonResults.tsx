import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Icon from '../components/Icon';
import ResultsScreen from '../components/ResultsScreen';
import ProtectorCelebration from '../components/ProtectorCelebration';
import { BADGES } from '../data/badges';
import { useUserStore } from '../store/useUserStore';

interface ResultsState {
  correctCount: number;
  totalQuestions: number;
  xpEarned: number;
  nodeTitle: string;
  newBadgeIds: string[];
  stage: number;
  maxStage: number;
  protectorGifted?: boolean;
}

export default function LessonResults() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as ResultsState | null;
  const { shouldPitchUltra, markUltraPitched } = useUserStore();
  // Its own beat before the results screen, not a line competing with XP and
  // badges for attention — shown once, then out of the way for good.
  const [showProtector, setShowProtector] = useState(() => !!state?.protectorGifted);

  useEffect(() => {
    if (!state) navigate('/home', { replace: true });
  }, [state, navigate]);

  if (!state) return null;

  const { nodeTitle, newBadgeIds, stage, maxStage, correctCount, totalQuestions } = state;

  if (showProtector) {
    return <ProtectorCelebration onContinue={() => setShowProtector(false)} />;
  }

  const perfect = correctCount === totalQuestions;
  const earnedBadges = BADGES.filter((b) => newBadgeIds?.includes(b.id));
  const justPlatinumed = maxStage > 0 && stage >= maxStage;

  return (
    <ResultsScreen
      title={perfect ? '¡Lección perfecta!' : '¡Lección completada!'}
      subtitle={nodeTitle}
      xpEarned={state.xpEarned ?? 0}
      correctCount={correctCount}
      totalQuestions={totalQuestions}
      // The pitch replaces the trip back to the map rather than interrupting
      // one: you finish, you're congratulated, and only then are you shown
      // something. Its own "ahora no" is what continues to the map.
      onContinue={() => {
        if (shouldPitchUltra()) {
          markUltraPitched();
          navigate('/ultra');
          return;
        }
        navigate('/home');
      }}
    >
      {maxStage > 0 && (
        <div className="mt-4 pt-4 border-t border-carbon-800">
          {justPlatinumed ? (
            <p className="flex items-center justify-center gap-1.5 text-sm font-black text-carbon-50 animate-pop-in">
              <Icon name="diamond" size={16} className="text-carbon-100" /> ¡Tema PLATINADO!
            </p>
          ) : (
            <>
              <div className="flex items-center justify-center gap-1 mb-2">
                {Array.from({ length: maxStage }).map((_, i) => (
                  <span
                    key={i}
                    className={`h-2 flex-1 rounded-full ${i < stage ? 'bg-lime-500' : 'bg-carbon-700'}`}
                  />
                ))}
              </div>
              <p className="text-xs font-bold text-carbon-400">
                Etapa {stage}/{maxStage} — te faltan {maxStage - stage} para PLATINO
              </p>
            </>
          )}
        </div>
      )}

      {earnedBadges.length > 0 && (
        <div className="mt-5 pt-4 border-t border-carbon-800">
          <p className="text-xs font-black text-carbon-400 uppercase mb-2">Nuevos logros</p>
          <div className="flex flex-wrap gap-2 justify-center">
            {earnedBadges.map((b, i) => (
              <div
                key={b.id}
                className="flex items-center gap-1.5 bg-lime-500/10 border border-lime-500/30 rounded-full px-3 py-1.5 animate-pop-in"
                style={{ animationDelay: `${0.4 + i * 0.15}s`, animationFillMode: 'backwards' }}
              >
                <Icon name={b.icon} size={16} className="text-lime-400" />
                <span className="text-xs font-extrabold text-carbon-100">{b.title}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </ResultsScreen>
  );
}
