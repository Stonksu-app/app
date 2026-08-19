import { supabase } from './supabase';
import type { LessonAttempt, MascotLook, OnboardingAnswers } from '../types';
import type { AccessoryStyle } from '../types';

/**
 * Translation layer between the Zustand store and Postgres.
 *
 * The database uses snake_case because that is the SQL convention and it keeps
 * the schema readable in the Supabase dashboard; the app uses camelCase. Rather
 * than let either side bend, the mapping lives here and nowhere else.
 *
 * `testMode` is intentionally not part of this: it is a local debugging switch,
 * and syncing it would unlock the whole tree on every device you sign into.
 */

/** The slice of store state that belongs in the cloud. */
export interface CloudState {
  name: string;
  onboarded: boolean;
  onboardingAnswers: OnboardingAnswers;
  xp: number;
  coins: number;
  hearts: number;
  lastHeartLostAt: string | null;
  streak: number;
  lastActiveDate: string | null;
  streakProtectors: number;
  completedLessonIds: string[];
  unlockedBadgeIds: string[];
  seenIntroNodeIds: string[];
  openedChestIds: string[];
  claimedMissionIds: string[];
  unlockedAccessories: AccessoryStyle[];
  pendingMistakes: string[];
  nodeStageProgress: Record<string, number>;
  avatar: MascotLook;
  virtualBalance: number;
  attempts: LessonAttempt[];
}

export interface ProfileRow {
  name: string;
  onboarded: boolean;
  onboarding_answers: OnboardingAnswers;
  xp: number;
  coins: number;
  hearts: number;
  last_heart_lost_at: string | null;
  streak: number;
  last_active_date: string | null;
  streak_protectors: number;
  completed_lesson_ids: string[];
  unlocked_badge_ids: string[];
  seen_intro_node_ids: string[];
  opened_chest_ids: string[];
  claimed_mission_ids: string[];
  unlocked_accessories: AccessoryStyle[];
  pending_mistakes: string[];
  node_stage_progress: Record<string, number>;
  avatar: MascotLook;
  virtual_balance: number | string;
}

/** Exported so scripts/check-cloud.ts can prove the mapping is lossless. */
export function toRow(s: CloudState, id: string) {
  return {
    id,
    name: s.name,
    onboarded: s.onboarded,
    onboarding_answers: s.onboardingAnswers,
    xp: s.xp,
    coins: s.coins,
    hearts: s.hearts,
    last_heart_lost_at: s.lastHeartLostAt,
    streak: s.streak,
    last_active_date: s.lastActiveDate,
    streak_protectors: s.streakProtectors,
    completed_lesson_ids: s.completedLessonIds,
    unlocked_badge_ids: s.unlockedBadgeIds,
    seen_intro_node_ids: s.seenIntroNodeIds,
    opened_chest_ids: s.openedChestIds,
    claimed_mission_ids: s.claimedMissionIds,
    unlocked_accessories: s.unlockedAccessories,
    pending_mistakes: s.pendingMistakes,
    node_stage_progress: s.nodeStageProgress,
    avatar: s.avatar,
    virtual_balance: s.virtualBalance,
  };
}

export function fromRow(row: ProfileRow, attempts: LessonAttempt[]): CloudState {
  return {
    name: row.name,
    onboarded: row.onboarded,
    onboardingAnswers: row.onboarding_answers,
    xp: row.xp,
    coins: row.coins,
    hearts: row.hearts,
    lastHeartLostAt: row.last_heart_lost_at,
    streak: row.streak,
    lastActiveDate: row.last_active_date,
    streakProtectors: row.streak_protectors,
    completedLessonIds: row.completed_lesson_ids,
    unlockedBadgeIds: row.unlocked_badge_ids,
    seenIntroNodeIds: row.seen_intro_node_ids,
    openedChestIds: row.opened_chest_ids,
    claimedMissionIds: row.claimed_mission_ids,
    unlockedAccessories: row.unlocked_accessories,
    pendingMistakes: row.pending_mistakes,
    nodeStageProgress: row.node_stage_progress,
    avatar: row.avatar,
    // numeric(14,2) comes back as a string from PostgREST to avoid float drift.
    virtualBalance: Number(row.virtual_balance),
    attempts,
  };
}

