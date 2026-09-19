import type {
  MetricScores,
  ProjectSetup,
  QaEntry,
  QuestionType,
  ExamResult,
} from '@/types';
import { PERSONAS } from './personas';

const QUESTIONS_PER_EXAM = 6;

interface QuestionTemplate {
  type: QuestionType;
  text: (s: ProjectSetup) => string;
}

const QUESTION_BANK: QuestionTemplate[] = [
  {
    type: 'warmup',
    text: (s) =>
      `Let's start simply. In one or two sentences, what is ${s.projectTitle} and what problem does it solve?`,
  },
  {
    type: 'scope',
    text: (s) =>
      `Walk me through the scope of ${s.projectTitle}. What did you consciously decide to leave out, and why?`,
  },
  {
    type: 'architecture',
    text: (s) =>
      `Describe the overall architecture of ${s.projectTitle}. How do the major components communicate, and where does ${s.techStack} fit in?`,
  },
  {
    type: 'technical',
    text: (s) =>
      `You listed ${s.techStack} as your stack. Why did you choose these technologies over the obvious alternatives? What were the trade-offs?`,
  },
  {
    type: 'technical',
    text: (s) =>
      `Pick the single most complex module in ${s.projectTitle} and explain how it works at a technical level — data structures, algorithms, and all.`,
  },
  {
    type: 'edge_case',
    text: (s) =>
      `What happens in ${s.projectTitle} when the network is unreliable, or when a dependency ${s.techStack.split(',')[0]?.trim() || 'service'} fails entirely? Walk me through your error handling strategy.`,
  },
  {
    type: 'challenge',
    text: () =>
      `If you had to rebuild this project from scratch with half the time, what would you do differently, and what would you keep exactly the same?`,
  },
  {
    type: 'pressure',
    text: () =>
      `Your abstract mentions several claims. Which one are you least confident you can defend, and what evidence would you need to prove it?`,
  },
  {
    type: 'scope',
    text: (s) =>
      `How does ${s.projectTitle} scale? At what point would your current architecture break, and what is your plan for that ceiling?`,
  },
  {
    type: 'challenge',
    text: () =>
      `Suppose a reviewer says your approach is over-engineered. Defend the complexity you introduced — or concede where they might be right.`,
  },
  {
    type: 'pressure',
    text: (s) =>
      `I'm not convinced by your choice of ${s.techStack.split(',')[0]?.trim() || 'this stack'}. Convince me it was the right call rather than the convenient one.`,
  },
  {
    type: 'edge_case',
    text: () =>
      `Describe a bug you hit during development that took the longest to track down. What was the root cause, and how did you isolate it?`,
  },
];

function pickQuestions(setup: ProjectSetup): QuestionTemplate[] {
  const persona = PERSONAS[setup.persona];
  const pool = [...QUESTION_BANK];

  // Friendly persona front-loads warmup/scope; strict front-loads pressure/challenge
  if (persona.questionStyle === 'coaching') {
    pool.sort((a, b) => rankFriendly(a.type) - rankFriendly(b.type));
  } else if (persona.questionStyle === 'probing') {
    pool.sort((a, b) => rankStrict(a.type) - rankStrict(b.type));
  }

  return pool.slice(0, QUESTIONS_PER_EXAM);
}

function rankFriendly(t: QuestionType): number {
  const order: Record<QuestionType, number> = {
    warmup: 0, scope: 1, architecture: 2, technical: 3,
    challenge: 4, edge_case: 5, pressure: 6,
  };
  return order[t];
}

function rankStrict(t: QuestionType): number {
  const order: Record<QuestionType, number> = {
    pressure: 0, challenge: 1, edge_case: 2, technical: 3,
    architecture: 4, scope: 5, warmup: 6,
  };
  return order[t];
}

export function generateQuestions(setup: ProjectSetup): { text: string; type: QuestionType }[] {
  return pickQuestions(setup).map((q) => ({ text: q.text(setup), type: q.type }));
}

// ---- Scoring ----

