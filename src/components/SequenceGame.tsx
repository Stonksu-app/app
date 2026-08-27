import { useMemo, useRef, useState } from 'react';
import type { SequenceGame as SequenceGameType } from '../types';
import { Button } from './Button';
import Icon from './Icon';
import { shuffleUnsolved } from '../utils/shuffle';

/** Tall enough for three lines of a long step. The labels are sentences, and
 *  a step you can only half-read is a step you can only guess at. */
const ROW_HEIGHT = 92;

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
  const stepsById = useMemo(() => new Map(steps.map((s) => [s.id, s])), [steps]);
  /**
   * Shuffled, and never handed to you already solved.
   *
   * A shuffle that lands on the answer — one time in 24 with four steps —
   * turns the exercise into a button you press, and the player can't tell
   * that's what happened. Reshuffles until at least one step is out of place.
   */
  /** Shuffled, and never handed to you already solved — see shuffleUnsolved. */
  const [order, setOrder] = useState(() => {
    const solved = [...steps].sort((a, b) => a.order - b.order).map((s) => s.id);
    return shuffleUnsolved(steps.map((s) => s.id), solved);
  });

  const [checked, setChecked] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  /**
   * Which rows were in the right place at the last check.
   *
   * Ordering six things has 720 answers and the game used to reply "no" to
   * all but one of them, which leaves guessing as the only strategy. Marking
   * the ones already in place turns it into a puzzle you can reason about —
   * and it's the same information a teacher would give.
   */
  const [placed, setPlaced] = useState<Set<string>>(new Set());

  const [dragId, setDragId] = useState<string | null>(null);
  const [dragDelta, setDragDelta] = useState(0);
  const startYRef = useRef(0);
  const dragFromIndexRef = useRef(0);

  const targetIndexFor = (id: string) => {
    if (dragId !== id) return order.indexOf(id);
    const fromIndex = dragFromIndexRef.current;
    const shift = Math.round(dragDelta / ROW_HEIGHT);
    return Math.min(order.length - 1, Math.max(0, fromIndex + shift));
  };

  const visualOffset = (id: string): number => {
    if (!dragId || dragId === id) return 0;
    const fromIndex = dragFromIndexRef.current;
    const toIndex = targetIndexFor(dragId);
    const idIndex = order.indexOf(id);
    if (fromIndex < toIndex && idIndex > fromIndex && idIndex <= toIndex) return -1;
    if (fromIndex > toIndex && idIndex >= toIndex && idIndex < fromIndex) return 1;
    return 0;
  };

  /** Reordering without dragging. On a phone, hauling a row across a
   *  six-item list is the hard part of this exercise, and it isn't the part
   *  that teaches anything. */
  const move = (id: string, delta: number) => {
    if (checked && isCorrect) return;
    const from = order.indexOf(id);
    const to = from + delta;
    if (to < 0 || to >= order.length) return;
    const next = [...order];
    next.splice(to, 0, next.splice(from, 1)[0]);
    setOrder(next);
    setChecked(false);
    setPlaced(new Set());
  };

  const handlePointerDown = (e: React.PointerEvent, id: string) => {
    // Only a solved order should freeze the boxes — after a wrong guess you
    // still need to be able to drag them into a new order to try again.
    if (checked && isCorrect) return;
    // The row, not the child the finger landed on: capturing on an inner
    // span meant a drag that started on the arrows or the text behaved
    // differently from one that started on the card.
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    setDragId(id);
    dragFromIndexRef.current = order.indexOf(id);
    startYRef.current = e.clientY;
    setDragDelta(0);
  };

  const handlePointerMove = (e: React.PointerEvent, id: string) => {
    if (dragId !== id) return;
    setDragDelta(e.clientY - startYRef.current);
  };

  const endDrag = (id: string) => {
    if (dragId !== id) return;
    const toIndex = targetIndexFor(id);
    const fromIndex = dragFromIndexRef.current;
    if (toIndex !== fromIndex) {
      const next = [...order];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      setOrder(next);
    }
    setDragId(null);
    setDragDelta(0);
    setChecked(false);
    setPlaced(new Set());
  };

  const handleCheck = () => {
    const rightPlaces = order.filter((id, i) => stepsById.get(id)!.order === i + 1);
    const correct = rightPlaces.length === order.length;
    setPlaced(new Set(rightPlaces));
    setIsCorrect(correct);
    setChecked(true);
    onResult?.(correct);
  };

  return (
    <div className="w-full">
      <p className="text-sm text-carbon-400 font-medium text-center mb-1">{instructions}</p>
      <p className="text-xs text-carbon-500 text-center mb-4">
        Arrastra, o usa las flechas para mover cada paso
      </p>

      <div
        className={`relative select-none ${checked && !isCorrect ? 'animate-shake' : ''}`}
        style={{ height: order.length * ROW_HEIGHT - 8 }}
      >
        {order.map((id, i) => {
          const step = stepsById.get(id)!;
          const isDragging = dragId === id;
          const offset = isDragging ? dragDelta : visualOffset(id) * ROW_HEIGHT;
          const top = i * ROW_HEIGHT;
          return (
            <div
              key={id}
              onPointerDown={(e) => handlePointerDown(e, id)}
              onPointerMove={(e) => handlePointerMove(e, id)}
              onPointerUp={() => endDrag(id)}
              onPointerCancel={() => endDrag(id)}
              className={`absolute left-0 right-0 flex items-center gap-2.5 pl-3 pr-1.5 py-3 rounded-xl border-2 text-sm font-bold touch-none overflow-hidden ${
                isDragging ? 'z-10 shadow-lg' : 'transition-transform duration-200'
              } ${
                checked && placed.has(id)
                  ? 'border-lime-500 bg-lime-500/10 text-lime-300'
                  : 'border-carbon-800 bg-carbon-850 text-carbon-100'
              }`}
              style={{ top, height: ROW_HEIGHT - 8, transform: `translateY(${offset}px)` }}
            >
              <span
                className={`w-6 h-6 rounded-full text-xs font-black flex items-center justify-center shrink-0 ${
                  checked && placed.has(id)
                    ? 'bg-lime-500 text-carbon-900'
                    : 'bg-carbon-800 text-carbon-300'
                }`}
              >
                {checked && placed.has(id) ? <Icon name="check" size={13} strokeWidth={3.5} /> : i + 1}
              </span>
              <span className="flex-1 line-clamp-3 leading-snug cursor-grab active:cursor-grabbing">
                {step.label}
              </span>

              {/* Big enough to hit with a thumb, and stacked so the pair takes
                  one row's height rather than widening the card. */}
              <span className="flex flex-col shrink-0">
                <button
                  onClick={() => move(id, -1)}
                  disabled={i === 0 || (checked && isCorrect)}
                  aria-label={`Subir: ${step.label}`}
                  className="w-9 h-[30px] flex items-center justify-center rounded-t-lg text-carbon-400 hover:text-carbon-100 hover:bg-carbon-800 disabled:opacity-25 disabled:hover:bg-transparent transition"
                >
                  <Icon name="chevron-up" size={18} strokeWidth={2.6} />
                </button>
                <button
                  onClick={() => move(id, 1)}
                  disabled={i === order.length - 1 || (checked && isCorrect)}
                  aria-label={`Bajar: ${step.label}`}
                  className="w-9 h-[30px] flex items-center justify-center rounded-b-lg text-carbon-400 hover:text-carbon-100 hover:bg-carbon-800 disabled:opacity-25 disabled:hover:bg-transparent transition"
                >
                  <Icon name="chevron-down" size={18} strokeWidth={2.6} />
                </button>
              </span>
            </div>
          );
        })}
      </div>

      {/* Says how close you are, not just that you're wrong. Zero right is
          worth saying plainly too — it usually means the whole thing is
          upside down, which is a much easier fix than it looks. */}
      {checked && !isCorrect && (
        <p className="text-center text-sm font-bold mt-3 text-carbon-300">
          {placed.size === 0 ? (
            <span className="text-danger-400">Ninguno está en su sitio todavía. Prueba a darle la vuelta.</span>
          ) : (
            <>
              <span className="text-lime-400">
                {placed.size} de {order.length}
              </span>{' '}
              en su sitio. Mueve los demás.
            </>
          )}
        </p>
      )}

      <div className="mt-6">
        {checked && isCorrect ? (
          <Button onClick={onDone}>Continuar</Button>
        ) : (
          <Button onClick={handleCheck}>Comprobar orden</Button>
        )}
      </div>
    </div>
  );
}
