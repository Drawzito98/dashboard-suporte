-- =====================================================================
-- ORGANIZAR ABAS DO SQL EDITOR DO SUPABASE (não apaga NENHUM dado)
-- =====================================================================
-- O que isso faz:
--   1) Lista todas as abas salvas no SQL Editor (tabela supabase.snippets)
--   2) Renomeia automaticamente as abas que contêm migrations do repositório
--   3) Mostra o que sobrou sem nome para você renomear manualmente
--
-- SEGURANÇA: isso altera SOMENTE a tabela supabase.snippets (as abas salvas).
-- Seus dados de negócio (registros, metas, avaliações, etc.) NÃO são tocados.

-- ── Passo 0 (opcional): veja quantas abas existem ─────────────────────────
SELECT count(*) AS total_abas FROM supabase.snippets;

-- ── Passo 1: liste todas as abas com o início do SQL de cada uma ─────────
SELECT id, name, created_at, left(content->>'sql', 100) AS inicio
FROM supabase.snippets
ORDER BY created_at;

-- ── Passo 2: renomeie automaticamente as que contêm migrations ───────────
UPDATE supabase.snippets
SET name = CASE
      WHEN content->>'sql' LIKE '%-- Migration v2: Persistência de configurações, comentários,%' THEN 'migration_v2.sql'
      WHEN content->>'sql' LIKE '%-- Migration v3: Tabela de feedbacks%' THEN 'migration_v3.sql'
      WHEN content->>'sql' LIKE '%-- migration_v4.sql — Anotações Diárias%' THEN 'migration_v4.sql'
      WHEN content->>'sql' LIKE '%-- migration_v5.sql — Tarefas / Agenda%' THEN 'migration_v5.sql'
      WHEN content->>'sql' LIKE '%-- migration_v6.sql — Tabela pontos_extras (bônus manuais)%' THEN 'migration_v6.sql'
      WHEN content->>'sql' LIKE '%-- migration_v7.sql — Tabela colaboradores_info (dados cadas%' THEN 'migration_v7.sql'
      WHEN content->>'sql' LIKE '%-- migration_v8.sql — Adiciona colunas de conduta negativa%' THEN 'migration_v8.sql'
      WHEN content->>'sql' LIKE '%-- Migration v9: month reference for bonus/penalties%' THEN 'migration_v9.sql'
      WHEN content->>'sql' LIKE '%-- Migration v10: add IA suggestions and final comments colu%' THEN 'migration_v10.sql'
      WHEN content->>'sql' LIKE '%-- Migration v11: ensure observacoes_competencias and add av%' THEN 'migration_v11.sql'
      WHEN content->>'sql' LIKE '%-- Migration v12: Notificações + feedbacks/avaliações acessí%' THEN 'migration_v12.sql'
      WHEN content->>'sql' LIKE '%-- Migration v13: Tabela reportes (canal de comunicação exte%' THEN 'migration_v13.sql'
      WHEN content->>'sql' LIKE '%-- Migration v14: Adiciona campos data e imagem nos reportes%' THEN 'migration_v14.sql'
      WHEN content->>'sql' LIKE '%-- Migration v15: Simplifica RLS dos reportes%' THEN 'migration_v15.sql'
      WHEN content->>'sql' LIKE '%-- Migration v16: DELETE RLS para reportes%' THEN 'migration_v16.sql'
      WHEN content->>'sql' LIKE '%-- Migration v17: Adiciona categoria e prioridade aos report%' THEN 'migration_v17.sql'
      WHEN content->>'sql' LIKE '%-- Migration v18: Tabela links_importantes (links salvos pel%' THEN 'migration_v18.sql'
      WHEN content->>'sql' LIKE '%-- migration_v19.sql — Tabela ausencias (registro de faltas/%' THEN 'migration_v19.sql'
      WHEN content->>'sql' LIKE '%-- migration_v20.sql — Tabela avaliacao_atendimentos + RLS%' THEN 'migration_v20.sql'
      WHEN content->>'sql' LIKE '%-- migration_v21.sql — Adiciona coluna imagem em avaliacao_a%' THEN 'migration_v21.sql'
      WHEN content->>'sql' LIKE '%-- migration_v22.sql — Tabela ferias + RLS%' THEN 'migration_v22.sql'
      WHEN content->>'sql' LIKE '%-- migration_v23.sql — Tabela acompanhamento_diario + RLS%' THEN 'migration_v23.sql'
      WHEN content->>'sql' LIKE '%-- migration_v24.sql — Adiciona coluna nivel em colaboradore%' THEN 'migration_v24.sql'
      WHEN content->>'sql' LIKE '%-- Migration v25: Índices para performance + limpeza de dado%' THEN 'migration_v25.sql'
      WHEN content->>'sql' LIKE '%-- Migration v26: Colunas TMA e TMR na tabela registros%' THEN 'migration_v26.sql'
      WHEN content->>'sql' LIKE '%-- Migration v27: Campos extras em avaliacao_atendimentos%' THEN 'migration_v27.sql'
      WHEN content->>'sql' LIKE '%-- Migration: Adicionar suporte a múltiplos usuários%' THEN 'migration.sql'
    ELSE name
  END
WHERE content->>'sql' LIKE '%-- Migration%'
   OR content->>'sql' LIKE '%-- migration_v%'
   OR content->>'sql' LIKE '%-- migration.sql%';

-- ── Passo 3: liste o que sobrou (abas que não eram migrations) ───────────
SELECT id, name, created_at, left(content->>'sql', 100) AS inicio
FROM supabase.snippets
ORDER BY name IS NOT NULL, created_at;
