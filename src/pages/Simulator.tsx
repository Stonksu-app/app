import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import TopBar from '../components/TopBar';
import NavRail from '../components/NavRail';
import BottomNav from '../components/BottomNav';
import Icon from '../components/Icon';
import { Button } from '../components/Button';
import { useUserStore } from '../store/useUserStore';
import { FREE_TRADES_PER_DAY, hasUnlimitedTrades } from '../data/plans';
import {
  FUTURE_CANDLES,
  HISTORY_CANDLES,
  LEVERAGES,
  coinsFromReturn,
  generateCandles,
  isLiquidated,
  positionReturn,
  type Candle,
  type Direction,
  type Leverage,
} from '../utils/market';

/*
 * A trade you can actually lose.
 *
 * Everything else in the app pays for effort; this pays for a decision, which
 * is the only way to teach what leverage feels like. The money is coins, the
 * market is a seeded random walk, and the position can be wiped out — those
 * three together are the lesson. Nothing here touches real money and the page
 * says so, because a simulator that lets you wonder is worse than no
 * simulator.
 */

/** What each round puts at risk. Fixed rather than chosen: the variable worth
 *  playing with here is leverage, and two dials would hide which one hurt. */
const STAKE = 100;
/** How fast the future arrives. Slow enough to watch a position move against
 *  you, quick enough that a round is a minute, not an afternoon. */
const TICK_MS = 420;

function Chart({ candles, entryIndex }: { candles: Candle[]; entryIndex: number | null }) {
  const width = 320;
  const height = 180;
  const high = Math.max(...candles.map((c) => c.high));
  const low = Math.min(...candles.map((c) => c.low));
  const span = high - low || 1;
  const step = width / Math.max(candles.length, 1);
  const y = (price: number) => height - ((price - low) / span) * height;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-44 sm:h-56"
      role="img"
      aria-label="Gráfico de precio simulado"
    >
      {entryIndex !== null && candles[entryIndex] && (
        // Where you got in, so the profit on screen has something to be
        // measured from.
        <line
          x1={0}
          x2={width}
          y1={y(candles[entryIndex].close)}
          y2={y(candles[entryIndex].close)}
          stroke="#8f8f8f"
          strokeDasharray="4 4"
          strokeWidth={1}
        />
      )}
      {candles.map((c, i) => {
        const x = i * step + step / 2;
        const up = c.close >= c.open;
        const colour = up ? '#C6FF34' : '#FF5252';
        const bodyTop = y(Math.max(c.open, c.close));
        const bodyHeight = Math.max(1, Math.abs(y(c.open) - y(c.close)));
        return (
          <g key={i}>
            <line x1={x} x2={x} y1={y(c.high)} y2={y(c.low)} stroke={colour} strokeWidth={1} />
            <rect
              x={x - step * 0.3}
              y={bodyTop}
              width={step * 0.6}
              height={bodyHeight}
              fill={colour}
              rx={1}
            />
          </g>
        );
      })}
    </svg>
  );
}

