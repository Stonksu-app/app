import Confetti from './Confetti';
import Icon from './Icon';
import LeagueMark from './LeagueMark';
import { Button } from './Button';
import { leagueRankInfo } from '../data/leagues';

/*
 * Arriving in a new league gets its own screen.
 *
 * Promotion already hands you a harder table, which is only a prize if you
 * wanted one — so it also hands you something spendable, and says so here
 * rather than leaving you to notice the coin counter moved. Same shape as the
 * streak-protector moment: one beat, one thing being given, one way out.
 */

export default function LeaguePromotionCelebration({
  rank,
  coins,
  protectors,
  onContinue,
}: {
  rank: number;
  coins: number;
  protectors: number;
  onContinue: () => void;
}) {
  const info = leagueRankInfo(rank);

  return (
    <div className="fixed inset-0 z-50 bg-carbon-900 flex flex-col items-center justify-center px-6 text-center">
      <Confetti count={70} />

      <div className="animate-bounce-in">
        <LeagueMark rank={rank} size={112} />
      </div>

      <p className="mt-6 text-[13px] font-black uppercase tracking-[0.8px] text-lime-400">
        Has ascendido
      </p>
      <h1 className="mt-1 text-3xl font-black text-carbon-50">{info.name}</h1>
      <p className="mt-1.5 text-sm text-carbon-400 max-w-xs">
        Nueva liga, rivales nuevos. El XP de esta semana vuelve a empezar para todos.
      </p>

      <div className="mt-7 w-full max-w-xs rounded-2xl border-2 border-carbon-800 bg-carbon-850 p-4 space-y-2.5">
        <p className="flex items-center justify-center gap-2 text-lg font-black text-[#FFC93C] tabular-nums">
          <Icon name="coins" size={20} /> +{coins}
        </p>
        {protectors > 0 && (
          <p className="flex items-center justify-center gap-2 text-[15px] font-black text-sky-400">
            <Icon name="shield" size={18} /> +{protectors}{' '}
            {protectors === 1 ? 'protector de racha' : 'protectores de racha'}
          </p>
        )}
      </div>

      <div className="mt-7 w-full max-w-xs">
        <Button onClick={onContinue}>Seguir</Button>
      </div>
    </div>
  );
}
