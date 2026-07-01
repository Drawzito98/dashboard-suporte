-- Migration v16: DELETE RLS para reportes
CREATE POLICY "reportes_delete" ON reportes
  FOR DELETE
  TO authenticated
  USING (true);
