import { supabase } from './supabase';
import type { MascotLook } from '../types';

export interface LeagueMember {
  id: string;
  name: string;
  avatar: MascotLook;
  weeklyXp: number;
  isSelf: boolean;
}

/**
 * Seats the caller for the current week if they aren't already, then
 * returns their table ranked by this week's XP. Both calls are cheap and
 * idempotent, so the league screen just does this on every visit rather
 * than trying to track locally whether a new week has started.
 */
export async function fetchLeagueTable(): Promise<LeagueMember[] | null> {
  if (!supabase) return null;

  const { error: joinError } = await supabase.rpc('join_league_if_needed');
  if (joinError) {
    console.warn('[leagues] could not join a table:', joinError.message);
    return null;
  }

  const { data, error } = await supabase.rpc('league_leaderboard');
  if (error) {
    console.warn('[leagues] could not read the leaderboard:', error.message);
    return null;
  }

  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    name: row.name as string,
    avatar: row.avatar as MascotLook,
    weeklyXp: row.weekly_xp as number,
    isSelf: row.is_self as boolean,
  }));
}
