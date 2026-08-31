import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import TopBar from '../components/TopBar';
import NavRail from '../components/NavRail';
import BottomNav from '../components/BottomNav';
import Icon from '../components/Icon';
import { Button } from '../components/Button';
import { useUserStore } from '../store/useUserStore';
import { FREE_TRADES_PER_DAY, hasUnlimitedTrades } from '../data/plans';
import PriceChart from '../components/PriceChart';
import {
  INTERVALS,
  SYMBOL,
  fetchCandles,
  liquidationDuring,
  subscribePrice,
  worstPrice,
  type Interval,
  type TimedCandle,
} from '../lib/marketData';
import {
  backing,
  FUTURE_CANDLES,
  HISTORY_CANDLES,
  LEVERAGES,
  MAINTENANCE_MARGIN,
  TAKER_FEE,
  equity,
  generateCandles,
  isLiquidated,
  liquidationDistance,
  liquidationPrice,
  notional,
  roi,
  roundTripFee,
  settleCoins,
  type Direction,
  type Leverage,
  type MarginMode,
  type Position,
} from '../utils/market';

/*
 * A trade you can actually lose, laid out the way a real venue lays it out.
 *
 * Margin, leverage, position size, liquidation price, fees on both sides —
 * the same words in the same order as Bitget or Bitunix, because the point is
 * that somebody who plays here and later opens a real account already knows
 * what every field means. An approximation that taught the wrong lesson would
 * be worse than no simulator.
 *
 * What it deliberately does not model is cross margin. On isolated margin the
 * engine closes you before the loss exceeds your margin, so nobody ends a
 * round owing coins — and "you can lose more than you put in" is a warning to
 * read, not a mechanic to hand somebody in a game with its own currency.
 */

/** Quick stake buttons, as fractions of the balance — same idea as the
 *  25/50/75/100% row every venue puts under the amount field. */
const STAKE_SHORTCUTS = [0.25, 0.5, 0.75, 1];

/** One label-and-value line, the way an order panel lists its numbers. */
function Row({ label, value, tone = 'text-carbon-200' }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-[13px]">
      <span className="text-carbon-500">{label}</span>
      <span className={`font-black tabular-nums ${tone}`}>{value}</span>
    </div>
  );
}

