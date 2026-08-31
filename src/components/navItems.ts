import type { IconName } from '../types';

/**
 * Shared by the desktop rail and the phone's bottom bar so the two can never
 * drift apart. Only real destinations belong here.
 *
 * `also` lists the other routes a tab owns. Missions and the league were two
 * tabs of six, which on a phone leaves each one about sixty pixels wide and
 * makes the bar read as a list rather than a set of places. They're one
 * destination now — both are "how am I doing against a target this week" —
 * with tabs inside; the bar stays lit while you're on either.
 */
export const NAV_ITEMS: { to: string; label: string; icon: IconName; also?: string[] }[] = [
  { to: '/home', label: 'Aprender', icon: 'map' },
  { to: '/guia', label: 'Guía', icon: 'book' },
  { to: '/misiones', label: 'Retos', icon: 'trophy', also: ['/liga'] },
  { to: '/tienda', label: 'Tienda', icon: 'coins' },
  { to: '/profile', label: 'Perfil', icon: 'user' },
];

/** True when `pathname` belongs to this tab, including the routes it owns. */
export function navItemIsActive(
  item: { to: string; also?: string[] },
  pathname: string
): boolean {
  return pathname === item.to || (item.also?.includes(pathname) ?? false);
}
