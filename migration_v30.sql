-- Migration v30: adiciona o registro positivo de feitos relevantes ao perfil

ALTER TABLE colaboradores_info
  ADD COLUMN IF NOT EXISTS feito_relevante TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS feito_descricao TEXT DEFAULT '';
