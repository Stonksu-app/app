import { useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import FlashcardDeck from '../components/FlashcardDeck';
import Icon from '../components/Icon';
import Mascot from '../components/Mascot';
import { getLessonById } from '../data/lessons';
import { useUserStore } from '../store/useUserStore';

const GOAL_MESSAGES: Record<string, string> = {
  'learn-basics': 'Vamos con calma: aquí tienes el contexto antes de entrar en materia.',
  'side-income': 'Esto te ayuda a operar con la cabeza fría, no solo con ganas.',
  discipline: 'La base para que la parte emocional no te gane la partida.',
  fun: 'Un repaso rápido antes de la lección de verdad. Dale.',
};

export default function LessonIntro() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const navigate = useNavigate();
  const { onboardingAnswers, markIntroSeen, name } = useUserStore();

  const data = useMemo(() => (lessonId ? getLessonById(lessonId) : undefined), [lessonId]);

  useEffect(() => {
    if (lessonId && (!data || !data.node.intro)) {
      navigate(`/lesson/${lessonId}`, { replace: true });
    }
  }, [data, lessonId, navigate]);

  if (!data) return null;
  const { node, lesson } = data;
  if (!node.intro) return null;
  const { intro } = node;
  const skipFlashcards = onboardingAnswers.experience === 'some' || onboardingAnswers.experience === 'experienced';
  const goalMessage = GOAL_MESSAGES[onboardingAnswers.goal ?? ''] ?? 'Aquí tienes un poco de contexto antes de empezar.';

  const finish = () => {
    markIntroSeen(node.id);
    navigate(`/lesson/${lesson.id}`, { replace: true });
  };

  return (
    <div className="min-h-screen bg-carbon-900 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        {!skipFlashcards ? (
          <div className="animate-pop-in">
            <div className="flex flex-col items-center text-center mb-6">
              <Mascot size={90} mood="happy" />
              <p className="text-xs font-black text-lime-400 uppercase tracking-wide mt-3">{node.title}</p>
              <h1 className="text-xl font-black text-carbon-50 mt-1">
                {name ? `${name}, ` : ''}antes de empezar...
              </h1>
              <p className="text-carbon-400 mt-2 text-sm">{goalMessage}</p>
              <div className="mt-4 flex items-center gap-2 text-sm text-carbon-200 font-medium">
                <Icon name="cards" size={18} className="text-lime-500 shrink-0" />
                Repasa {intro.flashcards.length} términos clave antes de jugar
              </div>
            </div>
            <FlashcardDeck cards={intro.flashcards} onDone={finish} />
          </div>
        ) : (
          <div className="flex flex-col items-center text-center animate-pop-in">
            <Mascot size={110} mood="happy" />
            <p className="text-xs font-black text-lime-400 uppercase tracking-wide mt-4">{node.title}</p>
            <h1 className="text-2xl font-black text-carbon-50 mt-1">
              {name ? `${name}, ` : ''}antes de empezar...
            </h1>
            <p className="text-carbon-400 mt-2">{goalMessage}</p>
            <p className="mt-4 text-sm text-carbon-500 font-medium">
              Vas a mezclar preguntas con minijuegos de repaso durante la lección.
            </p>
            <button
              onClick={finish}
              className="mt-6 w-full bg-lime-500 hover:bg-lime-400 text-carbon-900 font-black text-lg py-3.5 rounded-2xl transition active:scale-95"
            >
              Empezar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
