import { Link } from 'react-router-dom';
import { localDayKey } from '../utils/streak';
import { MAX_HEARTS, useUserStore, xpToLevel } from '../store/useUserStore';
import { formatCountdown, useHeartRegen } from '../hooks/useHeartRegen';
import Icon from './Icon';

/* Contents of the streak / XP / hearts panels, shared by the phone header
 * (which taps them open) and the desktop rail (which reveals them on hover),
 * so the two can't drift apart. */

export type StatKey = 'streak' | 'xp' | 'coins' | 'hearts';

const DAY_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

/** Attempts are stored as UTC timestamps but the grids are built from local
 *  dates, so slicing the ISO string would put a late-evening lesson on the
 *  previous day for anyone east of UTC. Derive the key locally on both sides. */


function useActiveDays() {
  const attempts = useUserStore((s) => s.attempts);
  const reviewDates = useUserStore((s) => s.reviewDates);
  // Lessons and repasos both count: the streak already treats them the same,
  // and a calendar that disagreed with the streak beside it would look like
  // one of the two was lying.
  return new Set([...attempts.map((a) => localDayKey(new Date(a.completedAt))), ...reviewDates]);
}

function useFrozenDays() {
  const frozenDates = useUserStore((s) => s.frozenDates);
  return new Set(frozenDates);
}

function DayDot({
  label,
  practised,
  frozen,
  isToday,
}: {
  label: string;
  practised: boolean;
  frozen: boolean;
  isToday: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <span className={`text-[11px] font-black ${isToday ? 'text-lime-400' : 'text-carbon-500'}`}>{label}</span>
      <span
        className={`w-8 h-8 rounded-full flex items-center justify-center ${
          practised ? 'bg-lime-500 text-carbon-900' : frozen ? 'bg-sky-500 text-carbon-900' : 'bg-carbon-800'
        }`}
      >
        {practised && <Icon name="check" size={16} strokeWidth={3} />}
        {!practised && frozen && <Icon name="shield" size={14} strokeWidth={3} />}
      </span>
    </div>
  );
}

/** Monday-first week strip — what the desktop popover shows. */
function WeekStrip({ activeDays, frozenDays }: { activeDays: Set<string>; frozenDays: Set<string> }) {
  const today = new Date();
  const todayKey = localDayKey(today);
  // getDay() is Sunday-first; shift so Monday starts the week.
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));

  return (
    <div className="flex justify-between mt-3">
      {DAY_LABELS.map((label, i) => {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        const key = localDayKey(d);
        return (
          <DayDot
            key={key}
            label={label}
            practised={activeDays.has(key)}
            frozen={frozenDays.has(key)}
            isToday={key === todayKey}
          />
        );
      })}
    </div>
  );
}

/** Full month grid — what the phone panel shows, where there's room. */
function MonthGrid({ activeDays, frozenDays }: { activeDays: Set<string>; frozenDays: Set<string> }) {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const todayKey = localDayKey(today);

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leading = (new Date(year, month, 1).getDay() + 6) % 7;
  const cells: (number | null)[] = [
    ...Array.from({ length: leading }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div className="rounded-2xl border-2 border-carbon-800 p-3 mt-3">
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
          const frozen = !practised && frozenDays.has(key);
          const isToday = key === todayKey;
          return (
            <span
              key={key}
              className={`mx-auto w-7 h-7 flex items-center justify-center rounded-full text-[12px] font-bold ${
                practised
                  ? 'bg-lime-500 text-carbon-900'
                  : frozen
                  ? 'bg-sky-500 text-carbon-900'
                  : isToday
                  ? 'bg-carbon-800 text-carbon-100 ring-2 ring-carbon-600'
                  : 'text-carbon-500'
              }`}
            >
              {frozen ? <Icon name="shield" size={13} strokeWidth={3} /> : day}
            </span>
          );
        })}
      </div>
      <p className="mt-3 flex items-center justify-center gap-4 text-[11px] font-bold text-carbon-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-lime-500" /> Practicado
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-sky-500" /> Congelado
        </span>
      </p>
    </div>
  );
}

export default function StatPanel({ stat, compact = false }: { stat: StatKey; compact?: boolean }) {
  const { streak, xp, coins } = useUserStore();
  const { hearts, msUntilNextHeart, unlimited } = useHeartRegen();
  const activeDays = useActiveDays();
  const frozenDays = useFrozenDays();
  const { level, xpIntoLevel, xpForNext } = xpToLevel(xp);

  if (stat === 'streak') {
    return (
      <>
        <p className="text-xl font-black text-carbon-50">
          {streak} {streak === 1 ? 'día' : 'días'} de racha
        </p>
        <p className="text-sm text-carbon-400 mt-0.5">
          {streak === 0 ? 'Haz una lección hoy y empieza tu racha.' : 'No la sueltes.'}
        </p>
        {compact ? (
          <WeekStrip activeDays={activeDays} frozenDays={frozenDays} />
        ) : (
          <MonthGrid activeDays={activeDays} frozenDays={frozenDays} />
        )}
      </>
    );
  }

  if (stat === 'coins') {
    return (
      <>
        <p className="text-xl font-black text-carbon-50">Monedas</p>
        <p className="text-sm text-carbon-400 mt-0.5">
          Tienes {coins} {coins === 1 ? 'moneda' : 'monedas'}
        </p>
        <Link
          to="/tienda"
          className="inline-block mt-3 text-[13px] font-black uppercase tracking-[0.8px] text-lime-400 hover:text-lime-300"
        >
          Ir a la tienda
        </Link>
      </>
    );
  }

  if (stat === 'xp') {
    return (
      <>
        <p className="text-xl font-black text-carbon-50">{xp} XP</p>
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
    );
  }

  return (
    <>
      <p className="text-xl font-black text-carbon-50 text-center">Vidas</p>
      <div className="flex justify-center items-center gap-1.5 mt-2">
        {unlimited ? (
          // The same heart-and-infinity as the counter above it, so opening
          // the panel confirms what the bar said instead of re-drawing five.
          <>
            <Icon name="heart" size={26} className="text-ultra-400" />
            <span aria-hidden="true" className="text-[28px] font-black leading-none text-ultra-300">
              ∞
            </span>
          </>
        ) : (
          Array.from({ length: MAX_HEARTS }).map((_, i) => (
            <Icon key={i} name="heart" size={24} className={i < hearts ? 'text-lime-500' : 'text-carbon-700'} />
          ))
        )}
      </div>
      <p className="text-center font-black text-carbon-100 mt-3">
        {unlimited
          ? 'Vidas infinitas con Ultra'
          : hearts >= MAX_HEARTS
          ? 'Tu set de vidas está completo'
          : `Te quedan ${hearts}`}
      </p>
      <p className="text-center text-sm text-carbon-400 mt-0.5">
        {unlimited
          ? 'Falla todo lo que quieras: no se gastan'
          : hearts >= MAX_HEARTS
          ? 'Ya puedes seguir aprendiendo'
          : msUntilNextHeart !== null
          ? `Próxima vida en ${formatCountdown(msUntilNextHeart)}`
          : 'Sigue aprendiendo'}
      </p>
    </>
  );
}
