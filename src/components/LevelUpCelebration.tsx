import Icon from './Icon';
import Confetti from './Confetti';
import { Button } from './Button';
import type { LevelUpInfo } from '../store/useUserStore';

/**
 * Its own beat, the same shape as ProtectorCelebration, for crossing a level.
 * Milestone levels (every 5th) go platinum instead of lime and pay a
 * protector on top of the coins — a bigger moment for a bigger number,
 * the same principle a mastered topic already follows on the path.
 */
export default function LevelUpCelebration({
  info,
  onContinue,
}: {
  info: LevelUpInfo;
  onContinue: () => void;
}) {
  const milestone = info.protectors > 0;
  return (
    <div className="fixed inset-0 z-50 bg-carbon-900 flex flex-col items-center justify-center px-6 text-center">
      <Confetti count={70} />

      <div
        className={`relative w-28 h-28 rounded-full flex items-center justify-center animate-bounce-in ${
          milestone ? 'platinum-node text-white' : 'bg-lime-500 text-carbon-900'
        }`}
      >
        <span className="relative z-10 text-4xl font-black">{info.level}</span>
      </div>

      <p
        className="mt-8 text-2xl font-black text-carbon-50 animate-pop-in"
        style={{ animationDelay: '0.4s', animationFillMode: 'backwards' }}
      >
        ¡Nivel {info.level}!
      </p>
      <p
        className="mt-2 text-carbon-400 max-w-xs animate-pop-in"
        style={{ animationDelay: '0.5s', animationFillMode: 'backwards' }}
      >
        {milestone ? 'Un nivel destacado trae recompensa extra.' : 'Sigue así.'}
      </p>

      <div
        className="mt-5 flex items-center justify-center gap-5 animate-pop-in"
        style={{ animationDelay: '0.6s', animationFillMode: 'backwards' }}
      >
        <span className="flex items-center gap-1.5 text-2xl font-black text-[#FFC93C]">
          <Icon name="coins" size={24} /> +{info.coins}
        </span>
        {milestone && (
          <span className="flex items-center gap-1.5 text-2xl font-black text-sky-400">
            <Icon name="shield" size={24} /> +{info.protectors}
          </span>
        )}
      </div>

      <div
        className="mt-8 w-full max-w-xs animate-pop-in"
        style={{ animationDelay: '0.7s', animationFillMode: 'backwards' }}
      >
        <Button onClick={onContinue}>Genial</Button>
      </div>
    </div>
  );
}
