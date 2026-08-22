import { Link } from 'react-router-dom';
import Icon from './Icon';
import { showsAds } from '../data/plans';
import { useUserStore } from '../store/useUserStore';

/*
 * What "sin anuncios" is actually removing.
 *
 * Until there's an ad network, this is a house promo for the plans themselves —
 * which is what free apps put in the slot anyway. It matters that it exists
 * rather than being promised: a plan whose headline perk removes something
 * nobody has ever seen is selling nothing, and the day a real ad unit lands it
 * goes here, behind the same one check.
 */

export default function AdSlot({ className = '' }: { className?: string }) {
  const plan = useUserStore((s) => s.plan);
  if (!showsAds(plan)) return null;

  return (
    <Link
      to="/planes"
      className={`block rounded-3xl border-2 border-carbon-800 bg-carbon-850 p-4 hover:border-carbon-700 transition ${className}`}
    >
      <p className="text-[10px] font-black uppercase tracking-[0.8px] text-carbon-600">Anuncio</p>
      <div className="mt-1.5 flex items-center gap-3">
        <div className="w-10 h-10 shrink-0 rounded-xl bg-ultra-500/15 flex items-center justify-center">
          <Icon name="shield" size={22} className="text-ultra-400" />
        </div>
        <div className="min-w-0">
          <p className="text-[15px] font-black text-carbon-50 leading-tight">
            Quita los anuncios con Premium
          </p>
          <p className="text-[13px] text-carbon-400 leading-snug">
            O pásate a Ultra y llévate vidas infinitas y repaso sin límite.
          </p>
        </div>
        <Icon name="chevron-left" size={20} className="ml-auto shrink-0 text-carbon-600 rotate-180" />
      </div>
    </Link>
  );
}
