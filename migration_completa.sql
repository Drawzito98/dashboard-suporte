-- ═══════════════════════════════════════════════════════════════════════════════
-- MIGRATION COMPLETA — Dashboard de Suporte (consolida migration.sql → v26)
-- Execute no Supabase SQL Editor:
--   https://supabase.com/dashboard/project/agvkmfusyetkicmuvumz/sql
--
-- ✅ 100% IDEMPOTENTE e NÃO-DESTRUTIVO:
--   • NÃO apaga tabelas (sem DROP TABLE)
--   • NÃO apaga linhas (sem DELETE / TRUNCATE)
--   • NÃO altera dados existentes
--   • Só cria o que não existe (CREATE ... IF NOT EXISTS)
--   • Recria políticas de segurança (DROP POLICY IF EXISTS + CREATE POLICY)
--
-- Pode rodar no seu banco ATUAL com segurança: tudo que já existe é ignorado.
-- A única coisa nova que será aplicada de verdade são as colunas "TMA" e "TMR".
--
-- Estrutura: primeiro as tabelas, depois as políticas de segurança, depois índices.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. TABELA registros (dados de desempenho importados via CSV / registro mensal)
--    Criada manualmente no projeto original; incluída aqui para setup limpo.
--    As colunas com acento/caixa especial precisam de aspas duplas.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS registros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "Setor" TEXT DEFAULT '',
  "Mês" TEXT DEFAULT '',
  "Atendente" TEXT DEFAULT '',
  "Assumidos" TEXT DEFAULT '',
  "Transferidos" TEXT DEFAULT '',
  "Finalizados" TEXT DEFAULT '',
  "Score" TEXT DEFAULT '',
  "SCORE" TEXT DEFAULT '',
  "Objetivo" TEXT DEFAULT '',
  "Observações" TEXT DEFAULT '',
  "Nota1" TEXT DEFAULT '',
  "Nota2" TEXT DEFAULT '',
  "Nota3" TEXT DEFAULT '',
  "Total" TEXT DEFAULT '',
  "Arquivo" TEXT DEFAULT '',
  "TMA" TEXT DEFAULT '',
  "TMR" TEXT DEFAULT '',
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Coluna user_id (compatibilidade com a migration original)
ALTER TABLE registros ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- RLS
ALTER TABLE registros ENABLE ROW LEVEL SECURITY;

-- Políticas de segurança dos registros.
-- IMPORTANTE: o app grava registros SEM user_id (importação CSV e registro mensal),
-- por isso todas as políticas permitem user_id IS NULL ("soft transition").
DROP POLICY IF EXISTS "Users can view their own data" ON registros;
CREATE POLICY "Users can view their own data" ON registros
  FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS "Users can insert their own data" ON registros;
CREATE POLICY "Users can insert their own data" ON registros
  FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS "Users can update their own data" ON registros;
CREATE POLICY "Users can update their own data" ON registros
  FOR UPDATE USING (auth.uid() = user_id OR user_id IS NULL)
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS "Users can delete their own data" ON registros;
CREATE POLICY "Users can delete their own data" ON registros
  FOR DELETE USING (auth.uid() = user_id OR user_id IS NULL);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Tabelas base (migration_v2): metas, comentarios, historico, scoring_config,
--    alertas_config, colaborador_fotos, colab_inativos, setor_inativos
-- ─────────────────────────────────────────────────────────────────────────────

-- Metas
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

-- Comentários mensais
CREATE TABLE IF NOT EXISTS comentarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mes TEXT NOT NULL,
  texto TEXT NOT NULL,
  user_email TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Histórico de alterações
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

-- Regras de pontuação (uma linha por usuário)
CREATE TABLE IF NOT EXISTS scoring_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  rules JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Configuração de alertas (uma linha por usuário)
CREATE TABLE IF NOT EXISTS alertas_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  config JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Fotos dos colaboradores
CREATE TABLE IF NOT EXISTS colaborador_fotos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  foto_url TEXT DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Colaboradores inativos por usuário
CREATE TABLE IF NOT EXISTS colab_inativos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL
);

-- Setores inativos por usuário (criada manualmente no projeto; incluída p/ setup limpo)
CREATE TABLE IF NOT EXISTS setor_inativos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Tabela feedbacks (migration_v3) + RLS com leitura por admin (migration_v12)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS feedbacks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  colaborador TEXT NOT NULL,
  mes TEXT NOT NULL DEFAULT '',
  sugestao_automatica TEXT DEFAULT '',
  anotacoes TEXT DEFAULT '',
  feedback_final TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE feedbacks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS feedbacks_select ON feedbacks;
