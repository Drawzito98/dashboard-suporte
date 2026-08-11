-- =====================================================================
-- VERIFICAR INTEGRIDADE DO BANCO (100% LEITURA — não altera nada)
-- =====================================================================
-- O objetivo é confirmar que:
--   1) Todas as tabelas esperadas (das migrations) existem no banco
--   2) Nenhum dado foi perdido (contagem de linhas por tabela)
--   3) Existem tabelas que o repositório não conhece (sobra)
--
-- Execute no SQL Editor do Supabase. Tudo aqui é SELECT (leitura).

-- ── 1. Todas as tabelas do schema public com contagem de linhas ──────────
SELECT
  t.table_name,
  (SELECT reltuples::bigint FROM pg_class WHERE relname = t.table_name) AS rows_estimadas,
  (SELECT count(*) FROM information_schema.columns c
    WHERE c.table_schema = t.table_schema AND c.table_name = t.table_name) AS colunas
FROM information_schema.tables t
WHERE t.table_schema = 'public'
  AND t.table_type = 'BASE TABLE'
ORDER BY t.table_name;

-- ── 2. Quais tabelas ESPERADAS (do repo) estão FALTANDO no banco? ────────
WITH esperadas(nome) AS (
  SELECT * FROM (VALUES
    ('acompanhamento_diario'),
    ('alertas_config'),
    ('anotacoes_diarias'),
    ('ausencias'),
    ('avaliacao_atendimentos'),
    ('avaliacoes'),
    ('colab_inativos'),
    ('colaborador_fotos'),
    ('colaboradores_info'),
    ('comentarios'),
    ('feedbacks'),
    ('ferias'),
    ('historico'),
    ('links_importantes'),
    ('metas'),
    ('notificacoes'),
    ('pontos_extras'),
    ('registros'),
    ('reportes'),
    ('scoring_config'),
    ('setor_inativos'),
    ('tarefas')
  ) AS v(nome)
)
SELECT e.nome AS tabela_faltando
FROM esperadas e
LEFT JOIN information_schema.tables t
  ON t.table_schema = 'public' AND t.table_name = e.nome
WHERE t.table_name IS NULL;

-- ── 3. Tabelas EXISTENTES que o repo não conhece (sobras) ────────────────
WITH esperadas(nome) AS (
  SELECT * FROM (VALUES
    ('acompanhamento_diario'),
    ('alertas_config'),
    ('anotacoes_diarias'),
    ('ausencias'),
    ('avaliacao_atendimentos'),
    ('avaliacoes'),
    ('colab_inativos'),
    ('colaborador_fotos'),
    ('colaboradores_info'),
    ('comentarios'),
    ('feedbacks'),
    ('ferias'),
    ('historico'),
    ('links_importantes'),
    ('metas'),
    ('notificacoes'),
    ('pontos_extras'),
    ('registros'),
    ('reportes'),
    ('scoring_config'),
    ('setor_inativos'),
    ('tarefas')
  ) AS v(nome)
)
SELECT t.table_name AS tabela_nao_esperada
FROM information_schema.tables t
LEFT JOIN esperadas e ON e.nome = t.table_name
WHERE t.table_schema = 'public'
  AND t.table_type = 'BASE TABLE'
  AND e.nome IS NULL
ORDER BY t.table_name;

-- ── 4. Contagem REAL de linhas das tabelas mais importantes ──────────────
-- (dá uma fotografia do volume de dados atual)
SELECT 'acompanhamento_diario' AS tabela, count(*) AS total FROM public.acompanhamento_diario;
SELECT 'alertas_config' AS tabela, count(*) AS total FROM public.alertas_config;
SELECT 'anotacoes_diarias' AS tabela, count(*) AS total FROM public.anotacoes_diarias;
SELECT 'ausencias' AS tabela, count(*) AS total FROM public.ausencias;
SELECT 'avaliacao_atendimentos' AS tabela, count(*) AS total FROM public.avaliacao_atendimentos;
SELECT 'avaliacoes' AS tabela, count(*) AS total FROM public.avaliacoes;
SELECT 'colab_inativos' AS tabela, count(*) AS total FROM public.colab_inativos;
SELECT 'colaborador_fotos' AS tabela, count(*) AS total FROM public.colaborador_fotos;
SELECT 'colaboradores_info' AS tabela, count(*) AS total FROM public.colaboradores_info;
SELECT 'comentarios' AS tabela, count(*) AS total FROM public.comentarios;
SELECT 'feedbacks' AS tabela, count(*) AS total FROM public.feedbacks;
SELECT 'ferias' AS tabela, count(*) AS total FROM public.ferias;
SELECT 'historico' AS tabela, count(*) AS total FROM public.historico;
SELECT 'links_importantes' AS tabela, count(*) AS total FROM public.links_importantes;
SELECT 'metas' AS tabela, count(*) AS total FROM public.metas;
SELECT 'notificacoes' AS tabela, count(*) AS total FROM public.notificacoes;
SELECT 'pontos_extras' AS tabela, count(*) AS total FROM public.pontos_extras;
SELECT 'registros' AS tabela, count(*) AS total FROM public.registros;
SELECT 'reportes' AS tabela, count(*) AS total FROM public.reportes;
SELECT 'scoring_config' AS tabela, count(*) AS total FROM public.scoring_config;
SELECT 'setor_inativos' AS tabela, count(*) AS total FROM public.setor_inativos;
SELECT 'tarefas' AS tabela, count(*) AS total FROM public.tarefas;
