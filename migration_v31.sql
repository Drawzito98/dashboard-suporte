-- Migration v31: endurecimento de segurança e compatibilidade de feitos relevantes

ALTER TABLE colaboradores_info
  ADD COLUMN IF NOT EXISTS feito_relevante TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS feito_descricao TEXT DEFAULT '';

DROP POLICY IF EXISTS "Users can view their own data" ON registros;
DROP POLICY IF EXISTS "Users can update their own data" ON registros;
DROP POLICY IF EXISTS "Users can delete their own data" ON registros;

CREATE POLICY "Users can view their own data" ON registros FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin' AND user_id IS NULL));
CREATE POLICY "Users can update their own data" ON registros FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin' AND user_id IS NULL))
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own data" ON registros FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin' AND user_id IS NULL));

DROP POLICY IF EXISTS "comentarios_delete" ON comentarios;
CREATE POLICY comentarios_delete ON comentarios FOR DELETE TO authenticated
  USING (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin');

DROP POLICY IF EXISTS "fotos_insert" ON colaborador_fotos;
DROP POLICY IF EXISTS "fotos_update" ON colaborador_fotos;
DROP POLICY IF EXISTS "fotos_delete" ON colaborador_fotos;
CREATE POLICY fotos_insert ON colaborador_fotos FOR INSERT TO authenticated
  WITH CHECK (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin');
CREATE POLICY fotos_update ON colaborador_fotos FOR UPDATE TO authenticated
  USING (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin')
  WITH CHECK (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin');
CREATE POLICY fotos_delete ON colaborador_fotos FOR DELETE TO authenticated
  USING (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin');

REVOKE ALL ON TABLE registros, metas, comentarios, historico, scoring_config,
  alertas_config, colaborador_fotos, colab_inativos, colaboradores_info FROM anon;

-- Todas as decisões administrativas passam a usar app_metadata, que não pode
-- ser alterado pelo próprio usuário.
DROP POLICY IF EXISTS feedbacks_select ON feedbacks;
CREATE POLICY feedbacks_select ON feedbacks FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR auth.jwt() -> 'app_metadata' ->> 'role' = 'admin');

DROP POLICY IF EXISTS avaliacoes_select ON avaliacoes;
CREATE POLICY avaliacoes_select ON avaliacoes FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR auth.jwt() -> 'app_metadata' ->> 'role' = 'admin');

DROP POLICY IF EXISTS notificacoes_select ON notificacoes;
DROP POLICY IF EXISTS notificacoes_update ON notificacoes;
CREATE POLICY notificacoes_select ON notificacoes FOR SELECT TO authenticated
  USING (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin');
CREATE POLICY notificacoes_update ON notificacoes FOR UPDATE TO authenticated
  USING (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin')
  WITH CHECK (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin');

DROP POLICY IF EXISTS perguntas_admin_select ON perguntas_diarias;
DROP POLICY IF EXISTS perguntas_admin_write ON perguntas_diarias;
CREATE POLICY perguntas_admin_select ON perguntas_diarias FOR SELECT TO authenticated
  USING (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin');
CREATE POLICY perguntas_admin_write ON perguntas_diarias FOR ALL TO authenticated
  USING (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin')
  WITH CHECK (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin');

DROP POLICY IF EXISTS checkins_own_select ON checkins_diarios;
DROP POLICY IF EXISTS checkins_admin_update ON checkins_diarios;
CREATE POLICY checkins_own_select ON checkins_diarios FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR auth.jwt() -> 'app_metadata' ->> 'role' = 'admin');
CREATE POLICY checkins_admin_update ON checkins_diarios FOR UPDATE TO authenticated
  USING (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin')
  WITH CHECK (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin');

DROP POLICY IF EXISTS respostas_own_select ON respostas_diarias;
CREATE POLICY respostas_own_select ON respostas_diarias FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR auth.jwt() -> 'app_metadata' ->> 'role' = 'admin');
