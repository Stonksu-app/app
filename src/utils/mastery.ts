import type { NodeDifficulty } from '../types';

export const STAGE_COUNT: Record<NodeDifficulty, number> = {
  easy: 3,
  medium: 4,
  hard: 5,
};

export function stagesForDifficulty(difficulty: NodeDifficulty): number {
  return STAGE_COUNT[difficulty];
}

/**
 * Key for "has this stage's intro been seen", not just this node's.
 *
 * Each teaching stage introduces its own slice of terms (see buildStage), but
 * hasSeenIntro/markIntroSeen used to be keyed by nodeId alone, so only the
 * very first stage ever showed its flashcards — stage 2 onward taught new
 * vocabulary with no preview at all, same as if it had none.
 */
export function introKey(nodeId: string, stage: number): string {
  return `${nodeId}:${stage}`;
}
