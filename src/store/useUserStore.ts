import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { LessonAttempt, OnboardingAnswers, TradingExperience } from '../types';
import { SKILL_TREE } from '../data/lessons';
import { stagesForDifficulty } from '../utils/mastery';

const MAX_HEARTS = 5;
const HEART_REGEN_MINUTES = 30;
const XP_PER_LEVEL = 100;

interface UserState {
  name: string;
  onboarded: boolean;
  onboardingAnswers: OnboardingAnswers;
  xp: number;
  hearts: number;
  lastHeartLostAt: string | null;
  streak: number;
  lastActiveDate: string | null;
  completedLessonIds: string[];
  unlockedBadgeIds: string[];
  attempts: LessonAttempt[];
  virtualBalance: number;
  seenIntroNodeIds: string[];
  nodeStageProgress: Record<string, number>;
  openedChestIds: string[];
  /** Set by onboarding as the name "test". Unlocks the whole tree and seeds
   *  every topic one stage short of platinum, so each can be finished in a
   *  single lesson to check the mastery and chest flows end to end. */
  testMode: boolean;

  startOnboarding: () => void;
  setOnboardingAnswer: (key: keyof OnboardingAnswers, value: string) => void;
  finishOnboarding: (name: string) => void;
  loseHeart: () => void;
  refillHearts: () => void;
  tickHeartRegen: () => void;
  addXp: (amount: number) => void;
  completeLesson: (attempt: LessonAttempt) => void;
  isNodeUnlocked: (nodeId: string) => boolean;
  isLessonCompleted: (lessonId: string) => boolean;
  unlockBadge: (badgeId: string) => void;
  hasSeenIntro: (nodeId: string) => boolean;
  markIntroSeen: (nodeId: string) => void;
  getNodeStage: (nodeId: string) => number;
  getNodeMaxStage: (nodeId: string) => number;
  isNodePlatinum: (nodeId: string) => boolean;
  isChestOpened: (chestId: string) => boolean;
  openChest: (chestId: string, reward: number) => void;
  resetProgress: () => void;
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function computeStreakUpdate(lastActiveDate: string | null, currentStreak: number): { streak: number; lastActiveDate: string } {
  const today = todayStr();
  if (lastActiveDate === today) {
    return { streak: currentStreak, lastActiveDate: today };
  }
  if (!lastActiveDate) {
    return { streak: 1, lastActiveDate: today };
  }
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yStr = yesterday.toISOString().slice(0, 10);
  if (lastActiveDate === yStr) {
    return { streak: currentStreak + 1, lastActiveDate: today };
  }
  return { streak: 1, lastActiveDate: today };
}

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      name: '',
      onboarded: false,
      onboardingAnswers: { experience: null, goal: null },
      xp: 0,
      hearts: MAX_HEARTS,
      lastHeartLostAt: null,
      streak: 0,
      lastActiveDate: null,
      completedLessonIds: [],
      unlockedBadgeIds: [],
      attempts: [],
      virtualBalance: 10000,
      seenIntroNodeIds: [],
      nodeStageProgress: {},
      openedChestIds: [],
      testMode: false,

      startOnboarding: () => set({ onboarded: false }),

      setOnboardingAnswer: (key, value) =>
        set((s) => ({
          onboardingAnswers: { ...s.onboardingAnswers, [key]: value as TradingExperience },
        })),

      finishOnboarding: (name) =>
        set(() => {
          const testMode = name.trim().toLowerCase() === 'test';
          const base = { onboarded: true, name: name || 'Trader', testMode };
          if (!testMode) return base;

          // Seed each topic one stage short of platinum so a single lesson
          // tips it over, and hand back a full set of hearts to play with.
          const nodeStageProgress: Record<string, number> = {};
          SKILL_TREE.forEach((node) => {
            const max = stagesForDifficulty(node.difficulty);
            if (max > 0) nodeStageProgress[node.id] = max - 1;
          });
          return { ...base, nodeStageProgress, openedChestIds: [], hearts: MAX_HEARTS };
        }),

      loseHeart: () =>
        set((s) => ({
          hearts: Math.max(0, s.hearts - 1),
          lastHeartLostAt: s.hearts <= 0 ? s.lastHeartLostAt : new Date().toISOString(),
        })),

      refillHearts: () => set({ hearts: MAX_HEARTS, lastHeartLostAt: null }),

