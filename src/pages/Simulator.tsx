import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import TopBar from '../components/TopBar';
import NavRail from '../components/NavRail';
import BottomNav from '../components/BottomNav';
import Icon from '../components/Icon';
import { Button } from '../components/Button';
import { useUserStore } from '../store/useUserStore';
import { FREE_TRADES_PER_DAY, hasUnlimitedTrades } from '../data/plans';
import PriceChart from '../components/PriceChart';
import TradeHistory from '../components/TradeHistory';
import {
  INTERVALS,
  SYMBOL,
  exitDuring,
  fetchCandles,
  fillDuring,
  subscribePrice,
  worstPrice,
  type Interval,
  type TimedCandle,
} from '../lib/marketData';
import {
  MAKER_FEE,
  backing,
  entryFeeRate,
  FUTURE_CANDLES,
  HISTORY_CANDLES,
  LEVERAGES,
  MAINTENANCE_MARGIN,
  TAKER_FEE,
  equity,
  generateCandles,
  limitCanRest,
  limitFills,
  liquidationDistance,
  liquidationPrice,
  notional,
  priceForRoi,
  roi,
  roundTripFee,
  settleCoins,
  triggerIsValid,
  triggeredBy,
  type Direction,
  type ExitReason,
  type OrderType,
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
 * The chart and order ticket share the desktop workspace. On a phone they
 * remain mounted behind two views so switching does not discard order inputs
 * or the chart's scale and position.
 */

/** Quick stake buttons, as fractions of the balance — same idea as the
 *  25/50/75/100% row every venue puts under the amount field. */
const STAKE_SHORTCUTS = [0.25, 0.5, 0.75, 1];

/*
 * Take profit and stop loss, entered as ROI rather than as a price.
 *
 * A venue asks for a price because it already knows which side you're on. Here
 * the side isn't chosen until you press Long or Short, and "20% de ganancia"
 * means the same thing on both — while a price would be a target on one and a
 * stop on the other. It also puts the number that matters in front of you: at
 * 50x, a 20% move in your favour isn't 20% of anything you own.
 */
const TP_SHORTCUTS = [25, 50, 100];
const SL_SHORTCUTS = [10, 25, 50];

/** What each ending is called on the screen that announces it. */
const EXIT_TITLES: Record<ExitReason, string> = {
  liquidation: 'Liquidado',
  takeProfit: 'Take profit',
  stopLoss: 'Stop loss',
  manual: 'Posición cerrada',
};

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
  const [mobileView, setMobileView] = useState<'chart' | 'order'>('chart');
  const mobileViews = useRef<HTMLDivElement>(null);
  const {
    plan,
    coins,
    canTrade,
    startTrade,
    settleTrade,
    openTrade,
    setOpenTrade,
    pendingOrder,
    setPendingOrder,
    refundTrade,
    recordTrade,
  } = useUserStore();
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
  const [orderType, setOrderType] = useState<OrderType>('market');
  /** The price a limit order waits at. Text, like every other number in this
   *  panel, so it can be empty while you're typing it. */
  const [limitText, setLimitText] = useState('');
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
  /** Take profit and stop loss, as percentages of ROI and held as text for
   *  the same reason the margin is. Empty means "no order". */
  const [tpText, setTpText] = useState('');
  const [slText, setSlText] = useState('');
  const percent = (raw: string) => raw.replace(/[^\d.]/g, '').replace(/^(\d*\.\d*).*$/, '$1');
  const asRoi = (raw: string, sign: 1 | -1) => {
    const n = Number(raw);
    return raw.trim() !== '' && Number.isFinite(n) && n > 0 ? (sign * n) / 100 : null;
  };

  const [position, setPosition] = useState<Position | null>(null);
  /** When the open position was opened, for the history row it will become. */
  const [openedAt, setOpenedAt] = useState<number | null>(null);
  const [settled, setSettled] = useState<{ coins: number; reason: ExitReason } | null>(null);

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
        takeProfit: openTrade.takeProfit ?? null,
        stopLoss: openTrade.stopLoss ?? null,
        orderType: openTrade.orderType ?? 'market',
      };
      const since = await fetchCandles(1000, openTrade.openedAt);
      if (cancelled) return;
      const hit = since ? exitDuring(restored, since) : null;
      if (hit !== null) {
        // A liquidation settles at the worst the path reached, which is what
        // the engine would have matched against. A stop or a target settles at
        // its own level: that's the price you asked for.
        const at =
          hit.reason === 'liquidation'
            ? worstPrice(restored.direction, since ?? []) ?? hit.price
            : hit.price;
        finish(restored, at, hit.reason, openTrade.openedAt);
        return;
      }
      setPosition(restored);
      setOpenedAt(openTrade.openedAt);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /*
   * An order left waiting doesn't wait for you to come back either.
   *
   * The candles since it was placed decide three things in order: whether it
   * filled at all, and if it did, whether the position it became survived the
   * rest of them. Skipping that second half would hand somebody a position a
   * real venue had already closed hours ago — the pleasant half of the replay
   * without the other one.
   */
  useEffect(() => {
    if (!pendingOrder || position || settled) return;
    let cancelled = false;
    void (async () => {
      const since = await fetchCandles(1000, pendingOrder.placedAt);
      if (cancelled || !since) return;
      const at = fillDuring(pendingOrder.direction, pendingOrder.limitPrice, since);
      if (at === null) return;

      const when = since[at].time * 1000;
      const opened = fill(pendingOrder.limitPrice, when);
      if (!opened) return;

      const after = since.slice(at);
      const hit = exitDuring(opened, after);
      if (!hit) return;
      const exit =
        hit.reason === 'liquidation' ? worstPrice(opened.direction, after) ?? hit.price : hit.price;
      setPosition(null);
      finish(opened, exit, hit.reason, when);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const price = livePrice ?? candles[candles.length - 1]?.close ?? 0;
  const entryPrice = price;

  const tpRoi = asRoi(tpText, 1);
  const slRoi = asRoi(slText, -1);
  const limitPrice = Number(limitText) > 0 ? Number(limitText) : null;

  /** The position you would open right now — what the panel is describing
   *  before you commit to it. */
  const base: Position = {
    direction: 'long',
    leverage,
    margin,
    // A limit order's entry is the price you asked for, not the price now:
    // every number below it — size, liquidation, targets — is measured from
    // there, which is the whole reason for placing one.
    entry: orderType === 'limit' && limitPrice !== null ? limitPrice : entryPrice,
    mode,
    wallet: coins,
    orderType,
  };
  /*
   * The orders turned into prices.
   *
   * Only meaningful once there's a margin: with nothing staked the ROI has
   * nothing to be a percentage of. A stop further away than the liquidation
   * price is rejected rather than drawn, because the engine would get there
   * first and a line that can never be reached is a lie on a chart.
   */
  const tpPrice = margin > 0 && tpRoi !== null ? priceForRoi(base, tpRoi) : null;
  const slPrice = margin > 0 && slRoi !== null ? priceForRoi(base, slRoi) : null;
  const slReachable = slPrice === null || triggerIsValid(base, 'stopLoss', slPrice);
  const preview: Position = {
    ...base,
    takeProfit: tpPrice,
    stopLoss: slReachable ? slPrice : null,
  };
  /** Whether a limit order in this direction could actually wait: a buy has to
   *  be under the market and a sell over it. */
  const canRest = (d: Direction) =>
    orderType === 'market' || (limitPrice !== null && limitCanRest(d, limitPrice, price));
  const pnl = position ? equity(position, price) - position.margin : 0;

  /*
   * Filing a finished trade.
   *
   * Everything the history needs is decided here, at the one moment all of it
   * is known: a row written later from the position alone couldn't say what
   * closed it or when.
   */
  const finish = (p: Position, at: number, reason: ExitReason, since: number) => {
    const change = settleCoins(p, at);
    settleTrade(change);
    setOpenTrade(null);
    recordTrade({
      id: `${since}-${Math.random().toString(36).slice(2, 8)}`,
      direction: p.direction,
      leverage: p.leverage,
      margin: p.margin,
      mode: p.mode,
      orderType: p.orderType ?? 'market',
      entry: p.entry,
      exit: at,
      reason,
      coins: change,
      roi: roi(p, at),
      openedAt: since,
      closedAt: Date.now(),
    });
    setSettled({ coins: change, reason });
  };

  const open = (direction: Direction) => {
    if (loading || price <= 0 || margin <= 0 || margin > coins || !slReachable || !canRest(direction)) return;
    if (!startTrade()) return;

    if (orderType === 'limit' && limitPrice !== null) {
      // Nothing is bought yet and nothing is at risk: the order waits, and the
      // targets wait with it as percentages, to be priced off the fill.
      setPendingOrder({
        direction,
        leverage,
        margin,
        limitPrice,
        placedAt: Date.now(),
        mode,
        wallet: coins,
        tpRoi,
        slRoi,
      });
      return;
    }

    const opened: Position = {
      direction,
      leverage,
      margin,
      entry: entryPrice,
      mode,
      wallet: coins,
      orderType: 'market',
    };
    // Solved for the direction actually chosen: the same "+25%" is a price
    // above the entry on a long and below it on a short.
    opened.takeProfit = tpRoi !== null ? priceForRoi(opened, tpRoi) : null;
    opened.stopLoss = slRoi !== null ? priceForRoi(opened, slRoi) : null;
    setPosition(opened);
    setOpenedAt(Date.now());
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
      takeProfit: opened.takeProfit,
      stopLoss: opened.stopLoss,
      orderType: 'market',
    });
  };

  /** Turns a waiting order into a position at its own price. */
  const fill = (at: number, when: number) => {
    if (!pendingOrder) return;
    const opened: Position = {
      direction: pendingOrder.direction,
      leverage: pendingOrder.leverage as Leverage,
      margin: pendingOrder.margin,
      entry: at,
      mode: pendingOrder.mode,
      wallet: pendingOrder.wallet,
      orderType: 'limit',
    };
    opened.takeProfit = pendingOrder.tpRoi != null ? priceForRoi(opened, pendingOrder.tpRoi) : null;
    opened.stopLoss = pendingOrder.slRoi != null ? priceForRoi(opened, pendingOrder.slRoi) : null;
    setPendingOrder(null);
    setPosition(opened);
    setOpenedAt(when);
    setOpenTrade({
      direction: opened.direction,
      leverage: opened.leverage,
      margin: opened.margin,
      entry: opened.entry,
      openedAt: when,
      mode: opened.mode,
      wallet: opened.wallet,
      takeProfit: opened.takeProfit,
      stopLoss: opened.stopLoss,
      orderType: 'limit',
    });
    return opened;
  };

  const cancelOrder = () => {
    setPendingOrder(null);
    // Nothing was ever traded, so the day's turn goes back.
    refundTrade();
  };

  const closeAt = (at: number, reason: ExitReason) => {
    if (!position || settled) return;
    finish(position, at, reason, openedAt ?? Date.now());
  };

  /*
   * What the current price does to an open position.
   *
   * A live tick is a candle whose high and low are both that price, so the
   * same function decides the outcome here and in the replay above — the two
   * paths can't drift into disagreeing about whether a stop fired.
   *
   * Nothing is decided while the price is still 0. That isn't a cheap price,
   * it's the absence of one — the market hasn't loaded yet — and every long
   * ever opened is below its liquidation at zero. A restored position could
   * lose on arrival, before a single real tick, purely because its own fetch
   * came back before the chart's.
   */
  const trigger = position && !settled && price > 0 ? triggeredBy(position, price, price) : null;
  useEffect(() => {
    if (trigger) closeAt(trigger.price, trigger.reason);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger?.reason, trigger?.price]);

  // And what it does to an order still waiting for its price.
  const fills =
    pendingOrder && !position && !settled && price > 0
      ? limitFills(pendingOrder.direction, pendingOrder.limitPrice, price, price)
      : false;
  useEffect(() => {
    if (fills && pendingOrder) fill(pendingOrder.limitPrice, Date.now());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fills]);

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

        <main className="max-w-[1600px] mx-auto px-3 sm:px-5 py-5 pb-32 lg:pb-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black text-carbon-50">Simulador</h1>
                <span className="rounded-md border border-lime-500/30 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-lime-400">Demo</span>
              </div>
              <p className="mt-1 text-xs text-carbon-400">Practica trading con monedas del juego.</p>
            </div>
            <button
              onClick={() => navigate('/planes')}
              className="flex items-center gap-2 rounded-xl border border-ultra-500/30 bg-ultra-500/10 px-3 py-2 text-xs font-bold text-ultra-300 hover:bg-ultra-500/20 transition"
            >
              <Icon name="sparkles" size={16} />
              {unlimited ? 'Ultra · Operaciones ilimitadas' : 'Operaciones ilimitadas con Ultra'}
            </button>
          </div>

          <div ref={mobileViews} className="mt-4 flex scroll-mt-16 rounded-xl bg-carbon-850 p-1 lg:hidden" aria-label="Vista del simulador">
            {(['chart', 'order'] as const).map((view) => (
              <button
                key={view}
                aria-pressed={mobileView === view}
                aria-controls={view === 'chart' ? 'simulator-chart' : 'simulator-order'}
                onClick={() => setMobileView(view)}
                className={`flex-1 rounded-lg py-2.5 text-sm font-bold transition ${mobileView === view ? 'bg-carbon-700 text-carbon-50' : 'text-carbon-400'}`}
              >
                {view === 'chart' ? 'Gráfico' : position && !settled ? 'Posición abierta' : pendingOrder ? 'Orden pendiente' : 'Operar'}
              </button>
            ))}
          </div>

          <div className="mt-4 grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_360px]">
          <section id="simulator-chart" aria-label="Gráfico e historial" className={`min-w-0 lg:sticky lg:top-4 ${mobileView === 'chart' ? 'block' : 'hidden lg:block'}`}>
          <div className="rounded-2xl border border-carbon-700 bg-carbon-850 p-3 sm:p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="flex flex-wrap items-center gap-2 text-[12px] font-black uppercase tracking-[0.8px] text-carbon-300">
                {live ? `${SYMBOL.replace('USDT', '')} / USDT · Perp` : 'STNK / USDT · Simulado'}
                {live && (
                  // Only claimed when a socket is actually delivering ticks.
                  <span className="inline-flex items-center gap-1 text-lime-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-lime-500 animate-pulse-soft" />
                    En vivo
                  </span>
                )}
              </p>
              <p className="text-xl font-black text-carbon-50 tabular-nums">{loading ? '—' : price.toFixed(2)}</p>
            </div>
            <p className="mt-1 text-[11px] text-carbon-400">
              {loading ? 'Conectando al mercado…' : live ? 'Mercado BTC · saldo virtual' : 'Sin conexión al mercado · precio simulado'}
            </p>

            {/* Timeframes and the AUTO button, where a venue puts them: above
                the chart, and AUTO on the right because it's about the view
                rather than about the market. */}
            <div className="mt-2 flex items-center gap-1 overflow-x-auto">
              {INTERVALS.map((tf) => (
                <button
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  aria-pressed={timeframe === tf}
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
                title="Con AUTO el gráfico se ajusta solo; apágalo para moverlo tú"
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
                takeProfit={shownPosition.takeProfit ?? null}
                stopLoss={shownPosition.stopLoss ?? null}
                auto={auto}
                onAutoChange={setAuto}
                height={360}
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

          <div className="mt-3 lg:hidden">
            <Button onClick={() => {
              setMobileView('order');
              mobileViews.current?.scrollIntoView({ block: 'start' });
            }}>
              {position && !settled ? 'Gestionar posición' : pendingOrder ? 'Ver orden pendiente' : 'Operar'}
            </Button>
          </div>
          <TradeHistory />
          </section>

          <section id="simulator-order" aria-label="Panel de órdenes" className={`min-w-0 rounded-2xl border border-carbon-700 bg-carbon-850/40 p-4 ${mobileView === 'order' ? 'block' : 'hidden lg:block'}`}>
          <div className="flex items-center justify-between gap-2 border-b border-carbon-700 pb-3">
            <h2 className="text-sm font-black text-carbon-50">
              {settled ? 'Resultado' : pendingOrder && !position ? 'Orden pendiente' : position ? 'Posición abierta' : 'Crear orden'}
            </h2>
            <span className="text-xs font-bold text-carbon-400 tabular-nums">{loading ? '—' : price.toFixed(2)} USDT</span>
          </div>
          {settled ? (
            <div className="mt-4 rounded-2xl border-2 border-carbon-800 bg-carbon-850 p-5 text-center">
              <p className="text-[13px] font-black uppercase tracking-[0.8px] text-carbon-500">
                {EXIT_TITLES[settled.reason]}
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
                {settled.reason === 'liquidation'
                  ? `Con ${position?.leverage}x bastó un ${liqDistance.toFixed(2)}% en contra para llevarse tu margen entero.`
                  : settled.reason === 'stopLoss'
                  ? 'Tu stop cerró la posición donde tú dijiste, no donde lo habría hecho la liquidación.'
                  : settled.reason === 'takeProfit'
                  ? 'Tu take profit cerró la posición sola al llegar al objetivo.'
                  : 'Monedas a tu saldo, comisiones ya descontadas.'}
              </p>
              <div className="mt-5 space-y-3">
                <Button onClick={() => window.location.reload()}>
                  {unlimited ? 'Otra operación' : 'Volver a intentarlo'}
                </Button>
                <Button variant="secondary" onClick={() => navigate('/tienda')}>Ir a la tienda</Button>
              </div>
            </div>
          ) : pendingOrder && !position ? (
            /* An order that hasn't filled: no position, no money at risk, and
               nothing to close — only a price to wait for, or an order to take
               back off the book. */
            <div className="mt-4 space-y-3">
              <div className="rounded-2xl border-2 border-[#FFC93C]/40 bg-[#FFC93C]/5 p-4 space-y-2">
                <p className="flex items-center gap-2 text-[12px] font-black uppercase tracking-[0.8px] text-[#FFC93C]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#FFC93C] animate-pulse-soft" />
                  Orden límite en espera
                </p>
                <Row
                  label="Dirección"
                  value={`${pendingOrder.direction === 'long' ? 'Long' : 'Short'} ${pendingOrder.leverage}x`}
                />
                <Row label="Precio límite" value={pendingOrder.limitPrice.toFixed(2)} tone="text-[#FFC93C]" />
                <Row label="Precio ahora" value={price.toFixed(2)} />
                <Row
                  label="Le falta"
                  value={`${((Math.abs(price - pendingOrder.limitPrice) / price) * 100).toFixed(2)}%`}
                />
                <Row label="Margen reservado" value={`${pendingOrder.margin} monedas`} />
              </div>
              <p className="text-[13px] leading-snug text-carbon-500">
                Entra sola cuando el precio la toque, aunque cierres la app. Al ser una orden que
                espera pagas comisión de maker ({(MAKER_FEE * 100).toFixed(3)}% en vez de{' '}
                {(TAKER_FEE * 100).toFixed(3)}%), que es justo para lo que sirve una orden límite.
              </p>
              <Button variant="secondary" onClick={cancelOrder}>
                Cancelar orden
              </Button>
            </div>
          ) : position ? (
            <div className="mt-4 space-y-3">
              <div className="space-y-2 border-b border-carbon-700 pb-3">
                <p className={`text-sm font-black ${position.direction === 'long' ? 'text-lime-400' : 'text-danger-400'}`}>
                  {position.direction === 'long' ? 'Long' : 'Short'} · {position.leverage}x · {position.mode === 'cross' ? 'Cruzado' : 'Aislado'}
                </p>
                <Row label="PnL no realizado" value={`${pnl >= 0 ? '+' : ''}${pnl.toFixed(1)} monedas`} tone={pnl >= 0 ? 'text-lime-400' : 'text-danger-400'} />
                <Row label="ROI" value={`${(roi(position, price) * 100).toFixed(1)}%`} tone={pnl >= 0 ? 'text-lime-400' : 'text-danger-400'} />
              </div>
              <div className="rounded-2xl border-2 border-carbon-800 bg-carbon-850 p-4 space-y-2">
                <Row label="Margen" value={`${position.margin} monedas`} />
                <Row label="Tamaño de posición" value={`${notional(position).toFixed(0)} monedas`} />
                <Row label="Precio de entrada" value={position.entry.toFixed(2)} />
                {position.takeProfit != null && (
                  <Row
                    label="Take profit"
                    value={position.takeProfit.toFixed(2)}
                    tone="text-lime-400"
                  />
                )}
                {position.stopLoss != null && (
                  <Row label="Stop loss" value={position.stopLoss.toFixed(2)} tone="text-[#FFC93C]" />
                )}
                <Row label="Precio de liquidación" value={liqPrice.toFixed(2)} tone="text-danger-400" />
              </div>
              <Button variant={pnl >= 0 ? 'primary' : 'danger'} onClick={() => closeAt(price, 'manual')}>
                Cerrar posición
              </Button>
            </div>
          ) : (
            <>
              {/* Order type first, the way a venue lays its form out: what
                  kind of order it is decides what the price field below even
                  means. */}
              <p className="mt-5 text-[13px] font-black uppercase tracking-[0.8px] text-carbon-500">
                Tipo de orden
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {(['market', 'limit'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setOrderType(t)}
                    aria-pressed={orderType === t}
                    className={`rounded-xl border-2 px-3 py-2.5 text-left transition ${
                      orderType === t
                        ? 'border-lime-500 bg-lime-500/10'
                        : 'border-carbon-800 bg-carbon-850 hover:border-carbon-700'
                    }`}
                  >
                    <span
                      className={`block text-[13px] font-black uppercase tracking-wide ${
                        orderType === t ? 'text-lime-400' : 'text-carbon-300'
                      }`}
                    >
                      {t === 'market' ? 'Market' : 'Límite'}
                    </span>
                    <span className="block text-[11px] text-carbon-500 leading-snug">
                      {t === 'market' ? 'Entras ya, al precio de ahora' : 'Esperas a tu precio'}
                    </span>
                  </button>
                ))}
              </div>

              {orderType === 'limit' && (
                <>
                  <div className="mt-4 flex items-baseline justify-between gap-3">
                    <p className="text-[13px] font-black uppercase tracking-[0.8px] text-carbon-500">
                      Precio límite
                    </p>
                    <button
                      onClick={() => setLimitText(price.toFixed(2))}
                      className="text-[12px] font-black uppercase tracking-wide text-carbon-500 hover:text-carbon-300 transition"
                    >
                      Precio actual
                    </button>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      placeholder={price.toFixed(2)}
                      aria-label="Precio límite"
                      value={limitText}
                      onChange={(e) => setLimitText(percent(e.target.value))}
                      className="flex-1 min-w-0 rounded-xl border-2 border-carbon-800 bg-carbon-900 px-4 py-3 text-lg font-black text-carbon-50 tabular-nums placeholder:text-carbon-600 focus:border-lime-500/60 focus:outline-none"
                    />
                    <span className="shrink-0 text-sm font-bold text-carbon-500">USDT</span>
                  </div>
                  {/* Which button is even possible follows from the price: an
                      order under the market can only be waiting to buy, and one
                      over it can only be waiting to sell. */}
                  <p className="mt-2 text-[13px] leading-snug text-carbon-500">
                    {limitPrice === null
                      ? 'Pon el precio al que quieres entrar. Por debajo del actual sirve para un long; por encima, para un short.'
                      : limitPrice < price
                      ? `A un ${(((price - limitPrice) / price) * 100).toFixed(2)}% por debajo: sirve para un long, y entra sola si el precio baja hasta ahí.`
                      : limitPrice > price
                      ? `A un ${(((limitPrice - price) / price) * 100).toFixed(2)}% por encima: sirve para un short, y entra sola si el precio sube hasta ahí.`
                      : 'Ese es el precio de ahora mismo: eso es una orden market, no una límite.'}
                  </p>
                </>
              )}

              <div className="mt-4 grid grid-cols-2 gap-3">
                <label className="text-xs font-bold text-carbon-400">
                  Modo de margen
                  <select
                    aria-label="Modo de margen"
                    value={mode}
                    onChange={(e) => setMode(e.target.value as MarginMode)}
                    className="mt-2 block min-h-11 w-full rounded-xl border border-carbon-700 bg-carbon-850 px-3 text-sm font-bold text-carbon-50 focus:outline-lime-500"
                  >
                    <option value="isolated">Aislado</option>
                    <option value="cross">Cruzado</option>
                  </select>
                </label>
                <label className="text-xs font-bold text-carbon-400">
                  Apalancamiento
                  <select
                    aria-label="Apalancamiento"
                    value={leverage}
                    onChange={(e) => setLeverage(Number(e.target.value) as Leverage)}
                    className="mt-2 block min-h-11 w-full rounded-xl border border-carbon-700 bg-carbon-850 px-3 text-sm font-bold text-carbon-50 focus:outline-lime-500"
                  >
                    {LEVERAGES.map((l) => <option key={l} value={l}>{l}x</option>)}
                  </select>
                </label>
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

              {/* Take profit and stop loss. Optional, and last in the panel
                  because they're a decision about the position you've just
                  described — but before the buttons, because deciding when to
                  get out *after* getting in is the mistake this feature is
                  here to prevent. */}
              <details className="mt-4 rounded-xl border border-carbon-700 p-3">
              <summary className="cursor-pointer text-xs font-bold text-carbon-200">
                Take profit / Stop loss <span className="text-carbon-400">· {tpText || slText ? 'Configurado' : 'Opcional'}</span>
              </summary>
              <div className="mt-2 grid grid-cols-2 gap-3">
                {(
                  [
                    {
                      key: 'tp' as const,
                      label: 'Take profit',
                      text: tpText,
                      set: setTpText,
                      shortcuts: TP_SHORTCUTS,
                      sign: '+',
                      price: tpPrice,
                      roiValue: tpRoi,
                      tone: 'text-lime-400',
                      border: 'focus:border-lime-500/60',
                    },
                    {
                      key: 'sl' as const,
                      label: 'Stop loss',
                      text: slText,
                      set: setSlText,
                      shortcuts: SL_SHORTCUTS,
                      sign: '−',
                      price: slPrice,
                      roiValue: slRoi,
                      tone: 'text-[#FFC93C]',
                      border: 'focus:border-[#FFC93C]/60',
                    },
                  ]
                ).map((f) => (
                  <div key={f.key}>
                    <p className={`text-[12px] font-black uppercase tracking-wide ${f.tone}`}>
                      {f.label}
                    </p>
                    <div className="mt-1 flex items-center gap-1.5">
                      <span className="text-sm font-black text-carbon-500">{f.sign}</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        placeholder="—"
                        aria-label={`${f.label} en porcentaje de ROI`}
                        value={f.text}
                        onChange={(e) => f.set(percent(e.target.value))}
                        className={`w-full min-w-0 rounded-xl border-2 border-carbon-800 bg-carbon-900 px-3 py-2.5 text-base font-black text-carbon-50 tabular-nums placeholder:text-carbon-600 focus:outline-none ${f.border}`}
                      />
                      <span className="text-sm font-bold text-carbon-500">%</span>
                    </div>
                    <div className="mt-1.5 grid grid-cols-3 gap-1">
                      {f.shortcuts.map((v) => (
                        <button
                          key={v}
                          onClick={() => f.set(f.text === String(v) ? '' : String(v))}
                          className={`rounded-lg border-2 py-1 text-[11px] font-black transition ${
                            f.text === String(v)
                              ? 'border-carbon-600 bg-carbon-800 text-carbon-100'
                              : 'border-carbon-800 bg-carbon-850 text-carbon-400 hover:border-carbon-700'
                          }`}
                        >
                          {v}%
                        </button>
                      ))}
                    </div>
                    <p className="mt-1.5 text-[11px] font-bold text-carbon-500 tabular-nums leading-snug">
                      {f.price !== null && f.roiValue !== null
                        ? `${f.price.toFixed(2)} · ${f.roiValue > 0 ? '+' : ''}${(
                            f.roiValue * margin
                          ).toFixed(0)} monedas`
                        : 'Sin orden'}
                    </p>
                  </div>
                ))}
              </div>

              {/* A stop the engine would reach first isn't a stop, and saying
                  so is the whole lesson: at 100x there is barely any room
                  between "voy mal" and "se acabó". */}
              {!slReachable && (
                <p className="mt-2 flex items-start gap-2 text-[13px] leading-snug text-danger-400">
                  <Icon name="trending-down" size={16} className="mt-0.5 shrink-0" />
                  Con {leverage}x te liquidan antes de perder ese {slText}%: el stop tiene que ser
                  de menos del {(-roi(base, liqPrice) * 100).toFixed(1)}%.
                </p>
              )}

              </details>

              <details className="mt-3 rounded-xl border border-carbon-700 p-3">
                <summary className="cursor-pointer text-xs font-bold text-carbon-200">Detalles de riesgo y comisiones</summary>
              <div className="mt-3 space-y-2">
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
                  label={`Comisión (${(entryFeeRate(preview) * 100).toFixed(3)}% al entrar${
                    orderType === 'limit' ? ' como maker' : ''
                  } y ${(TAKER_FEE * 100).toFixed(3)}% al salir)`}
                  value={`${roundTripFee(preview, base.entry).toFixed(1)} monedas`}
                />
                <Row
                  label="Margen de mantenimiento"
                  value={`${(MAINTENANCE_MARGIN * 100).toFixed(1)}%`}
                />
              </div>

              </details>

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
                <Button
                  disabled={loading || price <= 0 || !allowed || margin <= 0 || !slReachable || !canRest('long')}
                  onClick={() => open('long')}
                >
                  <Icon name="trending-up" size={18} /> Long
                </Button>
                <Button
                  variant="danger"
                  disabled={loading || price <= 0 || !allowed || margin <= 0 || !slReachable || !canRest('short')}
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

          </section>
        </div>
        </main>
      </div>
    </div>
  );
}
