import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import TopBar from '../components/TopBar';
import NavRail from '../components/NavRail';
import BottomNav from '../components/BottomNav';
import Icon from '../components/Icon';
import ChallengeTabs from '../components/ChallengeTabs';
import LeagueMark from '../components/LeagueMark';
import Mascot from '../components/Mascot';
import { Button } from '../components/Button';
import { fetchLeagueTable, type LeagueMember } from '../lib/leagues';
import {
  leagueRankInfo,
  LEAGUE_RANKS,
  MAX_LEAGUE_RANK,
  MIN_TABLE_SIZE_FOR_DEMOTION,
  MIN_TABLE_SIZE_FOR_PROMOTION,
  PROMOTION_ZONE,
} from '../data/leagues';
import { useUserStore } from '../store/useUserStore';
import { useAuthStore } from '../store/useAuthStore';
import { isCloudEnabled } from '../lib/supabase';

/** Next Monday, 00:00 UTC — see run_weekly_league_reset()'s cron schedule,
 *  the only thing this countdown has to agree with. */
function msUntilReset(): number {
  const now = new Date();
  const day = now.getUTCDay();
  const daysAhead = (8 - day) % 7 || 7;
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysAhead, 0, 0, 0);
  return next - now.getTime();
}

function formatTimeLeft(ms: number): string {
  const minutes = Math.max(0, Math.floor(ms / 60_000));
  const days = Math.floor(minutes / (60 * 24));
  const hours = Math.floor((minutes % (60 * 24)) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  return `${hours}h ${minutes % 60}m`;
}

export default function League() {
  const navigate = useNavigate();
  const authStatus = useAuthStore((s) => s.status);
  const leagueRank = useUserStore((s) => s.leagueRank);
  const [members, setMembers] = useState<LeagueMember[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [msLeft, setMsLeft] = useState(() => msUntilReset());

  useEffect(() => {
    if (authStatus !== 'registered') {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void fetchLeagueTable().then((result) => {
      if (!cancelled) {
        setMembers(result);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [authStatus]);

  useEffect(() => {
    const id = setInterval(() => setMsLeft(msUntilReset()), 60_000);
    return () => clearInterval(id);
  }, []);

  const rank = leagueRankInfo(leagueRank);
  const tableSize = members?.length ?? 0;
  const promoteCount = tableSize > MIN_TABLE_SIZE_FOR_PROMOTION ? Math.min(PROMOTION_ZONE, tableSize) : 0;
  const demotes = tableSize > MIN_TABLE_SIZE_FOR_DEMOTION;

  return (
    <div className="min-h-dvh bg-carbon-900 lg:flex">
      <NavRail />
      <BottomNav />

      <div className="flex-1 min-w-0">
        <TopBar />

        <div className="max-w-2xl mx-auto px-4 py-6 pb-32 lg:pb-6">
          <h1 className="text-2xl font-black text-carbon-50">Liga</h1>

          <ChallengeTabs />
          <p className="text-sm text-carbon-400 mt-1">
            Compite por XP de esta semana, no por tu total — cada lunes se reparte de cero.
          </p>

          <div className="mt-4 rounded-3xl border-2 border-carbon-800 bg-carbon-850 p-5 flex items-center gap-4">
            <LeagueMark rank={leagueRank} size={64} />
            <div className="min-w-0">
              <p className="text-[13px] font-black uppercase tracking-[0.8px] text-carbon-500">
                Liga {leagueRank + 1}/{MAX_LEAGUE_RANK + 1}
              </p>
              <h2 className="text-xl font-black text-carbon-50 truncate">{rank.name}</h2>
            </div>
            <div className="ml-auto text-right shrink-0">
              <p className="text-[11px] font-black uppercase tracking-wide text-carbon-500">Se resetea en</p>
              <p className="text-sm font-black text-carbon-200 tabular-nums">{formatTimeLeft(msLeft)}</p>
            </div>
          </div>

          {authStatus !== 'registered' ? (
            <div className="mt-4 rounded-2xl border-2 border-[#FFC93C]/40 bg-[#FFC93C]/10 px-4 py-4 text-center">
              <p className="text-sm font-bold text-[#FFC93C]">
                Guarda tu cuenta para competir en la liga — las anónimas no entran en las mesas.
              </p>
              <div className="mt-3 w-[200px] mx-auto">
                <Button variant="platinum" onClick={() => navigate('/profile')}>
                  Guardar cuenta
                </Button>
              </div>
            </div>
          ) : loading ? (
            <p className="mt-6 text-center text-sm text-carbon-500 font-bold">Buscando tu mesa…</p>
          ) : !members || members.length === 0 ? (
            <p className="mt-6 text-center text-sm text-carbon-500 font-bold">
              No pudimos cargar tu mesa. Prueba otra vez en un momento.
            </p>
          ) : (
            <>
              {promoteCount > 0 && (
                <p className="mt-5 flex items-center gap-1.5 text-[13px] font-black text-lime-400 uppercase tracking-wide">
                  <Icon name="trending-up" size={14} /> Zona de ascenso — top {promoteCount}
                </p>
              )}
              <div className="mt-2 bg-carbon-850 border-2 border-carbon-800 rounded-2xl px-4">
                {members.map((m, i) => {
                  const pos = i + 1;
                  const promoting = pos <= promoteCount;
                  const demoting = demotes && pos === members.length;
                  return (
                    <div
                      key={m.id}
                      className={`flex items-center gap-3 py-3 border-b-2 last:border-b-0 ${
                        m.isSelf ? 'border-carbon-700' : 'border-carbon-800'
                      }`}
                    >
                      <span
                        className={`w-6 shrink-0 text-center text-sm font-black tabular-nums ${
                          promoting ? 'text-lime-400' : demoting ? 'text-danger-400' : 'text-carbon-500'
                        }`}
                      >
                        {pos}
                      </span>
                      <Mascot size={32} look={m.avatar} />
                      <span
                        className={`flex-1 min-w-0 truncate font-bold ${
                          m.isSelf ? 'text-lime-400' : 'text-carbon-100'
                        }`}
                      >
                        {m.name || 'Trader'}
                        {m.isSelf && ' (tú)'}
                      </span>
                      <span className="shrink-0 flex items-center gap-1 text-sm font-black text-carbon-300 tabular-nums">
                        <Icon name="star" size={13} className="text-lime-500" />
                        {m.weeklyXp}
                      </span>
                      {promoting && <Icon name="trending-up" size={16} className="shrink-0 text-lime-400" />}
                      {demoting && <Icon name="trending-down" size={16} className="shrink-0 text-danger-400" />}
                    </div>
                  );
                })}
              </div>
              {demotes && (
                <p className="mt-2 flex items-center gap-1.5 text-[13px] font-black text-danger-400 uppercase tracking-wide">
                  <Icon name="trending-down" size={14} /> Zona de descenso — último puesto
                </p>
              )}
            </>
          )}

          {/* The whole ladder, so the rank you're on has somewhere to be on.
              A single league with nothing above or below it is a table, not a
              league. */}
          <h2 className="mt-8 text-2xl font-black text-carbon-50">Todas las ligas</h2>
          <p className="mt-1 text-sm text-carbon-400">
            Cada lunes, los primeros suben y los últimos bajan.
          </p>

          <div className="mt-3 bg-carbon-850 border-2 border-carbon-800 rounded-2xl px-4">
            {LEAGUE_RANKS.map((info, i) => {
              const current = i === leagueRank;
              // Everything above where you are is still ahead of you. Below is
              // ground you've covered, which is worth showing as covered
              // rather than as another locked door.
              const locked = i > leagueRank;
              return (
                <div
                  key={info.name}
                  className={`flex items-center gap-3 py-3 border-b-2 border-carbon-800 last:border-b-0 ${
                    locked ? 'opacity-45' : ''
                  }`}
                >
                  <LeagueMark rank={i} size={40} />
                  <div className="min-w-0 flex-1">
                    <p
                      className={`font-black truncate ${
                        current ? 'text-lime-400' : 'text-carbon-100'
                      }`}
                    >
                      {info.name}
                      {current && ' (estás aquí)'}
                    </p>
                    <p className="text-[13px] text-carbon-500">Liga {i + 1} de {MAX_LEAGUE_RANK + 1}</p>
                  </div>
                  {locked ? (
                    <Icon name="lock" size={18} className="shrink-0 text-carbon-600" />
                  ) : current ? (
                    <span className="shrink-0 rounded-lg bg-lime-500/15 px-2 py-1 text-[11px] font-black uppercase tracking-wide text-lime-400">
                      Actual
                    </span>
                  ) : (
                    <Icon name="check" size={18} strokeWidth={3} className="shrink-0 text-carbon-500" />
                  )}
                </div>
              );
            })}
          </div>

          {!isCloudEnabled && (
            <p className="mt-6 text-center text-xs text-carbon-600 font-bold">
              Las ligas necesitan conexión con la nube, y este build no la tiene configurada.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