      tickHeartRegen: () => {
        const s = get();
        if (s.hearts >= MAX_HEARTS || !s.lastHeartLostAt) return;
        const regenMs = HEART_REGEN_MINUTES * 60_000;
        const elapsed = Date.now() - new Date(s.lastHeartLostAt).getTime();
        const regensEarned = Math.floor(elapsed / regenMs);
        if (regensEarned <= 0) return;
        const newHearts = Math.min(MAX_HEARTS, s.hearts + regensEarned);
        const newLastHeartLostAt =
          newHearts >= MAX_HEARTS
            ? null
            : new Date(new Date(s.lastHeartLostAt).getTime() + regensEarned * regenMs).toISOString();
        set({ hearts: newHearts, lastHeartLostAt: newLastHeartLostAt });
      },

      addXp: (amount) => set((s) => ({ xp: s.xp + amount })),

      completeLesson: (attempt) =>
        set((s) => {
          const { streak, lastActiveDate } = computeStreakUpdate(s.lastActiveDate, s.streak);
          const completedLessonIds = s.completedLessonIds.includes(attempt.lessonId)
            ? s.completedLessonIds
            : [...s.completedLessonIds, attempt.lessonId];

          const node = SKILL_TREE.find((n) => n.id === attempt.nodeId);
          const maxStage = node ? stagesForDifficulty(node.difficulty) : 0;
          const currentStage = s.nodeStageProgress[attempt.nodeId] ?? 0;
          const nodeStageProgress = {
            ...s.nodeStageProgress,
            [attempt.nodeId]: Math.min(maxStage, currentStage + 1),
          };

          return {
            xp: s.xp + attempt.xpEarned,
            attempts: [...s.attempts, attempt],
            completedLessonIds,
            streak,
            lastActiveDate,
            nodeStageProgress,
          };
        }),

      isNodeUnlocked: (nodeId) => {
        if (get().testMode) return true;
        const node = SKILL_TREE.find((n) => n.id === nodeId);
        if (!node) return false;
        if (node.requires.length === 0) return true;
        const { completedLessonIds } = get();
        return node.requires.every((reqNodeId) => {
          const reqNode = SKILL_TREE.find((n) => n.id === reqNodeId);
          if (!reqNode) return true;
          if (reqNode.lessons.length === 0) return false;
          return reqNode.lessons.every((l) => completedLessonIds.includes(l.id));
        });
      },

      isLessonCompleted: (lessonId) => get().completedLessonIds.includes(lessonId),

      unlockBadge: (badgeId) =>
        set((s) =>
          s.unlockedBadgeIds.includes(badgeId)
            ? s
            : { unlockedBadgeIds: [...s.unlockedBadgeIds, badgeId] }
        ),

      hasSeenIntro: (nodeId) => get().seenIntroNodeIds.includes(nodeId),

      markIntroSeen: (nodeId) =>
        set((s) =>
          s.seenIntroNodeIds.includes(nodeId) ? s : { seenIntroNodeIds: [...s.seenIntroNodeIds, nodeId] }
        ),

      getNodeStage: (nodeId) => get().nodeStageProgress[nodeId] ?? 0,

      getNodeMaxStage: (nodeId) => {
        const node = SKILL_TREE.find((n) => n.id === nodeId);
        return node ? stagesForDifficulty(node.difficulty) : 0;
      },

      isNodePlatinum: (nodeId) => {
        const { getNodeStage, getNodeMaxStage } = get();
        const max = getNodeMaxStage(nodeId);
        return max > 0 && getNodeStage(nodeId) >= max;
      },

      isChestOpened: (chestId) => get().openedChestIds.includes(chestId),

      openChest: (chestId, reward) =>
        set((s) =>
          // Guarded so a double tap can't pay out twice.
          s.openedChestIds.includes(chestId)
            ? s
            : { openedChestIds: [...s.openedChestIds, chestId], xp: s.xp + reward }
        ),

      resetProgress: () =>
        set({
          name: '',
          onboarded: false,
          onboardingAnswers: { experience: null, goal: null },
          xp: 0,
          hearts: MAX_HEARTS,
          lastHeartLostAt: null,
          streak: 0,
          lastActiveDate: null,
          completedLessonIds: [],
          unlockedBadgeIds: [],
          attempts: [],
          virtualBalance: 10000,
          seenIntroNodeIds: [],
          nodeStageProgress: {},
          openedChestIds: [],
          testMode: false,
        }),
    }),
    { name: 'stonksu-storage' }
  )
);

export function xpToLevel(xp: number): { level: number; xpIntoLevel: number; xpForNext: number } {
  const level = Math.floor(xp / XP_PER_LEVEL) + 1;
  const xpIntoLevel = xp % XP_PER_LEVEL;
  return { level, xpIntoLevel, xpForNext: XP_PER_LEVEL };
}

export { MAX_HEARTS, HEART_REGEN_MINUTES };
