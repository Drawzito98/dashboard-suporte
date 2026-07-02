-- migration_v24.sql — Adiciona coluna nivel em colaboradores_info

ALTER TABLE colaboradores_info ADD COLUMN IF NOT EXISTS nivel TEXT DEFAULT '';
