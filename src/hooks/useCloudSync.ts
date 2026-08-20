import { useEffect, useRef } from 'react';
import { isCloudEnabled, supabase } from '../lib/supabase';
import { ensureSession, hasProgress, pullState, pushState, restartSession, type CloudState } from '../lib/cloud';
import { suffixName } from '../lib/names';
import { useUserStore } from '../store/useUserStore';
import { useSyncStore } from '../store/useSyncStore';

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

export function useCloudSync(): void {
  const setStatus = useSyncStore((s) => s.setStatus);
  const setUserId = useSyncStore((s) => s.setUserId);
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
      void save(userId.current);
    };

    /**
     * Pushes, and recovers from the one race the availability check can't close:
     * two players confirming the same nickname in the same instant. Without this
     * the loser's every future push fails on the same unique violation, so their
     * progress silently stops syncing over a name.
     *
     * `applying` is held throughout so renaming doesn't schedule another push
     * and spin.
     */
    const save = async (id: string) => {
      const result = await pushState(id, snapshot());

      // The account behind this session is gone. Rather than keep failing
      // silently — which also leaves a "registered" token telling the rest of
      // the app not to ask anyone to sign up — take a fresh anonymous one and
      // put this device's progress on it.
      if (result === 'no-account') {
        const fresh = await restartSession();
        if (!fresh) return;
        userId.current = fresh;
        setUserId(fresh);
        await pushState(fresh, snapshot());
        return;
      }

      if (result !== 'name-taken') return;

      applying.current = true;
      try {
        const wanted = useUserStore.getState().name;
        for (let attempt = 1; attempt <= 3; attempt++) {
          useUserStore.setState({ name: suffixName(wanted, attempt) });
          if ((await pushState(id, snapshot())) === 'ok') {
            console.warn(`[cloud] "${wanted}" was taken; you are now "${useUserStore.getState().name}"`);
            return;
          }
        }
        useUserStore.setState({ name: wanted });
        console.warn('[cloud] could not find a free variant of the nickname; not syncing');
      } finally {
        applying.current = false;
      }
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
    // Guards the auth-change listener below from acting on the very session
    // the initial resolution is still busy settling.
    let initialised = false;

    /** Pulls and adopts whichever account `id` belongs to. Used both for the
     *  session found at mount and for one that arrives afterwards. */
    const adoptSession = async (id: string) => {
      userId.current = id;
      setUserId(id);

      const remote = await pullState(id);
      if (cancelled) return;

      if (remote.status === 'error') {
        // Nothing is known about what is up there, so nothing may be written
        // over it. Seeding from this device on a failed read is how a real
        // profile gets replaced by an empty one — worst of all right after
        // clearing site data, when this device holds nothing.
        setStatus('error');
        return;
      }

      if (remote.status === 'found' && hasProgress(remote.state)) {
        // The cloud is the record of a player who has already done something,
        // so it wins over whatever this device happens to hold.
        applying.current = true;
        useUserStore.setState(remote.state);
        applying.current = false;
      } else {
        // Genuinely empty account. Anything already on this device — progress
        // from before the backend existed — goes up rather than being thrown
        // away.
        await save(id);
      }
      if (cancelled) return;

      setStatus('ready');
    };

    (async () => {
      const id = await ensureSession();
      if (cancelled) return;
      if (!id) {
        setStatus('error');
        return;
      }
      await adoptSession(id);
      initialised = true;
      if (cancelled) return;

      unsubscribe = useUserStore.subscribe(schedulePush);
      document.addEventListener('visibilitychange', onHide);
      window.addEventListener('pagehide', flush);
    })();

    // Catches a sign-in that lands *after* the block above already resolved
    // a session — the native OAuth round trip: the app opens with an
    // anonymous session, that pull finishes, and only then does the deep
    // link come back with an existing, already-registered account. Without
    // this the profile that was just pulled (empty, "not onboarded") is the
    // one left standing, so the player is sent to onboarding despite already
    // having a finished profile — until the app is restarted and getSession()
    // picks the real session up from scratch.
    let authSubscription: { unsubscribe: () => void } | undefined;
    if (supabase) {
      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        if (!initialised) return; // still settling the session found at mount
        const newId = session?.user.id ?? null;
        if (!newId || newId === userId.current) return;
        // Push whatever this device holds under the outgoing account first,
        // then switch and pull the incoming one's real profile.
        flush();
        void adoptSession(newId);
      });
      authSubscription = data.subscription;
    }

    return () => {
      cancelled = true;
      unsubscribe?.();
      authSubscription?.unsubscribe();
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', flush);
      if (timer) clearTimeout(timer);
    };
  }, []);

}
