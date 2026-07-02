// db-extra.js — Persistência no Supabase (com fallback para localStorage)
// Tabelas: metas, comentarios, historico, scoring_config, alertas_config, colaborador_fotos, colab_inativos

// ─── Helpers internos ────────────────────────────────────────────
async function _uid() {
  try { const u = await sbClient?.auth?.getUser(); return u?.data?.user?.id ?? null; }
  catch { return null; }
}

async function _email() {
  try { const u = await sbClient?.auth?.getUser(); return u?.data?.user?.email ?? null; }
  catch { return null; }
}

async function _getUserId() {
  try {
    const { data } = await sbClient.auth.getUser();
    return data?.user?.id || null;
  } catch { return null; }
}

async function _getUserEmail() {
  try {
    const { data } = await sbClient.auth.getUser();
    return data?.user?.email || '';
  } catch { return ''; }
}

// ─── METAS ───────────────────────────────────────────────────────

const METAS_LOCAL_KEY = 'sistema_metas_v1';

async function dbMetasLoad() {
  if (!sbClient) return _fallbackLoad(METAS_LOCAL_KEY, []);
  try {
    const uid = await _getUserId();
    if (!uid) return _fallbackLoad(METAS_LOCAL_KEY, []);
    const { data } = await sbClient.from('metas').select('*').eq('user_id', uid);
    if (data && Array.isArray(data) && data.length > 0) {
      const goals = data.map(r => ({
        id: r.id,
        title: r.title,
        type: r.type,
        metric: r.metric,
        target: r.target,
        setor: r.setor,
        collaborator: r.collaborator,
        period: r.period,
        createdAt: r.created_at
      }));
      localStorage.setItem(METAS_LOCAL_KEY, JSON.stringify(goals));
      return goals;
    }
    return _fallbackLoad(METAS_LOCAL_KEY, []);
  } catch {
    return _fallbackLoad(METAS_LOCAL_KEY, []);
  }
}

async function dbMetasSave(goals) {
  if (!requireAdmin()) return;
  localStorage.setItem(METAS_LOCAL_KEY, JSON.stringify(goals));
  if (!sbClient) return;
  try {
    const uid = await _getUserId();
    if (!uid) return;
    const { error: delError } = await sbClient.from('metas').delete().eq('user_id', uid);
    if (delError) return;
    if (goals.length === 0) return;
    const rows = goals.filter(g => g && (g.id || g.title)).map(g => ({
      user_id: uid,
      title: g.title || 'Meta',
      type: g.type || 'monthly',
      metric: g.metric || 'finalizados',
      target: parseFloat(g.target) || 0,
      setor: g.setor || 'all',
      collaborator: g.collaborator || '',
      period: g.period || 'all'
    }));
    await sbClient.from('metas').insert(rows);
  } catch (e) { console.error('[db-extra] dbMetasSave:', e); }
}

// ─── COMENTÁRIOS ─────────────────────────────────────────────────

const COMENTARIOS_LOCAL_KEY = 'sistema_comentarios_v1';

async function dbComentariosLoad() {
  if (!sbClient) return _fallbackLoad(COMENTARIOS_LOCAL_KEY, {});
  try {
    const { data } = await sbClient.from('comentarios').select('*').order('created_at', { ascending: true });
    if (data && Array.isArray(data) && data.length > 0) {
      const map = {};
      data.forEach(c => {
        if (!map[c.mes]) map[c.mes] = [];
        map[c.mes].push({
          id: c.id,
          texto: c.texto,
          user: c.user_email || 'desconhecido',
          ts: c.created_at
        });
      });
      localStorage.setItem(COMENTARIOS_LOCAL_KEY, JSON.stringify(map));
      return map;
    }
    return _fallbackLoad(COMENTARIOS_LOCAL_KEY, {});
  } catch {
    return _fallbackLoad(COMENTARIOS_LOCAL_KEY, {});
  }
}

async function dbComentarioAdd(mes, texto) {
  const map = JSON.parse(localStorage.getItem(COMENTARIOS_LOCAL_KEY) || '{}');
  const email = await _getUserEmail();
  const entry = {
    id: Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    texto: texto.trim(),
    user: email || 'desconhecido',
    ts: new Date().toISOString()
  };
  if (!map[mes]) map[mes] = [];
  map[mes].push(entry);
  localStorage.setItem(COMENTARIOS_LOCAL_KEY, JSON.stringify(map));
  if (sbClient) {
    try {
      await sbClient.from('comentarios').insert({
        mes,
        texto: texto.trim(),
        user_email: email || ''
      });
    } catch (e) { console.error('[db-extra]', e); }
  }
  return entry;
}

async function dbComentarioDel(mes, id) {
  const map = JSON.parse(localStorage.getItem(COMENTARIOS_LOCAL_KEY) || '{}');
  if (map[mes]) {
    map[mes] = map[mes].filter(c => c.id !== id);
    if (!map[mes].length) delete map[mes];
    localStorage.setItem(COMENTARIOS_LOCAL_KEY, JSON.stringify(map));
  }
  if (sbClient) {
    try {
      await sbClient.from('comentarios').delete().eq('id', id);
    } catch {
      try {
        await sbClient.from('comentarios').delete().filter('id', 'eq', id);
      } catch (e) { console.error('[db-extra]', e); }
    }
  }
}

// ─── HISTÓRICO ───────────────────────────────────────────────────

const HISTORICO_LOCAL_KEY = 'sistema_historico_v1';

async function dbHistoricoLoad() {
  if (!sbClient) return _fallbackLoad(HISTORICO_LOCAL_KEY, []);
  try {
    const { data } = await sbClient.from('historico').select('*').order('created_at', { ascending: false }).limit(500);
    if (data && Array.isArray(data) && data.length > 0) {
      const log = data.map(r => ({
        ts: r.created_at,
        user: r.user_email || '',
        action: r.action,
        colaborador: r.colaborador,
        mes: r.mes,
        campo: r.campo,
        before: r.before_value,
        after: r.after_value,
        detalhes: r.detalhes
      }));
      localStorage.setItem(HISTORICO_LOCAL_KEY, JSON.stringify(log));
      return log;
    }
    return _fallbackLoad(HISTORICO_LOCAL_KEY, []);
  } catch {
    return _fallbackLoad(HISTORICO_LOCAL_KEY, []);
  }
}

