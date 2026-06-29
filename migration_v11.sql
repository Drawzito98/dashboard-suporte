-- Migration v11: Avaliações de desempenho (14 competências, 1-4, ciclos de 4 meses)
CREATE TABLE IF NOT EXISTS avaliacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  colaborador TEXT NOT NULL,
  ciclo TEXT NOT NULL,
  scores JSONB NOT NULL DEFAULT '{}',
  observacoes_gerais TEXT DEFAULT '',
  observacoes_competencias JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE avaliacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY avaliacoes_select ON avaliacoes
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY avaliacoes_insert ON avaliacoes
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY avaliacoes_update ON avaliacoes
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY avaliacoes_delete ON avaliacoes
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_avaliacoes_user_id ON avaliacoes(user_id);
CREATE INDEX IF NOT EXISTS idx_avaliacoes_colaborador ON avaliacoes(colaborador);
