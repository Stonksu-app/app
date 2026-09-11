import Icon from './Icon';
import { leagueRankInfo } from '../data/leagues';

/*
 * A league's mark: its icon, in its metal, on the app's own dark disc.
 *
 * One component rather than two call sites drawing the same thing, since the
 * profile and the league page show it side by side in a player's mind and any
 * drift between them reads as two different leagues.
 */

export default function LeagueMark({ rank, size = 44 }: { rank: number; size?: number }) {
  const info = leagueRankInfo(rank);

  return (
    <span
      className={`shrink-0 inline-flex items-center justify-center rounded-2xl border-2 border-carbon-800 bg-carbon-900 ${info.tone}`}
      style={{
        width: size,
        height: size,
        // Only the top rank glows, so arriving at it is visible rather than
        // being one more colour in a row of colours.
        boxShadow: info.glow ? '0 0 0 2px rgba(255, 201, 60, 0.25), 0 0 18px rgba(255, 201, 60, 0.35)' : undefined,
      }}
      title={info.name}
    >
      <Icon name={info.icon} size={Math.round(size * 0.55)} strokeWidth={2.2} />
    </span>
  );
}
