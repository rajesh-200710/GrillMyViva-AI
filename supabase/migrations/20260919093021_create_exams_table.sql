/*
# Create exams table (single-tenant, no auth)

1. New Tables
- `exams`
  - `id` (uuid, primary key)
  - `project_title` (text, not null) — the title of the student's project
  - `abstract` (text, not null) — the project abstract pasted by the student
  - `tech_stack` (text, not null) — comma-separated list of technologies
  - `persona` (text, not null) — examiner persona id: 'friendly' | 'standard' | 'strict'
  - `status` (text, not null, default 'in_progress') — 'in_progress' | 'completed'
  - `transcript` (jsonb) — array of {question, answer, scores, feedback} objects
  - `overall_score` (numeric, nullable) — final 0–100 overall score
  - `technical_depth` (numeric, nullable) — 0–100 metric
  - `logic_clarity` (numeric, nullable) — 0–100 metric
  - `defense_pressure` (numeric, nullable) — 0–100 metric
  - `scope_knowledge` (numeric, nullable) — 0–100 metric
  - `weak_answers` (jsonb, nullable) — highlighted weak Q&A pairs
  - `advice` (jsonb, nullable) — array of actionable prep advice strings
  - `created_at` (timestamptz)
  - `completed_at` (timestamptz, nullable)

2. Security
- Enable RLS on `exams`.
- Allow anon + authenticated CRUD because the data is intentionally shared/public (no sign-in screen).

3. Indexes
- Index on created_at for ordering recent sessions.
*/

CREATE TABLE IF NOT EXISTS exams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_title text NOT NULL,
  abstract text NOT NULL,
  tech_stack text NOT NULL,
  persona text NOT NULL,
  status text NOT NULL DEFAULT 'in_progress',
  transcript jsonb NOT NULL DEFAULT '[]'::jsonb,
  overall_score numeric,
  technical_depth numeric,
  logic_clarity numeric,
  defense_pressure numeric,
  scope_knowledge numeric,
  weak_answers jsonb,
  advice jsonb,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE exams ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_exams" ON exams;
CREATE POLICY "anon_select_exams" ON exams FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_exams" ON exams;
CREATE POLICY "anon_insert_exams" ON exams FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_exams" ON exams;
CREATE POLICY "anon_update_exams" ON exams FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_exams" ON exams;
CREATE POLICY "anon_delete_exams" ON exams FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS exams_created_at_idx ON exams (created_at DESC);
