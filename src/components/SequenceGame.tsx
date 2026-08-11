import { useState } from 'react';
import type { SequenceGame as SequenceGameType } from '../types';
import Icon from './Icon';
import { shuffle } from '../utils/shuffle';

export default function SequenceGame({
  steps,
  instructions,
  onDone,
  onResult,
}: {
  steps: SequenceGameType['steps'];
  instructions: string;
  onDone: () => void;
  onResult?: (correct: boolean) => void;
}) {
  const [items, setItems] = useState(() => shuffle(steps));
  const [checked, setChecked] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    setItems(next);
    setChecked(false);
  };

  const handleCheck = () => {
    const correct = items.every((item, i) => item.order === i + 1);
    setIsCorrect(correct);
    setChecked(true);
    onResult?.(correct);
  };

  return (
    <div className="w-full">
      <p className="text-sm text-carbon-400 font-medium text-center mb-5">{instructions}</p>

      <div className={`flex flex-col gap-2 ${checked && !isCorrect ? 'animate-shake' : ''}`}>
        {items.map((item, i) => (
          <div
            key={item.id}
            className={`flex items-center gap-3 px-3 py-3 rounded-xl border-2 text-sm font-bold transition ${
              checked && isCorrect
                ? 'border-lime-500 bg-lime-500/10 text-lime-300'
                : 'border-carbon-800 bg-carbon-850 text-carbon-100'
            }`}
          >
            <span className="w-6 h-6 rounded-full bg-carbon-800 text-carbon-300 text-xs font-black flex items-center justify-center shrink-0">
              {i + 1}
            </span>
            <span className="flex-1">{item.label}</span>
            <div className="flex flex-col gap-0.5 shrink-0">
              <button
                onClick={() => move(i, -1)}
                disabled={i === 0}
                aria-label="Subir"
                className="text-carbon-400 disabled:opacity-20 hover:text-lime-400"
              >
                <Icon name="chevron-up" size={16} strokeWidth={2.5} />
              </button>
              <button
                onClick={() => move(i, 1)}
                disabled={i === items.length - 1}
                aria-label="Bajar"
                className="text-carbon-400 disabled:opacity-20 hover:text-lime-400"
              >
                <Icon name="chevron-down" size={16} strokeWidth={2.5} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {checked && !isCorrect && (
        <p className="text-center text-danger-400 text-sm font-bold mt-3">Ese orden no es correcto, ¡sigue intentando!</p>
      )}

      {checked && isCorrect ? (
        <button
          onClick={onDone}
          className="mt-6 w-full bg-lime-500 hover:bg-lime-400 text-carbon-900 font-black text-lg py-3.5 rounded-2xl transition active:scale-95"
        >
          Continuar
        </button>
      ) : (
        <button
          onClick={handleCheck}
          className="mt-6 w-full bg-lime-500 hover:bg-lime-400 text-carbon-900 font-black text-lg py-3.5 rounded-2xl transition active:scale-95"
        >
          Comprobar orden
        </button>
      )}
    </div>
  );
}
