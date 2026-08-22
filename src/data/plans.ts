import type { IconName } from '../types';

/*
 * The two paid plans, and every rule that depends on them.
 *
 * Kept in one file on purpose: what a plan costs, what it promises on the
 * pricing page, and what the code actually enforces have to be the same thing.
 * When those live apart, the page ends up advertising a perk nothing checks —
 * which is the version of this that gets you refund requests.
 */

export type Plan = 'free' | 'premium' | 'ultra';

/** Ranked so checks read as "at least this plan" rather than listing names. */
const RANK: Record<Plan, number> = { free: 0, premium: 1, ultra: 2 };

export function atLeast(plan: Plan, needed: Plan): boolean {
  return RANK[plan] >= RANK[needed];
}

/** Free rounds of guide practice per day. Ultra lifts the limit entirely. */
export const FREE_PRACTICE_PER_DAY = 1;

// ------------------------------------------------------------ the rules
/** House promos only ever appear on free accounts — that's what's being sold. */
export const showsAds = (plan: Plan) => plan === 'free';
/** Ultra never loses a heart. */
export const hasUnlimitedHearts = (plan: Plan) => atLeast(plan, 'ultra');
/** Ultra practises as much as it likes; everyone else gets a daily taste. */
export const hasUnlimitedPractice = (plan: Plan) => atLeast(plan, 'ultra');
/** Cosmetics that would otherwise have to be earned from missions. */
export const hasAllAccessories = (plan: Plan) => atLeast(plan, 'ultra');
/**
 * Topics marked `ultra` on the skill tree.
 *
 * No topic carries the flag yet — the course is free end to end. The check
 * exists so marking one is a one-word change rather than a feature.
 */
export const canPlayUltraLessons = (plan: Plan) => atLeast(plan, 'ultra');

export interface PlanOffer {
  id: Exclude<Plan, 'free'>;
  name: string;
  /** Monthly price in euros. Changing it here changes every screen. */
  price: number;
  tagline: string;
  perks: { icon: IconName; text: string }[];
  /** Whether to present it as the one to pick. */
  featured: boolean;
  /** The plan's colour, in one place. Ultra wears the platinum blue it gives
   *  you; Premium wears the app's lime, because it's the plain plan. */
  accent: 'ultra' | 'lime';
  /** The chip above the name. Both plans get one — a card with a label next
   *  to one without reads as unfinished rather than as less prominent. */
  label: string;
}

export const PLAN_OFFERS: PlanOffer[] = [
  {
    id: 'ultra',
    name: 'Ultra',
    price: 6.99,
    tagline: 'Todo lo de Stonksu, sin límites y sin anuncios.',
    accent: 'ultra',
    label: 'El más completo',
    perks: [
      { icon: 'heart', text: 'Vidas infinitas: falla sin quedarte fuera' },
      { icon: 'cards', text: 'Repaso de la guía ilimitado' },
      { icon: 'book', text: 'Lecciones exclusivas de Ultra' },
      { icon: 'sparkles', text: 'Accesorios exclusivos para tu avatar' },
      { icon: 'shield', text: 'Sin anuncios' },
    ],
    featured: true,
  },
  {
    id: 'premium',
    name: 'Premium',
    price: 2.99,
    tagline: 'La app limpia, sin nada más.',
    accent: 'lime',
    label: 'Lo esencial',
    perks: [{ icon: 'shield', text: 'Sin anuncios' }],
    featured: false,
  },
];

export function offerFor(plan: Plan): PlanOffer | null {
  return PLAN_OFFERS.find((o) => o.id === plan) ?? null;
}

export function planName(plan: Plan): string {
  return offerFor(plan)?.name ?? 'Gratis';
}

/** Prices are stored as numbers so they can be compared; shown as euros. */
export function formatPrice(price: number): string {
  return `${price.toFixed(2).replace('.', ',')} €`;
}
