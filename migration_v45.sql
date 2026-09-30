-- Salário no cadastro de colaboradores; mantém as políticas de acesso existentes.
ALTER TABLE public.colaboradores_info
  ADD COLUMN IF NOT EXISTS salario NUMERIC(10, 2)
  CHECK (salario >= 0);

NOTIFY pgrst, 'reload schema';
