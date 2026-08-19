import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import TopBar from '../components/TopBar';
import Mascot from '../components/Mascot';
import Icon from '../components/Icon';
import { Button } from '../components/Button';
import { formatCountdown, useHeartRegen } from '../hooks/useHeartRegen';
import { SKILL_TREE } from '../data/lessons';
import { useUserStore, xpToLevel } from '../store/useUserStore';
import type { IconName, SkillNode } from '../types';

/* Three-column learn layout, in the shape Duolingo uses: nav rail on the left,
 * the lesson path down the middle, stat cards on the right. Below lg the rails
 * drop away and the phone keeps the path plus the existing top bar. */

/** Horizontal offsets, in px, that give the path its serpentine walk. Cycles. */
const SWAY = [0, -44, -70, -44, 0, 44, 70, 44];
const NODE_PITCH = 116;

const NAV: { to: string; label: string; icon: IconName }[] = [
  { to: '/home', label: 'Aprender', icon: 'map' },
  { to: '/profile', label: 'Perfil', icon: 'user' },
];

function NavRail() {
  const { pathname } = useLocation();
  return (
    <aside className="hidden lg:flex flex-col w-[256px] shrink-0 border-r-2 border-carbon-800 h-dvh sticky top-0 p-4">
      <Link to="/home" className="flex items-center gap-2 px-3 py-4">
        <Mascot size={32} mood="happy" />
        <span className="text-2xl font-black text-lime-500 tracking-tight">Stonksu</span>
      </Link>
      <nav className="mt-4 flex flex-col gap-2">
        {NAV.map((item) => {
          const active = pathname === item.to;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`h-[52px] flex items-center gap-3 px-4 rounded-xl border-2 text-[15px] font-black uppercase tracking-[0.8px] transition ${
                active
                  ? 'bg-lime-500/10 border-lime-500/50 text-lime-400'
                  : 'border-transparent text-carbon-300 hover:bg-carbon-850'
              }`}
            >
              <Icon name={item.icon} size={22} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

function StatRail({
  hearts,
  msUntilNextHeart,
  active,
}: {
  hearts: number;
  msUntilNextHeart: number | null;
  active: { node: SkillNode; stage: number; maxStage: number } | null;
}) {
  const { streak, xp } = useUserStore();
  const { level } = xpToLevel(xp);

  return (
    <aside className="hidden xl:block w-[368px] shrink-0 p-6 space-y-4">
      <div className="flex items-center justify-around bg-carbon-850 border-2 border-carbon-800 rounded-2xl py-3">
        <span className="flex items-center gap-1.5 font-black text-carbon-50">
          <Icon name="flame" size={20} className={streak > 0 ? 'text-lime-500 animate-flame-flicker' : 'text-carbon-600'} />
          {streak}
        </span>
        <span className="flex items-center gap-1.5 font-black text-carbon-50">
          <Icon name="star" size={20} className="text-lime-500" /> {xp}
        </span>
        <span className="flex items-center gap-1.5 font-black text-carbon-50">
          <Icon name="heart" size={20} className="text-lime-500" /> {hearts}
        </span>
      </div>

      {active && (
        <div className="bg-carbon-850 border-2 border-carbon-800 rounded-2xl p-4">
          <h2 className="text-[19px] font-black text-carbon-50">Tu etapa actual</h2>
          <p className="text-sm text-carbon-400 mt-0.5">{active.node.title}</p>
          <div className="flex items-center gap-1 mt-3">
            {Array.from({ length: active.maxStage }).map((_, i) => (
              <span key={i} className={`h-2 flex-1 rounded-full ${i < active.stage ? 'bg-lime-500' : 'bg-carbon-700'}`} />
            ))}
          </div>
          <p className="text-xs font-bold text-carbon-400 mt-2">
            {active.stage}/{active.maxStage} — te faltan {active.maxStage - active.stage} para PLATINO
          </p>
        </div>
      )}

      <div className="bg-carbon-850 border-2 border-carbon-800 rounded-2xl p-4">
        <h2 className="text-[19px] font-black text-carbon-50">Nivel {level}</h2>
        <p className="text-sm text-carbon-400 mt-0.5">
          {hearts > 0
            ? 'Sigue el camino y no sueltes la racha.'
            : msUntilNextHeart !== null
            ? `Próxima vida en ${formatCountdown(msUntilNextHeart)}`
            : 'Sin vidas por ahora.'}
        </p>
      </div>
    </aside>
  );
}

export default function Home() {
  const navigate = useNavigate();
  const {
    name,
    isNodeUnlocked,
    isLessonCompleted,
    hasSeenIntro,
    getNodeStage,
    getNodeMaxStage,
    isNodePlatinum,
  } = useUserStore();
  const [selected, setSelected] = useState<SkillNode | null>(null);
  const { hearts, msUntilNextHeart } = useHeartRegen();

  const nodes = useMemo(
    () =>
      SKILL_TREE.map((node) => {
        const unlocked = isNodeUnlocked(node.id);
        const platinum = isNodePlatinum(node.id);
        const stage = getNodeStage(node.id);
        const maxStage = getNodeMaxStage(node.id);
        return { node, unlocked, platinum, stage, maxStage, started: stage > 0 };
      }),
    [isNodeUnlocked, getNodeStage, getNodeMaxStage, isNodePlatinum]
  );

  /** The furthest node you can actually play — what the banner and the
   *  "empezar" marker point at. */
  const current = nodes.find((n) => n.unlocked && !n.platinum && n.node.lessons.length > 0) ?? null;

  return (
    <div className="min-h-dvh bg-carbon-900 lg:flex">
      <NavRail />

      <div className="lg:hidden">
        <TopBar />
      </div>

      <main className="flex-1 min-w-0 px-4 pb-24 pb-safe lg:py-6">
        <div className="max-w-[600px] mx-auto">
          {/* Section banner */}
          <div className="mt-4 lg:mt-0 bg-lime-500 rounded-2xl px-5 py-4 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[13px] font-black text-carbon-900/70 uppercase tracking-wide">
                {current ? `Etapa ${current.stage + 1} de ${current.maxStage}` : 'Todo platinado'}
              </p>
              <h1 className="text-xl font-black text-carbon-900 truncate">
                {current ? current.node.title : `¡Bien hecho, ${name || 'trader'}!`}
              </h1>
            </div>
            {current && (
              <button
                onClick={() => setSelected(current.node)}
                className="shrink-0 flex items-center gap-1.5 bg-carbon-900/15 hover:bg-carbon-900/25 text-carbon-900 font-black text-[13px] uppercase tracking-wide rounded-xl px-3 py-2.5 transition"
              >
                <Icon name="clipboard" size={16} /> Guía
              </button>
            )}
          </div>

          {/* Lesson path */}
          <div className="relative mt-10 flex flex-col items-center">
            {nodes.map(({ node, unlocked, platinum, stage, maxStage }, i) => {
              const isCurrent = current?.node.id === node.id;
              return (
                <div
                  key={node.id}
                  className="relative flex flex-col items-center"
                  style={{ transform: `translateX(${SWAY[i % SWAY.length]}px)`, marginBottom: NODE_PITCH - 70 }}
                >
                  {isCurrent && (
                    <span className="absolute -top-9 whitespace-nowrap bg-carbon-850 border-2 border-carbon-700 text-lime-400 text-[11px] font-black uppercase tracking-[0.8px] px-3 py-1.5 rounded-xl animate-float">
                      Empezar
                    </span>
                  )}

                  <button
                    disabled={!unlocked}
                    onClick={() => setSelected(node)}
                    aria-label={node.title}
                    style={{
                      ['--btn-lip' as string]: platinum
                        ? 'var(--color-carbon-500)'
                        : unlocked
                        ? 'var(--color-lime-700)'
                        : 'var(--color-carbon-950)',
                    }}
                    className={`btn-3d w-[70px] h-[70px] rounded-full flex items-center justify-center ${
                      platinum
                        ? 'bg-gradient-to-br from-carbon-100 to-carbon-300 text-carbon-900'
                        : unlocked
                        ? 'bg-lime-500 text-carbon-900'
                        : 'bg-carbon-800 text-carbon-600 cursor-not-allowed'
                    } ${isCurrent ? 'ring-4 ring-lime-500/25' : ''}`}
                  >
                    <Icon name={unlocked ? node.icon : 'lock'} size={30} strokeWidth={unlocked ? 1.9 : 2} />
                  </button>

                  <span
                    className={`mt-2 text-[13px] font-black text-center w-32 leading-tight ${
                      unlocked ? 'text-carbon-100' : 'text-carbon-600'
                    }`}
                  >
                    {node.title}
                  </span>
                  {unlocked && maxStage > 0 && (
                    <span className="text-[11px] font-black text-carbon-500 mt-0.5">
                      {platinum ? 'PLATINO' : `${stage}/${maxStage}`}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </main>

      <StatRail
        hearts={hearts}
        msUntilNextHeart={msUntilNextHeart}
        active={current ? { node: current.node, stage: current.stage, maxStage: current.maxStage } : null}
      />

      {selected && (
        <div
          className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-40 p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-carbon-850 border-2 border-carbon-800 rounded-3xl max-w-sm w-full p-6 text-center animate-pop-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-16 h-16 rounded-full bg-lime-500/10 flex items-center justify-center mx-auto mb-3">
              <Icon name={selected.icon} size={32} className="text-lime-500" />
            </div>
            <h2 className="text-xl font-black text-carbon-50">{selected.title}</h2>
            <p className="text-carbon-400 mt-1">{selected.description}</p>

            {selected.lessons.length > 0 && (
              <div className="mt-4 bg-carbon-800 rounded-2xl p-3">
                {isNodePlatinum(selected.id) ? (
                  <p className="flex items-center justify-center gap-1.5 text-sm font-black text-carbon-50">
                    <Icon name="diamond" size={16} className="text-carbon-100" /> ¡PLATINO conseguido!
                  </p>
                ) : (
                  <>
                    <div className="flex items-center justify-center gap-1 mb-2">
                      {Array.from({ length: getNodeMaxStage(selected.id) }).map((_, i) => (
                        <span
                          key={i}
                          className={`h-2 flex-1 rounded-full ${
                            i < getNodeStage(selected.id) ? 'bg-lime-500' : 'bg-carbon-700'
                          }`}
                        />
                      ))}
                    </div>
                    <p className="text-xs font-bold text-carbon-400">
                      Etapa {getNodeStage(selected.id)}/{getNodeMaxStage(selected.id)} — te faltan{' '}
                      {getNodeMaxStage(selected.id) - getNodeStage(selected.id)} para PLATINO
                    </p>
                  </>
                )}
              </div>
            )}

            {selected.lessons.length > 0 ? (
              hearts <= 0 ? (
                <div className="mt-4 w-full bg-carbon-800 rounded-2xl py-3.5 flex flex-col items-center gap-1">
                  <p className="text-sm font-black text-carbon-300 flex items-center gap-1.5">
                    <Icon name="heart" size={16} className="text-carbon-600" /> Sin vidas
                  </p>
                  {msUntilNextHeart !== null && (
                    <p className="text-xs font-bold text-carbon-500">
                      Próxima vida en {formatCountdown(msUntilNextHeart)}
                    </p>
                  )}
                </div>
              ) : (
                <div className="mt-4">
                  <Button
                    onClick={() => {
                      const lessonId = selected.lessons[0].id;
                      const needsIntro = !!selected.intro && !hasSeenIntro(selected.id);
                      navigate(needsIntro ? `/lesson/${lessonId}/intro` : `/lesson/${lessonId}`);
                    }}
                  >
                    {isLessonCompleted(selected.lessons[0].id) ? (
                      <>
                        <Icon name="refresh" size={18} /> Repasar lección
                      </>
                    ) : (
                      'Empezar lección'
                    )}
                  </Button>
                </div>
              )
            ) : (
              <p className="mt-6 text-sm font-bold text-carbon-400 bg-carbon-800 rounded-xl py-3">
                Próximamente — ¡seguimos construyendo este módulo!
              </p>
            )}
            <button onClick={() => setSelected(null)} className="mt-3 w-full text-carbon-400 font-bold py-2">
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
