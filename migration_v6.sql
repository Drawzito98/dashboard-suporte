-- migration_v6.sql — Tabela pontos_extras (bônus manuais)
-- Cria a tabela e ativa RLS para isolar por user_id

CREATE TABLE IF NOT EXISTS pontos_extras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  colaborador TEXT NOT NULL,
  descricao TEXT NOT NULL DEFAULT '',
  pontos NUMERIC(6,1) NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE pontos_extras ENABLE ROW LEVEL SECURITY;

-- Política: cada usuário vê apenas seus próprios bônus
CREATE POLICY "Usuários podem ver seus próprios bônus"
  ON pontos_extras FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem inserir seus próprios bônus"
  ON pontos_extras FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar seus próprios bônus"
  ON pontos_extras FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem excluir seus próprios bônus"
  ON pontos_extras FOR DELETE
  USING (auth.uid() = user_id);

-- Índice para consultas por usuário
CREATE INDEX IF NOT EXISTS idx_pontos_extras_user_id ON pontos_extras(user_id);
CREATE INDEX IF NOT EXISTS idx_pontos_extras_colaborador ON pontos_extras(colaborador);
