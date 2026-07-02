-- migration_v22.sql — Tabela ferias + RLS

CREATE TABLE IF NOT EXISTS ferias (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  colaborador TEXT NOT NULL,
  data_inicio DATE NOT NULL,
  data_fim DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE ferias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem ver suas próprias ferias"
  ON ferias FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem inserir suas próprias ferias"
  ON ferias FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar suas próprias ferias"
  ON ferias FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem excluir suas próprias ferias"
  ON ferias FOR DELETE
  USING (auth.uid() = user_id);
