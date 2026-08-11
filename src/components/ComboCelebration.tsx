import Icon from './Icon';
import StreakRays from './StreakRays';

interface TierConfig {
  title: string;
  sub: string;
  titleSize: string;
  boxPadding: string;
  boxBg: string;
  boxText: string;
  ring: string;
  glow: string;
}

const TIERS: Record<1 | 2 | 3, TierConfig> = {
  1: {
    title: '¡Racha alcista x3!',
    sub: 'Long streak activado',
    titleSize: 'text-xl',
    boxPadding: 'px-5 py-3',
    boxBg: 'bg-lime-500',
    boxText: 'text-carbon-900',
    ring: '',
    glow: 'shadow-lime-500/40',
  },
  2: {
    title: '¡Bull run x6!',
    sub: 'Estás en tendencia',
    titleSize: 'text-2xl',
    boxPadding: 'px-6 py-4',
    boxBg: 'bg-[#FFC93C]',
    boxText: 'text-carbon-900',
    ring: 'ring-4 ring-[#FFE29A]/70',
    glow: 'shadow-[#FFC93C]/50',
  },
  3: {
    title: '¡TO THE MOON x9!',
    sub: 'Modo diamond hands activado',
    titleSize: 'text-3xl',
    boxPadding: 'px-8 py-5',
    boxBg: 'bg-white',
    boxText: 'text-carbon-900',
    ring: 'ring-4 ring-lime-300/80',
    glow: 'shadow-white/50',
  },
};

export default function ComboCelebration({ tier }: { tier: 1 | 2 | 3 }) {
  const cfg = TIERS[tier];

  return (
    <div className="fixed inset-0 z-[60] pointer-events-none flex items-start justify-center pt-24 sm:pt-28">
      <div className="relative">
        <StreakRays tier={tier} />
        <div
          className={`relative font-black rounded-2xl text-center shadow-2xl animate-combo-in ${cfg.boxPadding} ${cfg.boxBg} ${cfg.boxText} ${cfg.ring} ${cfg.glow}`}
        >
          <div className="flex items-center justify-center gap-2">
            <Icon name="trending-up" size={tier === 3 ? 30 : 22} />
            <p className={cfg.titleSize}>{cfg.title}</p>
          </div>
          <p className="text-xs sm:text-sm font-bold opacity-75 mt-1">{cfg.sub}</p>
        </div>
      </div>
    </div>
  );
}
