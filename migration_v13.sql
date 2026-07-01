-- Migration v13: Tabela reportes (canal de comunicação externo)
-- Cria a tabela para receber mensagens de usuários externos via formulário público

CREATE TABLE IF NOT EXISTS reportes (
  id BIGSERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  assunto TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  lida BOOLEAN DEFAULT false,
  respondida BOOLEAN DEFAULT false,
  resposta TEXT,
  respondido_em TIMESTAMPTZ,
  respondido_por UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_reportes_user_id ON reportes(user_id);
CREATE INDEX IF NOT EXISTS idx_reportes_lida ON reportes(lida);
CREATE INDEX IF NOT EXISTS idx_reportes_created_at ON reportes(created_at DESC);

-- RLS
ALTER TABLE reportes ENABLE ROW LEVEL SECURITY;

-- Qualquer um pode inserir (público - para o formulário externo)
CREATE POLICY "reportes_insert_anon" ON reportes
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Admins veem tudo
CREATE POLICY "reportes_select_admin" ON reportes
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() IN (SELECT id FROM auth.users WHERE raw_user_meta_data->>'role' = 'admin')
  );

-- Colaboradores veem apenas os reportes atribuídos a eles
CREATE POLICY "reportes_select_colaborador" ON reportes
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
  );

-- Viewers não veem nada (padrão deny)

-- Admins podem atualizar qualquer reporte
CREATE POLICY "reportes_update_admin" ON reportes
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() IN (SELECT id FROM auth.users WHERE raw_user_meta_data->>'role' = 'admin')
  )
  WITH CHECK (
    auth.uid() IN (SELECT id FROM auth.users WHERE raw_user_meta_data->>'role' = 'admin')
  );

-- Colaboradores podem atualizar apenas reportes atribuídos a eles (ex: marcar lida, responder)
CREATE POLICY "reportes_update_colaborador" ON reportes
  FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
  )
  WITH CHECK (
    user_id = auth.uid()
  );

-- Habilitar Realtime para notificações push
ALTER PUBLICATION supabase_realtime ADD TABLE reportes;
