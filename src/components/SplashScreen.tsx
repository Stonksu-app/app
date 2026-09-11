import { useEffect, useMemo, useState } from 'react';
import Icon from './Icon';
import Mascot from './Mascot';
import { shuffle } from '../utils/shuffle';
import { FADE_MS, LAST_BOOT_KEY, WARM_MS, splashDuration } from '../utils/splash';

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
/* Every delay stays under the splash's ~2.5s lifetime, otherwise a chip would
   never get on screen before the screen fades out. */
const TICKERS = [
  { dir: 'long', side: 'left', offset: 2, delay: 0, duration: 3.0 },
  { dir: 'short', side: 'left', offset: 9, delay: 0.8, duration: 3.4 },
  { dir: 'long', side: 'left', offset: 4, delay: 1.6, duration: 3.2 },
  { dir: 'short', side: 'right', offset: 3, delay: 0.4, duration: 3.2 },
  { dir: 'long', side: 'right', offset: 10, delay: 1.2, duration: 2.9 },
  { dir: 'short', side: 'right', offset: 5, delay: 2.0, duration: 3.3 },
] as const;

/*
 * The timings live in utils/splash.ts, where they can be tested — the length of
 * this screen is the whole point of it, and it's the one thing a screenshot
 * can't show you.
 */

/**
 * Read before the first render so the splash never starts long and then
 * shortens under the player.
 *
 * Wrapped because storage throws in real situations — Safari's private mode,
 * a webview with cookies blocked — and a splash screen that crashes the app is
 * worse than one that's always long.
 */
function lastBoot(): number | null {
  try {
    const raw = localStorage.getItem(LAST_BOOT_KEY);
    return raw === null ? null : Number(raw);
  } catch {
    return null;
  }
}

function rememberBoot() {
  try {
    localStorage.setItem(LAST_BOOT_KEY, String(Date.now()));
  } catch {
    /* Not being able to remember isn't worth an error. */
  }
}

export default function SplashScreen({ onDone }: { onDone: () => void }) {
  const [leaving, setLeaving] = useState(false);
  const tip = useMemo(() => shuffle([...TIPS])[0], []);
  // Decided on the first render and never recomputed: a length that changed
  // mid-splash would make the progress bar jump.
  const [total] = useState(() => splashDuration(lastBoot(), Date.now()));
  const warm = total === WARM_MS;

  useEffect(() => {
    rememberBoot();
    const fade = setTimeout(() => setLeaving(true), total - FADE_MS);
    const done = setTimeout(onDone, total);
    return () => {
      clearTimeout(fade);
      clearTimeout(done);
    };
  }, [onDone, total]);

  return (
    <div
      className={`fixed inset-0 z-50 bg-carbon-900 flex flex-col overflow-hidden px-8 pt-safe pb-safe transition-opacity duration-400 ${
        leaving ? 'opacity-0' : 'opacity-100'
      }`}
    >
      {/* Ambient tape: LONGs drift up, SHORTs drift down. Skipped on a warm
          boot — every chip's animation is longer than the whole screen lives,
          so they'd only ever be caught mid-flight. */}
      <div className={`absolute inset-0 pointer-events-none ${warm ? 'hidden' : ''}`} aria-hidden="true">
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
          <div
            className="h-full rounded-full bg-lime-500 animate-splash-progress"
            style={{ animationDuration: `${total - FADE_MS}ms` }}
          />
        </div>
      </div>

      {/* A tip nobody has time to read is just clutter on the way in. */}
      <div className={`shrink-0 pb-6 text-center relative z-10 ${warm ? 'invisible' : ''}`}>
        <p className="text-[10px] font-black text-carbon-500 uppercase tracking-widest">¿Sabías que…?</p>
        <p className="mt-1.5 text-sm text-carbon-300 font-medium max-w-xs mx-auto leading-snug">{tip}</p>
      </div>
    </div>
  );
}
