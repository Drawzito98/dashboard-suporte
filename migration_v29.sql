-- Migration v29: check-in de clima e desafio diário dos colaboradores

CREATE TABLE IF NOT EXISTS perguntas_diarias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data DATE NOT NULL UNIQUE,
  pergunta TEXT NOT NULL,
  alternativas JSONB NOT NULL,
  resposta_correta INTEGER NOT NULL CHECK (resposta_correta >= 0),
  explicacao TEXT DEFAULT '',
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS checkins_diarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  humor SMALLINT NOT NULL CHECK (humor BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, data)
);

CREATE TABLE IF NOT EXISTS respostas_diarias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pergunta_id UUID NOT NULL REFERENCES perguntas_diarias(id) ON DELETE CASCADE,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  alternativa INTEGER NOT NULL CHECK (alternativa >= 0),
  acertou BOOLEAN NOT NULL DEFAULT false,
  pontos SMALLINT NOT NULL DEFAULT 0 CHECK (pontos BETWEEN 0 AND 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, pergunta_id),
  UNIQUE (user_id, data)
);

ALTER TABLE perguntas_diarias ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkins_diarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE respostas_diarias ENABLE ROW LEVEL SECURITY;

CREATE POLICY perguntas_admin_select ON perguntas_diarias FOR SELECT
  USING (auth.jwt() -> 'user_metadata' ->> 'role' = 'admin');
CREATE POLICY perguntas_admin_write ON perguntas_diarias FOR ALL
  USING (auth.jwt() -> 'user_metadata' ->> 'role' = 'admin')
  WITH CHECK (auth.jwt() -> 'user_metadata' ->> 'role' = 'admin');

CREATE POLICY checkins_own_insert ON checkins_diarios FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY checkins_own_select ON checkins_diarios FOR SELECT
  USING (auth.uid() = user_id OR auth.jwt() -> 'user_metadata' ->> 'role' = 'admin');
CREATE POLICY checkins_admin_update ON checkins_diarios FOR UPDATE
  USING (auth.jwt() -> 'user_metadata' ->> 'role' = 'admin');

CREATE POLICY respostas_own_select ON respostas_diarias FOR SELECT
  USING (auth.uid() = user_id OR auth.jwt() -> 'user_metadata' ->> 'role' = 'admin');

CREATE INDEX IF NOT EXISTS idx_checkins_data ON checkins_diarios(data DESC);
CREATE INDEX IF NOT EXISTS idx_respostas_user_data ON respostas_diarias(user_id, data DESC);
CREATE INDEX IF NOT EXISTS idx_perguntas_data ON perguntas_diarias(data DESC);
