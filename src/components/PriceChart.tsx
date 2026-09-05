import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CandlestickSeries,
  PriceScaleMode,
  createChart,
  type CandlestickData,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from 'lightweight-charts';
import Icon from './Icon';
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
const WARN = '#FFC93C';
const BORDER = '#262626';

/**
 * What the right-click menu on the price axis can change.
 *
 * The same handful of settings every venue puts there, and the reason this
 * screen exists: somebody who learns here that the axis has a menu will go
 * looking for it on a real chart, and find it.
 */
interface ScaleState {
  invertScale: boolean;
  mode: PriceScaleMode;
  side: 'left' | 'right';
}

const INITIAL_SCALE: ScaleState = {
  invertScale: false,
  mode: PriceScaleMode.Normal,
  side: 'right',
};

const MODES: { mode: PriceScaleMode; label: string; hint: string }[] = [
  { mode: PriceScaleMode.Normal, label: 'Regular', hint: 'El precio, tal cual' },
  { mode: PriceScaleMode.Percentage, label: 'Porcentaje', hint: 'Cuánto se ha movido desde la izquierda' },
  { mode: PriceScaleMode.IndexedTo100, label: 'Indexado a 100', hint: 'Lo mismo, empezando en 100' },
  { mode: PriceScaleMode.Logarithmic, label: 'Logarítmica', hint: 'Misma distancia por cada % igual' },
];

/** Roughly the menu's own size, used only to keep it inside the chart when it
 *  opens near an edge. Being a few pixels off is invisible; opening half
 *  outside the box is not. */
const MENU_W = 236;
const MENU_H = 430;

