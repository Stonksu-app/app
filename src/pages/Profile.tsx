import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import TopBar from '../components/TopBar';
import NavRail from '../components/NavRail';
import BottomNav from '../components/BottomNav';
import Mascot from '../components/Mascot';
import Icon from '../components/Icon';
import PlanBadge from '../components/PlanBadge';
import AchievementRow from '../components/AchievementRow';
import ReminderSetting from '../components/ReminderSetting';
import HeartsReminderSetting from '../components/HeartsReminderSetting';
import PasswordSetting from '../components/PasswordSetting';
import ConfirmModal from '../components/ConfirmModal';
import FriendsPanel from '../components/FriendsPanel';
import { byRelevance, computeAchievements } from '../data/achievements';
import { getLessonById } from '../data/lessons';
import { useUserStore, xpToLevel } from '../store/useUserStore';
import { useAuthStore } from '../store/useAuthStore';
import { appEnv, isCloudEnabled } from '../lib/supabase';
import { signOut } from '../lib/cloud';
import { useSyncStore } from '../store/useSyncStore';
import type { IconName } from '../types';

/* Section headings are 24px/700 and stat tiles sit in a 2x2 grid, matching the
 * measurements taken from the reference profile. */

const EXPERIENCE_LABELS: Record<string, string> = {
  none: 'Principiante total',
  beginner: 'Novato con curiosidad',
  some: 'Ya opera un poco',
  experienced: 'Trader experimentado',
};

function StatTile({
  icon,
  iconClass,
  value,
  label,
}: {
  icon: IconName;
  iconClass?: string;
  value: string | number;
  label: string;
}) {
  return (
    <div className="bg-carbon-850 border-2 border-carbon-800 rounded-2xl px-4 py-3 flex items-center gap-3">
      <Icon name={icon} size={26} className={`shrink-0 ${iconClass ?? 'text-lime-500'}`} />
      <div className="min-w-0">
        <p className="text-xl font-black text-carbon-50 leading-tight tabular-nums">{value}</p>
        <p className="text-sm text-carbon-400 leading-tight truncate">{label}</p>
      </div>
    </div>
  );
}

