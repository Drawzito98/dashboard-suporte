-- Diagnóstico gerencial: somente revisões. Não altera tabelas ou políticas existentes.
BEGIN;
CREATE TABLE public.diagnostico_revisoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  fingerprint text NOT NULL CHECK (fingerprint ~ '^[a-f0-9]{64}$'),
  status text NOT NULL CHECK (status IN ('validado', 'ajustado', 'descartado')),
  note text NOT NULL DEFAULT '' CHECK (length(note) <= 4000),
  snapshot jsonb NOT NULL CHECK (jsonb_typeof(snapshot) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (status <> 'ajustado' OR length(trim(note)) > 0)
);
CREATE INDEX diagnostico_revisoes_owner ON public.diagnostico_revisoes(user_id, created_at DESC);
ALTER TABLE public.diagnostico_revisoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY diagnostico_revisoes_read ON public.diagnostico_revisoes
  FOR SELECT TO authenticated USING (user_id = auth.uid() AND coalesce(auth.jwt()->'app_metadata'->>'role', '') = 'admin');
CREATE POLICY diagnostico_revisoes_write ON public.diagnostico_revisoes
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND coalesce(auth.jwt()->'app_metadata'->>'role', '') = 'admin');
REVOKE ALL ON public.diagnostico_revisoes FROM anon, authenticated;
GRANT SELECT, INSERT ON public.diagnostico_revisoes TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
