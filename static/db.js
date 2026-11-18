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

// Compatibility functions delegate to the session-aware repository.
let recordsRepository = null;
function getRecordsRepository() {
  if (!recordsRepository) recordsRepository = RecordsRepository.create({ client: sbClient, session: AppDataSession });
  return recordsRepository;
}
function notifyPendingSyncChanged() {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('pending-sync-changed', { detail: { count: getPendingSync().length } }));
}
function addToPendingSync(record) { const item = getRecordsRepository().enqueue(record); record._pendingId = item.key; notifyPendingSyncChanged(); }
function getPendingSync() { return getRecordsRepository().pending(); }
function clearPendingSync() { getRecordsRepository().clearPending(); notifyPendingSyncChanged(); }
async function syncPendingRecords() {
  try {
    const synced = await getRecordsRepository().retry();
    await getRecordsRepository().load(); notifyPendingSyncChanged();
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('records-sync-complete'));
    return synced;
  } catch (_) { return []; }
}

// Colunas permitidas na tabela (para filtrar o que enviar)
const DB_COLUMNS = new Set([
  'id', 'Setor', 'Mês', 'Atendente', 'Assumidos', 'Transferidos',
  'Finalizados', 'Score', 'SCORE', 'Objetivo', 'Observações',
  'Nota1', 'Nota2', 'Nota3', 'Total', 'Arquivo',
  'TMA', 'TMR'
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
  try { return await getRecordsRepository().load(); } catch (_) { return null; }
}
async function dbSaveRecords(records) {
  if (!requireAdmin() || !records?.length) return false;
  try { return await getRecordsRepository().insert(records) || false; } catch (_) { return false; }
}
async function dbDeleteAll() {
  if (!requireAdmin()) return false;
  try { return await getRecordsRepository().remove(null); } catch (_) { return false; }
}
async function dbReplaceAll(records) {
  if (!requireAdmin() || !Array.isArray(records)) return false;
  if (!await dbDeleteAll()) return false;
  return records.length ? dbSaveRecords(records) : true;
}
async function dbInsertRow(row) {
  const saved = await dbSaveRecords([row]); return saved ? saved[0] : null;
}
async function dbUpdateRecord(id, changes) {
  if (!requireAdmin()) return false;
  try { return await getRecordsRepository().update(id, changes); } catch (_) { return false; }
}
async function dbDeleteRecord(id) {
  if (!requireAdmin() || id == null) return false;
  try { return await getRecordsRepository().remove(id); } catch (_) { return false; }
}