export default function Simulator() {
  const navigate = useNavigate();
  const { plan, coins, canTrade, startTrade, settleTrade, openTrade, setOpenTrade } = useUserStore();
  const unlimited = hasUnlimitedTrades(plan);
  const allowed = canTrade();

  /*
   * Real candles when the network allows, the seeded market when it doesn't.
   *
   * A phone on a train, a country that blocks the host, an exchange having a
   * bad afternoon — none of those should mean "come back later" for a feature
   * that already had a working market of its own. The screen says which one
   * you're looking at, because a simulated price labelled BTC would be a lie.
   */
  /** The chart's timeframe. Above the fetch that reads it, since a hook
   *  can't reach a `const` declared further down the component. */
  const [timeframe, setTimeframe] = useState<Interval>('1m');
  const [seed] = useState(() => Math.floor(Math.random() * 1e9));
  const [candles, setCandles] = useState<TimedCandle[]>([]);
  const [live, setLive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [livePrice, setLivePrice] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const real = await fetchCandles(120, undefined, timeframe);
      if (cancelled) return;
      if (real) {
        setCandles(real);
        setLive(true);
      } else {
        // The offline market, wearing timestamps so the same chart can draw it.
        const now = Math.floor(Date.now() / 1000);
        setCandles(
          generateCandles(seed, HISTORY_CANDLES + FUTURE_CANDLES).map((c, i) => ({
            ...c,
            time: now - (HISTORY_CANDLES + FUTURE_CANDLES - i) * 60,
          }))
        );
        setLive(false);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [seed, timeframe]);

  // The live price, straight from the trade stream. It moves the last candle
  // rather than appending, so the chart doesn't grow a bar per tick.
  useEffect(() => {
    if (!live) return;
    return subscribePrice((p) => {
      setLivePrice(p);
      setCandles((cs) => {
        if (cs.length === 0) return cs;
        const last = { ...cs[cs.length - 1] };
        last.close = p;
        last.high = Math.max(last.high, p);
        last.low = Math.min(last.low, p);
        return [...cs.slice(0, -1), last];
      });
    });
  }, [live]);
  const [leverage, setLeverage] = useState<Leverage>(10);
  const [mode, setMode] = useState<MarginMode>('isolated');
  /** Auto-fit, off the moment you move the chart yourself. */
  const [auto, setAuto] = useState(true);
  /*
   * Held as text, not as a number.
   *
   * A controlled numeric field can't be empty: clearing it snapped straight
   * back to 0, and the next digit typed landed behind that zero — "0100" for
   * anyone who cleared the field before typing, which is what everybody does.
   * The text is what you typed; the number is derived from it.
   */
  const [marginText, setMarginText] = useState(() => String(Math.min(100, coins)));
  const margin = Math.max(0, Math.min(coins, Math.floor(Number(marginText) || 0)));

  const typeMargin = (raw: string) => {
    // Digits only, and no leading zeros to sit in front of the real number.
    const digits = raw.replace(/[^\d]/g, '').replace(/^0+(?=\d)/, '');
    if (digits === '') {
      setMarginText('');
      return;
    }
    // Clamped as you type rather than on submit: a venue won't open more than
    // your balance either, and finding out after pressing is the worst moment.
    setMarginText(String(Math.min(coins, Number(digits))));
  };
  const [position, setPosition] = useState<Position | null>(null);
  const [settled, setSettled] = useState<{ coins: number; liquidated: boolean } | null>(null);

  /*
   * A position left open keeps running, and the path decides its fate.
   *
   * That's the honest version of a live market: close the app on a losing
   * 50x position and it does not politely wait. On return the candles since
   * the entry are replayed — a long dies on a low, a short on a high, which
   * is what a matching engine watches — so a wick that took the position out
   * counts even if the price came back before you looked.
   */
  useEffect(() => {
    if (!openTrade || position || settled) return;
    let cancelled = false;
    void (async () => {
      const restored: Position = {
        direction: openTrade.direction,
        leverage: openTrade.leverage as Leverage,
        margin: openTrade.margin,
        entry: openTrade.entry,
        // Older positions predate the mode; isolated is the safer assumption,
        // since it can only settle for less than cross would.
        mode: openTrade.mode ?? 'isolated',
        wallet: openTrade.wallet ?? openTrade.margin,
      };
      const since = await fetchCandles(1000, openTrade.openedAt);
      if (cancelled) return;
      const liqHit = since ? liquidationDuring(restored, since) : null;
      if (liqHit !== null) {
        const change = settleCoins(restored, worstPrice(restored.direction, since ?? []) ?? liqHit);
        settleTrade(change);
        setOpenTrade(null);
        setSettled({ coins: change, liquidated: true });
        return;
      }
      setPosition(restored);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const price = livePrice ?? candles[candles.length - 1]?.close ?? 0;
  const entryPrice = price;

  /** The position you would open right now — what the panel is describing
   *  before you commit to it. */
  const preview: Position = {
    direction: 'long',
    leverage,
    margin,
    entry: entryPrice,
    mode,
    wallet: coins,
  };
  const liquidated = position ? isLiquidated(position, price) : false;
  const pnl = position ? equity(position, price) - position.margin : 0;

  const open = (direction: Direction) => {
    if (margin <= 0 || margin > coins) return;
    if (!startTrade()) return;
    setPosition({ direction, leverage, margin, entry: entryPrice, mode, wallet: coins });
    // Remembered before anything else can go wrong: a position that exists on
    // screen but not in storage is one that vanishes when the app is closed.
    setOpenTrade({
      direction,
      leverage,
      margin,
      entry: entryPrice,
      openedAt: Date.now(),
      mode,
      wallet: coins,
    });
  };

  const close = () => {
    if (!position || settled) return;
    const change = settleCoins(position, price);
    settleTrade(change);
    setOpenTrade(null);
    setSettled({ coins: change, liquidated: isLiquidated(position, price) });
  };

  // Liquidation closes for you: there is nothing left to decide, and a live
  // button would say otherwise.
  useEffect(() => {
    if (position && liquidated && !settled) close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liquidated]);

  const shownPosition = position ?? preview;
  const liqPrice = liquidationPrice(shownPosition);
  const liqDistance = liquidationDistance(shownPosition) * 100;
  /** Under a couple of per cent, one ordinary candle ends the round. That's
   *  the number worth shouting about, not the leverage itself. */
  const risky = liqDistance < 2;

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
            <h1 className="text-2xl font-black text-carbon-50">Simulador</h1>
          </div>
          <p className="mt-1 text-sm text-carbon-400">
            {live
              ? 'Precio real de BTC en vivo, monedas del juego. Margen aislado, comisión en cada lado y liquidación, como en un perpetuo.'
              : 'Sin conexión al mercado: estás operando sobre un precio simulado. Las reglas son las mismas.'}
          </p>

          <div className="mt-4 rounded-3xl border-2 border-carbon-800 bg-carbon-850 p-4">
            <div className="flex items-baseline justify-between gap-3">
              <p className="flex items-center gap-2 text-[12px] font-black uppercase tracking-[0.8px] text-carbon-500">
                {live ? `${SYMBOL.replace('USDT', '')} / USDT · Perp` : 'STNK / USDT · Simulado'}
                {live && (
                  // Only claimed when a socket is actually delivering ticks.
                  <span className="inline-flex items-center gap-1 text-lime-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-lime-500 animate-pulse-soft" />
                    En vivo
                  </span>
                )}
              </p>
              <p className="text-lg font-black text-carbon-50 tabular-nums">{price.toFixed(2)}</p>
            </div>

            {/* Timeframes and the AUTO button, where a venue puts them: above
                the chart, and AUTO on the right because it's about the view
                rather than about the market. */}
            <div className="mt-2 flex items-center gap-1 overflow-x-auto">
              {INTERVALS.map((tf) => (
                <button
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  className={`shrink-0 rounded-lg px-2.5 py-1 text-[12px] font-black uppercase transition ${
                    timeframe === tf
                      ? 'bg-carbon-800 text-lime-400'
                      : 'text-carbon-500 hover:text-carbon-300'
                  }`}
                >
                  {tf}
                </button>
              ))}
              <button
                onClick={() => setAuto((v) => !v)}
                aria-pressed={auto}
                title="Ajustar la vista al precio automáticamente"
                className={`ml-auto shrink-0 rounded-lg border-2 px-2 py-1 text-[11px] font-black uppercase tracking-wide transition ${
                  auto
                    ? 'border-lime-500/50 bg-lime-500/10 text-lime-400'
                    : 'border-carbon-800 text-carbon-500 hover:text-carbon-300'
                }`}
              >
                Auto
              </button>
            </div>

            {loading ? (
              <p className="py-16 text-center text-sm font-bold text-carbon-500">Cargando mercado…</p>
            ) : (
              <PriceChart
                candles={candles}
                entry={position ? position.entry : null}
                liquidation={position ? liqPrice : null}
                auto={auto}
                onUserMoved={() => setAuto(false)}
              />
            )}

            {position && (
              <div className="mt-2 flex items-center justify-between gap-3">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[12px] font-black uppercase tracking-wide ${
                    position.direction === 'long'
                      ? 'bg-lime-500/15 text-lime-400'
                      : 'bg-danger-500/15 text-danger-400'
                  }`}
                >
                  <Icon name={position.direction === 'long' ? 'trending-up' : 'trending-down'} size={14} />
                  {position.direction === 'long' ? 'Long' : 'Short'} {position.leverage}x
                </span>
                <span className="text-right">
                  <span
                    className={`block text-lg font-black tabular-nums ${
                      pnl >= 0 ? 'text-lime-400' : 'text-danger-400'
                    }`}
                  >
                    {pnl >= 0 ? '+' : ''}
                    {pnl.toFixed(1)}
                  </span>
                  <span className="block text-[11px] font-bold uppercase tracking-wide text-carbon-500">
                    PnL · ROI {(roi(position, price) * 100).toFixed(1)}%
                  </span>
                </span>
              </div>
            )}
          </div>

          {settled ? (
            <div className="mt-4 rounded-2xl border-2 border-carbon-800 bg-carbon-850 p-5 text-center">
              <p className="text-[13px] font-black uppercase tracking-[0.8px] text-carbon-500">
                {settled.liquidated ? 'Liquidado' : 'Posición cerrada'}
              </p>
              <p
                className={`mt-1 text-3xl font-black tabular-nums ${
                  settled.coins >= 0 ? 'text-lime-400' : 'text-danger-400'
                }`}
              >
                {settled.coins >= 0 ? '+' : ''}
                {settled.coins}
              </p>
              <p className="mt-1 text-sm text-carbon-400">
                {settled.liquidated
                  ? `Con ${position?.leverage}x bastó un ${liqDistance.toFixed(2)}% en contra para llevarse tu margen entero.`
                  : 'Monedas a tu saldo, comisiones ya descontadas.'}
              </p>
              <div className="mt-5 space-y-3">
                <Button onClick={() => navigate('/tienda')}>Ir a la tienda</Button>
                <Button variant="secondary" onClick={() => window.location.reload()}>
                  {unlimited ? 'Otra operación' : 'Volver a intentarlo'}
                </Button>
              </div>
            </div>
          ) : position ? (
            <div className="mt-4 space-y-3">
              <div className="rounded-2xl border-2 border-carbon-800 bg-carbon-850 p-4 space-y-2">
                <Row label="Margen" value={`${position.margin} monedas`} />
                <Row label="Tamaño de posición" value={`${notional(position).toFixed(0)} monedas`} />
                <Row label="Precio de entrada" value={position.entry.toFixed(2)} />
                <Row label="Precio de liquidación" value={liqPrice.toFixed(2)} tone="text-danger-400" />
              </div>
              <Button variant={pnl >= 0 ? 'primary' : 'danger'} onClick={close}>
                Cerrar posición
              </Button>
            </div>
          ) : (
            <>
              {/* Order panel. Same order as a venue: leverage, then amount,
                  then what that combination actually means. */}
              {/* Margin mode first, because it decides what the leverage
                  below it can cost you. */}
              <p className="mt-5 text-[13px] font-black uppercase tracking-[0.8px] text-carbon-500">
                Modo de margen
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {(['isolated', 'cross'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className={`rounded-xl border-2 px-3 py-2.5 text-left transition ${
                      mode === m
                        ? m === 'cross'
                          ? 'border-danger-500 bg-danger-500/10'
                          : 'border-lime-500 bg-lime-500/10'
                        : 'border-carbon-800 bg-carbon-850 hover:border-carbon-700'
                    }`}
                  >
                    <span
                      className={`block text-[13px] font-black uppercase tracking-wide ${
                        mode === m
                          ? m === 'cross'
                            ? 'text-danger-400'
                            : 'text-lime-400'
                          : 'text-carbon-300'
                      }`}
                    >
                      {m === 'isolated' ? 'Aislado' : 'Cruzado'}
                    </span>
                    <span className="block text-[11px] text-carbon-500 leading-snug">
                      {m === 'isolated'
                        ? 'Solo arriesgas el margen'
                        : 'Todo tu saldo respalda la posición'}
                    </span>
                  </button>
                ))}
              </div>

              <p className="mt-5 text-[13px] font-black uppercase tracking-[0.8px] text-carbon-500">
                Apalancamiento
              </p>
              <div className="mt-2 grid grid-cols-5 gap-2">
                {LEVERAGES.map((l) => (
                  <button
                    key={l}
                    onClick={() => setLeverage(l)}
                    className={`rounded-xl border-2 py-2 text-[13px] font-black transition ${
                      leverage === l
                        ? l >= 50
                          ? 'border-danger-500 bg-danger-500/10 text-danger-400'
                          : 'border-lime-500 bg-lime-500/10 text-lime-400'
                        : 'border-carbon-800 bg-carbon-850 text-carbon-300 hover:border-carbon-700'
                    }`}
                  >
                    {l}x
                  </button>
                ))}
              </div>

              <div className="mt-5 flex items-baseline justify-between gap-3">
                <p className="text-[13px] font-black uppercase tracking-[0.8px] text-carbon-500">
                  Margen
                </p>
                <p className="text-[13px] font-bold text-carbon-500 tabular-nums">
                  Saldo: {coins}
                </p>
              </div>
              <div className="mt-2 flex items-center gap-2">
                {/* type="text" with a numeric keypad rather than
                    type="number": the spinner arrows are useless at this scale
                    and the browser's own coercion is what put the stray zero
                    there in the first place. */}
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="0"
                  aria-label="Margen en monedas"
                  value={marginText}
                  onChange={(e) => typeMargin(e.target.value)}
                  className="flex-1 min-w-0 rounded-xl border-2 border-carbon-800 bg-carbon-900 px-4 py-3 text-lg font-black text-carbon-50 tabular-nums placeholder:text-carbon-600 focus:border-lime-500/60 focus:outline-none"
                />
                <span className="shrink-0 text-sm font-bold text-carbon-500">monedas</span>
              </div>
              <div className="mt-2 grid grid-cols-4 gap-2">
                {STAKE_SHORTCUTS.map((f) => (
                  <button
                    key={f}
                    onClick={() => setMarginText(String(Math.floor(coins * f)))}
                    className="rounded-lg border-2 border-carbon-800 bg-carbon-850 py-1.5 text-[12px] font-black text-carbon-300 hover:border-carbon-700 transition"
                  >
                    {f === 1 ? 'TODO' : `${f * 100}%`}
                  </button>
                ))}
              </div>

              <div className="mt-4 rounded-2xl border-2 border-carbon-800 bg-carbon-850 p-4 space-y-2">
                <Row label="Tamaño de posición" value={`${notional(preview).toFixed(0)} monedas`} />
                <Row
                  label="Pérdida máxima"
                  value={`${backing(preview).toFixed(0)} monedas`}
                  tone={mode === 'cross' ? 'text-danger-400' : 'text-carbon-200'}
                />
                <Row label="Precio de liquidación" value={liqPrice.toFixed(2)} tone="text-danger-400" />
                <Row
                  label="Distancia hasta liquidación"
                  value={`${liqDistance.toFixed(2)}%`}
                  tone={risky ? 'text-danger-400' : 'text-carbon-200'}
                />
                <Row
                  label={`Comisión ida y vuelta (${(TAKER_FEE * 100).toFixed(3)}% por lado)`}
                  value={`${roundTripFee(preview, entryPrice).toFixed(1)} monedas`}
                />
                <Row
                  label="Margen de mantenimiento"
                  value={`${(MAINTENANCE_MARGIN * 100).toFixed(1)}%`}
                />
              </div>

              {/* The warning scales with the actual danger rather than with a
                  round number of x's: what ends a round is how close the
                  liquidation price is, and at 100x it's less than half a
                  per cent away. */}
              <p
                className={`mt-3 flex items-start gap-2 text-[13px] leading-snug ${
                  risky ? 'text-danger-400' : 'text-carbon-500'
                }`}
              >
                <Icon name={risky ? 'trending-down' : 'shield'} size={16} className="mt-0.5 shrink-0" />
                {margin <= 0
                  ? 'Pon un margen para operar.'
                  : mode === 'cross'
                  ? `Cruzado: aguanta un ${liqDistance.toFixed(2)}% en contra porque lo respalda todo tu saldo — y si llega ahí, se lleva las ${backing(preview).toFixed(0)} monedas, no solo el margen.`
                  : risky
                  ? `Un ${liqDistance.toFixed(2)}% en contra y pierdes las ${margin} monedas enteras. Una vela normal se mueve más que eso.`
                  : `Aislado: puedes perder hasta las ${margin} monedas del margen, nunca más.`}
              </p>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <Button disabled={!allowed || margin <= 0} onClick={() => open('long')}>
                  <Icon name="trending-up" size={18} /> Long
                </Button>
                <Button
                  variant="danger"
                  disabled={!allowed || margin <= 0}
                  onClick={() => open('short')}
                >
                  <Icon name="trending-down" size={18} /> Short
                </Button>
              </div>

              <p className="mt-3 text-center text-[13px] text-carbon-500">
                {unlimited
                  ? 'Con Ultra, tantas operaciones como quieras.'
                  : `El plan gratuito incluye ${FREE_TRADES_PER_DAY} operación al día.`}
              </p>

              {!allowed && (
                <div className="mt-4 rounded-2xl border-2 border-ultra-500/30 bg-ultra-500/10 p-4 text-center">
                  <p className="text-sm font-bold text-ultra-300">
                    Ya has operado hoy. Con Ultra son ilimitadas.
                  </p>
                  <div className="mt-3 w-[200px] mx-auto">
                    <Button variant="platinum" onClick={() => navigate('/planes')}>
                      Ver Ultra
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
