import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: false,
  },
});

export interface ExamRow {
  id: string;
  project_title: string;
  abstract: string;
  tech_stack: string;
  persona: string;
  status: string;
  transcript: unknown[];
  overall_score: number | null;
  technical_depth: number | null;
  logic_clarity: number | null;
  defense_pressure: number | null;
  scope_knowledge: number | null;
  weak_answers: unknown[] | null;
  advice: string[] | null;
  created_at: string;
  completed_at: string | null;
}
