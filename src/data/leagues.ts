/**
 * The six league ranks, lowest to highest. Index into this array is exactly
 * `profiles.league_rank` — see supabase/migrations/0009_leagues.sql, which
 * is the only thing that ever changes that number.
 */
export interface LeagueRank {
  emoji: string;
  name: string;
}

export const LEAGUE_RANKS: LeagueRank[] = [
  { emoji: '🌱', name: 'Beginner' },
  { emoji: '📈', name: 'Trader' },
  { emoji: '⚡', name: 'Analyst' },
  { emoji: '🐂', name: 'Bull' },
  { emoji: '💎', name: 'Pro Trader' },
  { emoji: '👑', name: 'Market Master' },
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
