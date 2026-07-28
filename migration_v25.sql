-- Migration v25: Índices para performance + limpeza de dados duplicados
-- Execute no Supabase SQL Editor: https://supabase.com/dashboard/project/agvkmfusyetkicmuvumz/sql

-- ============================================================
-- 1. Índices na tabela registros (a mais consultada do app)
-- ============================================================

-- Índice composto para filtros comuns (Setor + Mês)
CREATE INDEX IF NOT EXISTS idx_registros_setor_mes
  ON registros (Setor, "Mês");

-- Índice para filtro por Atendente
CREATE INDEX IF NOT EXISTS idx_registros_atendente
  ON registros ("Atendente");

-- Índice para ordenação por mês
CREATE INDEX IF NOT EXISTS idx_registros_mes
  ON registros ("Mês" DESC);

-- Índice para RLS (user_id)
CREATE INDEX IF NOT EXISTS idx_registros_user_id
  ON registros (user_id);

-- ============================================================
-- 2. Índices em outras tabelas que precisam
-- ============================================================

-- metas: consultada por user_id
CREATE INDEX IF NOT EXISTS idx_metas_user_id
  ON metas (user_id);

-- comentarios: ordenada por created_at
CREATE INDEX IF NOT EXISTS idx_comentarios_created_at
  ON comentarios (created_at ASC);

-- historico: ordenada por created_at
CREATE INDEX IF NOT EXISTS idx_historico_created_at
  ON historico (created_at DESC);

-- scoring_config: consultada por user_id
CREATE INDEX IF NOT EXISTS idx_scoring_config_user_id
  ON scoring_config (user_id);

-- alertas_config: consultada por user_id
CREATE INDEX IF NOT EXISTS idx_alertas_config_user_id
  ON alertas_config (user_id);

-- colaborador_fotos: consultada por nome
CREATE INDEX IF NOT EXISTS idx_colab_fotos_nome
  ON colaborador_fotos (nome);

-- colab_inativos: consultada por user_id
CREATE INDEX IF NOT EXISTS idx_colab_inativos_user_id
  ON colab_inativos (user_id);

-- feedbacks: consultada por user_id + created_at
CREATE INDEX IF NOT EXISTS idx_feedbacks_user_id
  ON feedbacks (user_id, created_at DESC);

-- ============================================================
-- 3. Limpeza de registros duplicados na tabela registros
-- ============================================================

-- Remove registros duplicados (mantém o mais recente por combo Setor+Mês+Atendente)
WITH dedup AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY "Setor", "Mês", "Atendente"
      ORDER BY id DESC
    ) AS rn
  FROM registros
)
DELETE FROM registros
WHERE id IN (
  SELECT id FROM dedup WHERE rn > 1
);
