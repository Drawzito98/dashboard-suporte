-- Migration v12: Notificações + feedbacks/avaliações acessíveis por admin

-- 1. Atualizar RLS de feedbacks para permitir leitura por admin
DROP POLICY IF EXISTS feedbacks_select ON feedbacks;
DROP POLICY IF EXISTS feedbacks_insert ON feedbacks;
DROP POLICY IF EXISTS feedbacks_update ON feedbacks;
DROP POLICY IF EXISTS feedbacks_delete ON feedbacks;

CREATE POLICY feedbacks_select ON feedbacks
  FOR SELECT USING (
    auth.uid() = user_id
    OR auth.jwt() -> 'user_metadata' ->> 'role' = 'admin'
  );
CREATE POLICY feedbacks_insert ON feedbacks
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY feedbacks_update ON feedbacks
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY feedbacks_delete ON feedbacks
  FOR DELETE USING (auth.uid() = user_id);

-- 2. Atualizar RLS de avaliações para permitir leitura por admin
DROP POLICY IF EXISTS avaliacoes_select ON avaliacoes;
DROP POLICY IF EXISTS avaliacoes_insert ON avaliacoes;
DROP POLICY IF EXISTS avaliacoes_update ON avaliacoes;
DROP POLICY IF EXISTS avaliacoes_delete ON avaliacoes;

CREATE POLICY avaliacoes_select ON avaliacoes
  FOR SELECT USING (
    auth.uid() = user_id
    OR auth.jwt() -> 'user_metadata' ->> 'role' = 'admin'
  );
CREATE POLICY avaliacoes_insert ON avaliacoes
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY avaliacoes_update ON avaliacoes
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY avaliacoes_delete ON avaliacoes
  FOR DELETE USING (auth.uid() = user_id);

-- 3. Tabela de notificações
CREATE TABLE IF NOT EXISTS notificacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  tipo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  link TEXT DEFAULT '',
  lida BOOLEAN DEFAULT false,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email TEXT DEFAULT ''
);

ALTER TABLE notificacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY notificacoes_insert ON notificacoes
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY notificacoes_select ON notificacoes
  FOR SELECT USING (auth.jwt() -> 'user_metadata' ->> 'role' = 'admin');

CREATE POLICY notificacoes_update ON notificacoes
  FOR UPDATE USING (auth.jwt() -> 'user_metadata' ->> 'role' = 'admin');

CREATE INDEX IF NOT EXISTS idx_notificacoes_lida ON notificacoes(lida);
CREATE INDEX IF NOT EXISTS idx_notificacoes_created_at ON notificacoes(created_at DESC);

