import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import TopBar from '../components/TopBar';
import NavRail from '../components/NavRail';
import BottomNav from '../components/BottomNav';
import Icon from '../components/Icon';
import { Button } from '../components/Button';
import { SKILL_TREE } from '../data/lessons';
import { TERM_MASTERY_GOAL, useUserStore } from '../store/useUserStore';
import type { Flashcard } from '../types';

/* A glossary that fills in as you go. Each topic's terms are revealed in
 * proportion to the stages you've cleared on it, so the guide is a record of
 * what you've actually learnt rather than a spoiler of what's coming.
 *
 * Laid out as a grid of cards rather than a list, in the shape Duolingo uses
 * for its alphabets: every term is a tile with a bar underneath showing how
 * well you know it, and a term you've mastered goes platinum — the same blue
 * a mastered topic wears on the path, so "finished" means one thing
 * everywhere in the app. */

function revealedCount(total: number, stage: number, maxStage: number) {
  if (maxStage <= 0 || stage <= 0) return 0;
  if (stage >= maxStage) return total;
  return Math.max(1, Math.round((total * stage) / maxStage));
}

export default function Guide() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const focus = params.get('tema');
  const { isNodeUnlocked, getNodeStage, getNodeMaxStage, nodeStageProgress, termMastery } =
    useUserStore();

  /** The term whose definition is open. Tapping a tile opens it; the grid
   *  can't show definitions inline without becoming the old list again. */
  const [open, setOpen] = useState<Flashcard | null>(null);

  const sections = useMemo(
    () =>
      SKILL_TREE.filter((node) => isNodeUnlocked(node.id) && node.intro?.flashcards.length).map((node) => {
        const cards = node.intro!.flashcards;
        const stage = getNodeStage(node.id);
        const maxStage = getNodeMaxStage(node.id);
        const shown = revealedCount(cards.length, stage, maxStage);
        return { node, cards, stage, maxStage, shown, locked: cards.length - shown };
      }),
    // nodeStageProgress keeps this fresh; the store getters have stable identities.
    [isNodeUnlocked, getNodeStage, getNodeMaxStage, nodeStageProgress]
  );

  const ordered = focus ? [...sections].sort((a) => (a.node.id === focus ? -1 : 0)) : sections;
  const totalShown = sections.reduce((n, s) => n + s.shown, 0);
  const totalTerms = sections.reduce((n, s) => n + s.cards.length, 0);
  const mastered = sections.reduce(
    (n, s) =>
      n + s.cards.slice(0, s.shown).filter((c) => (termMastery[c.id] ?? 0) >= TERM_MASTERY_GOAL).length,
    0
  );
  const masteredPct = totalShown ? Math.round((mastered / totalShown) * 100) : 0;

  return (
    <div className="min-h-dvh bg-carbon-900 lg:flex">
      <NavRail />
      <BottomNav />

      <div className="flex-1 min-w-0">
          <TopBar />

        <div className="max-w-2xl mx-auto px-4 py-6 pb-32 lg:pb-6">
          <h1 className="text-2xl font-black text-carbon-50">Guía</h1>
          <p className="text-sm text-carbon-400 mt-1">
            {totalTerms > 0
              ? `Has desbloqueado ${totalShown} de ${totalTerms} términos.`
              : 'Empieza una lección para desbloquear tus primeros términos.'}
          </p>

          {/* The headline number is mastery, not how much you've unlocked:
              unlocking happens to you, mastering is something you did. */}
          {totalShown > 0 && (
            <div className="mt-4 rounded-3xl border-2 border-carbon-800 bg-carbon-850 p-5">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-[13px] font-black uppercase tracking-[0.8px] text-sky-400">
                  Dominados
                </p>
                <p className="text-sm font-black text-carbon-300 tabular-nums">
                  {mastered}/{totalShown}
                </p>
              </div>
              <div className="mt-2.5 h-3 rounded-full bg-carbon-800 overflow-hidden">
                <div
                  // Platinum rather than a flat colour: this bar measures the
                  // terms that went platinum, so it should be made of them.
                  className="h-full rounded-full platinum-node transition-all duration-500"
                  style={{ width: `${masteredPct}%` }}
                />
              </div>
              <p className="mt-2.5 text-[13px] text-carbon-400">
                Acierta un término {TERM_MASTERY_GOAL} veces en el repaso para dejarlo en platino.
              </p>
              <div className="mt-4">
                <Button onClick={() => navigate('/guia/repaso')}>Repasar términos</Button>
              </div>
            </div>
          )}

          {ordered.map(({ node, cards, stage, maxStage, shown, locked }) => (
            <section key={node.id} className="mt-8">
              <div className="flex items-center gap-2">
                <Icon name={node.icon} size={20} className="text-lime-500" />
                <h2 className="text-[19px] font-black text-carbon-50">{node.title}</h2>
                <span className="ml-auto text-[11px] font-black text-carbon-500 uppercase tracking-wide">
                  {stage}/{maxStage}
                </span>
              </div>

              {shown === 0 ? (
                <p className="mt-3 text-sm text-carbon-500 bg-carbon-850 border-2 border-carbon-800 rounded-2xl px-4 py-4">
                  Completa una etapa de este tema para desbloquear sus términos.
                </p>
              ) : (
                <>
                  <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {cards.slice(0, shown).map((card) => {
                      const level = termMastery[card.id] ?? 0;
                      const isMastered = level >= TERM_MASTERY_GOAL;
                      return (
                        <button
                          key={card.id}
                          onClick={() => setOpen(card)}
                          className={`relative rounded-2xl border-2 px-3 pt-3 pb-2.5 text-left transition ${
                            isMastered
                              ? 'platinum-node platinum-banner border-transparent'
                              : 'bg-carbon-850 border-carbon-800 hover:border-carbon-700'
                          }`}
                        >
                          <span
                            className={`relative z-10 block text-[15px] font-black leading-tight ${
                              isMastered ? 'text-white' : 'text-carbon-100'
                            }`}
                          >
                            {card.term}
                          </span>
                          {/* The bar under each tile, the way the character
                              tiles do it: how close this one term is, not the
                              topic it belongs to. */}
                          <span
                            className={`relative z-10 mt-2 block h-1.5 rounded-full overflow-hidden ${
                              isMastered ? 'bg-white/25' : 'bg-carbon-800'
                            }`}
                          >
                            <span
                              // Green while you're getting there, like every
                              // other progress bar in the app; the tile itself
                              // turns platinum once it's done.
                              className={`block h-full rounded-full transition-all duration-500 ${
                                isMastered ? 'bg-white' : 'bg-lime-500'
                              }`}
                              style={{ width: `${(level / TERM_MASTERY_GOAL) * 100}%` }}
                            />
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-3 w-[200px]">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => navigate(`/guia/repaso?tema=${node.id}`)}
                    >
                      Repasar este tema
                    </Button>
                  </div>
                </>
              )}

              {locked > 0 && shown > 0 && (
                <p className="mt-2 flex items-center gap-1.5 text-xs font-bold text-carbon-500">
                  <Icon name="lock" size={13} />
                  {locked} {locked === 1 ? 'término más' : 'términos más'} al avanzar de etapa
                </p>
              )}
            </section>
          ))}
        </div>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-4"
          onClick={() => setOpen(null)}
        >
          <div
            className="w-full max-w-md rounded-3xl border-2 border-carbon-800 bg-carbon-850 p-6 animate-pop-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-xl font-black text-carbon-50">{open.term}</h3>
              <button
                onClick={() => setOpen(null)}
                aria-label="Cerrar"
                className="text-carbon-500 hover:text-carbon-200 transition -mt-1 -mr-1 p-1"
              >
                <Icon name="close" size={22} strokeWidth={2.6} />
              </button>
            </div>
            <p className="mt-2 text-carbon-300 leading-snug">{open.definition}</p>

            {(termMastery[open.id] ?? 0) >= TERM_MASTERY_GOAL ? (
              <p className="mt-4 flex items-center gap-1.5 text-sky-400 font-black text-sm">
                <Icon name="diamond" size={16} /> Dominado
              </p>
            ) : (
              <p className="mt-4 text-sm text-carbon-500 font-bold">
                {termMastery[open.id] ?? 0}/{TERM_MASTERY_GOAL} aciertos para dominarlo
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
