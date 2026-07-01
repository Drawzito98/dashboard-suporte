-- Migration v15: Simplifica RLS dos reportes
-- Segue o padrão das tabelas compartilhadas do projeto (comentarios, historico)

-- Remove políticas antigas
DROP POLICY IF EXISTS "reportes_select_admin" ON reportes;
DROP POLICY IF EXISTS "reportes_select_colaborador" ON reportes;
DROP POLICY IF EXISTS "reportes_update_admin" ON reportes;
DROP POLICY IF EXISTS "reportes_update_colaborador" ON reportes;

-- SELECT: todo authenticated pode ver (mesmo padrão de comentarios/historico)
CREATE POLICY "reportes_select" ON reportes
  FOR SELECT
  TO authenticated
  USING (true);

-- UPDATE: todo authenticated pode atualizar
-- A permissão de quem pode fazer o quê é controlada pelo app (JS)
CREATE POLICY "reportes_update" ON reportes
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
