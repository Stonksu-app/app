import { useEffect, useState } from 'react';

interface NodeRingProps {
  /** 0–1. Clamped, so callers can pass stage/maxStage without guarding. */
  progress: number;
  /** Outer diameter. The node it wraps should be comfortably smaller. */
  size?: number;
  stroke?: number;
}

/**
 * The arc that wraps a map node and fills as you clear its stages.
 *
 * Absolutely centred, so the parent needs `position: relative` and the ring
 * needs to be bigger than the node — the dark gap between the two is what keeps
 * a lime arc legible against a lime node.
 */
export default function NodeRing({ progress, size = 92, stroke = 6 }: NodeRingProps) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const target = Math.min(1, Math.max(0, progress));

  // Starts empty and fills on mount, the way Duolingo's does — the transition
  // needs a starting value to animate away from. Deliberately a timer and not
  // requestAnimationFrame: rAF never fires while the tab isn't compositing, so
  // an unfocused tab would render the ring permanently empty. A timer is only
  // throttled, so the ring still ends up correct.
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const id = setTimeout(() => setShown(target), 0);
    return () => clearTimeout(id);
  }, [target]);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden="true"
      className="absolute top-1/2 left-1/2 pointer-events-none"
      // Centred with explicit pixel margins rather than a -50% transform:
      // percentage transforms on an <svg> resolve against its viewBox, not its
      // border box, which puts the ring a half-diameter up and to the left.
      style={{ marginLeft: -size / 2, marginTop: -size / 2 }}
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--color-carbon-700)"
        strokeWidth={stroke}
      />
      {/* Always mounted, even at zero progress: a full dash offset already
          hides it, and keeping it in the tree is what lets the fill animate. */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--color-lime-400)"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - shown)}
        // Starts the arc at 12 o'clock instead of 3. An SVG transform attribute
        // with an explicit origin, so it can't be thrown off by transform-box.
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 700ms cubic-bezier(0.22, 1, 0.36, 1)' }}
      />

    </svg>
  );
}