async function dbHistoricoAdd(entry) {
  const log = JSON.parse(localStorage.getItem(HISTORICO_LOCAL_KEY) || '[]');
  const email = await _getUserEmail();
  const enriched = {
    ts: entry.ts || new Date().toISOString(),
    user: entry.user || email || '',
    action: entry.action || '',
    colaborador: entry.colaborador || '',
    mes: entry.mes || '',
    campo: entry.campo || '',
    before: entry.before || '',
    after: entry.after || '',
    detalhes: entry.detalhes || ''
  };
  log.push(enriched);
  if (log.length > 500) log.splice(0, log.length - 500);
  localStorage.setItem(HISTORICO_LOCAL_KEY, JSON.stringify(log));
  if (sbClient) {
    try {
      await sbClient.from('historico').insert({
        action: enriched.action,
        colaborador: enriched.colaborador,
        mes: enriched.mes,
        campo: enriched.campo,
        before_value: enriched.before,
        after_value: enriched.after,
        detalhes: enriched.detalhes,
        user_email: email || ''
      });
    } catch (e) { console.error('[db-extra]', e); }
  }
}

// ─── SCORING RULES ───────────────────────────────────────────────

const SCORING_LOCAL_KEY = 'sistema_scoring_rules_v1';

async function dbScoringLoad() {
  if (!sbClient) return null;
  try {
    const uid = await _getUserId();
    if (!uid) return null;
    const { data } = await sbClient.from('scoring_config').select('rules').eq('user_id', uid).maybeSingle();
    if (data?.rules && Array.isArray(data.rules)) {
      localStorage.setItem(SCORING_LOCAL_KEY, JSON.stringify(data.rules));
      return data.rules;
    }
    return null;
  } catch { return null; }
}

async function dbScoringSave(rules) {
  if (!requireAdmin()) return;
  localStorage.setItem(SCORING_LOCAL_KEY, JSON.stringify(rules));
  if (!sbClient) return;
  try {
    const uid = await _getUserId();
    if (!uid) return;
    const existing = await sbClient.from('scoring_config').select('id').eq('user_id', uid).maybeSingle();
    if (existing?.data?.id) {
      await sbClient.from('scoring_config').update({ rules, updated_at: new Date().toISOString() }).eq('user_id', uid);
    } else {
      await sbClient.from('scoring_config').insert({ user_id: uid, rules });
    }
  } catch (e) { console.error('[db-extra]', e); }
}

// ─── ALERTAS CONFIG ──────────────────────────────────────────────

const ALERTAS_LOCAL_KEY = 'sistema_alertas_config_v1';

async function dbAlertasLoad() {
  if (!sbClient) return null;
  try {
    const uid = await _getUserId();
    if (!uid) return null;
    const { data } = await sbClient.from('alertas_config').select('config').eq('user_id', uid).maybeSingle();
    if (data?.config && Array.isArray(data.config)) {
      localStorage.setItem(ALERTAS_LOCAL_KEY, JSON.stringify(data.config));
      return data.config;
    }
    return null;
  } catch { return null; }
}

async function dbAlertasSave(config) {
  if (!requireAdmin()) return;
  localStorage.setItem(ALERTAS_LOCAL_KEY, JSON.stringify(config));
  if (!sbClient) return;
  try {
    const uid = await _getUserId();
    if (!uid) return;
    const existing = await sbClient.from('alertas_config').select('id').eq('user_id', uid).maybeSingle();
    if (existing?.data?.id) {
      await sbClient.from('alertas_config').update({ config, updated_at: new Date().toISOString() }).eq('user_id', uid);
    } else {
      await sbClient.from('alertas_config').insert({ user_id: uid, config });
    }
  } catch (e) { console.error('[db-extra]', e); }
}

// ─── FOTOS ───────────────────────────────────────────────────────

const FOTOS_LOCAL_KEY = 'sistema_colab_fotos_v1';

async function dbFotosLoad() {
  if (!sbClient) return _fallbackLoad(FOTOS_LOCAL_KEY, {});
  try {
    const { data } = await sbClient.from('colaborador_fotos').select('*');
    if (data && Array.isArray(data) && data.length > 0) {
      const map = {};
      data.forEach(f => { map[f.nome] = f.foto_url || ''; });
      localStorage.setItem(FOTOS_LOCAL_KEY, JSON.stringify(map));
      return map;
    }
    return _fallbackLoad(FOTOS_LOCAL_KEY, {});
  } catch {
    return _fallbackLoad(FOTOS_LOCAL_KEY, {});
  }
}

async function dbFotoSave(nome, url) {
  if (!requireAdmin()) return;
  const map = JSON.parse(localStorage.getItem(FOTOS_LOCAL_KEY) || '{}');
  if (url) map[nome] = url;
  else delete map[nome];
  localStorage.setItem(FOTOS_LOCAL_KEY, JSON.stringify(map));
  if (!sbClient) return;
  try {
    const existing = await sbClient.from('colaborador_fotos').select('id').eq('nome', nome).maybeSingle();
    if (existing?.data?.id) {
      if (url) {
        await sbClient.from('colaborador_fotos').update({ foto_url: url, updated_at: new Date().toISOString() }).eq('nome', nome);
      } else {
        await sbClient.from('colaborador_fotos').delete().eq('nome', nome);
      }
    } else if (url) {
      await sbClient.from('colaborador_fotos').insert({ nome, foto_url: url });
    }
  } catch (e) { console.error('[db-extra]', e); }
}

// ─── COLABORADORES INATIVOS ──────────────────────────────────────

const INATIVOS_LOCAL_KEY = 'sistema_inactive_colabs_v1';

async function dbInativosLoad() {
  if (!sbClient) return null;
  try {
    const uid = await _getUserId();
    if (!uid) return null;
    const { data } = await sbClient.from('colab_inativos').select('nome').eq('user_id', uid);
    if (data && Array.isArray(data) && data.length > 0) {
      const names = data.map(r => r.nome);
      localStorage.setItem(INATIVOS_LOCAL_KEY, JSON.stringify(names));
      if (typeof window.__inactiveColabs !== 'undefined') {
        window.__inactiveColabs = new Set(names);
      }
      return new Set(names);
    }
    return null;
  } catch { return null; }
}

async function dbInativosSave(names) {
  if (!requireAdmin()) return;
  const arr = [...names];
  localStorage.setItem(INATIVOS_LOCAL_KEY, JSON.stringify(arr));
  if (!sbClient) return;
  try {
    const uid = await _getUserId();
    if (!uid) return;
    await sbClient.from('colab_inativos').delete().eq('user_id', uid);
    if (arr.length) {
      await sbClient.from('colab_inativos').insert(arr.map(nome => ({ user_id: uid, nome })));
    }
  } catch (e) { console.error('[db-extra]', e); }
}

// ─── SETORES INATIVOS ─────────────────────────────────────────

const INATIVOS_SETORES_LOCAL_KEY = 'sistema_inactive_setores_v1';

