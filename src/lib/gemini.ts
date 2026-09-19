import type { ProjectSetup, PersonaId } from '@/types';
import { PERSONAS } from './personas';

const GEMINI_MODEL = 'gemini-3.6-flash';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;

export function isGeminiConfigured(): boolean {
  return Boolean(apiKey && apiKey.trim().length > 0);
}

interface GeminiContentPart {
  text: string;
}

interface GeminiContent {
  role: 'user' | 'model';
  parts: GeminiContentPart[];
}

interface GeminiResponse {
  candidates?: {
    content?: { parts?: GeminiContentPart[] };
    finishReason?: string;
  }[];
  error?: { message?: string };
}

function buildSystemPrompt(setup: ProjectSetup, personaId: PersonaId): string {
  const persona = PERSONAS[personaId];

  const personaBehavior: Record<PersonaId, string> = {
    friendly:
      'You are warm, encouraging, and patient. You start with broad, approachable questions and gently nudge the student toward deeper answers. You acknowledge good points before pushing further. You ask roughly 6 questions total.',
    standard:
      'You are balanced, fair, and thorough. You cover the full breadth of the project with well-structured questions spanning architecture, technical decisions, scope, and edge cases. You are professional but not harsh. You ask roughly 6 questions total.',
    strict:
      'You are rigorous, demanding, and precise. You probe edge cases aggressively, challenge vague answers immediately, and do not accept hand-waving. You push the student to justify every claim with concrete evidence. You ask roughly 6 questions total.',
  };

  return `You are ${persona.name}, a ${persona.title} conducting a project viva (oral defense) for a university student.

${personaBehavior[personaId]}

PROJECT DETAILS:
- Title: ${setup.projectTitle}
- Abstract: ${setup.abstract}
- Tech Stack: ${setup.techStack}

RULES — follow these strictly:
1. You are the EXAMINER. You ask questions ONE AT A TIME and wait for the student's answer.
2. Never answer your own questions. Never write the student's response for them.
3. Keep each question concise — 1 to 3 sentences max.
4. React briefly to the student's answer (one short sentence acknowledging or challenging it), then ask your NEXT question.
5. Stay fully in character as ${persona.name}. Speak in first person as the examiner.
6. Base your questions on the project details above. Probe the tech stack, architecture, scope, trade-offs, and edge cases.
7. After roughly 6 questions, when you have covered enough ground, end the viva by saying exactly: "END_OF_VIVA" on its own line. Do NOT say this before you have asked at least 6 questions and received answers.
8. Do not use markdown headers, bullet points, or code blocks. Speak naturally as a person would in an oral exam.
9. If the student says "[Skipped]" or gives no real answer, note it briefly and move to your next question.

Begin now by asking your FIRST question.`;
}

export interface GeminiMessage {
  role: 'user' | 'model';
  text: string;
}

/**
 * Calls the Gemini API with the full conversation history.
 * Returns the examiner's next message, or throws on error.
 */
export async function sendToExaminer(
  setup: ProjectSetup,
  history: GeminiMessage[],
): Promise<string> {
  if (!apiKey) {
    throw new Error('Missing VITE_GEMINI_API_KEY. Add your Gemini API key to the .env file.');
  }
  

  const systemPrompt = buildSystemPrompt(setup, setup.persona);

  const contents: GeminiContent[] = [
    { role: 'user', parts: [{ text: systemPrompt }] },
    { role: 'model', parts: [{ text: 'Understood. I am ready to begin the viva.' }] },
    ...history.map((m) => ({
      role: m.role,
      parts: [{ text: m.text }],
    })),
  ];
  while (contents.length > 0 && contents[contents.length - 1].role === 'model') {
    contents.pop();
  }

  const body = {
    contents,
    generationConfig: {
      temperature: 0.8,
      maxOutputTokens: 1024,
    },
  };

  const res = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    let detail = '';
    try {
      const errBody = (await res.json()) as GeminiResponse;
      detail = errBody.error?.message ?? '';
    } catch {
      detail = await res.text().catch(() => '');
    }
    throw new Error(`Gemini API error (${res.status}): ${detail || res.statusText}`);
  }

  const data = (await res.json()) as GeminiResponse;

  if (data.error) {
    throw new Error(data.error.message ?? 'Unknown Gemini API error');
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('Gemini returned an empty response. Try again.');
  }

  return text.trim();
}

/**
 * Asks Gemini to produce a final scorecard for the completed viva.
 * Returns parsed scores + feedback for each Q&A pair.
 */
export interface GeminiScore {
  question: string;
  answer: string;
  questionType: string;
  scores: {
    technicalDepth: number;
    logicClarity: number;
    defensePressure: number;
    scopeKnowledge: number;
  };
  feedback: string;
}

export interface GeminiScorecard {
  scores: GeminiScore[];
  overallScore: number;
  weakAnswers: GeminiScore[];
  advice: string[];
}

export async function scoreVivaWithGemini(
  setup: ProjectSetup,
  qaPairs: { question: string; answer: string }[],
): Promise<GeminiScorecard> {
  if (!apiKey) {
    throw new Error('Missing VITE_GEMINI_API_KEY.');
  }

  const persona = PERSONAS[setup.persona];
  const qaText = qaPairs
    .map((qa, i) => `Q${i + 1}: ${qa.question}\nA${i + 1}: ${qa.answer}`)
    .join('\n\n');

  const prompt = `You are ${persona.name}, a ${persona.title} who just finished conducting a viva for this project.

PROJECT: ${setup.projectTitle}
TECH STACK: ${setup.techStack}
ABSTRACT: ${setup.abstract}

VIVA TRANSCRIPT:
${qaText}

Score this viva. Return ONLY valid JSON (no markdown, no code fences) in exactly this shape:
{
  "scores": [
    {
      "question": "<the examiner question>",
      "answer": "<the student answer>",
      "questionType": "one of: warmup, technical, architecture, challenge, edge_case, scope, pressure",
      "scores": {
        "technicalDepth": <0-100 integer>,
        "logicClarity": <0-100 integer>,
        "defensePressure": <0-100 integer>,
        "scopeKnowledge": <0-100 integer>
      },
      "feedback": "<one sentence of actionable feedback>"
    }
  ],
  "overallScore": <0-100 integer, weighted average>,
  "weakAnswers": [<the 1-3 lowest scoring entries from scores, repeated in full>],
  "advice": ["<3 actionable prep tips as strings>"]
}

Grade harshly for a strict examiner, fairly for a standard one, and generously for a friendly one.`;

  const res = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 2048 },
    }),
  });

  if (!res.ok) {
    throw new Error(`Gemini scoring failed (${res.status}).`);
  }

  const data = (await res.json()) as GeminiResponse;
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini returned no scorecard.');

  const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  const parsed = JSON.parse(cleaned) as GeminiScorecard;

  return parsed;
}
