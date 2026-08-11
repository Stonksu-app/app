import Icon from './Icon';

export default function StreakPill({ combo }: { combo: number }) {
  if (combo < 2) return null;
  return (
    <span
      key={`combo-${combo}`}
      className="flex items-center gap-1 text-[11px] font-black text-lime-400 bg-lime-500/10 px-2 py-0.5 rounded-full animate-count-pop"
    >
      <Icon name="flame" size={11} className="animate-flame-flicker" />
      x{combo}
    </span>
  );
}
