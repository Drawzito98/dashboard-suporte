-- Migration v9: month reference for bonus/penalties + conduta bonus link

ALTER TABLE pontos_extras ADD COLUMN IF NOT EXISTS mes TEXT DEFAULT '';

ALTER TABLE colaboradores_info
  ADD COLUMN IF NOT EXISTS conduta_mes TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS conduta_pontos NUMERIC(6,1) DEFAULT 15,
  ADD COLUMN IF NOT EXISTS conduta_bonus_id TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS conduta_bonus_createdAt TEXT DEFAULT '';
