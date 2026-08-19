import TopBar from '../components/TopBar';
import NavRail from '../components/NavRail';
import BottomNav from '../components/BottomNav';
import Mascot from '../components/Mascot';
import XpBar from '../components/XpBar';
import Icon from '../components/Icon';
import { BADGES } from '../data/badges';
import { getLessonById } from '../data/lessons';
import { useUserStore, xpToLevel } from '../store/useUserStore';
import type { IconName } from '../types';

const EXPERIENCE_LABELS: Record<string, string> = {
  none: 'Principiante total',
  beginner: 'Novato con curiosidad',
  some: 'Ya opera un poco',
  experienced: 'Trader experimentado',
};

export default function Profile() {
  const { name, xp, streak, attempts, unlockedBadgeIds, virtualBalance, onboardingAnswers, resetProgress } =
    useUserStore();
  const { level } = xpToLevel(xp);

  const sortedAttempts = [...attempts].sort(
    (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
  );

  return (
    <div className="min-h-dvh bg-carbon-900 lg:flex">
      <NavRail />
      <BottomNav />

      <div className="flex-1 min-w-0">
        <div className="lg:hidden">
          <TopBar />
        </div>

        <div className="max-w-2xl mx-auto px-4 py-6 pb-32 lg:pb-6">
        <div className="bg-carbon-850 rounded-3xl border border-carbon-800 p-6 flex flex-col sm:flex-row items-center gap-5">
          <Mascot size={90} mood="happy" />
          <div className="text-center sm:text-left flex-1">
            <h1 className="text-2xl font-black text-carbon-50">{name || 'Trader'}</h1>
            <p className="text-carbon-400 text-sm font-medium">
              {EXPERIENCE_LABELS[onboardingAnswers.experience ?? ''] ?? 'Explorando el mercado'}
            </p>
            <div className="mt-3">
              <XpBar xp={xp} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mt-4">
          <StatCard icon="star" value={xp} label="XP total" />
          <StatCard icon="flame" value={streak} label="Racha (días)" iconClassName={streak > 0 ? 'animate-flame-flicker' : ''} />
          <StatCard icon="medal" value={level} label="Nivel" />
        </div>

        <div className="mt-4 bg-carbon-850 rounded-2xl border border-carbon-800 p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-black text-carbon-400 uppercase">Saldo virtual del simulador</p>
            <p className="text-2xl font-black text-lime-400">${virtualBalance.toLocaleString('es-ES')}</p>
          </div>
          <Icon name="wallet" size={34} className="text-lime-500" />
        </div>

        <section className="mt-6">
          <h2 className="font-black text-carbon-100 mb-3">Logros</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {BADGES.map((badge) => {
              const unlocked = unlockedBadgeIds.includes(badge.id);
              return (
                <div
                  key={badge.id}
                  className={`rounded-2xl p-4 border text-center ${
                    unlocked ? 'bg-carbon-850 border-lime-500/40' : 'bg-carbon-850/50 border-carbon-800'
                  }`}
                >
                  <Icon
                    name={badge.icon}
                    size={28}
                    className={`mx-auto mb-1 ${unlocked ? 'text-lime-500' : 'text-carbon-700'}`}
                  />
                  <p className={`text-xs font-extrabold leading-tight ${unlocked ? 'text-carbon-100' : 'text-carbon-600'}`}>
                    {badge.title}
                  </p>
                  {!unlocked && <p className="text-[10px] text-carbon-600 mt-1">Bloqueado</p>}
                </div>
              );
            })}
          </div>
        </section>

        <section className="mt-6 mb-10">
          <h2 className="font-black text-carbon-100 mb-3">Historial de lecciones</h2>
          {sortedAttempts.length === 0 ? (
            <p className="text-sm text-carbon-400 bg-carbon-850 rounded-2xl border border-carbon-800 p-5 text-center">
              Aún no completas ninguna lección. ¡Ve al mapa y empieza!
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {sortedAttempts.map((a, i) => {
                const info = getLessonById(a.lessonId);
                const date = new Date(a.completedAt);
                return (
                  <div key={i} className="bg-carbon-850 rounded-2xl border border-carbon-800 p-4 flex items-center gap-3">
                    <Icon name={info?.lesson.icon ?? 'book'} size={22} className="text-lime-500 shrink-0" />
                    <div className="flex-1 text-left">
                      <p className="font-bold text-carbon-100 text-sm">{info?.lesson.title ?? a.lessonId}</p>
                      <p className="text-xs text-carbon-400">
                        {date.toLocaleDateString('es-ES')} · {a.correctCount}/{a.totalQuestions} correctas
                      </p>
                    </div>
                    <span className="text-sm font-black text-lime-400">+{a.xpEarned} XP</span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <button
          onClick={() => {
            if (confirm('¿Reiniciar todo tu progreso? Esta acción no se puede deshacer.')) {
              resetProgress();
            }
          }}
          className="text-xs text-carbon-500 hover:text-danger-400 font-bold mb-8"
        >
          Reiniciar progreso
        </button>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  value,
  label,
  iconClassName = '',
}: {
  icon: IconName;
  value: number;
  label: string;
  iconClassName?: string;
}) {
  return (
    <div className="bg-carbon-850 rounded-2xl border border-carbon-800 p-4 text-center">
      <Icon name={icon} size={22} className={`text-lime-500 mx-auto ${iconClassName}`} />
      <p className="text-xl font-black text-carbon-50 mt-1">{value}</p>
      <p className="text-[10px] font-bold text-carbon-400 uppercase">{label}</p>
    </div>
  );
}
