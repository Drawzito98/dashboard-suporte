// Persistência de development; contratos preservados pelo facade db-extra.js.
(function (root) {
// ─── FEEDBACKS ──────────────────────────────────────────────────



async function dbFeedbacksLoad() {
  if (!sbClient) return _fallbackLoad(FEEDBACKS_LOCAL_KEY, []);
  try {
    const uid = await _getUserId();
    if (!uid) return _fallbackLoad(FEEDBACKS_LOCAL_KEY, []);
    const { data, error } = await sbClient.from('feedbacks').select('*').eq('user_id', uid).order('created_at', { ascending: false });
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
  const list = JSON.parse(appStorage.getItem(FEEDBACKS_LOCAL_KEY) || '[]');
  const idx = list.findIndex(f => f.id === feedback.id);
  if (idx >= 0) list[idx] = feedback;
  else list.unshift(feedback);
  appStorage.setItem(FEEDBACKS_LOCAL_KEY, JSON.stringify(list));
  if (!sbClient) return;
  try {
    const uid = await _getUserId();
    if (!uid) return;
    const existing = await sbClient.from('feedbacks').select('id').eq('id', feedback.id).maybeSingle();
    if (existing?.data?.id) {
      await sbClient.from('feedbacks').update({
        colaborador: feedback.colaborador,
        mes: feedback.mes,
        sugestao_automatica: feedback.sugestao_automatica || '',
        anotacoes: feedback.anotacoes || '',
        feedback_final: feedback.feedback_final || '',
        updated_at: new Date().toISOString()
      }).eq('id', feedback.id);
    } else {
      await sbClient.from('feedbacks').insert({
        user_id: uid,
        colaborador: feedback.colaborador,
        mes: feedback.mes,
        sugestao_automatica: feedback.sugestao_automatica || '',
        anotacoes: feedback.anotacoes || '',
        feedback_final: feedback.feedback_final || ''
      });
    }
    if (typeof criarNotificacao === 'function') {
      criarNotificacao('feedback', `Novo feedback para ${feedback.colaborador || 'colaborador'}`, 'avaliacao');
    }
  } catch (e) { console.error('[db-extra]', e); }
}

async function dbFeedbacksDelete(id) {
  const list = JSON.parse(appStorage.getItem(FEEDBACKS_LOCAL_KEY) || '[]');
  const filtered = list.filter(f => f.id !== id);
  appStorage.setItem(FEEDBACKS_LOCAL_KEY, JSON.stringify(filtered));
  if (!sbClient) return;
  try {
    await sbClient.from('feedbacks').delete().eq('id', id);
  } catch (e) { console.error('[db-extra]', e); }
}


  root.AppRepositories = root.AppRepositories || {};
  root.AppRepositories.development = { dbFeedbacksLoad, dbFeedbacksSave, dbFeedbacksDelete };
})(window);
