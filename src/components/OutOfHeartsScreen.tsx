import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatCountdown, useHeartRegen } from '../hooks/useHeartRegen';
import { Button } from './Button';
import Icon from './Icon';
import Avatar from './Avatar';
import { randomLine } from './Mascot';

export default function OutOfHeartsScreen({ blockedEntry }: { blockedEntry?: boolean }) {
  const navigate = useNavigate();
  const { msUntilNextHeart } = useHeartRegen();
  const [line] = useState(() => randomLine('outOfHearts'));

  return (
    <div className="screen-safe bg-carbon-900 flex flex-col px-6">
      <div className="m-auto py-6 flex flex-col items-center gap-4 text-center">
        <Avatar size={110} mood="sad" className="animate-shake" />
        <h1 className="text-2xl font-black text-carbon-50">
          {blockedEntry ? 'Sin vidas por ahora' : '¡Te quedaste sin vidas!'}
        </h1>
        <p className="text-carbon-400 max-w-xs">{line}</p>

        {msUntilNextHeart !== null && (
          <div className="mt-1 flex items-center gap-2 bg-carbon-850 border border-carbon-800 rounded-2xl px-5 py-3">
            <Icon name="heart" size={20} className="text-lime-500" />
            <div className="text-left">
              <p className="text-[10px] font-black text-carbon-400 uppercase tracking-wide">Próxima vida en</p>
              <p className="text-xl font-black text-carbon-50 tabular-nums">{formatCountdown(msUntilNextHeart)}</p>
            </div>
          </div>
        )}

        <div className="mt-2">
          <Button onClick={() => navigate('/home')} fullWidth={false}>
            Volver al mapa
          </Button>
        </div>
      </div>
    </div>
  );
}
