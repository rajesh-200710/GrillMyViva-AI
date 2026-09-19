import type { ExaminerPersona, PersonaId } from '@/types';

export const PERSONAS: Record<PersonaId, ExaminerPersona> = {
  friendly: {
    id: 'friendly',
    name: 'Dr. Maya Okafor',
    title: 'Friendly Mentor',
    description:
      'Warm and encouraging. Eases you in with big-picture questions and coaches you toward fuller answers.',
    difficulty: 2,
    difficultyLabel: 'Approachable',
    color: 'success',
    gradient: 'from-emerald-400 to-teal-500',
    accent: '#4ade80',
    questionStyle: 'coaching',
    emoji: '😊',
  },
  standard: {
    id: 'standard',
    name: 'Prof. Daniel Reyes',
    title: 'Standard Evaluator',
    description:
      'Balanced and fair. Covers the full breadth of your project with steady, well-structured questions.',
    difficulty: 3,
    difficultyLabel: 'Balanced',
    color: 'primary',
    gradient: 'from-cyan-400 to-blue-500',
    accent: '#22d3ee',
    questionStyle: 'structured',
    emoji: '🎯',
  },
  strict: {
    id: 'strict',
    name: 'Dr. Helena Voss',
    title: 'Strict Professor',
    description:
      'Rigorous and demanding. Probes edge cases, demands precision, and does not accept vague answers lightly.',
    difficulty: 5,
    difficultyLabel: 'Demanding',
    color: 'error',
    gradient: 'from-rose-400 to-red-600',
    accent: '#f87171',
    questionStyle: 'probing',
    emoji: '🔥',
  },
};

export const PERSONA_LIST: ExaminerPersona[] = [
  PERSONAS.friendly,
  PERSONAS.standard,
  PERSONAS.strict,
];
