import { useNavigate } from 'react-router-dom';
import TopBar from '../components/TopBar';
import NavRail from '../components/NavRail';
import BottomNav from '../components/BottomNav';
import Icon from '../components/Icon';
import { Button } from '../components/Button';
import { getSections } from '../data/lessons';
import { useUserStore } from '../store/useUserStore';
import type { NodeDifficulty } from '../types';

/**
 * The whole course at a glance, reached by the arrow on the unit banner.
 *
 * Duolingo offers a "jump here" that skips ahead. Stonksu doesn't, and
 * shouldn't: every topic unlocks from the one before it, so a button that
 * appeared to skip would either lie or quietly break the chain. Locked
 * sections say what they hold and what stands between you and them, which is
 * the honest version of the same motivation.
 */

/** The hardest topic in a section is what the section really demands. */
const LEVEL_LABEL: Record<NodeDifficulty, string> = {
  easy: 'Básico',
  medium: 'Intermedio',
  hard: 'Avanzado',
};
const LEVEL_ORDER: NodeDifficulty[] = ['easy', 'medium', 'hard'];

/** Matches the banner colours on the path, so a section looks the same here
 *  as it does when you're walking it. */
const SECTION_ACCENT = ['bg-lime-500', 'bg-sky-500', 'bg-amber-500', 'bg-fuchsia-500'];

export default function Sections() {
  const navigate = useNavigate();
  const { isNodeUnlocked, isNodePlatinum, getNodeStage, getNodeMaxStage, nodeStageProgress } = useUserStore();
  const sections = getSections();

  // Keyed on the raw progress record: the store's getters keep a stable
  // identity, so anything memoised on them never recomputes.
  void nodeStageProgress;

  return (
    <div className="min-h-dvh bg-carbon-900 lg:flex">
      <NavRail />
      <BottomNav />

      <div className="flex-1 min-w-0">
        <div className="lg:hidden">
          <TopBar />
        </div>

        <div className="max-w-2xl mx-auto px-4 py-6 pb-32 lg:pb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/home')}
              aria-label="Volver al camino"
              className="text-carbon-500 hover:text-carbon-200 transition p-1 -ml-1"
            >
              <Icon name="chevron-left" size={24} strokeWidth={2.4} />
            </button>
            <h1 className="text-2xl font-black text-carbon-50">Secciones</h1>
          </div>

          <div className="mt-5 space-y-4">
            {sections.map((section, i) => {
              const stages = section.units.map((u) => ({
                done: getNodeStage(u.id),
                total: getNodeMaxStage(u.id),
              }));
              const done = stages.reduce((n, s) => n + s.done, 0);
              const total = stages.reduce((n, s) => n + s.total, 0);
              const pct = total ? Math.round((done / total) * 100) : 0;

              const unlocked = section.units.some((u) => isNodeUnlocked(u.id));
              const complete = section.units.every((u) => isNodePlatinum(u.id));
              const level =
                LEVEL_LABEL[
                  section.units
                    .map((u) => u.difficulty)
                    .sort((a, b) => LEVEL_ORDER.indexOf(b) - LEVEL_ORDER.indexOf(a))[0]
                ];

              return (
                <div
                  key={section.number}
                  className={`relative overflow-hidden rounded-3xl border-2 p-5 ${
                    unlocked ? 'bg-carbon-850 border-carbon-800' : 'bg-carbon-900 border-carbon-800'
                  }`}
                >
                  {/* A stripe of the section's own colour, so this page and the
                      path agree on which chapter is which. */}
                  <span
                    className={`absolute left-0 top-0 bottom-0 w-1.5 ${
                      SECTION_ACCENT[i % SECTION_ACCENT.length]
                    } ${unlocked ? '' : 'opacity-30'}`}
                  />

                  <div className="pl-3">
                    <div className="flex items-center justify-between gap-3">
                      <p
                        className={`text-[13px] font-black uppercase tracking-[0.64px] ${
                          unlocked ? 'text-lime-400' : 'text-carbon-600'
                        }`}
                      >
                        {level}
                      </p>
                      {complete && (
                        <span className="flex items-center gap-1.5 text-[13px] font-black uppercase tracking-wide text-lime-400">
                          <Icon name="check" size={16} strokeWidth={3} />
                          Completada
                        </span>
                      )}
                    </div>

                    <h2
                      className={`mt-1 text-2xl font-black ${unlocked ? 'text-carbon-50' : 'text-carbon-500'}`}
                    >
                      Sección {section.number}
                    </h2>
                    <p className={`text-sm mt-0.5 ${unlocked ? 'text-carbon-400' : 'text-carbon-600'}`}>
                      {section.title}
                    </p>

                    {unlocked ? (
                      <>
                        <div className="mt-4 flex items-center gap-3">
                          <div className="flex-1 h-3 rounded-full bg-carbon-800 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-lime-500 transition-all duration-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-sm font-black text-carbon-300 tabular-nums shrink-0">{pct}%</span>
                        </div>

                        {!complete && (
                          <div className="mt-4 w-[180px]">
                            {/* Carries the section, so the path opens on it
                                rather than at the top of the whole tree. */}
                            <Button size="sm" onClick={() => navigate(`/home?seccion=${section.number}`)}>
                              Continuar
                            </Button>
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="mt-4 flex items-center gap-2 text-sm font-bold text-carbon-500">
                        <Icon name="lock" size={16} />
                        {section.units.length} {section.units.length === 1 ? 'unidad' : 'unidades'} · termina la
                        anterior para abrirla
                      </p>
                    )}

                    {/* The units themselves, so a locked section still tells you
                        what it is you're working towards. */}
                    <div className="mt-4 pt-4 border-t-2 border-carbon-800 space-y-2">
                      {section.units.map((unit) => {
                        const unitUnlocked = isNodeUnlocked(unit.id);
                        const unitDone = isNodePlatinum(unit.id);
                        return (
                          <div key={unit.id} className="flex items-center gap-2.5">
                            <Icon
                              name={unitDone ? 'check' : unitUnlocked ? unit.icon : 'lock'}
                              size={16}
                              className={
                                unitDone ? 'text-lime-400' : unitUnlocked ? 'text-carbon-300' : 'text-carbon-600'
                              }
                              strokeWidth={unitDone ? 3 : 2}
                            />
                            <span
                              className={`text-sm font-bold ${
                                unitUnlocked ? 'text-carbon-300' : 'text-carbon-600'
                              }`}
                            >
                              Unidad {unit.unit?.number}: {unit.unit?.title ?? unit.title}
                            </span>
                            {unitUnlocked && !unitDone && (
                              <span className="ml-auto text-xs font-black text-carbon-500 tabular-nums">
                                {getNodeStage(unit.id)}/{getNodeMaxStage(unit.id)}
                              </span>
                            )}
                          </div>
                        );
                      })}
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
