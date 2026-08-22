export type IconName =
  | 'bull'
  | 'map'
  | 'user'
  | 'users'
  | 'eye'
  | 'eye-off'
  | 'flame'
  | 'star'
  | 'heart'
  | 'lock'
  | 'close'
  | 'check'
  | 'book'
  | 'candle'
  | 'ruler'
  | 'trending-down'
  | 'trending-up'
  | 'shield'
  | 'brain'
  | 'clipboard'
  | 'newspaper'
  | 'trophy'
  | 'diamond'
  | 'medal'
  | 'wallet'
  | 'egg'
  | 'sprout'
  | 'whale'
  | 'target'
  | 'coins'
  | 'gamepad'
  | 'pillar'
  | 'refresh'
  | 'sparkles'
  | 'cards'
  | 'shuffle'
  | 'chevron-up'
  | 'chevron-down'
  | 'chevron-left'
  | 'pencil'
  | 'chest';

export type QuestionType = 'mcq' | 'true-false' | 'match-pattern';

export interface QuizOption {
  id: string;
  label: string;
}

export interface QuizQuestion {
  id: string;
  type: QuestionType;
  prompt: string;
  helper?: string;
  chart?: 'bullish-candle' | 'bearish-candle' | 'hammer' | 'doji' | 'engulfing' | 'uptrend' | 'support-resistance';
  options: QuizOption[];
  correctOptionId: string;
  explanation: string;
}

export interface Lesson {
  id: string;
  title: string;
  icon: IconName;
  questions: QuizQuestion[];
}

export interface Flashcard {
  id: string;
  term: string;
  definition: string;
}

export interface MatchPairsGame {
  type: 'match-pairs';
  instructions: string;
  pairs: { id: string; term: string; definition: string }[];
}

export interface SortClassifyGame {
  type: 'sort-classify';
  instructions: string;
  bucketALabel: string;
  bucketBLabel: string;
  items: { id: string; label: string; bucket: 'a' | 'b' }[];
}

export interface SequenceGame {
  type: 'sequence';
  instructions: string;
  steps: { id: string; label: string; order: number }[];
}

export interface SentenceRound {
  id: string;
  term: string;
  chunks: string[];
  blankIndex: number;
  distractors: string[];
}

export interface SentenceBuilderGame {
  type: 'sentence-builder';
  instructions: string;
  rounds: SentenceRound[];
}

export type IntroGame = MatchPairsGame | SortClassifyGame | SequenceGame | SentenceBuilderGame;

/** A single item in the unified, interleaved lesson stream. Quiz questions and game
 * rounds/batches are siblings in the same stream so they can be shuffled together. */
export type Activity =
  | { type: 'quiz'; id: string; question: QuizQuestion }
  | { type: 'match'; id: string; instructions: string; pairs: MatchPairsGame['pairs'] }
  | {
      type: 'classify';
      id: string;
      instructions: string;
      bucketALabel: string;
      bucketBLabel: string;
      items: SortClassifyGame['items'];
    }
  | { type: 'sequence'; id: string; instructions: string; steps: SequenceGame['steps'] }
  | { type: 'sentence'; id: string; instructions: string; round: SentenceRound };

export interface NodeIntro {
  flashcards: Flashcard[];
  games: IntroGame[];
}

export type NodeDifficulty = 'easy' | 'medium' | 'hard';

export type HornStyle = 'curvos' | 'rectos' | 'cortos' | 'largos' | 'gruesos';
export type EyeStyle = 'arco' | 'puntos' | 'decididos' | 'guino' | 'estrellas';
export type AccessoryStyle = 'ninguno' | 'corona';

/** How the player has dressed up their bull. The logo keeps the brand look;
 *  only the player-facing avatar follows this. */
export interface MascotLook {
  body: string;
  mask: string;
  horns: HornStyle;
  eyes: EyeStyle;
  accessory: AccessoryStyle;
  accessoryColor: string;
}

export interface SkillNode {
  id: string;
  title: string;
  icon: IconName;
  description: string;
  lessons: Lesson[];
  requires: string[];
  position: { x: number; y: number };
  intro?: NodeIntro;
  difficulty: NodeDifficulty;
  /** SECTION: Represents the Duolingo "section" (e.g., Section 1, Section 2).
   *  Nodes sharing a section render under one section banner. */
  section?: { number: number; title: string };
  /** UNIT: Represents the Duolingo "unit" within a section (e.g., Unit 1, Unit 2).
   *  Nodes sharing both section and unit render under one unit banner. */
  unit?: { number: number; title: string };
  /** Playable only on Ultra. Nothing carries it yet — the whole course is
   *  free — but the path, the node dialog and the lesson route all honour it,
   *  so making a topic exclusive is one word rather than a feature. */
  ultra?: boolean;
}

export interface Badge {
  id: string;
  title: string;
  description: string;
  icon: IconName;
}

export type TradingExperience = 'none' | 'beginner' | 'some' | 'experienced';

export interface OnboardingAnswers {
  experience: TradingExperience | null;
  goal: string | null;
}

export interface LessonAttempt {
  lessonId: string;
  nodeId: string;
  completedAt: string;
  xpEarned: number;
  correctCount: number;
  totalQuestions: number;
}
