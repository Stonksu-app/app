import type { IconName } from '../types';

/**
 * The six league ranks, lowest to highest. Index into this array is exactly
 * `profiles.league_rank` — see supabase/migrations/0009_leagues.sql, which
 * is the only thing that ever changes that number.
 */
export interface LeagueRank {
  /** From the app's own icon set — see src/components/Icon.tsx. Emoji were
   *  here first and rendered as whatever each platform ships, which on
   *  Android is a different drawing style from every other mark in the app. */
  icon: IconName;
  name: string;
  /** Tailwind text colour for the mark. The ladder climbs bronze → silver →
   *  gold, then the app's own lime for the bull, and back to gold at the top
   *  with a halo, so the last rank reads as the end of a road rather than as
   *  another colour.
   *
   *  Deliberately not violet: that belongs to Ultra and mastery, and a rank
   *  wearing it would read as "this person pays" rather than "this person
   *  climbed". Sky is likewise spoken for by streak protectors. */
  tone: string;
  /** Only the top rank. */
  glow?: boolean;
}

export const LEAGUE_RANKS: LeagueRank[] = [
  { icon: 'sprout', name: 'Beginner', tone: 'text-league-bronze' },
  { icon: 'candle', name: 'Trader', tone: 'text-league-silver' },
  { icon: 'brain', name: 'Analyst', tone: 'text-league-silver' },
  { icon: 'bull', name: 'Bull', tone: 'text-lime-500' },
  { icon: 'diamond', name: 'Pro Trader', tone: 'text-league-gold' },
  { icon: 'trophy', name: 'Market Master', tone: 'text-league-gold', glow: true },
];

export const MAX_LEAGUE_RANK = LEAGUE_RANKS.length - 1;

export function leagueRankInfo(rank: number): LeagueRank {
  return LEAGUE_RANKS[Math.min(Math.max(rank, 0), MAX_LEAGUE_RANK)];
}

/** How many of a table's top finishers promote, and how many of the bottom
 *  relegate — mirrored in run_weekly_league_reset(), which is the one that
 *  actually decides anybody's rank. Exported so the UI can mark the same
 *  zones it describes without the numbers drifting apart from the database. */
export const PROMOTION_ZONE = 4;
export const DEMOTION_ZONE = 1;
/** A table below this size promotes or relegates nobody — see the migration. */
export const MIN_TABLE_SIZE_FOR_PROMOTION = 4;
export const MIN_TABLE_SIZE_FOR_DEMOTION = 1;

/**
 * What arriving in a league pays.
 *
 * Promotion already gives you a harder table, which is a reward only if you
 * wanted one — so it comes with something you can spend. It climbs with the
 * league because the weeks get harder as the table does, and protectors
 * arrive at the top half, where a broken streak costs a rank rather than just
 * a number.
 *
 * Index is the league you arrive *in*: nobody is rewarded for rank 0, which
 * is where everyone starts.
 */
export const LEAGUE_PROMOTION_REWARDS: { coins: number; protectors: number }[] = [
  { coins: 0, protectors: 0 },
  { coins: 50, protectors: 0 },
  { coins: 100, protectors: 0 },
  { coins: 175, protectors: 1 },
  { coins: 275, protectors: 1 },
  { coins: 400, protectors: 2 },
];

export function leaguePromotionReward(rank: number): { coins: number; protectors: number } {
  return LEAGUE_PROMOTION_REWARDS[Math.min(Math.max(rank, 0), MAX_LEAGUE_RANK)];
}
