-- Migration v9: month reference for bonus/penalties
ALTER TABLE pontos_extras ADD COLUMN IF NOT EXISTS mes TEXT DEFAULT '';
