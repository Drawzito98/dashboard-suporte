-- Migration v28: Coluna status em avaliacoes
-- Execute no Supabase SQL Editor: https://supabase.com/dashboard/project/agvkmfusyetkicmuvumz/sql
--
-- O código (static/avaliacao.js) grava o campo `status` ('pendente'/'revisado'),
-- mas a coluna nunca foi criada no banco. Aditivo e sem perda de dados.

ALTER TABLE avaliacoes ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pendente';
