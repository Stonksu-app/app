import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from './Button';
import Icon from './Icon';
import HeartsDisplay from './HeartsDisplay';
import Mascot from './Mascot';

export default function LessonHeader({ progressPct, hearts }: { progressPct: number; hearts: number }) {
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
        <div className="flex-1 h-3 bg-carbon-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-lime-500 rounded-full transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
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
            <Mascot size={90} mood="sad" className="mx-auto" />
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
