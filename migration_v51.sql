-- Histórico privado de resultados agregados do Panorama semanal.
BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE TABLE IF NOT EXISTS public.panorama_importacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  periodo_inicio date NOT NULL,
  periodo_fim date NOT NULL,
  relatorio jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  CONSTRAINT panorama_importacoes_periodo_check CHECK (periodo_inicio <= periodo_fim),
  CONSTRAINT panorama_importacoes_periodo_unico UNIQUE (user_id, periodo_inicio, periodo_fim),
  CONSTRAINT panorama_importacoes_relatorio_check CHECK (coalesce(
    jsonb_typeof(relatorio) = 'object'
    AND relatorio->'valid' = 'true'::jsonb
    AND relatorio->'schemaVersion' = '1'::jsonb
    AND relatorio->'period'->>'start' = to_char(periodo_inicio, 'YYYY-MM-DD')
    AND relatorio->'period'->>'end' = to_char(periodo_fim, 'YYYY-MM-DD')
    AND jsonb_typeof(relatorio->'days') = 'array'
    AND jsonb_typeof(relatorio->'analysis') = 'object',
    false
  ))
);

ALTER TABLE public.panorama_importacoes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.panorama_importacoes FROM anon, PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.panorama_importacoes TO authenticated;

DROP POLICY IF EXISTS panorama_importacoes_proprias ON public.panorama_importacoes;
CREATE POLICY panorama_importacoes_proprias ON public.panorama_importacoes
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.panorama_importacao_atualizada()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  NEW.updated_at := statement_timestamp();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS panorama_importacao_atualizada ON public.panorama_importacoes;
CREATE TRIGGER panorama_importacao_atualizada BEFORE UPDATE ON public.panorama_importacoes
  FOR EACH ROW EXECUTE FUNCTION public.panorama_importacao_atualizada();

NOTIFY pgrst, 'reload schema';
COMMIT;