const PROFILE_COLUMNS =
  'name, onboarded, onboarding_answers, xp, coins, hearts, last_heart_lost_at, streak, ' +
  'last_active_date, streak_protectors, completed_lesson_ids, unlocked_badge_ids, ' +
  'seen_intro_node_ids, opened_chest_ids, claimed_mission_ids, unlocked_accessories, ' +
  'pending_mistakes, node_stage_progress, avatar, virtual_balance';

/**
 * Signs in, creating an anonymous account on first launch.
 *
 * Anonymous accounts are real rows in auth.users, so progress is already
 * server-side before the player ever gives an email; linking one later keeps
 * the same id and therefore the same profile.
 */
export async function ensureSession(): Promise<string | null> {
  if (!supabase) return null;

  const { data: existing } = await supabase.auth.getSession();
  if (existing.session) return existing.session.user.id;

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) {
    console.warn('[cloud] anonymous sign-in failed, staying local:', error.message);
    return null;
  }
  return data.user?.id ?? null;
}

/** Reads the player's whole state. Null means "no usable cloud state". */
export async function pullState(userId: string): Promise<CloudState | null> {
  if (!supabase) return null;

  const [profile, attempts] = await Promise.all([
    supabase.from('profiles').select(PROFILE_COLUMNS).eq('id', userId).maybeSingle(),
    supabase
      .from('attempts')
      .select('lesson_id, node_id, completed_at, xp_earned, correct_count, total_questions')
      .eq('user_id', userId)
      .order('completed_at', { ascending: true }),
  ]);

  if (profile.error) {
    console.warn('[cloud] could not read profile:', profile.error.message);
    return null;
  }
  if (!profile.data) return null;

  const history: LessonAttempt[] = (attempts.data ?? []).map((a) => ({
    lessonId: a.lesson_id,
    nodeId: a.node_id,
    completedAt: a.completed_at,
    xpEarned: a.xp_earned,
    correctCount: a.correct_count,
    totalQuestions: a.total_questions,
  }));

  return fromRow(profile.data as unknown as ProfileRow, history);
}

/**
 * Writes the player's whole state.
 *
 * Attempts go up with onConflict on (user_id, lesson_id, completed_at), which
 * the schema declares unique — so replaying a full local history is idempotent
 * rather than duplicating every entry in the streak calendar.
 */
export async function pushState(userId: string, state: CloudState): Promise<boolean> {
  if (!supabase) return false;

  const { error: profileError } = await supabase.from('profiles').upsert(toRow(state, userId));
  if (profileError) {
    console.warn('[cloud] could not save profile:', profileError.message);
    return false;
  }

  if (state.attempts.length) {
    const { error: attemptsError } = await supabase.from('attempts').upsert(
      state.attempts.map((a) => ({
        user_id: userId,
        lesson_id: a.lessonId,
        node_id: a.nodeId,
        completed_at: a.completedAt,
        xp_earned: a.xpEarned,
        correct_count: a.correctCount,
        total_questions: a.totalQuestions,
      })),
      { onConflict: 'user_id, lesson_id, completed_at' }
    );
    if (attemptsError) {
      console.warn('[cloud] could not save attempts:', attemptsError.message);
      return false;
    }
  }

  return true;
}

/**
 * Whether a pulled state represents a player who has actually done something.
 *
 * Used to decide which side wins on first sync: a fresh cloud profile gives way
 * to whatever progress is already on the device, so signing in doesn't wipe the
 * lessons you played before the backend existed.
 */
export function hasProgress(state: Pick<CloudState, 'onboarded' | 'xp' | 'attempts'>): boolean {
  return state.onboarded || state.xp > 0 || state.attempts.length > 0;
}
