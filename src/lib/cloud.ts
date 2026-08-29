import { supabase } from './supabase';
import type { LessonAttempt, MascotLook, OnboardingAnswers } from '../types';
import type { AccessoryStyle } from '../types';
import type { Plan } from '../data/plans';

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
  termMastery: Record<string, number>;
  plan: Plan;
  planStartedAt: string | null;
  avatar: MascotLook;
  virtualBalance: number;
  attempts: LessonAttempt[];
  frozenDates: string[];
  reviewDates: string[];
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
  term_mastery: Record<string, number>;
  plan: Plan;
  plan_started_at: string | null;
  avatar: MascotLook;
  virtual_balance: number | string;
  frozen_dates: string[];
  review_dates: string[];
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
    term_mastery: s.termMastery,
    plan: s.plan,
    plan_started_at: s.planStartedAt,
    avatar: s.avatar,
    virtual_balance: s.virtualBalance,
    frozen_dates: s.frozenDates,
    review_dates: s.reviewDates,
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
    // A profile written before the column existed comes back null, not {}.
    termMastery: row.term_mastery ?? {},
    // Same reasoning: a profile written before the columns existed is free.
    plan: row.plan ?? 'free',
    planStartedAt: row.plan_started_at ?? null,
    avatar: row.avatar,
    // numeric(14,2) comes back as a string from PostgREST to avoid float drift.
    virtualBalance: Number(row.virtual_balance),
    attempts,
    // A profile written before the columns existed comes back null, not [].
    frozenDates: row.frozen_dates ?? [],
    reviewDates: row.review_dates ?? [],
  };
}

const PROFILE_COLUMNS =
  'name, onboarded, onboarding_answers, xp, coins, hearts, last_heart_lost_at, streak, ' +
  'last_active_date, streak_protectors, completed_lesson_ids, unlocked_badge_ids, ' +
  'seen_intro_node_ids, opened_chest_ids, claimed_mission_ids, unlocked_accessories, ' +
  'pending_mistakes, node_stage_progress, term_mastery, plan, plan_started_at, avatar, ' +
  'virtual_balance, frozen_dates, review_dates';

/**
 * Signs in, creating an anonymous account on first launch.
 *
 * Anonymous accounts are real rows in auth.users, so progress is already
 * server-side before the player ever gives an email; linking one later keeps
 * the same id and therefore the same profile.
 */
/**
 * Shared by every concurrent caller.
 *
 * Two calls overlapping each create their own anonymous account — visible in
 * the database as a pair of users milliseconds apart. React runs effects twice
 * in development, and two tabs opening together do it in production, so this
 * is not hypothetical.
 */
let sessionInFlight: Promise<string | null> | null = null;

export function ensureSession(): Promise<string | null> {
  if (!supabase) return Promise.resolve(null);
  if (!sessionInFlight) {
    sessionInFlight = resolveSession().finally(() => {
      sessionInFlight = null;
    });
  }
  return sessionInFlight;
}

async function resolveSession(): Promise<string | null> {
  if (!supabase) return null;

  const { data: existing } = await supabase.auth.getSession();
  if (existing.session) return existing.session.user.id;

  // A sign-in landing from a provider arrives as parameters in the URL and is
  // exchanged for a session asynchronously. Creating an anonymous account in
  // that window would be a quiet disaster: the player would be dropped into a
  // brand new empty profile a heartbeat before their real one arrived, and the
  // account they just authenticated would be orphaned.
  if (hasAuthCallbackInUrl()) {
    const arriving = await waitForSession();
    if (arriving) return arriving;
  }

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) {
    console.warn('[cloud] anonymous sign-in failed, staying local:', error.message);
    return null;
  }
  return data.user?.id ?? null;
}

/** Signs out and drops back to a fresh anonymous session, shared by the two
 *  callers that both mean "this account is done, start clean": a deleted
 *  account discovered mid-sync, and a deliberate "cerrar sesión" tap. */
async function freshAnonymousSession(): Promise<string | null> {
  if (!supabase) return null;
  await supabase.auth.signOut();
  return ensureSession();
}

/**
 * Throws away a session whose account no longer exists, and starts over.
 *
 * Returns the new anonymous user id, so play can carry on rather than the app
 * sitting there pretending to save.
 */
export async function restartSession(): Promise<string | null> {
  console.warn('[cloud] this session belongs to a deleted account; starting a new one');
  return freshAnonymousSession();
}

/**
 * A deliberate sign-out from Profile. Returns the new anonymous user id that
 * replaces it, so the caller can push a clean local state up under it.
 */
export async function signOut(): Promise<string | null> {
  return freshAnonymousSession();
}

