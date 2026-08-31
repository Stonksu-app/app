import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AccessoryStyle, LessonAttempt, MascotLook, OnboardingAnswers, TradingExperience } from '../types';
import { findMission } from '../data/missions';
import { DEFAULT_LOOK } from '../components/Mascot';
import { SKILL_TREE } from '../data/lessons';
import { stagesForDifficulty } from '../utils/mastery';
import { leaguePromotionReward } from '../data/leagues';
import {
  computeStreakUpdate,
  datesBetween,
  daysBetween,
  isStreakUnrecoverable,
  localDayKey,
  streakFromHistory,
  todayLocal,
} from '../utils/streak';
import { DEFAULT_REMINDER_HOUR } from '../lib/notifications';
import { FREE_PRACTICE_PER_DAY, FREE_TRADES_PER_DAY, hasUnlimitedTrades, hasAllAccessories, hasUnlimitedHearts, hasUnlimitedPractice, type Plan } from '../data/plans';
import { pickDailyMissions, type DailyMissionInput } from '../data/dailyMissions';

const MAX_HEARTS = 5;
const HEART_REGEN_MINUTES = 30;
const XP_PER_LEVEL = 100;
/** Every level pays coins; a level that's a multiple of this also pays a
 *  streak protector, so a milestone feels bigger than "the same amount, more
 *  coins" — the moment Duolingo hands out a Streak Freeze for exactly the
 *  same "you kept going" reason. */
const LEVEL_MILESTONE_EVERY = 5;
const LEVEL_UP_COINS = 20;
const LEVEL_MILESTONE_COINS = 100;

interface UserState {
  name: string;
  onboarded: boolean;
  onboardingAnswers: OnboardingAnswers;
  xp: number;
  hearts: number;
  lastHeartLostAt: string | null;
  streak: number;
  lastActiveDate: string | null;
  /** Calendar dates (YYYY-MM-DD, UTC) a streak protector covered so the streak
   *  page can mark them "congelado" instead of a plain gap. Synced — it used
   *  to be device-local, but that meant a reinstall recovered the streak and
   *  its protectors from the cloud and silently lost which days had earned
   *  them, leaving the calendar blank where it should show blue. */
  frozenDates: string[];
  completedLessonIds: string[];
  unlockedBadgeIds: string[];
  attempts: LessonAttempt[];
  virtualBalance: number;
  seenIntroNodeIds: string[];
  nodeStageProgress: Record<string, number>;
  /**
   * How well each glossary term is known: termId -> right answers in a row in
   * the guide's practice, capped at TERM_MASTERY_GOAL. A wrong answer costs
   * one rather than resetting to zero — a slip on the last question of a term
   * you've had right five times shouldn't erase the term.
   */
  termMastery: Record<string, number>;
  /** Which subscription is active. Synced, because it's what was paid for. */
  plan: Plan;
  /** ISO date the current plan started, for the profile screen. */
  planStartedAt: string | null;
  /**
   * The day's practice allowance, kept off the cloud.
   *
   * It's a rate limit rather than progress: syncing a counter that resets
   * every midnight would mean two columns and a timezone argument, and the
   * worst a determined player gets by clearing their storage is a second
   * round of revision — which is the thing the app wants them doing anyway.
   */
  practiceDay: string | null;
  practiceRoundsToday: number;
  /** The simulator's daily allowance. Local for the same reason as the
   *  practice counter: a rate limit that resets at midnight, not progress. */
  tradeDay: string | null;
  tradesToday: number;
  /**
   * Today's counters for the rotating daily missions — what's rolled over is
   * the date they belong to, not progress in their own right, so they're
   * kept off the cloud for the same reason as the practice allowance above.
   */
  dailyStatsDate: string | null;
  dailyXp: number;
  dailyLessons: number;
  dailyPerfectLessons: number;
  dailyCorrect: number;
  dailyReviews: number;
  /** Which of today's three missions have been claimed. Reset along with
   *  the counters above whenever the date moves on. */
  dailyMissionsDate: string | null;
  claimedDailyMissionIds: string[];
  /**
   * Days finished with a repaso and no lesson.
   *
   * The streak calendar reads lesson attempts, so without this a day spent
   * reviewing keeps the streak alive and still shows up as an empty square —
   * the calendar contradicting the number above it.
   *
   * Synced, for the same reason as frozenDates: it's a fact about the
   * calendar, not a device preference.
   */
  reviewDates: string[];
  /**
   * Every day with activity, as the local day this device saw.
   *
   * Lessons only left a UTC timestamp in `attempts`, so anyone rebuilding the
   * calendar from the outside — a friend's profile, served by the database —
   * had to guess the day from the clock, and a session after midnight landed
   * on the square before. The streak, meanwhile, has always counted local
   * days. Recording the day itself is what stops the number and the calendar
   * describing different things.
   */
  activeDates: string[];
  /**
   * XP earned since the current league week started — what this week's
   * table is ranked on, not the lifetime total above. Synced: it's the one
   * of the four league fields this device is allowed to write, the same way
   * it already writes xp. The other three are server-owned.
   */
  weeklyXp: number;
  /** 0 Beginner .. 5 Market Master — see data/leagues.ts. Server-owned: only
   *  the weekly reset changes it, so this device only ever reads it back. */
  leagueRank: number;
  /** Which group of same-league players this account is competing against
   *  this week. Null until join_league_if_needed() seats it. Server-owned. */
  leagueTableId: string | null;
  /** The Monday this table's week started. Server-owned. */
  leagueWeekStart: string | null;
  /**
   * The highest league already paid for, and the week it was paid.
   *
   * Promotion is decided by the server on Mondays; the payout happens here,
   * the first time this account sees the new rank. Synced, because a reward
   * paid per device is a reward paid twice — open the app on a phone and a
   * laptop after a promotion and you'd collect the coins on both.
   */
  leagueRewardedRank: number;
  /**
   * The last streak that broke, and why.
   *
   * Losing a streak while holding protectors that didn't cover the gap looks
   * exactly like a bug from the outside: the number resets, the protectors
   * are still there, and nothing says a word. Kept so the streak panel can
   * explain it once. Local — it's an explanation of this device's history,
   * not progress.
   */
  lastStreakLoss: {
    date: string;
    streak: number;
    missed: number;
    /** Protectors held when the gap started. */
    protectors: number;
    /** How many of them the gap ate before the streak broke. */
    used: number;
  } | null;
  /**
   * Lessons finished since the Ultra pitch was last shown.
   *
   * Local for the same reason as the practice counter: it paces an advert, and
   * the worst a cleared storage buys you is seeing one fewer.
   */
  lessonsSincePitch: number;
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
  /** Streak reminders. Kept off the cloud on purpose: the notification
   *  permission that makes them work is granted per device, so a preference
   *  synced from a phone would read as "on" in a browser that can't deliver
   *  anything. */
  reminderEnabled: boolean;
  /** Hour of the day, 0-23, in local time. */
  reminderHour: number;
  /** Notify when hearts finish regenerating. Same on-device-only reasoning as
   *  reminderEnabled: it depends on a permission granted per device, so it's
   *  never synced to the cloud. */
  heartsReminderEnabled: boolean;

