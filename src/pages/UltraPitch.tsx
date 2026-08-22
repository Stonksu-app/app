import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../components/Icon';
import Mascot from '../components/Mascot';
import { Button } from '../components/Button';
import { formatPrice, offerFor } from '../data/plans';
import { useUserStore } from '../store/useUserStore';

/*
 * The between-lessons pitch, in the shape Duolingo uses for Super: the perks
 * arrive one at a time rather than as a wall of ticks, which is what makes it
 * read as being shown something instead of sold at.
 *
 * Shown after every second lesson and never during one — interrupting an
 * activity to advertise would cost the lesson its momentum, which is the thing
 * actually worth money here.
 */

/** Each perk lands this long after the one before it. */
const STAGGER_MS = 320;

export default function UltraPitch() {
  const navigate = useNavigate();
  const ultra = offerFor('ultra')!;
  const testMode = useUserStore((s) => s.testMode);
  const setPlan = useUserStore((s) => s.setPlan);
  const [notice, setNotice] = useState<string | null>(null);

  const choose = () => {
    if (testMode) {
      setPlan('ultra');
      setNotice('Modo test: Ultra activado sin pagar nada.');
      return;
    }
    navigate('/planes');
  };

  return (
    <div className="screen-safe bg-carbon-900 flex flex-col px-6 relative overflow-hidden">
      {/* A wash of the plan's own blue behind everything, so the screen reads
          as a different place from the lesson you just left. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-32 h-80 opacity-25 blur-3xl"
        style={{ background: 'radial-gradient(circle, #38bdf8 0%, transparent 70%)' }}
      />

      <div className="relative m-auto w-full max-w-sm py-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <span className="inline-block rounded-lg bg-sky-500/15 px-2.5 py-1 text-[12px] font-black uppercase tracking-[0.8px] text-sky-400">
              Stonksu Ultra
            </span>
            <h1 className="mt-3 text-3xl font-black leading-tight text-carbon-50">
              Aprende sin frenos
            </h1>
          </div>
          <Mascot size={84} mood="hype" className="shrink-0 animate-float" />
        </div>

        <ul className="mt-7 space-y-3">
          {ultra.perks.map((perk, i) => (
            <li
              key={perk.text}
              // Staggered in CSS rather than by a chain of timers: browsers
              // throttle timers in a backgrounded tab, so a JS-driven reveal
              // can leave the whole list invisible until you come back to it.
              // `backwards` holds each row hidden until its turn.
              style={{ animationDelay: `${i * STAGGER_MS}ms`, animationFillMode: 'backwards' }}
              className="flex items-center gap-3 rounded-2xl border-2 border-carbon-800 bg-carbon-850 px-4 py-3 animate-pop-in"
            >
              <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl platinum-node">
                <Icon name={perk.icon} size={20} className="relative z-10 text-white" />
              </span>
              <span className="text-[15px] font-bold leading-snug text-carbon-100">{perk.text}</span>
            </li>
          ))}
        </ul>

        <p className="mt-6 text-center text-sm text-carbon-400">
          Todo esto por{' '}
          <span className="font-black text-carbon-100">{formatPrice(ultra.price)}</span> al mes.
        </p>

        {notice && (
          <p className="mt-4 rounded-2xl border-2 border-sky-500/30 bg-sky-500/10 px-4 py-3 text-center text-sm font-bold text-sky-300 animate-pop-in">
            {notice}
          </p>
        )}

        <div className="mt-5 space-y-3">
          <Button variant="platinum" onClick={choose}>
            Conseguir Ultra
          </Button>
          {/* Always available, never delayed: a dismissal you have to wait for
              is an advert holding the app hostage. */}
          <Button variant="secondary" onClick={() => navigate('/home')}>
            Ahora no
          </Button>
        </div>
      </div>
    </div>
  );
}
