import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import TopBar from '../components/TopBar';
import NavRail from '../components/NavRail';
import BottomNav from '../components/BottomNav';
import Icon from '../components/Icon';
import Mascot from '../components/Mascot';
import { Button } from '../components/Button';
import ConfirmModal from '../components/ConfirmModal';
import { Capacitor } from '@capacitor/core';
import { PLAN_OFFERS, formatPrice, planName, type PlanOffer } from '../data/plans';
import { isTestingBackend, supabase } from '../lib/supabase';
import { checkoutUrl, portalUrl, webBillingEnabled } from '../lib/billing';
import { useAuthStore } from '../store/useAuthStore';
import { useUserStore } from '../store/useUserStore';

/*
 * The two plans, side by side.
 *
 * Stripe Checkout handles real payment methods when web billing is configured.
 * Without it, dev/test keeps the no-charge preview.
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
        offer.featured ? 'platinum-banner border-ultra-500/40 bg-carbon-850' : 'border-carbon-800 bg-carbon-850'
      }`}
    >
      <span
        className={`inline-block rounded-lg px-2.5 py-1 text-[12px] font-black uppercase tracking-[0.8px] ${
          offer.accent === 'ultra' ? 'bg-ultra-500/15 text-ultra-400' : 'bg-lime-500/15 text-lime-400'
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
              className={`mt-0.5 shrink-0 ${offer.accent === 'ultra' ? 'text-ultra-400' : 'text-lime-500'}`}
            />
            <span className="text-sm font-bold text-carbon-200 leading-snug">{perk.text}</span>
          </li>
        ))}
      </ul>

      <div className="mt-6">
        {current ? (
          <p
            className={`flex items-center justify-center gap-2 h-[50px] rounded-xl text-sm font-black uppercase tracking-wide ${
              offer.accent === 'ultra'
                ? 'bg-ultra-500/15 text-ultra-400'
                : 'bg-lime-500/15 text-lime-400'
            }`}
          >
            <Icon name="check" size={18} strokeWidth={3} /> Tu plan actual
          </p>
        ) : (
          <Button variant={offer.accent === 'ultra' ? 'platinum' : 'primary'} onClick={onChoose}>
            Elegir {offer.name}
          </Button>
        )}
      </div>
    </div>
  );
}

export default function Premium() {
  const navigate = useNavigate();
  const { plan, setPlan } = useUserStore();
  const authStatus = useAuthStore((s) => s.status);
  const [selectedOffer, setSelectedOffer] = useState<PlanOffer | null>(null);
  const [billingBusy, setBillingBusy] = useState(false);
  const paymentRef = useRef<HTMLElement>(null);
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'wallet'>('card');
  const platform = Capacitor.getPlatform();
  const walletName = platform === 'ios' ? 'Apple Pay' : platform === 'android' ? 'Google Pay' : 'Apple Pay o Google Pay';
  /** Carries the plan it came from: an answer to "elegir Premium" printed in
   *  Ultra's violet reads as being about the other card. */
  const [notice, setNotice] = useState<{ text: string; accent: PlanOffer['accent']; accountLink?: boolean } | null>(null);
  const noticeRef = useRef<HTMLParagraphElement>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);

  /*
   * The answer lives above the cards, and on a phone the button you pressed is
   * a screen and a half below it — so pressing it looked like pressing a dead
   * button. Bringing the message into view is the difference between "nothing
   * happened" and "here's what happened".
   *
   * Announced as well as scrolled: a screen reader user gets the same answer
   * without either of us relying on where the page happens to be.
   */
  useEffect(() => {
    if (!notice) return;
    noticeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [notice]);

  useEffect(() => {
    if (selectedOffer) paymentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [selectedOffer]);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('checkout') !== 'cancel') return;
    setNotice({ text: 'Has cerrado el pago. No se ha hecho ningún cargo.', accent: 'lime' });
    window.history.replaceState({}, '', '/planes');
  }, []);

  useEffect(() => {
    if (!webBillingEnabled || new URLSearchParams(window.location.search).get('checkout') !== 'success' || !supabase) return;
    const client = supabase;
    let cancelled = false;
    setNotice({ text: 'Estamos confirmando tu suscripción…', accent: 'ultra' });
    const confirm = async () => {
      const { data: session } = await client.auth.getSession();
      if (!session.session) return;
      for (let attempt = 0; attempt < 15 && !cancelled; attempt++) {
        const { data } = await client.from('profiles').select('plan, plan_started_at')
          .eq('id', session.session.user.id).maybeSingle();
        if (data?.plan === 'premium' || data?.plan === 'ultra') {
          setPlan(data.plan);
          useUserStore.setState({ planStartedAt: data.plan_started_at });
          setNotice({ text: `${data.plan === 'ultra' ? 'Ultra' : 'Premium'} activado. Gracias por suscribirte.`, accent: data.plan === 'ultra' ? 'ultra' : 'lime' });
          window.history.replaceState({}, '', '/planes');
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
      if (!cancelled) setNotice({ text: 'El pago está pendiente de confirmación. Actualiza esta página en unos segundos.', accent: 'ultra' });
    };
    void confirm();
    return () => { cancelled = true; };
  }, [setPlan]);

  const choose = async (offer: PlanOffer) => {
    if (webBillingEnabled) {
      if (authStatus !== 'registered') {
        setNotice({ text: 'Guarda tu cuenta antes de suscribirte para conservar el plan en todos tus dispositivos.', accent: offer.accent, accountLink: true });
        return;
      }
      if (billingBusy) return;
      setBillingBusy(true);
      try {
        window.location.assign(await checkoutUrl(offer.id));
      } catch (error) {
        setNotice({ text: error instanceof Error ? error.message : 'No pudimos abrir la pasarela.', accent: offer.accent });
        setBillingBusy(false);
      }
      return;
    }
    if (isTestingBackend) {
      setSelectedOffer(offer);
      setPaymentMethod('card');
      return;
    }
    setNotice({ text: 'Las compras todavía no están disponibles.', accent: offer.accent });
  };

  const simulatePayment = () => {
    if (!selectedOffer || !isTestingBackend) return;
    setPlan(selectedOffer.id);
    setNotice({
      text: `Prueba completada con ${paymentMethod === 'card' ? 'tarjeta' : walletName}: ${selectedOffer.name} activado sin cargo real.`,
      accent: selectedOffer.accent,
    });
    setSelectedOffer(null);
  };

  const manageBilling = async () => {
    if (billingBusy) return;
    setBillingBusy(true);
    try {
      window.location.assign(await portalUrl());
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : 'No pudimos abrir la gestión de pagos.', accent: 'ultra' });
      setBillingBusy(false);
    }
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
            {plan !== 'free' && webBillingEnabled && (
              <button
                onClick={() => void manageBilling()}
                disabled={billingBusy}
                className="ml-auto shrink-0 text-[13px] font-black uppercase tracking-wide text-carbon-500 hover:text-carbon-300 transition disabled:opacity-50"
              >
                Gestionar
              </button>
            )}
            {plan !== 'free' && !webBillingEnabled && isTestingBackend && (
              <button
                onClick={() => setConfirmCancel(true)}
                className="ml-auto shrink-0 text-[13px] font-black uppercase tracking-wide text-carbon-500 hover:text-carbon-300 transition"
              >
                Cancelar
              </button>
            )}
          </div>

          {notice && (
            <p
              ref={noticeRef}
              role="status"
              aria-live="polite"
              className={`mt-4 rounded-2xl border-2 px-4 py-3 text-sm font-bold animate-pop-in ${
                notice.accent === 'ultra'
                  ? 'border-ultra-500/30 bg-ultra-500/10 text-ultra-300'
                  : 'border-lime-500/30 bg-lime-500/10 text-lime-400'
              }`}
            >
              {notice.text}
              {notice.accountLink && (
                <button onClick={() => navigate('/profile')} className="ml-2 underline underline-offset-2">Ir a Perfil</button>
              )}
            </p>
          )}

          <div className="mt-5 space-y-4">
            {PLAN_OFFERS.map((offer) => (
              <PlanCard
                key={offer.id}
                offer={offer}
                current={plan === offer.id}
                onChoose={() => void choose(offer)}
              />
            ))}
          </div>

          {selectedOffer && (
            <section ref={paymentRef} aria-label="Pago de prueba" className="mt-5 rounded-3xl border-2 border-ultra-500/40 bg-carbon-850 p-5">
              <p className="text-xs font-black uppercase tracking-wide text-ultra-300">Simulación · sin cargos</p>
              <h2 className="mt-2 text-xl font-black text-carbon-50">Stonksu {selectedOffer.name}</h2>
              <p className="mt-1 text-sm text-carbon-300">{formatPrice(selectedOffer.price)} al mes. Elige cómo querrías pagar cuando esté disponible.</p>
              <div role="radiogroup" aria-label="Método de pago" className="mt-4 space-y-2">
                {([
                  { id: 'card' as const, label: 'Tarjeta de crédito o débito' },
                  { id: 'wallet' as const, label: walletName },
                ]).map((method) => (
                  <label key={method.id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-carbon-700 bg-carbon-900 p-3 text-sm font-bold text-carbon-100">
                    <input type="radio" name="payment-method" value={method.id} checked={paymentMethod === method.id} onChange={() => setPaymentMethod(method.id)} className="accent-lime-500" />
                    {method.label}
                  </label>
                ))}
              </div>
              <p className="mt-3 text-xs text-carbon-400">No se pedirán datos de tarjeta ni se abrirá una cartera. Esta prueba no crea una suscripción.</p>
              <div className="mt-4 space-y-2">
                <Button variant="platinum" onClick={simulatePayment}>Simular pago sin cargo</Button>
                <Button variant="secondary" onClick={() => setSelectedOffer(null)}>Volver a los planes</Button>
              </div>
            </section>
          )}

          <p className="mt-6 text-[13px] text-carbon-500 leading-snug">
            {webBillingEnabled
              ? isTestingBackend
                ? 'Checkout de prueba: puedes usar tarjetas de prueba de Stripe. No se mueve dinero real.'
                : 'Suscripción mensual gestionada por Stripe. Puedes cancelarla desde Gestionar.'
              : 'Precios previstos para la suscripción mensual. Las compras todavía no están disponibles.'}
          </p>
        </div>
      </div>

      {confirmCancel && (
        <ConfirmModal
          title={`¿Cancelar ${planName(plan)}?`}
          message="Volverás al plan gratuito ahora mismo y perderás sus ventajas de prueba. No se ha realizado ningún cobro."
          confirmLabel="Sí, cancelar"
          cancelLabel="Seguir con el plan"
          onConfirm={() => {
            setPlan('free');
            setNotice({ text: 'Has vuelto al plan gratuito.', accent: 'lime' });
            setConfirmCancel(false);
          }}
          onCancel={() => setConfirmCancel(false)}
        />
      )}
    </div>
  );
}