  startOnboarding: () => void;
  setOnboardingAnswer: (key: keyof OnboardingAnswers, value: string) => void;
  finishOnboarding: (name: string) => void;
  loseHeart: () => void;
  refillHearts: () => void;
  tickHeartRegen: () => void;
  addXp: (amount: number) => LevelUpInfo | null;
  /** Counts today toward the streak on its own, for activities (like guide
   *  revision) that should keep a streak alive without being a lesson. */
  completeReview: () => void;
  /**
   * Raises the streak to whatever the history proves, if the stored number is
   * lower. Never lowers it: an absent day proves nothing — history can be
   * incomplete — but a day you played is evidence you did.
   */
  repairStreak: () => void;
  /**
   * Pays for a promotion the server has already decided, once.
   *
   * Returns what was paid so the screen can celebrate it, or null when there
   * is nothing new — which is every call but the first after a Monday that
   * moved you up.
   */
  claimLeaguePromotion: () => { rank: number; coins: number; protectors: number } | null;
  /**
   * Zeroes a streak that has already, provably, died — without waiting for
   * the next lesson to notice. Only touches state once, the same way
   * completing a lesson today would: spends whatever protectors couldn't
   * have saved it anyway, marks the days they did cover, and writes down why
   * it broke. `lastActiveDate` is left as it was — today still isn't earned —
   * so the flame reads 0 and grey instead of an old number that hasn't
   * practised today either.
   */
  settleStreak: () => void;
  completeLesson: (attempt: LessonAttempt) => { protectorGifted: boolean; levelUp: LevelUpInfo | null };
  isNodeUnlocked: (nodeId: string) => boolean;
  isLessonCompleted: (lessonId: string) => boolean;
  unlockBadge: (badgeId: string) => void;
  /** Keyed by introKey(nodeId, stage) — each teaching stage has its own intro. */
  hasSeenIntro: (key: string) => boolean;
  markIntroSeen: (key: string) => void;
  getNodeStage: (nodeId: string) => number;
  getNodeMaxStage: (nodeId: string) => number;
  isNodePlatinum: (nodeId: string) => boolean;
  /** Records one practice answer. Returns the term's new mastery. */
  recordTermAnswer: (termId: string, correct: boolean) => number;
  getTermMastery: (termId: string) => number;
  isTermMastered: (termId: string) => boolean;
  setPlan: (plan: Plan) => void;
  /** True when a lesson has just earned the between-lessons Ultra pitch. */
  shouldPitchUltra: () => boolean;
  markUltraPitched: () => void;
  /** Whether another practice round is allowed right now. */
  canPractice: () => boolean;
  /** Consumes one round of the day's allowance. Returns false if none left. */
  startPracticeRound: () => boolean;
  /** Whether another simulator trade is allowed right now. */
  canTrade: () => boolean;
  /** Consumes one trade of the day's allowance. Returns false if none left. */
  startTrade: () => boolean;
  /** Settles a finished trade: adds (or subtracts) its coins, never below 0. */
  settleTrade: (coins: number) => void;
  isChestOpened: (chestId: string) => boolean;
  /** Returns whether this chest also gifted a streak protector. */
  openChest: (chestId: string) => boolean;
  buyHeartRefill: () => boolean;
  buyStreakProtector: () => boolean;
  setAvatar: (look: MascotLook) => void;
  recordMistake: (key: string) => void;
  clearMistake: (key: string) => void;
  claimMission: (missionId: string) => void;
  /** Returns false if that mission isn't actually done yet, or was already claimed. */
  claimDailyMission: (id: string) => boolean;
  isAccessoryUnlocked: (style: AccessoryStyle) => boolean;
  setReminder: (patch: { enabled?: boolean; hour?: number }) => void;
  setHeartsReminder: (enabled: boolean) => void;
  /**
   * Test-mode only: pretends the last active day was one earlier, so the
   * streak checks that normally wait for a real day to pass — settleStreak,
   * and computeStreakUpdate inside the next lesson — can be exercised on
   * demand instead. Touches nothing else: coins, protectors and frozenDates
   * only change once one of those actually runs.
   */
  resetProgress: () => void;
}

