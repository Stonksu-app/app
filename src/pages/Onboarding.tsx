import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Mascot from '../components/Mascot';
import Icon from '../components/Icon';
import { Button } from '../components/Button';
import { useUserStore } from '../store/useUserStore';
import type { IconName, TradingExperience } from '../types';

const EXPERIENCE_OPTIONS: { id: TradingExperience; label: string; icon: IconName }[] = [
  { id: 'none', label: 'Cero. Ni sé qué es una vela japonesa', icon: 'egg' },
  { id: 'beginner', label: 'He escuchado términos pero no opero', icon: 'sprout' },
  { id: 'some', label: 'Ya opero, pero quiero mejorar', icon: 'trending-up' },
  { id: 'experienced', label: 'Trader experimentado', icon: 'whale' },
];

const GOAL_OPTIONS: { id: string; label: string; icon: IconName }[] = [
  { id: 'learn-basics', label: 'Entender lo básico sin miedo', icon: 'book' },
  { id: 'side-income', label: 'Generar ingresos extra', icon: 'coins' },
  { id: 'discipline', label: 'Mejorar mi disciplina y psicología', icon: 'brain' },
  { id: 'fun', label: 'Solo por diversión / curiosidad', icon: 'gamepad' },
];

const STEPS = ['experience', 'goal', 'name'] as const;

export default function Onboarding() {
  const navigate = useNavigate();
  const { onboardingAnswers, setOnboardingAnswer, finishOnboarding } = useUserStore();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');

  const progress = ((step + 1) / STEPS.length) * 100;

  const goNext = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      finishOnboarding(name.trim());
      navigate('/home');
    }
  };

  const currentStep = STEPS[step];
  const canContinue =
    currentStep === 'experience'
      ? !!onboardingAnswers.experience
      : currentStep === 'goal'
      ? !!onboardingAnswers.goal
      : name.trim().length > 0;

  return (
    <div className="h-dvh bg-carbon-900 flex flex-col pt-safe pb-safe">
      <div className="shrink-0 max-w-xl w-full mx-auto px-5 pt-4">
        <div className="h-2.5 bg-carbon-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-lime-500 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto max-w-xl w-full mx-auto px-5 py-6 flex flex-col items-center justify-center text-center">
        <Mascot size={100} mood="happy" />

        {currentStep === 'experience' && (
          <div className="w-full mt-4 animate-pop-in">
            <h1 className="text-2xl sm:text-3xl font-black text-carbon-50">¿Cuál es tu experiencia en trading?</h1>
            <p className="text-carbon-400 mt-1">Así ajustamos el tono de las lecciones para ti.</p>
            <div className="mt-6 grid grid-cols-1 gap-3">
              {EXPERIENCE_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setOnboardingAnswer('experience', opt.id)}
                  className={`flex items-center gap-3 text-left px-4 py-3.5 rounded-2xl border-2 font-bold transition ${
                    onboardingAnswers.experience === opt.id
                      ? 'border-lime-500 bg-lime-500/10 text-lime-300'
                      : 'border-carbon-800 bg-carbon-850 text-carbon-200 hover:border-carbon-600'
                  }`}
                >
                  <Icon name={opt.icon} size={24} className="text-lime-500 shrink-0" />
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {currentStep === 'goal' && (
          <div className="w-full mt-4 animate-pop-in">
            <h1 className="text-2xl sm:text-3xl font-black text-carbon-50">¿Cuál es tu meta principal?</h1>
            <p className="text-carbon-400 mt-1">No hay respuestas incorrectas, fren.</p>
            <div className="mt-6 grid grid-cols-1 gap-3">
              {GOAL_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setOnboardingAnswer('goal', opt.id)}
                  className={`flex items-center gap-3 text-left px-4 py-3.5 rounded-2xl border-2 font-bold transition ${
                    onboardingAnswers.goal === opt.id
                      ? 'border-lime-500 bg-lime-500/10 text-lime-300'
                      : 'border-carbon-800 bg-carbon-850 text-carbon-200 hover:border-carbon-600'
                  }`}
                >
                  <Icon name={opt.icon} size={24} className="text-lime-500 shrink-0" />
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {currentStep === 'name' && (
          <div className="w-full mt-4 animate-pop-in">
            <h1 className="text-2xl sm:text-3xl font-black text-carbon-50">¿Cómo te llamamos?</h1>
            <p className="text-carbon-400 mt-1">Tu mascota Stonksu ya está lista para acompañarte.</p>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Tu nombre o apodo"
              className="mt-6 w-full text-center text-lg font-bold px-4 py-3.5 rounded-2xl border-2 border-carbon-700 focus:border-lime-500 outline-none bg-carbon-850 text-carbon-50 placeholder:text-carbon-500"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && canContinue) goNext();
              }}
            />
          </div>
        )}
      </div>

      <div className="shrink-0 max-w-xl w-full mx-auto px-5 pt-2 pb-5">
        <Button onClick={goNext} disabled={!canContinue}>
          {step < STEPS.length - 1 ? 'Continuar' : 'Empezar a aprender'}
        </Button>
      </div>
    </div>
  );
}
