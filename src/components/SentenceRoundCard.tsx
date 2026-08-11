import { useMemo, useState } from 'react';
import type { SentenceRound } from '../types';
import Icon from './Icon';
import { shuffle } from '../utils/shuffle';

export default function SentenceRoundCard({
  round,
  instructions,
  onDone,
  onResult,
}: {
  round: SentenceRound;
  instructions: string;
  onDone: () => void;
  onResult?: (correct: boolean) => void;
}) {
  const options = useMemo(
    () =>
      shuffle([
        { id: 'correct', label: round.chunks[round.blankIndex] },
        ...round.distractors.map((d, i) => ({ id: `w${i}`, label: d })),
      ]),
    [round]
  );

  const sentence = useMemo(
    () => round.chunks.map((c, i) => (i === round.blankIndex ? '____' : c)).join(' '),
    [round]
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const isCorrect = checked && selectedId === 'correct';

  const handleSelect = (id: string) => {
    if (checked) return;
    setSelectedId(id);
  };

  const handleCheck = () => {
    if (!selectedId) return;
    const correct = selectedId === 'correct';
    setChecked(true);
    onResult?.(correct);
  };

  const handleContinue = () => {
    if (!checked) return;
    if (!isCorrect) {
      setChecked(false);
      setSelectedId(null);
      return;
    }
    onDone();
  };

  return (
    <div className="w-full">
      <p className="text-sm text-carbon-400 font-medium text-center mb-1">{instructions}</p>
      <p className="text-xs font-black text-lime-400 uppercase text-center mb-4">{round.term}</p>

      <p className="text-lg font-bold text-carbon-50 text-center leading-relaxed mb-6">{sentence}</p>

      <div className="grid grid-cols-1 gap-3 mb-6">
        {options.map((opt) => {
          const isSelected = selectedId === opt.id;
          const showCorrect = checked && opt.id === 'correct';
          const showIncorrect = checked && isSelected && opt.id !== 'correct';
          return (
            <button
              key={opt.id}
              onClick={() => handleSelect(opt.id)}
              disabled={checked}
              className={`text-left px-4 py-3.5 rounded-2xl border-2 font-bold transition flex items-center gap-3 ${
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

      {checked && !isCorrect && (
        <p className="text-center text-danger-400 text-sm font-bold mb-3">No es la palabra correcta, ¡inténtalo de nuevo!</p>
      )}

      <button
        onClick={checked ? handleContinue : handleCheck}
        disabled={!selectedId}
        className={`w-full font-black text-lg py-3.5 rounded-2xl transition active:scale-95 disabled:cursor-not-allowed ${
          checked
            ? isCorrect
              ? 'bg-lime-500 hover:bg-lime-400 text-carbon-900'
              : 'bg-danger-500 hover:bg-danger-600 text-white'
            : 'bg-lime-500 disabled:bg-carbon-800 disabled:text-carbon-500 hover:enabled:bg-lime-400 text-carbon-900'
        }`}
      >
        {checked ? (isCorrect ? 'Continuar' : 'Reintentar') : 'Comprobar'}
      </button>
    </div>
  );
}
