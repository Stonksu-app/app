import { supabase } from './supabase';
import { useSyncStore } from '../store/useSyncStore';
import type { MascotLook } from '../types';
import type { Plan } from '../data/plans';

/**
 * The friends API.
 *
 * Everything goes through database functions rather than table access. Row
 * level security keeps a player out of everyone else's profile — which is
 * right — so a friends list has to be assembled server-side, and the rules
 * about who may accept or ping whom live in one place instead of being spread
 * across policies.
 */

export type Relation = 'friend' | 'incoming' | 'outgoing';

export interface Friend {
  id: string;
  name: string;
  avatar: MascotLook;
  streak: number;
  xp: number;
  plan: Plan;
  relation: Relation;
  since: string;
}

/** What one player may see about another. Aggregated on the server — the
 *  attempts themselves never leave their owner. */
export interface FriendProfile {
  id: string;
  name: string;
  avatar: MascotLook;
  streak: number;
  xp: number;
  plan: Plan;
  lessons: number;
  /** Percentage of answers correct, or null if they've never answered one. */
  accuracy: number | null;
  memberSince: string;
  lastActive: string | null;
  /** Days they practised, and days a protector covered — the last 60, as
   *  YYYY-MM-DD, for drawing the same calendar their streak claims. */
  activeDays: string[];
  frozenDays: string[];
}

export interface Ping {
  id: number;
  fromName: string;
  fromAvatar: MascotLook;
  createdAt: string;
}

/** Outcomes of asking for someone's friendship, as the player should read them. */
const REQUEST_MESSAGES: Record<string, string> = {
  sent: 'Solicitud enviada.',
  accepted: '¡Ya sois amigos! Te había pedido antes.',
  already_sent: 'Ya le enviaste una solicitud. Toca esperar.',
  already_friends: 'Ya sois amigos.',
  not_found: 'No hay nadie con ese apodo.',
  thats_you: 'Ese eres tú.',
  not_signed_in: 'Necesitas una sesión para esto.',
};

const PING_MESSAGES: Record<string, string> = {
  sent: '¡Toque enviado!',
  too_soon: 'Ya le diste un toque hace poco. Dale un respiro.',
  not_friends: 'Solo puedes dar toques a tus amigos.',
  not_signed_in: 'Necesitas una sesión para esto.',
};

/**
 * Client-side ping cooldown fallback.
 *
 * The real source of truth is `friend_ping_cooldown` below, asked over the
 * network. This purely-local guess only covers the moment that call can't be
 * made — offline, or a deployment that hasn't run the migration that added
 * it yet. It used to be the *only* mechanism, which is why signing out and
 * back in (or switching devices) used to show a friend as pingable when the
 * server would still reject it: localStorage has no idea the account come
 * back is the one that already pinged them.
 *
 * Keyed by *both* the signed-in account and the friend: localStorage is
 * shared by the whole browser/device, not per Supabase session, so testing
 * with two accounts on the same phone (or switching accounts) must not have
 * one account's outgoing ping show up as a cooldown on the other's — that
 * previously made a friend look like they'd "already pinged" someone they
 * never touched.
 */
const PING_COOLDOWN_MS = 60 * 60 * 1000;
const PING_COOLDOWN_KEY = 'stonksu:ping-cooldowns';

function cooldownKey(friendId: string): string {
  const myId = useSyncStore.getState().userId ?? 'anon';
  return `${myId}:${friendId}`;
}

function readPingCooldowns(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(PING_COOLDOWN_KEY) ?? '{}');
  } catch {
    return {};
  }
}

function startLocalPingCooldown(friendId: string): void {
  try {
    const map = readPingCooldowns();
    map[cooldownKey(friendId)] = Date.now();
    localStorage.setItem(PING_COOLDOWN_KEY, JSON.stringify(map));
  } catch {
    // Storage might be full or unavailable; the cooldown just won't persist across reloads.
  }
}

function localPingCooldownRemaining(friendId: string): number {
  const startedAt = readPingCooldowns()[cooldownKey(friendId)];
  if (!startedAt) return 0;
  return Math.max(0, startedAt + PING_COOLDOWN_MS - Date.now());
}

/**
 * Ms remaining before `friendId` can be pinged again by us, 0 once free.
 *
 * Asks the server, which actually knows — unlike the local guess above, this
 * survives signing out and back in, switching devices, or reinstalling,
 * because it comes from the same `pings` row the server itself checks.
 */
