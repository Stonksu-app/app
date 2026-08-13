import { useNavigate } from 'react-router-dom';
import Icon from './Icon';
import HeartsDisplay from './HeartsDisplay';

export default function LessonHeader({ progressPct, hearts }: { progressPct: number; hearts: number }) {
  const navigate = useNavigate();
  return (
    <div className="shrink-0 pt-safe">
      <div className="max-w-xl w-full mx-auto px-4 pt-4 pb-1 flex items-center gap-3">
      <button onClick={() => navigate('/home')} className="text-carbon-500 hover:text-carbon-300" aria-label="Salir">
        <Icon name="close" size={24} />
      </button>
      <div className="flex-1 h-3 bg-carbon-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-lime-500 rounded-full transition-all duration-300"
          style={{ width: `${progressPct}%` }}
        />
      </div>
        <HeartsDisplay hearts={hearts} />
      </div>
    </div>
  );
}
