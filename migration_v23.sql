-- migration_v23.sql — Tabela acompanhamento_diario + RLS

CREATE TABLE IF NOT EXISTS acompanhamento_diario (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  colaborador TEXT NOT NULL,
  data DATE NOT NULL,
  setor TEXT NOT NULL DEFAULT '',
  assumidos INTEGER NOT NULL DEFAULT 0,
  transferidos INTEGER NOT NULL DEFAULT 0,
  finalizados INTEGER NOT NULL DEFAULT 0,
  nota NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE acompanhamento_diario ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem ver seus próprios registros"
  ON acompanhamento_diario FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem inserir seus próprios registros"
  ON acompanhamento_diario FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar seus próprios registros"
  ON acompanhamento_diario FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem excluir seus próprios registros"
  ON acompanhamento_diario FOR DELETE
  USING (auth.uid() = user_id);
