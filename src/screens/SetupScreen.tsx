import { useState } from 'react';
import {
  GraduationCap,
  FileText,
  Layers,
  Smile,
  Target,
  Flame,
  ArrowRight,
  Sparkles,
  Clock,
  Mic,
  BarChart3,
} from 'lucide-react';
import { KeyRound } from 'lucide-react';
import type { ProjectSetup, PersonaId } from '@/types';
import { PERSONA_LIST } from '@/lib/personas';
import { isGeminiConfigured } from '@/lib/gemini';

interface SetupScreenProps {
  onStart: (setup: ProjectSetup) => void;
}

const personaIcons: Record<PersonaId, typeof Smile> = {
  friendly: Smile,
  standard: Target,
  strict: Flame,
};

export function SetupScreen({ onStart }: SetupScreenProps) {
  const [projectTitle, setProjectTitle] = useState('');
  const [abstract, setAbstract] = useState('');
  const [techStack, setTechStack] = useState('');
  const [persona, setPersona] = useState<PersonaId>('standard');
  const [touched, setTouched] = useState(false);

  const titleValid = projectTitle.trim().length >= 3;
  const abstractValid = abstract.trim().length >= 20;
  const stackValid = techStack.trim().length >= 2;
  const formValid = titleValid && abstractValid && stackValid;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!formValid) return;
    onStart({ projectTitle: projectTitle.trim(), abstract: abstract.trim(), techStack: techStack.trim(), persona });
  };

  return (
    <div className="min-h-screen bg-grid">
      {/* Header */}
      <header className="border-b border-white/5 bg-slate-950/60 backdrop-blur-xl sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center shadow-lg shadow-primary-500/30">
              <GraduationCap className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <h1 className="font-display font-bold text-white leading-none">GrillMyViva AI</h1>
              <p className="text-[11px] text-slate-500 leading-none mt-1">Viva Practice Simulator</p>
            </div>
          </div>
          <span className="chip bg-white/5 text-slate-400 border border-white/10">
            <Sparkles className="w-3 h-3" /> AI Examiner
          </span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-5 sm:px-8 py-10 sm:py-16">
        {/* Hero */}
        <div className="text-center max-w-2xl mx-auto mb-12 animate-fade-in">
          <span className="chip bg-primary-500/10 text-primary-300 border border-primary-500/20 mb-4">
            Step 1 of 3 — Setup
          </span>
          <h2 className="font-display text-4xl sm:text-5xl font-bold text-white tracking-tight mb-4">
            Walk into your viva <span className="text-gradient">already battle-tested</span>
          </h2>
          <p className="text-slate-400 text-lg leading-relaxed">
            Paste your project details, pick an examiner persona, and face a realistic oral
            defense before the real thing. You'll get scored across four dimensions and a
            targeted prep plan.
          </p>
        </div>

        {/* Feature pills */}
        <div className="grid grid-cols-3 gap-3 max-w-xl mx-auto mb-12">
          {[
            { icon: Mic, label: 'Speech-to-text answers' },
            { icon: Clock, label: 'Timed exam room' },
            { icon: BarChart3, label: 'Radar scorecard' },
          ].map((f) => (
            <div key={f.label} className="glass-card px-3 py-3 flex flex-col items-center gap-1.5 text-center">
              <f.icon className="w-4 h-4 text-primary-400" />
              <span className="text-[11px] text-slate-400 leading-tight">{f.label}</span>
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="grid lg:grid-cols-[1fr_360px] gap-6">
          {/* Form fields */}
          <div className="glass-card p-6 sm:p-8 space-y-6 animate-slide-up">
            <div>
              <label className="label" htmlFor="title">
                <FileText className="inline w-4 h-4 mr-1.5 -mt-0.5 text-primary-400" />
                Project Title
              </label>
              <input
                id="title"
                className="input-field"
                placeholder="e.g. Real-time Collaborative Code Editor"
                value={projectTitle}
                onChange={(e) => setProjectTitle(e.target.value)}
              />
              {touched && !titleValid && (
                <p className="text-error-400 text-xs mt-1.5">Please enter a title (at least 3 characters).</p>
              )}
            </div>

            <div>
              <label className="label" htmlFor="abstract">
                <FileText className="inline w-4 h-4 mr-1.5 -mt-0.5 text-primary-400" />
                Abstract
              </label>
              <textarea
                id="abstract"
                className="input-field min-h-[140px] resize-y leading-relaxed"
                placeholder="Paste your project abstract. Describe the problem, your approach, and the key outcomes..."
                value={abstract}
                onChange={(e) => setAbstract(e.target.value)}
              />
              <div className="flex justify-between mt-1.5">
                {touched && !abstractValid ? (
                  <p className="text-error-400 text-xs">Tell us a bit more (at least 20 characters).</p>
                ) : <span />}
                <span className="text-[11px] text-slate-500">{abstract.trim().length} chars</span>
              </div>
            </div>

            <div>
              <label className="label" htmlFor="stack">
                <Layers className="inline w-4 h-4 mr-1.5 -mt-0.5 text-primary-400" />
                Tech Stack
              </label>
              <input
                id="stack"
                className="input-field"
                placeholder="e.g. React, Node.js, PostgreSQL, WebSockets"
                value={techStack}
                onChange={(e) => setTechStack(e.target.value)}
              />
              <p className="text-[11px] text-slate-500 mt-1.5">Comma-separated. The examiner will probe these.</p>
            </div>
          </div>

          {/* Persona selector */}
          <div className="space-y-4 animate-slide-up" style={{ animationDelay: '0.08s' }}>
            <div className="glass-card p-5">
              <h3 className="font-display font-semibold text-white mb-1">Choose your examiner</h3>
              <p className="text-xs text-slate-500 mb-4">Difficulty scales the grading harshness.</p>
              <div className="space-y-2.5">
                {PERSONA_LIST.map((p) => {
                  const Icon = personaIcons[p.id];
                  const selected = persona === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPersona(p.id)}
                      className={`w-full text-left p-3.5 rounded-xl border transition-all duration-200 ${
                        selected
                          ? 'bg-white/[0.06] border-primary-500/50 shadow-lg shadow-primary-500/10'
                          : 'bg-white/[0.02] border-white/8 hover:border-white/15 hover:bg-white/[0.04]'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${p.gradient} flex items-center justify-center shrink-0 shadow-md`}>
                          <Icon className="w-5 h-5 text-slate-950" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-white text-sm">{p.title}</span>
                            <span className="flex gap-0.5">
                              {Array.from({ length: 5 }).map((_, i) => (
                                <span
                                  key={i}
                                  className={`w-1 h-3 rounded-full ${i < p.difficulty ? '' : 'bg-white/10'}`}
                                  style={i < p.difficulty ? { backgroundColor: p.accent } : undefined}
                                />
                              ))}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">{p.description}</p>
                          <p className="text-[10px] text-slate-500 mt-1.5 font-medium">{p.name} · {p.difficultyLabel}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <button type="submit" className="btn-primary w-full text-base py-4" disabled={!formValid}>
              Start Viva Simulation
              <ArrowRight className="w-5 h-5" />
            </button>
            {touched && !formValid && (
              <p className="text-center text-xs text-error-400">Complete all fields to begin.</p>
            )}
          </div>
        </form>
      </main>
    </div>
  );
}
