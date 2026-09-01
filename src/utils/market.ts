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

/** Maker fee per side: what you pay when your order sat in the book waiting
 *  instead of taking somebody else's. Around 0.02% on both Bitget and Bitunix,
 *  a third of the taker fee — and the actual reason experienced traders use
 *  limit orders, which is the lesson the order-type selector is there to
 *  teach. */
export const MAKER_FEE = 0.0002;

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

/**
 * Which pot backs the position.
 *
 * The difference people meet on their first real account, and the one that
 * empties it: isolated risks the margin you assigned, cross risks the whole
 * balance. Same trade, same leverage, completely different worst case.
 */
export type MarginMode = 'isolated' | 'cross';

/** How the position was opened. A market order crosses the spread and pays the
 *  taker fee; a limit order waits at your price and pays the maker fee. */
export type OrderType = 'market' | 'limit';

export interface Position {
  direction: Direction;
  leverage: Leverage;
  /** Coins assigned to the position. Sets the size: margin × leverage. */
  margin: number;
  entry: number;
  mode: MarginMode;
  /** Every coin available when the position opened, margin included. On cross
   *  this is what stands behind it; on isolated it's only bookkeeping. */
  wallet: number;
  /** The price that closes the position in profit. null or absent: none set,
   *  which is how every position opened before this existed is stored. */
  takeProfit?: number | null;
  /** The price that closes it at a loss you chose, instead of at the one the
   *  engine chooses for you. */
  stopLoss?: number | null;
  /** How it was opened. Absent on positions stored before limit orders
   *  existed, all of which were market orders. */
  orderType?: OrderType;
}

/** Why a round ended. */
export type ExitReason = 'liquidation' | 'takeProfit' | 'stopLoss' | 'manual';

/**
 * The most a position can cost — and what it can draw on before it dies.
 *
 * Cross puts the whole balance behind the trade, which is why a cross
 * position survives a move that would have liquidated the isolated one, and
 * why the day it does die it takes everything rather than a slice.
 *
 * Never below zero either way. On a real venue a gap can in principle leave a
 * negative balance, absorbed by the insurance fund; modelling that here would
 * mean handing somebody a debt in a game currency, which teaches nothing the
 * warning doesn't.
 */
export function backing(p: Position): number {
  return p.mode === 'cross' ? Math.max(p.margin, p.wallet) : p.margin;
}

/** Margin × leverage: what you're actually trading with. */
export function notional(p: Pick<Position, 'margin' | 'leverage'>): number {
  return p.margin * p.leverage;
}

/** Units of the asset the position controls. */
export function positionSize(p: Position): number {
  return p.entry > 0 ? notional(p) / p.entry : 0;
}

/** What the entry cost in fees, as a rate: maker if the order waited, taker if
 *  it crossed the spread. */
export function entryFeeRate(p: Position): number {
  return p.orderType === 'limit' ? MAKER_FEE : TAKER_FEE;
}

/**
 * Both sides of the fee, in coins, charged up front so the number on screen is
 * what you'd actually walk away with.
 *
 * The exit is always taker: closing at market, being liquidated and hitting a
 * stop all take whatever is there. A limit entry is the only side you can
 * choose to be paid the cheaper rate for.
 */
export function roundTripFee(p: Position, exitPrice: number): number {
  const size = positionSize(p);
  return size * p.entry * entryFeeRate(p) + size * exitPrice * TAKER_FEE;
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
  return Math.max(0, backing(p) + grossPnl(p, price) - roundTripFee(p, price));
}

/** Profit or loss as a fraction of the margin — the ROI a venue shows. */
export function roi(p: Position, price: number): number {
  if (p.margin <= 0) return 0;
  // Always against the margin, whatever backs the position: ROI is "what did
  // this trade do to the money I committed", and a cross position measured
  // against the whole wallet would flatter every result.
  return (equity(p, price) - backing(p)) / p.margin;
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
  // backing + (P - E)·size·dir - fees(P) = maintenance, fees linear in P.
  const feeIn = size * p.entry * entryFeeRate(p);
  const dir = p.direction === 'long' ? 1 : -1;
  const coefficient = size * dir - size * TAKER_FEE * (dir === 1 ? 1 : -1) * dir;
  const constant = maintenance - backing(p) + feeIn + size * dir * p.entry;
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
  const change = equity(p, price) - backing(p);
  return change >= 0 ? Math.floor(change) : Math.ceil(change);
}

