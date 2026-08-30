import { Link } from 'react-router-dom';
import { inferredFrozenDays, localDayKey, practisedToday } from '../utils/streak';
import { MAX_HEARTS, useUserStore, xpToLevel } from '../store/useUserStore';
import { formatCountdown, useHeartRegen } from '../hooks/useHeartRegen';
import Icon from './Icon';
import { MonthGrid, WeekStrip } from './StreakCalendar';

/* Contents of the streak / XP / hearts panels, shared by the phone header
 * (which taps them open) and the desktop rail (which reveals them on hover),
 * so the two can't drift apart. */

export type StatKey = 'streak' | 'xp' | 'coins' | 'hearts';

function useActiveDays() {
  const attempts = useUserStore((s) => s.attempts);
  const reviewDates = useUserStore((s) => s.reviewDates);
  // Lessons and repasos both count: the streak already treats them the same,
  // and a calendar that disagreed with the streak beside it would look like
  // one of the two was lying.
  return new Set([...attempts.map((a) => localDayKey(new Date(a.completedAt))), ...reviewDates]);
}

function useFrozenDays(activeDays: Set<string>) {
  const frozenDates = useUserStore((s) => s.frozenDates);
  const streak = useUserStore((s) => s.streak);
  const lastActiveDate = useUserStore((s) => s.lastActiveDate);
  // Recorded plus implied — see inferredFrozenDays. The union means the
  // calendar agrees with the streak beside it however the streak got there.
  return new Set([...frozenDates, ...inferredFrozenDays(streak, lastActiveDate, activeDays)]);
}

export default function StatPanel({ stat, compact = false }: { stat: StatKey; compact?: boolean }) {
  const { streak, xp, coins } = useUserStore();
  const { hearts, msUntilNextHeart, unlimited } = useHeartRegen();
  const lastActiveDate = useUserStore((s) => s.lastActiveDate);
  const streakProtectors = useUserStore((s) => s.streakProtectors);
  const lastStreakLoss = useUserStore((s) => s.lastStreakLoss);
  const activeDays = useActiveDays();
  const frozenDays = useFrozenDays(activeDays);
  const { level, xpIntoLevel, xpForNext } = xpToLevel(xp);

  if (stat === 'streak') {
    return (
      <>
        <p className="text-xl font-black text-carbon-50">
          {streak} {streak === 1 ? 'día' : 'días'} de racha
        </p>
        <p className="text-sm text-carbon-400 mt-0.5">
          {streak === 0
            ? 'Haz una lección hoy y empieza tu racha.'
            : practisedToday(lastActiveDate)
            ? 'Hoy ya está. No la sueltes.'
            : 'Aún no has practicado hoy: una lección o un repaso la mantienen.'}
        </p>
        {compact ? (
          <WeekStrip activeDays={activeDays} frozenDays={frozenDays} />
        ) : (
          <MonthGrid activeDays={activeDays} frozenDays={frozenDays} />
        )}

        {/*
          What the protectors you're holding actually buy you.
          Saying it up front is the only way the arithmetic isn't a surprise
          on the day it matters — one protector per day missed, and they're
          only spent when they can cover the whole gap.
        */}
        <p className="mt-3 flex items-start gap-1.5 text-[13px] text-carbon-400 leading-snug">
          <Icon name="shield" size={14} className="mt-0.5 shrink-0 text-sky-400" />
          {streakProtectors === 0 ? (
            <span>
              Sin protectores: un solo día sin practicar y la racha vuelve a empezar.
            </span>
          ) : (
            <span>
              {streakProtectors === 1 ? 'Tienes 1 protector' : `Tienes ${streakProtectors} protectores`}:
              cubren hasta {streakProtectors} {streakProtectors === 1 ? 'día seguido' : 'días seguidos'} sin
              practicar.
            </span>
          )}
        </p>

        {/* And why the last one broke — but only while the streak is still
            back at the beginning. Once you've built a new one the old loss
            has stopped explaining anything on screen, and a note about it
            would just be the app sulking. */}
        {lastStreakLoss && lastStreakLoss.missed > lastStreakLoss.protectors && streak <= 1 && (
          <p className="mt-2 rounded-xl bg-carbon-800 px-3 py-2 text-[13px] text-carbon-300 leading-snug">
            Perdiste una racha de {lastStreakLoss.streak}{' '}
            {lastStreakLoss.streak === 1 ? 'día' : 'días'}: faltaron {lastStreakLoss.missed} días
            seguidos
            {lastStreakLoss.used > 0 ? (
              <>
                {' '}
                y tus {lastStreakLoss.used}{' '}
                {lastStreakLoss.used === 1 ? 'protector cubrió' : 'protectores cubrieron'} los{' '}
                {lastStreakLoss.used === 1 ? 'primeros' : lastStreakLoss.used} pero no{' '}
                {lastStreakLoss.missed - lastStreakLoss.used === 1
                  ? 'el último'
                  : `los ${lastStreakLoss.missed - lastStreakLoss.used} últimos`}
                .
              </>
            ) : (
              <> y no tenías protectores.</>
            )}
          </p>
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
