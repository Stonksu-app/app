import { useState } from 'react';
import Icon from './Icon';
import { useUserStore } from '../store/useUserStore';

/*
 * The position history, the way a venue lists it.
 *
 * Not a scoreboard: a record to read afterwards. Which is why every row says
 * *how* the trade ended rather than only what it paid — "liquidado a 100x" and
 * "cerré yo con pérdidas" are the same red number and completely different
 * mistakes, and the one worth learning from is the one that keeps repeating.
 */

const REASONS: Record<string, { label: string; tone: string }> = {
  liquidation: { label: 'Liquidado', tone: 'text-danger-400' },
  stopLoss: { label: 'Stop loss', tone: 'text-[#FFC93C]' },
  takeProfit: { label: 'Take profit', tone: 'text-lime-400' },
  manual: { label: 'Cierre manual', tone: 'text-carbon-400' },
};

/** How many rows before the list asks whether you really want the rest. */
const PREVIEW_ROWS = 5;

function when(ms: number): string {
  return new Date(ms).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function TradeHistory() {
  const history = useUserStore((s) => s.tradeHistory);
  const [all, setAll] = useState(false);

  if (history.length === 0) return null;

  const shown = all ? history : history.slice(0, PREVIEW_ROWS);
  const wins = history.filter((t) => t.coins > 0).length;
  const total = history.reduce((sum, t) => sum + t.coins, 0);

  return (
    <section className="mt-8">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[13px] font-black uppercase tracking-[0.8px] text-carbon-500">
          Historial de posiciones
        </h2>
        {/* The two numbers that describe a trader, and the reason they're
            together: a good win rate with a bad total means the losses are
            bigger than the wins, which is the most common way to lose money
            while being right most of the time. */}
        <p className="text-[12px] font-bold text-carbon-500 tabular-nums">
          {wins}/{history.length} ganadas ·{' '}
          <span className={total >= 0 ? 'text-lime-400' : 'text-danger-400'}>
            {total >= 0 ? '+' : ''}
            {total}
          </span>
        </p>
      </div>

      <ul className="mt-2 space-y-2">
        {shown.map((t) => {
          const reason = REASONS[t.reason] ?? REASONS.manual;
          const up = t.direction === 'long';
          return (
            <li
              key={t.id}
              className="rounded-2xl border-2 border-carbon-800 bg-carbon-850 px-3 py-2.5"
            >
              <div className="flex items-center justify-between gap-3">
                <span
                  className={`inline-flex items-center gap-1.5 text-[12px] font-black uppercase tracking-wide ${
                    up ? 'text-lime-400' : 'text-danger-400'
                  }`}
                >
                  <Icon name={up ? 'trending-up' : 'trending-down'} size={14} />
                  {up ? 'Long' : 'Short'} {t.leverage}x
                  <span className="text-carbon-600">·</span>
                  <span className="text-carbon-500">
                    {t.orderType === 'limit' ? 'Límite' : 'Market'}
                  </span>
                </span>
                <span
                  className={`text-base font-black tabular-nums ${
                    t.coins >= 0 ? 'text-lime-400' : 'text-danger-400'
                  }`}
                >
                  {t.coins >= 0 ? '+' : ''}
                  {t.coins}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between gap-3 text-[11px] font-bold tabular-nums text-carbon-500">
                <span>
                  {t.entry.toFixed(2)} → {t.exit.toFixed(2)} ·{' '}
                  <span className={t.roi >= 0 ? 'text-lime-500' : 'text-danger-500'}>
                    {t.roi >= 0 ? '+' : ''}
                    {(t.roi * 100).toFixed(1)}%
                  </span>
                </span>
                <span className={reason.tone}>{reason.label}</span>
              </div>
              <p className="mt-0.5 text-[11px] font-semibold text-carbon-600 tabular-nums">
                {t.margin} monedas · {t.mode === 'cross' ? 'Cruzado' : 'Aislado'} · {when(t.closedAt)}
              </p>
            </li>
          );
        })}
      </ul>

      {history.length > PREVIEW_ROWS && (
        <button
          onClick={() => setAll((v) => !v)}
          className="mt-2 w-full rounded-xl border-2 border-carbon-800 py-2 text-[12px] font-black uppercase tracking-wide text-carbon-400 hover:border-carbon-700 hover:text-carbon-200 transition"
        >
          {all ? 'Ver menos' : `Ver las ${history.length}`}
        </button>
      )}
    </section>
  );
}
