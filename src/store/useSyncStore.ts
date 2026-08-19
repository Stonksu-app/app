import { create } from 'zustand';
import { isCloudEnabled } from '../lib/supabase';

/**
 * How far along the first sync is.
 *
 * Exists so route guards can wait. Without it they decide from whatever
 * localStorage happens to hold, which on a device that has never run the app
 * is nothing — so someone with a perfectly good account gets bounced to the
 * landing page a moment before their profile arrives.
 */
export type SyncStatus = 'off' | 'connecting' | 'ready' | 'error';

interface SyncState {
  status: SyncStatus;
  /** The account this device is currently playing on. Shown in Profile,
   *  because "why am I not my old self?" is almost always "you are signed
   *  into a different account than you think", and nothing else on screen
   *  can tell you which one. */
  userId: string | null;
  setStatus: (status: SyncStatus) => void;
  setUserId: (userId: string | null) => void;
  /** True while the answer to "is this player onboarded?" is still unknown. */
  settled: () => boolean;
}

export const useSyncStore = create<SyncState>()((set, get) => ({
  status: isCloudEnabled ? 'connecting' : 'off',
  userId: null,
  setStatus: (status) => set({ status }),
  setUserId: (userId) => set({ userId }),
  // 'error' counts as settled: the cloud isn't coming, so fall back to whatever
  // is on the device rather than blocking forever on a network that is down.
  settled: () => get().status !== 'connecting',
}));
