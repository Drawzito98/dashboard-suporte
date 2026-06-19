-- Migration v2: Persistência de configurações, comentários, histórico e preferências
-- Execute no SQL Editor do Supabase Dashboard
-- https://supabase.com/dashboard/project/agvkmfusyetkicmuvumz

-- 1. Metas
CREATE TABLE IF NOT EXISTS metas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Meta',
  type TEXT NOT NULL DEFAULT 'monthly',
  metric TEXT NOT NULL DEFAULT 'finalizados',
  target REAL NOT NULL DEFAULT 0,
  setor TEXT DEFAULT 'all',
  collaborator TEXT DEFAULT '',
  period TEXT DEFAULT 'all',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Comentários mensais
CREATE TABLE IF NOT EXISTS comentarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mes TEXT NOT NULL,
  texto TEXT NOT NULL,
  user_email TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Histórico de alterações
CREATE TABLE IF NOT EXISTS historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT DEFAULT '',
  colaborador TEXT DEFAULT '',
  mes TEXT DEFAULT '',
  campo TEXT DEFAULT '',
  before_value TEXT DEFAULT '',
  after_value TEXT DEFAULT '',
  detalhes TEXT DEFAULT '',
  user_email TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Regras de pontuação (uma linha por usuário)
CREATE TABLE IF NOT EXISTS scoring_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  rules JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Configuração de alertas (uma linha por usuário)
CREATE TABLE IF NOT EXISTS alertas_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  config JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Fotos dos colaboradores
CREATE TABLE IF NOT EXISTS colaborador_fotos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  foto_url TEXT DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 7. Colaboradores inativos por usuário
CREATE TABLE IF NOT EXISTS colab_inativos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL
);

-- ══════════════════════════════════════════
-- RLS POLICIES
-- ══════════════════════════════════════════

-- Helper: habilitar RLS em todas as novas tabelas
ALTER TABLE metas ENABLE ROW LEVEL SECURITY;
ALTER TABLE comentarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE historico ENABLE ROW LEVEL SECURITY;
ALTER TABLE scoring_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE alertas_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE colaborador_fotos ENABLE ROW LEVEL SECURITY;
ALTER TABLE colab_inativos ENABLE ROW LEVEL SECURITY;

-- Metas: cada um vê e gerencia as suas
DROP POLICY IF EXISTS "metas_select" ON metas;
CREATE POLICY metas_select ON metas
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "metas_insert" ON metas;
CREATE POLICY metas_insert ON metas
  FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "metas_update" ON metas;
CREATE POLICY metas_update ON metas
  FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "metas_delete" ON metas;
CREATE POLICY metas_delete ON metas
  FOR DELETE USING (auth.uid() = user_id);

-- Comentários: todos os autenticados podem ver, inserir e deletar
DROP POLICY IF EXISTS "comentarios_select" ON comentarios;
CREATE POLICY comentarios_select ON comentarios
  FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "comentarios_insert" ON comentarios;
CREATE POLICY comentarios_insert ON comentarios
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "comentarios_delete" ON comentarios;
CREATE POLICY comentarios_delete ON comentarios
  FOR DELETE USING (auth.role() = 'authenticated');

-- Histórico: todos os autenticados podem ver e inserir
DROP POLICY IF EXISTS "historico_select" ON historico;
CREATE POLICY historico_select ON historico
  FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "historico_insert" ON historico;
CREATE POLICY historico_insert ON historico
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Scoring config: cada um vê e gerencia a sua
DROP POLICY IF EXISTS "scoring_select" ON scoring_config;
CREATE POLICY scoring_select ON scoring_config
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "scoring_insert" ON scoring_config;
CREATE POLICY scoring_insert ON scoring_config
  FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "scoring_update" ON scoring_config;
CREATE POLICY scoring_update ON scoring_config
  FOR UPDATE USING (auth.uid() = user_id);

-- Alertas config: cada um vê e gerencia a sua
DROP POLICY IF EXISTS "alertas_select" ON alertas_config;
CREATE POLICY alertas_select ON alertas_config
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "alertas_insert" ON alertas_config;
CREATE POLICY alertas_insert ON alertas_config
  FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "alertas_update" ON alertas_config;
CREATE POLICY alertas_update ON alertas_config
  FOR UPDATE USING (auth.uid() = user_id);

-- Fotos: todos os autenticados podem ver e gerenciar
DROP POLICY IF EXISTS "fotos_select" ON colaborador_fotos;
CREATE POLICY fotos_select ON colaborador_fotos
  FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "fotos_insert" ON colaborador_fotos;
CREATE POLICY fotos_insert ON colaborador_fotos
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "fotos_update" ON colaborador_fotos;
CREATE POLICY fotos_update ON colaborador_fotos
  FOR UPDATE USING (auth.role() = 'authenticated');

-- Colab inativos: cada um vê e gerencia os seus
DROP POLICY IF EXISTS "inativos_select" ON colab_inativos;
CREATE POLICY inativos_select ON colab_inativos
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "inativos_insert" ON colab_inativos;
CREATE POLICY inativos_insert ON colab_inativos
  FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "inativos_delete" ON colab_inativos;
CREATE POLICY inativos_delete ON colab_inativos
  FOR DELETE USING (auth.uid() = user_id);
