import Icon from './Icon';
import type { AchievementProgress } from '../data/achievements';

/** Metrics from the reference: 19px/700 title, tile with a level caption
 *  underneath, count on the right, bar and description below. */
export default function AchievementRow({ a }: { a: AchievementProgress }) {
  const pct = a.target > 0 ? Math.min(100, (a.value / a.target) * 100) : 0;
  const locked = a.level === 0 && a.value === 0;

  return (
    <div className="flex items-center gap-4 py-4 border-b-2 border-carbon-800 last:border-b-0">
      <div
        className={`w-[76px] shrink-0 rounded-2xl flex flex-col items-center justify-center py-3 ${
          locked ? 'bg-carbon-800 text-carbon-600' : a.tile
        }`}
      >
        <Icon name={a.icon} size={30} strokeWidth={1.9} />
        <span className="mt-1 text-[9px] font-black uppercase tracking-wide opacity-80">
          {a.maxed ? 'Máximo' : `Nivel ${a.level}`}
        </span>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-[19px] font-black text-carbon-50 truncate">{a.title}</h3>
          <span className="shrink-0 text-sm font-bold text-carbon-500 tabular-nums">
            {a.maxed ? '¡Completo!' : `${a.value}/${a.target}`}
          </span>
        </div>

        <div className="mt-2 h-3 rounded-full bg-carbon-800 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${a.maxed ? 'bg-[#FFC93C]' : 'bg-lime-500'}`}
            style={{ width: `${pct}%` }}
          />
        </div>

        <p className="mt-1.5 text-sm text-carbon-400 leading-snug">{a.description}</p>
      </div>
    </div>
  );
}
