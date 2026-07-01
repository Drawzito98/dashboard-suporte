-- Migration v17: Adiciona categoria e prioridade aos reportes
ALTER TABLE reportes ADD COLUMN IF NOT EXISTS categoria TEXT DEFAULT '';
ALTER TABLE reportes ADD COLUMN IF NOT EXISTS prioridade TEXT DEFAULT 'media';
