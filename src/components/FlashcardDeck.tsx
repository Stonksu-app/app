import { useState } from 'react';
import type { Flashcard } from '../types';
import { Button } from './Button';
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
    // Fills whatever height the parent gives it: the card flexes so the button
    // below is always on screen, instead of a fixed aspect ratio pushing it off.
    <div className="w-full h-full flex flex-col items-center">
      <div className="shrink-0 flex gap-1.5 mb-4">
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
        className="flex-1 min-h-0 w-full max-w-xs [perspective:1000px]"
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
          {/* The term stays on the back, as a heading rather than a caption.
              Flipping a card answers "what does this mean?", and an answer
              that doesn't restate the question makes you flip back to check
              which word you were on. */}
          <div className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)] bg-lime-500 rounded-3xl flex flex-col p-6 text-center">
            <p className="shrink-0 text-lg font-black text-carbon-900 leading-tight">{card.term}</p>
            <span className="shrink-0 mt-3 h-0.5 w-12 self-center rounded-full bg-carbon-900/25" />
            <div className="flex-1 min-h-0 flex items-center justify-center overflow-y-auto">
              <p className="text-lg font-bold text-carbon-900 leading-snug">{card.definition}</p>
            </div>
          </div>
        </div>
      </button>

      <p className="shrink-0 text-xs text-carbon-500 font-bold mt-3">
        {index + 1} / {cards.length}
      </p>

      <div className="shrink-0 mt-4 w-full max-w-xs">
        <Button onClick={handleNext}>{!flipped ? 'Voltear' : isLast ? 'Continuar' : 'Siguiente'}</Button>
      </div>
    </div>
  );
}