async function dbSetorInativosLoad() {
  if (!sbClient) return null;
  try {
    const uid = await _getUserId();
    if (!uid) return null;
    const { data } = await sbClient.from('setor_inativos').select('nome').eq('user_id', uid);
    if (data && Array.isArray(data) && data.length > 0) {
      const names = data.map(r => r.nome);
      localStorage.setItem(INATIVOS_SETORES_LOCAL_KEY, JSON.stringify(names));
      if (typeof window.__inactiveSetores !== 'undefined') {
        names.forEach(n => window.__inactiveSetores.add(n));
      }
      return new Set(names);
    }
    return null;
  } catch { return null; }
}

async function dbSetorInativosSave(names) {
  if (!requireAdmin()) return;
  const arr = [...names];
  localStorage.setItem(INATIVOS_SETORES_LOCAL_KEY, JSON.stringify(arr));
  if (!sbClient) return;
  try {
    const uid = await _getUserId();
    if (!uid) return;
    await sbClient.from('setor_inativos').delete().eq('user_id', uid);
    if (arr.length) {
      await sbClient.from('setor_inativos').insert(arr.map(nome => ({ user_id: uid, nome })));
    }
  } catch (e) { console.error('[db-extra]', e); }
}

// ─── FEEDBACKS ──────────────────────────────────────────────────

const FEEDBACKS_LOCAL_KEY = 'sistema_feedbacks_v1';

async function dbFeedbacksLoad() {
  if (!sbClient) return _fallbackLoad(FEEDBACKS_LOCAL_KEY, []);
  try {
    const uid = await _getUserId();
    if (!uid) return _fallbackLoad(FEEDBACKS_LOCAL_KEY, []);
    const { data } = await sbClient.from('feedbacks').select('*').eq('user_id', uid).order('created_at', { ascending: false });
    if (data && Array.isArray(data) && data.length > 0) {
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
      localStorage.setItem(FEEDBACKS_LOCAL_KEY, JSON.stringify(list));
      return list;
    }
    return _fallbackLoad(FEEDBACKS_LOCAL_KEY, []);
  } catch {
    return _fallbackLoad(FEEDBACKS_LOCAL_KEY, []);
  }
}

async function dbFeedbacksSave(feedback) {
  const list = JSON.parse(localStorage.getItem(FEEDBACKS_LOCAL_KEY) || '[]');
  const idx = list.findIndex(f => f.id === feedback.id);
  if (idx >= 0) list[idx] = feedback;
  else list.unshift(feedback);
  localStorage.setItem(FEEDBACKS_LOCAL_KEY, JSON.stringify(list));
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
  const list = JSON.parse(localStorage.getItem(FEEDBACKS_LOCAL_KEY) || '[]');
  const filtered = list.filter(f => f.id !== id);
  localStorage.setItem(FEEDBACKS_LOCAL_KEY, JSON.stringify(filtered));
  if (!sbClient) return;
  try {
    await sbClient.from('feedbacks').delete().eq('id', id);
  } catch (e) { console.error('[db-extra]', e); }
}

// ─── ANOTAÇÕES DIÁRIAS ──────────────────────────────────────────

const ANOTACOES_LOCAL_KEY = 'sistema_anotacoes_diarias_v1';

async function dbAnotacoesLoad() {
  if (!sbClient) return _fallbackLoad(ANOTACOES_LOCAL_KEY, []);
  try {
    const uid = await _getUserId();
    if (!uid) return _fallbackLoad(ANOTACOES_LOCAL_KEY, []);
    const { data } = await sbClient.from('anotacoes_diarias').select('*').eq('user_id', uid).order('data', { ascending: false });
    if (data && Array.isArray(data) && data.length > 0) {
      const list = data.map(r => ({
        id: r.id,
        data: r.data,
        conteudo: r.conteudo || '',
        createdAt: r.created_at,
        updatedAt: r.updated_at
      }));
      localStorage.setItem(ANOTACOES_LOCAL_KEY, JSON.stringify(list));
      return list;
    }
    return _fallbackLoad(ANOTACOES_LOCAL_KEY, []);
  } catch {
    return _fallbackLoad(ANOTACOES_LOCAL_KEY, []);
  }
}

async function dbAnotacoesSave(anotacao) {
  const list = JSON.parse(localStorage.getItem(ANOTACOES_LOCAL_KEY) || '[]');
  const idx = list.findIndex(a => a.id === anotacao.id);
  if (idx >= 0) list[idx] = anotacao;
  else list.unshift(anotacao);
  localStorage.setItem(ANOTACOES_LOCAL_KEY, JSON.stringify(list));
  if (!sbClient) return;
  try {
    const uid = await _getUserId();
    if (!uid) return;
    const existing = await sbClient.from('anotacoes_diarias').select('id').eq('id', anotacao.id).maybeSingle();
    if (existing?.data?.id) {
      await sbClient.from('anotacoes_diarias').update({
        data: anotacao.data,
        conteudo: anotacao.conteudo || '',
        updated_at: new Date().toISOString()
      }).eq('id', anotacao.id);
    } else {
      await sbClient.from('anotacoes_diarias').insert({
        user_id: uid,
        data: anotacao.data,
        conteudo: anotacao.conteudo || ''
      });
    }
  } catch (e) { console.error('[db-extra]', e); }
}

async function dbAnotacoesDelete(id) {
  const list = JSON.parse(localStorage.getItem(ANOTACOES_LOCAL_KEY) || '[]');
  const filtered = list.filter(a => a.id !== id);
  localStorage.setItem(ANOTACOES_LOCAL_KEY, JSON.stringify(filtered));
  if (!sbClient) return;
  try {
    await sbClient.from('anotacoes_diarias').delete().eq('id', id);
  } catch (e) { console.error('[db-extra]', e); }
}

// ─── TAREFAS / AGENDA ───────────────────────────────────────────

const TAREFAS_LOCAL_KEY = 'sistema_tarefas_v1';

async function dbTarefasLoad() {
  if (!sbClient) return _fallbackLoad(TAREFAS_LOCAL_KEY, []);
  try {
    const uid = await _getUserId();
    if (!uid) return _fallbackLoad(TAREFAS_LOCAL_KEY, []);
    const { data } = await sbClient.from('tarefas').select('*').eq('user_id', uid).order('data', { ascending: false });
    if (data && Array.isArray(data) && data.length > 0) {
      const list = data.map(r => ({
        id: r.id,
        titulo: r.titulo,
        descricao: r.descricao || '',
        data: r.data,
        prioridade: r.prioridade,
        status: r.status,
        createdAt: r.created_at,
        updatedAt: r.updated_at
      }));
      localStorage.setItem(TAREFAS_LOCAL_KEY, JSON.stringify(list));
      return list;
    }
    return _fallbackLoad(TAREFAS_LOCAL_KEY, []);
  } catch {
    return _fallbackLoad(TAREFAS_LOCAL_KEY, []);
  }
}

