// Conexão com Supabase
const SUPABASE_URL = 'https://agvkmfusyetkicmuvumz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFndmttZnVzeWV0a2ljbXV2dW16Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3NTkxNjUsImV4cCI6MjA5NzMzNTE2NX0.9dxpGlGCf0TQbq46cm0fpD6gvkNUuqwMQNR3xolV4X4';

const sbClient = (typeof supabase !== 'undefined' && supabase.createClient)
  ? supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

function isAdmin() {
  return document.body.dataset.role === 'admin';
}

function requireAdmin() {
  if (!isAdmin()) {
    console.warn('[Permissão] Apenas administradores podem realizar esta ação.');
    return false;
  }
  return true;
}

if (!sbClient) {
  console.warn('Supabase client não disponível');
}

// Colunas permitidas na tabela (para filtrar o que enviar)
const DB_COLUMNS = new Set([
  'id', 'user_id', 'Setor', 'Mês', 'Atendente', 'Assumidos', 'Transferidos',
  'Finalizados', 'Score', 'SCORE', 'Objetivo', 'Observações',
  'Nota1', 'Nota2', 'Nota3', 'Total', 'Arquivo'
]);

// Mapeamento de nomes de colunas do app → banco de dados
const COLUMN_MAP = {
  'SCORE': 'Score'
};

// Mapeamento inverso: banco de dados → app
const REVERSE_COLUMN_MAP = {
  'Score': 'SCORE'
};

function filterRecordFields(record) {
  const clean = {};
  for (const key of Object.keys(record || {})) {
    const dbKey = COLUMN_MAP[key] || key;
    if (DB_COLUMNS.has(dbKey)) {
      clean[dbKey] = record[key];
    }
  }
  return clean;
}

function reverseMapRecord(record) {
  const mapped = {};
  for (const key of Object.keys(record || {})) {
    const appKey = REVERSE_COLUMN_MAP[key] || key;
    mapped[appKey] = record[key];
  }
  return mapped;
}

function filterRecordsFields(records) {
  return (records || []).map(filterRecordFields);
}

async function dbLoadRecords() {
  if (!sbClient) { console.warn('dbLoadRecords: sbClient nulo'); return null; }
  try {
    console.log('[DB] Buscando registros do Supabase...');
    const { data, error } = await sbClient.from('registros').select('*');
    if (error) {
      console.error('[DB] Erro na query:', error);
      throw error;
    }
    console.log('[DB] Dados recebidos:', data?.length, 'registros');
    return (data || []).map(reverseMapRecord);
  } catch (e) {
    console.error('[DB] Erro ao carregar do Supabase:', e.message || e);
    return null;
  }
}

async function dbSaveRecords(records) {
  if (!requireAdmin()) return false;
  if (!sbClient || !records || !records.length) return false;
  try {
    const clean = filterRecordsFields(records);
    const user = getCurrentUser();
    if (user) {
      clean.forEach(r => r.user_id = user.id);
    }
    console.log('Enviando ao Supabase:', clean.length, 'registros');
    const { data, error } = await sbClient.from('registros').insert(clean).select();
    if (error) {
      console.error('Erro Supabase (detalhe):', error);
      throw error;
    }
    console.log('Supabase insert OK:', data?.length, 'registros');
    return true;
  } catch (e) {
    console.error('Erro ao salvar no Supabase:', e);
    return false;
  }
}

async function dbDeleteAll() {
  if (!requireAdmin()) return false;
  if (!sbClient) return false;
  try {
    const { error } = await sbClient.from('registros').delete().neq('id', -1);
    if (error) throw error;
    return true;
  } catch (e) {
    try {
      const { error: e2 } = await sbClient.from('registros').delete().neq('created_at', '');
      if (e2) throw e2;
      return true;
    } catch (e2) {
      console.error('Erro ao limpar tabela:', e2);
      return false;
    }
  }
}

async function dbReplaceAll(records) {
  if (!requireAdmin()) return false;
  if (!sbClient) return false;
  try {
    return await dbSaveRecords(records);
  } catch (e) {
    console.error('Erro ao substituir registros:', e);
    return false;
  }
}

async function dbInsertRow(row) {
  if (!requireAdmin()) return null;
  if (!sbClient) return null;
  try {
    const clean = filterRecordFields(row);
    const user = getCurrentUser();
    if (user) clean.user_id = user.id;
    const { data, error } = await sbClient
      .from('registros')
      .insert(clean)
      .select();
    if (error) throw error;
    return data ? data[0] : null;
  } catch (e) {
    console.error('Erro ao inserir registro:', e);
    return null;
  }
}

async function dbUpdateRecord(id, changes) {
  if (!requireAdmin()) return false;
  if (!sbClient || id == null) return false;
  try {
    const clean = filterRecordFields(changes);
    delete clean.id;
    delete clean.created_at;
    delete clean.user_id;
    const { error } = await sbClient.from('registros').update(clean).eq('id', id);
    if (error) throw error;
    return true;
  } catch (e) {
    console.error('Erro ao atualizar registro:', e);
    return false;
  }
}

async function dbDeleteRecord(id) {
  if (!requireAdmin()) return false;
  if (!sbClient || id == null) return false;
  try {
    const { error } = await sbClient.from('registros').delete().eq('id', id);
    if (error) throw error;
    return true;
  } catch (e) {
    console.error('Erro ao deletar registro:', e);
    return false;
  }
}
