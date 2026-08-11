import type { Badge } from '../types';

export const BADGES: Badge[] = [
  {
    id: 'first-green-candle',
    title: 'Primera Vela Verde',
    description: 'Completaste tu primera lección. ¡To the moon!',
    icon: 'candle',
  },
  {
    id: 'survived-stop-loss',
    title: 'Sobreviviste a un Stop Loss',
    description: 'Perdiste una vida y volviste más fuerte.',
    icon: 'shield',
  },
  {
    id: 'week-streak',
    title: '7 Días de Racha',
    description: 'Una semana entera sin fallar. Disciplina de whale.',
    icon: 'flame',
  },
  {
    id: 'perfect-lesson',
    title: 'Sin Rekt',
    description: 'Completaste una lección sin perder ni una vida.',
    icon: 'diamond',
  },
  {
    id: 'fundamentals-master',
    title: 'Fundamentos Grabados en Piedra',
    description: 'Terminaste todo el módulo de Fundamentos.',
    icon: 'pillar',
  },
  {
    id: 'candle-reader',
    title: 'Lector de Velas',
    description: 'Terminaste todo el módulo de Velas Japonesas.',
    icon: 'book',
  },
];
