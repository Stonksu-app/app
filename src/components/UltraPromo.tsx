import { Link } from 'react-router-dom';
import Icon from './Icon';
import Mascot from './Mascot';
import { formatPrice, offerFor, planName, type Plan } from '../data/plans';
import { useUserStore } from '../store/useUserStore';

/*
 * The card that sells Ultra, in the slot Duolingo keeps for Super: the top of
 * the desktop rail, and its own block on a phone.
 *
 * It disappears the moment there's nothing to sell — on Ultra it's gone, and
 * on Premium it becomes the upgrade rather than the pitch, because showing
 * somebody an advert for what they already pay for is how a subscription stops
 * feeling like one.
 */

export default function UltraPromo({ className = '' }: { className?: string }) {
  const plan = useUserStore((s) => s.plan) as Plan;
  if (plan === 'ultra') return null;

  const ultra = offerFor('ultra')!;
  const upgrading = plan === 'premium';

  return (
    <div
      className={`relative overflow-hidden rounded-3xl border-2 border-ultra-500/40 platinum-banner bg-carbon-850 p-5 ${className}`}
    >
      {/* Sits under everything: the mascot is decoration, not a target. */}
      <Mascot
        size={92}
        mood="hype"
        className="pointer-events-none absolute -right-3 -top-1 opacity-90"
      />

      <span className="relative z-10 inline-block rounded-lg bg-ultra-500/15 px-2.5 py-1 text-[12px] font-black uppercase tracking-[0.8px] text-ultra-400">
        Ultra
      </span>

      <h2 className="relative z-10 mt-2.5 max-w-[70%] text-[19px] font-black leading-tight text-carbon-50">
        {upgrading ? `Sube de ${planName(plan)} a Ultra` : 'Sube de nivel con Ultra'}
      </h2>
      <p className="relative z-10 mt-1 max-w-[85%] text-sm text-carbon-400 leading-snug">
        Vidas infinitas, repaso sin límite y sin anuncios. Desde{' '}
        {formatPrice(ultra.price)} al mes.
      </p>

      <Link
        to="/planes"
        className="relative z-10 mt-4 flex h-[46px] items-center justify-center gap-1.5 rounded-xl bg-ultra-400 text-[14px] font-black uppercase tracking-[0.8px] text-carbon-900 transition hover:bg-ultra-300"
        style={{ boxShadow: '0 4px 0 #4c1d95' }}
      >
        <Icon name="diamond" size={17} />
        {upgrading ? 'Pásate a Ultra' : 'Conseguir Ultra'}
      </Link>
    </div>
  );
}
