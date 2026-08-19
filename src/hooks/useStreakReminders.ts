import { useEffect } from 'react';
import { ensureChannel, notificationsSupported, planStreakReminders } from '../lib/notifications';
import { useUserStore } from '../store/useUserStore';

/**
 * Keeps the scheduled streak reminders in step with the state they describe.
 *
 * Replanning is cheap and idempotent, so it simply runs whenever anything that
 * changes the answer changes: the setting, the hour, or the last day played.
 * That last one is what silences today's reminder the moment a lesson ends.
 */
export function useStreakReminders(): void {
  const enabled = useUserStore((s) => s.reminderEnabled);
  const hour = useUserStore((s) => s.reminderHour);
  const lastActiveDate = useUserStore((s) => s.lastActiveDate);

  useEffect(() => {
    if (!notificationsSupported()) return;

    void (async () => {
      await ensureChannel();
      await planStreakReminders({
        enabled,
        hour,
        // Derived exactly as the store derives lastActiveDate, in UTC. Mixing
        // a local day key with a UTC one here would make the two disagree for
        // an hour or two around midnight and silence — or repeat — a reminder
        // on the wrong day. Matching the store is what matters, not which
        // clock is philosophically right.
        practisedToday: lastActiveDate === new Date().toISOString().slice(0, 10),
      });
    })();
  }, [enabled, hour, lastActiveDate]);
}