async function dbTarefasSave(tarefa) {
  const list = JSON.parse(localStorage.getItem(TAREFAS_LOCAL_KEY) || '[]');
  const idx = list.findIndex(t => t.id === tarefa.id);
  if (idx >= 0) list[idx] = tarefa;
  else list.unshift(tarefa);
  localStorage.setItem(TAREFAS_LOCAL_KEY, JSON.stringify(list));
  if (!sbClient) return;
  try {
    const uid = await _getUserId();
    if (!uid) return;
    const existing = await sbClient.from('tarefas').select('id').eq('id', tarefa.id).maybeSingle();
    if (existing?.data?.id) {
      await sbClient.from('tarefas').update({
        titulo: tarefa.titulo,
        descricao: tarefa.descricao || '',
        data: tarefa.data,
        prioridade: tarefa.prioridade,
        status: tarefa.status,
        updated_at: new Date().toISOString()
      }).eq('id', tarefa.id);
    } else {
      await sbClient.from('tarefas').insert({
        user_id: uid,
        titulo: tarefa.titulo,
        descricao: tarefa.descricao || '',
        data: tarefa.data,
        prioridade: tarefa.prioridade,
        status: tarefa.status || 'pendente'
      });
    }
  } catch (e) { console.error('[db-extra]', e); }
}

async function dbTarefasDelete(id) {
  const list = JSON.parse(localStorage.getItem(TAREFAS_LOCAL_KEY) || '[]');
  const filtered = list.filter(t => t.id !== id);
  localStorage.setItem(TAREFAS_LOCAL_KEY, JSON.stringify(filtered));
  if (!sbClient) return;
  try {
    await sbClient.from('tarefas').delete().eq('id', id);
  } catch (e) { console.error('[db-extra]', e); }
}

// ─── PONTOS EXTRAS (Bônus Manuais) ──────────────────────────────

const PONTOS_EXTRAS_LOCAL_KEY = 'sistema_pontos_extras_v1';

async function dbPontosExtrasLoad() {
  if (!sbClient) return _fallbackLoad(PONTOS_EXTRAS_LOCAL_KEY, []);
  try {
    const uid = await _getUserId();
    if (!uid) return _fallbackLoad(PONTOS_EXTRAS_LOCAL_KEY, []);
    const { data } = await sbClient.from('pontos_extras').select('*').eq('user_id', uid).order('created_at', { ascending: false });
    if (data && Array.isArray(data) && data.length > 0) {
      const list = data.map(r => ({
        id: r.id,
        colaborador: r.colaborador,
        descricao: r.descricao || '',
        pontos: parseFloat(r.pontos) || 0,
        createdAt: r.created_at,
        updatedAt: r.updated_at
      }));
      localStorage.setItem(PONTOS_EXTRAS_LOCAL_KEY, JSON.stringify(list));
      return list;
    }
    return _fallbackLoad(PONTOS_EXTRAS_LOCAL_KEY, []);
  } catch {
    return _fallbackLoad(PONTOS_EXTRAS_LOCAL_KEY, []);
  }
}

async function dbPontosExtrasSave(bonus) {
  const list = JSON.parse(localStorage.getItem(PONTOS_EXTRAS_LOCAL_KEY) || '[]');
  const idx = list.findIndex(b => b.id === bonus.id);
  if (idx >= 0) list[idx] = bonus;
  else list.unshift(bonus);
  localStorage.setItem(PONTOS_EXTRAS_LOCAL_KEY, JSON.stringify(list));
  if (!sbClient) return;
  try {
    const uid = await _getUserId();
    if (!uid) return;
    const existing = await sbClient.from('pontos_extras').select('id').eq('id', bonus.id).maybeSingle();
    if (existing?.data?.id) {
      await sbClient.from('pontos_extras').update({
        colaborador: bonus.colaborador,
        descricao: bonus.descricao || '',
        pontos: parseFloat(bonus.pontos) || 0,
        mes: bonus.mes || '',
        updated_at: new Date().toISOString()
      }).eq('id', bonus.id);
    } else {
      await sbClient.from('pontos_extras').insert({
        user_id: uid,
        colaborador: bonus.colaborador,
        descricao: bonus.descricao || '',
        pontos: parseFloat(bonus.pontos) || 0,
        mes: bonus.mes || ''
      });
    }
  } catch (e) { console.error('[db-extra]', e); }
}

async function dbPontosExtrasDelete(id) {
  const list = JSON.parse(localStorage.getItem(PONTOS_EXTRAS_LOCAL_KEY) || '[]');
  const filtered = list.filter(b => b.id !== id);
  localStorage.setItem(PONTOS_EXTRAS_LOCAL_KEY, JSON.stringify(filtered));
  if (!sbClient) return;
  try {
    await sbClient.from('pontos_extras').delete().eq('id', id);
  } catch (e) { console.error('[db-extra]', e); }
}

// ─── AUSÊNCIAS (Controle de Ponto) ─────────────────────────────

const AUSENCIAS_LOCAL_KEY = 'sistema_ausencias_v1';

async function dbAusenciasLoad() {
  if (!sbClient) return _fallbackLoad(AUSENCIAS_LOCAL_KEY, []);
  try {
    const uid = await _getUserId();
    if (!uid) return _fallbackLoad(AUSENCIAS_LOCAL_KEY, []);
    const { data } = await sbClient.from('ausencias').select('*').eq('user_id', uid).order('data', { ascending: false });
    if (data && Array.isArray(data) && data.length > 0) {
      const list = data.map(r => ({
        id: r.id,
        colaborador: r.colaborador,
        data: r.data,
        periodo: r.periodo,
        motivo: r.motivo || '',
        createdAt: r.created_at,
        updatedAt: r.updated_at
      }));
      localStorage.setItem(AUSENCIAS_LOCAL_KEY, JSON.stringify(list));
      return list;
    }
    return _fallbackLoad(AUSENCIAS_LOCAL_KEY, []);
  } catch {
    return _fallbackLoad(AUSENCIAS_LOCAL_KEY, []);
  }
}

