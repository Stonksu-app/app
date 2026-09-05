import type { IconName } from '../types';

/**
 * Shared by the desktop rail and the phone's bottom bar so the two can never
 * drift apart. Only real destinations belong here.
 *
 * Five phone destinations keep touch targets comfortable. The simulator owns
 * the centre; the shop remains in the desktop rail and the profile shortcuts.
 * `also` lists the other routes a tab owns.
 */
export const NAV_ITEMS: { to: string; label: string; icon: IconName; also?: string[]; featured?: boolean; desktopOnly?: boolean }[] = [
  { to: '/home', label: 'Aprender', icon: 'map' },
  { to: '/guia', label: 'Guía', icon: 'book' },
  { to: '/simulador', label: 'Simulador', icon: 'candle', featured: true },
  { to: '/misiones', label: 'Retos', icon: 'trophy', also: ['/liga'] },
  { to: '/tienda', label: 'Tienda', icon: 'coins', desktopOnly: true },
  { to: '/profile', label: 'Perfil', icon: 'user' },
];

/** True when `pathname` belongs to this tab, including the routes it owns. */
export function navItemIsActive(
  item: { to: string; also?: string[] },
  pathname: string
): boolean {
  return pathname === item.to || (item.also?.includes(pathname) ?? false);
}
