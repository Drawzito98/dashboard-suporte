-- migration_v8.sql — Adiciona colunas de conduta negativa
ALTER TABLE colaboradores_info
  ADD COLUMN IF NOT EXISTS conduta_negativa TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS conduta_motivo TEXT DEFAULT '';
