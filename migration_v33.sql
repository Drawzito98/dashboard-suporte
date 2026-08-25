-- Rotinas recorrentes e chat privado entre administração e colaboradores.
-- Executar no SQL Editor do Supabase antes de usar estas funções.

ALTER TABLE tarefas ADD COLUMN IF NOT EXISTS rotina_ativa BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE tarefas ADD COLUMN IF NOT EXISTS rotina_unidade TEXT NOT NULL DEFAULT 'dias';
ALTER TABLE tarefas ADD COLUMN IF NOT EXISTS rotina_intervalo INTEGER NOT NULL DEFAULT 1;
ALTER TABLE tarefas ADD COLUMN IF NOT EXISTS rotina_lembrete_dias INTEGER NOT NULL DEFAULT 0;
ALTER TABLE tarefas ADD COLUMN IF NOT EXISTS rotina_ultima_conclusao DATE;
ALTER TABLE tarefas ADD COLUMN IF NOT EXISTS rotina_proxima_data DATE;

CREATE TABLE IF NOT EXISTS chat_perfis (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  apelido TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chat_conversas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  colaborador_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (admin_id, colaborador_id),
  CHECK (admin_id <> colaborador_id)
);

CREATE TABLE IF NOT EXISTS chat_mensagens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversa_id UUID NOT NULL REFERENCES chat_conversas(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mensagem TEXT NOT NULL CHECK (char_length(trim(mensagem)) BETWEEN 1 AND 4000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  lida_em TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_chat_conversas_participantes ON chat_conversas(admin_id, colaborador_id);
CREATE INDEX IF NOT EXISTS idx_chat_mensagens_conversa ON chat_mensagens(conversa_id, created_at);

ALTER TABLE chat_perfis ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_conversas ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_mensagens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS chat_perfis_select ON chat_perfis;
CREATE POLICY chat_perfis_select ON chat_perfis FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS chat_perfis_insert ON chat_perfis;
CREATE POLICY chat_perfis_insert ON chat_perfis FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS chat_perfis_update ON chat_perfis;
CREATE POLICY chat_perfis_update ON chat_perfis FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS chat_conversas_select ON chat_conversas;
CREATE POLICY chat_conversas_select ON chat_conversas FOR SELECT TO authenticated
  USING (auth.uid() = admin_id OR auth.uid() = colaborador_id);
DROP POLICY IF EXISTS chat_conversas_insert ON chat_conversas;
CREATE POLICY chat_conversas_insert ON chat_conversas FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = admin_id AND auth.jwt() -> 'app_metadata' ->> 'role' = 'admin');

DROP POLICY IF EXISTS chat_mensagens_select ON chat_mensagens;
CREATE POLICY chat_mensagens_select ON chat_mensagens FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM chat_conversas c WHERE c.id = conversa_id AND (c.admin_id = auth.uid() OR c.colaborador_id = auth.uid())));
DROP POLICY IF EXISTS chat_mensagens_insert ON chat_mensagens;
CREATE POLICY chat_mensagens_insert ON chat_mensagens FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND EXISTS (SELECT 1 FROM chat_conversas c WHERE c.id = conversa_id AND (c.admin_id = auth.uid() OR c.colaborador_id = auth.uid())));
DROP POLICY IF EXISTS chat_mensagens_update ON chat_mensagens;
CREATE POLICY chat_mensagens_update ON chat_mensagens FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM chat_conversas c WHERE c.id = conversa_id AND (c.admin_id = auth.uid() OR c.colaborador_id = auth.uid())));

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'chat_mensagens') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE chat_mensagens;
  END IF;
END $$;
