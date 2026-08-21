-- Migration v30: rastreabilidade das perguntas geradas automaticamente

ALTER TABLE perguntas_diarias
  ADD COLUMN IF NOT EXISTS fonte_url TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS fonte_titulo TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS gerada_automaticamente BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS modelo_gerador TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS gerada_em TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_perguntas_gerada_automaticamente
  ON perguntas_diarias(gerada_automaticamente, data DESC);