CREATE POLICY feedbacks_select ON feedbacks
  FOR SELECT USING (
    auth.uid() = user_id
    OR auth.jwt() -> 'user_metadata' ->> 'role' = 'admin'
  );
DROP POLICY IF EXISTS feedbacks_insert ON feedbacks;
CREATE POLICY feedbacks_insert ON feedbacks
  FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS feedbacks_update ON feedbacks;
CREATE POLICY feedbacks_update ON feedbacks
  FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS feedbacks_delete ON feedbacks;
CREATE POLICY feedbacks_delete ON feedbacks
  FOR DELETE USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Tabela anotacoes_diarias (migration_v4)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS anotacoes_diarias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data date NOT NULL,
  conteudo text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_anotacoes_user_data ON anotacoes_diarias (user_id, data DESC);

ALTER TABLE anotacoes_diarias ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'anotacoes_diarias' AND policyname = 'Usuários podem gerenciar suas próprias anotações') THEN
    CREATE POLICY "Usuários podem gerenciar suas próprias anotações"
      ON anotacoes_diarias
      FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Tabela tarefas (migration_v5)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tarefas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  descricao text NOT NULL DEFAULT '',
  data date NOT NULL,
  prioridade text NOT NULL DEFAULT 'media' CHECK (prioridade IN ('baixa','media','alta')),
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','concluida','cancelada')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tarefas_user_data ON tarefas (user_id, data DESC);

ALTER TABLE tarefas ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tarefas' AND policyname = 'Usuários podem gerenciar suas próprias tarefas') THEN
    CREATE POLICY "Usuários podem gerenciar suas próprias tarefas"
      ON tarefas
      FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Tabela pontos_extras (migration_v6) + coluna mes (migration_v9)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pontos_extras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  colaborador TEXT NOT NULL,
  descricao TEXT NOT NULL DEFAULT '',
  pontos NUMERIC(6,1) NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE pontos_extras ADD COLUMN IF NOT EXISTS mes TEXT DEFAULT '';

ALTER TABLE pontos_extras ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuários podem ver seus próprios bônus" ON pontos_extras;
CREATE POLICY "Usuários podem ver seus próprios bônus"
  ON pontos_extras FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuários podem inserir seus próprios bônus" ON pontos_extras;
CREATE POLICY "Usuários podem inserir seus próprios bônus"
  ON pontos_extras FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuários podem atualizar seus próprios bônus" ON pontos_extras;
CREATE POLICY "Usuários podem atualizar seus próprios bônus"
  ON pontos_extras FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuários podem excluir seus próprios bônus" ON pontos_extras;
CREATE POLICY "Usuários podem excluir seus próprios bônus"
  ON pontos_extras FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_pontos_extras_user_id ON pontos_extras(user_id);
CREATE INDEX IF NOT EXISTS idx_pontos_extras_colaborador ON pontos_extras(colaborador);

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Tabela colaboradores_info (migration_v7) + conduta (v8) + nivel (v24)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS colaboradores_info (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  nome TEXT NOT NULL,
  data_aniversario DATE,
  data_admissao DATE,
  email TEXT DEFAULT '',
  tarefas_desempenhadas TEXT DEFAULT '',
  objetivos_futuros TEXT DEFAULT '',
  observacoes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, nome)
);

ALTER TABLE colaboradores_info ADD COLUMN IF NOT EXISTS conduta_negativa TEXT DEFAULT '';
ALTER TABLE colaboradores_info ADD COLUMN IF NOT EXISTS conduta_motivo TEXT DEFAULT '';
ALTER TABLE colaboradores_info ADD COLUMN IF NOT EXISTS nivel TEXT DEFAULT '';

ALTER TABLE colaboradores_info ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuários podem ver seus próprios registros" ON colaboradores_info;
CREATE POLICY "Usuários podem ver seus próprios registros"
  ON colaboradores_info FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuários podem inserir seus próprios registros" ON colaboradores_info;
CREATE POLICY "Usuários podem inserir seus próprios registros"
  ON colaboradores_info FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuários podem atualizar seus próprios registros" ON colaboradores_info;
CREATE POLICY "Usuários podem atualizar seus próprios registros"
  ON colaboradores_info FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuários podem excluir seus próprios registros" ON colaboradores_info;
