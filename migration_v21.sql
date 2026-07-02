-- migration_v21.sql — Adiciona coluna imagem em avaliacao_atendimentos

ALTER TABLE avaliacao_atendimentos ADD COLUMN IF NOT EXISTS imagem TEXT DEFAULT '';
