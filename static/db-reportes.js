// db-reportes.js — CRUD da tabela reportes (mensagens externas)
// Sem fallback localStorage porque reportes só existem no Supabase

async function _reportesAuthHeaders() {
  try {
    const { data } = await sbClient.auth.getSession();
    const token = data?.session?.access_token;
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  } catch { return {}; }
}

async function dbReportesListar() {
  if (!sbClient) return [];
  try {
    const uid = (await sbClient.auth.getUser())?.data?.user?.id;
    if (!uid) return [];
    const { data, error } = await sbClient
      .from('reportes')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (e) {
    console.error('[db-reportes] Erro ao listar:', e);
    return [];
  }
}

async function dbReportesInserir({ nome, email, assunto, mensagem }) {
  if (!sbClient) return null;
  try {
    const { data, error } = await sbClient
      .from('reportes')
      .insert({ nome, email, assunto, mensagem })
      .select();
    if (error) throw error;
    return data?.[0] || null;
  } catch (e) {
    console.error('[db-reportes] Erro ao inserir:', e);
    return null;
  }
}

async function dbReportesAtualizar(id, changes) {
  if (!sbClient || !id) return false;
  try {
    const { error } = await sbClient
      .from('reportes')
      .update(changes)
      .eq('id', id);
    if (error) throw error;
    return true;
  } catch (e) {
    console.error('[db-reportes] Erro ao atualizar:', e);
    return false;
  }
}

async function dbReportesMarcarLida(id) {
  return dbReportesAtualizar(id, { lida: true });
}

async function dbReportesResponder(id, resposta, userId) {
  return dbReportesAtualizar(id, {
    resposta,
    respondida: true,
    respondido_em: new Date().toISOString(),
    respondido_por: userId
  });
}

async function dbReportesAtribuir(id, userId) {
  return dbReportesAtualizar(id, { user_id: userId });
}

async function dbReportesDeletar(id) {
  if (!sbClient || !id) return false;
  try {
    const { error } = await sbClient
      .from('reportes')
      .delete()
      .eq('id', id);
    if (error) throw error;
    return true;
  } catch (e) {
    console.error('[db-reportes] Erro ao deletar:', e);
    return false;
  }
}

async function dbReportesNaoLidas() {
  if (!sbClient) return 0;
  try {
    const { data, error } = await sbClient
      .from('reportes')
      .select('id', { count: 'exact', head: true })
      .eq('lida', false);
    if (error) return 0;
    return data?.length || 0;
  } catch { return 0; }
}
