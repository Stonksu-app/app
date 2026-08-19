import TopBar from '../components/TopBar';
import NavRail from '../components/NavRail';
import BottomNav from '../components/BottomNav';
import AchievementRow from '../components/AchievementRow';
import { byRelevance, computeAchievements } from '../data/achievements';
import { useUserStore } from '../store/useUserStore';

export default function Achievements() {
  const { streak, xp, attempts, nodeStageProgress, openedChestIds } = useUserStore();
  const achievements = computeAchievements({ streak, xp, attempts, nodeStageProgress, openedChestIds });
  const ordered = [...achievements].sort(byRelevance);
  const earned = achievements.reduce((n, a) => n + a.level, 0);

  return (
    <div className="min-h-dvh bg-carbon-900 lg:flex">
      <NavRail />
      <BottomNav />

      <div className="flex-1 min-w-0">
        <div className="lg:hidden">
          <TopBar />
        </div>

        <div className="max-w-2xl mx-auto px-4 py-6 pb-32 lg:pb-6">
          <h1 className="text-2xl font-black text-carbon-50">Todos los logros</h1>
          <p className="text-sm text-carbon-400 mt-1">
            {earned === 0 ? 'Aún no has subido ningún nivel.' : `Llevas ${earned} niveles conseguidos.`}
          </p>

          <div className="mt-4 bg-carbon-850 border-2 border-carbon-800 rounded-2xl px-4">
            {ordered.map((a) => (
              <AchievementRow key={a.id} a={a} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