export default function Profile() {
  const {
    name,
    xp,
    streak,
    attempts,
    onboardingAnswers,
    nodeStageProgress,
    openedChestIds,
    avatar,
    plan,
    resetProgress,
  } = useUserStore();
  const { level } = xpToLevel(xp);
  const authStatus = useAuthStore((s) => s.status);
  const syncUserId = useSyncStore((s) => s.userId);
  const navigate = useNavigate();
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const doSignOut = async () => {
    setLoggingOut(true);
    // Reset the local view first: if it's left holding this account's data,
    // the "empty account" branch of the sync would push it straight back up
    // under the fresh anonymous session that replaces it.
    resetProgress();
    await signOut();
    setLoggingOut(false);
    setConfirmLogout(false);
    navigate('/');
  };

  const achievements = computeAchievements({ streak, xp, attempts, nodeStageProgress, openedChestIds });
  const preview = [...achievements].sort(byRelevance).slice(0, 3);

  const sortedAttempts = [...attempts].sort(
    (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
  );

  // No account, no signup date — the first lesson is the honest starting point.
  const since = sortedAttempts.length
    ? new Date(sortedAttempts[sortedAttempts.length - 1].completedAt)
    : null;
  const flawless = attempts.filter((a) => a.totalQuestions > 0 && a.correctCount === a.totalQuestions).length;

  return (
    <div className="min-h-dvh bg-carbon-900 lg:flex">
      <NavRail />
      <BottomNav />

      <div className="flex-1 min-w-0">
          <TopBar />

        <div className="max-w-2xl mx-auto px-4 py-6 pb-32 lg:pb-6">
          {/* Identity */}
          <div className="relative bg-carbon-850 border-2 border-carbon-800 rounded-3xl p-6 flex flex-col items-center text-center">
            <Link
              to="/avatar"
              aria-label="Editar avatar"
              className="absolute top-4 right-4 w-10 h-10 rounded-full border-2 border-carbon-700 hover:border-lime-500/60 text-carbon-400 hover:text-lime-400 flex items-center justify-center transition"
            >
              <Icon name="pencil" size={18} />
            </Link>
            <Mascot size={110} mood="happy" look={avatar} />
            {/* The badge sits with the name, here and on a friend's card, so
                the thing being paid for is the same thing wherever it shows. */}
            <div className="mt-3 flex items-center justify-center gap-2">
              <h1 className="text-[25px] sm:text-[28px] font-black text-carbon-50">{name || 'Trader'}</h1>
              <PlanBadge plan={plan} />
            </div>
            <p className="text-carbon-400 text-sm font-medium">
              {EXPERIENCE_LABELS[onboardingAnswers.experience ?? ''] ?? 'Explorando el mercado'}
            </p>
            {since && (
              <p className="text-carbon-500 text-sm mt-0.5">
                Empezó en {since.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
              </p>
            )}
          </div>

          {/* Statistics */}
          <h2 className="mt-8 text-2xl font-black text-carbon-50">Estadísticas</h2>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <StatTile
              icon="flame"
              iconClass={streak > 0 ? 'text-lime-500 animate-flame-flicker' : 'text-carbon-600'}
              value={streak}
              label="Días de racha"
            />
            <StatTile icon="star" value={xp} label="XP total" />
            <StatTile icon="medal" value={level} label="Nivel actual" />
            <StatTile icon="target" value={flawless} label="Lecciones perfectas" />
          </div>

          {/* Friends */}
          <FriendsPanel />

          {/* Achievements */}
          <div className="mt-8 flex items-center justify-between gap-3">
            <h2 className="text-2xl font-black text-carbon-50">Logros</h2>
            <Link
              to="/logros"
              className="text-[15px] font-black uppercase tracking-[0.8px] text-lime-400 hover:text-lime-300"
            >
              Ver todos
            </Link>
          </div>
          <div className="mt-2 bg-carbon-850 border-2 border-carbon-800 rounded-2xl px-4">
            {preview.map((a) => (
              <AchievementRow key={a.id} a={a} />
            ))}
          </div>

          {/* History */}
          <h2 className="mt-8 text-2xl font-black text-carbon-50">Historial</h2>
          {sortedAttempts.length === 0 ? (
            <p className="mt-3 text-sm text-carbon-400 bg-carbon-850 border-2 border-carbon-800 rounded-2xl p-5 text-center">
              Aún no completas ninguna lección. ¡Ve al mapa y empieza!
            </p>
          ) : (
            <div className="mt-3 flex flex-col gap-2">
              {sortedAttempts.slice(0, 8).map((a, i) => {
                const info = getLessonById(a.lessonId);
                const date = new Date(a.completedAt);
                return (
                  <div
                    key={i}
                    className="bg-carbon-850 border-2 border-carbon-800 rounded-2xl p-4 flex items-center gap-3"
                  >
                    <Icon name={info?.lesson.icon ?? 'book'} size={22} className="text-lime-500 shrink-0" />
                    <div className="flex-1 text-left min-w-0">
                      <p className="font-bold text-carbon-100 text-sm truncate">{info?.lesson.title ?? a.lessonId}</p>
                      <p className="text-xs text-carbon-400">
                        {date.toLocaleDateString('es-ES')} · {a.correctCount}/{a.totalQuestions} correctas
                      </p>
                    </div>
                    <span className="text-sm font-black text-lime-400 shrink-0">+{a.xpEarned} XP</span>
                  </div>
                );
              })}
            </div>
          )}

          <ReminderSetting />
          <HeartsReminderSetting />
          <PasswordSetting />

          <button
            onClick={() => setConfirmLogout(true)}
            className="mt-8 text-xs text-carbon-500 hover:text-danger-400 font-bold"
          >
            Cerrar sesión
          </button>

          {/* Settles "is the new build actually on my phone?" without guesswork,
              which a sideloaded .ipa otherwise gives you no way to answer. */}
          <p className="mt-6 text-[11px] text-carbon-600 font-bold tabular-nums">
            Versión {__BUILD_ID__} ·{' '}
            {authStatus === 'off'
              ? 'solo en este dispositivo'
              : authStatus === 'registered'
              ? 'progreso guardado en la nube'
              : 'sin cuenta — progreso solo local'}
            {appEnv === 'dev' && isCloudEnabled && (
              <span className="text-[#FFC93C]"> · base de datos de pruebas</span>
            )}
            {/* The first characters of the account id. "Why am I not my old
                self?" is almost always "you are signed into a different
                account than you think", and nothing else on screen says
                which. Enough to match against a row in the database, far too
                little to identify anyone. */}
            {syncUserId && <span className="text-carbon-700"> · {syncUserId.slice(0, 8)}</span>}
          </p>
        </div>
      </div>

      {confirmLogout && (
        <ConfirmModal
          title={`¿Seguro, ${name || 'trader'}, que quieres salir?`}
          message="Se cerrará tu sesión en este dispositivo. Si tienes una cuenta vinculada, tu progreso sigue guardado en la nube y podrás volver a entrar con ella."
          confirmLabel="Cerrar sesión"
          busy={loggingOut}
          onConfirm={() => void doSignOut()}
          onCancel={() => setConfirmLogout(false)}
        />
      )}
    </div>
  );
}
