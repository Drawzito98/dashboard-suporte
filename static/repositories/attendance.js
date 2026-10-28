// Persistência de attendance; contratos preservados pelo facade db-extra.js.
(function (root) {
// ─── AUSÊNCIAS (Controle de Ponto) ─────────────────────────────



async function dbAusenciasLoad() {
  if (!sbClient) return _fallbackLoad(AUSENCIAS_LOCAL_KEY, []);
  try {
    const uid = await _getUserId();
    if (!uid) return _fallbackLoad(AUSENCIAS_LOCAL_KEY, []);
    const { data, error } = await sbClient.from('ausencias').select('*').eq('user_id', uid).order('data', { ascending: false });
    if (!error && Array.isArray(data)) {
      const list = data.map(r => ({
        id: r.id,
        colaborador: r.colaborador,
        data: r.data,
        periodo: r.periodo,
        motivo: r.motivo || '',
        createdAt: r.created_at,
        updatedAt: r.updated_at
      }));
      appStorage.setItem(AUSENCIAS_LOCAL_KEY, JSON.stringify(list));
      return list;
    }
    return _fallbackLoad(AUSENCIAS_LOCAL_KEY, []);
  } catch {
    return _fallbackLoad(AUSENCIAS_LOCAL_KEY, []);
  }
}

async function dbAusenciasSave(ausencia) {
  const list = JSON.parse(appStorage.getItem(AUSENCIAS_LOCAL_KEY) || '[]');
  const idx = list.findIndex(a => a.id === ausencia.id);
  if (idx >= 0) list[idx] = ausencia;
  else list.unshift(ausencia);
  appStorage.setItem(AUSENCIAS_LOCAL_KEY, JSON.stringify(list));
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
  const list = JSON.parse(appStorage.getItem(AUSENCIAS_LOCAL_KEY) || '[]');
  const filtered = list.filter(a => a.id !== id);
  appStorage.setItem(AUSENCIAS_LOCAL_KEY, JSON.stringify(filtered));
  if (!sbClient) return;
  try {
    await sbClient.from('ausencias').delete().eq('id', id);
  } catch (e) { console.error('[db-extra]', e); }
}


// ─── AVALIAÇÃO DE ATENDIMENTOS ─────────────────────────────



async function dbAvaliacaoAtendLoad() {
  if (!sbClient) return _fallbackLoad(AVALIACAO_ATEND_LOCAL_KEY, []);
  try {
    const uid = await _getUserId();
    if (!uid) return _fallbackLoad(AVALIACAO_ATEND_LOCAL_KEY, []);
    const { data, error } = await sbClient.from('avaliacao_atendimentos').select('*').eq('user_id', uid).order('created_at', { ascending: false });
    if (!error && Array.isArray(data)) {
      const list = data.map(r => ({
        id: r.id,
        protocolo: r.protocolo,
        colaborador: r.colaborador,
        nota: r.nota,
        teve_nota: r.teve_nota != null ? r.teve_nota : (r.nota != null),
        justa: r.justa,
        resumo: r.resumo || '',
        orientacao: r.orientacao || '',
        data_atendimento: r.data_atendimento || '',
        imagem: r.imagem || '',
        createdAt: r.created_at,
        updatedAt: r.updated_at
      }));
      appStorage.setItem(AVALIACAO_ATEND_LOCAL_KEY, JSON.stringify(list));
      return list;
    }
    return _fallbackLoad(AVALIACAO_ATEND_LOCAL_KEY, []);
  } catch {
    return _fallbackLoad(AVALIACAO_ATEND_LOCAL_KEY, []);
  }
}

async function dbAvaliacaoAtendSave(item) {
  const list = JSON.parse(appStorage.getItem(AVALIACAO_ATEND_LOCAL_KEY) || '[]');
  const idx = list.findIndex(a => a.id === item.id);
  if (idx >= 0) list[idx] = item;
  else list.unshift(item);
  appStorage.setItem(AVALIACAO_ATEND_LOCAL_KEY, JSON.stringify(list));
  if (!sbClient) return;
  try {
    const uid = await _getUserId();
    if (!uid) return;
    const existing = await sbClient.from('avaliacao_atendimentos').select('id').eq('id', item.id).maybeSingle();
    if (existing?.data?.id) {
      await sbClient.from('avaliacao_atendimentos').update({
        protocolo: item.protocolo,
        colaborador: item.colaborador,
        nota: item.teve_nota ? item.nota : null,
        teve_nota: item.teve_nota,
        justa: item.justa,
        resumo: item.resumo || '',
        orientacao: item.orientacao || '',
        data_atendimento: item.data_atendimento || '',
        imagem: item.imagem || '',
        updated_at: new Date().toISOString()
      }).eq('id', item.id);
    } else {
      await sbClient.from('avaliacao_atendimentos').insert({
        user_id: uid,
        protocolo: item.protocolo,
        colaborador: item.colaborador,
        nota: item.teve_nota ? item.nota : null,
        teve_nota: item.teve_nota,
        justa: item.justa,
        resumo: item.resumo || '',
        orientacao: item.orientacao || '',
        data_atendimento: item.data_atendimento || '',
        imagem: item.imagem || ''
      });
    }
  } catch (e) { console.error('[db-extra]', e); }
}

async function dbAvaliacaoAtendDelete(id) {
  const list = JSON.parse(appStorage.getItem(AVALIACAO_ATEND_LOCAL_KEY) || '[]');
  const filtered = list.filter(a => a.id !== id);
  appStorage.setItem(AVALIACAO_ATEND_LOCAL_KEY, JSON.stringify(filtered));
  if (!sbClient) return;
  try {
    await sbClient.from('avaliacao_atendimentos').delete().eq('id', id);
  } catch (e) { console.error('[db-extra]', e); }
}


// ─── FÉRIAS ────────────────────────────────────────────────



function notifyFeriasUpdated() {
  window.dispatchEvent(new Event('ferias-updated'));
}

async function dbFeriasLoad() {
  if (!sbClient) return _fallbackLoad(FERIAS_LOCAL_KEY, []);
  try {
    const uid = await _getUserId();
    if (!uid) return _fallbackLoad(FERIAS_LOCAL_KEY, []);
    const { data, error } = await sbClient.from('ferias').select('*').eq('user_id', uid).order('data_inicio', { ascending: false });
    if (!error && Array.isArray(data)) {
      const list = data.map(r => ({
        id: r.id,
        colaborador: r.colaborador,
        data_inicio: r.data_inicio,
        data_fim: r.data_fim,
        createdAt: r.created_at,
        updatedAt: r.updated_at
      }));
      appStorage.setItem(FERIAS_LOCAL_KEY, JSON.stringify(list));
      notifyFeriasUpdated();
      return list;
    }
    return _fallbackLoad(FERIAS_LOCAL_KEY, []);
  } catch {
    return _fallbackLoad(FERIAS_LOCAL_KEY, []);
  }
}

async function dbFeriasSave(item) {
  const list = JSON.parse(appStorage.getItem(FERIAS_LOCAL_KEY) || '[]');
  const idx = list.findIndex(f => f.id === item.id);
  if (idx >= 0) list[idx] = item;
  else list.unshift(item);
  appStorage.setItem(FERIAS_LOCAL_KEY, JSON.stringify(list));
  notifyFeriasUpdated();
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
  const list = JSON.parse(appStorage.getItem(FERIAS_LOCAL_KEY) || '[]');
  const filtered = list.filter(f => String(f.id) !== String(id));
  appStorage.setItem(FERIAS_LOCAL_KEY, JSON.stringify(filtered));
  notifyFeriasUpdated();
  if (!sbClient) return;
  try {
    await sbClient.from('ferias').delete().eq('id', id);
  } catch (e) { console.error('[db-extra]', e); }
}


// ─── ACOMPANHAMENTO DIÁRIO ─────────────────────────────



async function dbAcompDiarioLoad() {
  if (!sbClient) return _fallbackLoad(ACOMP_DIARIO_LOCAL_KEY, []);
  try {
    const uid = await _getUserId();
    if (!uid) return _fallbackLoad(ACOMP_DIARIO_LOCAL_KEY, []);
    const { data, error } = await sbClient.from('acompanhamento_diario').select('*').eq('user_id', uid).order('data', { ascending: false });
    if (!error && Array.isArray(data)) {
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
      appStorage.setItem(ACOMP_DIARIO_LOCAL_KEY, JSON.stringify(list));
      return list;
    }
    return _fallbackLoad(ACOMP_DIARIO_LOCAL_KEY, []);
  } catch {
    return _fallbackLoad(ACOMP_DIARIO_LOCAL_KEY, []);
  }
}

async function dbAcompDiarioSave(item) {
  const list = JSON.parse(appStorage.getItem(ACOMP_DIARIO_LOCAL_KEY) || '[]');
  const idx = list.findIndex(a => a.id === item.id);
  if (idx >= 0) list[idx] = item;
  else list.unshift(item);
  appStorage.setItem(ACOMP_DIARIO_LOCAL_KEY, JSON.stringify(list));
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
  const list = JSON.parse(appStorage.getItem(ACOMP_DIARIO_LOCAL_KEY) || '[]');
  const filtered = list.filter(a => a.id !== id);
  appStorage.setItem(ACOMP_DIARIO_LOCAL_KEY, JSON.stringify(filtered));
  if (!sbClient) return;
  try {
    await sbClient.from('acompanhamento_diario').delete().eq('id', id);
  } catch (e) { console.error('[db-extra]', e); }
}


  root.AppRepositories = root.AppRepositories || {};
  root.AppRepositories.attendance = { dbAusenciasLoad, dbAusenciasSave, dbAusenciasDelete, dbAvaliacaoAtendLoad, dbAvaliacaoAtendSave, dbAvaliacaoAtendDelete, notifyFeriasUpdated, dbFeriasLoad, dbFeriasSave, dbFeriasDelete, dbAcompDiarioLoad, dbAcompDiarioSave, dbAcompDiarioDelete };
})(window);
