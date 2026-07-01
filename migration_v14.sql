-- Migration v14: Adiciona campos data e imagem nos reportes + bucket storage

-- Adiciona coluna para data (selecionada pelo usuário)
ALTER TABLE reportes ADD COLUMN IF NOT EXISTS data DATE;

-- Adiciona coluna para URL da imagem
ALTER TABLE reportes ADD COLUMN IF NOT EXISTS imagem_url TEXT;

-- Cria bucket público para imagens dos reportes
INSERT INTO storage.buckets (id, name, public, avif_autodetection)
VALUES ('reportes-imagens', 'reportes-imagens', true, false)
ON CONFLICT (id) DO NOTHING;

-- Política: anon pode fazer upload
DROP POLICY IF EXISTS "anon_upload_reportes" ON storage.objects;
CREATE POLICY "anon_upload_reportes" ON storage.objects
  FOR INSERT
  TO anon
  WITH CHECK (bucket_id = 'reportes-imagens');

-- Política: anon pode ver imagens
DROP POLICY IF EXISTS "anon_select_reportes" ON storage.objects;
CREATE POLICY "anon_select_reportes" ON storage.objects
  FOR SELECT
  TO anon
  USING (bucket_id = 'reportes-imagens');

-- Política: authenticated pode ver e deletar
DROP POLICY IF EXISTS "auth_all_reportes" ON storage.objects;
CREATE POLICY "auth_all_reportes" ON storage.objects
  FOR ALL
  TO authenticated
  USING (bucket_id = 'reportes-imagens')
  WITH CHECK (bucket_id = 'reportes-imagens');
