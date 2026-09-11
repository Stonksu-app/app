import Icon from './Icon';
import { planName, type Plan } from '../data/plans';

/*
 * The mark a paying player wears next to their name.
 *
 * The point of it is social, not decorative: somebody has to be visibly
 * getting something, or a subscription is a private transaction nobody else
 * has a reason to care about. Ultra takes the platinum treatment it pays for;
 * Premium gets the app's green, quieter, because it buys less.
 *
 * Free accounts render nothing at all — an absence, not a "Gratis" label. A
 * badge saying you haven't paid is a worse thing to put beside a name than no
 * badge at all.
 */

export default function PlanBadge({ plan, size = 'md' }: { plan: Plan; size?: 'sm' | 'md' }) {
  if (plan === 'free') return null;

  const small = size === 'sm';
  const ultra = plan === 'ultra';

  return (
    <span
      className={`relative inline-flex shrink-0 items-center gap-1 rounded-lg font-black uppercase tracking-[0.6px] ${
        small ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-[11px]'
      } ${ultra ? 'platinum-node text-white' : 'bg-lime-500/15 text-lime-400'}`}
      title={`Stonksu ${planName(plan)}`}
    >
      <Icon
        name={ultra ? 'diamond' : 'shield'}
        size={small ? 11 : 13}
        className="relative z-10"
      />
      <span className="relative z-10">{planName(plan)}</span>
    </span>
  );
}
