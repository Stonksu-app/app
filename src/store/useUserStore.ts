import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AccessoryStyle, LessonAttempt, MascotLook, OnboardingAnswers, TradingExperience } from '../types';
import { findMission } from '../data/missions';
import { DEFAULT_LOOK } from '../components/Mascot';
import { SKILL_TREE } from '../data/lessons';
import { stagesForDifficulty } from '../utils/mastery';
import { computeStreakUpdate } from '../utils/streak';

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
  coins: number;
  streakProtectors: number;
  avatar: MascotLook;
  /** Activities answered wrong, queued to reappear at the start of the next
   *  lesson. Keys look like "quiz:<id>" or "sentence:<id>". */
  pendingMistakes: string[];
  claimedMissionIds: string[];
  /** Cosmetics earned from missions. Everything not listed stays locked. */
  unlockedAccessories: AccessoryStyle[];
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
  openChest: (chestId: string) => void;
  buyHeartRefill: () => boolean;
  buyStreakProtector: () => boolean;
  setAvatar: (look: MascotLook) => void;
  recordMistake: (key: string) => void;
  clearMistake: (key: string) => void;
  claimMission: (missionId: string) => void;
  isAccessoryUnlocked: (style: AccessoryStyle) => boolean;
  resetProgress: () => void;
}

export const COIN_PRICES = { heartRefill: 350, streakProtector: 200 } as const;
/** Coins minted per correct answer. */
export const COINS_PER_CORRECT = 2;
/** What a chest pays out. Kept here so the amounts the path advertises and the
 *  amounts actually granted can't drift apart. */
export const CHEST_REWARD = { xp: 100, coins: 50 } as const;
/** Owning more than this many protectors at once isn't useful. */
export const MAX_PROTECTORS = 2;

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
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
      coins: 0,
      streakProtectors: 0,
      avatar: DEFAULT_LOOK,
      pendingMistakes: [],
      claimedMissionIds: [],
      unlockedAccessories: ['ninguno'],
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
          const { streak, lastActiveDate, protectorsUsed } = computeStreakUpdate(
            s.lastActiveDate,
            s.streak,
            s.streakProtectors,
            todayStr()
          );
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
            coins: s.coins + attempt.correctCount * COINS_PER_CORRECT,
            streakProtectors: s.streakProtectors - protectorsUsed,
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

      openChest: (chestId) =>
        set((s) =>
          // Guarded so a double tap can't pay out twice.
          s.openedChestIds.includes(chestId)
            ? s
            : {
                openedChestIds: [...s.openedChestIds, chestId],
                xp: s.xp + CHEST_REWARD.xp,
                coins: s.coins + CHEST_REWARD.coins,
              }
        ),

      buyHeartRefill: () => {
        const s = get();
        if (s.hearts >= MAX_HEARTS || s.coins < COIN_PRICES.heartRefill) return false;
        set({ coins: s.coins - COIN_PRICES.heartRefill, hearts: MAX_HEARTS, lastHeartLostAt: null });
        return true;
      },

      buyStreakProtector: () => {
        const s = get();
        if (s.streakProtectors >= MAX_PROTECTORS || s.coins < COIN_PRICES.streakProtector) return false;
        set({ coins: s.coins - COIN_PRICES.streakProtector, streakProtectors: s.streakProtectors + 1 });
        return true;
      },

      setAvatar: (avatar) => set({ avatar }),

      // A missed activity is queued once; answering it right anywhere (including
      // when it comes back) takes it off the queue.
      recordMistake: (key) =>
        set((s) => (s.pendingMistakes.includes(key) ? s : { pendingMistakes: [...s.pendingMistakes, key] })),

      clearMistake: (key) =>
        set((s) =>
          s.pendingMistakes.includes(key)
            ? { pendingMistakes: s.pendingMistakes.filter((k) => k !== key) }
            : s
        ),

      claimMission: (missionId) =>
        set((s) => {
          // Guarded so a double tap can't pay out twice, and re-checked against
          // the mission's own condition rather than trusting the caller.
          if (s.claimedMissionIds.includes(missionId)) return s;
          const mission = findMission(missionId);
          if (!mission) return s;
          const done =
            mission.progress({
              streak: s.streak,
              xp: s.xp,
              attempts: s.attempts,
              nodeStageProgress: s.nodeStageProgress,
              openedChestIds: s.openedChestIds,
            }) >= mission.target;
          if (!done) return s;

          return {
            claimedMissionIds: [...s.claimedMissionIds, missionId],
            coins: s.coins + (mission.reward.coins ?? 0),
            unlockedAccessories: mission.reward.accessory
              ? [...new Set([...s.unlockedAccessories, mission.reward.accessory])]
              : s.unlockedAccessories,
          };
        }),

      isAccessoryUnlocked: (style) => style === 'ninguno' || get().unlockedAccessories.includes(style),

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
          coins: 0,
          streakProtectors: 0,
          avatar: DEFAULT_LOOK,
          pendingMistakes: [],
          claimedMissionIds: [],
          unlockedAccessories: ['ninguno'],
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
