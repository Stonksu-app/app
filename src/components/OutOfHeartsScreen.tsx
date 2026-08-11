import { useNavigate } from 'react-router-dom';
import Mascot, { randomLine } from './Mascot';

export default function OutOfHeartsScreen() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-carbon-900 flex flex-col items-center justify-center gap-4 p-6 text-center">
      <Mascot size={110} mood="sad" className="animate-shake" />
      <h1 className="text-2xl font-black text-carbon-50">¡Te quedaste sin vidas!</h1>
      <p className="text-carbon-400 max-w-xs">{randomLine('outOfHearts')}</p>
      <button
        onClick={() => navigate('/home')}
        className="mt-2 bg-lime-500 hover:bg-lime-400 text-carbon-900 font-black px-8 py-3.5 rounded-2xl transition active:scale-95"
      >
        Volver al mapa
      </button>
    </div>
  );
}
