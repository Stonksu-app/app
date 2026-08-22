import { useState } from 'react';
import TopBar from '../components/TopBar';
import NavRail from '../components/NavRail';
import BottomNav from '../components/BottomNav';
import Icon from '../components/Icon';
import { Button } from '../components/Button';
import {
  COIN_PRICES,
  MAX_HEARTS,
  MAX_PROTECTORS,
  useUserStore,
} from '../store/useUserStore';

/** One purchasable row: art on the left, copy in the middle, action on the right. */
function ShopRow({
  icon,
  iconClass,
  title,
  description,
  tag,
  price,
  ownedLabel,
  owned,
  affordable,
  onBuy,
}: {
  icon: 'heart' | 'shield';
  iconClass: string;
  title: string;
  description: string;
  tag?: string;
  price: number;
  /** Shown when you already have all of this you can hold. */
  ownedLabel: string;
  owned: boolean;
  affordable: boolean;
  onBuy: () => void;
}) {
  return (
    <div className="flex items-center gap-4 py-5 border-b-2 border-carbon-800">
      <div className={`w-16 h-16 shrink-0 rounded-2xl flex items-center justify-center ${iconClass}`}>
        <Icon name={icon} size={34} />
      </div>

      <div className="flex-1 min-w-0">
        <h2 className="text-[19px] font-black text-carbon-50">{title}</h2>
        {tag && (
          <span className="inline-block mt-1 text-[10px] font-black uppercase tracking-wide text-carbon-400 bg-carbon-800 rounded-md px-2 py-0.5">
            {tag}
          </span>
        )}
        <p className="text-sm text-carbon-400 mt-1 leading-snug">{description}</p>
      </div>

      <div className="shrink-0 w-[150px]">
        {/* Owning the maximum and simply not affording it are different states;
            showing "al máximo" for both would misreport why it's unavailable. */}
        <Button onClick={onBuy} disabled={owned || !affordable} variant="secondary" size="sm">
          {owned ? (
            ownedLabel
          ) : (
            <>
              <Icon name="coins" size={15} className={affordable ? 'text-lime-400' : 'text-carbon-500'} />
              {price}
            </>
          )}
        </Button>
        {!owned && !affordable && (
          <p className="mt-1.5 text-[11px] font-bold text-carbon-500 text-center">Te faltan monedas</p>
        )}
      </div>
    </div>
  );
}

export default function Shop() {
  const { coins, hearts, streakProtectors, buyHeartRefill, buyStreakProtector } = useUserStore();
  const [flash, setFlash] = useState<string | null>(null);

  const announce = (msg: string) => {
    setFlash(msg);
    setTimeout(() => setFlash(null), 1800);
  };

  const heartsFull = hearts >= MAX_HEARTS;
  const protectorsFull = streakProtectors >= MAX_PROTECTORS;

  return (
    <div className="min-h-dvh bg-carbon-900 lg:flex">
      <NavRail />
      <BottomNav />

      <div className="flex-1 min-w-0">
          <TopBar />

        <div className="max-w-2xl mx-auto px-4 py-6 pb-32 lg:pb-6">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-2xl font-black text-carbon-50">Tienda</h1>
            <span className="flex items-center gap-1.5 font-black text-carbon-50 bg-carbon-850 border-2 border-carbon-800 rounded-xl px-3 py-1.5">
              <Icon name="coins" size={18} className="text-lime-500" />
              {coins}
            </span>
          </div>

          {flash && (
            <p className="mt-4 text-sm font-black text-lime-400 bg-lime-500/10 border-2 border-lime-500/30 rounded-xl px-4 py-3 animate-pop-in">
              {flash}
            </p>
          )}

          <h2 className="mt-6 text-[13px] font-black text-carbon-400 uppercase tracking-widest">Vidas</h2>
          <ShopRow
            icon="heart"
            iconClass="bg-danger-500/15 text-danger-400"
            title="Recupera tus vidas"
            description="Recarga tu set de vidas y sigue aprendiendo sin esperar."
            price={COIN_PRICES.heartRefill}
            ownedLabel="Completo"
            owned={heartsFull}
            affordable={coins >= COIN_PRICES.heartRefill}
            onBuy={() => {
              if (buyHeartRefill()) announce('¡Vidas recargadas!');
            }}
          />

          <h2 className="mt-8 text-[13px] font-black text-carbon-400 uppercase tracking-widest">Potenciadores</h2>
          <ShopRow
            icon="shield"
            iconClass="bg-lime-500/15 text-lime-400"
            title="Protector de racha"
            description="Mantiene tu racha un día que no entres. Se gasta solo cuando hace falta."
            tag={`${streakProtectors} / ${MAX_PROTECTORS} equipados`}
            price={COIN_PRICES.streakProtector}
            ownedLabel="Al máximo"
            owned={protectorsFull}
            affordable={coins >= COIN_PRICES.streakProtector}
            onBuy={() => {
              if (buyStreakProtector()) announce('¡Protector de racha equipado!');
            }}
          />

          <p className="mt-8 text-xs text-carbon-500 leading-relaxed">
            Ganas monedas al acertar preguntas y al abrir cofres. Las monedas son solo de la app: no
            tienen ningún valor real ni se compran con dinero.
          </p>
        </div>
      </div>
    </div>
  );
}
