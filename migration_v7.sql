-- migration_v7.sql — Tabela colaboradores_info (dados cadastrais)
-- Armazena aniversário, admissão, email, tarefas desempenhadas, objetivos e observações

CREATE TABLE IF NOT EXISTS colaboradores_info (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  nome TEXT NOT NULL,
  data_aniversario DATE,
  data_admissao DATE,
  email TEXT DEFAULT '',
  tarefas_desempenhadas TEXT DEFAULT '',
  objetivos_futuros TEXT DEFAULT '',
  observacoes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, nome)
);

ALTER TABLE colaboradores_info ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem ver seus próprios registros"
  ON colaboradores_info FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem inserir seus próprios registros"
  ON colaboradores_info FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar seus próprios registros"
  ON colaboradores_info FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem excluir seus próprios registros"
  ON colaboradores_info FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_colab_info_user_id ON colaboradores_info(user_id);
