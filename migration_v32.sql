-- Migration v32: setor atual informado no cadastro do colaborador

ALTER TABLE colaboradores_info
  ADD COLUMN IF NOT EXISTS setor_atual TEXT DEFAULT '';
