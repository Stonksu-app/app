import { useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import FlashcardDeck from '../components/FlashcardDeck';
import Icon from '../components/Icon';
import Mascot from '../components/Mascot';
import OutOfHeartsScreen from '../components/OutOfHeartsScreen';
import { getLessonById } from '../data/lessons';
import { useUserStore } from '../store/useUserStore';

const GOAL_MESSAGES: Record<string, string> = {
  'learn-basics': 'Vamos con calma: aquí tienes el contexto antes de entrar en materia.',
  'side-income': 'Esto te ayuda a operar con la cabeza fría, no solo con ganas.',
  discipline: 'La base para que la parte emocional no te gane la partida.',
  fun: 'Un repaso rápido antes de la lección de verdad. Dale.',
};

export default function LessonIntro() {
  useUserStore.getState().tickHeartRegen();
  const { lessonId } = useParams<{ lessonId: string }>();
  const navigate = useNavigate();
  const { onboardingAnswers, markIntroSeen, name, hearts } = useUserStore();

  const data = useMemo(() => (lessonId ? getLessonById(lessonId) : undefined), [lessonId]);

  useEffect(() => {
    if (lessonId && (!data || !data.node.intro)) {
      navigate(`/lesson/${lessonId}`, { replace: true });
    }
  }, [data, lessonId, navigate]);

  if (!data) return null;
  if (hearts <= 0) return <OutOfHeartsScreen blockedEntry />;
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
    <div className="h-dvh bg-carbon-900 flex flex-col px-6 pt-safe pb-safe">
      {!skipFlashcards ? (
        <div className="flex-1 min-h-0 w-full max-w-sm mx-auto flex flex-col animate-pop-in py-4">
          <div className="shrink-0 flex flex-col items-center text-center mb-4">
            <Mascot size={72} mood="happy" />
            <p className="text-xs font-black text-lime-400 uppercase tracking-wide mt-2">{node.title}</p>
            <h1 className="text-lg font-black text-carbon-50 mt-0.5">
              {name ? `${name}, ` : ''}antes de empezar...
            </h1>
            <div className="mt-2 flex items-center gap-2 text-xs text-carbon-300 font-medium">
              <Icon name="cards" size={16} className="text-lime-500 shrink-0" />
              Repasa {intro.flashcards.length} términos clave antes de jugar
            </div>
          </div>
          <div className="flex-1 min-h-0">
            <FlashcardDeck cards={intro.flashcards} onDone={finish} />
          </div>
        </div>
      ) : (
        <div className="m-auto w-full max-w-sm py-6 flex flex-col items-center text-center animate-pop-in">
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
  );
}
