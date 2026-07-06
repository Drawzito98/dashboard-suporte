-- Migration v11: ensure observacoes_competencias and add avaliacao_qualitativa column
ALTER TABLE avaliacoes ADD COLUMN IF NOT EXISTS observacoes_competencias JSONB DEFAULT '{}';
ALTER TABLE avaliacoes ADD COLUMN IF NOT EXISTS avaliacao_qualitativa TEXT DEFAULT '';
