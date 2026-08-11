import { useState } from 'react';
import type { Flashcard } from '../types';
import Icon from './Icon';

export default function FlashcardDeck({ cards, onDone }: { cards: Flashcard[]; onDone: () => void }) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const card = cards[index];
  const isLast = index === cards.length - 1;

  const handleNext = () => {
    if (!flipped) {
      setFlipped(true);
      return;
    }
    if (isLast) {
      onDone();
      return;
    }
    setIndex((i) => i + 1);
    setFlipped(false);
  };

  return (
    <div className="w-full flex flex-col items-center">
      <div className="flex gap-1.5 mb-5">
        {cards.map((_, i) => (
          <span
            key={i}
            className={`h-1.5 rounded-full transition-all ${
              i === index ? 'w-6 bg-lime-500' : i < index ? 'w-1.5 bg-lime-500/50' : 'w-1.5 bg-carbon-700'
            }`}
          />
        ))}
      </div>

      <button
        onClick={() => {
          if (!flipped) setFlipped(true);
        }}
        disabled={flipped}
        className="w-full max-w-xs aspect-[4/5] [perspective:1000px]"
        aria-label={flipped ? 'Definición visible' : 'Voltear para ver la definición'}
      >
        <div
          className={`relative w-full h-full transition-transform duration-500 [transform-style:preserve-3d] ${
            flipped ? '[transform:rotateY(180deg)]' : ''
          }`}
        >
          <div className="absolute inset-0 [backface-visibility:hidden] bg-carbon-850 border-2 border-lime-500/40 rounded-3xl flex flex-col items-center justify-center p-6 text-center gap-3">
            <Icon name="cards" size={28} className="text-lime-500" />
            <p className="text-2xl font-black text-carbon-50">{card.term}</p>
            <p className="text-xs text-carbon-500 font-bold uppercase">Toca para ver qué significa</p>
          </div>
          <div className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)] bg-lime-500 rounded-3xl flex flex-col items-center justify-center p-6 text-center gap-3">
            <p className="text-lg font-bold text-carbon-900">{card.definition}</p>
          </div>
        </div>
      </button>

      <p className="text-xs text-carbon-500 font-bold mt-4">
        {index + 1} / {cards.length}
      </p>

      <button
        onClick={handleNext}
        className="mt-6 w-full max-w-xs bg-lime-500 hover:bg-lime-400 text-carbon-900 font-black text-lg py-3.5 rounded-2xl transition active:scale-95"
      >
        {!flipped ? 'Voltear' : isLast ? 'Continuar' : 'Siguiente'}
      </button>
    </div>
  );
}
