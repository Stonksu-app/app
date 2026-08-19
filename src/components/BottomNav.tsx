import { Link, useLocation } from 'react-router-dom';
import Icon from './Icon';
import { NAV_ITEMS } from './navItems';

/** Phone navigation, pinned to the bottom. Hidden from lg up, where NavRail
 *  takes over. */
export default function BottomNav() {
  const { pathname } = useLocation();
  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-carbon-900/95 backdrop-blur border-t-2 border-carbon-800 pb-safe">
      <div className="flex items-stretch justify-around max-w-md mx-auto px-2 py-2">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.to;
          return (
            <Link
              key={item.to}
              to={item.to}
              aria-current={active ? 'page' : undefined}
              className={`flex-1 max-w-[110px] flex flex-col items-center gap-0.5 py-2 rounded-xl border-2 transition ${
                active
                  ? 'bg-lime-500/10 border-lime-500/50 text-lime-400'
                  : 'border-transparent text-carbon-400'
              }`}
            >
              <Icon name={item.icon} size={24} />
              <span className="text-[10px] font-black uppercase tracking-[0.8px]">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
