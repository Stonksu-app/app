import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Confetti from '../components/Confetti';
import Icon from '../components/Icon';
import Mascot, { randomLine } from '../components/Mascot';
import { BADGES } from '../data/badges';
import { useCountUp } from '../hooks/useCountUp';

interface ResultsState {
  correctCount: number;
  totalQuestions: number;
  xpEarned: number;
  nodeTitle: string;
  newBadgeIds: string[];
  stage: number;
  maxStage: number;
}

export default function LessonResults() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as ResultsState | null;

  useEffect(() => {
    if (!state) navigate('/home', { replace: true });
  }, [state, navigate]);

  const xpEarned = state?.xpEarned ?? 0;
  const totalQuestions = state?.totalQuestions ?? 0;
  const correctCount = state?.correctCount ?? 0;
  const accuracy = totalQuestions ? Math.round((correctCount / totalQuestions) * 100) : 0;
  const animatedXp = useCountUp(xpEarned);
  const animatedAccuracy = useCountUp(accuracy);
  const [completeLine] = useState(() => randomLine('lessonComplete'));

  if (!state) return null;

  const { nodeTitle, newBadgeIds, stage, maxStage } = state;
  const perfect = correctCount === totalQuestions;
  const earnedBadges = BADGES.filter((b) => newBadgeIds?.includes(b.id));
  const justPlatinumed = maxStage > 0 && stage >= maxStage;

  return (
    <div className="min-h-screen bg-carbon-900 flex flex-col items-center justify-center p-6 text-center relative overflow-hidden">
      <Confetti count={perfect ? 90 : 50} />

      <Mascot size={130} mood="hype" />
      <div className="flex items-center gap-2 mt-4">
        <Icon name={perfect ? 'trophy' : 'sparkles'} size={30} className="text-lime-500" />
        <h1 className="text-3xl sm:text-4xl font-black text-carbon-50">
          {perfect ? '¡Lección perfecta!' : '¡Lección completada!'}
        </h1>
      </div>
      <p className="text-carbon-300 mt-1 font-medium">{nodeTitle} — {completeLine}</p>

      <div className="mt-8 bg-carbon-850 border border-carbon-800 rounded-3xl p-6 w-full max-w-sm">
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-lime-500/10 rounded-2xl p-4">
            <p className="text-2xl font-black text-lime-400 tabular-nums">+{animatedXp}</p>
            <p className="text-xs font-bold text-carbon-400 uppercase">XP ganado</p>
          </div>
          <div className="bg-carbon-800 rounded-2xl p-4">
            <p className="text-2xl font-black text-carbon-50 tabular-nums">{animatedAccuracy}%</p>
            <p className="text-xs font-bold text-carbon-400 uppercase">Precisión</p>
          </div>
        </div>
        <p className="mt-4 text-sm font-bold text-carbon-300">
          {correctCount} de {totalQuestions} respuestas correctas
        </p>

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
      </div>

      <div className="mt-8 w-full max-w-sm flex flex-col gap-3">
        <button
          onClick={() => navigate('/home')}
          className="w-full bg-lime-500 hover:bg-lime-400 text-carbon-900 font-black text-lg py-4 rounded-2xl transition active:scale-95"
        >
          Continuar
        </button>
      </div>
    </div>
  );
}
