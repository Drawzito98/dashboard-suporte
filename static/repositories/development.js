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


  root.AppRepositories = root.AppRepositories || {};
  root.AppRepositories.development = { dbFeedbacksLoad, dbFeedbacksSave, dbFeedbacksDelete };
})(window);
