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
  const { hearts, unlimited } = useHeartRegen();
  const [open, setOpen] = useState<StatKey | null>(null);

  const toggle = (p: StatKey) => setOpen((cur) => (cur === p ? null : p));

  const stat = (key: StatKey, icon: React.ReactNode, value: string | number, valueClass = 'text-carbon-50') => (
    <button
      onClick={() => toggle(key)}
      aria-expanded={open === key}
      // Tighter padding below sm: four counters at px-3 overflow a 375px
      // viewport once the numbers reach three digits.
      className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 rounded-xl font-black tabular-nums transition ${valueClass} ${
        open === key ? 'bg-carbon-800' : 'hover:bg-carbon-850'
      }`}
    >
      {icon}
      {value}
    </button>
  );

  return (
    <header
      // Plain solid background, no `backdrop-blur`: on WKWebView (iOS) a
      // `backdrop-filter` on a sticky/fixed element sometimes fails to
      // repaint after a route change (it stays in the DOM but goes
      // invisible, or in the worst case its sticky positioning itself stops
      // being honoured and it scrolls away with the rest of the page,
      // uncovering the status bar). A solid background sidesteps the whole
      // bug class instead of trying to force a repaint around it.
      // `lg:hidden` lives here rather than on a wrapper: a sticky element can
      // only travel inside its parent's box, and a wrapper drawn around a
      // single header is exactly the header's height — so it stuck to
      // nothing and scrolled away with the page. Its parent is now the page
      // itself, which is as tall as the scroll.
      className="lg:hidden sticky top-0 z-30 bg-carbon-900 border-b-2 border-carbon-800 pt-safe"
    >
      <div className="max-w-2xl mx-auto px-3 h-[calc(var(--topbar-h)-2px)] flex items-center justify-between gap-2">
        <Link to="/home" className="shrink-0 flex items-center gap-2" aria-label="Stonksu">
          <Mascot size={32} mood="happy" />
          {testMode && (
            <span className="text-[10px] font-black uppercase tracking-[0.8px] text-carbon-900 bg-[#FFC93C] rounded-md px-1.5 py-0.5">
              Test
            </span>
          )}
        </Link>

        <div className="flex items-center gap-0.5 sm:gap-1 min-w-0">
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
          {/* An Ultra account showing "5" would look like it's about to run
              out of something it can't run out of. In Ultra's violet, so the
              heart reads as part of the plan rather than as a counter that
              happens to be stuck. */}
          {stat(
            'hearts',
            <Icon
              name="heart"
              size={20}
              className={unlimited ? 'text-ultra-400' : 'text-lime-500'}
            />,
            unlimited ? '∞' : hearts,
            unlimited ? 'text-ultra-300' : 'text-carbon-50'
          )}
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
