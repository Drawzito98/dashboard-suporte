// Persistência de development; contratos preservados pelo facade db-extra.js.
(function (root) {
// ─── FEEDBACKS ──────────────────────────────────────────────────



async function dbFeedbacksLoad() {
  const token = AppDataSession.token(), revision = _confirmedRevisions.get('feedbacks');
  if (!sbClient) return _fallbackLoad(FEEDBACKS_LOCAL_KEY, []);
  try {
    const uid = await _getUserId();
    if (!uid) return _fallbackLoad(FEEDBACKS_LOCAL_KEY, []);
    const { data, error } = await sbClient.from('feedbacks').select('*').eq('user_id', uid).order('created_at', { ascending: false });
    if (!AppDataSession.current(token) || revision !== _confirmedRevisions.get('feedbacks')) return _fallbackLoad(FEEDBACKS_LOCAL_KEY, []);
    if (!error && Array.isArray(data)) {
      const list = data.map(r => ({
        id: r.id,
        colaborador: r.colaborador,
        mes: r.mes,
        sugestao_automatica: r.sugestao_automatica || '',
        anotacoes: r.anotacoes || '',
        feedback_final: r.feedback_final || '',
        createdAt: r.created_at,
        updatedAt: r.updated_at
      }));
      appStorage.setItem(FEEDBACKS_LOCAL_KEY, JSON.stringify(list));
      return list;
    }
    return _fallbackLoad(FEEDBACKS_LOCAL_KEY, []);
  } catch {
    return _fallbackLoad(FEEDBACKS_LOCAL_KEY, []);
  }
}

async function dbFeedbacksSave(feedback) {
  const draft = { ...feedback, id: _writeUuid(feedback.id) };
  return _confirmedWrite('feedbacks', async ({ uid, request }) => {
    const row = {
      id: draft.id, user_id: uid, colaborador: draft.colaborador, mes: draft.mes,
      sugestao_automatica: draft.sugestao_automatica || '', anotacoes: draft.anotacoes || '',
      feedback_final: draft.feedback_final || '', created_at: draft.createdAt || new Date().toISOString(), updated_at: new Date().toISOString()
    };
    const saved = await request(() => sbClient.from('feedbacks').upsert(row, { onConflict: 'id' }).select('*').single());
    if (!saved || saved.id !== draft.id) throw new Error('Gravação não confirmada. Seu rascunho foi mantido.');
    const confirmed = { ...draft, createdAt: saved.created_at || draft.createdAt, updatedAt: saved.updated_at };
    const list = _confirmedList(FEEDBACKS_LOCAL_KEY);
    const idx = list.findIndex(f => f.id === feedback.id || f.id === confirmed.id);
    if (idx >= 0) list[idx] = confirmed; else list.unshift(confirmed);
    _confirmedCache(FEEDBACKS_LOCAL_KEY, list);
    if (typeof criarNotificacao === 'function') {
      try { Promise.resolve(criarNotificacao('feedback', `Novo feedback para ${draft.colaborador || 'colaborador'}`, 'avaliacao')).catch(() => {}); } catch (_) {}
    }
    return { status: 'confirmed', data: confirmed };
  });
}

async function dbFeedbacksDelete(id) {
  return _confirmedWrite('feedbacks', async ({ uid, request }) => {
    const rows = await request(() => sbClient.from('feedbacks').delete().eq('id', id).eq('user_id', uid).select('id'));
    if (!Array.isArray(rows) || !rows.some(row => row.id === id)) throw new Error('Exclusão não confirmada. Atualize a lista e tente novamente.');
    _confirmedCache(FEEDBACKS_LOCAL_KEY, _confirmedList(FEEDBACKS_LOCAL_KEY).filter(f => f.id !== id));
    return { status: 'confirmed', id };
  });
}


// Avaliações: cache confirmado separado do rascunho privado do editor.
const evaluationsKey = 'sistema_avaliacoes_v1';
function evaluationModel(row) {
  return { id: row.id, colaborador: row.colaborador, ciclo: row.ciclo, scores: row.scores || {},
    observacoes_gerais: row.observacoes_gerais || '', observacoes_competencias: row.observacoes_competencias || {},
    comentarios_ia: row.comentarios_ia || [], comentarios_finais: row.comentarios_finais || [],
    avaliacao_qualitativa: row.avaliacao_qualitativa || '', status: row.status ?? 'pendente',
    createdAt: row.created_at, updatedAt: row.updated_at };
}
function evaluationList() {
  const state = typeof AppState !== 'undefined' ? AppState.get('avaliacoes') : null;
  return Array.isArray(state) ? state : _confirmedList(evaluationsKey);
}
function publishEvaluations(list) {
  _confirmedCache(evaluationsKey, list);
  if (typeof AppState !== 'undefined') AppState.publish('avaliacoes', list);
}
async function dbAvaliacoesLoad() {
  const token = AppDataSession.token(), revision = _confirmedRevisions.get('avaliacoes');
  if (!AppDataSession.current(token) || !sbClient) return evaluationList();
  try {
    const uid = await _getUserId();
    if (!uid || !AppDataSession.current(token)) return evaluationList();
    const rows = [];
    for (let start = 0; ; start += 500) {
      const { data, error } = await sbClient.from('avaliacoes').select('*').eq('user_id', uid).order('created_at', { ascending: false }).order('id', { ascending: true }).range(start, start + 499);
      if (!AppDataSession.current(token) || revision !== _confirmedRevisions.get('avaliacoes')) return evaluationList();
      if (error || !Array.isArray(data) || data.some(row => row.user_id !== uid)) return evaluationList();
      rows.push(...data.map(evaluationModel));
      if (data.length < 500) break;
    }
    publishEvaluations(rows); return rows;
  } catch (_) { return evaluationList(); }
}
function confirmEvaluation(row, id, uid, oldId) {
  if (!row || row.id !== id || row.user_id !== uid) throw new Error('O servidor não confirmou a avaliação. O rascunho foi mantido.');
  const confirmed = evaluationModel(row), list = evaluationList();
  const index = list.findIndex(item => item.id === id || (oldId && item.id === oldId));
  if (index >= 0) list[index] = confirmed; else list.unshift(confirmed);
  publishEvaluations(list); return { status: 'confirmed', data: confirmed };
}
async function dbAvaliacaoSave(evaluation) {
  if (!requireAdmin()) throw new Error('Apenas administradores podem alterar avaliações.');
  const draft = JSON.parse(JSON.stringify(evaluation)); draft.id = _writeUuid(draft.id);
  return _confirmedWrite('avaliacoes', async ({ uid, request }) => {
    const row = { id: draft.id, user_id: uid, colaborador: draft.colaborador, ciclo: draft.ciclo,
      scores: draft.scores || {}, observacoes_gerais: draft.observacoes_gerais || '',
      observacoes_competencias: draft.observacoes_competencias || {}, comentarios_ia: draft.comentarios_ia || [],
      comentarios_finais: draft.comentarios_finais || [], avaliacao_qualitativa: draft.avaliacao_qualitativa || '',
      status: evaluationList().find(item => item.id === draft.id)?.status || draft.status || 'pendente', created_at: draft.createdAt || new Date().toISOString(), updated_at: new Date().toISOString() };
    const saved = await request(() => sbClient.from('avaliacoes').upsert(row, { onConflict: 'id' }).select('*').single());
    const result = confirmEvaluation(saved, draft.id, uid, draft._localId);
    if (typeof criarNotificacao === 'function') {
      try { Promise.resolve(criarNotificacao('avaliacao', `Nova avaliação para ${draft.colaborador || 'colaborador'} (${draft.ciclo || 'sem ciclo'})`, 'avaliacao')).catch(() => {}); } catch (_) {}
    }
    return result;
  });
}
async function dbAvaliacaoStatus(id, status) {
  if (!requireAdmin()) throw new Error('Apenas administradores podem alterar avaliações.');
  if (!['pendente', 'revisado'].includes(status)) throw new Error('Status de avaliação inválido.');
  return _confirmedWrite('avaliacoes', async ({ uid, request }) => {
    const saved = await request(() => sbClient.from('avaliacoes').update({ status, updated_at: new Date().toISOString() }).eq('id', id).eq('user_id', uid).select('*').single());
    return confirmEvaluation(saved, id, uid);
  });
}
async function dbAvaliacaoDelete(id) {
  if (!requireAdmin()) throw new Error('Apenas administradores podem excluir avaliações.');
  return _confirmedWrite('avaliacoes', async ({ uid, request }) => {
    const rows = await request(() => sbClient.from('avaliacoes').delete().eq('id', id).eq('user_id', uid).select('id'));
    if (!Array.isArray(rows) || !rows.some(row => row.id === id)) throw new Error('Exclusão não confirmada. Atualize a lista e tente novamente.');
    publishEvaluations(evaluationList().filter(row => row.id !== id)); return { status: 'confirmed', id };
  });
}

  root.AppRepositories = root.AppRepositories || {};
  root.AppRepositories.development = { dbFeedbacksLoad, dbFeedbacksSave, dbFeedbacksDelete, dbAvaliacoesLoad, dbAvaliacaoSave, dbAvaliacaoStatus, dbAvaliacaoDelete };
})(window);
