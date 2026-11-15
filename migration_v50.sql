-- Operação semanal (export do Looker / Opa! Suite). Somente cria tabelas novas.
-- Não altera tabelas ou políticas existentes. Acesso restrito a admin, por usuário (mesmo padrão da v49).
BEGIN;

CREATE TABLE public.opa_semanas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  semana_inicio date NOT NULL,            -- segunda-feira da semana
  periodo_inicio date NOT NULL,           -- primeiro dia com dados no export
  periodo_fim date NOT NULL,
  arquivo text NOT NULL DEFAULT '' CHECK (length(arquivo) <= 300),
  kpis jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(kpis) = 'object'),
  blocos jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(blocos) = 'object'),   -- dias, heat, deptos, motivos, estrelas, plantao...
  conferencia jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(conferencia) = 'array'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, semana_inicio)
);

CREATE TABLE public.opa_semana_colabs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  semana_id uuid NOT NULL REFERENCES public.opa_semanas(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  chave text NOT NULL CHECK (length(chave) BETWEEN 1 AND 60),        -- primeiro nome normalizado
  nome_looker text NOT NULL DEFAULT '',
  nome_app text NOT NULL DEFAULT '',
  nivel text NOT NULL DEFAULT '',                                   -- nível no momento da importação
  assumidos integer NOT NULL DEFAULT 0,
  finalizados integer NOT NULL DEFAULT 0,
  transferidos integer NOT NULL DEFAULT 0,
  clientes integer NOT NULL DEFAULT 0,
  media_cliente numeric(4,2),
  media_ia numeric(4,2),
  tma_s integer,
  tmi_s integer,
  tmr_s integer,
  UNIQUE (semana_id, chave)
);
CREATE INDEX opa_semanas_owner ON public.opa_semanas(user_id, semana_inicio DESC);
CREATE INDEX opa_semana_colabs_semana ON public.opa_semana_colabs(semana_id);
CREATE INDEX opa_semana_colabs_chave ON public.opa_semana_colabs(user_id, chave);

ALTER TABLE public.opa_semanas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opa_semana_colabs ENABLE ROW LEVEL SECURITY;

-- Papel lido de app_metadata (confiável), nunca de user_metadata.
CREATE POLICY opa_semanas_select ON public.opa_semanas FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND coalesce(auth.jwt()->'app_metadata'->>'role', '') = 'admin');
CREATE POLICY opa_semanas_insert ON public.opa_semanas FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND coalesce(auth.jwt()->'app_metadata'->>'role', '') = 'admin');
CREATE POLICY opa_semanas_update ON public.opa_semanas FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND coalesce(auth.jwt()->'app_metadata'->>'role', '') = 'admin')
  WITH CHECK (user_id = auth.uid() AND coalesce(auth.jwt()->'app_metadata'->>'role', '') = 'admin');
CREATE POLICY opa_semanas_delete ON public.opa_semanas FOR DELETE TO authenticated
  USING (user_id = auth.uid() AND coalesce(auth.jwt()->'app_metadata'->>'role', '') = 'admin');

CREATE POLICY opa_colabs_select ON public.opa_semana_colabs FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND coalesce(auth.jwt()->'app_metadata'->>'role', '') = 'admin');
CREATE POLICY opa_colabs_insert ON public.opa_semana_colabs FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND coalesce(auth.jwt()->'app_metadata'->>'role', '') = 'admin'
    AND EXISTS (SELECT 1 FROM public.opa_semanas s WHERE s.id = semana_id AND s.user_id = auth.uid()));
CREATE POLICY opa_colabs_update ON public.opa_semana_colabs FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND coalesce(auth.jwt()->'app_metadata'->>'role', '') = 'admin')
  WITH CHECK (user_id = auth.uid() AND coalesce(auth.jwt()->'app_metadata'->>'role', '') = 'admin');
CREATE POLICY opa_colabs_delete ON public.opa_semana_colabs FOR DELETE TO authenticated
  USING (user_id = auth.uid() AND coalesce(auth.jwt()->'app_metadata'->>'role', '') = 'admin');

REVOKE ALL ON public.opa_semanas, public.opa_semana_colabs FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.opa_semanas, public.opa_semana_colabs TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
