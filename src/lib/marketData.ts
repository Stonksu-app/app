import type { Candle, Direction, Position } from '../utils/market';
import { liquidationPrice } from '../utils/market';

/*
 * Real market data for the simulator.
 *
 * Binance's public endpoints: no key, permissive CORS, and the same candles
 * every venue draws. TradingView, despite the name people reach for, does not
 * sell or give away market data — they give away a chart library, which is the
 * other half of this and lives in the page.
 *
 * Everything here can fail: a phone on a train, a country that blocks the
 * host, an exchange having a bad afternoon. Every function says so in its
 * return type rather than throwing, because the simulator has a working
 * offline market to fall back to and the fallback is only useful if the
 * caller can tell.
 */

const REST = 'https://api.binance.com/api/v3';
const STREAM = 'wss://stream.binance.com:9443/ws';

/** The pair the simulator trades. Deep, always moving, and the one everybody
 *  recognises — the point is that the shape on screen is a shape they'll see
 *  again on a real venue. */
export const SYMBOL = 'BTCUSDT';
export const INTERVAL = '1m';

interface RawKline extends Array<unknown> {
  0: number; // open time
  1: string; // open
  2: string; // high
  3: string; // low
  4: string; // close
}

/** Candles plus the time each one opened, which the chart needs and the
 *  simulator's own maths doesn't. */
export interface TimedCandle extends Candle {
  /** Unix seconds, as Lightweight Charts wants it. */
  time: number;
}

function toCandle(k: RawKline): TimedCandle {
  return {
    time: Math.floor(k[0] / 1000),
    open: Number(k[1]),
    high: Number(k[2]),
    low: Number(k[3]),
    close: Number(k[4]),
  };
}

/**
 * The last `limit` candles.
 *
 * Returns null rather than throwing: the caller has a simulated market to fall
 * back on, and "the network is down" is a normal state on a phone, not an
 * error worth an exception.
 */
export async function fetchCandles(limit = 120, startTime?: number): Promise<TimedCandle[] | null> {
  try {
    const params = new URLSearchParams({
      symbol: SYMBOL,
      interval: INTERVAL,
      limit: String(Math.min(1000, limit)),
    });
    if (startTime) params.set('startTime', String(startTime));
    const res = await fetch(`${REST}/klines?${params}`);
    if (!res.ok) return null;
    const raw = (await res.json()) as RawKline[];
    if (!Array.isArray(raw) || raw.length === 0) return null;
    return raw.map(toCandle);
  } catch {
    return null;
  }
}

/**
 * Live trades, as a price per tick.
 *
 * Returns a function that closes the socket. Reconnects once on an unexpected
 * drop — a phone that changes network mid-position shouldn't freeze the price
 * at whatever it last heard, which would quietly stop a losing position from
 * ever being liquidated.
 */
export function subscribePrice(onPrice: (price: number) => void): () => void {
  let socket: WebSocket | null = null;
  let closed = false;
  let retry: ReturnType<typeof setTimeout> | null = null;

  const connect = () => {
    if (closed) return;
    try {
      socket = new WebSocket(`${STREAM}/${SYMBOL.toLowerCase()}@trade`);
      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data as string) as { p?: string };
          const price = Number(data.p);
          if (Number.isFinite(price) && price > 0) onPrice(price);
        } catch {
          /* A malformed frame is not worth tearing the socket down for. */
        }
      };
      socket.onclose = () => {
        if (closed) return;
        retry = setTimeout(connect, 2000);
      };
      socket.onerror = () => socket?.close();
    } catch {
      /* Sockets can be blocked outright — the caller's fallback handles it. */
    }
  };

  connect();

  return () => {
    closed = true;
    if (retry) clearTimeout(retry);
    socket?.close();
  };
}

/**
 * Whether a position was liquidated at some point in a stretch of candles.
 *
 * The reason this exists: a live position keeps running while the app is
 * closed, exactly as it would on a real venue. On return, the current price
 * alone can't answer "did it survive?" — a wick can take a position out and
 * the price can come back. So the path is replayed from the candles, using
 * each one's low for a long and high for a short, which is what a matching
 * engine watches.
 *
 * Returns the liquidation price when it was hit, or null if it survived.
 */
export function liquidationDuring(p: Position, candles: Candle[]): number | null {
  const liq = liquidationPrice(p);
  for (const c of candles) {
    const hit = p.direction === 'long' ? c.low <= liq : c.high >= liq;
    if (hit) return liq;
  }
  return null;
}

/** The worst price a position saw in a stretch — what a venue would have
 *  matched against, and the honest price to settle a liquidation at. */
export function worstPrice(direction: Direction, candles: Candle[]): number | null {
  if (candles.length === 0) return null;
  return direction === 'long'
    ? Math.min(...candles.map((c) => c.low))
    : Math.max(...candles.map((c) => c.high));
}
