import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import TopBar from '../components/TopBar';
import NavRail from '../components/NavRail';
import BottomNav from '../components/BottomNav';
import Icon from '../components/Icon';
import { SKILL_TREE } from '../data/lessons';
import { useUserStore } from '../store/useUserStore';

/* A glossary that fills in as you go. Each topic's terms are revealed in
 * proportion to the stages you've cleared on it, so the guide is a record of
 * what you've actually learnt rather than a spoiler of what's coming. */

function revealedCount(total: number, stage: number, maxStage: number) {
  if (maxStage <= 0 || stage <= 0) return 0;
  if (stage >= maxStage) return total;
  return Math.max(1, Math.round((total * stage) / maxStage));
}

export default function Guide() {
  const [params] = useSearchParams();
  const focus = params.get('tema');
  const { isNodeUnlocked, getNodeStage, getNodeMaxStage, nodeStageProgress } = useUserStore();

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

  return (
    <div className="min-h-dvh bg-carbon-900 lg:flex">
      <NavRail />
      <BottomNav />

      <div className="flex-1 min-w-0">
        <div className="lg:hidden">
          <TopBar />
        </div>

        <div className="max-w-2xl mx-auto px-4 py-6 pb-32 lg:pb-6">
          <h1 className="text-2xl font-black text-carbon-50">Guía</h1>
          <p className="text-sm text-carbon-400 mt-1">
            {totalTerms > 0
              ? `Has desbloqueado ${totalShown} de ${totalTerms} términos.`
              : 'Empieza una lección para desbloquear tus primeros términos.'}
          </p>

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
                <dl className="mt-3 space-y-2">
                  {cards.slice(0, shown).map((card) => (
                    <div key={card.id} className="bg-carbon-850 border-2 border-carbon-800 rounded-2xl px-4 py-3">
                      <dt className="font-black text-carbon-50">{card.term}</dt>
                      <dd className="text-sm text-carbon-300 mt-0.5 leading-snug">{card.definition}</dd>
                    </div>
                  ))}
                </dl>
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
    </div>
  );
}
