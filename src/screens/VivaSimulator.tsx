import { useEffect, useRef, useState, useCallback } from 'react';
import {
  GraduationCap,
  Send,
  Mic,
  Square,
  SkipForward,
  AlertCircle,
  Timer as TimerIcon,
  CheckCircle2,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import type { ProjectSetup, QaEntry, ExamResult, QuestionType } from '@/types';
import { PERSONAS } from '@/lib/personas';
import {
  isGeminiConfigured,
  sendToExaminer,
  scoreVivaWithGemini,
  type GeminiMessage,
} from '@/lib/gemini';
import { scoreExam } from '@/lib/examiner';
import { WaveVisualizer } from '@/components/WaveVisualizer';
import { useTimer, formatTime } from '@/components/Timer';

interface VivaSimulatorProps {
  setup: ProjectSetup;
  onComplete: (qa: QaEntry[], result: ExamResult) => void;
  onExit: () => void;
}

interface Message {
  role: 'examiner' | 'student';
  text: string;
  questionType?: QuestionType;
}

const END_MARKER = 'END_OF_VIVA';

function inferQuestionType(text: string): QuestionType {
  const t = text.toLowerCase();
  if (/warm.?up|start simply|introduce|tell me about/.test(t)) return 'warmup';
  if (/architecture|component|how does.*work|structure|design/.test(t)) return 'architecture';
  if (/edge case|fail|error|crash|unreliable|when.*breaks|what happens when/.test(t)) return 'edge_case';
  if (/convince me|not convinced|defend|why did you choose|over-engineered|rebuild/.test(t)) return 'challenge';
  if (/scale|ceiling|grow|bottleneck|performance at/.test(t)) return 'scope';
  if (/least confident|prove|evidence|push back|hardest|concern/.test(t)) return 'pressure';
  return 'technical';
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { resultIndex: number; results: { length: number; [i: number]: { 0: { transcript: string } } } }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}

function getSpeechRecognition(): SpeechRecognitionLike | null {
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

const QUESTION_TYPE_LABEL: Record<QuestionType, string> = {
  warmup: 'Warm-up',
  technical: 'Technical',
  architecture: 'Architecture',
  challenge: 'Challenge',
  edge_case: 'Edge Case',
  scope: 'Scope',
  pressure: 'Pressure Test',
};

export function VivaSimulator({ setup, onComplete, onExit }: VivaSimulatorProps) {
  const persona = PERSONAS[setup.persona];

  const [messages, setMessages] = useState<Message[]>([]);
  const [answer, setAnswer] = useState('');
  const [recording, setRecording] = useState(false);
  const [interim, setInterim] = useState('');
  const [speechSupported, setSpeechSupported] = useState(true);
  const [examFinished, setExamFinished] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [questionCount, setQuestionCount] = useState(0);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<GeminiMessage[]>([]);
  const qaPairsRef = useRef<{ question: string; answer: string }[]>([]);
  const lastExaminerQuestionRef = useRef<string>('');
  const loadingFirstRef = useRef(true);

  const seconds = useTimer({ running: !examFinished, resetKey: 'session' });

  // Load the first question from Gemini
  useEffect(() => {
    setSpeechSupported(getSpeechRecognition() !== null);
    let cancelled = false;

    const loadFirst = async () => {
      if (!isGeminiConfigured()) {
        setError('Missing Gemini API key. Add VITE_GEMINI_API_KEY to your .env file to power the chat.');
        loadingFirstRef.current = false;
        return;
      }

      setThinking(true);
      try {
        const reply = await sendToExaminer(setup, []);
        if (cancelled) return;

        const cleaned = reply.replace(END_MARKER, '').trim();
        const qType = inferQuestionType(cleaned);
        lastExaminerQuestionRef.current = cleaned;
        setMessages([{ role: 'examiner', text: cleaned, questionType: qType }]);
        setQuestionCount(1);
        setThinking(false);
        loadingFirstRef.current = false;
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to connect to Gemini.');
        setThinking(false);
        loadingFirstRef.current = false;
      }
    };

    loadFirst();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, thinking]);

  const stopRecognition = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setRecording(false);
  }, []);

  const startRecording = useCallback(() => {
    const rec = getSpeechRecognition();
    if (!rec) {
      setSpeechSupported(false);
      return;
    }
    rec.lang = 'en-US';
    rec.continuous = true;
    rec.interimResults = true;
    const baseAnswer = answer;
    let collected = '';
    rec.onresult = (e) => {
      let interimText = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        interimText += e.results[i][0].transcript;
      }
      collected = interimText;
      setInterim(interimText);
    };
    rec.onend = () => {
      const combined = (baseAnswer + ' ' + collected).trim();
      setAnswer(combined);
      setInterim('');
      setRecording(false);
    };
    rec.onerror = () => {
      setRecording(false);
      setInterim('');
    };
    rec.start();
    recognitionRef.current = rec;
    setRecording(true);
  }, [answer]);

  const toggleRecording = () => {
    if (recording) stopRecognition();
    else startRecording();
  };

  const finishExam = useCallback(async () => {
    setExamFinished(true);
    const qaPairs = qaPairsRef.current;

    // Try Gemini-powered scoring; fall back to heuristic if it fails
    try {
      const geminiResult = await scoreVivaWithGemini(setup, qaPairs);

      const qa: QaEntry[] = geminiResult.scores.map((s) => ({
        question: s.question,
        answer: s.answer,
        scores: {
          technicalDepth: clampScore(s.scores.technicalDepth),
          logicClarity: clampScore(s.scores.logicClarity),
          defensePressure: clampScore(s.scores.defensePressure),
          scopeKnowledge: clampScore(s.scores.scopeKnowledge),
        },
        feedback: s.feedback,
        questionType: (s.questionType as QuestionType) || 'technical',
      }));

      const result: ExamResult = {
        overallScore: clampScore(geminiResult.overallScore),
        technicalDepth: Math.round(
          qa.reduce((sum, e) => sum + e.scores.technicalDepth, 0) / Math.max(qa.length, 1),
        ),
        logicClarity: Math.round(
          qa.reduce((sum, e) => sum + e.scores.logicClarity, 0) / Math.max(qa.length, 1),
        ),
        defensePressure: Math.round(
          qa.reduce((sum, e) => sum + e.scores.defensePressure, 0) / Math.max(qa.length, 1),
        ),
        scopeKnowledge: Math.round(
          qa.reduce((sum, e) => sum + e.scores.scopeKnowledge, 0) / Math.max(qa.length, 1),
        ),
        weakAnswers: geminiResult.weakAnswers.map((w) => ({
          question: w.question,
          answer: w.answer,
          scores: {
            technicalDepth: clampScore(w.scores.technicalDepth),
            logicClarity: clampScore(w.scores.logicClarity),
            defensePressure: clampScore(w.scores.defensePressure),
            scopeKnowledge: clampScore(w.scores.scopeKnowledge),
          },
          feedback: w.feedback,
          questionType: (w.questionType as QuestionType) || 'technical',
        })),
        advice: geminiResult.advice,
        grade: gradeFor(clampScore(geminiResult.overallScore)),
      };

      onComplete(qa, result);
    } catch {
      // Fallback: heuristic scoring
      const qaRaw = qaPairs.map((p) => ({
        question: p.question,
        answer: p.answer,
        questionType: inferQuestionType(p.question) as QuestionType,
      }));
      const result = scoreExam(qaRaw, setup);
      const qa: QaEntry[] = qaRaw.map((e) => {
        const single = scoreExam([e], setup);
        return {
          question: e.question,
          answer: e.answer,
          scores: {
            technicalDepth: single.technicalDepth,
            logicClarity: single.logicClarity,
            defensePressure: single.defensePressure,
            scopeKnowledge: single.scopeKnowledge,
          },
          feedback: feedbackFor(e.answer, e.questionType),
          questionType: e.questionType,
        };
      });
      onComplete(qa, result);
    }
  }, [setup, onComplete]);

  const submitAnswer = async () => {
    const trimmed = (answer + (interim ? ' ' + interim : '')).trim();
    if (trimmed.length < 2 || thinking) return;

    stopRecognition();
    setError(null);

    // Record the Q&A pair
    const currentQuestion = lastExaminerQuestionRef.current;
    qaPairsRef.current.push({ question: currentQuestion, answer: trimmed });
    historyRef.current.push({ role: 'user', text: trimmed });

    setMessages((m) => [...m, { role: 'student', text: trimmed }]);
    setAnswer('');
    setInterim('');
    setThinking(true);

    try {
      const reply = await sendToExaminer(setup, historyRef.current);
      setThinking(false);

      if (reply.includes(END_MARKER)) {
        const cleaned = reply.replace(END_MARKER, '').trim();
        if (cleaned) {
          setMessages((m) => [...m, { role: 'examiner', text: cleaned, questionType: inferQuestionType(cleaned) }]);
        }
        finishExam();
        return;
      }

      lastExaminerQuestionRef.current = reply;
      const qType = inferQuestionType(reply);
      setMessages((m) => [...m, { role: 'examiner', text: reply, questionType: qType }]);
      historyRef.current.push({ role: 'model', text: reply });
      setQuestionCount((c) => c + 1);
    } catch (err) {
      setThinking(false);
      setError(err instanceof Error ? err.message : 'Gemini failed to respond. Try again or end the viva.');
    }
  };

  const skipQuestion = async () => {
    if (thinking) return;
    stopRecognition();
    setError(null);

    const currentQuestion = lastExaminerQuestionRef.current;
    qaPairsRef.current.push({ question: currentQuestion, answer: '[Skipped]' });
    historyRef.current.push({ role: 'user', text: '[Skipped]' });

    setMessages((m) => [...m, { role: 'student', text: '[Skipped]' }]);
    setAnswer('');
    setInterim('');
    setThinking(true);

    try {
      const reply = await sendToExaminer(setup, historyRef.current);
      setThinking(false);

      if (reply.includes(END_MARKER)) {
        const cleaned = reply.replace(END_MARKER, '').trim();
        if (cleaned) {
          setMessages((m) => [...m, { role: 'examiner', text: cleaned, questionType: inferQuestionType(cleaned) }]);
        }
        finishExam();
        return;
      }

      lastExaminerQuestionRef.current = reply;
      const qType = inferQuestionType(reply);
      setMessages((m) => [...m, { role: 'examiner', text: reply, questionType: qType }]);
      historyRef.current.push({ role: 'model', text: reply });
      setQuestionCount((c) => c + 1);
    } catch (err) {
      setThinking(false);
      setError(err instanceof Error ? err.message : 'Gemini failed to respond.');
    }
  };

  const endVivaNow = () => {
    if (qaPairsRef.current.length > 0) {
      finishExam();
    }
  };

  const retryLastCall = () => {
    setError(null);
    if (loadingFirstRef.current) {
      // Retry loading first question
      window.location.reload();
      return;
    }
    submitAnswer();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      submitAnswer();
    }
  };

  const displayAnswer = answer + (interim ? ' ' + interim : '');

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-white/5 bg-slate-950/70 backdrop-blur-xl sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={onExit}
              className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition shrink-0"
              title="Exit to setup"
            >
              <GraduationCap className="w-4 h-4 text-slate-300" />
            </button>
            <div className="min-w-0">
              <p className="text-[11px] text-slate-500 leading-none">Examining</p>
              <p className="text-sm font-semibold text-white truncate">{setup.projectTitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <span
              className="chip border"
              style={{ backgroundColor: `${persona.accent}1a`, borderColor: `${persona.accent}33`, color: persona.accent }}
            >
              {persona.emoji} {persona.difficultyLabel}
            </span>
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10">
              <TimerIcon className="w-3.5 h-3.5 text-primary-400" />
              <span className="font-mono text-sm text-slate-200 tabular-nums">{formatTime(seconds)}</span>
            </div>
          </div>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
        <div className="max-w-4xl mx-auto space-y-5">
          {/* Examiner info banner */}
          <div className="glass-card p-4 flex items-center gap-4 animate-fade-in">
            <div
              className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${persona.gradient} flex items-center justify-center text-2xl shrink-0 shadow-lg`}
              style={{ boxShadow: `0 8px 24px ${persona.accent}33` }}
            >
              {persona.emoji}
            </div>
            <div className="min-w-0">
              <p className="font-display font-semibold text-white">{persona.name}</p>
              <p className="text-xs text-slate-400">{persona.title} · {persona.description.split('.')[0]}.</p>
            </div>
            <div className="ml-auto hidden sm:block">
              <WaveVisualizer active={!examFinished && !thinking} accent={persona.accent} bars={18} />
            </div>
          </div>

          {/* Error banner */}
          {error && (
            <div className="rounded-xl bg-error-500/10 border border-error-500/30 p-4 flex items-start gap-3 animate-fade-in">
              <AlertCircle className="w-5 h-5 text-error-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-error-300 font-medium">Connection error</p>
                <p className="text-xs text-error-400/80 mt-0.5">{error}</p>
                <button onClick={retryLastCall} className="btn-ghost mt-2 !py-1.5 !px-3 text-xs">
                  <RefreshCw className="w-3 h-3" /> Retry
                </button>
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <MessageBubble key={i} message={msg} persona={persona} />
          ))}

          {thinking && (
            <div className="flex items-center gap-3 animate-fade-in">
              <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${persona.gradient} flex items-center justify-center text-base shrink-0`}>
                {persona.emoji}
              </div>
              <div className="glass px-4 py-3 rounded-2xl rounded-tl-sm flex items-center gap-2">
                <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
                <span className="text-xs text-slate-500">{messages.length === 0 ? 'Preparing the first question...' : 'Thinking...'}</span>
              </div>
            </div>
          )}

          {examFinished && (
            <div className="glass-card p-6 text-center animate-slide-up">
              <CheckCircle2 className="w-10 h-10 text-success-400 mx-auto mb-3" />
              <h3 className="font-display text-xl font-bold text-white mb-1">Viva complete</h3>
              <p className="text-slate-400 text-sm">Generating your scorecard...</p>
            </div>
          )}
        </div>
      </div>

      {!examFinished && (
        <div className="border-t border-white/5 bg-slate-950/80 backdrop-blur-xl">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4">
            <div className="flex items-end gap-2 sm:gap-3">
              <button
                onClick={toggleRecording}
                disabled={thinking}
                className={`relative w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-all duration-200 disabled:opacity-40 ${
                  recording ? 'bg-error-500/20 border-2 border-error-500/50' : 'bg-white/5 border border-white/10 hover:bg-white/10'
                }`}
                title={speechSupported ? 'Speech to text' : 'Speech recognition not available'}
              >
                {recording ? <Square className="w-4 h-4 text-error-400 fill-error-400" /> : <Mic className="w-5 h-5 text-slate-300" />}
                {recording && <span className="absolute inset-0 rounded-xl border-2 border-error-500/40 animate-ping" />}
              </button>

              <div className="flex-1 relative">
                <textarea
                  value={displayAnswer}
                  onChange={(e) => { if (!recording) setAnswer(e.target.value); }}
                  onKeyDown={handleKeyDown}
                  rows={1}
                  className="input-field resize-none min-h-[48px] max-h-32 py-3 pr-3 leading-relaxed"
                  placeholder={recording ? 'Listening...' : thinking ? 'Examiner is responding...' : 'Type your answer, or tap the mic to speak...'}
                  disabled={recording || thinking}
                />
                {recording && (
                  <div className="absolute -top-7 left-0">
                    <WaveVisualizer active bars={14} accent={persona.accent} />
                  </div>
                )}
              </div>

              <button
                onClick={skipQuestion}
                disabled={thinking}
                className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition shrink-0 disabled:opacity-40"
                title="Skip this question"
              >
                <SkipForward className="w-4 h-4 text-slate-400" />
              </button>

              <button
                onClick={submitAnswer}
                disabled={displayAnswer.trim().length < 2 || thinking}
                className="btn-primary w-12 h-12 !px-0 shrink-0"
                title="Submit answer (Cmd+Enter)"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
            <div className="flex items-center justify-between mt-2 px-1">
              <p className="text-[11px] text-slate-500">
                {questionCount > 0 ? `${questionCount} questions asked` : 'Starting...'}
                {speechSupported ? '' : ' · Speech-to-text unavailable in this browser'}
              </p>
              <div className="flex items-center gap-2">
                {questionCount >= 3 && (
                  <button
                    onClick={endVivaNow}
                    disabled={thinking}
                    className="text-[11px] text-slate-500 hover:text-slate-300 transition"
                  >
                    End viva now
                  </button>
                )}
                {!speechSupported && (
                  <span className="chip bg-warning-500/10 text-warning-400 border border-warning-500/20">
                    <AlertCircle className="w-3 h-3" /> Use Chrome
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MessageBubble({ message, persona }: { message: Message; persona: typeof PERSONAS[keyof typeof PERSONAS] }) {
  const isExaminer = message.role === 'examiner';
  return (
    <div className={`flex items-start gap-3 animate-slide-in ${isExaminer ? '' : 'flex-row-reverse'}`}>
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0 ${
        isExaminer ? `bg-gradient-to-br ${persona.gradient}` : 'bg-slate-700 border border-white/10'
      }`}>
        {isExaminer ? persona.emoji : '🧑‍🎓'}
      </div>
      <div className={`max-w-[80%] ${isExaminer ? '' : 'items-end'}`}>
        {isExaminer && message.questionType && (
          <span
            className="chip mb-1.5 border"
            style={{ backgroundColor: `${persona.accent}14`, borderColor: `${persona.accent}2a`, color: persona.accent, fontSize: '10px' }}
          >
            {QUESTION_TYPE_LABEL[message.questionType]}
          </span>
        )}
        <div className={`px-4 py-3 rounded-2xl leading-relaxed text-sm sm:text-[15px] whitespace-pre-wrap break-words ${
          isExaminer
            ? 'glass rounded-tl-sm text-slate-100'
            : 'bg-primary-500/15 border border-primary-500/25 rounded-tr-sm text-slate-100'
        }`}>
          {message.text}
        </div>
      </div>
    </div>
  );
}

function feedbackFor(answer: string, qType: QuestionType): string {
  const wc = answer.trim().split(/\s+/).filter(Boolean).length;
  if (wc < 20) return 'Very brief — add specific detail and reasoning.';
  if (qType === 'pressure' && /\b(maybe|not sure|kind of|sort of|perhaps)\b/i.test(answer)) {
    return 'You hedged under pressure — commit to a position and justify it.';
  }
  if (qType === 'technical' && !/\b(because|so that|due to|in order to|reason)\b/i.test(answer)) {
    return 'Explain the why behind your technical choices, not just the what.';
  }
  if (qType === 'scope' && wc < 40) {
    return 'Scope questions need boundaries — name what is in and out, and why.';
  }
  return 'Solid answer — push for one more concrete example to strengthen it.';
}

function clampScore(v: number): number {
  return Math.max(0, Math.min(100, Math.round(v)));
}

function gradeFor(score: number): string {
  if (score >= 85) return 'Distinction';
  if (score >= 70) return 'Merit';
  if (score >= 55) return 'Pass';
  if (score >= 40) return 'Marginal';
  return 'Refer';
}