async function dbAusenciasSave(ausencia) {
  const list = JSON.parse(localStorage.getItem(AUSENCIAS_LOCAL_KEY) || '[]');
  const idx = list.findIndex(a => a.id === ausencia.id);
  if (idx >= 0) list[idx] = ausencia;
  else list.unshift(ausencia);
  localStorage.setItem(AUSENCIAS_LOCAL_KEY, JSON.stringify(list));
  if (!sbClient) return;
  try {
    const uid = await _getUserId();
    if (!uid) return;
    const existing = await sbClient.from('ausencias').select('id').eq('id', ausencia.id).maybeSingle();
    if (existing?.data?.id) {
      await sbClient.from('ausencias').update({
        colaborador: ausencia.colaborador,
        data: ausencia.data,
        periodo: ausencia.periodo,
        motivo: ausencia.motivo || '',
        updated_at: new Date().toISOString()
      }).eq('id', ausencia.id);
    } else {
      await sbClient.from('ausencias').insert({
        user_id: uid,
        colaborador: ausencia.colaborador,
        data: ausencia.data,
        periodo: ausencia.periodo,
        motivo: ausencia.motivo || ''
      });
    }
  } catch (e) { console.error('[db-extra]', e); }
}

async function dbAusenciasDelete(id) {
  const list = JSON.parse(localStorage.getItem(AUSENCIAS_LOCAL_KEY) || '[]');
  const filtered = list.filter(a => a.id !== id);
  localStorage.setItem(AUSENCIAS_LOCAL_KEY, JSON.stringify(filtered));
  if (!sbClient) return;
  try {
    await sbClient.from('ausencias').delete().eq('id', id);
  } catch (e) { console.error('[db-extra]', e); }
}

// ─── AVALIAÇÃO DE ATENDIMENTOS ─────────────────────────────

const AVALIACAO_ATEND_LOCAL_KEY = 'sistema_avaliacao_atendimentos_v1';

async function dbAvaliacaoAtendLoad() {
  if (!sbClient) return _fallbackLoad(AVALIACAO_ATEND_LOCAL_KEY, []);
  try {
    const uid = await _getUserId();
    if (!uid) return _fallbackLoad(AVALIACAO_ATEND_LOCAL_KEY, []);
    const { data } = await sbClient.from('avaliacao_atendimentos').select('*').eq('user_id', uid).order('created_at', { ascending: false });
    if (data && Array.isArray(data) && data.length > 0) {
      const list = data.map(r => ({
        id: r.id,
        protocolo: r.protocolo,
        colaborador: r.colaborador,
        nota: r.nota,
        justa: r.justa,
        resumo: r.resumo || '',
        imagem: r.imagem || '',
        createdAt: r.created_at,
        updatedAt: r.updated_at
      }));
      localStorage.setItem(AVALIACAO_ATEND_LOCAL_KEY, JSON.stringify(list));
      return list;
    }
    return _fallbackLoad(AVALIACAO_ATEND_LOCAL_KEY, []);
  } catch {
    return _fallbackLoad(AVALIACAO_ATEND_LOCAL_KEY, []);
  }
}

async function dbAvaliacaoAtendSave(item) {
  const list = JSON.parse(localStorage.getItem(AVALIACAO_ATEND_LOCAL_KEY) || '[]');
  const idx = list.findIndex(a => a.id === item.id);
  if (idx >= 0) list[idx] = item;
  else list.unshift(item);
  localStorage.setItem(AVALIACAO_ATEND_LOCAL_KEY, JSON.stringify(list));
  if (!sbClient) return;
  try {
    const uid = await _getUserId();
    if (!uid) return;
    const existing = await sbClient.from('avaliacao_atendimentos').select('id').eq('id', item.id).maybeSingle();
    if (existing?.data?.id) {
      await sbClient.from('avaliacao_atendimentos').update({
        protocolo: item.protocolo,
        colaborador: item.colaborador,
        nota: item.nota,
        justa: item.justa,
        resumo: item.resumo || '',
        imagem: item.imagem || '',
        updated_at: new Date().toISOString()
      }).eq('id', item.id);
    } else {
      await sbClient.from('avaliacao_atendimentos').insert({
        user_id: uid,
        protocolo: item.protocolo,
        colaborador: item.colaborador,
        nota: item.nota,
        justa: item.justa,
        resumo: item.resumo || '',
        imagem: item.imagem || ''
      });
    }
  } catch (e) { console.error('[db-extra]', e); }
}

async function dbAvaliacaoAtendDelete(id) {
  const list = JSON.parse(localStorage.getItem(AVALIACAO_ATEND_LOCAL_KEY) || '[]');
  const filtered = list.filter(a => a.id !== id);
  localStorage.setItem(AVALIACAO_ATEND_LOCAL_KEY, JSON.stringify(filtered));
  if (!sbClient) return;
  try {
    await sbClient.from('avaliacao_atendimentos').delete().eq('id', id);
  } catch (e) { console.error('[db-extra]', e); }
}

// ─── FÉRIAS ────────────────────────────────────────────────

const FERIAS_LOCAL_KEY = 'sistema_ferias_v1';

async function dbFeriasLoad() {
  if (!sbClient) return _fallbackLoad(FERIAS_LOCAL_KEY, []);
  try {
    const uid = await _getUserId();
    if (!uid) return _fallbackLoad(FERIAS_LOCAL_KEY, []);
    const { data } = await sbClient.from('ferias').select('*').eq('user_id', uid).order('data_inicio', { ascending: false });
    if (data && Array.isArray(data) && data.length > 0) {
      const list = data.map(r => ({
        id: r.id,
        colaborador: r.colaborador,
        data_inicio: r.data_inicio,
        data_fim: r.data_fim,
        createdAt: r.created_at,
        updatedAt: r.updated_at
      }));
      localStorage.setItem(FERIAS_LOCAL_KEY, JSON.stringify(list));
      return list;
    }
    return _fallbackLoad(FERIAS_LOCAL_KEY, []);
  } catch {
    return _fallbackLoad(FERIAS_LOCAL_KEY, []);
  }
}

async function dbFeriasSave(item) {
  const list = JSON.parse(localStorage.getItem(FERIAS_LOCAL_KEY) || '[]');
  const idx = list.findIndex(f => f.id === item.id);
  if (idx >= 0) list[idx] = item;
  else list.unshift(item);
  localStorage.setItem(FERIAS_LOCAL_KEY, JSON.stringify(list));
  if (!sbClient) return;
  try {
    const uid = await _getUserId();
    if (!uid) return;
    const existing = await sbClient.from('ferias').select('id').eq('id', item.id).maybeSingle();
    if (existing?.data?.id) {
      await sbClient.from('ferias').update({
        colaborador: item.colaborador,
        data_inicio: item.data_inicio,
        data_fim: item.data_fim,
        updated_at: new Date().toISOString()
      }).eq('id', item.id);
    } else {
      await sbClient.from('ferias').insert({
        user_id: uid,
        colaborador: item.colaborador,
        data_inicio: item.data_inicio,
        data_fim: item.data_fim
      });
    }
  } catch (e) { console.error('[db-extra]', e); }
}

