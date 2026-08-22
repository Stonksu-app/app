import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import TopBar from '../components/TopBar';
import NavRail from '../components/NavRail';
import BottomNav from '../components/BottomNav';
import Icon from '../components/Icon';
import Mascot from '../components/Mascot';
import { Button } from '../components/Button';
import { PLAN_OFFERS, formatPrice, planName, type PlanOffer } from '../data/plans';
import { useUserStore } from '../store/useUserStore';

/*
 * The two plans, side by side.
 *
 * Nothing here takes money: there is no payment provider wired up, and a
 * screen that collected card details into nowhere would be a lie told to
 * somebody's wallet. So the button says what's actually true — the plans
 * aren't on sale yet — and in test mode it switches the plan locally so every
 * perk behind it can be exercised before a single euro is involved.
 */

function PlanCard({
  offer,
  current,
  onChoose,
}: {
  offer: PlanOffer;
  current: boolean;
  onChoose: () => void;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-3xl border-2 p-6 ${
        offer.featured ? 'platinum-banner border-sky-500/40 bg-carbon-850' : 'border-carbon-800 bg-carbon-850'
      }`}
    >
      <span
        className={`inline-block rounded-lg px-2.5 py-1 text-[12px] font-black uppercase tracking-[0.8px] ${
          offer.accent === 'sky' ? 'bg-sky-500/15 text-sky-400' : 'bg-lime-500/15 text-lime-400'
        }`}
      >
        {offer.label}
      </span>

      <div className="mt-3 flex items-baseline gap-2">
        <h2 className="text-2xl font-black text-carbon-50">Stonksu {offer.name}</h2>
      </div>
      <p className="mt-1 text-sm text-carbon-400">{offer.tagline}</p>

      <p className="mt-4 text-3xl font-black text-carbon-50 tabular-nums">
        {formatPrice(offer.price)}
        <span className="text-sm font-bold text-carbon-500"> /mes</span>
      </p>

      <ul className="mt-5 space-y-2.5">
        {offer.perks.map((perk) => (
          <li key={perk.text} className="flex items-start gap-2.5">
            <Icon
              name={perk.icon}
              size={18}
              className={`mt-0.5 shrink-0 ${offer.accent === 'sky' ? 'text-sky-400' : 'text-lime-500'}`}
            />
            <span className="text-sm font-bold text-carbon-200 leading-snug">{perk.text}</span>
          </li>
        ))}
      </ul>

      <div className="mt-6">
        {current ? (
          <p
            className={`flex items-center justify-center gap-2 h-[50px] rounded-xl text-sm font-black uppercase tracking-wide ${
              offer.accent === 'sky'
                ? 'bg-sky-500/15 text-sky-400'
                : 'bg-lime-500/15 text-lime-400'
            }`}
          >
            <Icon name="check" size={18} strokeWidth={3} /> Tu plan actual
          </p>
        ) : (
          <Button variant={offer.accent === 'sky' ? 'platinum' : 'primary'} onClick={onChoose}>
            Elegir {offer.name}
          </Button>
        )}
      </div>
    </div>
  );
}

export default function Premium() {
  const navigate = useNavigate();
  const { plan, testMode, setPlan } = useUserStore();
  const [notice, setNotice] = useState<string | null>(null);

  const choose = (offer: PlanOffer) => {
    if (testMode) {
      setPlan(offer.id);
      setNotice(`Modo test: ${offer.name} activado sin pagar nada.`);
      return;
    }
    setNotice(
      'Los pagos todavía no están conectados. En cuanto lo estén, este botón abrirá la pasarela.'
    );
  };

  return (
    <div className="min-h-dvh bg-carbon-900 lg:flex">
      <NavRail />
      <BottomNav />

      <div className="flex-1 min-w-0">
        <TopBar />

        <div className="max-w-2xl mx-auto px-4 py-6 pb-32 lg:pb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              aria-label="Volver"
              className="text-carbon-500 hover:text-carbon-200 transition p-1 -ml-1"
            >
              <Icon name="chevron-left" size={24} strokeWidth={2.4} />
            </button>
            <h1 className="text-2xl font-black text-carbon-50">Planes</h1>
          </div>

          <div className="mt-4 flex items-center gap-4 rounded-3xl border-2 border-carbon-800 bg-carbon-850 p-5">
            <Mascot size={56} mood="hype" />
            <div className="min-w-0">
              <p className="text-[13px] font-black uppercase tracking-[0.8px] text-carbon-500">
                Tu plan
              </p>
              <p className="text-xl font-black text-carbon-50">{planName(plan)}</p>
            </div>
            {plan !== 'free' && (
              <button
                onClick={() => {
                  setPlan('free');
                  setNotice('Has vuelto al plan gratuito.');
                }}
                className="ml-auto shrink-0 text-[13px] font-black uppercase tracking-wide text-carbon-500 hover:text-carbon-300 transition"
              >
                Cancelar
              </button>
            )}
          </div>

          {notice && (
            <p className="mt-4 rounded-2xl border-2 border-sky-500/30 bg-sky-500/10 px-4 py-3 text-sm font-bold text-sky-300 animate-pop-in">
              {notice}
            </p>
          )}

          <div className="mt-5 space-y-4">
            {PLAN_OFFERS.map((offer) => (
              <PlanCard
                key={offer.id}
                offer={offer}
                current={plan === offer.id}
                onChoose={() => choose(offer)}
              />
            ))}
          </div>

          <p className="mt-6 text-[13px] text-carbon-500 leading-snug">
            Los precios son mensuales e incluyen impuestos. Puedes cancelar cuando quieras y
            mantienes el plan hasta que termine el mes pagado.
          </p>
        </div>
      </div>
    </div>
  );
}
