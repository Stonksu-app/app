import { useState } from 'react';
import TopBar from '../components/TopBar';
import NavRail from '../components/NavRail';
import BottomNav from '../components/BottomNav';
import Icon from '../components/Icon';
import { Link } from 'react-router-dom';
import { Button } from '../components/Button';
import { atLeast, planName } from '../data/plans';
import UltraPromo from '../components/UltraPromo';
import {
  COIN_PRICES,
  MAX_HEARTS,
  MAX_PROTECTORS,
  useUserStore,
} from '../store/useUserStore';

/**
 * The preview redemption rate: 100 USDT per this many coins.
 *
 * Coins come from correct answers (2 each) and chests (50), plus daily and
 * one-off missions (40-200-ish). A genuinely daily player earns somewhere
 * around 100-250 a day, so this sits at roughly 3-4 months of real, sustained
 * engagement — expensive enough that it can't be farmed in a weekend, cheap
 * enough that it's a real target rather than a joke. Revisit before this
 * goes live; it's a starting guess, not a rate anyone has committed to.
 */
const COINS_PER_USDT_REDEMPTION = 20_000;
const USDT_REDEMPTION_AMOUNT = 100;

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
  const { coins, hearts, streakProtectors, plan, buyHeartRefill, buyStreakProtector } = useUserStore();
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

          {/* Above the coin purchases on purpose: this is the one thing here
              that changes how the app behaves rather than topping something
              up, and burying it under two consumables hides it. On Ultra the
              card removes itself and the shop is just the shop. */}
          <UltraPromo className="mt-6" />
          {plan === 'ultra' && (
            <Link
              to="/planes"
              className="mt-6 block rounded-3xl border-2 border-carbon-800 bg-carbon-850 px-5 py-4 hover:border-carbon-700 transition"
            >
              <p className="text-[12px] font-black uppercase tracking-[0.8px] text-ultra-400">
                Tu plan · {planName(plan)}
              </p>
              <p className="mt-1 text-sm text-carbon-400">Gestiona tu suscripción</p>
            </Link>
          )}

          {/* The shop is where coins run out, so it's where earning them
              belongs — the simulator is the only place that pays for a
              decision rather than for effort. */}
          <Link
            to="/simulador"
            className="mt-6 flex items-center gap-4 rounded-3xl border-2 border-carbon-800 bg-carbon-850 p-5 hover:border-carbon-700 transition"
          >
            <span className="w-12 h-12 shrink-0 rounded-2xl bg-lime-500/15 flex items-center justify-center">
              <Icon name="candle" size={26} className="text-lime-500" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[17px] font-black text-carbon-50">Gana monedas operando</span>
              <span className="block text-sm text-carbon-400">
                Long o short con apalancamiento, en un mercado simulado.
              </span>
            </span>
            <Icon name="chevron-left" size={20} className="shrink-0 text-carbon-600 rotate-180" />
          </Link>

          <h2 className="mt-8 text-[13px] font-black text-carbon-400 uppercase tracking-widest">Vidas</h2>
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

          <h2 className="mt-8 text-[13px] font-black text-carbon-400 uppercase tracking-widest">
            Canje de monedas
          </h2>
          <div className="relative overflow-hidden rounded-3xl border-2 border-ultra-500/40 bg-carbon-850 p-5">
            <span className="inline-flex items-center gap-1 rounded-lg bg-ultra-500/15 px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.8px] text-ultra-400">
              <Icon name="diamond" size={13} /> Ultra
            </span>
            <span className="ml-2 inline-block rounded-lg bg-carbon-800 px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.8px] text-carbon-400">
              Próximamente
            </span>

            <h3 className="mt-2.5 text-[17px] font-black text-carbon-50">
              {COINS_PER_USDT_REDEMPTION.toLocaleString('es-ES')} monedas = {USDT_REDEMPTION_AMOUNT} USDT
            </h3>
            <p className="mt-1 text-sm text-carbon-400 leading-snug">
              Con Ultra, tus monedas ganadas jugando podrán canjearse por USDT de verdad a través de
              un bróker de confianza, al llegar a este umbral. Todavía lo estamos preparando —
              cantidades y condiciones pueden cambiar antes de lanzarlo.
            </p>

            <div className="mt-4">
              <div className="flex items-center justify-between text-sm font-black text-carbon-300">
                <span className="flex items-center gap-1.5">
                  <Icon name="coins" size={16} className="text-lime-500" />
                  {coins.toLocaleString('es-ES')}
                </span>
                <span className="text-carbon-500">{COINS_PER_USDT_REDEMPTION.toLocaleString('es-ES')}</span>
              </div>
              <div className="mt-1.5 h-2.5 rounded-full bg-carbon-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-ultra-400 transition-all duration-500"
                  style={{ width: `${Math.min(100, (coins / COINS_PER_USDT_REDEMPTION) * 100)}%` }}
                />
              </div>
            </div>

            {!atLeast(plan, 'ultra') && (
              <Link
                to="/planes"
                className="mt-4 flex h-[46px] items-center justify-center gap-1.5 rounded-xl bg-ultra-400 text-[14px] font-black uppercase tracking-[0.8px] text-carbon-900 transition hover:bg-ultra-300"
                style={{ boxShadow: '0 4px 0 #4c1d95' }}
              >
                <Icon name="diamond" size={17} />
                Consigue Ultra para cuando esté listo
              </Link>
            )}
          </div>

          <p className="mt-8 text-xs text-carbon-500 leading-relaxed">
            Ganas monedas al acertar preguntas y al abrir cofres. No se compran con dinero — la única
            vía es jugar.
          </p>
        </div>
      </div>
    </div>
  );
}