/** Whether the current URL looks like a provider or email callback. */
function hasAuthCallbackInUrl(): boolean {
  if (typeof window === 'undefined') return false;
  const url = window.location.hash + window.location.search;
  return /access_token=|refresh_token=|[?&#]code=/.test(url);
}

/** Resolves with the user id once the callback is exchanged, or null if it
 *  never lands — a broken callback must not hang the app forever. */
function waitForSession(timeoutMs = 4000): Promise<string | null> {
  const client = supabase;
  if (!client) return Promise.resolve(null);

  return new Promise((resolve) => {
    let settled = false;
    const finish = (id: string | null) => {
      if (settled) return;
      settled = true;
      subscription?.unsubscribe();
      clearTimeout(timer);
      resolve(id);
    };

    const timer = setTimeout(() => finish(null), timeoutMs);
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, session) => {
      if (session) finish(session.user.id);
    });
  });
}

export type PullResult =
  /** A profile row exists; `state` is it. */
  | { status: 'found'; state: CloudState }
  /** The account has no profile yet. Safe to seed from this device. */
  | { status: 'empty' }
  /** The read failed. Says nothing about what is up there. */
  | { status: 'error' };

/**
 * Reads the player's whole state.
 *
 * The three outcomes are kept apart deliberately. Collapsing "the read failed"
 * into "there is nothing there" is how a real profile gets destroyed: the
 * caller seeds an empty account from whatever this device holds, and on a
 * device that has just been cleared, that is nothing at all.
 */
export async function pullState(userId: string): Promise<PullResult> {
  if (!supabase) return { status: 'error' };

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
    return { status: 'error' };
  }
  if (attempts.error) {
    // Half a history is worse than none: it would look like lost lessons and
    // then be written back as the truth.
    console.warn('[cloud] could not read attempts:', attempts.error.message);
    return { status: 'error' };
  }
  if (!profile.data) return { status: 'empty' };

  const history: LessonAttempt[] = (attempts.data ?? []).map((a) => ({
    lessonId: a.lesson_id,
    nodeId: a.node_id,
    completedAt: a.completed_at,
    xpEarned: a.xp_earned,
    correctCount: a.correct_count,
    totalQuestions: a.total_questions,
  }));

  return { status: 'found', state: fromRow(profile.data as unknown as ProfileRow, history) };
}

/**
 * Writes the player's whole state.
 *
 * Attempts go up with onConflict on (user_id, lesson_id, completed_at), which
 * the schema declares unique — so replaying a full local history is idempotent
 * rather than duplicating every entry in the streak calendar.
 */
export type PushResult =
  | 'ok'
  /** The nickname was claimed between the availability check and the save.
   *  Called out separately because it is the one failure the caller can fix. */
  | 'name-taken'
  /** The session is signed by a user that no longer exists — the row was
   *  deleted while the token was still valid. Recoverable, but only by
   *  throwing the session away. */
  | 'no-account'
  | 'failed';

/**
 * Turns a Postgres error code into something the caller can act on.
 *
 * Both of these would otherwise fail identically forever — every later push
 * hits the same wall — so progress would stop syncing with nothing on screen
 * to say so. Pulled out as a pure function so the mapping can be tested
 * without a server that is willing to break on demand.
 */
export function classifyWriteError(code: string | undefined): PushResult {
  switch (code) {
    // Unique violation. The only unique constraint on profiles is the nickname
    // index, so someone claimed the name in the last few seconds.
    case '23505':
      return 'name-taken';

    // Foreign key violation. profiles.id references auth.users, so the account
    // this session belongs to has been deleted — while its JWT stays valid for
    // the rest of its hour, leaving the app convinced it is signed in.
    case '23503':
      return 'no-account';

    default:
      return 'failed';
  }
}

export async function pushState(userId: string, state: CloudState): Promise<PushResult> {
  if (!supabase) return 'failed';

  let { error: profileError } = await supabase.from('profiles').upsert(toRow(state, userId));

  /*
   * A column the client knows about and the database doesn't.
   *
   * PostgREST answers PGRST204 and rejects the whole row, so one un-run
   * migration doesn't cost you that one field — it stops *all* progress from
   * saving, silently. That's too harsh a punishment for a schema that's merely
   * behind, so the row is sent again without the offending column: everything
   * else keeps syncing, and the missing field starts working by itself once
   * the migration runs.
   */
  if (profileError?.code === 'PGRST204') {
    const missing = profileError.message.match(/'([a-z_]+)' column/)?.[1];
    const row = toRow(state, userId) as Record<string, unknown>;
    if (missing && missing in row) {
      console.warn(`[cloud] la columna "${missing}" no existe todavía; guardando sin ella`);
      delete row[missing];
      ({ error: profileError } = await supabase.from('profiles').upsert(row));
    }
  }

  if (profileError) {
    const result = classifyWriteError(profileError.code);
    if (result === 'failed') console.warn('[cloud] could not save profile:', profileError.message);
    return result;
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
      return 'failed';
    }
  }

  return 'ok';
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
