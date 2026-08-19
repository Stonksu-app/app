import { supabase } from './supabase';
import type { MascotLook } from '../types';

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
  relation: Relation;
  since: string;
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
    relation: r.relation as Relation,
    since: r.since as string,
  }));
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
