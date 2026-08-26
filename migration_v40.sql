-- Uma reação por usuário em cada mensagem; trocar substitui a anterior.
DELETE FROM chat_reacoes antiga
USING chat_reacoes recente
WHERE antiga.mensagem_id = recente.mensagem_id
  AND antiga.user_id = recente.user_id
  AND (antiga.created_at < recente.created_at OR (antiga.created_at = recente.created_at AND antiga.id::text < recente.id::text));

ALTER TABLE chat_reacoes DROP CONSTRAINT IF EXISTS chat_reacoes_mensagem_id_user_id_emoji_key;
ALTER TABLE chat_reacoes DROP CONSTRAINT IF EXISTS chat_reacoes_mensagem_id_user_id_key;
ALTER TABLE chat_reacoes ADD CONSTRAINT chat_reacoes_mensagem_id_user_id_key UNIQUE (mensagem_id, user_id);
