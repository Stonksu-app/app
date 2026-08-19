import { useEffect, useMemo, useState } from 'react';
import type { MatchPairsGame as MatchPairsGameType } from '../types';
import { Button } from './Button';
import Icon from './Icon';
import { shuffle } from '../utils/shuffle';

export default function MatchPairsGame({
  pairs,
  instructions,
  onDone,
  onResult,
}: {
  pairs: MatchPairsGameType['pairs'];
  instructions: string;
  onDone: () => void;
  onResult?: (correct: boolean) => void;
}) {
  const terms = useMemo(() => shuffle(pairs.map((p) => ({ id: p.id, label: p.term }))), [pairs]);
  const defs = useMemo(() => shuffle(pairs.map((p) => ({ id: p.id, label: p.definition }))), [pairs]);
  const rows = useMemo(() => terms.map((t, i) => ({ term: t, def: defs[i] })), [terms, defs]);

  const [selectedTerm, setSelectedTerm] = useState<string | null>(null);
  const [selectedDef, setSelectedDef] = useState<string | null>(null);
  const [solved, setSolved] = useState<string[]>([]);
  const [wrongPair, setWrongPair] = useState<{ term: string; def: string } | null>(null);

  const allSolved = solved.length === pairs.length;

  useEffect(() => {
    if (!selectedTerm || !selectedDef) return;
    if (selectedTerm === selectedDef) {
      setSolved((s) => [...s, selectedTerm]);
      setSelectedTerm(null);
      setSelectedDef(null);
      onResult?.(true);
    } else {
      setWrongPair({ term: selectedTerm, def: selectedDef });
      onResult?.(false);
      const t = setTimeout(() => {
        setWrongPair(null);
        setSelectedTerm(null);
        setSelectedDef(null);
      }, 500);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTerm, selectedDef]);

  const trySelect = (kind: 'term' | 'def', id: string) => {
    if (wrongPair || solved.includes(id)) return;
    if (kind === 'term') setSelectedTerm(id);
    else setSelectedDef(id);
  };

  return (
    <div className="w-full">
      <p className="text-sm text-carbon-400 font-medium text-center mb-5">{instructions}</p>
      <div className="grid grid-cols-2 gap-x-3 gap-y-2">
        {rows.map(({ term: t, def: d }) => {
          const termSolved = solved.includes(t.id);
          const termSelected = selectedTerm === t.id;
          const termWrong = wrongPair?.term === t.id;
          const defSolved = solved.includes(d.id);
          const defSelected = selectedDef === d.id;
          const defWrong = wrongPair?.def === d.id;
          return (
            <div key={t.id} className="contents">
              <button
                disabled={termSolved}
                onClick={() => trySelect('term', t.id)}
                className={`text-left px-3 py-3 rounded-xl border-2 text-sm font-bold transition h-full ${
                  termSolved
                    ? 'border-lime-500/30 bg-lime-500/5 text-carbon-600 opacity-50'
                    : termWrong
                    ? 'border-danger-500 bg-danger-950 text-danger-400 animate-shake'
                    : termSelected
                    ? 'border-lime-500 bg-lime-500/10 text-lime-300'
                    : 'border-carbon-800 bg-carbon-850 text-carbon-100 hover:border-carbon-600'
                }`}
              >
                {t.label}
              </button>
              <button
                disabled={defSolved}
                onClick={() => trySelect('def', d.id)}
                className={`text-left px-3 py-3 rounded-xl border-2 text-xs font-semibold transition h-full ${
                  defSolved
                    ? 'border-lime-500/30 bg-lime-500/5 text-carbon-600 opacity-50'
                    : defWrong
                    ? 'border-danger-500 bg-danger-950 text-danger-400 animate-shake'
                    : defSelected
                    ? 'border-lime-500 bg-lime-500/10 text-lime-300'
                    : 'border-carbon-800 bg-carbon-850 text-carbon-200 hover:border-carbon-600'
                }`}
              >
                {d.label}
              </button>
            </div>
          );
        })}
      </div>

      {allSolved && (
        <div className="mt-6 flex flex-col items-center gap-3 animate-pop-in">
          <Icon name="check" size={28} className="text-lime-500" />
          <div className="w-full max-w-xs">
            <Button onClick={onDone}>Continuar</Button>
          </div>
        </div>
      )}
    </div>
  );
}
