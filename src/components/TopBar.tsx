import { Link, useLocation } from 'react-router-dom';
import { useUserStore } from '../store/useUserStore';
import HeartsDisplay from './HeartsDisplay';
import Icon from './Icon';
import Mascot from './Mascot';
import type { IconName } from '../types';

export default function TopBar() {
  const { hearts, streak, xp } = useUserStore();
  const location = useLocation();

  const navItem = (to: string, label: string, icon: IconName) => {
    const active = location.pathname === to;
    return (
      <Link
        to={to}
        className={`flex flex-col items-center text-[10px] sm:text-xs font-bold px-2 sm:px-3 py-1.5 rounded-xl transition ${
          active ? 'bg-lime-500/10 text-lime-400' : 'text-carbon-400 hover:bg-carbon-800'
        }`}
      >
        <Icon name={icon} size={18} className="sm:w-5 sm:h-5" />
        <span className="hidden sm:inline">{label}</span>
      </Link>
    );
  };

  return (
    <header className="sticky top-0 z-30 bg-carbon-900/90 backdrop-blur border-b border-carbon-800">
      <div className="max-w-4xl mx-auto px-2 sm:px-4 py-2 sm:py-2.5 flex items-center justify-between gap-1 sm:gap-3">
        <Link to="/home" className="flex items-center shrink-0" aria-label="Stonksu">
          <Mascot size={34} mood="happy" />
        </Link>

        <nav className="flex items-center gap-0.5 sm:gap-1 shrink-0">
          {navItem('/home', 'Mapa', 'map')}
          {navItem('/profile', 'Perfil', 'user')}
        </nav>

        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0 min-w-0">
          <span className="flex items-center gap-0.5 text-xs sm:text-sm font-extrabold text-lime-400 shrink-0">
            <Icon
              name="flame"
              size={16}
              className={`sm:w-[18px] sm:h-[18px] ${streak > 0 ? 'animate-flame-flicker' : 'opacity-40'}`}
            />
            {streak}
          </span>
          <span className="flex items-center gap-0.5 text-xs sm:text-sm font-extrabold text-lime-400 shrink-0">
            <Icon name="star" size={16} className="sm:w-[18px] sm:h-[18px]" /> {xp}
          </span>
          <HeartsDisplay hearts={hearts} compact />
        </div>
      </div>
    </header>
  );
}
