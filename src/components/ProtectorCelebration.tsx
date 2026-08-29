import Icon from './Icon';
import Confetti from './Confetti';
import { Button } from './Button';

/**
 * A full-screen moment for earning a streak protector, the way Duolingo
 * treats a Streak Freeze: its own beat before the regular results, not a
 * line of text competing with XP and badges for attention.
 *
 * Shown as a chest — the same object the path already uses to hand out
 * XP and coins — bouncing in and popping the shield out of it, so a
 * protector reads as the same kind of reward as everything else the game
 * hands you, not a separate system.
 */
export default function ProtectorCelebration({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-carbon-900 flex flex-col items-center justify-center px-6 text-center">
      <Confetti count={50} />

      <div className="relative">
        <div className="w-28 h-28 rounded-3xl bg-[#FFC93C] text-carbon-900 flex items-center justify-center animate-bounce-in">
          <Icon name="chest" size={56} strokeWidth={1.7} />
        </div>
        {/* Popped out of the chest's corner, on a delay, so it reads as
            "the chest gave you this" rather than two things at once. */}
        <div
          className="absolute -bottom-3 -right-3 w-14 h-14 rounded-2xl bg-sky-500 text-white flex items-center justify-center shadow-lg animate-pop-in"
          style={{ animationDelay: '0.35s', animationFillMode: 'backwards' }}
        >
          <Icon name="shield" size={28} strokeWidth={2} />
        </div>
      </div>

      <p
        className="mt-8 text-2xl font-black text-carbon-50 animate-pop-in"
        style={{ animationDelay: '0.5s', animationFillMode: 'backwards' }}
      >
        ¡Protector de racha!
      </p>
      <p
        className="mt-2 text-carbon-400 max-w-xs animate-pop-in"
        style={{ animationDelay: '0.6s', animationFillMode: 'backwards' }}
      >
        Te lo has ganado por seguir aprendiendo. Cubre un día entero sin practicar sin que se rompa tu racha.
      </p>

      <div
        className="mt-8 w-full max-w-xs animate-pop-in"
        style={{ animationDelay: '0.7s', animationFillMode: 'backwards' }}
      >
        <Button onClick={onContinue}>Genial</Button>
      </div>
    </div>
  );
}
