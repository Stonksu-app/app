import type { ComponentType } from 'react';
import { AppleMark, GoogleMark } from '../components/ProviderMarks';

/**
 * The external accounts you can sign in with.
 *
 * One list drives both the sign-up prompt and the sign-in page, so adding a
 * provider is an entry here rather than a button copy-pasted into two files
 * that then drift apart.
 *
 * `enabled` describes what is actually configured in Supabase, not what the
 * code can do — every one of these already works the moment its provider is
 * switched on. A button for a provider that isn't set up just fails with
 * "provider is not enabled", which is a worse experience than not offering it.
 */

export type ProviderId = 'google' | 'apple';

export interface Provider {
  id: ProviderId;
  label: string;
  enabled: boolean;
  Mark: ComponentType;
  /** Button background and the 4px lip beneath it. Each provider's own colour,
   *  because a wall of identical lime buttons is unreadable at a glance. */
  background: string;
  lip: string;
  text: string;
  /** Why it is off, for the setup notes. Not shown to players. */
  note?: string;
}

export const PROVIDERS: Provider[] = [
  {
    id: 'google',
    label: 'Google',
    enabled: true,
    Mark: GoogleMark,
    background: '#ffffff',
    lip: '#b8b8b8',
    text: '#171717',
  },
  {
    id: 'apple',
    label: 'Apple',
    enabled: false,
    Mark: AppleMark,
    background: '#f5f5f5',
    lip: '#b8b8b8',
    text: '#0a0a0a',
    note: 'Exige el Apple Developer Program, 99 €/año. Obligatorio en la App Store si ofreces Google.',
  },
];

export const ACTIVE_PROVIDERS = PROVIDERS.filter((p) => p.enabled);
