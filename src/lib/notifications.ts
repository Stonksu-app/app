import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

/**
 * Streak reminders.
 *
 * Deliberately LOCAL notifications, not push. A daily "you haven't practised"
 * needs no server and no network, and — the part that decides it — a free Apple
 * ID cannot carry the aps-environment entitlement, so a sideloaded build simply
 * cannot receive remote push. Local ones have no such restriction and work on
 * both platforms today.
 *
 * Rather than one repeating daily notification, the next several days are
 * scheduled individually. A repeating one cannot skip an occurrence, so it
 * would nag on the very days you did practise; separate ones can be replanned
 * the moment a lesson finishes.
 */

const CHANNEL_ID = 'streak';
/** Ids are fixed and derived from the day offset, so replanning overwrites
 *  rather than piling up duplicates. */
const ID_BASE = 4200;

/**
 * How far ahead reminders are laid down.
 *
 * Once scheduled, the operating system owns them: they fire with the app
 * closed, backgrounded, or even force-quit, with no network involved. But the
 * queue is only topped up when the app is opened, so this number is also how
 * long someone can stay away and still be reminded — which is exactly the
 * person the reminder is for. iOS keeps at most 64 pending notifications per
 * app, so a month fits comfortably.
 */
const DAYS_AHEAD = 30;

export const DEFAULT_REMINDER_HOUR = 20;

const MESSAGES = [
  { title: '¿Y tu racha?', body: 'Cinco minutos y la salvas. El toro te espera.' },
  { title: 'Tu racha está en peligro', body: 'Una lección corta y sigues vivo.' },
  { title: 'El mercado no cierra', body: 'Ni tu racha, si entras ahora.' },
  { title: 'No la rompas hoy', body: 'Llevas demasiado como para dejarlo aquí.' },
];

/** Local notifications are a native capability; on the web this is all inert. */
export function notificationsSupported(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Asks for permission, returning whether it was granted.
 *
 * iOS only ever shows the system prompt once, so this must be called from a
 * deliberate action — a toggle the player flipped — and never on launch, or the
 * one chance is spent before they know what it's for.
 */
export async function requestPermission(): Promise<boolean> {
  if (!notificationsSupported()) return false;
  const { display } = await LocalNotifications.requestPermissions();
  return display === 'granted';
}

export async function hasPermission(): Promise<boolean> {
  if (!notificationsSupported()) return false;
  const { display } = await LocalNotifications.checkPermissions();
  return display === 'granted';
}

/** Local midnight for a day N days from now, avoiding UTC drift. */
function dayAt(offset: number, hour: number): Date {
  const at = new Date();
  at.setDate(at.getDate() + offset);
  at.setHours(hour, 0, 0, 0);
  return at;
}

/**
 * Replans the reminders.
 *
 * Idempotent: it clears what it scheduled before and lays the next week down
 * again, so it can be called on launch, after a lesson, or when the setting
 * changes, without accumulating anything.
 *
 * @param practisedToday skips today's reminder — the streak is already safe.
 */
export async function planStreakReminders(options: {
  enabled: boolean;
  hour: number;
  practisedToday: boolean;
}): Promise<void> {
  if (!notificationsSupported()) return;

  const ids = Array.from({ length: DAYS_AHEAD }, (_, i) => ({ id: ID_BASE + i }));
  try {
    await LocalNotifications.cancel({ notifications: ids });
  } catch {
    // Nothing was scheduled yet. Not worth reporting.
  }

  if (!options.enabled || !(await hasPermission())) return;

  const now = Date.now();
  const notifications = [];

  for (let offset = 0; offset < DAYS_AHEAD; offset++) {
    const at = dayAt(offset, options.hour);
    // Today's is pointless once the streak is safe, and a time already past
    // today would fire immediately.
    if (offset === 0 && (options.practisedToday || at.getTime() <= now)) continue;

    const message = MESSAGES[offset % MESSAGES.length];
    notifications.push({
      id: ID_BASE + offset,
      title: message.title,
      body: message.body,
      schedule: { at, allowWhileIdle: true },
      channelId: CHANNEL_ID,
      smallIcon: 'ic_stat_icon_config_sample',
    });
  }

  if (notifications.length) await LocalNotifications.schedule({ notifications });
}

/**
 * Android needs a channel to exist before anything can be delivered to it.
 * A no-op on iOS, which has no equivalent concept.
 */
export async function ensureChannel(): Promise<void> {
  if (Capacitor.getPlatform() !== 'android') return;
  await LocalNotifications.createChannel({
    id: CHANNEL_ID,
    name: 'Racha',
    description: 'Avisos para que no pierdas la racha',
    importance: 4,
  });
}
