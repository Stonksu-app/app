import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import TopBar from '../components/TopBar';
import NavRail from '../components/NavRail';
import BottomNav from '../components/BottomNav';
import Icon from '../components/Icon';
import NodeRing from '../components/NodeRing';
import AdSlot from '../components/AdSlot';
import UltraPromo from '../components/UltraPromo';
import { Button } from '../components/Button';
import { formatCountdown, useHeartRegen } from '../hooks/useHeartRegen';
import { SKILL_TREE } from '../data/lessons';
import StatPanel, { type StatKey } from '../components/StatPanels';
import { CHEST_REWARD, useUserStore, xpToLevel } from '../store/useUserStore';
import { canPlayUltraLessons } from '../data/plans';
import type { IconName, SkillNode } from '../types';

/* Three-column learn layout, in the shape Duolingo uses: nav rail on the left,
 * the lesson path down the middle, stat cards on the right. Below lg the rails
 * drop away and the phone keeps the path plus the existing top bar. */

/** Horizontal offsets, in px, that give the path its serpentine walk. Cycles. */
const SWAY = [0, -44, -70, -44, 0, 44, 70, 44];
const NODE_PITCH = 116;

/** A chest sits after every CHEST_EVERY topics and opens once the topic before
 *  it is platinum, so it pays out for mastering a subject rather than for
 *  merely walking past it. One per topic keeps the first reward reachable —
 *  at two, you'd have to platinum two whole subjects before seeing one.
 *  The payout itself lives in the store as CHEST_REWARD. */
const CHEST_EVERY = 1;

/** One banner style per unit, cycling if more units get added later — same
 *  idea as Duolingo's colour-coded section banners, so each stretch of the
 *  path reads as its own chapter instead of one long undifferentiated list. */
const UNIT_STYLES = [
  { bg: 'bg-lime-500', text: 'text-carbon-900', sub: 'text-carbon-900/70', chip: 'bg-carbon-900/15 hover:bg-carbon-900/25 text-carbon-900' },
  { bg: 'bg-sky-500', text: 'text-carbon-900', sub: 'text-carbon-900/70', chip: 'bg-carbon-900/15 hover:bg-carbon-900/25 text-carbon-900' },
  { bg: 'bg-amber-500', text: 'text-carbon-900', sub: 'text-carbon-900/70', chip: 'bg-carbon-900/15 hover:bg-carbon-900/25 text-carbon-900' },
  { bg: 'bg-fuchsia-500', text: 'text-carbon-50', sub: 'text-carbon-50/70', chip: 'bg-carbon-50/15 hover:bg-carbon-50/25 text-carbon-50' },
];

/** A unit you've platinumed drops its chapter colour for the same blue the
 *  nodes wear, so the banner reads as something you earned rather than as a
 *  label that happens to be there. */
const PLATINUM_STYLE = {
  // platinum-position-ok: the banner this lands on is sticky, so it already
  // establishes the containing block the shine needs.
  bg: 'platinum-node platinum-banner',
  text: 'text-white',
  sub: 'text-white/75',
  chip: 'bg-carbon-900/25 hover:bg-carbon-900/40 text-white',
};

