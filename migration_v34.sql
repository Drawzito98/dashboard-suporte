-- Imagens e limpeza de mensagens do chat privado.
ALTER TABLE chat_mensagens ADD COLUMN IF NOT EXISTS imagem_url TEXT;
ALTER TABLE chat_mensagens DROP CONSTRAINT IF EXISTS chat_mensagens_mensagem_check;
ALTER TABLE chat_mensagens ADD CONSTRAINT chat_mensagens_conteudo_check CHECK (char_length(trim(mensagem)) BETWEEN 0 AND 4000 AND (char_length(trim(mensagem)) > 0 OR imagem_url IS NOT NULL));
DROP POLICY IF EXISTS chat_mensagens_delete ON chat_mensagens;
CREATE POLICY chat_mensagens_delete ON chat_mensagens FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM chat_conversas c WHERE c.id = conversa_id AND (c.admin_id = auth.uid() OR c.colaborador_id = auth.uid())));