function scoreAnswer(
  answer: string,
  questionType: QuestionType,
  setup: ProjectSetup,
  personaId: string,
): MetricScores {
  const words = answer.trim().split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const sentenceCount = answer.split(/[.!?]+/).filter((s) => s.trim().length > 0).length || 1;
  const avgSentenceLen = wordCount / sentenceCount;

  const techKeywords = extractKeywords(setup.techStack);
  const techHits = techKeywords.filter((k) => answer.toLowerCase().includes(k.toLowerCase())).length;

  const hasHedge = /\b(maybe|probably|i think|sort of|kind of|not sure|maybe|perhaps|hopefully)\b/i.test(answer);
  const hasSpecific = /\b(\d+%|version|v\d|\d+x|second|ms|gb|mb|cache|index|query|async|concurr|batch|queue|retry|timeout|fallback|rate.?limit)\b/i.test(answer);
  const hasTradeoff = /\b(trade.?off|however|but|whereas|downside|cost|sacrifice|alternative|instead|rather)\b/i.test(answer);
  const hasReasoning = /\b(because|therefore|so that|in order to|due to|reason|leads to|results in)\b/i.test(answer);

  // Base lengths differ by persona strictness
  const personaMultiplier = personaId === 'strict' ? 1.25 : personaId === 'friendly' ? 0.8 : 1;

  const technicalDepth = clamp(
    25 +
      techHits * 12 +
      (hasSpecific ? 15 : 0) +
      (hasReasoning ? 12 : 0) +
      Math.min(wordCount * 0.8, 25) -
      (wordCount < 20 ? 20 : 0),
  );

  const logicClarity = clamp(
    30 +
      (hasReasoning ? 18 : 0) +
      (hasTradeoff ? 14 : 0) +
      (avgSentenceLen < 28 ? 12 : avgSentenceLen < 40 ? 6 : -8) +
      Math.min(sentenceCount * 4, 18) -
      (hasHedge ? 12 : 0),
  );

  const pressureWeight =
    questionType === 'pressure' || questionType === 'challenge' ? 1 : 0.45;
  const defensePressure = clamp(
    35 +
      (hasSpecific ? 14 : 0) +
      (hasTradeoff ? 16 : 0) -
      (hasHedge ? 22 * pressureWeight : 0) -
      (wordCount < 30 ? 18 * pressureWeight : 0) +
      Math.min(wordCount * 0.6, 22) * pressureWeight,
  );

  const scopeKnowledge = clamp(
    28 +
      (answer.toLowerCase().includes(setup.projectTitle.toLowerCase()) ? 10 : 0) +
      techHits * 8 +
      (hasTradeoff ? 12 : 0) +
      (wordCount > 60 ? 14 : wordCount > 35 ? 8 : -10) -
      (questionType === 'scope' && wordCount < 40 ? 20 : 0),
  );

  // Persona adjusts harshness
  return {
    technicalDepth: round(technicalDepth * personaMultiplier),
    logicClarity: round(logicClarity * personaMultiplier),
    defensePressure: round(defensePressure * personaMultiplier),
    scopeKnowledge: round(scopeKnowledge * personaMultiplier),
  };
}

function clamp(v: number): number {
  return Math.max(5, Math.min(100, v));
}
function round(v: number): number {
  return Math.round(clamp(v));
}

function extractKeywords(techStack: string): string[] {
  return techStack
    .split(/[,\n]/)
    .map((t) => t.trim())
    .filter((t) => t.length > 1);
}

function feedbackFor(
  scores: MetricScores,
  questionType: QuestionType,
  answer: string,
): string {
  const lowest = (Object.keys(scores) as (keyof MetricScores)[]).sort(
    (a, b) => scores[a] - scores[b],
  )[0];
  const parts: string[] = [];
  const wordCount = answer.trim().split(/\s+/).filter(Boolean).length;

  if (wordCount < 20) {
    parts.push('Your answer was very brief — examiners expect more substance.');
  }
  if (lowest === 'technicalDepth') {
    parts.push('Name specific technologies, data structures, or algorithms rather than speaking generically.');
  } else if (lowest === 'logicClarity') {
    parts.push('Structure your answer: state the claim, give the reason, then the evidence. Avoid hedging.');
  } else if (lowest === 'defensePressure') {
    parts.push(questionType === 'pressure'
      ? 'When challenged, commit to a position and justify it — hedging reads as uncertainty.'
      : 'Under pressure, lean on concrete examples and trade-offs rather than vague reassurances.');
  } else {
    parts.push('Anchor your answer to the project scope — show you know where the work begins and ends.');
  }

  return parts.join(' ');
}

