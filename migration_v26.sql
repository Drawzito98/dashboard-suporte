-- Migration v26: Colunas TMA e TMR na tabela registros
-- Execute no Supabase SQL Editor: https://supabase.com/dashboard/project/agvkmfusyetkicmuvumz/sql
--
-- TMA (Tempo Médio de Atendimento) e TMR (Tempo Médio de Resposta)
-- são armazenados como texto livre, ex: "1d 2h 18m 20s".

ALTER TABLE registros ADD COLUMN IF NOT EXISTS "TMA" TEXT;
ALTER TABLE registros ADD COLUMN IF NOT EXISTS "TMR" TEXT;
