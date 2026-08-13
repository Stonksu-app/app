import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import TopBar from '../components/TopBar';
import Mascot from '../components/Mascot';
import Icon from '../components/Icon';
import { formatCountdown, useHeartRegen } from '../hooks/useHeartRegen';
import { SKILL_TREE } from '../data/lessons';
import { useUserStore } from '../store/useUserStore';
import type { SkillNode } from '../types';

const ROW_HEIGHT = 132;

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

  const nodesWithStatus = useMemo(
    () =>
      SKILL_TREE.map((node) => {
        const unlocked = isNodeUnlocked(node.id);
        const hasLessons = node.lessons.length > 0;
        const completed = hasLessons && node.lessons.every((l) => isLessonCompleted(l.id));
        const stage = getNodeStage(node.id);
        const maxStage = getNodeMaxStage(node.id);
        const platinum = isNodePlatinum(node.id);
        return { node, unlocked, hasLessons, completed, stage, maxStage, platinum };
      }),
    [isNodeUnlocked, isLessonCompleted, getNodeStage, getNodeMaxStage, isNodePlatinum]
  );

  const totalHeight = SKILL_TREE.length * ROW_HEIGHT + 40;

  const points = nodesWithStatus.map(({ node }) => ({
    x: node.position.x,
    y: node.position.y * ROW_HEIGHT + 60,
  }));

  const pathD = points
    .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
    .join(' ');

  return (
    <div className="min-h-dvh bg-carbon-900">
      <TopBar />

      <div className="max-w-2xl mx-auto px-4 pt-6">
        <div className="bg-carbon-850 rounded-2xl border border-carbon-800 p-4 flex items-center gap-3 mb-6">
          <Mascot size={56} mood="happy" />
          <div className="text-left">
            <p className="font-black text-carbon-50">
              ¡Qué tal, {name || 'trader'}!
            </p>
            <p className="text-sm text-carbon-400">Sigue el mapa y no sueltes tu racha.</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pb-20 pb-safe">
        <div className="relative" style={{ height: totalHeight }}>
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            viewBox={`0 0 100 ${totalHeight}`}
            preserveAspectRatio="none"
          >
            <path
              d={pathD}
              stroke="#333333"
              strokeWidth={8}
              strokeLinecap="round"
              fill="none"
              strokeDasharray="2 22"
              vectorEffect="non-scaling-stroke"
            />
          </svg>

          {nodesWithStatus.map(({ node, unlocked, completed, stage, maxStage, platinum }) => {
            const top = node.position.y * ROW_HEIGHT + 60;
            return (
              <div
                key={node.id}
                className="absolute flex flex-col items-center -translate-x-1/2"
                style={{ left: `${node.position.x}%`, top }}
              >
                <div className="relative">
                  <button
                    disabled={!unlocked}
                    onClick={() => setSelected(node)}
                    aria-label={node.title}
                    className={`w-20 h-20 rounded-full flex items-center justify-center border-4 shadow-md transition active:scale-95 ${
                      platinum
                        ? 'bg-gradient-to-br from-carbon-100 to-carbon-300 border-carbon-50 text-carbon-900'
                        : completed
                        ? 'bg-lime-500 border-lime-400 text-carbon-900'
                        : unlocked
                        ? 'bg-carbon-800 border-lime-500 text-lime-500 animate-float'
                        : 'bg-carbon-850 border-carbon-800 text-carbon-600 cursor-not-allowed'
                    }`}
                  >
                    <Icon name={unlocked ? node.icon : 'lock'} size={30} strokeWidth={unlocked ? 1.8 : 2} />
                  </button>
                  {unlocked && maxStage > 0 && (
                    <span
                      className={`absolute -bottom-1 -right-1 flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-black border-2 border-carbon-900 ${
                        platinum ? 'bg-carbon-100 text-carbon-900' : 'bg-carbon-800 text-lime-400'
                      }`}
                    >
                      {platinum ? (
                        <Icon name="diamond" size={10} />
                      ) : (
                        `${stage}/${maxStage}`
                      )}
                    </span>
                  )}
                </div>
                <span className={`mt-1.5 text-xs font-extrabold text-center w-24 ${unlocked ? 'text-carbon-100' : 'text-carbon-600'}`}>
                  {node.title}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {selected && (
        <div
          className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-40 p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-carbon-850 border border-carbon-800 rounded-3xl max-w-sm w-full p-6 text-center animate-pop-in"
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
                <button
                  onClick={() => {
                    const lessonId = selected.lessons[0].id;
                    const needsIntro = !!selected.intro && !hasSeenIntro(selected.id);
                    navigate(needsIntro ? `/lesson/${lessonId}/intro` : `/lesson/${lessonId}`);
                  }}
                  className="mt-4 w-full bg-lime-500 hover:bg-lime-400 text-carbon-900 font-black py-3.5 rounded-2xl transition active:scale-95 flex items-center justify-center gap-2"
                >
                  {isLessonCompleted(selected.lessons[0].id) ? (
                    <>
                      <Icon name="refresh" size={20} /> Repasar lección
                    </>
                  ) : (
                    'Empezar lección'
                  )}
                </button>
              )
            ) : (
              <p className="mt-6 text-sm font-bold text-carbon-400 bg-carbon-800 rounded-xl py-3">
                Próximamente — ¡seguimos construyendo este módulo!
              </p>
            )}
            <button
              onClick={() => setSelected(null)}
              className="mt-3 w-full text-carbon-400 font-bold py-2"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