export function scoreExam(entries: { question: string; answer: string; questionType: QuestionType }[], setup: ProjectSetup): ExamResult {
  const personaId = setup.persona;
  const qa: QaEntry[] = entries.map((e) => {
    const scores = scoreAnswer(e.answer, e.questionType, setup, personaId);
    return {
      question: e.question,
      answer: e.answer,
      scores,
      feedback: feedbackFor(scores, e.questionType, e.answer),
      questionType: e.questionType,
    };
  });

  const avg = (key: keyof MetricScores) =>
    Math.round(qa.reduce((sum, e) => sum + e.scores[key], 0) / qa.length);

  const technicalDepth = avg('technicalDepth');
  const logicClarity = avg('logicClarity');
  const defensePressure = avg('defensePressure');
  const scopeKnowledge = avg('scopeKnowledge');

  const overallScore = Math.round(
    (technicalDepth + logicClarity + defensePressure + scopeKnowledge) / 4,
  );

  const weakAnswers = qa
    .filter((e) => {
      const m = Math.min(...Object.values(e.scores));
      return m < 55;
    })
    .sort((a, b) => {
      const am = Math.min(...Object.values(a.scores));
      const bm = Math.min(...Object.values(b.scores));
      return am - bm;
    })
    .slice(0, 3);

  const advice = buildAdvice({ technicalDepth, logicClarity, defensePressure, scopeKnowledge }, weakAnswers, setup);

  return {
    overallScore,
    technicalDepth,
    logicClarity,
    defensePressure,
    scopeKnowledge,
    weakAnswers,
    advice,
    grade: gradeFor(overallScore),
  };
}

function buildAdvice(
  metrics: MetricScores,
  weak: QaEntry[],
  setup: ProjectSetup,
): string[] {
  const advice: string[] = [];
  const sorted = (Object.entries(metrics) as [keyof MetricScores, number][])
    .sort((a, b) => a[1] - b[1]);

  const weakest = sorted[0];
  const secondWeakest = sorted[1];

  if (weakest[0] === 'technicalDepth') {
    advice.push(`Deepen your technical grounding in ${setup.techStack}. Prepare to explain at least one internal mechanism of each technology — not just what it does, but how.`);
  } else if (weakest[0] === 'logicClarity') {
    advice.push('Practice the claim-reason-evidence structure for every answer. Before the viva, rehearse 5-minute explanations of your hardest module out loud.');
  } else if (weakest[0] === 'defensePressure') {
    advice.push('Anticipate the 3 harshest questions a skeptic would ask about your project and pre-write strong defenses. When challenged, do not hedge — commit and justify.');
  } else {
    advice.push(`Map the exact boundaries of ${setup.projectTitle}. Be ready to state what is in scope, what you deferred, and the reasoning behind each decision.`);
  }

  if (secondWeakest[0] === 'defensePressure') {
    advice.push('Do mock vivas with a peer who actively pushes back. The discomfort of being interrupted is the skill you are training.');
  } else if (secondWeakest[0] === 'technicalDepth') {
    advice.push('Review the official docs for your two most-used tools and note one non-obvious feature each — these make memorable viva answers.');
  } else if (secondWeakest[0] === 'logicClarity') {
    advice.push('Slow down. It is fine to pause for two seconds before answering — rushed answers sacrifice structure for speed.');
  } else {
    advice.push('Re-read your own abstract critically. Every claim in it is fair game; be ready to substantiate each one.');
  }

  if (weak.length >= 2) {
    advice.push(`You had ${weak.length} weak answers. Revisit those topics and write a stronger 3-sentence response to each before your real viva.`);
  } else if (weak.length === 1) {
    advice.push('One answer stood out as weak — spend 15 minutes rewriting that response with concrete examples.');
  } else {
    advice.push('No single answer was critically weak — focus on raising your average rather than patching holes.');
  }

  return advice;
}

function gradeFor(score: number): string {
  if (score >= 85) return 'Distinction';
  if (score >= 70) return 'Merit';
  if (score >= 55) return 'Pass';
  if (score >= 40) return 'Marginal';
  return 'Refer';
}
