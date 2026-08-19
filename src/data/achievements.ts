import { SKILL_TREE } from './lessons';
import { stagesForDifficulty } from '../utils/mastery';
import type { IconName, LessonAttempt } from '../types';

/* Tiered achievements, all derived from state the app already records — no
 * separate bookkeeping to drift out of sync. Each has thresholds, so one
 * achievement keeps giving something to chase instead of going dark once
 * earned. */

interface AchievementDef {
  id: string;
  title: string;
  icon: IconName;
  tile: string;
  /** Thresholds, ascending. Clearing one raises the level. */
  tiers: number[];
  describe: (target: number) => string;
}

export interface AchievementProgress extends Omit<AchievementDef, 'tiers' | 'describe'> {
  level: number;
  value: number;
  target: number;
  maxed: boolean;
  description: string;
}

const DEFS: AchievementDef[] = [
  {
    id: 'streak',
    title: 'En racha',
    icon: 'flame',
    tile: 'bg-danger-500/20 text-danger-400',
    tiers: [3, 7, 14, 30, 60, 125],
    describe: (n) => `Alcanza una racha de ${n} días`,
  },
  {
    id: 'xp',
    title: 'Sabio del mercado',
    icon: 'star',
    tile: 'bg-lime-500/20 text-lime-400',
    tiers: [100, 500, 1500, 3000, 6000, 12500],
    describe: (n) => `Gana ${n} XP`,
  },
  {
    id: 'lessons',
    title: 'Constante',
    icon: 'book',
    tile: 'bg-[#47bfff]/20 text-[#47bfff]',
    tiers: [1, 5, 10, 25, 50, 100],
    describe: (n) => `Completa ${n} ${n === 1 ? 'lección' : 'lecciones'}`,
  },
  {
    id: 'flawless',
    title: 'Sin rekt',
    icon: 'target',
    tile: 'bg-[#a78bfa]/20 text-[#a78bfa]',
    tiers: [1, 5, 10, 25],
    describe: (n) => `Termina ${n} ${n === 1 ? 'lección' : 'lecciones'} sin fallar`,
  },
  {
    id: 'platinum',
    title: 'Platino',
    icon: 'diamond',
    tile: 'bg-carbon-100/20 text-carbon-100',
    tiers: [1, 3, 5, 8],
    describe: (n) => `Platina ${n} ${n === 1 ? 'tema' : 'temas'}`,
  },
  {
    id: 'chests',
    title: 'Cazatesoros',
    icon: 'chest',
    tile: 'bg-[#FFC93C]/20 text-[#FFC93C]',
    tiers: [1, 3, 5, 7],
    describe: (n) => `Abre ${n} ${n === 1 ? 'cofre' : 'cofres'}`,
  },
];

export interface AchievementInput {
  streak: number;
  xp: number;
  attempts: LessonAttempt[];
  nodeStageProgress: Record<string, number>;
  openedChestIds: string[];
}

function valueFor(id: string, s: AchievementInput): number {
  switch (id) {
    case 'streak':
      return s.streak;
    case 'xp':
      return s.xp;
    case 'lessons':
      return s.attempts.length;
    case 'flawless':
      return s.attempts.filter((a) => a.totalQuestions > 0 && a.correctCount === a.totalQuestions).length;
    case 'platinum':
      return SKILL_TREE.filter((n) => {
        const max = stagesForDifficulty(n.difficulty);
        return max > 0 && (s.nodeStageProgress[n.id] ?? 0) >= max;
      }).length;
    case 'chests':
      return s.openedChestIds.length;
    default:
      return 0;
  }
}

export function computeAchievements(s: AchievementInput): AchievementProgress[] {
  return DEFS.map((def) => {
    const value = valueFor(def.id, s);
    const level = def.tiers.filter((t) => value >= t).length;
    const maxed = level >= def.tiers.length;
    // A maxed achievement keeps showing its final threshold rather than a
    // target you can never reach.
    const target = maxed ? def.tiers[def.tiers.length - 1] : def.tiers[level];
    return {
      id: def.id,
      title: def.title,
      icon: def.icon,
      tile: def.tile,
      level,
      value: Math.min(value, target),
      target,
      maxed,
      description: def.describe(target),
    };
  });
}

/** Started or closest to the next level first, so the profile preview shows
 *  what's actually in reach rather than a fixed three. */
export function byRelevance(a: AchievementProgress, b: AchievementProgress) {
  if (a.maxed !== b.maxed) return a.maxed ? 1 : -1;
  return b.value / b.target - a.value / a.target;
}
