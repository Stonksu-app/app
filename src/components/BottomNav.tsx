import { Link, useLocation } from 'react-router-dom';
import Icon from './Icon';
import { NAV_ITEMS, navItemIsActive } from './navItems';

/** Phone navigation, pinned to the bottom. Hidden from lg up, where NavRail
 *  takes over. */
export default function BottomNav() {
  const { pathname } = useLocation();
  return (
    <nav
      aria-label="Navegación principal"
      // Solid background, no `backdrop-blur` — see TopBar's comment for why.
      className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-carbon-900 border-t-2 border-carbon-800 pb-safe"
    >
      <div className="flex items-stretch justify-around max-w-md mx-auto px-2 py-2">
        {NAV_ITEMS.filter((item) => !item.desktopOnly).map((item) => {
          const active = navItemIsActive(item, pathname);
          return (
            <Link
              key={item.to}
              to={item.to}
              aria-current={active ? 'page' : undefined}
              className={`flex-1 max-w-[110px] flex flex-col items-center gap-0.5 py-2 rounded-xl border-2 transition ${
                active
                  ? 'bg-lime-500/10 border-lime-500/50 text-lime-400'
                  : item.featured
                  ? 'border-lime-500/20 bg-lime-500/5 text-lime-400'
                  : 'border-transparent text-carbon-400'
              }`}
            >
              <Icon name={item.icon} size={24} />
              <span className="text-[10px] font-black tracking-[0.2px]">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
