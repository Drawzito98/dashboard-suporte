-- Notificações de novas mensagens do chat.
CREATE TABLE IF NOT EXISTS chat_notificacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversa_id UUID NOT NULL REFERENCES chat_conversas(id) ON DELETE CASCADE,
  mensagem_id UUID NOT NULL REFERENCES chat_mensagens(id) ON DELETE CASCADE,
  lida BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (mensagem_id, recipient_id)
);
ALTER TABLE chat_notificacoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS chat_notif_select ON chat_notificacoes;
CREATE POLICY chat_notif_select ON chat_notificacoes FOR SELECT TO authenticated USING (recipient_id = auth.uid());
DROP POLICY IF EXISTS chat_notif_insert ON chat_notificacoes;
CREATE POLICY chat_notif_insert ON chat_notificacoes FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM chat_conversas c WHERE c.id = conversa_id AND (c.admin_id = auth.uid() OR c.colaborador_id = auth.uid())));
DROP POLICY IF EXISTS chat_notif_update ON chat_notificacoes;
CREATE POLICY chat_notif_update ON chat_notificacoes FOR UPDATE TO authenticated USING (recipient_id = auth.uid()) WITH CHECK (recipient_id = auth.uid());
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'chat_notificacoes') THEN ALTER PUBLICATION supabase_realtime ADD TABLE chat_notificacoes; END IF; END $$;
