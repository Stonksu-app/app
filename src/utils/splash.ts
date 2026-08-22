/*
 * How long the splash should live.
 *
 * Pulled out of the component so it can be tested: the timing is the whole
 * point of the screen, and it's the one thing you can't check by looking at a
 * screenshot.
 */

/** First launch on this device: an introduction, with time to read the tip. */
export const COLD_MS = 5000;
/** A launch soon after the last one: long enough not to flash, short enough
 *  not to be a toll on a door you already know. */
export const WARM_MS = 900;
export const FADE_MS = 400;

/** How long a boot still counts as warm — a day's use and the app being killed
 *  in the background, but not so long that tomorrow skips the opening. */
export const WARM_FOR_MS = 12 * 60 * 60 * 1000;

export const LAST_BOOT_KEY = 'stonksu-last-boot';

/**
 * @param lastBoot when the app last finished booting, or null if never
 * @param now      current epoch ms
 */
export function splashDuration(lastBoot: number | null, now: number): number {
  if (lastBoot === null || !Number.isFinite(lastBoot)) return COLD_MS;
  // A clock that jumped backwards (timezone change, a device with a bad
  // clock) leaves a "future" timestamp. Treating that as warm would be a
  // guess; treating it as cold just shows the proper opening once.
  const elapsed = now - lastBoot;
  if (elapsed < 0) return COLD_MS;
  return elapsed < WARM_FOR_MS ? WARM_MS : COLD_MS;
}
