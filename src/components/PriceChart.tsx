import { useEffect, useRef } from 'react';
import {
  CandlestickSeries,
  createChart,
  type CandlestickData,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from 'lightweight-charts';
import type { TimedCandle } from '../lib/marketData';

/*
 * TradingView's Lightweight Charts, dressed in the app's own colours.
 *
 * Theirs rather than ours because this screen exists so that opening a real
 * account later feels familiar, and this is the chart most venues draw. The
 * palette is the app's: the same lime and red the lessons use for bullish and
 * bearish, so a candle means the same thing here as it does three screens
 * away.
 */

const UP = '#C6FF34';
const DOWN = '#FF5252';

export default function PriceChart({
  candles,
  entry,
  liquidation,
  height = 220,
  auto = true,
  onUserMoved,
}: {
  candles: TimedCandle[];
  entry: number | null;
  liquidation: number | null;
  height?: number;
  /** Auto-fit, the way a venue's AUTO button behaves: on, the view follows the
   *  price; off, it stays exactly where you dragged it. */
  auto?: boolean;
  /** Fired the first time a gesture moves the view, so the page can turn AUTO
   *  off by itself — snapping back mid-drag is the thing that makes a chart
   *  feel broken. */
  onUserMoved?: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const series = useRef<ISeriesApi<'Candlestick'> | null>(null);

  // Created once. Re-creating it per render would throw the zoom away on
  // every tick, which on a live chart is every few hundred milliseconds.
  useEffect(() => {
    if (!box.current) return;
    const c = createChart(box.current, {
      height,
      layout: {
        background: { color: 'transparent' },
        textColor: '#8f8f8f',
        fontFamily: 'inherit',
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: 'rgba(38,38,38,0.6)' },
        horzLines: { color: 'rgba(38,38,38,0.6)' },
      },
      rightPriceScale: { borderColor: '#262626' },
      timeScale: { borderColor: '#262626', timeVisible: true, secondsVisible: false },
      crosshair: { mode: 0 },
      // Pan and zoom, like any chart worth reading. Scrolling the page still
      // works because the chart only claims the gesture inside its own box.
      handleScale: { axisPressedMouseMove: true, mouseWheel: true, pinch: true },
      handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
    });
    const s = c.addSeries(CandlestickSeries, {
      upColor: UP,
      downColor: DOWN,
      wickUpColor: UP,
      wickDownColor: DOWN,
      borderVisible: false,
    });
    chart.current = c;
    series.current = s;

    const resize = () => c.applyOptions({ width: box.current?.clientWidth ?? 0 });
    resize();
    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('resize', resize);
      c.remove();
      chart.current = null;
      series.current = null;
    };
  }, [height]);

  // A gesture on the chart means you want to look somewhere: tell the page.
  useEffect(() => {
    const c = chart.current;
    if (!c || !onUserMoved) return;
    const handler = () => onUserMoved();
    c.timeScale().subscribeVisibleLogicalRangeChange(handler);
    return () => c.timeScale().unsubscribeVisibleLogicalRangeChange(handler);
  }, [onUserMoved]);

  useEffect(() => {
    if (!series.current || candles.length === 0) return;
    // The library's own time type: a branded number, so the seconds we
    // already have have to be handed over as such rather than coerced.
    series.current.setData(
      candles.map(
        (c): CandlestickData<UTCTimestamp> => ({
          time: c.time as UTCTimestamp,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        })
      )
    );
    if (auto) chart.current?.timeScale().fitContent();
  }, [candles, auto]);

  // Re-fitting the moment AUTO goes back on is what the button is for.
  useEffect(() => {
    if (auto) chart.current?.timeScale().fitContent();
  }, [auto]);

  // Entry and liquidation as price lines rather than drawings: the chart keeps
  // them pinned to the scale as it moves, and puts the number on the axis —
  // which is exactly where a venue shows them.
  useEffect(() => {
    const s = series.current;
    if (!s) return;
    const lines = [
      entry !== null
        ? s.createPriceLine({ price: entry, color: '#8f8f8f', lineWidth: 1, lineStyle: 2, title: 'Entrada' })
        : null,
      liquidation !== null
        ? s.createPriceLine({ price: liquidation, color: DOWN, lineWidth: 1, lineStyle: 2, title: 'Liq.' })
        : null,
    ];
    return () => {
      lines.forEach((l) => l && s.removePriceLine(l));
    };
  }, [entry, liquidation]);

  return <div ref={box} className="w-full" aria-label="Gráfico de precio" role="img" />;
}
