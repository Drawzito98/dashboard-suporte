-- Migration: Adicionar suporte a múltiplos usuários
-- Execute isso no SQL Editor do Supabase Dashboard
-- https://supabase.com/dashboard/project/agvkmfusyetkicmuvumz

-- 1. Adicionar coluna user_id (UUID referenciando auth.users)
ALTER TABLE registros ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. Atualizar registros existentes: associar ao primeiro usuário que aparecer (opcional)
-- Descomente a linha abaixo e substitua SEU_USER_ID pelo UUID do seu usuário após criar a conta
-- UPDATE registros SET user_id = 'SEU_USER_ID' WHERE user_id IS NULL;

-- 3. Habilitar RLS
ALTER TABLE registros ENABLE ROW LEVEL SECURITY;

-- 4. Remover políticas antigas (se existirem)
DROP POLICY IF EXISTS "Users can view their own data" ON registros;
DROP POLICY IF EXISTS "Users can insert their own data" ON registros;
DROP POLICY IF EXISTS "Users can update their own data" ON registros;
DROP POLICY IF EXISTS "Users can delete their own data" ON registros;

-- 5. Criar políticas (soft transition: registros sem user_id ainda são visíveis)
CREATE POLICY "Users can view their own data" ON registros
  FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can insert their own data" ON registros
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own data" ON registros
  FOR UPDATE USING (auth.uid() = user_id OR user_id IS NULL)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own data" ON registros
  FOR DELETE USING (auth.uid() = user_id OR user_id IS NULL);
