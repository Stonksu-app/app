import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useUserStore } from '../store/useUserStore';
import { useHeartRegen } from '../hooks/useHeartRegen';
import StatPanel, { type StatKey } from './StatPanels';
import Icon from './Icon';
import Mascot from './Mascot';

/* Stats only, the way the phone app works: each counter taps open a panel
 * underneath. Navigation lives in BottomNav / NavRail, not here. */

export default function TopBar() {
  const { streak, xp, coins, testMode } = useUserStore();
  const { hearts } = useHeartRegen();
  const [open, setOpen] = useState<StatKey | null>(null);

  const toggle = (p: StatKey) => setOpen((cur) => (cur === p ? null : p));

  const stat = (key: StatKey, icon: React.ReactNode, value: string | number) => (
    <button
      onClick={() => toggle(key)}
      aria-expanded={open === key}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-black text-carbon-50 transition ${
        open === key ? 'bg-carbon-800' : 'hover:bg-carbon-850'
      }`}
    >
      {icon}
      {value}
    </button>
  );

  return (
    <header className="sticky top-0 z-30 bg-carbon-900/95 backdrop-blur border-b-2 border-carbon-800 pt-safe">
      <div className="max-w-2xl mx-auto px-3 py-2 flex items-center justify-between gap-2">
        <Link to="/home" className="shrink-0 flex items-center gap-2" aria-label="Stonksu">
          <Mascot size={32} mood="happy" />
          {testMode && (
            <span className="text-[10px] font-black uppercase tracking-[0.8px] text-carbon-900 bg-[#FFC93C] rounded-md px-1.5 py-0.5">
              Test
            </span>
          )}
        </Link>

        <div className="flex items-center gap-1">
          {stat(
            'streak',
            <Icon
              name="flame"
              size={20}
              className={streak > 0 ? 'text-lime-500 animate-flame-flicker' : 'text-carbon-600'}
            />,
            streak
          )}
          {stat('xp', <Icon name="star" size={20} className="text-lime-500" />, xp)}
          {stat('coins', <Icon name="coins" size={20} className="text-lime-500" />, coins)}
          {stat('hearts', <Icon name="heart" size={20} className="text-lime-500" />, hearts)}
        </div>
      </div>

      {open && (
        <div className="border-t-2 border-carbon-800 bg-carbon-900 animate-pop-in">
          <div className="max-w-2xl mx-auto px-4 py-4">
            <StatPanel stat={open} />
          </div>
        </div>
      )}
    </header>
  );
}