async function dbFeriasDelete(id) {
  const list = JSON.parse(localStorage.getItem(FERIAS_LOCAL_KEY) || '[]');
  const filtered = list.filter(f => f.id !== id);
  localStorage.setItem(FERIAS_LOCAL_KEY, JSON.stringify(filtered));
  if (!sbClient) return;
  try {
    await sbClient.from('ferias').delete().eq('id', id);
  } catch (e) { console.error('[db-extra]', e); }
}

// ─── ACOMPANHAMENTO DIÁRIO ─────────────────────────────

const ACOMP_DIARIO_LOCAL_KEY = 'sistema_acompanhamento_diario_v1';

async function dbAcompDiarioLoad() {
  if (!sbClient) return _fallbackLoad(ACOMP_DIARIO_LOCAL_KEY, []);
  try {
    const uid = await _getUserId();
    if (!uid) return _fallbackLoad(ACOMP_DIARIO_LOCAL_KEY, []);
    const { data } = await sbClient.from('acompanhamento_diario').select('*').eq('user_id', uid).order('data', { ascending: false });
    if (data && Array.isArray(data) && data.length > 0) {
      const list = data.map(r => ({
        id: r.id,
        colaborador: r.colaborador,
        data: r.data,
        setor: r.setor || '',
        assumidos: r.assumidos || 0,
        transferidos: r.transferidos || 0,
        finalizados: r.finalizados || 0,
        nota: r.nota || 0,
        createdAt: r.created_at,
        updatedAt: r.updated_at
      }));
      localStorage.setItem(ACOMP_DIARIO_LOCAL_KEY, JSON.stringify(list));
      return list;
    }
    return _fallbackLoad(ACOMP_DIARIO_LOCAL_KEY, []);
  } catch {
    return _fallbackLoad(ACOMP_DIARIO_LOCAL_KEY, []);
  }
}

async function dbAcompDiarioSave(item) {
  const list = JSON.parse(localStorage.getItem(ACOMP_DIARIO_LOCAL_KEY) || '[]');
  const idx = list.findIndex(a => a.id === item.id);
  if (idx >= 0) list[idx] = item;
  else list.unshift(item);
  localStorage.setItem(ACOMP_DIARIO_LOCAL_KEY, JSON.stringify(list));
  if (!sbClient) return;
  try {
    const uid = await _getUserId();
    if (!uid) return;
    const existing = await sbClient.from('acompanhamento_diario').select('id').eq('id', item.id).maybeSingle();
    if (existing?.data?.id) {
      await sbClient.from('acompanhamento_diario').update({
        colaborador: item.colaborador,
        data: item.data,
        setor: item.setor || '',
        assumidos: item.assumidos || 0,
        transferidos: item.transferidos || 0,
        finalizados: item.finalizados || 0,
        nota: item.nota || 0,
        updated_at: new Date().toISOString()
      }).eq('id', item.id);
    } else {
      await sbClient.from('acompanhamento_diario').insert({
        user_id: uid,
        colaborador: item.colaborador,
        data: item.data,
        setor: item.setor || '',
        assumidos: item.assumidos || 0,
        transferidos: item.transferidos || 0,
        finalizados: item.finalizados || 0,
        nota: item.nota || 0
      });
    }
  } catch (e) { console.error('[db-extra]', e); }
}

async function dbAcompDiarioDelete(id) {
  const list = JSON.parse(localStorage.getItem(ACOMP_DIARIO_LOCAL_KEY) || '[]');
  const filtered = list.filter(a => a.id !== id);
  localStorage.setItem(ACOMP_DIARIO_LOCAL_KEY, JSON.stringify(filtered));
  if (!sbClient) return;
  try {
    await sbClient.from('acompanhamento_diario').delete().eq('id', id);
  } catch (e) { console.error('[db-extra]', e); }
}

// ─── COLABORADORES INFO (Cadastro) ─────────────────────────────

const COLAB_INFO_LOCAL_KEY = 'sistema_colaboradores_info_v1';

async function dbColabInfoLoad() {
  if (!sbClient) return _fallbackLoad(COLAB_INFO_LOCAL_KEY, {});
  try {
    const uid = await _getUserId();
    if (!uid) return _fallbackLoad(COLAB_INFO_LOCAL_KEY, {});
    const { data } = await sbClient.from('colaboradores_info').select('*').eq('user_id', uid);
    if (data && Array.isArray(data) && data.length > 0) {
      const map = {};
      data.forEach(r => {
        map[r.nome] = {
          id: r.id,
          data_aniversario: r.data_aniversario || '',
          data_admissao: r.data_admissao || '',
          email: r.email || '',
          tarefas_desempenhadas: r.tarefas_desempenhadas || '',
          objetivos_futuros: r.objetivos_futuros || '',
          observacoes: r.observacoes || '',
          conduta_negativa: r.conduta_negativa || '',
          conduta_motivo: r.conduta_motivo || '',
          nivel: r.nivel || '',
          updatedAt: r.updated_at
        };
      });
      localStorage.setItem(COLAB_INFO_LOCAL_KEY, JSON.stringify(map));
      return map;
    }
    return _fallbackLoad(COLAB_INFO_LOCAL_KEY, {});
  } catch {
    return _fallbackLoad(COLAB_INFO_LOCAL_KEY, {});
  }
}

async function dbColabInfoSave(nome, data) {
  if (!requireAdmin()) return;
  const map = JSON.parse(localStorage.getItem(COLAB_INFO_LOCAL_KEY) || '{}');
  map[nome] = { ...(map[nome] || {}), ...data, updatedAt: new Date().toISOString() };
  localStorage.setItem(COLAB_INFO_LOCAL_KEY, JSON.stringify(map));
  if (!sbClient) return;
  try {
    const uid = await _getUserId();
    if (!uid) return;
    const existing = await sbClient.from('colaboradores_info').select('id').eq('user_id', uid).eq('nome', nome).maybeSingle();
    if (existing?.data?.id) {
      await sbClient.from('colaboradores_info').update({
        data_aniversario: data.data_aniversario || null,
        data_admissao: data.data_admissao || null,
        email: data.email || '',
        tarefas_desempenhadas: data.tarefas_desempenhadas || '',
        objetivos_futuros: data.objetivos_futuros || '',
        observacoes: data.observacoes || '',
        conduta_negativa: data.conduta_negativa || '',
        conduta_motivo: data.conduta_motivo || '',
        nivel: data.nivel || '',
        updated_at: new Date().toISOString()
      }).eq('id', existing.data.id);
    } else {
      await sbClient.from('colaboradores_info').insert({
        user_id: uid,
        nome,
        data_aniversario: data.data_aniversario || null,
        data_admissao: data.data_admissao || null,
        email: data.email || '',
        tarefas_desempenhadas: data.tarefas_desempenhadas || '',
        objetivos_futuros: data.objetivos_futuros || '',
        observacoes: data.observacoes || '',
        conduta_negativa: data.conduta_negativa || '',
        conduta_motivo: data.conduta_motivo || '',
        nivel: data.nivel || ''
      });
    }
  } catch (e) { console.error('[db-extra]', e); }
}

