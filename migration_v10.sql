-- Migration v10: add IA suggestions and final comments columns to avaliacoes
ALTER TABLE avaliacoes ADD COLUMN IF NOT EXISTS comentarios_ia JSONB DEFAULT '[]';
ALTER TABLE avaliacoes ADD COLUMN IF NOT EXISTS comentarios_finais JSONB DEFAULT '[]';
