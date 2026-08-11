import type { NodeDifficulty } from '../types';

export const STAGE_COUNT: Record<NodeDifficulty, number> = {
  easy: 3,
  medium: 4,
  hard: 5,
};

export function stagesForDifficulty(difficulty: NodeDifficulty): number {
  return STAGE_COUNT[difficulty];
}
