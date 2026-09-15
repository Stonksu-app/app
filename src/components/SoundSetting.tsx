import Icon from './Icon';
import { play } from '../lib/sound';
import { useUserStore } from '../store/useUserStore';

/**
 * The sound switch.
 *
 * Turning it on plays something immediately, and that isn't a flourish: a
 * switch labelled "sound" that produces silence is a switch you press twice to
 * find out whether it worked. The cue is the one you'll hear most, so it also
 * sets expectations about how loud the rest will be.
 */
export default function SoundSetting() {
  const soundEnabled = useUserStore((s) => s.soundEnabled);
  const setSound = useUserStore((s) => s.setSoundEnabled);

  const toggle = () => {
    const next = !soundEnabled;
    setSound(next);
    // After the state change, so the engine has already been told it may speak.
    if (next) setTimeout(() => play('correct'), 0);
  };

  return (
    <div className="mt-8 bg-carbon-850 border-2 border-carbon-800 rounded-2xl p-4">
      <div className="flex items-start gap-3">
        <Icon name="sparkles" size={24} className="text-lime-500 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <h2 className="text-[19px] font-black text-carbon-50">Sonido</h2>
          <p className="text-sm text-carbon-400 mt-0.5">
            Avisos cortos al acertar, al operar y al cerrar una posición.
          </p>
        </div>

        <button
          onClick={toggle}
          role="switch"
          aria-checked={soundEnabled}
          aria-label="Sonido"
          className={`shrink-0 w-[52px] h-8 rounded-full border-2 transition-colors relative ${
            soundEnabled ? 'bg-lime-500 border-lime-500' : 'bg-carbon-800 border-carbon-700'
          }`}
        >
          <span
            className={`absolute top-[3px] w-[22px] h-[22px] rounded-full bg-carbon-950 transition-all ${
              soundEnabled ? 'left-[25px]' : 'left-[3px]'
            }`}
          />
        </button>
      </div>
    </div>
  );
}
