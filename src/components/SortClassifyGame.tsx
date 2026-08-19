import { useState } from 'react';
import type { SortClassifyGame as SortClassifyGameType } from '../types';
import { Button } from './Button';
import Icon from './Icon';

export default function SortClassifyGame({
  items,
  instructions,
  bucketALabel,
  bucketBLabel,
  onDone,
  onResult,
}: {
  items: SortClassifyGameType['items'];
  instructions: string;
  bucketALabel: string;
  bucketBLabel: string;
  onDone: () => void;
  onResult?: (correct: boolean) => void;
}) {
  const [placed, setPlaced] = useState<Record<string, 'a' | 'b'>>({});
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [wrongItem, setWrongItem] = useState<string | null>(null);

  const remaining = items.filter((i) => !placed[i.id]);
  const allDone = remaining.length === 0;

  const handlePlace = (bucket: 'a' | 'b') => {
    if (!selectedItem) return;
    const item = items.find((i) => i.id === selectedItem);
    if (!item) return;
    if (item.bucket === bucket) {
      setPlaced((p) => ({ ...p, [item.id]: bucket }));
      setSelectedItem(null);
      onResult?.(true);
    } else {
      setWrongItem(item.id);
      setTimeout(() => setWrongItem(null), 500);
      setSelectedItem(null);
      onResult?.(false);
    }
  };

  return (
    <div className="w-full">
      <p className="text-sm text-carbon-400 font-medium text-center mb-5">{instructions}</p>

      <div className="flex flex-wrap gap-2 justify-center min-h-12 mb-5">
        {remaining.map((item) => (
          <button
            key={item.id}
            onClick={() => setSelectedItem(item.id)}
            className={`px-3 py-2 rounded-full border-2 text-sm font-bold transition ${
              wrongItem === item.id
                ? 'border-danger-500 bg-danger-950 text-danger-400 animate-shake'
                : selectedItem === item.id
                ? 'border-lime-500 bg-lime-500/10 text-lime-300'
                : 'border-carbon-700 bg-carbon-850 text-carbon-100 hover:border-carbon-500'
            }`}
          >
            {item.label}
          </button>
        ))}
        {remaining.length === 0 && <p className="text-sm text-carbon-500 font-bold">¡Todo clasificado!</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => handlePlace('a')}
          disabled={!selectedItem}
          className="rounded-2xl border-2 border-dashed border-lime-500/40 hover:enabled:border-lime-500 disabled:opacity-40 disabled:cursor-not-allowed p-4 min-h-28 flex flex-col gap-1.5 transition"
        >
          <span className="text-xs font-black text-lime-400 uppercase">{bucketALabel}</span>
          <div className="flex flex-wrap gap-1.5 justify-center">
            {items
              .filter((i) => placed[i.id] === 'a')
              .map((i) => (
                <span key={i.id} className="text-xs font-bold bg-lime-500/10 text-lime-300 px-2 py-1 rounded-full">
                  {i.label}
                </span>
              ))}
          </div>
        </button>
        <button
          onClick={() => handlePlace('b')}
          disabled={!selectedItem}
          className="rounded-2xl border-2 border-dashed border-danger-500/40 hover:enabled:border-danger-500 disabled:opacity-40 disabled:cursor-not-allowed p-4 min-h-28 flex flex-col gap-1.5 transition"
        >
          <span className="text-xs font-black text-danger-400 uppercase">{bucketBLabel}</span>
          <div className="flex flex-wrap gap-1.5 justify-center">
            {items
              .filter((i) => placed[i.id] === 'b')
              .map((i) => (
                <span key={i.id} className="text-xs font-bold bg-danger-500/10 text-danger-300 px-2 py-1 rounded-full">
                  {i.label}
                </span>
              ))}
          </div>
        </button>
      </div>

      {allDone && (
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
