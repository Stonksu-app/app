import { supabase } from './supabase';

/**
 * Nickname rules and availability.
 *
 * Uniqueness is enforced by a unique index in the database — that is the only
 * place it can be enforced honestly, since two people can be typing the same
 * name at the same instant. Everything here is the friendly layer on top: it
 * catches problems while you type instead of at submit.
 */

export const NAME_MIN = 3;
export const NAME_MAX = 20;

/** Letters (accented included), digits, and a few separators people expect. */
const ALLOWED = /^[\p{L}\p{N}](?:[\p{L}\p{N} _.-]*[\p{L}\p{N}])?$/u;

export type NameState =
  /** Nothing typed yet. */
  | 'empty'
  /** Fails the format rules; `message` says why. */
  | 'invalid'
  /** Waiting on the database. */
  | 'checking'
  | 'free'
  | 'taken'
  /** Couldn't ask — no backend configured, or the network failed. Treated as
   *  usable, because blocking someone over a failed check would be worse than
   *  letting the unique index catch it on save. */
  | 'unknown';

/** Format only. Returns null when the name is shaped correctly. */
export function validateName(raw: string): string | null {
  const name = raw.trim();
  if (!name) return null;
  if (name.length < NAME_MIN) return `Al menos ${NAME_MIN} caracteres.`;
  if (name.length > NAME_MAX) return `Máximo ${NAME_MAX} caracteres.`;
  if (!ALLOWED.test(name)) return 'Solo letras, números, espacios, guiones y puntos.';
  return null;
}

/**
 * Asks the database whether the nickname is free.
 *
 * Null means the question couldn't be asked, which the caller should treat as
 * permission to continue rather than as a refusal.
 */
export async function isNameFree(raw: string): Promise<boolean | null> {
  const name = raw.trim();
  if (!supabase || !name) return null;

  const { data, error } = await supabase.rpc('name_available', { candidate: name });
  if (error) {
    console.warn('[names] could not check availability:', error.message);
    return null;
  }
  return data === true;
}

/**
 * A free variant of a name that has just been taken from under us.
 *
 * Only used to recover from the race the availability check cannot close: two
 * players confirming the same nickname in the same moment. One of them lands
 * on "pollo", the other on "pollo2", which beats the alternative of their
 * progress silently failing to sync from then on.
 */
export function suffixName(raw: string, attempt: number): string {
  const suffix = String(attempt + 1);
  const base = raw.trim().slice(0, NAME_MAX - suffix.length);
  return `${base}${suffix}`;
}
