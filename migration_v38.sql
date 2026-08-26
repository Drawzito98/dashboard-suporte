-- Amplia as opções permitidas de reação no chat.
ALTER TABLE chat_reacoes DROP CONSTRAINT IF EXISTS chat_reacoes_emoji_check;
ALTER TABLE chat_reacoes ADD CONSTRAINT chat_reacoes_emoji_check
  CHECK (emoji IN ('👍', '❤️', '😂', '😮', '😢', '🙏', '🤤', '🔥', '🎉', '👏', '🤔', '👀', '💯', '🚀'));