export default function PriceChart({
  candles,
  entry,
  liquidation,
  takeProfit = null,
  stopLoss = null,
  height = 220,
  auto = true,
  onAutoChange,
}: {
  candles: TimedCandle[];
  entry: number | null;
  liquidation: number | null;
  /** Where the position closes itself, in profit and at a loss. Drawn in their
   *  own colours: the stop is amber and not red, so it can't be mistaken at a
   *  glance for the liquidation line right under it. */
  takeProfit?: number | null;
  stopLoss?: number | null;
  height?: number;
  /**
   * Who drives the view: the chart or you.
   *
   * On, the chart drives — it keeps the price fitted to the screen and doesn't
   * take your gestures at all, so a swipe over it scrolls the page like any
   * other part of it. Off, you drive: pan, zoom and drag it up and down to
   * wherever you want to look, and it stays there.
   *
   * A deliberate switch and not something a stray touch flips, because a chart
   * that unlocks itself the moment you brush it is a chart that never sits
   * still while you read it.
   */
  auto?: boolean;
  /** Flip AUTO from the chart's own menu. */
  onAutoChange?: (auto: boolean) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const series = useRef<ISeriesApi<'Candlestick'> | null>(null);

  const [scale, setScale] = useState<ScaleState>(INITIAL_SCALE);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  // Mirrored in a ref because the chart is created once, in an effect that
  // deliberately doesn't re-run: without this it would come back with the
  // library's defaults and silently undo whatever the menu had set.
  const scaleRef = useRef(scale);

  /**
   * Push a scale setting onto the chart and remember it.
   *
   * `force` is for the moment right after the chart is built, when nothing has
   * changed but everything still has to be applied.
   */
  const applyScale = useCallback((next: ScaleState, force = false) => {
    const c = chart.current;
    const s = series.current;
    if (!c || !s) return;
    if (force || next.side !== scaleRef.current.side) {
      s.applyOptions({ priceScaleId: next.side });
      c.applyOptions({
        leftPriceScale: { visible: next.side === 'left', borderColor: BORDER },
        rightPriceScale: { visible: next.side === 'right', borderColor: BORDER },
      });
    }
    // Always against the side we just moved to, or the settings would land on
    // the axis nobody is looking at any more.
    c.priceScale(next.side).applyOptions({
      invertScale: next.invertScale,
      mode: next.mode,
    });
    scaleRef.current = next;
    setScale(next);
  }, []);

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
      rightPriceScale: { borderColor: BORDER },
      leftPriceScale: { borderColor: BORDER },
      timeScale: { borderColor: BORDER, timeVisible: true, secondsVisible: false },
      crosshair: { mode: 0 },
      // Whether the chart accepts gestures is AUTO's business, applied in the
      // effect below. It starts locked, which is where AUTO starts.
      handleScale: false,
      handleScroll: false,
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
    applyScale(scaleRef.current, true);

    // The phone's chart/order switch changes the container without resizing
    // the window. Keep the chart mounted, but resize when its panel returns.
    const resize = () => {
      const width = box.current?.clientWidth ?? 0;
      if (width > 0) c.applyOptions({ width });
    };
    const observer = new ResizeObserver(resize);
    observer.observe(box.current);
    resize();
    return () => {
      observer.disconnect();
      c.remove();
      chart.current = null;
      series.current = null;
    };
  }, [height, applyScale]);

  /**
   * Open the menu at a point, flipping it so it stays on screen.
   *
   * Measured against the window rather than against the chart: the menu is
   * taller than the chart is, so clamping it to the box would only ever pin it
   * to the top. Flipping up when it doesn't fit below is what puts it on the
   * screen and, as it happens, what a venue does with the gear in the corner.
   */
  const openMenu = useCallback((clientX: number, clientY: number) => {
    const rect = wrap.current?.getBoundingClientRect();
    if (!rect) return;
    const x = clientX + MENU_W > window.innerWidth ? clientX - MENU_W : clientX;
    const y = clientY + MENU_H > window.innerHeight ? clientY - MENU_H : clientY;
    setMenu({
      x: Math.max(8, x) - rect.left,
      y: Math.max(8, y) - rect.top,
    });
  }, []);

  // Closing on any click elsewhere, on Escape, or on a scroll — the three ways
  // anybody expects a menu like this to go away.
  useEffect(() => {
    if (!menu) return;
    const away = (e: PointerEvent) => {
      if (!(e.target instanceof Node) || !wrap.current?.contains(e.target)) setMenu(null);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenu(null);
    };
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', key);
    window.addEventListener('scroll', () => setMenu(null), { once: true });
    return () => {
      document.removeEventListener('pointerdown', away);
      document.removeEventListener('keydown', key);
    };
  }, [menu]);

  /*
   * AUTO, applied to the chart.
   *
   * Two things at once, and they're the same idea: whether the price axis
   * rescales itself, and whether the chart accepts a gesture at all. With AUTO
   * on it takes none of them — no pan, no zoom, no dragging the axis — so the
   * view can't be nudged out from under a re-fit that's about to happen
   * anyway, and a swipe over the chart scrolls the page like it does anywhere
   * else. Turn it off and everything is yours to move.
   *
   * Handing back the gestures is also what makes vertical dragging possible at
   * all: the library refuses to move the price while the axis is on auto, and
   * treats a vertical touch drag as page scrolling unless told otherwise.
   */
  useEffect(() => {
    const c = chart.current;
    if (!c) return;
    c.priceScale(scaleRef.current.side).applyOptions({ autoScale: auto });
    c.applyOptions({
      handleScroll: auto
        ? false
        : { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: true },
      handleScale: auto ? false : { axisPressedMouseMove: true, mouseWheel: true, pinch: true },
    });
    if (auto) c.timeScale().fitContent();
  }, [auto]);

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
      takeProfit !== null
        ? s.createPriceLine({ price: takeProfit, color: UP, lineWidth: 1, lineStyle: 3, title: 'TP' })
        : null,
      stopLoss !== null
        ? s.createPriceLine({ price: stopLoss, color: WARN, lineWidth: 1, lineStyle: 3, title: 'SL' })
        : null,
    ];
    return () => {
      lines.forEach((l) => l && s.removePriceLine(l));
    };
  }, [entry, liquidation, takeProfit, stopLoss]);

  const item =
    'w-full flex items-center gap-2 px-3 py-2 text-left text-[13px] font-bold text-carbon-200 hover:bg-carbon-800 transition';
  const tick = (on: boolean) => (
    <span className="w-4 shrink-0 text-lime-400">{on ? <Icon name="check" size={14} strokeWidth={3} /> : null}</span>
  );

  return (
    <div ref={wrap} className="relative w-full">
      <div
        ref={box}
        className="w-full"
        aria-label="Gráfico de precio"
        role="img"
        onContextMenu={(e) => {
          e.preventDefault();
          openMenu(e.clientX, e.clientY);
        }}
      />

      {/* The venue's own gear on the axis. It's here and not only on
          right-click because on a phone there is no right-click. */}
      <button
        type="button"
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          if (menu) setMenu(null);
          else openMenu(r.left, r.top);
        }}
        aria-label="Opciones de la escala de precio"
        aria-haspopup="menu"
        aria-expanded={menu !== null}
        className={`absolute bottom-1 ${scale.side === 'right' ? 'right-1' : 'left-1'} h-7 w-7 rounded-full border-2 border-carbon-700 bg-carbon-900/90 text-carbon-400 flex items-center justify-center hover:text-lime-400 hover:border-carbon-600 transition`}
      >
        <Icon name="ruler" size={14} />
      </button>

      {menu && (
        <div
          role="menu"
          style={{ left: menu.x, top: menu.y, width: MENU_W }}
          className="absolute z-30 rounded-2xl border-2 border-carbon-700 bg-carbon-900 py-1.5 shadow-2xl overflow-hidden"
        >
          <button
            type="button"
            role="menuitem"
            className={item}
            onClick={() => {
              applyScale({ ...INITIAL_SCALE, side: scale.side });
              onAutoChange?.(true);
              setMenu(null);
            }}
          >
            <span className="w-4 shrink-0 text-carbon-400">
              <Icon name="refresh" size={14} />
            </span>
            Restablecer escala
          </button>

          <div className="my-1 h-px bg-carbon-800" />

          <button
            type="button"
            role="menuitemcheckbox"
            aria-checked={auto}
            className={item}
            onClick={() => {
              onAutoChange?.(!auto);
              setMenu(null);
            }}
          >
            {tick(auto)}
            <span>
              Auto
              <span className="block text-[11px] font-semibold text-carbon-500">
                {auto
                  ? 'El gráfico se ajusta solo y no se deja mover'
                  : 'Lo mueves tú: arrastra, haz zoom, mira donde quieras'}
              </span>
            </span>
          </button>

          <button
            type="button"
            role="menuitemcheckbox"
            aria-checked={scale.invertScale}
            className={item}
            onClick={() => applyScale({ ...scale, invertScale: !scale.invertScale })}
          >
            {tick(scale.invertScale)}
            Invertir escala
          </button>

          <div className="my-1 h-px bg-carbon-800" />

          {MODES.map((m) => (
            <button
              key={m.label}
              type="button"
              role="menuitemradio"
              aria-checked={scale.mode === m.mode}
              className={item}
              onClick={() => applyScale({ ...scale, mode: m.mode })}
            >
              {tick(scale.mode === m.mode)}
              <span>
                {m.label}
                <span className="block text-[11px] font-semibold text-carbon-500">{m.hint}</span>
              </span>
            </button>
          ))}

          <div className="my-1 h-px bg-carbon-800" />

          <button
            type="button"
            role="menuitem"
            className={item}
            onClick={() => {
              applyScale({ ...scale, side: scale.side === 'right' ? 'left' : 'right' });
              setMenu(null);
            }}
          >
            <span className="w-4 shrink-0" />
            Mover escala a la {scale.side === 'right' ? 'izquierda' : 'derecha'}
          </button>
        </div>
      )}
    </div>
  );
}