function StatRail({
  hearts,
  msUntilNextHeart,
  active,
}: {
  hearts: number;
  msUntilNextHeart: number | null;
  active: { node: SkillNode; stage: number; maxStage: number } | null;
}) {
  const { streak, xp, coins } = useUserStore();
  const { level } = xpToLevel(xp);
  const [hovered, setHovered] = useState<StatKey | null>(null);
  // Measured rather than derived from the index: the counters are laid out with
  // justify-around, so their spacing depends on how wide each number renders.
  const [arrowX, setArrowX] = useState(0);
  const rowRef = useRef<HTMLDivElement>(null);

  const STATS: { key: StatKey; icon: IconName; value: number; dim?: boolean }[] = [
    { key: 'streak', icon: 'flame', value: streak, dim: streak === 0 },
    { key: 'xp', icon: 'star', value: xp },
    { key: 'coins', icon: 'coins', value: coins },
    { key: 'hearts', icon: 'heart', value: hearts },
  ];

  const reveal = (key: StatKey, el: HTMLElement) => {
    setHovered(key);
    const row = rowRef.current;
    if (!row) return;
    const b = el.getBoundingClientRect();
    setArrowX(b.left + b.width / 2 - row.getBoundingClientRect().left);
  };

  return (
    <aside className="hidden xl:block w-[368px] shrink-0 p-6 space-y-4">
      <UltraPromo />
      {/* Hovering a counter reveals its panel, pointed at by a small arrow —
          the desktop counterpart to tapping it open on a phone. */}
      <div className="relative" onMouseLeave={() => setHovered(null)}>
        <div
          ref={rowRef}
          className="flex items-center justify-around bg-carbon-850 border-2 border-carbon-800 rounded-2xl py-3"
        >
          {STATS.map((s) => (
            <button
              key={s.key}
              onMouseEnter={(e) => reveal(s.key, e.currentTarget)}
              onFocus={(e) => reveal(s.key, e.currentTarget)}
              onBlur={() => setHovered(null)}
              aria-expanded={hovered === s.key}
              className={`flex items-center gap-1.5 font-black text-carbon-50 px-3 py-1 rounded-lg transition ${
                hovered === s.key ? 'bg-carbon-800' : ''
              }`}
            >
              <Icon
                name={s.icon}
                size={20}
                className={
                  s.dim ? 'text-carbon-600' : s.key === 'streak' ? 'text-lime-500 animate-flame-flicker' : 'text-lime-500'
                }
              />
              {s.value}
            </button>
          ))}
        </div>

        {hovered && (
          <>
            {/* Deliberately a sibling of the animated card, not a child: pop-in
                starts at scale(0.6), which would drag the arrow 64px inward
                and leave it pointing at the wrong counter mid-animation. */}
            <span
              className="absolute top-full z-50 w-3.5 h-3.5 rotate-45 bg-carbon-850 border-l-2 border-t-2 border-carbon-800"
              style={{ left: arrowX, marginLeft: -7, marginTop: 1 }}
            />
            <div className="absolute left-0 right-0 top-full pt-2 z-40 animate-pop-in">
              <div className="bg-carbon-850 border-2 border-carbon-800 rounded-2xl p-4">
                <StatPanel stat={hovered} compact />
              </div>
            </div>
          </>
        )}
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
  const [searchParams] = useSearchParams();
  const {
    name,
    isNodeUnlocked,
    isLessonCompleted,
    hasSeenIntro,
    getNodeStage,
    getNodeMaxStage,
    isNodePlatinum,
  } = useUserStore();
  // Depend on the raw state slices, not on the store's getter functions: those
  // keep a stable identity, so a memo keyed on them never recomputes and the
  // path would keep rendering a chest as unopened after you claimed it.
  const { openedChestIds, nodeStageProgress, openChest, testMode, plan } = useUserStore();
  const [selected, setSelected] = useState<SkillNode | null>(null);
  const [reward, setReward] = useState<{ protectorGifted: boolean } | null>(null);
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
    // Same reasoning as the chests: key this on the progress record itself so
    // stage counts refresh, rather than on the stable getter identities.
    [isNodeUnlocked, getNodeStage, getNodeMaxStage, isNodePlatinum, nodeStageProgress]
  );

  /** The furthest node you can actually play — what the banner and the
   *  "empezar" marker point at. Taken from the whole tree, not the section on
   *  screen, so reviewing an old section doesn't move where you are. */
  const current = nodes.find((n) => n.unlocked && !n.platinum && n.node.lessons.length > 0) ?? null;

  /**
   * The section the path is showing.
   *
   * One at a time, the way Duolingo does it: the path is a section, not the
   * whole course. Scrolling can't wander into a section you finished or one
   * you haven't earned — changing chapter is a deliberate trip through the
   * sections page, which is what makes it feel like somewhere you go rather
   * than a list you scrolled past.
   *
   * Defaults to the section being studied, so opening the app lands you where
   * you left off rather than at the beginning of the course.
   */
  const requestedSection = Number(searchParams.get('seccion')) || null;
  const currentSection = current?.node.section?.number ?? 1;

  const viewSection = useMemo(() => {
    if (!requestedSection) return currentSection;
    // A section nobody has reached yet isn't reachable by typing a number into
    // the address bar either.
    const reachable = nodes.some((n) => n.node.section?.number === requestedSection && n.unlocked);
    return reachable ? requestedSection : currentSection;
  }, [requestedSection, currentSection, nodes]);

  /** Only this section's topics are on the path. */
  const sectionNodes = useMemo(
    () => nodes.filter((n) => (n.node.section?.number ?? 1) === viewSection),
    [nodes, viewSection]
  );

  /** True when you're looking at a chapter you already finished. */
  const reviewing = viewSection !== currentSection;

  /**
   * What comes after this section, for the card at the end of the path.
   *
   * The path stops at the section boundary now, so without this the last
   * node is simply where the page ends — nothing says there's more course
   * behind it, or that finishing this one is what opens it.
   */
  const nextSection = useMemo(() => {
    const after = nodes.filter((n) => n.node.section?.number === viewSection + 1);
    if (after.length === 0) return null;
    return {
      number: viewSection + 1,
      title: after[0].node.section?.title ?? '',
      units: [...new Set(after.map((n) => n.node.unit?.title).filter(Boolean))] as string[],
      unlocked: after.some((n) => n.unlocked),
    };
  }, [nodes, viewSection]);

  // Changing section keeps the same route, so the browser has no reason to
  // move the scroll — without this you'd arrive at the new section's path
  // already scrolled to wherever the old one ended.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [viewSection]);

  /**
   * The unit the banner is describing.
   *
   * Follows the scroll rather than progress, which is what Duolingo does and
   * what makes the header useful: scrolling ahead to see what's coming should
   * tell you what you're looking at, not keep repeating where you left off.
   * Falls back to the unit being played, which is what you see on arrival.
   */
  const [scrolledUnit, setScrolledUnit] = useState<{ section: number; unit: number; title: string } | null>(null);
  const banner = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let queued = false;
    const update = () => {
      queued = false;
      // Measured, not assumed: where the banner ends depends on whether the
      // stat bar is above it, how deep the notch is, and whether the title
      // needed a second line.
      const threshold = banner.current?.getBoundingClientRect().bottom ?? 72;
      const markers = document.querySelectorAll<HTMLElement>('[data-unit]');
      let latest: { section: number; unit: number; title: string } | null = null;
      markers.forEach((el) => {
        // Anything whose divider has passed under the banner is a unit we are
        // now inside; the last such one wins.
        if (el.getBoundingClientRect().top <= threshold) {
          const [section, unit, title] = (el.dataset.unit ?? '').split('|');
          latest = { section: Number(section), unit: Number(unit), title };
        }
      });
      setScrolledUnit(latest);
    };

    // Coalesced into a frame: a scroll listener that measures on every event
    // would read layout dozens of times per gesture.
    const onScroll = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  // Keyed on nodes rather than the derived path: the dividers come from these,
  // and pathItems is built further down.
  }, [nodes]);

  /**
   * Before any divider has scrolled past, the banner falls back to something
   * sensible — and it has to be something from the section on screen. Falling
   * back to where you are studying would label a section you opened to review
   * with the name of a unit that isn't even on the path.
   */
  const fallbackUnit = useMemo(() => {
    const inView =
      sectionNodes.find((n) => n.node.id === current?.node.id) ?? sectionNodes[0] ?? null;
    const { section, unit } = inView?.node ?? {};
    return section && unit ? { section: section.number, unit: unit.number, title: unit.title } : null;
  }, [sectionNodes, current]);

  const shownUnit = scrolledUnit ?? fallbackUnit;

  /**
   * Which units are finished outright.
   *
   * A unit counts only once every topic in it is platinum — chests and any
   * node without lessons are scenery, not something you can master, so they
   * neither hold a unit back nor let an empty one qualify.
   */
  const platinumUnits = useMemo(() => {
    const byUnit = new Map<string, boolean>();
    for (const n of nodes) {
      const { section, unit } = n.node;
      if (!section || !unit || n.node.lessons.length === 0) continue;
      const key = `${section.number}|${unit.number}`;
      byUnit.set(key, (byUnit.get(key) ?? true) && n.platinum);
    }
    return byUnit;
  }, [nodes]);

  const shownUnitPlatinum = !shownUnit || (platinumUnits.get(`${shownUnit.section}|${shownUnit.unit}`) ?? false);

  const unitStyle = shownUnitPlatinum
    ? PLATINUM_STYLE
    : UNIT_STYLES[((shownUnit?.section ?? 1) - 1) % UNIT_STYLES.length];

  /** The sweeping highlight is an overlay, so everything written on top of it
   *  needs to be lifted out of its way. */
  const overSweep = shownUnitPlatinum ? 'relative z-10' : '';

  /** Topics and chests woven into a single walkable list, so the sway offset
   *  applies to both and the chest genuinely sits on the path. */
  const pathItems = useMemo(() => {
    type Item =
      | { kind: 'node'; key: string; data: (typeof nodes)[number] }
      | { kind: 'chest'; key: string; unlocked: boolean; opened: boolean }
      /** Marks where a unit begins, and says so louder when a whole section
       *  does. Duolingo puts the coloured banner at the top of the screen and
       *  a quiet line in the path itself — the banner tells you where you are,
       *  the line tells you where one chapter ended and the next began. */
      | {
          kind: 'divider';
          key: string;
          section: number;
          sectionTitle: string;
          startsSection: boolean;
          sectionPlatinum: boolean;
          unit: number;
          title: string;
          platinum: boolean;
        };
    const items: Item[] = [];
    let lastSection: number | null = null;
    let lastUnit: number | null = null;

    sectionNodes.forEach((n, i) => {
      const { section, unit } = n.node;
      if (section && unit && (section.number !== lastSection || unit.number !== lastUnit)) {
        const startsSection = section.number !== lastSection;
        items.push({
          kind: 'divider',
          key: `divider-${section.number}-${unit.number}`,
          section: section.number,
          sectionTitle: section.title,
          startsSection,
          sectionPlatinum: sectionNodes.every(
            (m) => m.node.lessons.length === 0 || m.platinum
          ),
          unit: unit.number,
          title: unit.title,
          platinum: platinumUnits.get(`${section.number}|${unit.number}`) ?? false,
        });
        lastSection = section.number;
        lastUnit = unit.number;
      }

      items.push({ kind: 'node', key: n.node.id, data: n });
      const lastOne = i === sectionNodes.length - 1;
      if (!lastOne && (i + 1) % CHEST_EVERY === 0) {
        const key = `chest-${n.node.id}`;
        items.push({
          kind: 'chest',
          key,
          unlocked: n.platinum || testMode,
          opened: openedChestIds.includes(key),
        });
      }
    });
    return items;
  }, [sectionNodes, openedChestIds, testMode, platinumUnits]);

  return (
    <div className="min-h-dvh bg-carbon-900 lg:flex">
      <NavRail />

        <TopBar />

      {/* pb-32 keeps the last node clear of the fixed BottomNav on phones. */}
      <main className="flex-1 min-w-0 px-4 pb-32 lg:pb-6 lg:py-6">
        <div className="max-w-[600px] mx-auto">
          {/* The unit you are on, pinned to the top the way Duolingo does it,
              so the answer to "where am I?" survives scrolling down the path.
              Coloured per section, which is what makes one chapter feel
              different from the next rather than the palette wandering. */}
          <div
            ref={banner}
            // Parks below the phone's stat bar, which is pinned too: the
            // bar's own height plus whatever the notch takes. On desktop that
            // bar isn't there and the banner goes to the very top.
            className={`sticky top-[calc(var(--topbar-h)_+_env(safe-area-inset-top))] lg:top-0 z-20 mt-4 lg:mt-0 ${unitStyle.bg} rounded-2xl px-4 py-3.5 flex items-center gap-3`}
          >
            <Link
              to="/secciones"
              aria-label="Ver todas las secciones"
              className={`shrink-0 -ml-1 p-1 rounded-lg transition ${unitStyle.chip} ${overSweep}`}
            >
              <Icon name="chevron-left" size={22} strokeWidth={2.6} />
            </Link>

            <div className={`min-w-0 flex-1 ${overSweep}`}>
              <p
                className={`text-[11px] sm:text-[13px] font-black uppercase tracking-[0.6px] sm:tracking-[0.8px] ${unitStyle.sub}`}
              >
                {shownUnit ? `Sección ${shownUnit.section}, Unidad ${shownUnit.unit}` : 'Todo platinado'}
                {/* Says so out loud: landing in an old chapter without this
                    reads as having lost your place. */}
                {reviewing && ' · Repaso'}
              </p>
              {/* Two lines rather than one clipped one: on a phone the title
                  has ~180px between the back arrow and the guide chip, and
                  most of them are wider than that. Clamped at two so a long
                  title can't push the path down the screen. */}
              <h1 className={`text-lg sm:text-xl font-black leading-tight line-clamp-2 ${unitStyle.text}`}>
                {shownUnit ? shownUnit.title : `¡Bien hecho, ${name || 'trader'}!`}
              </h1>
            </div>

            {current && (
              <Link
                to={`/guia?tema=${current.node.id}`}
                aria-label="Guía del tema"
                className={`shrink-0 flex items-center gap-1.5 font-black text-[13px] uppercase tracking-wide rounded-xl px-2.5 sm:px-3 py-2.5 transition ${unitStyle.chip} ${overSweep}`}
              >
                {/* The word is dropped on phones, not the button: those
                    ~45px are the difference between a title that fits on one
                    line and one that doesn't. */}
                <Icon name="clipboard" size={16} /> <span className="hidden sm:inline">Guía</span>
              </Link>
            )}
          </div>

          {/* Lesson path. The top margin has to clear the "empezar" marker,
              which floats 36px above the first node plus its own height. */}
          <div className="relative mt-20 flex flex-col items-center">
            {pathItems.map((item, i) => {
              const sway = { transform: `translateX(${SWAY[i % SWAY.length]}px)`, marginBottom: NODE_PITCH - 70 };

              if (item.kind === 'chest') {
                return (
                  <div key={item.key} className="relative flex flex-col items-center" style={sway}>
                    <button
                      disabled={!item.unlocked || item.opened}
                      onClick={() => {
                        const protectorGifted = openChest(item.key);
                        setReward({ protectorGifted });
                      }}
                      aria-label={item.opened ? 'Cofre abierto' : 'Abrir cofre'}
                      style={{
                        ['--btn-lip' as string]: item.unlocked && !item.opened
                          ? '#8a6a12'
                          : 'var(--color-carbon-950)',
                      }}
                      className={`btn-3d w-[70px] h-[70px] rounded-2xl flex items-center justify-center ${
                        item.opened
                          ? 'bg-carbon-800 text-carbon-600'
                          : item.unlocked
                          ? 'bg-[#FFC93C] text-carbon-900 animate-float'
                          : 'bg-carbon-800 text-carbon-600 cursor-not-allowed'
                      }`}
                    >
                      <Icon name="chest" size={32} strokeWidth={1.9} />
                    </button>
                    <span className="mt-2 text-[11px] font-black text-carbon-500 flex items-center gap-1.5">
                      {item.opened ? (
                        'ABIERTO'
                      ) : item.unlocked ? (
                        <>
                          <span className="flex items-center gap-0.5">
                            <Icon name="star" size={11} className="text-lime-500" />
                            {CHEST_REWARD.xp}
                          </span>
                          <span className="flex items-center gap-0.5">
                            <Icon name="coins" size={11} className="text-lime-500" />
                            {CHEST_REWARD.coins}
                          </span>
                        </>
                      ) : (
                        'PLATINA PARA ABRIR'
                      )}
                    </span>
                  </div>
                );
              }

              if (item.kind === 'divider') {
                // Deliberately not swayed: the path weaves, the chapter marks
                // stay straight, which is what makes them read as structure
                // rather than as another thing on the trail.
                return (
                  <div
                    key={item.key}
                    data-unit={`${item.section}|${item.unit}|${item.title}`}
                    className="w-full"
                    style={{ marginBottom: NODE_PITCH - 70 }}
                  >
                    {item.startsSection && (
                      <div className="text-center mb-6 mt-4 first:mt-0">
                        <p
                          className={`text-[25px] font-black leading-tight ${
                            item.sectionPlatinum ? 'platinum-text' : 'text-carbon-200'
                          }`}
                        >
                          Sección {item.section}
                        </p>
                        <p className="text-sm text-carbon-500 mt-0.5">{item.sectionTitle}</p>
                      </div>
                    )}
                    <div className="flex items-center gap-4">
                      <span className="h-0.5 flex-1 bg-carbon-800" />
                      <h2
                        className={`text-[19px] font-black text-center ${
                          item.platinum ? 'platinum-text' : 'text-carbon-500'
                        }`}
                      >
                        {item.title}
                      </h2>
                      <span className="h-0.5 flex-1 bg-carbon-800" />
                    </div>
                  </div>
                );
              }

              const { node, unlocked, platinum, stage, maxStage } = item.data;
              const isCurrent = current?.node.id === node.id;
              return (
                <div key={item.key} className="relative flex flex-col items-center" style={sway}>
                  {isCurrent && (
                    <span className="absolute -top-12 whitespace-nowrap bg-carbon-850 border-2 border-carbon-700 text-lime-400 text-[11px] font-black uppercase tracking-[0.8px] px-3 py-1.5 rounded-xl animate-float">
                      Empezar
                    </span>
                  )}

                  {/* The ring wraps the button only, so it stays centred on the
                      node instead of on the whole column with its caption. */}
                  <div className="relative flex items-center justify-center">
                    {unlocked && !platinum && maxStage > 0 && (
                      <NodeRing progress={stage / maxStage} />
                    )}
                    <button
                      disabled={!unlocked}
                      onClick={() => setSelected(node)}
                      aria-label={node.title}
                      style={{
                        ['--btn-lip' as string]: platinum
                          ? '#1e40af'
                          : unlocked
                          ? 'var(--color-lime-700)'
                          : 'var(--color-carbon-950)',
                      }}
                      className={`btn-3d w-[70px] h-[70px] rounded-full flex items-center justify-center ${
                        platinum
                          ? 'relative platinum-node platinum-glow text-white'
                          : unlocked
                          ? 'bg-lime-500 text-carbon-900'
                          : 'bg-carbon-800 text-carbon-600 cursor-not-allowed'
                      }`}
                    >
                      {/* Above the sweeping highlight, which is an ::after and
                          would otherwise wash over the icon itself. */}
                      <Icon
                        name={unlocked ? node.icon : 'lock'}
                        size={30}
                        strokeWidth={unlocked ? 1.9 : 2}
                        className={platinum ? 'relative z-10' : undefined}
                      />
                    </button>
                  </div>

                  <span
                    className={`mt-4 text-[13px] font-black text-center w-32 leading-tight ${
                      unlocked ? 'text-carbon-100' : 'text-carbon-600'
                    }`}
                  >
                    {node.title}
                  </span>
                  {unlocked && maxStage > 0 && (
                    <span
                      className={`text-[11px] font-black mt-0.5 ${
                        platinum ? 'text-sky-400' : 'text-carbon-500'
                      }`}
                    >
                      {platinum ? 'PLATINO' : `${stage}/${maxStage}`}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* The path is where people spend their time, so it's where the
              thing being sold has to be visible — once, at the end, rather
              than floating over the lesson nodes. */}
          <AdSlot className="mt-14" />

          {/* Where the section ends. Duolingo's version of this is what makes
              a section feel finished rather than truncated, so it says what's
              next by name and — while it's still shut — what opens it. */}
          {nextSection && (
            <div className="mt-16 rounded-3xl border-2 border-carbon-800 bg-carbon-850 p-6 text-center">
              <span className="inline-block rounded-lg bg-lime-500/15 px-2.5 py-1 text-[12px] font-black uppercase tracking-[0.8px] text-lime-400">
                A continuación
              </span>
              <h2 className="mt-3 text-2xl font-black text-carbon-50">Sección {nextSection.number}</h2>
              <p className="mt-1 text-sm text-carbon-400">{nextSection.title}</p>
              {nextSection.units.length > 0 && (
                <p className="mt-1 text-[13px] text-carbon-500">{nextSection.units.join(' · ')}</p>
              )}
              <div className="mt-5 max-w-[280px] mx-auto">
                {nextSection.unlocked ? (
                  <Button onClick={() => navigate(`/home?seccion=${nextSection.number}`)}>Continuar</Button>
                ) : (
                  <p className="flex items-center justify-center gap-2 text-sm font-bold text-carbon-500">
                    <Icon name="lock" size={16} /> Termina esta sección para abrirla
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Chests live between topics, so they're rendered by splicing the
              path above rather than as a separate list. */}
        </div>
      </main>

      <BottomNav />

      <StatRail
        hearts={hearts}
        msUntilNextHeart={msUntilNextHeart}
        active={current ? { node: current.node, stage: current.stage, maxStage: current.maxStage } : null}
      />

      {reward && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
          onClick={() => setReward(null)}
        >
          <div className="text-center animate-pop-in" onClick={(e) => e.stopPropagation()}>
            <div className="w-24 h-24 rounded-3xl bg-[#FFC93C] text-carbon-900 flex items-center justify-center mx-auto animate-bounce-in">
              <Icon name="chest" size={48} strokeWidth={1.8} />
            </div>
            <p className="mt-4 text-carbon-100 font-black text-lg">¡Cofre reclamado!</p>
            <div className="mt-4 flex items-center justify-center gap-4">
              <span className="flex items-center gap-1.5 text-2xl font-black text-lime-400">
                <Icon name="star" size={24} /> +{CHEST_REWARD.xp}
              </span>
              <span className="flex items-center gap-1.5 text-2xl font-black text-[#FFC93C]">
                <Icon name="coins" size={24} /> +{CHEST_REWARD.coins}
              </span>
            </div>
            {reward.protectorGifted && (
              <p className="mt-3 flex items-center justify-center gap-1.5 text-sky-400 font-black text-[15px]">
                <Icon name="shield" size={18} /> +1 protector de racha
              </p>
            )}
            <div className="mt-6 w-[240px] mx-auto">
              <Button onClick={() => setReward(null)}>Genial</Button>
            </div>
          </div>
        </div>
      )}

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
                  // Same blue and the same sweep as the node on the path, so
                  // opening a mastered topic confirms what the map promised
                  // instead of dropping back to a plain grey line.
                  <p className="relative platinum-node -m-3 rounded-2xl px-3 py-3 flex items-center justify-center gap-1.5 text-sm font-black text-white">
                    <Icon name="diamond" size={16} className="relative z-10 text-white" />
                    <span className="relative z-10">¡PLATINO conseguido!</span>
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
              selected.ultra && !canPlayUltraLessons(plan) ? (
                // Sold, not scolded: a locked topic explains what opens it and
                // takes you there in one tap.
                <div className="mt-4 space-y-3">
                  <p className="flex items-center justify-center gap-1.5 text-sm font-black text-sky-400">
                    <Icon name="diamond" size={16} /> Tema exclusivo de Ultra
                  </p>
                  <Button variant="platinum" onClick={() => navigate('/planes')}>
                    Desbloquear con Ultra
                  </Button>
                </div>
              ) : hearts <= 0 ? (
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
