-- Migration v27: Campos extras em avaliacao_atendimentos
-- Execute no Supabase SQL Editor: https://supabase.com/dashboard/project/agvkmfusyetkicmuvumz/sql
--
-- data_atendimento  → data em que o atendimento ocorreu (TEXT "YYYY-MM-DD")
-- teve_nota         → se o cliente avaliou (ou não) o atendimento
-- nota              → passa a ser a nota do cliente (1-5), nullable quando não avaliado
-- orientacao        → orientação dada ao atendente referente ao caso

ALTER TABLE avaliacao_atendimentos ADD COLUMN IF NOT EXISTS data_atendimento TEXT DEFAULT '';
ALTER TABLE avaliacao_atendimentos ADD COLUMN IF NOT EXISTS teve_nota BOOLEAN DEFAULT false;
ALTER TABLE avaliacao_atendimentos ADD COLUMN IF NOT EXISTS orientacao TEXT DEFAULT '';
ALTER TABLE avaliacao_atendimentos ALTER COLUMN nota DROP NOT NULL;
