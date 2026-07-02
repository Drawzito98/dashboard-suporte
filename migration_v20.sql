-- migration_v20.sql — Tabela avaliacao_atendimentos + RLS

CREATE TABLE IF NOT EXISTS avaliacao_atendimentos (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  protocolo TEXT NOT NULL,
  colaborador TEXT NOT NULL,
  nota NUMERIC NOT NULL,
  justa BOOLEAN DEFAULT true,
  resumo TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE avaliacao_atendimentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem ver suas próprias avaliações"
  ON avaliacao_atendimentos FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem inserir suas próprias avaliações"
  ON avaliacao_atendimentos FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar suas próprias avaliações"
  ON avaliacao_atendimentos FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem excluir suas próprias avaliações"
  ON avaliacao_atendimentos FOR DELETE
  USING (auth.uid() = user_id);
