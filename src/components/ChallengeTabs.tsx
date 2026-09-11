import { Link, useLocation } from 'react-router-dom';
import Icon from './Icon';

/*
 * Missions and the league, as two tabs of one destination.
 *
 * They answer the same question a day apart — what am I chasing right now —
 * and as separate entries they cost two of the five slots a phone bar can
 * hold without turning into a list. Tabs rather than a merged page: the two
 * keep their own routes, so every link, every deep link and the back button
 * still land where they always did.
 */

const TABS = [
  { to: '/misiones', label: 'Misiones', icon: 'trophy' as const },
  { to: '/liga', label: 'Liga', icon: 'medal' as const },
];

export default function ChallengeTabs() {
  const { pathname } = useLocation();

  return (
    <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl border-2 border-carbon-800 bg-carbon-850 p-1">
      {TABS.map((tab) => {
        const active = pathname === tab.to;
        return (
          <Link
            key={tab.to}
            to={tab.to}
            aria-current={active ? 'page' : undefined}
            className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-[13px] font-black uppercase tracking-[0.8px] transition ${
              active ? 'bg-lime-500/15 text-lime-400' : 'text-carbon-400 hover:text-carbon-200'
            }`}
          >
            <Icon name={tab.icon} size={16} />
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
