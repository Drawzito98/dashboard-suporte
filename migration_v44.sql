-- Migration v44: etiquetas e favoritos nas anotações
ALTER TABLE anotacoes_diarias ADD COLUMN IF NOT EXISTS etiquetas TEXT DEFAULT '';
ALTER TABLE anotacoes_diarias ADD COLUMN IF NOT EXISTS favorito BOOLEAN DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_anotacoes_user_favorito ON anotacoes_diarias(user_id, favorito, data DESC);
