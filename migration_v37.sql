-- Reações privadas nas mensagens do chat.
CREATE TABLE IF NOT EXISTS chat_reacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversa_id UUID NOT NULL REFERENCES chat_conversas(id) ON DELETE CASCADE,
  mensagem_id UUID NOT NULL REFERENCES chat_mensagens(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL CHECK (emoji IN ('👍', '❤️', '😂', '😮', '😢', '🙏')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (mensagem_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS idx_chat_reacoes_conversa ON chat_reacoes(conversa_id, mensagem_id);
ALTER TABLE chat_reacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS chat_reacoes_select ON chat_reacoes;
CREATE POLICY chat_reacoes_select ON chat_reacoes FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM chat_conversas c WHERE c.id = conversa_id AND (c.admin_id = auth.uid() OR c.colaborador_id = auth.uid()))
  AND EXISTS (SELECT 1 FROM chat_mensagens m WHERE m.id = mensagem_id AND m.conversa_id = conversa_id)
);
DROP POLICY IF EXISTS chat_reacoes_insert ON chat_reacoes;
CREATE POLICY chat_reacoes_insert ON chat_reacoes FOR INSERT TO authenticated WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (SELECT 1 FROM chat_conversas c WHERE c.id = conversa_id AND (c.admin_id = auth.uid() OR c.colaborador_id = auth.uid()))
  AND EXISTS (SELECT 1 FROM chat_mensagens m WHERE m.id = mensagem_id AND m.conversa_id = conversa_id)
);
DROP POLICY IF EXISTS chat_reacoes_delete ON chat_reacoes;
CREATE POLICY chat_reacoes_delete ON chat_reacoes FOR DELETE TO authenticated USING (user_id = auth.uid());

ALTER TABLE chat_reacoes REPLICA IDENTITY FULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'chat_reacoes') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE chat_reacoes;
  END IF;
END $$;
