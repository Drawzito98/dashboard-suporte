-- Campos opcionais para preservar ocorrências gravadas antes da classificação.
BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TABLE public.ausencias
  ADD COLUMN IF NOT EXISTS tipo text,
  ADD COLUMN IF NOT EXISTS minutos_atraso integer;

DO $
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.ausencias'::regclass
      AND conname = 'ausencias_tipo_minutos_check'
  ) THEN
    ALTER TABLE public.ausencias ADD CONSTRAINT ausencias_tipo_minutos_check
      CHECK (CASE tipo
        WHEN 'falta' THEN minutos_atraso IS NULL
        WHEN 'atraso' THEN minutos_atraso IS NOT NULL AND minutos_atraso BETWEEN 1 AND 1440
        ELSE tipo IS NULL AND minutos_atraso IS NULL
      END);
  END IF;
END $;

NOTIFY pgrst, 'reload schema';
COMMIT;
