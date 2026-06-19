-- migration_v4.sql — Anotações Diárias
-- Executar no SQL Editor do Supabase Dashboard

-- 1. Tabela
CREATE TABLE IF NOT EXISTS anotacoes_diarias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data date NOT NULL,
  conteudo text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Índices
CREATE INDEX IF NOT EXISTS idx_anotacoes_user_data ON anotacoes_diarias (user_id, data DESC);

-- 3. RLS
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
