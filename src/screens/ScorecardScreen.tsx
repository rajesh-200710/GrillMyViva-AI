import {
  GraduationCap,
  RotateCcw,
  Home,
  Trophy,
  Code2,
  Brain,
  Shield,
  Compass,
  AlertTriangle,
  Lightbulb,
  TrendingUp,
  ArrowLeft,
} from 'lucide-react';
import type { ExamResult, QaEntry, ProjectSetup } from '@/types';
import { PERSONAS } from '@/lib/personas';
import { RadarChart } from '@/components/RadarChart';

interface ScorecardScreenProps {
  setup: ProjectSetup;
  qa: QaEntry[];
  result: ExamResult;
  onRestart: () => void;
  onHome: () => void;
}

const METRIC_META = [
  { key: 'technicalDepth', label: 'Technical Depth', icon: Code2, color: '#22d3ee' },
  { key: 'logicClarity', label: 'Logic & Clarity', icon: Brain, color: '#a78bfa' },
  { key: 'defensePressure', label: 'Defense Under Pressure', icon: Shield, color: '#fb7185' },
  { key: 'scopeKnowledge', label: 'Scope Knowledge', icon: Compass, color: '#4ade80' },
] as const;

export function ScorecardScreen({ setup, qa, result, onRestart, onHome }: ScorecardScreenProps) {
  const persona = PERSONAS[setup.persona];
  const metrics = METRIC_META.map((m) => ({
    label: m.label.split(' ')[0],
    value: result[m.key],
  }));

  return (
    <div className="min-h-screen bg-grid">
      <header className="border-b border-white/5 bg-slate-950/60 backdrop-blur-xl sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-5 sm:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center shadow-lg shadow-primary-500/30">
              <GraduationCap className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <h1 className="font-display font-bold text-white leading-none">Scorecard</h1>
              <p className="text-[11px] text-slate-500 leading-none mt-1">Step 3 of 3 — Results</p>
            </div>
          </div>
          <button onClick={onHome} className="btn-ghost !py-2 !px-4 text-sm">
            <Home className="w-4 h-4" /> Home
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-5 sm:px-8 py-8 sm:py-12 space-y-6">
        {/* Hero score */}
        <section className="glass-card p-6 sm:p-8 animate-slide-up">
          <div className="grid sm:grid-cols-[auto_1fr] gap-6 items-center">
            <ScoreRing score={result.overallScore} grade={result.grade} />
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Trophy className="w-5 h-5 text-accent-400" />
                <span className="text-xs font-semibold uppercase tracking-wider text-accent-400">Final Verdict</span>
              </div>
              <h2 className="font-display text-3xl sm:text-4xl font-bold text-white mb-2">
                {result.grade}
              </h2>
              <p className="text-slate-400 leading-relaxed mb-4">
                You faced <span className="text-white font-medium">{persona.name}</span> ({persona.title})
                on <span className="text-white font-medium">{setup.projectTitle}</span>. Here's how you held up
                across four dimensions of viva performance.
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="chip bg-white/5 text-slate-300 border border-white/10">
                  {qa.length} questions answered
                </span>
                <span className="chip" style={{ backgroundColor: `${persona.accent}1a`, color: persona.accent, border: `1px solid ${persona.accent}33` }}>
                  {persona.emoji} {persona.difficultyLabel} difficulty
                </span>
                {result.weakAnswers.length > 0 && (
                  <span className="chip bg-error-500/10 text-error-400 border border-error-500/20">
                    <AlertTriangle className="w-3 h-3" /> {result.weakAnswers.length} weak answers
                  </span>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Radar + metrics */}
        <section className="grid lg:grid-cols-[400px_1fr] gap-6">
          <div className="glass-card p-6 animate-slide-up" style={{ animationDelay: '0.05s' }}>
            <h3 className="font-display font-semibold text-white mb-1">Performance Radar</h3>
            <p className="text-xs text-slate-500 mb-2">Closer to the edge = stronger.</p>
            <RadarChart metrics={metrics} accent={persona.accent} size={340} />
          </div>

          <div className="space-y-3 animate-slide-up" style={{ animationDelay: '0.1s' }}>
            {METRIC_META.map((m) => {
              const value = result[m.key];
              const tone = value >= 70 ? 'success' : value >= 50 ? 'warning' : 'error';
              const toneColor = tone === 'success' ? '#4ade80' : tone === 'warning' ? '#facc15' : '#f87171';
              return (
                <div key={m.key} className="glass-card p-4 flex items-center gap-4">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${m.color}1a`, border: `1px solid ${m.color}33` }}>
                    <m.icon className="w-5 h-5" style={{ color: m.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-medium text-white text-sm">{m.label}</span>
                      <span className="font-mono font-bold text-lg tabular-nums" style={{ color: toneColor }}>{value}</span>
                    </div>
                    <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700 ease-out"
                        style={{ width: `${value}%`, backgroundColor: m.color, boxShadow: `0 0 8px ${m.color}66` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Weak answers */}
        {result.weakAnswers.length > 0 && (
          <section className="glass-card p-6 sm:p-8 animate-slide-up" style={{ animationDelay: '0.15s' }}>
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="w-5 h-5 text-error-400" />
              <h3 className="font-display font-semibold text-white">Weakest Answers to Revisit</h3>
            </div>
            <p className="text-xs text-slate-500 mb-5">Your lowest-scoring responses. Rewrite these before your real viva.</p>
            <div className="space-y-4">
              {result.weakAnswers.map((entry, i) => {
                const min = Math.min(...Object.values(entry.scores));
                return (
                  <div key={i} className="rounded-xl bg-error-500/5 border border-error-500/15 p-4">
                    <div className="flex items-start gap-3 mb-3">
                      <span className="w-6 h-6 rounded-full bg-error-500/20 text-error-400 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                        {i + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="text-[11px] uppercase tracking-wide text-error-400/80 font-semibold mb-1">Examiner asked</p>
                        <p className="text-sm text-slate-200 leading-relaxed">{entry.question}</p>
                      </div>
                    </div>
                    <div className="ml-9 mb-3">
                      <p className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold mb-1">You said</p>
                      <p className="text-sm text-slate-400 italic leading-relaxed">"{entry.answer}"</p>
                    </div>
                    <div className="ml-9 flex items-start gap-2">
                      <Lightbulb className="w-4 h-4 text-accent-400 shrink-0 mt-0.5" />
                      <p className="text-sm text-slate-300 leading-relaxed">{entry.feedback}</p>
                    </div>
                    <div className="ml-9 mt-3 flex gap-2">
                      {METRIC_META.map((m) => {
                        const v = entry.scores[m.key];
                        return (
                          <span key={m.key} className="chip text-[10px] !py-0.5" style={{ backgroundColor: `${m.color}14`, color: m.color, border: `1px solid ${m.color}2a` }}>
                            {m.label.split(' ')[0]} {v}
                          </span>
                        );
                      })}
                      <span className="chip text-[10px] !py-0.5 bg-error-500/10 text-error-400 border border-error-500/20 ml-auto">Lowest: {min}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Advice */}
        <section className="glass-card p-6 sm:p-8 animate-slide-up" style={{ animationDelay: '0.2s' }}>
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-5 h-5 text-success-400" />
            <h3 className="font-display font-semibold text-white">Actionable Prep Plan</h3>
          </div>
          <p className="text-xs text-slate-500 mb-5">Targeted steps to raise your weakest dimensions before the real thing.</p>
          <div className="grid sm:grid-cols-2 gap-3">
            {result.advice.map((tip, i) => (
              <div key={i} className="rounded-xl bg-success-500/5 border border-success-500/15 p-4 flex items-start gap-3">
                <span className="w-7 h-7 rounded-lg bg-success-500/15 text-success-400 text-sm font-bold flex items-center justify-center shrink-0">
                  {i + 1}
                </span>
                <p className="text-sm text-slate-300 leading-relaxed">{tip}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Full transcript (collapsible-ish, shown compactly) */}
        <section className="glass-card p-6 sm:p-8 animate-slide-up" style={{ animationDelay: '0.25s' }}>
          <h3 className="font-display font-semibold text-white mb-1">Full Transcript</h3>
          <p className="text-xs text-slate-500 mb-5">Every question and your response, with per-answer scores.</p>
          <div className="space-y-3">
            {qa.map((entry, i) => {
              const avg = Math.round(
                (entry.scores.technicalDepth + entry.scores.logicClarity + entry.scores.defensePressure + entry.scores.scopeKnowledge) / 4,
              );
              const tone = avg >= 70 ? '#4ade80' : avg >= 50 ? '#facc15' : '#f87171';
              return (
                <details key={i} className="rounded-xl bg-white/[0.02] border border-white/8 overflow-hidden group">
                  <summary className="p-4 cursor-pointer flex items-center gap-3 hover:bg-white/[0.03] transition list-none">
                    <span className="w-6 h-6 rounded-full bg-white/10 text-slate-300 text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                    <span className="text-sm text-slate-300 flex-1 truncate">{entry.question}</span>
                    <span className="font-mono font-bold text-sm tabular-nums shrink-0" style={{ color: tone }}>{avg}</span>
                  </summary>
                  <div className="px-4 pb-4 pt-1 border-t border-white/5">
                    <p className="text-sm text-slate-400 italic my-3">"{entry.answer || '[No answer]'}"</p>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {METRIC_META.map((m) => (
                        <span key={m.key} className="chip text-[10px] !py-0.5" style={{ backgroundColor: `${m.color}14`, color: m.color, border: `1px solid ${m.color}2a` }}>
                          {m.label.split(' ')[0]} {entry.scores[m.key]}
                        </span>
                      ))}
                    </div>
                    <div className="flex items-start gap-2 mt-2">
                      <Lightbulb className="w-3.5 h-3.5 text-accent-400 shrink-0 mt-0.5" />
                      <p className="text-xs text-slate-400 leading-relaxed">{entry.feedback}</p>
                    </div>
                  </div>
                </details>
              );
            })}
          </div>
        </section>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2 animate-slide-up" style={{ animationDelay: '0.3s' }}>
          <button onClick={onHome} className="btn-ghost flex-1">
            <ArrowLeft className="w-4 h-4" /> New Project
          </button>
          <button onClick={onRestart} className="btn-primary flex-1">
            <RotateCcw className="w-4 h-4" /> Retake Viva
          </button>
        </div>
      </main>
    </div>
  );
}

function ScoreRing({ score, grade }: { score: number; grade: string }) {
  const r = 52;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = score >= 70 ? '#4ade80' : score >= 50 ? '#facc15' : '#f87171';
  return (
    <div className="relative w-[140px] h-[140px] shrink-0 mx-auto sm:mx-0">
      <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
        <circle
          cx="60" cy="60" r={r} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1s ease-out', filter: `drop-shadow(0 0 6px ${color}66)` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-4xl font-bold text-white tabular-nums">{score}</span>
        <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">{grade}</span>
      </div>
    </div>
  );
}