/** Right answers in a row before a term counts as mastered and goes platinum.
 *  Three rather than one so a lucky guess between four options isn't mastery,
 *  and rather than five so the grid actually fills in. */
export const TERM_MASTERY_GOAL = 3;

/** Lessons between one Ultra pitch and the next, on the free plan. Two, as
 *  asked: often enough to be an offer, rare enough not to be a toll booth. */
export const LESSONS_PER_PITCH = 2;

export const COIN_PRICES = { heartRefill: 350, streakProtector: 200 } as const;
/** Coins minted per correct answer. */
export const COINS_PER_CORRECT = 2;
/** What a chest pays out. Kept here so the amounts the path advertises and the
 *  amounts actually granted can't drift apart. */
export const CHEST_REWARD = { xp: 100, coins: 50 } as const;
/** Owning more than this many protectors at once isn't useful. */
export const MAX_PROTECTORS = 2;
/** Every this-many *newly* finished lessons, one is gifted for free — so
 *  running low on coins never means running out of ways to keep a streak
 *  alive. Doesn't count repeats of an already-completed lesson. */
export const LESSON_PROTECTOR_GIFT_EVERY = 3;

/**
 * The days a protector actually covered, in order.
 *
 * Not the whole gap: when the protectors run out mid-gap they pay for the
 * first days and the streak breaks on the first one they couldn't reach. Only
 * the paid-for days turn blue, so the calendar shows exactly where the cover
 * ran out.
 */
function coveredDays(
  lastActiveDate: string | null,
  today: string,
  protectorsUsed: number
): string[] {
  if (!lastActiveDate || protectorsUsed <= 0) return [];
  return datesBetween(lastActiveDate, today).slice(0, protectorsUsed);
}

/**
 * Notes a broken streak, and only a broken one.
 *
 * A streak that survives — or one that was never running — leaves whatever was
 * there before, so the panel doesn't announce an old loss on top of a run you
 * are currently building.
 */
function recordLoss(
  s: { streak: number; streakProtectors: number; lastStreakLoss: UserState['lastStreakLoss'] },
  newStreak: number,
  missed: number,
  protectorsUsed: number,
  today: string
): UserState['lastStreakLoss'] {
  const broke = missed > 0 && newStreak <= 1 && s.streak > 1;
  if (!broke) return s.lastStreakLoss;
  return {
    date: today,
    streak: s.streak,
    missed,
    protectors: s.streakProtectors,
    used: protectorsUsed,
  };
}

