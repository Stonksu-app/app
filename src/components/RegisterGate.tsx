import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Icon from './Icon';
import RegisterModal from './RegisterModal';
import { useAuthStore } from '../store/useAuthStore';

/**
 * Nags anonymous players to save their progress.
 *
 * Two pressures, both tunable by the constants below: a bar that is always
 * there, and a modal that reopens whenever you move around or keep tapping.
 * "Ahora no" only hides the current instance — nothing here can be silenced
 * for good, because an account that vanishes with localStorage is the one
 * thing the player cannot undo.
 */

/** Clicks anywhere before the modal comes back. Set to 1 for literally every
 *  tap; below about 3 the app becomes hard to actually use. */
const CLICKS_BETWEEN_PROMPTS = 5;

/**
 * Routes that never nag.
 *
 * Landing and onboarding have nothing to save yet, and a modal over them would
 * block the flow that creates the progress in the first place. An active lesson
 * is excluded because interrupting mid-question would lose the answer and make
 * lessons untestable — the results screen right after is a better moment
 * anyway, since that is when the player has most to lose.
 */
function isQuietRoute(pathname: string): boolean {
  if (pathname === '/' || pathname.startsWith('/onboarding')) return true;
  return /^\/lesson\/[^/]+$/.test(pathname);
}

export default function RegisterGate() {
  const status = useAuthStore((s) => s.status);
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const clicks = useRef(0);

  const anonymous = status === 'anonymous';
  const quiet = isQuietRoute(location.pathname);

  // Every move around the app reopens it — and entering a quiet route closes
  // it, since a modal opened on the map would otherwise ride along into the
  // lesson it was supposed to stay out of.
  useEffect(() => {
    if (!anonymous) return;
    setOpen(!quiet);
    clicks.current = 0;
  }, [anonymous, quiet, location.pathname]);

  // …and so does simply carrying on tapping.
  useEffect(() => {
    if (!anonymous || quiet || open) return;
    const onClick = () => {
      clicks.current += 1;
      if (clicks.current >= CLICKS_BETWEEN_PROMPTS) {
        clicks.current = 0;
        setOpen(true);
      }
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [anonymous, quiet, open]);

  if (!anonymous) return null;

  return (
    <>
      {!quiet && (
        <button
          onClick={() => setOpen(true)}
          className="fixed left-0 right-0 bottom-0 z-50 lg:bottom-auto lg:top-0 bg-[#FFC93C] text-carbon-950 px-4 py-2.5 pb-safe lg:pb-2.5 flex items-center justify-center gap-2 text-[13px] font-black text-center hover:bg-[#ffd45f] transition"
        >
          <Icon name="shield" size={16} strokeWidth={2.2} />
          Tu progreso solo está en este dispositivo.
          <span className="underline underline-offset-2">Guárdalo</span>
        </button>
      )}

      {open && <RegisterModal onClose={() => setOpen(false)} />}
    </>
  );
}
