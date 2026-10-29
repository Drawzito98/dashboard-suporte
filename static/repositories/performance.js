// Persistência de performance; contratos preservados pelo facade db-extra.js.
(function (root) {
// ─── METAS ───────────────────────────────────────────────────────



async function dbMetasLoad() {
  const token = AppDataSession.token(), revision = _confirmedRevisions.get('metas');
  if (!sbClient) return _fallbackLoad(METAS_LOCAL_KEY, []);
  try {
    const uid = await _getUserId();
    if (!uid) return _fallbackLoad(METAS_LOCAL_KEY, []);
    const { data, error } = await sbClient.from('metas').select('*').eq('user_id', uid);
    if (!AppDataSession.current(token) || revision !== _confirmedRevisions.get('metas')) return _fallbackLoad(METAS_LOCAL_KEY, []);
    if (!error && Array.isArray(data)) {
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
      appStorage.setItem(METAS_LOCAL_KEY, JSON.stringify(goals));
      return goals;
    }
    return _fallbackLoad(METAS_LOCAL_KEY, []);
  } catch {
    return _fallbackLoad(METAS_LOCAL_KEY, []);
  }
}

// Compatibilidade com arrays legados: somente upsert dos itens enviados, nunca substituição da coleção.
async function dbMetasSave(goals) {
  if (!requireAdmin()) throw new Error('Apenas administradores podem alterar metas.');
  const drafts = goals.map(g => ({ ...g, id: _writeUuid(g.id) }));
  return _confirmedWrite('metas', async ({ uid, request }) => {
    if (!drafts.length) return { status: 'confirmed', data: [] };
    const rows = drafts.map(g => ({
      id: g.id, user_id: uid, created_at: g.createdAt || new Date().toISOString(), title: g.title || 'Meta', type: g.type || 'monthly',
      metric: g.metric || 'finalizados', target: parseFloat(g.target) || 0,
      setor: g.setor || 'all', collaborator: g.collaborator || '', period: g.period || 'all'
    }));
    const saved = await request(() => sbClient.from('metas').upsert(rows, { onConflict: 'id' }).select('*'));
    if (!Array.isArray(saved) || saved.length !== rows.length || rows.some(r => !saved.some(s => s.id === r.id))) {
      throw new Error('Gravação da meta não confirmada. Tente novamente.');
    }
    const confirmed = drafts.map(g => ({ ...g, createdAt: saved.find(s => s.id === g.id).created_at || g.createdAt }));
    const list = _confirmedList(METAS_LOCAL_KEY);
    confirmed.forEach((g, index) => {
      const at = list.findIndex(item => item.id === goals[index].id || item.id === g.id);
      if (at >= 0) list[at] = g; else list.push(g);
    });
    _confirmedCache(METAS_LOCAL_KEY, list);
    return { status: 'confirmed', data: confirmed };
  });
}
async function dbMetasDelete(id) {
  if (!requireAdmin()) throw new Error('Apenas administradores podem alterar metas.');
  return _confirmedWrite('metas', async ({ uid, request }) => {
    const rows = await request(() => sbClient.from('metas').delete().eq('id', id).eq('user_id', uid).select('id'));
    if (!Array.isArray(rows) || !rows.some(row => row.id === id)) throw new Error('Exclusão não confirmada. Atualize a lista e tente novamente.');
    _confirmedCache(METAS_LOCAL_KEY, _confirmedList(METAS_LOCAL_KEY).filter(g => g.id !== id));
    return { status: 'confirmed', id };
  });
}

// ─── SCORING RULES ───────────────────────────────────────────────



async function dbScoringLoad() {
  if (!sbClient) return null;
  try {
    const uid = await _getUserId();
    if (!uid) return null;
    const { data, error } = await sbClient.from('scoring_config').select('rules').eq('user_id', uid).maybeSingle();
    if (!error && data === null) appStorage.removeItem(SCORING_LOCAL_KEY);
    if (!error && data?.rules && Array.isArray(data.rules)) {
      appStorage.setItem(SCORING_LOCAL_KEY, JSON.stringify(data.rules));
      return data.rules;
    }
    return null;
  } catch { return null; }
}

async function dbScoringSave(rules) {
  if (!requireAdmin()) return;
  appStorage.setItem(SCORING_LOCAL_KEY, JSON.stringify(rules));
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



async function dbAlertasLoad() {
  if (!sbClient) return null;
  try {
    const uid = await _getUserId();
    if (!uid) return null;
    const { data, error } = await sbClient.from('alertas_config').select('config').eq('user_id', uid).maybeSingle();
    if (!error && data === null) appStorage.removeItem(ALERTAS_LOCAL_KEY);
    if (!error && data?.config && Array.isArray(data.config)) {
      appStorage.setItem(ALERTAS_LOCAL_KEY, JSON.stringify(data.config));
      return data.config;
    }
    return null;
  } catch { return null; }
}

async function dbAlertasSave(config) {
  if (!requireAdmin()) return;
  appStorage.setItem(ALERTAS_LOCAL_KEY, JSON.stringify(config));
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


// ─── PONTOS EXTRAS (Bônus Manuais) ──────────────────────────────



async function dbPontosExtrasLoad() {
  if (!sbClient) return _fallbackLoad(PONTOS_EXTRAS_LOCAL_KEY, []);
  try {
    const uid = await _getUserId();
    if (!uid) return _fallbackLoad(PONTOS_EXTRAS_LOCAL_KEY, []);
    const { data, error } = await sbClient.from('pontos_extras').select('*').eq('user_id', uid).order('created_at', { ascending: false });
    if (!error && Array.isArray(data)) {
      const list = data.map(r => ({
        id: r.id,
        colaborador: r.colaborador,
        descricao: r.descricao || '',
        pontos: parseFloat(r.pontos) || 0,
        createdAt: r.created_at,
        updatedAt: r.updated_at
      }));
      appStorage.setItem(PONTOS_EXTRAS_LOCAL_KEY, JSON.stringify(list));
      return list;
    }
    return _fallbackLoad(PONTOS_EXTRAS_LOCAL_KEY, []);
  } catch {
    return _fallbackLoad(PONTOS_EXTRAS_LOCAL_KEY, []);
  }
}

async function dbPontosExtrasSave(bonus) {
  const list = JSON.parse(appStorage.getItem(PONTOS_EXTRAS_LOCAL_KEY) || '[]');
  const idx = list.findIndex(b => b.id === bonus.id);
  if (idx >= 0) list[idx] = bonus;
  else list.unshift(bonus);
  appStorage.setItem(PONTOS_EXTRAS_LOCAL_KEY, JSON.stringify(list));
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
  const list = JSON.parse(appStorage.getItem(PONTOS_EXTRAS_LOCAL_KEY) || '[]');
  const filtered = list.filter(b => b.id !== id);
  appStorage.setItem(PONTOS_EXTRAS_LOCAL_KEY, JSON.stringify(filtered));
  if (!sbClient) return;
  try {
    await sbClient.from('pontos_extras').delete().eq('id', id);
  } catch (e) { console.error('[db-extra]', e); }
}


  root.AppRepositories = root.AppRepositories || {};
  root.AppRepositories.performance = { dbMetasLoad, dbMetasSave, dbMetasDelete, dbScoringLoad, dbScoringSave, dbAlertasLoad, dbAlertasSave, dbPontosExtrasLoad, dbPontosExtrasSave, dbPontosExtrasDelete };
})(window);
