import { SKILL_TREE } from './lessons';
import { stagesForDifficulty } from '../utils/mastery';
import type { AccessoryStyle, IconName, LessonAttempt } from '../types';

/* One-off objectives with a reward you claim. Unlike achievements, which level
 * up forever, a mission is done once — which is what makes it a sensible way to
 * hand out cosmetics. */

export interface MissionInput {
  streak: number;
  xp: number;
  attempts: LessonAttempt[];
  nodeStageProgress: Record<string, number>;
  openedChestIds: string[];
}

interface MissionDef {
  id: string;
  title: string;
  description: string;
  icon: IconName;
  target: number;
  reward: { coins?: number; accessory?: AccessoryStyle };
  progress: (s: MissionInput) => number;
}

const platinumCount = (s: MissionInput) =>
  SKILL_TREE.filter((n) => {
    const max = stagesForDifficulty(n.difficulty);
    return max > 0 && (s.nodeStageProgress[n.id] ?? 0) >= max;
  }).length;

const MISSIONS: MissionDef[] = [
  {
    id: 'primeros-pasos',
    title: 'Primeros pasos',
    description: 'Completa 3 lecciones',
    icon: 'book',
    target: 3,
    reward: { coins: 100 },
    progress: (s) => s.attempts.length,
  },
  {
    id: 'pulso-firme',
    title: 'Pulso firme',
    description: 'Termina 3 lecciones sin fallar ni una',
    icon: 'target',
    target: 3,
    reward: { coins: 150 },
    progress: (s) => s.attempts.filter((a) => a.totalQuestions > 0 && a.correctCount === a.totalQuestions).length,
  },
  {
    id: 'semana-completa',
    title: 'Semana completa',
    description: 'Alcanza 7 días de racha',
    icon: 'flame',
    target: 7,
    reward: { coins: 200 },
    progress: (s) => s.streak,
  },
  {
    id: 'corona',
    title: 'Rey del mercado',
    description: 'Platina tu primer tema',
    icon: 'diamond',
    target: 1,
    reward: { accessory: 'corona' },
    progress: platinumCount,
  },
];

export interface MissionProgress extends Omit<MissionDef, 'progress'> {
  value: number;
  complete: boolean;
  claimed: boolean;
}

export function computeMissions(s: MissionInput, claimedIds: string[]): MissionProgress[] {
  return MISSIONS.map((m) => {
    const value = Math.min(m.progress(s), m.target);
    return {
      ...m,
      value,
      complete: value >= m.target,
      claimed: claimedIds.includes(m.id),
    };
  });
}

export function findMission(id: string) {
  return MISSIONS.find((m) => m.id === id);
}
