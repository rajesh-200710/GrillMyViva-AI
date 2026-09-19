export type PersonaId = 'friendly' | 'standard' | 'strict';

export type Screen = 'setup' | 'simulator' | 'scorecard';

export type ExamStatus = 'in_progress' | 'completed';

export interface ExaminerPersona {
  id: PersonaId;
  name: string;
  title: string;
  description: string;
  difficulty: number; // 1-5
  difficultyLabel: string;
  color: string;
  gradient: string;
  accent: string;
  questionStyle: string;
  emoji: string;
}

export interface ProjectSetup {
  projectTitle: string;
  abstract: string;
  techStack: string;
  persona: PersonaId;
}

export interface QaEntry {
  question: string;
  answer: string;
  scores: MetricScores;
  feedback: string;
  questionType: QuestionType;
}

export type QuestionType =
  | 'warmup'
  | 'technical'
  | 'architecture'
  | 'challenge'
  | 'edge_case'
  | 'scope'
  | 'pressure';

export interface MetricScores {
  technicalDepth: number;
  logicClarity: number;
  defensePressure: number;
  scopeKnowledge: number;
}

export interface ExamResult {
  overallScore: number;
  technicalDepth: number;
  logicClarity: number;
  defensePressure: number;
  scopeKnowledge: number;
  weakAnswers: QaEntry[];
  advice: string[];
  grade: string;
}