export async function pingCooldownRemaining(friendId: string): Promise<number> {
  if (!supabase) return localPingCooldownRemaining(friendId);
  const { data, error } = await supabase.rpc('friend_ping_cooldown', { other: friendId });
  if (error) return localPingCooldownRemaining(friendId);
  return Math.max(0, Math.round(Number(data)) * 1000);
}

export async function listFriends(): Promise<Friend[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc('friend_list');
  if (error) {
    console.warn('[friends] could not load list:', error.message);
    return [];
  }
  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    name: r.name as string,
    avatar: r.avatar as MascotLook,
    streak: (r.streak as number) ?? 0,
    xp: (r.xp as number) ?? 0,
    // A list served by a database that predates the plan column reads free,
    // which is the safe way to be wrong: it under-promises a badge.
    plan: (r.plan as Plan) ?? 'free',
    relation: r.relation as Relation,
    since: r.since as string,
  }));
}

/**
 * A friend's profile card.
 *
 * Returns null for anyone who isn't an accepted friend — the server decides
 * that, not this function, so a hand-crafted call gets the same answer.
 */
export async function fetchFriendProfile(friendId: string): Promise<FriendProfile | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc('friend_profile', { other: friendId });
  if (error) {
    console.warn('[friends] could not load profile:', error.message);
    return null;
  }
  const row = (data ?? [])[0] as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    id: row.id as string,
    name: row.name as string,
    avatar: row.avatar as MascotLook,
    streak: (row.streak as number) ?? 0,
    xp: (row.xp as number) ?? 0,
    plan: ((row.plan as Plan) ?? 'free'),
    lessons: (row.lessons as number) ?? 0,
    accuracy: row.accuracy === null || row.accuracy === undefined ? null : Number(row.accuracy),
    memberSince: row.member_since as string,
    lastActive: (row.last_active as string) ?? null,
    // A database still on the previous version returns neither, and an empty
    // calendar is the honest answer to "we don't know yet".
    activeDays: (row.active_days as string[]) ?? [],
    frozenDays: (row.frozen_days as string[]) ?? [],
  };
}

export async function requestFriend(nickname: string): Promise<{ ok: boolean; message: string }> {
  if (!supabase) return { ok: false, message: 'Sin conexión con el servidor.' };
  const { data, error } = await supabase.rpc('friend_request', { nickname: nickname.trim() });
  if (error) return { ok: false, message: error.message };
  const code = String(data);
  return { ok: code === 'sent' || code === 'accepted', message: REQUEST_MESSAGES[code] ?? code };
}

export async function respondToRequest(otherId: string, accept: boolean): Promise<boolean> {
  if (!supabase) return false;
  const { data, error } = await supabase.rpc('friend_respond', { other: otherId, accept });
  if (error) {
    console.warn('[friends] could not respond:', error.message);
    return false;
  }
  return data === true;
}

/** Covers both unfriending and cancelling a request you sent. */
export async function removeFriend(otherId: string): Promise<boolean> {
  if (!supabase) return false;
  const { data, error } = await supabase.rpc('friend_remove', { other: otherId });
  if (error) {
    console.warn('[friends] could not remove:', error.message);
    return false;
  }
  return data === true;
}

export async function pingFriend(otherId: string): Promise<{ ok: boolean; message: string }> {
  if (!supabase) return { ok: false, message: 'Sin conexión con el servidor.' };
  const { data, error } = await supabase.rpc('friend_ping', { other: otherId });
  if (error) return { ok: false, message: error.message };
  const code = String(data);
  // Keeps the local fallback roughly in sync too, in case the next read has
  // to fall back to it (offline, or the server call fails for some reason).
  if (code === 'sent' || code === 'too_soon') startLocalPingCooldown(otherId);
  return { ok: code === 'sent', message: PING_MESSAGES[code] ?? code };
}

export async function fetchPings(): Promise<Ping[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc('ping_inbox');
  if (error) {
    // Expected before 0004 has been applied; not worth alarming anyone.
    return [];
  }
  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as number,
    fromName: r.from_name as string,
    fromAvatar: r.from_avatar as MascotLook,
    createdAt: r.created_at as string,
  }));
}

export async function markPingsSeen(): Promise<void> {
  if (!supabase) return;
  await supabase.rpc('ping_mark_seen');
}
