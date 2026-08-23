import { useEffect } from 'react';
import { ensureHeartsChannel, notificationsSupported, planHeartsNotification } from '../lib/notifications';
import { HEART_REGEN_MINUTES, MAX_HEARTS, useUserStore } from '../store/useUserStore';

/**
 * Keeps the scheduled "your hearts are full" notification in step with the
 * heart bar. Mirrors useStreakReminders: replanning is cheap and idempotent,
 * so it just runs whenever anything that changes the answer changes.
 */
export function useHeartsReminder(): void {
  const enabled = useUserStore((s) => s.heartsReminderEnabled);
  const hearts = useUserStore((s) => s.hearts);
  const lastHeartLostAt = useUserStore((s) => s.lastHeartLostAt);

  useEffect(() => {
    if (!notificationsSupported()) return;

    void (async () => {
      await ensureHeartsChannel();
      await planHeartsNotification({
        enabled,
        hearts,
        maxHearts: MAX_HEARTS,
        lastHeartLostAt,
        regenMinutes: HEART_REGEN_MINUTES,
      });
    })();
  }, [enabled, hearts, lastHeartLostAt]);
}
