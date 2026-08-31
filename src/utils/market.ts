/*
 * The price series behind the trading simulator, and the money it moves.
 *
 * Modelled on how a linear perpetual actually works on Bitget or Bitunix —
 * isolated margin, a notional of margin × leverage, a taker fee on both sides
 * and a maintenance margin that closes you *before* the loss reaches your
 * whole stake. The point of the feature is that somebody who plays here and
 * then opens a real account already knows what the numbers mean, so an
 * approximation that teaches the wrong lesson would be worse than nothing.
 *
 * Pure and seeded on purpose. A market you can't replay is a market you can't
 * check, and this one pays out coins that a real shop spends.
 */

export interface Candle {
  open: number;
  high: number;
  low: number;
  close: number;
}

export type Direction = 'long' | 'short';

/** The ladder the big venues offer. 100x is there because it exists and
 *  people reach for it; what it does to a position is the lesson. */
export const LEVERAGES = [1, 2, 5, 10, 20, 25, 50, 75, 100] as const;
export type Leverage = (typeof LEVERAGES)[number];

/** Taker fee per side, as a fraction of notional. Bitget and Bitunix both sit
 *  around 0.06% for takers. Charged on entry and exit, like the real thing —
 *  at 100x the round trip costs 12% of your margin before the price moves,
 *  which is the single most expensive thing beginners fail to notice. */
export const TAKER_FEE = 0.0006;

/** Maintenance margin rate. Below this fraction of notional in equity, the
 *  engine closes you. It's why a 100x position dies at roughly 0.9% against
 *  you rather than at exactly 1%. */
export const MAINTENANCE_MARGIN = 0.004;

export const HISTORY_CANDLES = 24;
export const FUTURE_CANDLES = 20;

/** Deterministic PRNG (mulberry32). Same seed, same market. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A random walk with a little drift and a little volatility clustering.
 *
 * Not a model of anything — it's a shape to read, moving enough for the
 * decision to matter and not so much that it stops mattering.
 */
export function generateCandles(seed: number, count: number, startPrice = 100): Candle[] {
  const rand = seededRandom(seed);
  const candles: Candle[] = [];
  let price = startPrice;
  const drift = (rand() - 0.5) * 0.0012;

  for (let i = 0; i < count; i++) {
    const volatility = 0.008 + rand() * 0.012;
    const open = price;
    const change = drift + (rand() - 0.5) * volatility * 2;
    const close = open * (1 + change);
    const wick = open * volatility * 0.6;
    candles.push({
      open,
      close,
      high: Math.max(open, close) + rand() * wick,
      low: Math.min(open, close) - rand() * wick,
    });
    price = close;
  }
  return candles;
}

export interface Position {
  direction: Direction;
  leverage: Leverage;
  /** Coins put up. On an isolated position this is the most that can be lost. */
  margin: number;
  entry: number;
}

/** Margin × leverage: what you're actually trading with. */
export function notional(p: Pick<Position, 'margin' | 'leverage'>): number {
  return p.margin * p.leverage;
}

/** Units of the asset the position controls. */
export function positionSize(p: Position): number {
  return p.entry > 0 ? notional(p) / p.entry : 0;
}

/** Both sides of the taker fee, in coins. Charged up front so the number on
 *  screen is what you'd actually walk away with. */
export function roundTripFee(p: Position, exitPrice: number): number {
  const size = positionSize(p);
  return size * p.entry * TAKER_FEE + size * exitPrice * TAKER_FEE;
}

/** Profit or loss before fees, in coins. */
export function grossPnl(p: Position, price: number): number {
  const size = positionSize(p);
  const move = price - p.entry;
  return (p.direction === 'long' ? move : -move) * size;
}

/**
 * What the position is worth right now, in coins, fees included — and never
 * less than zero.
 *
 * Isolated margin: the exchange closes the position before the loss can
 * exceed what you put up, so a player cannot end a round owing coins. Cross
 * margin can go further on a real venue; this simulator deliberately doesn't
 * model it, because "you can lose more than you deposited" is a lesson that
 * belongs to a warning, not to a game that pays in the app's own currency.
 */
export function equity(p: Position, price: number): number {
  return Math.max(0, p.margin + grossPnl(p, price) - roundTripFee(p, price));
}

/** Profit or loss as a fraction of the margin — the ROI a venue shows. */
export function roi(p: Position, price: number): number {
  if (p.margin <= 0) return 0;
  return (equity(p, price) - p.margin) / p.margin;
}

/**
 * The price at which the engine takes the position.
 *
 * Solved from equity = maintenance margin, so it accounts for both the fee
 * and the maintenance rate — which is why it arrives slightly *before* the
 * naive "100 / leverage per cent" figure everybody quotes.
 */
export function liquidationPrice(p: Position): number {
  const size = positionSize(p);
  if (size <= 0) return 0;
  const maintenance = notional(p) * MAINTENANCE_MARGIN;
  // margin + (P - E)·size·dir - fees(P) = maintenance, with fees linear in P.
  const feeIn = size * p.entry * TAKER_FEE;
  const dir = p.direction === 'long' ? 1 : -1;
  // size·dir·P - size·TAKER_FEE·P = maintenance - margin + feeIn + size·dir·E
  const coefficient = size * dir - size * TAKER_FEE * (dir === 1 ? 1 : -1) * dir;
  const constant = maintenance - p.margin + feeIn + size * dir * p.entry;
  const price = constant / coefficient;
  return Math.max(0, price);
}

/**
 * True once the price has reached the liquidation price.
 *
 * Compared as prices, not as equity: that's what the screen shows, what a
 * venue's engine actually watches, and it sidesteps a floating-point
 * comparison that had a position at exactly its liquidation price counting as
 * alive at some leverages and dead at others.
 */
export function isLiquidated(p: Position, price: number): boolean {
  const liq = liquidationPrice(p);
  // A hair of tolerance so "exactly the liquidation price" always liquidates,
  // whichever way the arithmetic rounded on the way there.
  const epsilon = p.entry * 1e-9;
  return p.direction === 'long' ? price <= liq + epsilon : price >= liq - epsilon;
}

/**
 * Coins credited or debited when a position closes, rounded towards the
 * player in both directions.
 *
 * Returns the change to the balance: negative is what the round cost, and it
 * can never be worse than the margin.
 */
export function settleCoins(p: Position, price: number): number {
  const change = equity(p, price) - p.margin;
  return change >= 0 ? Math.floor(change) : Math.ceil(change);
}

/** How far the price may move against a position before it's liquidated, as a
 *  percentage — the number worth reading before pressing the button. */
export function liquidationDistance(p: Position): number {
  if (p.entry <= 0) return 0;
  return Math.abs(liquidationPrice(p) - p.entry) / p.entry;
}