CREATE POLICY "Usuários podem excluir seus próprios registros"
  ON colaboradores_info FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_colab_info_user_id ON colaboradores_info(user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. Tabela avaliacoes (criada manualmente no projeto; incluída p/ setup limpo)
--    + colunas extras (v10/v11) + RLS com leitura por admin (v12)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS avaliacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  colaborador TEXT NOT NULL,
  ciclo TEXT DEFAULT '',
  scores JSONB DEFAULT '{}'::jsonb,
  observacoes_gerais TEXT DEFAULT '',
  observacoes_competencias JSONB DEFAULT '{}'::jsonb,
  comentarios_ia JSONB DEFAULT '[]'::jsonb,
  comentarios_finais JSONB DEFAULT '[]'::jsonb,
  avaliacao_qualitativa TEXT DEFAULT '',
  status TEXT DEFAULT 'pendente',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE avaliacoes ADD COLUMN IF NOT EXISTS comentarios_ia JSONB DEFAULT '[]';
ALTER TABLE avaliacoes ADD COLUMN IF NOT EXISTS comentarios_finais JSONB DEFAULT '[]';
ALTER TABLE avaliacoes ADD COLUMN IF NOT EXISTS observacoes_competencias JSONB DEFAULT '{}';
ALTER TABLE avaliacoes ADD COLUMN IF NOT EXISTS avaliacao_qualitativa TEXT DEFAULT '';

ALTER TABLE avaliacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS avaliacoes_select ON avaliacoes;
CREATE POLICY avaliacoes_select ON avaliacoes
  FOR SELECT USING (
    auth.uid() = user_id
    OR auth.jwt() -> 'user_metadata' ->> 'role' = 'admin'
  );
DROP POLICY IF EXISTS avaliacoes_insert ON avaliacoes;
CREATE POLICY avaliacoes_insert ON avaliacoes
  FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS avaliacoes_update ON avaliacoes;
CREATE POLICY avaliacoes_update ON avaliacoes
  FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS avaliacoes_delete ON avaliacoes;
CREATE POLICY avaliacoes_delete ON avaliacoes
  FOR DELETE USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. Tabela notificacoes (migration_v12)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notificacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  tipo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  link TEXT DEFAULT '',
  lida BOOLEAN DEFAULT false,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email TEXT DEFAULT ''
);

ALTER TABLE notificacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notificacoes_insert ON notificacoes;
CREATE POLICY notificacoes_insert ON notificacoes
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS notificacoes_select ON notificacoes;
CREATE POLICY notificacoes_select ON notificacoes
  FOR SELECT USING (auth.jwt() -> 'user_metadata' ->> 'role' = 'admin');

DROP POLICY IF EXISTS notificacoes_update ON notificacoes;
CREATE POLICY notificacoes_update ON notificacoes
  FOR UPDATE USING (auth.jwt() -> 'user_metadata' ->> 'role' = 'admin');

