import { useState } from 'react';
import TopBar from '../components/TopBar';
import NavRail from '../components/NavRail';
import BottomNav from '../components/BottomNav';
import Icon from '../components/Icon';
import ChallengeTabs from '../components/ChallengeTabs';
import Mascot from '../components/Mascot';
import { Button } from '../components/Button';
import { computeMissions } from '../data/missions';
import { computeDailyMissions } from '../data/dailyMissions';
import { useUserStore } from '../store/useUserStore';
import { todayLocal } from '../utils/streak';

export default function Missions() {
  const {
    streak,
    xp,
    attempts,
    nodeStageProgress,
    openedChestIds,
    claimedMissionIds,
    avatar,
    claimMission,
    dailyStatsDate,
    dailyXp,
    dailyLessons,
    dailyPerfectLessons,
    dailyCorrect,
    dailyReviews,
    dailyMissionsDate,
    claimedDailyMissionIds,
    claimDailyMission,
  } = useUserStore();
  const [flash, setFlash] = useState<string | null>(null);

  const missions = computeMissions(
    { streak, xp, attempts, nodeStageProgress, openedChestIds },
    claimedMissionIds
  );
  const daily = computeDailyMissions(
    { dailyStatsDate, dailyXp, dailyLessons, dailyPerfectLessons, dailyCorrect, dailyReviews },
    { dailyMissionsDate, claimedDailyMissionIds },
    todayLocal()
  );
  const pending =
    missions.filter((m) => m.complete && !m.claimed).length +
    daily.filter((m) => m.complete && !m.claimed).length;

  const claim = (id: string, label: string) => {
    claimMission(id);
    setFlash(label);
    setTimeout(() => setFlash(null), 2200);
  };

  const claimDaily = (id: string, coins: number) => {
    if (!claimDailyMission(id)) return;
    setFlash(`+${coins} monedas`);
    setTimeout(() => setFlash(null), 2200);
  };

  return (
    <div className="min-h-dvh bg-carbon-900 lg:flex">
      <NavRail />
      <BottomNav />

      <div className="flex-1 min-w-0">
          <TopBar />

        <div className="max-w-2xl mx-auto px-4 py-6 pb-32 lg:pb-6">
          <h1 className="text-2xl font-black text-carbon-50">Misiones</h1>

          <ChallengeTabs />
          <p className="text-sm text-carbon-400 mt-1">
            {pending > 0
              ? `Tienes ${pending} ${pending === 1 ? 'recompensa' : 'recompensas'} por reclamar.`
              : 'Objetivos de una sola vez con recompensa.'}
          </p>

          {flash && (
            <p className="mt-4 text-sm font-black text-lime-400 bg-lime-500/10 border-2 border-lime-500/30 rounded-xl px-4 py-3 animate-pop-in">
              {flash}
            </p>
          )}

          <div className="mt-6 flex items-baseline justify-between">
            <h2 className="text-[13px] font-black uppercase tracking-[0.8px] text-carbon-400">Diarias</h2>
            <span className="text-[11px] font-bold text-carbon-600">Se renuevan a medianoche</span>
          </div>
          <div className="mt-3 bg-carbon-850 border-2 border-carbon-800 rounded-2xl px-4">
            {daily.map((m) => {
              const pct = Math.min(100, (m.value / m.target) * 100);
              return (
                <div key={m.id} className="flex items-center gap-4 py-4 border-b-2 border-carbon-800 last:border-b-0">
                  <div
                    className={`w-14 h-14 shrink-0 rounded-2xl flex items-center justify-center ${
                      m.claimed
                        ? 'bg-lime-500/15 text-lime-400'
                        : m.complete
                        ? 'bg-[#FFC93C]/20 text-[#FFC93C]'
                        : 'bg-carbon-800 text-carbon-600'
                    }`}
                  >
                    <Icon name={m.icon} size={24} strokeWidth={1.9} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-3">
                      <h3 className="text-[16px] font-black text-carbon-50 truncate">{m.title}</h3>
                      <span className="shrink-0 text-sm font-bold text-carbon-500 tabular-nums">
                        {m.value}/{m.target}
                      </span>
                    </div>
                    <p className="text-[13px] text-carbon-400 mt-0.5">{m.description}</p>

                    <div className="mt-2 h-2 rounded-full bg-carbon-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          m.claimed ? 'bg-lime-600' : 'bg-lime-500'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>

                    <div className="mt-2 flex items-center gap-3">
                      <span className="flex items-center gap-1.5 text-sm font-black text-carbon-300">
                        <Icon name="coins" size={16} className="text-lime-500" />
                        {m.reward}
                      </span>

                      {m.claimed ? (
                        <span className="ml-auto text-xs font-black uppercase tracking-wide text-lime-500">
                          Reclamada
                        </span>
                      ) : m.complete ? (
                        <div className="ml-auto w-[110px]">
                          <Button size="sm" onClick={() => claimDaily(m.id, m.reward)}>
                            Reclamar
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <h2 className="mt-8 text-[13px] font-black uppercase tracking-[0.8px] text-carbon-400">
            De siempre
          </h2>
          <div className="mt-3 bg-carbon-850 border-2 border-carbon-800 rounded-2xl px-4">
            {missions.map((m) => {
              const pct = Math.min(100, (m.value / m.target) * 100);
              const isCosmetic = !!m.reward.accessory;
              return (
                <div key={m.id} className="flex items-center gap-4 py-4 border-b-2 border-carbon-800 last:border-b-0">
                  <div
                    className={`w-16 h-16 shrink-0 rounded-2xl flex items-center justify-center ${
                      m.claimed
                        ? 'bg-lime-500/15 text-lime-400'
                        : m.complete
                        ? 'bg-[#FFC93C]/20 text-[#FFC93C]'
                        : 'bg-carbon-800 text-carbon-600'
                    }`}
                  >
                    <Icon name={m.icon} size={28} strokeWidth={1.9} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-3">
                      <h2 className="text-[19px] font-black text-carbon-50 truncate">{m.title}</h2>
                      <span className="shrink-0 text-sm font-bold text-carbon-500 tabular-nums">
                        {m.value}/{m.target}
                      </span>
                    </div>
                    <p className="text-sm text-carbon-400 mt-0.5">{m.description}</p>

                    <div className="mt-2 h-2.5 rounded-full bg-carbon-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          m.claimed ? 'bg-lime-600' : 'bg-lime-500'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>

                    <div className="mt-2.5 flex items-center gap-3">
                      <span className="flex items-center gap-1.5 text-sm font-black text-carbon-300">
                        {isCosmetic ? (
                          <>
                            <Mascot size={22} look={{ ...avatar, accessory: 'corona' }} />
                            Corona
                          </>
                        ) : (
                          <>
                            <Icon name="coins" size={16} className="text-lime-500" />
                            {m.reward.coins}
                          </>
                        )}
                      </span>

                      {m.claimed ? (
                        <span className="ml-auto text-xs font-black uppercase tracking-wide text-lime-500">
                          Reclamada
                        </span>
                      ) : m.complete ? (
                        <div className="ml-auto w-[130px]">
                          <Button
                            size="sm"
                            onClick={() =>
                              claim(m.id, isCosmetic ? '¡Corona desbloqueada! Póntela en tu avatar.' : `+${m.reward.coins} monedas`)
                            }
                          >
                            Reclamar
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
