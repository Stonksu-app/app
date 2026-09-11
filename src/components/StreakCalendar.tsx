import Icon from './Icon';
import { localDayKey } from '../utils/streak';

/*
 * The streak calendar, shared by your own panels and a friend's profile.
 *
 * Pulled out of StatPanels when friends' streaks became visible: two grids
 * drawn from the same data by different code is how "practicado" ends up
 * meaning one thing on one screen and something else on the next.
 */

const DAY_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

/** Attempts are stored as UTC timestamps but the grids are built from local
 *  dates, so slicing the ISO string would put a late-evening lesson on the
 *  previous day for anyone east of UTC. Derive the key locally on both sides. */


export function DayDot({
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
export function WeekStrip({ activeDays, frozenDays }: { activeDays: Set<string>; frozenDays: Set<string> }) {
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
export function MonthGrid({ activeDays, frozenDays }: { activeDays: Set<string>; frozenDays: Set<string> }) {
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

