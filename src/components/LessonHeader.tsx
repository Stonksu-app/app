import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from './Button';
import Icon from './Icon';
import HeartsDisplay from './HeartsDisplay';
import Avatar from './Avatar';

/**
 * Where the answer streak now shows up.
 *
 * Three states, in the bar the player is already watching: the app's lime,
 * then gold at three in a row, then gold running into orange at six. Red is
 * left alone on purpose — in a lesson it means a wrong answer, and a bar that
 * turned red while you were doing well would read as a warning.
 */
const COMBO_FILL: Record<number, string> = {
  0: 'bg-lime-500',
  1: 'bg-[#FFC93C]',
  2: 'bg-[linear-gradient(90deg,#FFC93C_0%,#FF8A3D_100%)] combo-glow',
};

export default function LessonHeader({
  progressPct,
  hearts,
  comboTier = 0,
  combo = 0,
}: {
  progressPct: number;
  hearts: number;
  comboTier?: number;
  combo?: number;
}) {
  const navigate = useNavigate();
  // Leaving mid-lesson throws the session away — nothing is recorded until the
  // last activity — so the exit is confirmed rather than immediate.
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="shrink-0 pt-safe">
      <div className="max-w-xl w-full mx-auto px-4 pt-4 pb-1 flex items-center gap-3">
        <button
          onClick={() => setConfirming(true)}
          className="text-carbon-500 hover:text-carbon-300 transition"
          aria-label="Salir de la lección"
        >
          <Icon name="close" size={24} />
        </button>
        <div className="flex-1 flex items-center gap-2 min-w-0">
          <div className="flex-1 h-3 bg-carbon-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                COMBO_FILL[comboTier] ?? COMBO_FILL[0]
              }`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
          {/* The count, small and beside the bar rather than over the question.
              Only from the first tier: "x1" would be noise on every answer. */}
          {comboTier > 0 && (
            <span
              key={combo}
              className={`shrink-0 flex items-center gap-0.5 text-[11px] font-black tabular-nums animate-count-pop ${
                comboTier >= 2 ? 'text-[#FF8A3D]' : 'text-[#FFC93C]'
              }`}
            >
              <Icon name="flame" size={12} className="animate-flame-flicker" />x{combo}
            </span>
          )}
        </div>
        <HeartsDisplay hearts={hearts} />
      </div>

      {confirming && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-4"
          onClick={() => setConfirming(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Confirmar salida"
            className="bg-carbon-850 border-2 border-carbon-800 rounded-3xl w-full max-w-sm p-6 text-center animate-pop-in"
            onClick={(e) => e.stopPropagation()}
          >
            <Avatar size={90} mood="sad" className="mx-auto" />
            <h2 className="mt-3 text-xl font-black text-carbon-50">¿Seguro que quieres salir?</h2>
            <p className="mt-1.5 text-sm text-carbon-400">
              Perderás todo el progreso de esta lección y las vidas que hayas gastado.
            </p>

            <div className="mt-6 flex flex-col gap-3">
              <Button onClick={() => setConfirming(false)}>Seguir aprendiendo</Button>
              <Button variant="danger" onClick={() => navigate('/home')}>
                Salir de la lección
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