export default function Simulator() {
  const navigate = useNavigate();
  const { plan, coins, canTrade, startTrade, settleTrade } = useUserStore();
  const unlimited = hasUnlimitedTrades(plan);
  // Asked before the buttons are drawn, so somebody out of trades sees why
  // rather than finding out by pressing.
  const allowed = canTrade();

  const [seed] = useState(() => Math.floor(Math.random() * 1e9));
  const full = useMemo(() => generateCandles(seed, HISTORY_CANDLES + FUTURE_CANDLES), [seed]);

  /** How much of the series is on screen. Starts at the history; the rest
   *  arrives one candle at a time once a position is open. */
  const [shown, setShown] = useState(HISTORY_CANDLES);
  const [position, setPosition] = useState<{ direction: Direction; leverage: Leverage } | null>(
    null
  );
  const [leverage, setLeverage] = useState<Leverage>(2);
  const [settled, setSettled] = useState<{ coins: number; liquidated: boolean } | null>(null);
  const [denied, setDenied] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const entryIndex = position ? HISTORY_CANDLES - 1 : null;
  const entry = full[HISTORY_CANDLES - 1].close;
  const price = full[shown - 1].close;
  const ret = position ? positionReturn(entry, price, position.direction, position.leverage) : 0;
  const liquidated = position ? isLiquidated(ret) : false;

  // The future arrives on a timer while a position is open, and stops the
  // moment it's liquidated or the series runs out.
  useEffect(() => {
    if (!position || settled) return;
    if (liquidated || shown >= full.length) return;
    timer.current = setInterval(() => setShown((n) => Math.min(full.length, n + 1)), TICK_MS);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [position, settled, liquidated, shown, full.length]);

  const open = (direction: Direction) => {
    if (!startTrade()) {
      setDenied(true);
      return;
    }
    setPosition({ direction, leverage });
  };

  const close = () => {
    if (!position) return;
    const won = coinsFromReturn(STAKE, ret);
    settleTrade(won);
    setSettled({ coins: won, liquidated });
  };

  // Liquidation closes the position for you: there is nothing left to decide,
  // and leaving the button there would suggest otherwise.
  useEffect(() => {
    if (position && liquidated && !settled) close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liquidated]);

  const done = shown >= full.length;

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
            Mercado inventado, monedas de verdad. Nada de esto usa dinero real.
          </p>

          <div className="mt-4 rounded-3xl border-2 border-carbon-800 bg-carbon-850 p-4">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-[12px] font-black uppercase tracking-[0.8px] text-carbon-500">
                STNK / USDT
              </p>
              <p className="text-lg font-black text-carbon-50 tabular-nums">{price.toFixed(2)}</p>
            </div>

            <Chart candles={full.slice(0, shown)} entryIndex={entryIndex} />

            {position && (
              <div className="mt-2 flex items-center justify-between gap-3">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[12px] font-black uppercase tracking-wide ${
                    position.direction === 'long'
                      ? 'bg-lime-500/15 text-lime-400'
                      : 'bg-danger-500/15 text-danger-400'
                  }`}
                >
                  <Icon
                    name={position.direction === 'long' ? 'trending-up' : 'trending-down'}
                    size={14}
                  />
                  {position.direction === 'long' ? 'Long' : 'Short'} x{position.leverage}
                </span>
                <span
                  className={`text-lg font-black tabular-nums ${
                    ret >= 0 ? 'text-lime-400' : 'text-danger-400'
                  }`}
                >
                  {ret >= 0 ? '+' : ''}
                  {(ret * 100).toFixed(1)}%
                </span>
              </div>
            )}
          </div>

          {settled ? (
            <div className="mt-4 rounded-2xl border-2 border-carbon-800 bg-carbon-850 p-5 text-center">
              <p className="text-[13px] font-black uppercase tracking-[0.8px] text-carbon-500">
                {settled.liquidated ? 'Liquidado' : 'Trade cerrado'}
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
                  ? `Con x${position?.leverage} bastó un movimiento pequeño en tu contra para llevarse los ${STAKE}.`
                  : 'Monedas a tu saldo. Gástalas en la tienda.'}
              </p>
              <div className="mt-5 space-y-3">
                <Button onClick={() => navigate('/tienda')}>Ir a la tienda</Button>
                <Button variant="secondary" onClick={() => window.location.reload()}>
                  {unlimited ? 'Otro trade' : 'Volver a intentarlo'}
                </Button>
              </div>
            </div>
          ) : position ? (
            <div className="mt-4">
              <Button variant={ret >= 0 ? 'primary' : 'danger'} onClick={close} disabled={liquidated}>
                {done ? 'Cerrar y cobrar' : 'Cerrar posición'}
              </Button>
              <p className="mt-2 text-center text-[13px] text-carbon-500">
                Arriesgas {STAKE} monedas. Con x{position.leverage}, un{' '}
                {(100 / position.leverage).toFixed(0)}% en contra las borra.
              </p>
            </div>
          ) : (
            <>
              <p className="mt-5 text-[13px] font-black uppercase tracking-[0.8px] text-carbon-500">
                Apalancamiento
              </p>
              <div className="mt-2 grid grid-cols-4 gap-2">
                {LEVERAGES.map((l) => (
                  <button
                    key={l}
                    onClick={() => setLeverage(l)}
                    className={`rounded-xl border-2 py-2.5 text-sm font-black transition ${
                      leverage === l
                        ? 'border-lime-500 bg-lime-500/10 text-lime-400'
                        : 'border-carbon-800 bg-carbon-850 text-carbon-300 hover:border-carbon-700'
                    }`}
                  >
                    x{l}
                  </button>
                ))}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <Button disabled={!allowed} onClick={() => open('long')}>
                  <Icon name="trending-up" size={18} /> Long
                </Button>
                <Button disabled={!allowed} variant="danger" onClick={() => open('short')}>
                  <Icon name="trending-down" size={18} /> Short
                </Button>
              </div>

              <p className="mt-3 text-center text-[13px] text-carbon-500">
                Arriesgas {STAKE} de tus {coins} monedas.{' '}
                {unlimited
                  ? 'Con Ultra, tantos trades como quieras.'
                  : `El plan gratuito incluye ${FREE_TRADES_PER_DAY} al día.`}
              </p>
            </>
          )}

          {(denied || !allowed) && !position && (
            <div className="mt-4 rounded-2xl border-2 border-ultra-500/30 bg-ultra-500/10 p-4 text-center">
              <p className="text-sm font-bold text-ultra-300">
                Ya has hecho tu trade de hoy. Con Ultra son ilimitados.
              </p>
              <div className="mt-3 w-[200px] mx-auto">
                <Button variant="platinum" onClick={() => navigate('/planes')}>
                  Ver Ultra
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
