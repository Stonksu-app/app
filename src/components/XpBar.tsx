import { xpToLevel } from '../store/useUserStore';

export default function XpBar({ xp }: { xp: number }) {
  const { level, xpIntoLevel, xpForNext } = xpToLevel(xp);
  const pct = Math.round((xpIntoLevel / xpForNext) * 100);
  return (
    <div className="flex items-center gap-2 w-full">
      <span className="text-xs font-extrabold text-carbon-900 bg-lime-500 rounded-full w-7 h-7 flex items-center justify-center shrink-0">
        {level}
      </span>
      <div className="flex-1 h-3 bg-carbon-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-lime-500 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-bold text-carbon-400 shrink-0">{xpIntoLevel}/{xpForNext} XP</span>
    </div>
  );
}
