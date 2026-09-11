import { supabase } from './supabase';
import { useUserStore } from '../store/useUserStore';

type User = ReturnType<typeof useUserStore.getState>;
export type SimulatorState = Pick<User, 'openTrade' | 'pendingOrder' | 'tradeHistory' | 'tradeDay' | 'tradesToday'>;
export interface SimulatorSnapshot {
  revision: number;
  state: SimulatorState | null;
  coins: number;
  accepted?: boolean;
}
export const emptySimulator = (): SimulatorState => ({ openTrade: null, pendingOrder: null, tradeHistory: [], tradeDay: null, tradesToday: 0 });
export function simulatorState(s: User): SimulatorState {
  return { openTrade: s.openTrade, pendingOrder: s.pendingOrder, tradeHistory: s.tradeHistory, tradeDay: s.tradeDay, tradesToday: s.tradesToday };
}

/**
 * Whether two documents hold the same operation.
 *
 * Not `JSON.stringify(a) === JSON.stringify(b)`. `jsonb` keeps object keys in
 * its own order — shortest first, then bytewise — so the document that comes
 * back from Postgres reads `tradeDay, openTrade, tradesToday, …` while the one
 * built here reads `openTrade, pendingOrder, …`, nested objects included. The
 * two strings therefore never match, not even for a document just written from
 * this device: comparing them says "it changed" on every single poll, and the
 * three-second read turns into a store rewrite and a profile save forever.
 * Sorting the keys is what makes the question answerable at all.
 */
function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, held) =>
    held && typeof held === 'object' && !Array.isArray(held)
      ? Object.fromEntries(Object.keys(held as object).sort().map(k => [k, (held as Record<string, unknown>)[k]]))
      : held,
  );
}

export function sameSimulator(a: SimulatorState, b: SimulatorState): boolean {
  return canonical(a) === canonical(b);
}

export async function readSimulator(): Promise<SimulatorSnapshot> {
  if (!supabase) throw new Error('Sin conexión a la cuenta');
  const { data, error } = await supabase.rpc('simulator_read').abortSignal(AbortSignal.timeout(12000));
  if (error || !data) throw new Error(error?.message ?? 'No se pudo leer la operación');
  return data as SimulatorSnapshot;
}

export async function writeSimulator(revision: number, state: SimulatorState, coinDelta = 0): Promise<SimulatorSnapshot> {
  if (!supabase) throw new Error('Sin conexión a la cuenta');
  const { data, error } = await supabase.rpc('simulator_commit', {
    expected_revision: revision, next_state: state, coin_delta: coinDelta,
  }).abortSignal(AbortSignal.timeout(12000));
  if (error || !data) throw new Error(error?.message ?? 'No se pudo guardar la operación');
  return data as SimulatorSnapshot;
}
