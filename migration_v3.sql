-- Migration v3: Tabela de feedbacks
-- Execute no SQL Editor do Supabase Dashboard

CREATE TABLE IF NOT EXISTS feedbacks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  colaborador TEXT NOT NULL,
  mes TEXT NOT NULL DEFAULT '',
  sugestao_automatica TEXT DEFAULT '',
  anotacoes TEXT DEFAULT '',
  feedback_final TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE feedbacks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "feedbacks_select" ON feedbacks;
CREATE POLICY feedbacks_select ON feedbacks
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "feedbacks_insert" ON feedbacks;
CREATE POLICY feedbacks_insert ON feedbacks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "feedbacks_update" ON feedbacks;
CREATE POLICY feedbacks_update ON feedbacks
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "feedbacks_delete" ON feedbacks;
CREATE POLICY feedbacks_delete ON feedbacks
  FOR DELETE USING (auth.uid() = user_id);
