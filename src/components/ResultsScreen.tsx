import { useState } from 'react';
import { Button } from './Button';
import Confetti from './Confetti';
import Icon from './Icon';
import Avatar from './Avatar';
import { randomLine } from './Mascot';
import { useCountUp } from '../hooks/useCountUp';
import type { IconName } from '../types';

/*
 * The screen you land on after finishing something.
 *
 * Shared rather than copied because the celebration *is* the reward: confetti,
 * the mascot, numbers counting up. A second version written separately would
 * drift, and finishing a practice round would quietly feel like less of an
 * achievement than finishing a lesson — which is the opposite of what you want
 * from the thing that gets people to revise.
 *
 * What differs between them goes in `children`: stage bars and badges for a
 * lesson, terms mastered for a practice round.
 */

export default function ResultsScreen({
  title,
  subtitle,
  icon,
  xpEarned,
  correctCount,
  totalQuestions,
  onContinue,
  continueLabel = 'Continuar',
  secondary,
  children,
}: {
  title: string;
  /** Appended after the mascot's line, which is picked once on mount. */
  subtitle: string;
  icon?: IconName;
  xpEarned: number;
  correctCount: number;
  totalQuestions: number;
  onContinue: () => void;
  continueLabel?: string;
  secondary?: { label: string; onClick: () => void };
  children?: React.ReactNode;
}) {
  const accuracy = totalQuestions ? Math.round((correctCount / totalQuestions) * 100) : 0;
  const animatedXp = useCountUp(xpEarned);
  const animatedAccuracy = useCountUp(accuracy);
  const [completeLine] = useState(() => randomLine('lessonComplete'));
  const perfect = totalQuestions > 0 && correctCount === totalQuestions;

  return (
    <div className="screen-safe bg-carbon-900 flex flex-col px-6 text-center relative">
      <Confetti count={perfect ? 90 : 50} />

      <div className="m-auto py-6 w-full flex flex-col items-center">
        <Avatar size={130} mood="hype" glow />
        <div className="flex items-center gap-2 mt-4">
          <Icon name={icon ?? (perfect ? 'trophy' : 'sparkles')} size={30} className="text-lime-500" />
          <h1 className="text-3xl sm:text-4xl font-black text-carbon-50">{title}</h1>
        </div>
        <p className="text-carbon-300 mt-1 font-medium">
          {subtitle} — {completeLine}
        </p>

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

          {children}
        </div>

        <div className="mt-8 w-full max-w-sm flex flex-col gap-3">
          <Button onClick={onContinue}>{continueLabel}</Button>
          {secondary && (
            <Button variant="secondary" onClick={secondary.onClick}>
              {secondary.label}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