CREATE INDEX IF NOT EXISTS idx_notificacoes_lida ON notificacoes(lida);
CREATE INDEX IF NOT EXISTS idx_notificacoes_created_at ON notificacoes(created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. Tabela reportes (migration_v13) + data/imagem/storage (v14) +
--     RLS simplificada (v15) + delete (v16) + categoria/prioridade (v17)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reportes (
  id BIGSERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  assunto TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  lida BOOLEAN DEFAULT false,
  respondida BOOLEAN DEFAULT false,
  resposta TEXT,
  respondido_em TIMESTAMPTZ,
  respondido_por UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE reportes ADD COLUMN IF NOT EXISTS data DATE;
ALTER TABLE reportes ADD COLUMN IF NOT EXISTS imagem_url TEXT;
ALTER TABLE reportes ADD COLUMN IF NOT EXISTS categoria TEXT DEFAULT '';
ALTER TABLE reportes ADD COLUMN IF NOT EXISTS prioridade TEXT DEFAULT 'media';

CREATE INDEX IF NOT EXISTS idx_reportes_user_id ON reportes(user_id);
CREATE INDEX IF NOT EXISTS idx_reportes_lida ON reportes(lida);
CREATE INDEX IF NOT EXISTS idx_reportes_created_at ON reportes(created_at DESC);

ALTER TABLE reportes ENABLE ROW LEVEL SECURITY;

-- Qualquer um pode inserir (formulário público)
DROP POLICY IF EXISTS "reportes_insert_anon" ON reportes;
CREATE POLICY "reportes_insert_anon" ON reportes
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- SELECT: todo authenticated pode ver
DROP POLICY IF EXISTS "reportes_select" ON reportes;
DROP POLICY IF EXISTS "reportes_select_admin" ON reportes;
DROP POLICY IF EXISTS "reportes_select_colaborador" ON reportes;
CREATE POLICY "reportes_select" ON reportes
  FOR SELECT
  TO authenticated
  USING (true);

-- UPDATE: todo authenticated pode atualizar (controle feito pelo app)
DROP POLICY IF EXISTS "reportes_update" ON reportes;
DROP POLICY IF EXISTS "reportes_update_admin" ON reportes;
DROP POLICY IF EXISTS "reportes_update_colaborador" ON reportes;
CREATE POLICY "reportes_update" ON reportes
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- DELETE
DROP POLICY IF EXISTS "reportes_delete" ON reportes;
CREATE POLICY "reportes_delete" ON reportes
  FOR DELETE
  TO authenticated
  USING (true);

-- Bucket público para imagens dos reportes
INSERT INTO storage.buckets (id, name, public, avif_autodetection)
VALUES ('reportes-imagens', 'reportes-imagens', true, false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "anon_upload_reportes" ON storage.objects;
CREATE POLICY "anon_upload_reportes" ON storage.objects
  FOR INSERT
  TO anon
  WITH CHECK (bucket_id = 'reportes-imagens');

DROP POLICY IF EXISTS "anon_select_reportes" ON storage.objects;
CREATE POLICY "anon_select_reportes" ON storage.objects
  FOR SELECT
  TO anon
  USING (bucket_id = 'reportes-imagens');

DROP POLICY IF EXISTS "auth_all_reportes" ON storage.objects;
CREATE POLICY "auth_all_reportes" ON storage.objects
  FOR ALL
  TO authenticated
  USING (bucket_id = 'reportes-imagens')
  WITH CHECK (bucket_id = 'reportes-imagens');

-- Realtime para notificações push (só adiciona se ainda não estiver na publicação)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'reportes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE reportes;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 11. Tabela links_importantes (migration_v18)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS links_importantes (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  nome TEXT NOT NULL,
  url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE links_importantes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS links_select ON links_importantes;
CREATE POLICY links_select ON links_importantes
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS links_insert ON links_importantes;
CREATE POLICY links_insert ON links_importantes
  FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS links_update ON links_importantes;
CREATE POLICY links_update ON links_importantes
  FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS links_delete ON links_importantes;
CREATE POLICY links_delete ON links_importantes
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_links_user_id ON links_importantes(user_id);
CREATE INDEX IF NOT EXISTS idx_links_created_at ON links_importantes(created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 12. Tabela ausencias (migration_v19)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ausencias (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  colaborador TEXT NOT NULL,
  data DATE NOT NULL,
  periodo TEXT NOT NULL DEFAULT 'dia_inteiro',
  motivo TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE ausencias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ausencias_select_own ON ausencias;
CREATE POLICY ausencias_select_own ON ausencias FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS ausencias_insert_own ON ausencias;
CREATE POLICY ausencias_insert_own ON ausencias FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS ausencias_update_own ON ausencias;
CREATE POLICY ausencias_update_own ON ausencias FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS ausencias_delete_own ON ausencias;
CREATE POLICY ausencias_delete_own ON ausencias FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_ausencias_user_id ON ausencias(user_id);
CREATE INDEX IF NOT EXISTS idx_ausencias_data ON ausencias(data DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 13. Tabela avaliacao_atendimentos (migration_v20) + coluna imagem (v21)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS avaliacao_atendimentos (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  protocolo TEXT NOT NULL,
  colaborador TEXT NOT NULL,
  nota NUMERIC NOT NULL,
  justa BOOLEAN DEFAULT true,
  resumo TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE avaliacao_atendimentos ADD COLUMN IF NOT EXISTS imagem TEXT DEFAULT '';

ALTER TABLE avaliacao_atendimentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuários podem ver suas próprias avaliações" ON avaliacao_atendimentos;
CREATE POLICY "Usuários podem ver suas próprias avaliações"
  ON avaliacao_atendimentos FOR SELECT
  USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Usuários podem inserir suas próprias avaliações" ON avaliacao_atendimentos;
CREATE POLICY "Usuários podem inserir suas próprias avaliações"
  ON avaliacao_atendimentos FOR INSERT
  WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Usuários podem atualizar suas próprias avaliações" ON avaliacao_atendimentos;
CREATE POLICY "Usuários podem atualizar suas próprias avaliações"
  ON avaliacao_atendimentos FOR UPDATE
  USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Usuários podem excluir suas próprias avaliações" ON avaliacao_atendimentos;
CREATE POLICY "Usuários podem excluir suas próprias avaliações"
  ON avaliacao_atendimentos FOR DELETE
  USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 14. Tabela ferias (migration_v22)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ferias (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  colaborador TEXT NOT NULL,
  data_inicio DATE NOT NULL,
  data_fim DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE ferias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuários podem ver suas próprias ferias" ON ferias;
CREATE POLICY "Usuários podem ver suas próprias ferias"
  ON ferias FOR SELECT
  USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Usuários podem inserir suas próprias ferias" ON ferias;
CREATE POLICY "Usuários podem inserir suas próprias ferias"
  ON ferias FOR INSERT
  WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Usuários podem atualizar suas próprias ferias" ON ferias;
CREATE POLICY "Usuários podem atualizar suas próprias ferias"
  ON ferias FOR UPDATE
  USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Usuários podem excluir suas próprias ferias" ON ferias;
CREATE POLICY "Usuários podem excluir suas próprias ferias"
  ON ferias FOR DELETE
  USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 15. Tabela acompanhamento_diario (migration_v23)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS acompanhamento_diario (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  colaborador TEXT NOT NULL,
  data DATE NOT NULL,
  setor TEXT NOT NULL DEFAULT '',
  assumidos INTEGER NOT NULL DEFAULT 0,
  transferidos INTEGER NOT NULL DEFAULT 0,
  finalizados INTEGER NOT NULL DEFAULT 0,
  nota NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE acompanhamento_diario ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuários podem ver seus próprios registros" ON acompanhamento_diario;
CREATE POLICY "Usuários podem ver seus próprios registros"
  ON acompanhamento_diario FOR SELECT
  USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Usuários podem inserir seus próprios registros" ON acompanhamento_diario;
CREATE POLICY "Usuários podem inserir seus próprios registros"
  ON acompanhamento_diario FOR INSERT
  WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Usuários podem atualizar seus próprios registros" ON acompanhamento_diario;
CREATE POLICY "Usuários podem atualizar seus próprios registros"
  ON acompanhamento_diario FOR UPDATE
  USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Usuários podem excluir seus próprios registros" ON acompanhamento_diario;
CREATE POLICY "Usuários podem excluir seus próprios registros"
  ON acompanhamento_diario FOR DELETE
  USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 16. Índices de performance (migration_v25)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_registros_setor_mes
  ON registros ("Setor", "Mês");
CREATE INDEX IF NOT EXISTS idx_registros_atendente
  ON registros ("Atendente");
CREATE INDEX IF NOT EXISTS idx_registros_mes
  ON registros ("Mês" DESC);
CREATE INDEX IF NOT EXISTS idx_registros_user_id
  ON registros (user_id);

CREATE INDEX IF NOT EXISTS idx_metas_user_id ON metas (user_id);
CREATE INDEX IF NOT EXISTS idx_comentarios_created_at ON comentarios (created_at ASC);
CREATE INDEX IF NOT EXISTS idx_historico_created_at ON historico (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scoring_config_user_id ON scoring_config (user_id);
CREATE INDEX IF NOT EXISTS idx_alertas_config_user_id ON alertas_config (user_id);
CREATE INDEX IF NOT EXISTS idx_colab_fotos_nome ON colaborador_fotos (nome);
CREATE INDEX IF NOT EXISTS idx_colab_inativos_user_id ON colab_inativos (user_id);
CREATE INDEX IF NOT EXISTS idx_feedbacks_user_id ON feedbacks (user_id, created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 17. NOVO — colunas TMA e TMR em registros (migration_v26)
--     TMA = Tempo Médio de Atendimento, TMR = Tempo Médio de Resposta.
--     Armazenadas como texto livre, ex: "1d 2h 18m 20s".
--     É o que de fato aplica algo novo no seu banco atual.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE registros ADD COLUMN IF NOT EXISTS "TMA" TEXT;
ALTER TABLE registros ADD COLUMN IF NOT EXISTS "TMR" TEXT;

-- ═══════════════════════════════════════════════════════════════════════════════
-- FIM — Migration completa
-- Dica: depois de rodar, confira com:
--   SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
-- ═══════════════════════════════════════════════════════════════════════════════
