import { useCallback, useState } from 'react';
import { SetupScreen } from '@/screens/SetupScreen';
import { VivaSimulator } from '@/screens/VivaSimulator';
import { ScorecardScreen } from '@/screens/ScorecardScreen';
import { supabase } from '@/lib/supabase';
import type { ProjectSetup, QaEntry, ExamResult, Screen } from '@/types';

export default function App() {
  const [screen, setScreen] = useState<Screen>('setup');
  const [setup, setSetup] = useState<ProjectSetup | null>(null);
  const [qa, setQa] = useState<QaEntry[]>([]);
  const [result, setResult] = useState<ExamResult | null>(null);

  const handleStart = useCallback((s: ProjectSetup) => {
    setSetup(s);
    setQa([]);
    setResult(null);
    setScreen('simulator');
  }, []);

  const handleComplete = useCallback(
    async (entries: QaEntry[], res: ExamResult) => {
      setQa(entries);
      setResult(res);
      setScreen('scorecard');

      if (setup) {
        const transcript = entries.map((e) => ({
          question: e.question,
          answer: e.answer,
          scores: e.scores,
          feedback: e.feedback,
          questionType: e.questionType,
        }));
        await supabase.from('exams').insert({
          project_title: setup.projectTitle,
          abstract: setup.abstract,
          tech_stack: setup.techStack,
          persona: setup.persona,
          status: 'completed',
          transcript,
          overall_score: res.overallScore,
          technical_depth: res.technicalDepth,
          logic_clarity: res.logicClarity,
          defense_pressure: res.defensePressure,
          scope_knowledge: res.scopeKnowledge,
          weak_answers: res.weakAnswers,
          advice: res.advice,
          completed_at: new Date().toISOString(),
        });
      }
    },
    [setup],
  );

  const handleRestart = useCallback(() => {
    if (setup) {
      setQa([]);
      setResult(null);
      setScreen('simulator');
    }
  }, [setup]);

  const handleHome = useCallback(() => {
    setSetup(null);
    setQa([]);
    setResult(null);
    setScreen('setup');
  }, []);

  if (screen === 'simulator' && setup) {
    return <VivaSimulator setup={setup} onComplete={handleComplete} onExit={handleHome} />;
  }

  if (screen === 'scorecard' && setup && result) {
    return (
      <ScorecardScreen
        setup={setup}
        qa={qa}
        result={result}
        onRestart={handleRestart}
        onHome={handleHome}
      />
    );
  }

  return <SetupScreen onStart={handleStart} />;
}