/** The streak's day, in the player's timezone — see localDayKey. */
function todayStr(offsetDays = 0): string {
  return todayLocal(offsetDays);
}

export interface LevelUpInfo {
  /** The highest level reached — a big enough XP grant can cross more than one. */
  level: number;
  coins: number;
  protectors: number;
}

function levelRewardFor(level: number): { coins: number; protector: boolean } {
  const milestone = level % LEVEL_MILESTONE_EVERY === 0;
  return { coins: milestone ? LEVEL_MILESTONE_COINS : LEVEL_UP_COINS, protector: milestone };
}

/** Every level crossed between two XP totals, summed into one reward — so a
 *  grant big enough to jump two levels at once still pays for both instead
 *  of only the one the total lands on. */
/**
 * `currentProtectors` is whatever the player is holding right before this
 * reward, including any other protector this same action already granted
 * (a lesson's own gift, a chest) — so the count reported here, and the one
 * the celebration shows, is never higher than what actually fit under the
 * cap. Reporting the theoretical amount instead would celebrate a protector
 * that silently evaporated the instant it tried to exceed MAX_PROTECTORS.
 */
function computeLevelUp(beforeXp: number, afterXp: number, currentProtectors: number): LevelUpInfo | null {
  const before = xpToLevel(beforeXp).level;
  const after = xpToLevel(afterXp).level;
  if (after <= before) return null;

  let coins = 0;
  let protectorsEarned = 0;
  for (let level = before + 1; level <= after; level++) {
    const reward = levelRewardFor(level);
    coins += reward.coins;
    if (reward.protector) protectorsEarned++;
  }
  const protectors = Math.min(protectorsEarned, Math.max(0, MAX_PROTECTORS - currentProtectors));
  return { level: after, coins, protectors };
}

/** Resets the day's counters the moment they're read for a day they don't
 *  belong to. Lazy on purpose, like practiceDay/practiceRoundsToday: nothing
 *  needs to run at midnight, because nothing reads a stale count without
 *  going through here or through computeDailyMissions, which does the same
 *  check for display. */
