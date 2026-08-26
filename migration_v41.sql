-- Permite ao remetente editar apenas o texto da própria mensagem.
ALTER TABLE chat_mensagens ADD COLUMN IF NOT EXISTS editada_em TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.proteger_chat_mensagem()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE conversa chat_conversas%ROWTYPE;
BEGIN
  IF auth.role() = 'service_role' THEN RETURN NEW; END IF;
  SELECT * INTO conversa FROM chat_conversas WHERE id = OLD.conversa_id;
  IF OLD.id IS DISTINCT FROM NEW.id OR OLD.conversa_id IS DISTINCT FROM NEW.conversa_id
     OR OLD.sender_id IS DISTINCT FROM NEW.sender_id OR OLD.imagem_url IS DISTINCT FROM NEW.imagem_url
     OR OLD.reply_to_id IS DISTINCT FROM NEW.reply_to_id OR OLD.created_at IS DISTINCT FROM NEW.created_at THEN
    RAISE EXCEPTION 'Os dados estruturais de uma mensagem são imutáveis';
  END IF;
  IF OLD.mensagem IS DISTINCT FROM NEW.mensagem THEN
    IF OLD.sender_id <> auth.uid() THEN RAISE EXCEPTION 'Somente o remetente pode editar a mensagem'; END IF;
    NEW.editada_em := now();
  ELSIF OLD.editada_em IS DISTINCT FROM NEW.editada_em THEN
    RAISE EXCEPTION 'A data de edição é controlada pelo sistema';
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