/** How far the price may move against a position before it's liquidated, as a
 *  percentage — the number worth reading before pressing the button. */
export function liquidationDistance(p: Position): number {
  if (p.entry <= 0) return 0;
  return Math.abs(liquidationPrice(p) - p.entry) / p.entry;
}

/*
 * Take profit and stop loss.
 *
 * The two orders that separate trading from gambling: one decides in advance
 * what you'll settle for, the other decides in advance what you'll accept
 * losing — both while you're calm, rather than while the number is moving.
 * The lesson is that a stop *below* the liquidation price is not a stop at
 * all, so that case is named and rejected rather than quietly accepted.
 */

/** Where a trigger has to sit for the direction to make any sense. */
export function triggerIsValid(p: Position, kind: 'takeProfit' | 'stopLoss', price: number): boolean {
  if (!Number.isFinite(price) || price <= 0) return false;
  const liq = liquidationPrice(p);
  if (p.direction === 'long') {
    return kind === 'takeProfit' ? price > p.entry : price < p.entry && price > liq;
  }
  return kind === 'takeProfit' ? price < p.entry : price > p.entry && price < liq;
}

/** Whether a price range reaches a level, from the side the position cares
 *  about: a long takes profit on the way up and stops out on the way down. */
function reaches(p: Position, kind: 'takeProfit' | 'stopLoss', level: number, low: number, high: number): boolean {
  const up = (p.direction === 'long') === (kind === 'takeProfit');
  return up ? high >= level : low <= level;
}

/**
 * What ends the round inside a price range, if anything does.
 *
 * Order matters and it isn't arbitrary. Liquidation comes first because the
 * engine doesn't queue behind your orders. Then the stop, then the target:
 * within a single candle nobody can know which the price touched first, and
 * assuming the worse of the two is both what an honest backtest does and the
 * only assumption that can't flatter a result.
 */
export function triggeredBy(
  p: Position,
  low: number,
  high: number
): { price: number; reason: ExitReason } | null {
  const liq = liquidationPrice(p);
  if (p.direction === 'long' ? low <= liq : high >= liq) return { price: liq, reason: 'liquidation' };
  if (p.stopLoss != null && reaches(p, 'stopLoss', p.stopLoss, low, high)) {
    return { price: p.stopLoss, reason: 'stopLoss' };
  }
  if (p.takeProfit != null && reaches(p, 'takeProfit', p.takeProfit, low, high)) {
    return { price: p.takeProfit, reason: 'takeProfit' };
  }
  return null;
}

/**
 * The price that would leave you at a given ROI, fees included.
 *
 * Solved rather than approximated, because the fee is exactly what makes a
 * "break even" stop lose money: at 0% ROI this comes back *above* the entry
 * for a long, and seeing that is the point of showing it.
 */
export function priceForRoi(p: Position, targetRoi: number): number {
  const size = positionSize(p);
  if (size <= 0) return p.entry;
  const wanted = targetRoi * p.margin;
  const price =
    p.direction === 'long'
      ? (wanted + p.entry * size * (1 + TAKER_FEE)) / (size * (1 - TAKER_FEE))
      : (p.entry * size * (1 - TAKER_FEE) - wanted) / (size * (1 + TAKER_FEE));
  return Math.max(0, price);
}

/**
 * Whether a resting limit order would have been filled by a price range.
 *
 * A buy waits below the market and a sell above it, so a long fills on the way
 * down and a short on the way up — the opposite of the direction the position
 * then wants the price to go, which is exactly why the order can rest there in
 * the first place.
 */
export function limitFills(direction: Direction, limitPrice: number, low: number, high: number): boolean {
  return direction === 'long' ? low <= limitPrice : high >= limitPrice;
}

/**
 * Whether a limit price is on the side of the market that lets it wait.
 *
 * A buy above the market or a sell below it would be filled the instant it
 * arrived, at the current price — that's a market order wearing a limit
 * order's name, and saying so is more useful than accepting it silently.
 */
export function limitCanRest(direction: Direction, limitPrice: number, market: number): boolean {
  if (!Number.isFinite(limitPrice) || limitPrice <= 0) return false;
  return direction === 'long' ? limitPrice < market : limitPrice > market;
}