function rollDailyStats(
  s: Pick<UserState, 'dailyStatsDate' | 'dailyXp' | 'dailyLessons' | 'dailyPerfectLessons' | 'dailyCorrect' | 'dailyReviews'>,
  today: string
): DailyMissionInput & { dailyStatsDate: string } {
  /*
   * Copied field by field, never `return s`.
   *
   * It used to hand back the whole state when the day already matched, and
   * every caller spreads this into a `set()` — after the fields it had just
   * computed. So the second lesson of any given day spread a snapshot of the
   * state from *before* that lesson over its own results: no XP, no coins, no
   * stage, the attempt not recorded. The first lesson of the day worked,
   * because that's the branch that builds a fresh object, which is why this
   * survived as "the stage doesn't advance when I replay a lesson".
   */
  if (s.dailyStatsDate === today) {
    return {
      dailyStatsDate: today,
      dailyXp: s.dailyXp,
      dailyLessons: s.dailyLessons,
      dailyPerfectLessons: s.dailyPerfectLessons,
      dailyCorrect: s.dailyCorrect,
      dailyReviews: s.dailyReviews,
    };
  }
  return { dailyStatsDate: today, dailyXp: 0, dailyLessons: 0, dailyPerfectLessons: 0, dailyCorrect: 0, dailyReviews: 0 };
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
      frozenDates: [],
      completedLessonIds: [],
      unlockedBadgeIds: [],
      attempts: [],
      virtualBalance: 10000,
      seenIntroNodeIds: [],
      nodeStageProgress: {},
      termMastery: {},
      plan: 'free',
      planStartedAt: null,
      practiceDay: null,
      practiceRoundsToday: 0,
      tradeDay: null,
      tradesToday: 0,
      dailyStatsDate: null,
      dailyXp: 0,
      dailyLessons: 0,
      dailyPerfectLessons: 0,
      dailyCorrect: 0,
      dailyReviews: 0,
      dailyMissionsDate: null,
      claimedDailyMissionIds: [],
      reviewDates: [],
      activeDates: [],
      weeklyXp: 0,
      leagueRank: 0,
      leagueTableId: null,
      leagueWeekStart: null,
      leagueRewardedRank: 0,
      lastStreakLoss: null,
      lessonsSincePitch: 0,
      openedChestIds: [],
      coins: 0,
      streakProtectors: 0,
      avatar: DEFAULT_LOOK,
      pendingMistakes: [],
      claimedMissionIds: [],
      unlockedAccessories: ['ninguno'],
      testMode: false,
      reminderEnabled: false,
      reminderHour: DEFAULT_REMINDER_HOUR,
      heartsReminderEnabled: false,

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
        set((s) => {
          // The headline perk. Checked here rather than at each call site so
          // there's one place it can be true, and no screen can forget.
          if (hasUnlimitedHearts(s.plan)) return s;
          return {
            hearts: Math.max(0, s.hearts - 1),
            lastHeartLostAt: s.hearts <= 0 ? s.lastHeartLostAt : new Date().toISOString(),
          };
        }),

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

      addXp: (amount) => {
        const s = get();
        const today = todayStr();
        let levelUp: LevelUpInfo | null = null;
        let daily: DailyMissionInput & { dailyStatsDate: string } = {
          dailyStatsDate: today,
          dailyXp: s.dailyStatsDate === today ? s.dailyXp : 0,
          dailyLessons: s.dailyStatsDate === today ? s.dailyLessons : 0,
          dailyPerfectLessons: s.dailyStatsDate === today ? s.dailyPerfectLessons : 0,
          dailyCorrect: s.dailyStatsDate === today ? s.dailyCorrect : 0,
          dailyReviews: s.dailyStatsDate === today ? s.dailyReviews : 0,
        };
        try {
          levelUp = computeLevelUp(s.xp, s.xp + amount, s.streakProtectors);
          daily = rollDailyStats(s, today);
        } catch (err) {
          console.error('[addXp] level-up/daily-mission bonus failed, paying the XP without it:', err);
        }
        set({
          ...daily,
          xp: s.xp + amount,
          weeklyXp: s.weeklyXp + amount,
          coins: s.coins + (levelUp?.coins ?? 0),
          streakProtectors: s.streakProtectors + (levelUp?.protectors ?? 0),
          dailyXp: daily.dailyXp + amount,
        });
        return levelUp;
      },

      /**
       * Marks today as active for streak purposes without touching lesson
       * bookkeeping (no XP here — callers already award their own, no
       * completedLessonIds, no protector gifting). Used by revision flows
       * like the guide's flashcard practice, so a day spent reviewing keeps
       * the streak alive even with zero lessons finished.
       */
      completeReview: () => {
        const s = get();
        const today = todayStr();
        const { streak, lastActiveDate, protectorsUsed, missed } = computeStreakUpdate(
          s.lastActiveDate,
          s.streak,
          s.streakProtectors,
          today
        );
        const frozenDates = [
          ...new Set([...s.frozenDates, ...coveredDays(s.lastActiveDate, today, protectorsUsed)]),
        ];
        const daily = rollDailyStats(s, today);
        set({
          ...daily,
          streak,
          lastActiveDate,
          frozenDates,
          // Deduped: two repasos in one day are one day on the calendar.
          reviewDates: [...new Set([...s.reviewDates, today])],
          activeDates: [...new Set([...s.activeDates, today])],
          streakProtectors: s.streakProtectors - protectorsUsed,
          lastStreakLoss: recordLoss(s, streak, missed, protectorsUsed, today),
          dailyReviews: daily.dailyReviews + 1,
        });
      },

      repairStreak: () => {
        const s = get();
        // Every day the app can prove was active, in the streak's own UTC
        // domain: lessons finished, repasos done, and days a protector
        // already covered.
        const days = [
          // Converted, not sliced: the timestamp is UTC and the streak counts
          // local days, so slicing would misfile anything played near midnight.
          ...s.attempts.map((a) => localDayKey(new Date(a.completedAt))),
          ...s.reviewDates,
          ...s.activeDates,
          ...s.frozenDates,
        ];
        const today = todayStr();
        const proven = streakFromHistory(days, today);
        if (proven <= s.streak) return;

        // The last day of the proven run — today if it's in there, otherwise
        // yesterday, which is what streakFromHistory counted back from.
        const lastDay = days.includes(today) ? today : todayStr(-1);
        set({ streak: proven, lastActiveDate: s.lastActiveDate ?? lastDay });
      },

      claimLeaguePromotion: () => {
        const s = get();
        // Only upwards. Relegation is its own kind of news and doesn't take
        // anything back — the coins were spent on a week you did climb.
        if (s.leagueRank <= s.leagueRewardedRank) return null;

        const reward = leaguePromotionReward(s.leagueRank);
        set({
          leagueRewardedRank: s.leagueRank,
          coins: s.coins + reward.coins,
          streakProtectors: Math.min(MAX_PROTECTORS, s.streakProtectors + reward.protectors),
        });
        return { rank: s.leagueRank, ...reward };
      },

      settleStreak: () => {
        const s = get();
        const today = todayStr();
        // A streak already at 0 or 1 has nothing left to settle, and one that
        // just got raised by repairStreak (which runs first) is live by
        // definition — recomputing here would only repeat that work.
        if (s.streak <= 1) return;
        if (!isStreakUnrecoverable(s.lastActiveDate, s.streakProtectors, today)) return;

        const missed = daysBetween(s.lastActiveDate as string, today) - 1;
        const protectorsUsed = s.streakProtectors;
        const frozenDates = [
          ...new Set([...s.frozenDates, ...coveredDays(s.lastActiveDate, today, protectorsUsed)]),
        ];
        set({
          streak: 0,
          streakProtectors: 0,
          frozenDates,
          lastStreakLoss: recordLoss(s, 0, missed, protectorsUsed, today),
        });
      },

      completeLesson: (attempt) => {
        const s = get();
        const today = todayStr();
        const { streak, lastActiveDate, protectorsUsed, missed } = computeStreakUpdate(
          s.lastActiveDate,
          s.streak,
          s.streakProtectors,
          today
        );
        // The exact days a protector bridged, so the calendar can mark them
        // "congelado" instead of leaving a gap that looks like a broken streak.
        const frozenDates = [
          ...new Set([...s.frozenDates, ...coveredDays(s.lastActiveDate, today, protectorsUsed)]),
        ];
        const isNewCompletion = !s.completedLessonIds.includes(attempt.lessonId);
        const completedLessonIds = isNewCompletion
          ? [...s.completedLessonIds, attempt.lessonId]
          : s.completedLessonIds;

        const node = SKILL_TREE.find((n) => n.id === attempt.nodeId);
        const maxStage = node ? stagesForDifficulty(node.difficulty) : 0;
        const currentStage = s.nodeStageProgress[attempt.nodeId] ?? 0;
        const nodeStageProgress = {
          ...s.nodeStageProgress,
          [attempt.nodeId]: Math.min(maxStage, currentStage + 1),
        };

        // A free protector every few newly-finished lessons, so a coin
        // shortage never means losing the streak either. Repeating an
        // already-completed lesson doesn't count towards it, or grinding one
        // lesson over and over would farm protectors for free.
        const streakProtectorsAfterUse = s.streakProtectors - protectorsUsed;
        const gifted =
          isNewCompletion &&
          completedLessonIds.length % LESSON_PROTECTOR_GIFT_EVERY === 0 &&
          streakProtectorsAfterUse < MAX_PROTECTORS;
        const protectorsAfterGift = gifted ? streakProtectorsAfterUse + 1 : streakProtectorsAfterUse;

        // Levels and daily missions are new, additive rewards layered on top
        // of a lesson that already, always, has to pay out XP, coins and
        // stage progress — the part that worked before either existed. Kept
        // behind its own try so a bug in the new arithmetic can degrade to
        // "no bonus this time" instead of silently cancelling the lesson.
        let levelUp: LevelUpInfo | null = null;
        let daily: DailyMissionInput & { dailyStatsDate: string } = {
          dailyStatsDate: today,
          dailyXp: s.dailyStatsDate === today ? s.dailyXp : 0,
          dailyLessons: s.dailyStatsDate === today ? s.dailyLessons : 0,
          dailyPerfectLessons: s.dailyStatsDate === today ? s.dailyPerfectLessons : 0,
          dailyCorrect: s.dailyStatsDate === today ? s.dailyCorrect : 0,
          dailyReviews: s.dailyStatsDate === today ? s.dailyReviews : 0,
        };
        try {
          levelUp = computeLevelUp(s.xp, s.xp + attempt.xpEarned, protectorsAfterGift);
          daily = rollDailyStats(s, today);
        } catch (err) {
          console.error('[completeLesson] level-up/daily-mission bonus failed, paying the lesson without it:', err);
        }
        const streakProtectors = protectorsAfterGift + (levelUp?.protectors ?? 0);
        const isPerfect = attempt.totalQuestions > 0 && attempt.correctCount === attempt.totalQuestions;

        set({
          ...daily,
          xp: s.xp + attempt.xpEarned,
          weeklyXp: s.weeklyXp + attempt.xpEarned,
          coins: s.coins + attempt.correctCount * COINS_PER_CORRECT + (levelUp?.coins ?? 0),
          streakProtectors,
          frozenDates,
          attempts: [...s.attempts, attempt],
          completedLessonIds,
          streak,
          lastActiveDate,
          nodeStageProgress,
          // Counts every lesson, repeats included: the pitch paces itself on
          // time spent in lessons, not on new ground covered.
          // The day a lesson happened, in the same local domain the streak
          // counts and the calendar draws.
          activeDates: [...new Set([...s.activeDates, today])],
          lessonsSincePitch: s.lessonsSincePitch + 1,
          lastStreakLoss: recordLoss(s, streak, missed, protectorsUsed, today),
          dailyXp: daily.dailyXp + attempt.xpEarned,
          dailyLessons: daily.dailyLessons + 1,
          dailyPerfectLessons: daily.dailyPerfectLessons + (isPerfect ? 1 : 0),
          dailyCorrect: daily.dailyCorrect + attempt.correctCount,
        });

        return { protectorGifted: gifted, levelUp };
      },

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

      hasSeenIntro: (key) => get().seenIntroNodeIds.includes(key),

      markIntroSeen: (key) =>
        set((s) =>
          s.seenIntroNodeIds.includes(key) ? s : { seenIntroNodeIds: [...s.seenIntroNodeIds, key] }
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

      getTermMastery: (termId) => get().termMastery[termId] ?? 0,

      isTermMastered: (termId) => (get().termMastery[termId] ?? 0) >= TERM_MASTERY_GOAL,

      recordTermAnswer: (termId, correct) => {
        const current = get().termMastery[termId] ?? 0;
        const next = correct
          ? Math.min(TERM_MASTERY_GOAL, current + 1)
          : Math.max(0, current - 1);
        if (next !== current) set((s) => ({ termMastery: { ...s.termMastery, [termId]: next } }));
        return next;
      },

      shouldPitchUltra: () => {
        const s = get();
        // Never to somebody who already pays: they've bought the thing.
        return s.plan === 'free' && s.lessonsSincePitch >= LESSONS_PER_PITCH;
      },

      markUltraPitched: () => set({ lessonsSincePitch: 0 }),

      setPlan: (plan) =>
        set((s) => ({
          plan,
          planStartedAt: plan === 'free' ? null : new Date().toISOString(),
          // Subscribing to infinite hearts with none left would leave you
          // locked out of the thing you just paid to stop being locked out of.
          hearts: hasUnlimitedHearts(plan) ? MAX_HEARTS : s.hearts,
          lastHeartLostAt: hasUnlimitedHearts(plan) ? null : s.lastHeartLostAt,
          // Ultra's cosmetics arrive with the plan; the ones already earned
          // from missions stay earned if it later lapses.
          unlockedAccessories: hasAllAccessories(plan)
            ? ([...new Set([...s.unlockedAccessories, 'corona'])] as typeof s.unlockedAccessories)
            : s.unlockedAccessories,
        })),

      canPractice: () => {
        const s = get();
        if (hasUnlimitedPractice(s.plan)) return true;
        if (s.practiceDay !== todayStr()) return true;
        return s.practiceRoundsToday < FREE_PRACTICE_PER_DAY;
      },

      startPracticeRound: () => {
        const s = get();
        if (hasUnlimitedPractice(s.plan)) return true;
        const today = todayStr();
        const used = s.practiceDay === today ? s.practiceRoundsToday : 0;
        if (used >= FREE_PRACTICE_PER_DAY) return false;
        set({ practiceDay: today, practiceRoundsToday: used + 1 });
        return true;
      },

      canTrade: () => {
        const s = get();
        if (hasUnlimitedTrades(s.plan)) return true;
        if (s.tradeDay !== todayStr()) return true;
        return s.tradesToday < FREE_TRADES_PER_DAY;
      },

      startTrade: () => {
        const s = get();
        const today = todayStr();
        // Spent on opening, not on settling: a position abandoned halfway
        // still used the day's turn, or the limit is a suggestion you dodge
        // by closing the tab on a losing trade.
        if (hasUnlimitedTrades(s.plan)) {
          set({ tradeDay: today, tradesToday: s.tradeDay === today ? s.tradesToday + 1 : 1 });
          return true;
        }
        const used = s.tradeDay === today ? s.tradesToday : 0;
        if (used >= FREE_TRADES_PER_DAY) return false;
        set({ tradeDay: today, tradesToday: used + 1 });
        return true;
      },

      settleTrade: (coins) =>
        // Floored at zero: the stake is the most a round can cost, and a
        // balance that went negative would be a debt the shop can't explain.
        set((s) => ({ coins: Math.max(0, s.coins + coins) })),

      isChestOpened: (chestId) => get().openedChestIds.includes(chestId),

      openChest: (chestId) => {
        const s = get();
        // Guarded so a double tap can't pay out twice.
        if (s.openedChestIds.includes(chestId)) return false;
        // Finishing a whole level is a bigger milestone than a single lesson,
        // so it always tops up a protector (still capped at MAX_PROTECTORS).
        const gifted = s.streakProtectors < MAX_PROTECTORS;
        const protectorsAfterGift = gifted ? s.streakProtectors + 1 : s.streakProtectors;
        const today = todayStr();
        let levelUp: LevelUpInfo | null = null;
        let daily: DailyMissionInput & { dailyStatsDate: string } = {
          dailyStatsDate: today,
          dailyXp: s.dailyStatsDate === today ? s.dailyXp : 0,
          dailyLessons: s.dailyStatsDate === today ? s.dailyLessons : 0,
          dailyPerfectLessons: s.dailyStatsDate === today ? s.dailyPerfectLessons : 0,
          dailyCorrect: s.dailyStatsDate === today ? s.dailyCorrect : 0,
          dailyReviews: s.dailyStatsDate === today ? s.dailyReviews : 0,
        };
        try {
          levelUp = computeLevelUp(s.xp, s.xp + CHEST_REWARD.xp, protectorsAfterGift);
          daily = rollDailyStats(s, today);
        } catch (err) {
          console.error('[openChest] level-up/daily-mission bonus failed, paying the chest without it:', err);
        }
        set({
          ...daily,
          openedChestIds: [...s.openedChestIds, chestId],
          xp: s.xp + CHEST_REWARD.xp,
          weeklyXp: s.weeklyXp + CHEST_REWARD.xp,
          coins: s.coins + CHEST_REWARD.coins + (levelUp?.coins ?? 0),
          streakProtectors: protectorsAfterGift + (levelUp?.protectors ?? 0),
          dailyXp: daily.dailyXp + CHEST_REWARD.xp,
        });
        return gifted;
      },

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

      claimDailyMission: (id) => {
        const s = get();
        const today = todayStr();
        const daily = rollDailyStats(s, today);
        const claimedIds = s.dailyMissionsDate === today ? s.claimedDailyMissionIds : [];
        // Guarded the same way claimMission is: a double tap can't pay out
        // twice, and the mission's own target is re-checked rather than
        // trusting whatever the caller believes is true.
        if (claimedIds.includes(id)) return false;
        const mission = pickDailyMissions(today).find((m) => m.id === id);
        if (!mission || mission.progress(daily) < mission.target) return false;

        set({
          ...daily,
          dailyMissionsDate: today,
          claimedDailyMissionIds: [...claimedIds, id],
          coins: s.coins + mission.reward,
        });
        return true;
      },

      isAccessoryUnlocked: (style) => style === 'ninguno' || get().unlockedAccessories.includes(style),

      setReminder: (patch) =>
        set((s) => ({
          reminderEnabled: patch.enabled ?? s.reminderEnabled,
          reminderHour: patch.hour ?? s.reminderHour,
        })),

      setHeartsReminder: (enabled) => set({ heartsReminderEnabled: enabled }),

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
          frozenDates: [],
          completedLessonIds: [],
          unlockedBadgeIds: [],
          attempts: [],
          virtualBalance: 10000,
          seenIntroNodeIds: [],
          nodeStageProgress: {},
          termMastery: {},
          plan: 'free',
          planStartedAt: null,
          practiceDay: null,
          practiceRoundsToday: 0,
          tradeDay: null,
          tradesToday: 0,
          dailyStatsDate: null,
          dailyXp: 0,
          dailyLessons: 0,
          dailyPerfectLessons: 0,
          dailyCorrect: 0,
          dailyReviews: 0,
          dailyMissionsDate: null,
          claimedDailyMissionIds: [],
          reviewDates: [],
          activeDates: [],
          weeklyXp: 0,
          leagueRank: 0,
          leagueTableId: null,
          leagueWeekStart: null,
      leagueRewardedRank: 0,
          lastStreakLoss: null,
          lessonsSincePitch: 0,
          openedChestIds: [],
          coins: 0,
          streakProtectors: 0,
          avatar: DEFAULT_LOOK,
          pendingMistakes: [],
          claimedMissionIds: [],
          unlockedAccessories: ['ninguno'],
          testMode: false,
          reminderEnabled: false,
          reminderHour: DEFAULT_REMINDER_HOUR,
          heartsReminderEnabled: false,
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
