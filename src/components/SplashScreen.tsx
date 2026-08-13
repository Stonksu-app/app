import { useEffect, useMemo, useState } from 'react';
import Icon from './Icon';
import Mascot from './Mascot';
import { shuffle } from '../utils/shuffle';

/** Shown while the app boots. Follows the shape of Duolingo's loading screen —
 * mascot front and centre with an idle animation, a pulsing status line and a
 * tip to read — but the ambience is a tape of LONGs rising and SHORTs falling. */

const TIPS = [
  'Una vela verde cierra por encima de donde abrió.',
  'El spread es la diferencia entre el precio de compra y el de venta.',
  'Ir largo es comprar esperando que el precio suba.',
  'Un soporte es la zona donde la caída suele frenarse.',
  'El apalancamiento multiplica las ganancias… y las pérdidas.',
  'Una resistencia rota puede convertirse en soporte.',
  'Nunca arriesgues capital que no puedas permitirte perder.',
  'El doji marca indecisión: apertura y cierre casi iguales.',
];

/** Pre-computed so the tape doesn't reshuffle on every render. Kept to the
 * outer margins so the chips never collide with the mascot or the wordmark. */
const TICKERS = [
  { dir: 'long', side: 'left', offset: 2, delay: 0, duration: 3.4 },
  { dir: 'short', side: 'left', offset: 9, delay: 1.6, duration: 3.9 },
  { dir: 'long', side: 'left', offset: 4, delay: 3.2, duration: 3.6 },
  { dir: 'short', side: 'right', offset: 3, delay: 0.8, duration: 3.7 },
  { dir: 'long', side: 'right', offset: 10, delay: 2.4, duration: 3.2 },
  { dir: 'short', side: 'right', offset: 5, delay: 4.1, duration: 3.5 },
] as const;

export default function SplashScreen({ onDone }: { onDone: () => void }) {
  const [leaving, setLeaving] = useState(false);
  const tip = useMemo(() => shuffle([...TIPS])[0], []);

  useEffect(() => {
    // Hold long enough to read the tip, then fade out before unmounting.
    const fade = setTimeout(() => setLeaving(true), 2100);
    const done = setTimeout(onDone, 2500);
    return () => {
      clearTimeout(fade);
      clearTimeout(done);
    };
  }, [onDone]);

  return (
    <div
      className={`fixed inset-0 z-50 bg-carbon-900 flex flex-col overflow-hidden px-8 pt-safe pb-safe transition-opacity duration-400 ${
        leaving ? 'opacity-0' : 'opacity-100'
      }`}
    >
      {/* Ambient tape: LONGs drift up, SHORTs drift down. */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        {TICKERS.map((t, i) => (
          <span
            key={i}
            className={`absolute flex items-center gap-1 text-[11px] font-black tracking-wide rounded-full px-2.5 py-1 border ${
              t.dir === 'long'
                ? 'text-lime-400 border-lime-500/25 bg-lime-500/5 animate-tape-up'
                : 'text-danger-400 border-danger-500/25 bg-danger-500/5 animate-tape-down'
            }`}
            style={{
              [t.side]: `${t.offset}%`,
              animationDelay: `${t.delay}s`,
              animationDuration: `${t.duration}s`,
            }}
          >
            <Icon name={t.dir === 'long' ? 'trending-up' : 'trending-down'} size={12} strokeWidth={2.6} />
            {t.dir === 'long' ? 'LONG' : 'SHORT'}
          </span>
        ))}
      </div>

      <div className="m-auto flex flex-col items-center text-center relative z-10">
        <div className="animate-splash-bob">
          <Mascot size={132} mood="happy" />
        </div>

        <p className="mt-6 text-2xl font-black text-carbon-50">Stonksu</p>

        <p className="mt-1 text-sm font-bold text-lime-400 animate-pulse-soft">Preparando el mercado…</p>

        <div className="mt-6 h-1.5 w-44 rounded-full bg-carbon-800 overflow-hidden">
          <div className="h-full rounded-full bg-lime-500 animate-splash-progress" />
        </div>
      </div>

      <div className="shrink-0 pb-6 text-center relative z-10">
        <p className="text-[10px] font-black text-carbon-500 uppercase tracking-widest">¿Sabías que…?</p>
        <p className="mt-1.5 text-sm text-carbon-300 font-medium max-w-xs mx-auto leading-snug">{tip}</p>
      </div>
    </div>
  );
}
