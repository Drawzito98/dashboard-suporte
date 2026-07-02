-- migration_v19.sql — Tabela ausencias (registro de faltas/ausências)

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

CREATE POLICY "ausencias_select_own" ON ausencias FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "ausencias_insert_own" ON ausencias FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ausencias_update_own" ON ausencias FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "ausencias_delete_own" ON ausencias FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_ausencias_user_id ON ausencias(user_id);
CREATE INDEX IF NOT EXISTS idx_ausencias_data ON ausencias(data DESC);
