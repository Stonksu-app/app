import type { IconName } from '../types';

/**
 * Daily objectives, on rotation, next to the one-off missions in
 * data/missions.ts.
 *
 * Those are permanent and finished once; these reset every day and exist to
 * give a reason to open the app today specifically, the way Duolingo's daily
 * quests do. No account needed and nothing to sync: which three show up and
 * what target each one gets is a pure function of the date, so every device
 * lands on the same three without a server picking them.
 */

export interface DailyMissionInput {
  dailyXp: number;
  dailyLessons: number;
  dailyPerfectLessons: number;
  dailyCorrect: number;
  dailyReviews: number;
}

interface DailyMissionTemplate {
  id: string;
  icon: IconName;
  /** Possible sizes for the objective; one is picked per day, same reason as
   *  which templates make the cut: seeded by the date. */
  targets: number[];
  title: (target: number) => string;
  description: (target: number) => string;
  reward: (target: number) => number;
  progress: (s: DailyMissionInput) => number;
}

const TEMPLATES: DailyMissionTemplate[] = [
  {
    id: 'xp',
    icon: 'star',
    targets: [30, 50, 80],
    title: (t) => `Gana ${t} XP`,
    description: () => 'Cuenta la XP de hoy, venga de lecciones o de repasos.',
    reward: (t) => t,
    progress: (s) => s.dailyXp,
  },
  {
    id: 'lecciones',
    icon: 'book',
    targets: [1, 2, 3],
    title: (t) => `Termina ${t} ${t === 1 ? 'lección' : 'lecciones'}`,
    description: () => 'Cualquier lección del camino cuenta, sea del tema que sea.',
    reward: (t) => t * 40,
    progress: (s) => s.dailyLessons,
  },
  {
    id: 'perfecta',
    icon: 'target',
    targets: [1],
    title: () => 'Termina una lección sin fallar',
    description: () => 'Cero corazones perdidos en toda la lección.',
    reward: () => 60,
    progress: (s) => s.dailyPerfectLessons,
  },
  {
    id: 'repaso',
    icon: 'cards',
    targets: [1],
    title: () => 'Haz un repaso en la Guía',
    description: () => 'Un repaso de términos, desde cualquier tema.',
    reward: () => 40,
    progress: (s) => s.dailyReviews,
  },
  {
    id: 'aciertos',
    icon: 'check',
    targets: [10, 15, 20],
    title: (t) => `Acierta ${t} preguntas`,
    description: () => 'Suman tanto las lecciones como los repasos.',
    reward: (t) => t * 3,
    progress: (s) => s.dailyCorrect,
  },
];

export const DAILY_MISSION_COUNT = 3;

/** Small, dependency-free seeded generator — deterministic across devices is
 *  the entire point, so Math.random() would defeat it. */
function hashSeed(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface DailyMissionDef {
  id: string;
  icon: IconName;
  title: string;
  description: string;
  target: number;
  reward: number;
  progress: (s: DailyMissionInput) => number;
}

/** The day's three, and the size each landed on — same for every device on
 *  the same calendar day, and different again tomorrow. */
export function pickDailyMissions(dateKey: string): DailyMissionDef[] {
  const rand = mulberry32(hashSeed(dateKey));
  const shuffled = TEMPLATES.map((t) => ({ t, order: rand() })).sort((a, b) => a.order - b.order);
  return shuffled.slice(0, DAILY_MISSION_COUNT).map(({ t }) => {
    const target = t.targets[Math.floor(rand() * t.targets.length)];
    return {
      id: t.id,
      icon: t.icon,
      title: t.title(target),
      description: t.description(target),
      target,
      reward: t.reward(target),
      progress: t.progress,
    };
  });
}

export interface DailyMissionProgress extends Omit<DailyMissionDef, 'progress'> {
  value: number;
  complete: boolean;
  claimed: boolean;
}

/**
 * Today's three missions with progress filled in.
 *
 * Takes the raw, possibly-stale stored counters rather than requiring the
 * caller to have already rolled them over for a new day — the store only
 * rolls them lazily, on the next lesson or repaso, so a screen opened before
 * that has to treat yesterday's numbers as zero itself.
 */
export function computeDailyMissions(
  stats: DailyMissionInput & { dailyStatsDate: string | null },
  claimed: { dailyMissionsDate: string | null; claimedDailyMissionIds: string[] },
  today: string
): DailyMissionProgress[] {
  const fresh: DailyMissionInput =
    stats.dailyStatsDate === today
      ? stats
      : { dailyXp: 0, dailyLessons: 0, dailyPerfectLessons: 0, dailyCorrect: 0, dailyReviews: 0 };
  const claimedIds = claimed.dailyMissionsDate === today ? claimed.claimedDailyMissionIds : [];

  return pickDailyMissions(today).map((m) => {
    const value = Math.min(m.progress(fresh), m.target);
    return { ...m, value, complete: value >= m.target, claimed: claimedIds.includes(m.id) };
  });
}
