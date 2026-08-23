import type { IconName } from '../types';

/** Shared by the desktop rail and the phone's bottom bar so the two can never
 *  drift apart. Only real destinations belong here. */
export const NAV_ITEMS: { to: string; label: string; icon: IconName }[] = [
  { to: '/home', label: 'Aprender', icon: 'map' },
  { to: '/guia', label: 'Guía', icon: 'book' },
  { to: '/misiones', label: 'Misiones', icon: 'trophy' },
  { to: '/tienda', label: 'Tienda', icon: 'coins' },
  { to: '/profile', label: 'Perfil', icon: 'user' },
];
