-- Migration v43: quadro compartilhado de regras
CREATE TABLE IF NOT EXISTS regras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  descricao TEXT DEFAULT '',
  categoria TEXT DEFAULT 'Geral',
  status TEXT NOT NULL DEFAULT 'vigente' CHECK (status IN ('vigente', 'revisao', 'arquivada')),
  posicao BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL
);
ALTER TABLE regras ENABLE ROW LEVEL SECURITY;
CREATE POLICY regras_select ON regras FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY regras_insert ON regras FOR INSERT WITH CHECK (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin');
CREATE POLICY regras_update ON regras FOR UPDATE USING (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin') WITH CHECK (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin');
CREATE POLICY regras_delete ON regras FOR DELETE USING (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin');
CREATE INDEX IF NOT EXISTS idx_regras_status_posicao ON regras(status, posicao);
