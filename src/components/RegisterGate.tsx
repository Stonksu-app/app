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
 * block the flow that creates the progress in the first place. The sign-in page
 * is the strongest case of all: someone is already there to rescue their
 * account, and covering it with "save your progress" would sit on top of the
 * very form that does it. An active lesson is excluded because interrupting
 * mid-question would lose the answer and make lessons untestable — the results
 * screen right after is a better moment anyway, since that is when the player
 * has most to lose.
 */
function isQuietRoute(pathname: string): boolean {
  if (pathname === '/' || pathname.startsWith('/onboarding') || pathname.startsWith('/entrar')) return true;
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
      {/* In the document flow rather than fixed: as an overlay it sat on top of
          the unit header on desktop and the bottom nav on the phone. Taking up
          its own row means it can't cover anything, and scrolling away is fine
          because the modal is what actually does the nagging. */}
      {!quiet && (
        <button
          onClick={() => setOpen(true)}
          // The padding matches the rails either side of the lesson path
          // (NavRail w-[256px] from lg, StatRail w-[368px] from xl) so the text
          // lands on the same axis as the path itself. Centred on the raw
          // window it sits 56px right of everything else on a wide screen,
          // which reads as a mistake even though it is technically centred.
          // The notch inset has to be added to the padding, not swapped for it:
          // .pt-safe sets padding-top outright, so on any screen without a
          // notch it resolves to 0 and the text ends up flush against the top
          // edge with all ten pixels below it.
          style={{ paddingTop: 'calc(0.625rem + env(safe-area-inset-top))' }}
          className="w-full bg-[#FFC93C] text-carbon-950 px-4 lg:pl-[256px] xl:pr-[368px] py-2.5 flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 text-[13px] font-black text-center hover:bg-[#ffd45f] transition"
        >
          <span className="inline-flex items-center gap-2">
            <Icon name="shield" size={16} strokeWidth={2.2} />
            {/* The full sentence wraps to a second row on a 375px phone, which
                doubles the height of a bar whose whole job is to be unobtrusive. */}
            <span className="hidden sm:inline">Tu progreso solo está en este dispositivo.</span>
            <span className="sm:hidden">Tu progreso no está guardado.</span>
          </span>
          <span className="underline underline-offset-2">Guárdalo</span>
        </button>
      )}

      {open && <RegisterModal onClose={() => setOpen(false)} />}
    </>
  );
}
