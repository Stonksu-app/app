/*
 * The price series behind the trading simulator, and the money it moves.
 *
 * Pure and seeded on purpose. A market you can't replay is a market you can't
 * check, and the one thing this feature must never do is pay out differently
 * from what the screen showed — coins are spent in a real shop.
 */

export interface Candle {
  open: number;
  high: number;
  low: number;
  close: number;
}

export type Direction = 'long' | 'short';

/** Leverages on offer. Beyond ten, a two percent move wipes a position out
 *  before the chart has finished drawing, which teaches nothing. */
export const LEVERAGES = [1, 2, 5, 10] as const;
export type Leverage = (typeof LEVERAGES)[number];

/** Candles drawn before you decide, and after. The first half is what you
 *  read; the second is what happens. */
export const HISTORY_CANDLES = 24;
export const FUTURE_CANDLES = 20;

/** A position dies here, exactly as it would on a real venue: lose the margin
 *  and the position is gone. Capping the loss at the stake is also what makes
 *  it honest to let anyone play — nobody can end a round owing coins. */
export const LIQUIDATION_LOSS = -1;

/** Deterministic PRNG (mulberry32). Same seed, same market — which is what
 *  lets a check assert a payout rather than hope for one. */
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
 * Not a model of anything — it's a shape to read. What matters is that it
 * moves enough for a decision to be worth making and not so much that the
 * decision stops mattering.
 */
export function generateCandles(seed: number, count: number, startPrice = 100): Candle[] {
  const rand = seededRandom(seed);
  const candles: Candle[] = [];
  let price = startPrice;
  // Drift is small next to volatility, so neither direction is the safe bet.
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

/**
 * What a position is worth, as a fraction of the stake.
 *
 * -1 means the stake is gone and the position liquidated; +0.5 means half the
 * stake in profit. Leverage multiplies the move, and the floor is what stops
 * a 10x position turning a bad round into a debt.
 */
export function positionReturn(
  entry: number,
  price: number,
  direction: Direction,
  leverage: Leverage
): number {
  if (entry <= 0) return 0;
  const move = (price - entry) / entry;
  const signed = direction === 'long' ? move : -move;
  return Math.max(LIQUIDATION_LOSS, signed * leverage);
}

/** True once the position is worth nothing — the round ends here, whatever
 *  the price does afterwards, exactly as a real liquidation would. */
export function isLiquidated(returnPct: number): boolean {
  return returnPct <= LIQUIDATION_LOSS;
}

/**
 * Coins won or lost, rounded towards the player on a win and away on a loss.
 *
 * Rounding is stated rather than left to Math.round because the two directions
 * are not symmetric: a 0.5-coin profit paying 1 is generous, a 0.5-coin loss
 * charging 1 is not, and the difference is exactly the kind of thing nobody
 * notices until it has happened a hundred times.
 */
export function coinsFromReturn(stake: number, returnPct: number): number {
  const raw = stake * returnPct;
  return raw >= 0 ? Math.floor(raw) : Math.ceil(raw);
}
