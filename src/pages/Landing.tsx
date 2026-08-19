import { Link } from 'react-router-dom';
import Mascot from '../components/Mascot';
import Icon from '../components/Icon';
import { SKILL_TREE } from '../data/lessons';

/* Laid out like Duolingo's landing page: wordmark up top, the mascot as the
 * hero, one big headline, and two stacked calls to action. Stacks vertically on
 * a phone and splits into two columns on a wide screen. */

/** Floating chips around the mascot, standing in for Duolingo's cast of
 * characters. Positions are percentages of the hero box. */
const ORBIT = [
  { label: 'LONG', dir: 'up', top: 6, left: 2, delay: '0s' },
  { label: 'SHORT', dir: 'down', top: 22, left: 76, delay: '0.6s' },
  { label: 'LONG', dir: 'up', top: 68, left: 80, delay: '1.2s' },
  { label: 'SHORT', dir: 'down', top: 78, left: 0, delay: '1.8s' },
] as const;

export default function Landing() {
  const topics = SKILL_TREE.slice(0, 6);

  return (
    <div className="min-h-dvh bg-carbon-900 flex flex-col pt-safe pb-safe">
      <header className="shrink-0 w-full max-w-6xl mx-auto px-5 py-4 flex items-center justify-center lg:justify-start">
        <div className="flex items-center gap-2">
          <Mascot size={34} mood="happy" />
          <span className="text-2xl font-black text-lime-500 tracking-tight">Stonksu</span>
        </div>
      </header>

      <main className="flex-1 w-full max-w-6xl mx-auto px-6 flex flex-col justify-center lg:flex-row lg:items-center gap-6 lg:gap-16 py-4">
        {/* Hero */}
        <div className="lg:flex-1 flex items-center justify-center">
          <div className="relative w-64 h-56 sm:w-80 sm:h-72 flex items-center justify-center">
            {/* Soft glow so the mascot doesn't float in flat black */}
            <div className="absolute w-40 h-40 sm:w-52 sm:h-52 rounded-full bg-lime-500/10 blur-3xl" />
            {ORBIT.map((chip, i) => (
              <span
                key={i}
                style={{ top: `${chip.top}%`, left: `${chip.left}%`, animationDelay: chip.delay }}
                className={`absolute flex items-center gap-1 text-[10px] font-black rounded-full px-2 py-1 border animate-float ${
                  chip.dir === 'up'
                    ? 'text-lime-400 border-lime-500/30 bg-lime-500/10'
                    : 'text-danger-400 border-danger-500/30 bg-danger-500/10'
                }`}
              >
                <Icon name={chip.dir === 'up' ? 'trending-up' : 'trending-down'} size={11} strokeWidth={2.6} />
                {chip.label}
              </span>
            ))}
            <Mascot size={168} mood="hype" className="relative" />
          </div>
        </div>

        {/* Copy + calls to action. On a phone the buttons sit at the bottom of
            the screen (mt-auto), the way Duolingo anchors them. */}
        <div className="flex-1 lg:flex-1 flex flex-col items-center text-center">
          {/* Type and button metrics lifted from es.duolingo.com: 32px bold
              headline; 330x50 buttons, 12px radius, 15px/700 with 0.8px
              tracking, 12px apart. */}
          <h1 className="text-[28px] sm:text-[32px] font-black text-carbon-50 leading-tight max-w-[480px]">
            ¡La forma más divertida de aprender trading, inversión y más!
          </h1>

          <div className="mt-auto lg:mt-8 pt-8 w-full max-w-[330px] flex flex-col gap-3">
            <Link
              to="/onboarding"
              style={{ ['--btn-lip' as string]: 'var(--color-lime-700)' }}
              className="btn-3d w-full h-[50px] flex items-center justify-center bg-lime-500 hover:bg-lime-400 text-carbon-900 font-bold text-[15px] tracking-[0.8px] uppercase rounded-xl"
            >
              Empieza ahora
            </Link>
            <Link
              to="/onboarding"
              style={{ ['--btn-lip' as string]: 'var(--color-carbon-950)' }}
              className="btn-3d w-full h-[50px] flex items-center justify-center bg-carbon-850 hover:bg-carbon-800 text-lime-400 border-2 border-carbon-700 font-bold text-[15px] tracking-[0.8px] uppercase rounded-xl"
            >
              Ya tengo una cuenta
            </Link>
          </div>
        </div>
      </main>

      {/* Topic strip — the counterpart to Duolingo's row of languages, which
          they only show from tablet width up. */}
      <footer className="hidden lg:block shrink-0 border-t border-carbon-800 mt-4">
        <div className="max-w-6xl mx-auto px-5 py-3.5 flex items-center gap-6 overflow-x-auto justify-start lg:justify-center">
          {topics.map((node) => (
            <span
              key={node.id}
              className="flex items-center gap-2 shrink-0 text-[11px] font-black uppercase tracking-wide text-carbon-400"
            >
              <Icon name={node.icon} size={16} className="text-lime-500" />
              {node.title}
            </span>
          ))}
        </div>
      </footer>
    </div>
  );
}
