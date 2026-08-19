import { useEffect, useRef, useState } from 'react';
import { isCloudEnabled } from '../lib/supabase';
import { ensureSession, hasProgress, pullState, pushState, type CloudState } from '../lib/cloud';
import { useUserStore } from '../store/useUserStore';

/**
 * Keeps the local game state and the Supabase profile in step.
 *
 * Local-first on purpose. A lesson changes state on almost every tap — a heart
 * here, XP there — and waiting on the network for each one would make the game
 * feel broken and stop working on a train. So localStorage stays the thing the
 * UI reads, and the cloud is a debounced mirror of it. The cost is that the
 * last edit before a hard crash can be lost, which for a single-player game is
 * a fair trade.
 *
 * Two devices editing at once resolve last-write-wins. That is honest for what
 * this is; proper merging would need per-field timestamps and isn't worth it
 * until people actually play on a phone and a laptop in the same minute.
 */

export type SyncStatus = 'off' | 'connecting' | 'ready' | 'error';

const DEBOUNCE_MS = 2000;

/** The cloud-bound slice, pulled out of the full store state. */
function snapshot(): CloudState {
  const s = useUserStore.getState();
  return {
    name: s.name,
    onboarded: s.onboarded,
    onboardingAnswers: s.onboardingAnswers,
    xp: s.xp,
    coins: s.coins,
    hearts: s.hearts,
    lastHeartLostAt: s.lastHeartLostAt,
    streak: s.streak,
    lastActiveDate: s.lastActiveDate,
    streakProtectors: s.streakProtectors,
    completedLessonIds: s.completedLessonIds,
    unlockedBadgeIds: s.unlockedBadgeIds,
    seenIntroNodeIds: s.seenIntroNodeIds,
    openedChestIds: s.openedChestIds,
    claimedMissionIds: s.claimedMissionIds,
    unlockedAccessories: s.unlockedAccessories,
    pendingMistakes: s.pendingMistakes,
    nodeStageProgress: s.nodeStageProgress,
    avatar: s.avatar,
    virtualBalance: s.virtualBalance,
    attempts: s.attempts,
  };
}

export function useCloudSync(): SyncStatus {
  const [status, setStatus] = useState<SyncStatus>(isCloudEnabled ? 'connecting' : 'off');
  // Set while a pull is being written into the store, so the subscription it
  // triggers doesn't immediately push the same data straight back up.
  const applying = useRef(false);
  const userId = useRef<string | null>(null);

  useEffect(() => {
    if (!isCloudEnabled) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const flush = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      if (!userId.current) return;
      void pushState(userId.current, snapshot());
    };

    const schedulePush = () => {
      if (applying.current || !userId.current) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(flush, DEBOUNCE_MS);
    };

    const onHide = () => {
      // Closing the tab or backgrounding the app would otherwise drop whatever
      // happened in the last couple of seconds.
      if (document.visibilityState === 'hidden') flush();
    };

    let unsubscribe: (() => void) | undefined;

    (async () => {
      const id = await ensureSession();
      if (cancelled) return;
      if (!id) {
        setStatus('error');
        return;
      }
      userId.current = id;

      const remote = await pullState(id);
      if (cancelled) return;

      if (remote && hasProgress(remote)) {
        // The cloud is the record of a player who has already done something,
        // so it wins over whatever this device happens to hold.
        applying.current = true;
        useUserStore.setState(remote);
        applying.current = false;
      } else {
        // Fresh account. Anything already on this device — progress from before
        // the backend existed — goes up rather than being thrown away.
        await pushState(id, snapshot());
      }
      if (cancelled) return;

      setStatus('ready');
      unsubscribe = useUserStore.subscribe(schedulePush);
      document.addEventListener('visibilitychange', onHide);
      window.addEventListener('pagehide', flush);
    })();

    return () => {
      cancelled = true;
      unsubscribe?.();
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', flush);
      if (timer) clearTimeout(timer);
    };
  }, []);

  return status;
}
