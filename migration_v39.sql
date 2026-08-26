-- Chat completo: anexos privados, respostas, leitura e integridade de mensagens.
ALTER TABLE chat_mensagens ADD COLUMN IF NOT EXISTS reply_to_id UUID REFERENCES chat_mensagens(id) ON DELETE SET NULL;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('chat-imagens', 'chat-imagens', false, 2097152, ARRAY['image/jpeg','image/png','image/webp','image/gif'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 2097152,
  allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp','image/gif'];

DROP POLICY IF EXISTS chat_imagens_select ON storage.objects;
CREATE POLICY chat_imagens_select ON storage.objects FOR SELECT TO authenticated USING (
  bucket_id = 'chat-imagens' AND EXISTS (
    SELECT 1 FROM chat_conversas c
    WHERE c.id::text = (storage.foldername(name))[1]
      AND (c.admin_id = auth.uid() OR c.colaborador_id = auth.uid())
  )
);
DROP POLICY IF EXISTS chat_imagens_insert ON storage.objects;
CREATE POLICY chat_imagens_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (
  bucket_id = 'chat-imagens'
  AND (storage.foldername(name))[2] = auth.uid()::text
  AND EXISTS (
    SELECT 1 FROM chat_conversas c
    WHERE c.id::text = (storage.foldername(name))[1]
      AND (c.admin_id = auth.uid() OR c.colaborador_id = auth.uid())
  )
);
DROP POLICY IF EXISTS chat_imagens_delete ON storage.objects;
CREATE POLICY chat_imagens_delete ON storage.objects FOR DELETE TO authenticated USING (
  bucket_id = 'chat-imagens' AND (storage.foldername(name))[2] = auth.uid()::text
);

CREATE OR REPLACE FUNCTION public.proteger_chat_mensagem()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE conversa chat_conversas%ROWTYPE;
BEGIN
  IF auth.role() = 'service_role' THEN RETURN NEW; END IF;
  SELECT * INTO conversa FROM chat_conversas WHERE id = OLD.conversa_id;
  IF OLD.id IS DISTINCT FROM NEW.id OR OLD.conversa_id IS DISTINCT FROM NEW.conversa_id
     OR OLD.sender_id IS DISTINCT FROM NEW.sender_id OR OLD.mensagem IS DISTINCT FROM NEW.mensagem
     OR OLD.imagem_url IS DISTINCT FROM NEW.imagem_url OR OLD.reply_to_id IS DISTINCT FROM NEW.reply_to_id
     OR OLD.created_at IS DISTINCT FROM NEW.created_at THEN
    RAISE EXCEPTION 'O conteúdo de uma mensagem enviada é imutável';
  END IF;
  IF auth.uid() = conversa.admin_id AND OLD.apagada_para_colaborador IS DISTINCT FROM NEW.apagada_para_colaborador THEN
    RAISE EXCEPTION 'Sem permissão para alterar a visualização do colaborador';
  END IF;
  IF auth.uid() = conversa.colaborador_id AND OLD.apagada_para_admin IS DISTINCT FROM NEW.apagada_para_admin THEN
    RAISE EXCEPTION 'Sem permissão para alterar a visualização do administrador';
  END IF;
  IF OLD.lida_em IS DISTINCT FROM NEW.lida_em AND OLD.sender_id = auth.uid() THEN
    RAISE EXCEPTION 'O remetente não pode confirmar a própria leitura';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS proteger_chat_mensagem_trigger ON chat_mensagens;
CREATE TRIGGER proteger_chat_mensagem_trigger BEFORE UPDATE ON chat_mensagens
FOR EACH ROW EXECUTE FUNCTION public.proteger_chat_mensagem();

DROP POLICY IF EXISTS chat_mensagens_delete ON chat_mensagens;
CREATE POLICY chat_mensagens_delete ON chat_mensagens FOR DELETE TO authenticated USING (sender_id = auth.uid());

DROP POLICY IF EXISTS chat_notif_insert ON chat_notificacoes;
CREATE POLICY chat_notif_insert ON chat_notificacoes FOR INSERT TO authenticated WITH CHECK (
  EXISTS (
    SELECT 1 FROM chat_conversas c JOIN chat_mensagens m ON m.conversa_id = c.id
    WHERE c.id = conversa_id AND m.id = mensagem_id AND m.sender_id = auth.uid()
      AND ((c.admin_id = auth.uid() AND recipient_id = c.colaborador_id)
        OR (c.colaborador_id = auth.uid() AND recipient_id = c.admin_id))
  )
);

CREATE INDEX IF NOT EXISTS idx_chat_mensagens_reply ON chat_mensagens(reply_to_id);

CREATE OR REPLACE FUNCTION public.validar_resposta_chat()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.reply_to_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM chat_mensagens original
    WHERE original.id = NEW.reply_to_id AND original.conversa_id = NEW.conversa_id
  ) THEN
    RAISE EXCEPTION 'A mensagem respondida não pertence a esta conversa';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS validar_resposta_chat_trigger ON chat_mensagens;
CREATE TRIGGER validar_resposta_chat_trigger BEFORE INSERT OR UPDATE OF reply_to_id, conversa_id ON chat_mensagens
FOR EACH ROW EXECUTE FUNCTION public.validar_resposta_chat();
