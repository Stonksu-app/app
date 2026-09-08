import { Link, useLocation } from 'react-router-dom';
import Icon from './Icon';
import Mascot from './Mascot';
import { NAV_ITEMS, navItemIsActive } from './navItems';

/** Desktop navigation. On phones this is replaced by BottomNav. */
export default function NavRail() {
  const { pathname } = useLocation();
  return (
    <aside className="hidden lg:flex flex-col w-[256px] shrink-0 border-r-2 border-carbon-800 h-dvh sticky top-0 p-4">
      <Link to="/home" className="flex items-center gap-2 px-3 py-4">
        <Mascot size={32} mood="happy" />
        <span className="text-2xl font-black text-lime-500 tracking-tight">Stonksu</span>
      </Link>
      <nav aria-label="Navegación principal" className="mt-4 flex flex-col gap-2">
        {NAV_ITEMS.map((item) => {
          const active = navItemIsActive(item, pathname);
          return (
            <Link
              key={item.to}
              to={item.to}
              aria-current={active ? 'page' : undefined}
              className={`h-[52px] flex items-center gap-3 px-4 rounded-xl border-2 text-[15px] font-black uppercase tracking-[0.8px] transition relative overflow-hidden ${
                item.featured && active
                  ? 'platinum-node border-ultra-200 text-white shadow-[0_0_20px_rgba(167,139,250,0.45)]'
                  : active
                  ? 'bg-lime-500/10 border-lime-500/50 text-lime-400'
                  : item.featured
                  ? 'platinum-node border-ultra-400 text-white shadow-[0_0_14px_rgba(167,139,250,0.28)] hover:border-ultra-300 hover:shadow-[0_0_20px_rgba(167,139,250,0.45)]'
                  : 'border-transparent text-carbon-300 hover:bg-carbon-850'
              }`}
            >
              <Icon name={item.icon} size={22} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
