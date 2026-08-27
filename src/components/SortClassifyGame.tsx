import { useRef, useState } from 'react';
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

  /*
   * Dragging, alongside the tap-then-tap that was already here.
   *
   * Both, not one: dragging is the obvious gesture for putting a thing in a
   * box, and tapping is the one that still works with a thumb on a moving bus,
   * or with a keyboard. The drag is pointer-based rather than HTML5
   * drag-and-drop, which does not fire on touch at all.
   */
  const [dragging, setDragging] = useState<{ id: string; x: number; y: number } | null>(null);
  const bucketRefs = useRef<Record<'a' | 'b', HTMLElement | null>>({ a: null, b: null });
  const [hoverBucket, setHoverBucket] = useState<'a' | 'b' | null>(null);
  /** Where the finger went down, so the chip follows it rather than jumping
   *  its own top-left corner to the cursor. */
  const startRef = useRef({ x: 0, y: 0 });

  /** Which bucket a point is over, or null between them. */
  const bucketAt = (x: number, y: number): 'a' | 'b' | null => {
    for (const key of ['a', 'b'] as const) {
      const box = bucketRefs.current[key]?.getBoundingClientRect();
      if (box && x >= box.left && x <= box.right && y >= box.top && y <= box.bottom) return key;
    }
    return null;
  };

  const remaining = items.filter((i) => !placed[i.id]);
  const allDone = remaining.length === 0;

  const handlePlace = (bucket: 'a' | 'b', itemId = selectedItem) => {
    if (!itemId) return;
    const item = items.find((i) => i.id === itemId);
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
      <p className="text-sm text-carbon-400 font-medium text-center mb-1">{instructions}</p>
      <p className="text-xs text-carbon-500 text-center mb-4">
        Arrastra cada palabra a su caja, o tócala y luego la caja
      </p>

      <div className="flex flex-wrap gap-2 justify-center min-h-12 mb-5">
        {remaining.map((item) => (
          <button
            key={item.id}
            onClick={() => setSelectedItem(item.id)}
            onPointerDown={(e) => {
              (e.currentTarget as Element).setPointerCapture(e.pointerId);
              setSelectedItem(item.id);
              startRef.current = { x: e.clientX, y: e.clientY };
              setDragging({ id: item.id, x: e.clientX, y: e.clientY });
            }}
            onPointerMove={(e) => {
              if (dragging?.id !== item.id) return;
              setDragging({ id: item.id, x: e.clientX, y: e.clientY });
              setHoverBucket(bucketAt(e.clientX, e.clientY));
            }}
            onPointerUp={(e) => {
              if (dragging?.id !== item.id) return;
              const bucket = bucketAt(e.clientX, e.clientY);
              setDragging(null);
              setHoverBucket(null);
              // Dropped on a bucket, it counts; dropped anywhere else the chip
              // simply stays selected, which is where the tap flow picks up.
              if (bucket) handlePlace(bucket, item.id);
            }}
            onPointerCancel={() => {
              setDragging(null);
              setHoverBucket(null);
            }}
            style={
              dragging?.id === item.id
                ? {
                    transform: `translate(${dragging.x - startRef.current.x}px, ${
                      dragging.y - startRef.current.y
                    }px)`,
                  }
                : undefined
            }
            className={`px-3 py-2 rounded-full border-2 text-sm font-bold touch-none transition ${
              dragging?.id === item.id ? 'z-20 relative shadow-lg cursor-grabbing' : 'cursor-grab'
            } ${
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
          ref={(el) => {
            bucketRefs.current.a = el;
          }}
          onClick={() => handlePlace('a')}
          disabled={!selectedItem}
          className={`rounded-2xl border-2 border-dashed p-4 min-h-28 flex flex-col gap-1.5 transition disabled:opacity-40 disabled:cursor-not-allowed ${
            hoverBucket === 'a'
              ? 'border-lime-500 bg-lime-500/10 scale-[1.02]'
              : 'border-lime-500/40 hover:enabled:border-lime-500'
          }`}
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
          ref={(el) => {
            bucketRefs.current.b = el;
          }}
          onClick={() => handlePlace('b')}
          disabled={!selectedItem}
          className={`rounded-2xl border-2 border-dashed p-4 min-h-28 flex flex-col gap-1.5 transition disabled:opacity-40 disabled:cursor-not-allowed ${
            hoverBucket === 'b'
              ? 'border-danger-500 bg-danger-500/10 scale-[1.02]'
              : 'border-danger-500/40 hover:enabled:border-danger-500'
          }`}
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
