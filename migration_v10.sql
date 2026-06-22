-- Migration v10: setores inativos por usuário
CREATE TABLE IF NOT EXISTS setor_inativos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL
);

ALTER TABLE setor_inativos ENABLE ROW LEVEL SECURITY;

CREATE POLICY setor_inativos_select ON setor_inativos
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY setor_inativos_insert ON setor_inativos
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY setor_inativos_delete ON setor_inativos
  FOR DELETE USING (auth.uid() = user_id);
