import { Link, useLocation } from 'react-router-dom';
import Icon from './Icon';
import { NAV_ITEMS, navItemIsActive } from './navItems';

/** Phone navigation, pinned to the bottom. Hidden from lg up, where NavRail
 *  takes over.
 *
 *  The featured item wears the platinum metal in both states, so its shine
 *  never disappears at the moment you land on it — being there shouldn't look
 *  flatter than being one tap away. What tells them apart is the border, and
 *  the text is white because that gradient is built for white: `purple-400`
 *  on it scored badly enough to read as smudged rather than as a colour.
 *
 *  The violet comes from the ultra tokens, not Tailwind's `purple-*`. Two
 *  near-identical purples in one bar is the kind of thing you feel before you
 *  can name it.
 *
 *  The border and the halo do the attracting, because the violet can't: the
 *  metal runs 3.1:1 down to 1.6:1 against this bar, darker than the dimmed
 *  items at 5.5:1, while the lime of an active item sits at 15:1. Attention
 *  follows luminance, not hue, so the edge is `ultra-400` at 6.6:1 and the
 *  glow gives the shape a lit outline instead of leaving it to fade into a
 *  dark bar. */
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
              className={`flex-1 max-w-[110px] flex flex-col items-center gap-0.5 py-2 rounded-xl border-2 transition relative overflow-hidden ${
                item.featured && active
                  ? 'platinum-node border-ultra-200 text-white shadow-[0_0_20px_rgba(167,139,250,0.45)]'
                  : active
                  ? 'bg-lime-500/10 border-lime-500/50 text-lime-400'
                  : item.featured
                  ? 'platinum-node border-ultra-400 text-white shadow-[0_0_14px_rgba(167,139,250,0.28)] hover:border-ultra-300 hover:shadow-[0_0_20px_rgba(167,139,250,0.45)]'
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
