-- Migration v18: Tabela links_importantes (links salvos pelo usuário)

CREATE TABLE IF NOT EXISTS links_importantes (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  nome TEXT NOT NULL,
  url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE links_importantes ENABLE ROW LEVEL SECURITY;

-- Cada usuário vê apenas seus próprios links
CREATE POLICY "links_select" ON links_importantes
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "links_insert" ON links_importantes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "links_update" ON links_importantes
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "links_delete" ON links_importantes
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_links_user_id ON links_importantes(user_id);
CREATE INDEX IF NOT EXISTS idx_links_created_at ON links_importantes(created_at DESC);
