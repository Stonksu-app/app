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

/**
 * One order the chart can offer at the price you right-clicked.
 *
 * Built by whoever owns the trading rules and handed down as data, so this
 * component stays what it is — geometry and a menu. It knows how to turn a
 * click into a price; it has no business knowing what a margin call is.
 */
export interface ChartAction {
  label: string;
  hint?: string;
  onSelect: () => void;
  disabled?: boolean;
  /** Long or short, so the item can wear the colour of the side it opens. */
  tone?: 'long' | 'short';
}

/** Roughly the menu's own size, used only to keep it inside the chart when it
 *  opens near an edge. Being a few pixels off is invisible; opening half
 *  outside the box is not. */
const MENU_W = 236;
const MENU_H = 430;

/**
 * How many candles the chart shows when it's driving.
 *
 * The series holds far more than this — history you can pan back through once
 * AUTO is off. Fitting all of it would be the wrong reading of "auto": a
 * thousand candles squeezed into the width of a phone is a texture, not a
 * price, and the recent ones are what a running position is about. So the
 * chart parks itself at the right-hand end and leaves the rest behind it.
 */
const VISIBLE_BARS = 120;

export default function PriceChart({
  candles,
  entry,
  liquidation,
  takeProfit = null,
  stopLoss = null,
  labels,
  height = 220,
  auto = true,
  onAutoChange,
  actionsAt,
  targets,
}: {
  candles: TimedCandle[];
  entry: number | null;
  liquidation: number | null;
  /** Where the position closes itself, in profit and at a loss. Drawn in their
   *  own colours: the stop is amber and not red, so it can't be mistaken at a
   *  glance for the liquidation line right under it. */
  takeProfit?: number | null;
  stopLoss?: number | null;
  /**
   * What each level is worth, written on the line itself.
   *
   * A target at 78.433,88 says nothing you can act on; "+280 monedas" is the
   * question you were actually asking. The amounts are computed by whoever
   * owns the position — fees, leverage and margin mode all land in them — and
   * arrive here already said in words.
   */
  labels?: { entry?: string; liquidation?: string; takeProfit?: string; stopLoss?: string };
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
  /**
   * What can be ordered at the price under the pointer.
   *
   * Asked at the moment of the right-click rather than kept in state, because
   * the answer depends on where the market is right now — a limit that could
   * rest a second ago is a market order once the price crosses it.
   */
  actionsAt?: (price: number) => ChartAction[];
  /**
   * The targets you can grab and move, the way a venue lets you.
   *
   * Typing a price is fine when you already know it; a level is something you
   * pick by looking at the chart, and dragging is how you say "there" without
   * translating it into a number first. `validAt` is asked while you drag so
   * the handle can refuse before you let go, rather than swallowing the drop
   * and leaving you wondering.
   */
  targets?: {
    takeProfit: number | null;
    stopLoss: number | null;
    validAt: (kind: 'takeProfit' | 'stopLoss', price: number) => boolean;
    onDrop: (kind: 'takeProfit' | 'stopLoss', price: number) => void;
  };
}) {
  const box = useRef<HTMLDivElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const series = useRef<ISeriesApi<'Candlestick'> | null>(null);

  const [scale, setScale] = useState<ScaleState>(INITIAL_SCALE);
  const [menu, setMenu] = useState<{ x: number; y: number; price: number | null } | null>(null);
  /** The target currently under the finger, and where it is right now. */
  const [dragging, setDragging] = useState<{ kind: 'takeProfit' | 'stopLoss'; price: number } | null>(null);
  /*
   * Bumped whenever the chart moves, so the handles are re-placed against it.
   *
   * They live in the DOM, not on the canvas, so nothing repositions them on
   * their own: pan, zoom or a rescale would leave them floating at a price
   * that's no longer under them. New candles arrive as a prop and re-render
   * by themselves; panning and zooming need to be listened for.
   */
  const [, setMoved] = useState(0);
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
  const openMenu = useCallback((clientX: number, clientY: number, withPrice = false) => {
    const rect = wrap.current?.getBoundingClientRect();
    if (!rect) return;
    const x = clientX + MENU_W > window.innerWidth ? clientX - MENU_W : clientX;
    const y = clientY + MENU_H > window.innerHeight ? clientY - MENU_H : clientY;
    /* The price under the pointer, read off the series rather than guessed
       from the visible range: the axis can be logarithmic or inverted, and
       only the chart knows which. Null when the menu comes from the gear,
       which is a button in a corner and not a price. */
    const boxRect = box.current?.getBoundingClientRect();
    const raw =
      withPrice && boxRect && series.current
        ? series.current.coordinateToPrice(clientY - boxRect.top)
        : null;
    setMenu({
      x: Math.max(8, x) - rect.left,
      y: Math.max(8, y) - rect.top,
      price: typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? raw : null,
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
  // Pan and zoom, so the handles follow the price they're pinned to.
  useEffect(() => {
    const c = chart.current;
    if (!c || !targets) return;
    const bump = () => setMoved((n) => n + 1);
    c.timeScale().subscribeVisibleLogicalRangeChange(bump);
    return () => c.timeScale().unsubscribeVisibleLogicalRangeChange(bump);
  }, [targets]);

  /** Park the view on the newest candles without throwing the older ones away. */
  const showRecent = useCallback(() => {
    const c = chart.current;
    if (!c || candles.length === 0) return;
    c.timeScale().setVisibleLogicalRange({
      from: Math.max(0, candles.length - VISIBLE_BARS),
      to: candles.length,
    });
  }, [candles.length]);

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
    if (auto) showRecent();
  }, [auto, showRecent]);

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
    if (auto) showRecent();
  }, [candles, auto, showRecent]);

  // Entry and liquidation as price lines rather than drawings: the chart keeps
  // them pinned to the scale as it moves, and puts the number on the axis —
  // which is exactly where a venue shows them.
  useEffect(() => {
    const s = series.current;
    if (!s) return;
    const lines = [
      entry !== null
        ? s.createPriceLine({ price: entry, color: '#8f8f8f', lineWidth: 1, lineStyle: 2, title: labels?.entry ?? 'Entrada' })
        : null,
      liquidation !== null
        ? s.createPriceLine({ price: liquidation, color: DOWN, lineWidth: 1, lineStyle: 2, title: labels?.liquidation ?? 'Liq.' })
        : null,
      takeProfit !== null
        ? s.createPriceLine({ price: takeProfit, color: UP, lineWidth: 1, lineStyle: 3, title: labels?.takeProfit ?? 'TP' })
        : null,
      stopLoss !== null
        ? s.createPriceLine({ price: stopLoss, color: WARN, lineWidth: 1, lineStyle: 3, title: labels?.stopLoss ?? 'SL' })
        : null,
    ];
    return () => {
      lines.forEach((l) => l && s.removePriceLine(l));
    };
  }, [entry, liquidation, takeProfit, stopLoss, labels?.entry, labels?.liquidation, labels?.takeProfit, labels?.stopLoss]);

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
        /* A click on the candles puts the menu away. The listener below only
           catches clicks outside the whole chart, which left the odd case of
           a menu sitting open over the very thing you were trying to look at.
           Safe on the press that opens it too: pointerdown runs first and
           contextmenu re-opens it a moment later, at the new place. */
        onPointerDown={() => setMenu(null)}
        onContextMenu={(e) => {
          e.preventDefault();
          openMenu(e.clientX, e.clientY, true);
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

      {/* The grab handles. Only for targets that exist: putting one where
          there is no target would be offering to drag nothing. */}
      {targets &&
        (['takeProfit', 'stopLoss'] as const).map((kind) => {
          const live = dragging?.kind === kind ? dragging.price : targets[kind];
          if (live == null) return null;
          const y = series.current?.priceToCoordinate(live);
          if (y == null) return null;
          const held = dragging?.kind === kind;
          const ok = !held || targets.validAt(kind, live);
          return (
            <button
              key={kind}
              type="button"
              aria-label={`Mover ${kind === 'takeProfit' ? 'take profit' : 'stop loss'}`}
              onPointerDown={(e) => {
                // Kept off the canvas underneath: with AUTO off a drag there
                // pans the chart, and the target would slide away from the
                // finger that was supposed to be carrying it.
                e.preventDefault();
                e.stopPropagation();
                e.currentTarget.setPointerCapture(e.pointerId);
                setDragging({ kind, price: live });
              }}
              onPointerMove={(e) => {
                if (dragging?.kind !== kind) return;
                const rect = box.current?.getBoundingClientRect();
                if (!rect || !series.current) return;
                const at = series.current.coordinateToPrice(e.clientY - rect.top);
                if (typeof at === 'number' && Number.isFinite(at) && at > 0) setDragging({ kind, price: at });
              }}
              onPointerUp={() => {
                if (dragging?.kind !== kind) return;
                const dropped = dragging.price;
                setDragging(null);
                // Refused rather than clamped: a stop dropped past the
                // liquidation isn't a stop the venue could honour, and moving
                // it somewhere you didn't point at is worse than not moving it.
                if (targets.validAt(kind, dropped)) targets.onDrop(kind, dropped);
              }}
              style={{ top: y - 11, left: 8 }}
              className={`absolute z-20 touch-none cursor-ns-resize select-none rounded-md border-2 px-1.5 py-0.5 text-[11px] font-black tabular-nums transition-colors ${
                !ok
                  ? 'border-danger-500 bg-danger-500/25 text-danger-400'
                  : kind === 'takeProfit'
                  ? 'border-lime-500/60 bg-carbon-900/90 text-lime-400'
                  : 'border-[#FFC93C]/60 bg-carbon-900/90 text-[#FFC93C]'
              }`}
            >
              {kind === 'takeProfit' ? 'TP' : 'SL'}
              {held && ` ${live.toFixed(2)}`}
              {held && !ok && ' ✕'}
            </button>
          );
        })}

      {menu && (
        <div
          role="menu"
          style={{ left: menu.x, top: menu.y, width: MENU_W }}
          className="absolute z-30 rounded-2xl border-2 border-carbon-700 bg-carbon-900 py-1.5 shadow-2xl overflow-hidden"
        >
          {/* Orders first, and the price they'd use as the heading. It's the
              reason you right-clicked *there* rather than anywhere else, and
              a menu that buries it under four scale modes is a menu you stop
              opening. Empty when the gear opened this, or when nothing can be
              ordered at that level. */}
          {menu.price !== null && actionsAt && actionsAt(menu.price).length > 0 && (
            <>
              <p className="px-3 pt-1 pb-1.5 text-[11px] font-black uppercase tracking-[0.6px] text-carbon-500 tabular-nums">
                {menu.price.toFixed(2)} USDT
              </p>
              {actionsAt(menu.price).map((a) => (
                <button
                  key={a.label}
                  type="button"
                  role="menuitem"
                  disabled={a.disabled}
                  className={`${item} disabled:opacity-40 disabled:hover:bg-transparent ${
                    a.disabled ? '' : a.tone === 'long' ? 'text-lime-400' : a.tone === 'short' ? 'text-danger-400' : ''
                  }`}
                  onClick={() => {
                    setMenu(null);
                    a.onSelect();
                  }}
                >
                  <span className="w-4 shrink-0">
                    {a.tone && <Icon name={a.tone === 'long' ? 'trending-up' : 'trending-down'} size={14} strokeWidth={3} />}
                  </span>
                  <span>
                    {a.label}
                    {a.hint && (
                      <span className="block text-[11px] font-semibold text-carbon-500">{a.hint}</span>
                    )}
                  </span>
                </button>
              ))}
              <div className="my-1 h-px bg-carbon-800" />
            </>
          )}

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
