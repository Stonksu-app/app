import { useMemo, useRef, useState } from 'react';
import type { SequenceGame as SequenceGameType } from '../types';
import { Button } from './Button';
import { shuffle } from '../utils/shuffle';

const ROW_HEIGHT = 82;

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
  const [order, setOrder] = useState(() => shuffle(steps).map((s) => s.id));
  const [checked, setChecked] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);

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

  const handlePointerDown = (e: React.PointerEvent, id: string) => {
    // Only a solved order should freeze the boxes — after a wrong guess you
    // still need to be able to drag them into a new order to try again.
    if (checked && isCorrect) return;
    (e.target as Element).setPointerCapture(e.pointerId);
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
  };

  const handleCheck = () => {
    const correct = order.every((id, i) => stepsById.get(id)!.order === i + 1);
    setIsCorrect(correct);
    setChecked(true);
    onResult?.(correct);
  };

  return (
    <div className="w-full">
      <p className="text-sm text-carbon-400 font-medium text-center mb-1">{instructions}</p>
      <p className="text-xs text-carbon-500 text-center mb-4">Arrastra para ordenar</p>

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
              className={`absolute left-0 right-0 flex items-center gap-3 px-3 py-3 rounded-xl border-2 text-sm font-bold touch-none cursor-grab active:cursor-grabbing overflow-hidden ${
                isDragging ? 'z-10 shadow-lg' : 'transition-transform duration-200'
              } ${
                checked && isCorrect
                  ? 'border-lime-500 bg-lime-500/10 text-lime-300'
                  : 'border-carbon-800 bg-carbon-850 text-carbon-100'
              }`}
              style={{ top, height: ROW_HEIGHT - 8, transform: `translateY(${offset}px)` }}
            >
              <span className="w-6 h-6 rounded-full bg-carbon-800 text-carbon-300 text-xs font-black flex items-center justify-center shrink-0">
                {i + 1}
              </span>
              <span className="flex-1 line-clamp-2 leading-snug">{step.label}</span>
            </div>
          );
        })}
      </div>

      {checked && !isCorrect && (
        <p className="text-center text-danger-400 text-sm font-bold mt-3">Ese orden no es correcto, ¡sigue intentando!</p>
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
