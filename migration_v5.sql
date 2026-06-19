-- migration_v5.sql — Tarefas / Agenda
-- Executar no SQL Editor do Supabase Dashboard

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
