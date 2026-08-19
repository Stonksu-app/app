import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MAX_HEARTS, useUserStore, xpToLevel } from '../store/useUserStore';
import { formatCountdown, useHeartRegen } from '../hooks/useHeartRegen';
import Icon from './Icon';
import Mascot from './Mascot';

/* Stats only, the way Duolingo's phone header works: each counter opens a panel
 * underneath it. Navigation lives in BottomNav / NavRail, not here. */

type Panel = 'streak' | 'xp' | 'hearts';

const DAY_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

/** Attempts are stored as UTC timestamps, but the calendar grid is built from
 *  local dates. Slicing the ISO string would put a late-evening lesson on the
 *  previous day for anyone east of UTC, so derive the key locally instead. */
function localDayKey(date: Date) {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${m}-${d}`;
}

/** Month grid for the streak panel, with the days you actually practised
 *  pulled out of the recorded attempts. */
function StreakCalendar({ activeDays }: { activeDays: Set<string> }) {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const todayKey = localDayKey(today);

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // getDay() is Sunday-first; shift so the grid starts on Monday.
  const leading = (new Date(year, month, 1).getDay() + 6) % 7;

  const cells: (number | null)[] = [
    ...Array.from({ length: leading }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div className="rounded-2xl border-2 border-carbon-800 p-3">
      <p className="text-center text-[13px] font-black text-carbon-200 uppercase tracking-wide mb-2">
        {MONTHS[month]} de {year}
      </p>
      <div className="grid grid-cols-7 gap-y-1">
        {DAY_LABELS.map((d) => (
          <span key={d} className="text-center text-[11px] font-black text-carbon-500">
            {d}
          </span>
        ))}
        {cells.map((day, i) => {
          if (day === null) return <span key={`empty-${i}`} />;
          const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const practised = activeDays.has(key);
          const isToday = key === todayKey;
          return (
            <span
              key={key}
              className={`mx-auto w-7 h-7 flex items-center justify-center rounded-full text-[12px] font-bold ${
                practised
                  ? 'bg-lime-500 text-carbon-900'
                  : isToday
                  ? 'bg-carbon-800 text-carbon-100 ring-2 ring-carbon-600'
                  : 'text-carbon-500'
              }`}
            >
              {day}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export default function TopBar() {
  const { streak, xp, attempts } = useUserStore();
  const { hearts, msUntilNextHeart } = useHeartRegen();
  const [open, setOpen] = useState<Panel | null>(null);
  const { level, xpIntoLevel, xpForNext } = xpToLevel(xp);

  const activeDays = new Set(attempts.map((a) => localDayKey(new Date(a.completedAt))));
  const toggle = (p: Panel) => setOpen((cur) => (cur === p ? null : p));

  const stat = (panel: Panel, icon: React.ReactNode, value: string | number) => (
    <button
      onClick={() => toggle(panel)}
      aria-expanded={open === panel}
      className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-black text-carbon-50 transition ${
        open === panel ? 'bg-carbon-800' : 'hover:bg-carbon-850'
      }`}
    >
      {icon}
      {value}
    </button>
  );

  return (
    <header className="sticky top-0 z-30 bg-carbon-900/95 backdrop-blur border-b-2 border-carbon-800 pt-safe">
      <div className="max-w-2xl mx-auto px-3 py-2 flex items-center justify-between gap-2">
        <Link to="/home" className="shrink-0" aria-label="Stonksu">
          <Mascot size={32} mood="happy" />
        </Link>

        <div className="flex items-center gap-1">
          {stat(
            'streak',
            <Icon
              name="flame"
              size={20}
              className={streak > 0 ? 'text-lime-500 animate-flame-flicker' : 'text-carbon-600'}
            />,
            streak
          )}
          {stat('xp', <Icon name="star" size={20} className="text-lime-500" />, xp)}
          {stat('hearts', <Icon name="heart" size={20} className="text-lime-500" />, hearts)}
        </div>
      </div>

      {open && (
        <div className="border-t-2 border-carbon-800 bg-carbon-900 animate-pop-in">
          <div className="max-w-2xl mx-auto px-4 py-4">
            {open === 'streak' && (
              <>
                <p className="text-2xl font-black text-carbon-50">
                  {streak} {streak === 1 ? 'día' : 'días'} de racha
                </p>
                {streak === 0 && (
                  <p className="text-sm text-carbon-400 mt-1">
                    Haz una lección hoy y empieza tu racha.
                  </p>
                )}
                <div className="mt-3">
                  <StreakCalendar activeDays={activeDays} />
                </div>
              </>
            )}

            {open === 'xp' && (
              <>
                <p className="text-2xl font-black text-carbon-50">{xp} XP</p>
                <p className="text-sm text-carbon-400 mt-0.5">Nivel {level}</p>
                <div className="mt-3 h-2.5 rounded-full bg-carbon-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-lime-500 transition-all"
                    style={{ width: `${(xpIntoLevel / xpForNext) * 100}%` }}
                  />
                </div>
                <p className="text-xs font-bold text-carbon-400 mt-2">
                  Te faltan {xpForNext - xpIntoLevel} XP para el nivel {level + 1}
                </p>
              </>
            )}

            {open === 'hearts' && (
              <>
                <p className="text-2xl font-black text-carbon-50 text-center">Vidas</p>
                <div className="flex justify-center gap-1.5 mt-2">
                  {Array.from({ length: MAX_HEARTS }).map((_, i) => (
                    <Icon
                      key={i}
                      name="heart"
                      size={26}
                      className={i < hearts ? 'text-lime-500' : 'text-carbon-700'}
                    />
                  ))}
                </div>
                <p className="text-center font-black text-carbon-100 mt-3">
                  {hearts >= MAX_HEARTS ? 'Tienes todas las vidas' : `Te quedan ${hearts}`}
                </p>
                <p className="text-center text-sm text-carbon-400 mt-0.5">
                  {hearts >= MAX_HEARTS
                    ? 'Ya puedes seguir aprendiendo'
                    : msUntilNextHeart !== null
                    ? `Próxima vida en ${formatCountdown(msUntilNextHeart)}`
                    : 'Sigue aprendiendo'}
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