// ─── FALLBACK ────────────────────────────────────────────────────

function _fallbackLoad(key, defaultVal) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : defaultVal;
  } catch { return defaultVal; }
}

// ─── MIGRAÇÃO ÚNICA localStorage → Supabase ──────────────────────
// Executa uma vez para migrar dados antigos que estão apenas no localStorage
const MIGRATION_FLAG_KEY = 'sistema_migrated_to_supabase_v1';

async function migrateLocalToSupabase() {
  if (!sbClient) return;
  try {
    if (localStorage.getItem(MIGRATION_FLAG_KEY)) return;
    const uid = await _getUserId();
    if (!uid) return;

    // Metas
    const metasRaw = localStorage.getItem(METAS_LOCAL_KEY);
    if (metasRaw) {
      const metas = JSON.parse(metasRaw);
      if (Array.isArray(metas) && metas.length > 0) {
        const { data: existing } = await sbClient.from('metas').select('id').eq('user_id', uid).limit(1);
        if (!existing || existing.length === 0) {
          await dbMetasSave(metas);
        }
      }
    }

    // Comentários
    const comRaw = localStorage.getItem(COMENTARIOS_LOCAL_KEY);
    if (comRaw) {
      const com = JSON.parse(comRaw);
      if (typeof com === 'object' && Object.keys(com).length > 0) {
        const { data: existing } = await sbClient.from('comentarios').select('id').limit(1);
        if (!existing || existing.length === 0) {
          for (const mes of Object.keys(com)) {
            for (const c of com[mes]) {
              await sbClient.from('comentarios').insert({ mes, texto: c.texto, user_email: c.user || '' });
            }
          }
        }
      }
    }

    // Histórico
    const histRaw = localStorage.getItem(HISTORICO_LOCAL_KEY);
    if (histRaw) {
      const hist = JSON.parse(histRaw);
      if (Array.isArray(hist) && hist.length > 0) {
        const { data: existing } = await sbClient.from('historico').select('id').limit(1);
        if (!existing || existing.length === 0) {
          for (const h of hist) {
            await sbClient.from('historico').insert({
              action: h.action || '',
              colaborador: h.colaborador || '',
              mes: h.mes || '',
              campo: h.campo || '',
              before_value: h.before || '',
              after_value: h.after || '',
              detalhes: h.detalhes || '',
              user_email: h.user || ''
            });
          }
        }
      }
    }

    // Scoring rules
    const scoreRaw = localStorage.getItem(SCORING_LOCAL_KEY);
    if (scoreRaw) {
      const rules = JSON.parse(scoreRaw);
      if (Array.isArray(rules) && rules.length > 0) {
        const { data: existing } = await sbClient.from('scoring_config').select('id').eq('user_id', uid).limit(1);
        if (!existing || existing.length === 0) {
          await dbScoringSave(rules);
        }
      }
    }

    // Alertas config
    const alertRaw = localStorage.getItem(ALERTAS_LOCAL_KEY);
    if (alertRaw) {
      const config = JSON.parse(alertRaw);
      if (Array.isArray(config) && config.length > 0) {
        const { data: existing } = await sbClient.from('alertas_config').select('id').eq('user_id', uid).limit(1);
        if (!existing || existing.length === 0) {
          await dbAlertasSave(config);
        }
      }
    }

    // Fotos
    const fotosRaw = localStorage.getItem(FOTOS_LOCAL_KEY);
    if (fotosRaw) {
      const fotos = JSON.parse(fotosRaw);
      if (typeof fotos === 'object' && Object.keys(fotos).length > 0) {
        const { data: existing } = await sbClient.from('colaborador_fotos').select('id').limit(1);
        if (!existing || existing.length === 0) {
          for (const nome of Object.keys(fotos)) {
            if (fotos[nome]) {
              await sbClient.from('colaborador_fotos').insert({ nome, foto_url: fotos[nome] });
            }
          }
        }
      }
    }

    // Inativos
    const inatRaw = localStorage.getItem(INATIVOS_LOCAL_KEY);
    if (inatRaw) {
      const names = JSON.parse(inatRaw);
      if (Array.isArray(names) && names.length > 0) {
        const { data: existing } = await sbClient.from('colab_inativos').select('id').eq('user_id', uid).limit(1);
        if (!existing || existing.length === 0) {
          await dbInativosSave(new Set(names));
        }
      }
    }

    // Setores inativos
    const setorInatRaw = localStorage.getItem(INATIVOS_SETORES_LOCAL_KEY);
    if (setorInatRaw) {
      const names = JSON.parse(setorInatRaw);
      if (Array.isArray(names) && names.length > 0) {
        const { data: existing } = await sbClient.from('setor_inativos').select('id').eq('user_id', uid).limit(1);
        if (!existing || existing.length === 0) {
          await dbSetorInativosSave(new Set(names));
        }
      }
    }

    // Feedbacks
    const fbRaw = localStorage.getItem(FEEDBACKS_LOCAL_KEY);
    if (fbRaw) {
      const fb = JSON.parse(fbRaw);
      if (Array.isArray(fb) && fb.length > 0) {
        const { data: existing } = await sbClient.from('feedbacks').select('id').eq('user_id', uid).limit(1);
        if (!existing || existing.length === 0) {
          for (const f of fb) {
            await sbClient.from('feedbacks').insert({
              user_id: uid,
              colaborador: f.colaborador || '',
              mes: f.mes || '',
              sugestao_automatica: f.sugestao_automatica || '',
              anotacoes: f.anotacoes || '',
              feedback_final: f.feedback_final || ''
            });
          }
        }
      }
    }

    // Anotações diárias
    const anotRaw = localStorage.getItem(ANOTACOES_LOCAL_KEY);
    if (anotRaw) {
      const anot = JSON.parse(anotRaw);
      if (Array.isArray(anot) && anot.length > 0) {
        const { data: existing } = await sbClient.from('anotacoes_diarias').select('id').eq('user_id', uid).limit(1);
        if (!existing || existing.length === 0) {
          for (const a of anot) {
            await sbClient.from('anotacoes_diarias').insert({
              user_id: uid,
              data: a.data || '',
              conteudo: a.conteudo || ''
            });
          }
        }
      }
    }

    // Tarefas
    const tarefasRaw = localStorage.getItem(TAREFAS_LOCAL_KEY);
    if (tarefasRaw) {
      const tarefas = JSON.parse(tarefasRaw);
      if (Array.isArray(tarefas) && tarefas.length > 0) {
        const { data: existing } = await sbClient.from('tarefas').select('id').eq('user_id', uid).limit(1);
        if (!existing || existing.length === 0) {
          for (const t of tarefas) {
            await sbClient.from('tarefas').insert({
              user_id: uid,
              titulo: t.titulo || '',
              descricao: t.descricao || '',
              data: t.data || '',
              prioridade: t.prioridade || 'media',
              status: t.status || 'pendente'
            });
          }
        }
      }
    }

    // Pontos Extras
    const peRaw = localStorage.getItem(PONTOS_EXTRAS_LOCAL_KEY);
    if (peRaw) {
      const pe = JSON.parse(peRaw);
      if (Array.isArray(pe) && pe.length > 0) {
        const { data: existing } = await sbClient.from('pontos_extras').select('id').eq('user_id', uid).limit(1);
        if (!existing || existing.length === 0) {
          for (const b of pe) {
            await sbClient.from('pontos_extras').insert({
              user_id: uid,
              colaborador: b.colaborador || '',
              descricao: b.descricao || '',
              pontos: parseFloat(b.pontos) || 0
            });
          }
        }
      }
    }

    // Colaboradores Info
    const ciRaw = localStorage.getItem(COLAB_INFO_LOCAL_KEY);
    if (ciRaw) {
      const ci = JSON.parse(ciRaw);
      if (typeof ci === 'object' && Object.keys(ci).length > 0) {
        const { data: existing } = await sbClient.from('colaboradores_info').select('id').eq('user_id', uid).limit(1);
        if (!existing || existing.length === 0) {
          for (const [nome, info] of Object.entries(ci)) {
            await sbClient.from('colaboradores_info').insert({
              user_id: uid,
              nome,
              data_aniversario: info.data_aniversario || null,
              data_admissao: info.data_admissao || null,
              email: info.email || '',
              tarefas_desempenhadas: info.tarefas_desempenhadas || '',
              objetivos_futuros: info.objetivos_futuros || '',
              observacoes: info.observacoes || '',
              conduta_negativa: info.conduta_negativa || '',
              conduta_motivo: info.conduta_motivo || '',
              nivel: info.nivel || ''
            });
          }
        }
      }
    }

    // Ausências
    const ausRaw = localStorage.getItem(AUSENCIAS_LOCAL_KEY);
    if (ausRaw) {
      const aus = JSON.parse(ausRaw);
      if (Array.isArray(aus) && aus.length > 0) {
        const { data: existing } = await sbClient.from('ausencias').select('id').eq('user_id', uid).limit(1);
        if (!existing || existing.length === 0) {
          for (const a of aus) {
            await sbClient.from('ausencias').insert({
              user_id: uid,
              colaborador: a.colaborador || '',
              data: a.data || '',
              periodo: a.periodo || 'dia_inteiro',
              motivo: a.motivo || ''
            });
          }
        }
      }
    }

    // Avaliação de Atendimentos
    const avRaw = localStorage.getItem(AVALIACAO_ATEND_LOCAL_KEY);
    if (avRaw) {
      const av = JSON.parse(avRaw);
      if (Array.isArray(av) && av.length > 0) {
        const { data: existing } = await sbClient.from('avaliacao_atendimentos').select('id').eq('user_id', uid).limit(1);
        if (!existing || existing.length === 0) {
          for (const a of av) {
            await sbClient.from('avaliacao_atendimentos').insert({
              user_id: uid,
              protocolo: a.protocolo || '',
              colaborador: a.colaborador || '',
              nota: parseFloat(a.nota) || 5,
              justa: a.justa !== false,
              resumo: a.resumo || '',
              imagem: a.imagem || ''
            });
          }
        }
      }
    }

    // Férias
    const ferRaw = localStorage.getItem(FERIAS_LOCAL_KEY);
    if (ferRaw) {
      const fer = JSON.parse(ferRaw);
      if (Array.isArray(fer) && fer.length > 0) {
        const { data: existing } = await sbClient.from('ferias').select('id').eq('user_id', uid).limit(1);
        if (!existing || existing.length === 0) {
          for (const f of fer) {
            await sbClient.from('ferias').insert({
              user_id: uid,
              colaborador: f.colaborador || '',
              data_inicio: f.data_inicio || '',
              data_fim: f.data_fim || ''
            });
          }
        }
      }
    }

    // Acompanhamento Diário
    const adRaw = localStorage.getItem(ACOMP_DIARIO_LOCAL_KEY);
    if (adRaw) {
      const ad = JSON.parse(adRaw);
      if (Array.isArray(ad) && ad.length > 0) {
        const { data: existing } = await sbClient.from('acompanhamento_diario').select('id').eq('user_id', uid).limit(1);
        if (!existing || existing.length === 0) {
          for (const a of ad) {
            await sbClient.from('acompanhamento_diario').insert({
              user_id: uid,
              colaborador: a.colaborador || '',
              data: a.data || '',
              setor: a.setor || '',
              assumidos: a.assumidos || 0,
              transferidos: a.transferidos || 0,
              finalizados: a.finalizados || 0,
              nota: a.nota || 0
            });
          }
        }
      }
    }

    localStorage.setItem(MIGRATION_FLAG_KEY, '1');
  } catch (e) { console.warn('[db-extra] migrateLocalToSupabase error:', e); }
}

// ─── INIT ────────────────────────────────────────────────────────
// Chamado pelo app.js no DOMContentLoaded para carregar dados do Supabase
async function initDbExtra() {
  if (!sbClient) return;
  try {
    await migrateLocalToSupabase();
    await Promise.allSettled([
      dbMetasLoad(),
      dbComentariosLoad(),
      dbHistoricoLoad(),
      dbScoringLoad(),
      dbAlertasLoad(),
      dbFotosLoad(),
      dbInativosLoad(),
      dbSetorInativosLoad(),
      dbFeedbacksLoad(),
      dbAnotacoesLoad(),
      dbTarefasLoad(),
      dbPontosExtrasLoad(),
      dbColabInfoLoad(),
      typeof dbAvaliacoesLoad === 'function' ? dbAvaliacoesLoad() : Promise.resolve(),
      typeof dbReportesListar === 'function' ? dbReportesListar() : Promise.resolve(),
      dbAusenciasLoad(),
      dbAvaliacaoAtendLoad(),
      dbFeriasLoad(),
      dbAcompDiarioLoad()
    ]);
  } catch (e) { console.error('[db-extra]', e); }
}
