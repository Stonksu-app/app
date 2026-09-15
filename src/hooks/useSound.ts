import { useEffect } from 'react';
import { setSoundEnabled, unlockSound } from '../lib/sound';
import { useUserStore } from '../store/useUserStore';

/**
 * Wires the sound engine to the app, once, near the root.
 *
 * Two jobs that both have to happen outside the engine itself.
 *
 * The audio context is created inside the first gesture, because browsers
 * refuse to start audio the player didn't ask for and iOS is the strictest
 * about it. The listeners are `once`, so the cost is one flag check per app
 * launch and then nothing.
 *
 * And the setting is pushed down rather than read up: the engine is called
 * from places that aren't React — a timer that fires a stop loss, the replay
 * that settles a position on return — and none of them can reach a hook.
 */
export function useSound(): void {
  const enabled = useUserStore((s) => s.soundEnabled);

  useEffect(() => {
    setSoundEnabled(enabled);
  }, [enabled]);

  useEffect(() => {
    const open = () => unlockSound();
    // Both, because a tap on a phone and a key on a desktop are each somebody
    // arriving, and neither is guaranteed to come first.
    window.addEventListener('pointerdown', open, { once: true });
    window.addEventListener('keydown', open, { once: true });
    return () => {
      window.removeEventListener('pointerdown', open);
      window.removeEventListener('keydown', open);
    };
  }, []);
}
