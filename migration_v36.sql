-- Limpeza individual do histórico do chat.
ALTER TABLE chat_mensagens ADD COLUMN IF NOT EXISTS apagada_para_admin BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE chat_mensagens ADD COLUMN IF NOT EXISTS apagada_para_colaborador BOOLEAN NOT NULL DEFAULT false;
