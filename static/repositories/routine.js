// Persistência de routine; contratos preservados pelo facade db-extra.js.
(function (root) {
// ─── ANOTAÇÕES DIÁRIAS ──────────────────────────────────────────



async function dbAnotacoesLoad() {
  if (!sbClient) return _fallbackLoad(ANOTACOES_LOCAL_KEY, []);
  try {
    const uid = await _getUserId();
    if (!uid) return _fallbackLoad(ANOTACOES_LOCAL_KEY, []);
    const { data, error } = await sbClient.from('anotacoes_diarias').select('*').eq('user_id', uid).not('conteudo', 'like', 'atividade-colaborador:v1:%').order('data', { ascending: false });
    if (!error && Array.isArray(data)) {
      const list = data.map(r => ({
        id: r.id,
        data: r.data,
        conteudo: r.conteudo || '',
        etiquetas: r.etiquetas || '',
        favorito: Boolean(r.favorito),
        createdAt: r.created_at,
        updatedAt: r.updated_at
      }));
      appStorage.setItem(ANOTACOES_LOCAL_KEY, JSON.stringify(list));
      return list;
    }
    return _fallbackLoad(ANOTACOES_LOCAL_KEY, []);
  } catch {
    return _fallbackLoad(ANOTACOES_LOCAL_KEY, []);
  }
}

async function dbAnotacoesSave(anotacao) {
  const list = JSON.parse(appStorage.getItem(ANOTACOES_LOCAL_KEY) || '[]');
  const idx = list.findIndex(a => a.id === anotacao.id);
  if (idx >= 0) list[idx] = anotacao;
  else list.unshift(anotacao);
  appStorage.setItem(ANOTACOES_LOCAL_KEY, JSON.stringify(list));
  if (!sbClient) return;
  try {
    const uid = await _getUserId();
    if (!uid) return;
    const existing = await sbClient.from('anotacoes_diarias').select('id').eq('id', anotacao.id).maybeSingle();
    if (existing?.data?.id) {
      await sbClient.from('anotacoes_diarias').update({
        data: anotacao.data,
        conteudo: anotacao.conteudo || '',
        etiquetas: anotacao.etiquetas || '',
        favorito: Boolean(anotacao.favorito),
        updated_at: new Date().toISOString()
      }).eq('id', anotacao.id);
    } else {
      await sbClient.from('anotacoes_diarias').insert({
        id: anotacao.id,
        user_id: uid,
        data: anotacao.data,
        conteudo: anotacao.conteudo || '',
        etiquetas: anotacao.etiquetas || '',
        favorito: Boolean(anotacao.favorito)
      });
    }
  } catch (e) { console.error('[db-extra]', e); }
}

async function dbAnotacoesDelete(id) {
  const list = JSON.parse(appStorage.getItem(ANOTACOES_LOCAL_KEY) || '[]');
  const filtered = list.filter(a => a.id !== id);
  appStorage.setItem(ANOTACOES_LOCAL_KEY, JSON.stringify(filtered));
  if (!sbClient) return;
  try {
    await sbClient.from('anotacoes_diarias').delete().eq('id', id);
  } catch (e) { console.error('[db-extra]', e); }
}


// ─── TAREFAS / AGENDA ───────────────────────────────────────────



async function dbTarefasLoad() {
  if (!sbClient) return _fallbackLoad(TAREFAS_LOCAL_KEY, []);
  try {
    const uid = await _getUserId();
    if (!uid) return _fallbackLoad(TAREFAS_LOCAL_KEY, []);
    const { data, error } = await sbClient.from('tarefas').select('*').eq('user_id', uid).order('data', { ascending: false });
    if (!error && Array.isArray(data)) {
      const list = data.map(r => ({
        id: r.id,
        titulo: r.titulo,
        descricao: r.descricao || '',
        data: r.data,
        prioridade: r.prioridade,
        status: r.status,
        rotinaAtiva: Boolean(r.rotina_ativa),
        rotinaUnidade: r.rotina_unidade || "dias",
        rotinaIntervalo: Number(r.rotina_intervalo || 1),
        rotinaLembreteDias: Number(r.rotina_lembrete_dias || 0),
        rotinaUltimaConclusao: r.rotina_ultima_conclusao || "",
        rotinaProximaData: r.rotina_proxima_data || "",
        createdAt: r.created_at,
        updatedAt: r.updated_at
      }));
      appStorage.setItem(TAREFAS_LOCAL_KEY, JSON.stringify(list));
      return list;
    }
    return _fallbackLoad(TAREFAS_LOCAL_KEY, []);
  } catch {
    return _fallbackLoad(TAREFAS_LOCAL_KEY, []);
  }
}

async function dbTarefasSave(tarefa) {
  const list = JSON.parse(appStorage.getItem(TAREFAS_LOCAL_KEY) || '[]');
  const originalId = tarefa.id;
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(tarefa.id || ''));
  if (!isUuid) tarefa = { ...tarefa, id: crypto.randomUUID() };
  const idx = list.findIndex(t => t.id === originalId || t.id === tarefa.id);
  if (idx >= 0) list[idx] = tarefa;
  else list.unshift(tarefa);
  appStorage.setItem(TAREFAS_LOCAL_KEY, JSON.stringify(list));
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
        rotina_ativa: Boolean(tarefa.rotinaAtiva),
        rotina_unidade: tarefa.rotinaUnidade || "dias",
        rotina_intervalo: Number(tarefa.rotinaIntervalo || 1),
        rotina_lembrete_dias: Number(tarefa.rotinaLembreteDias || 0),
        rotina_ultima_conclusao: tarefa.rotinaUltimaConclusao || null,
        rotina_proxima_data: tarefa.rotinaProximaData || tarefa.data,
        updated_at: new Date().toISOString()
      }).eq('id', tarefa.id);
    } else {
      await sbClient.from('tarefas').insert({
        id: tarefa.id,
        user_id: uid,
        titulo: tarefa.titulo,
        descricao: tarefa.descricao || '',
        data: tarefa.data,
        prioridade: tarefa.prioridade,
        status: tarefa.status || 'pendente',
        rotina_ativa: Boolean(tarefa.rotinaAtiva),
        rotina_unidade: tarefa.rotinaUnidade || "dias",
        rotina_intervalo: Number(tarefa.rotinaIntervalo || 1),
        rotina_lembrete_dias: Number(tarefa.rotinaLembreteDias || 0),
        rotina_ultima_conclusao: tarefa.rotinaUltimaConclusao || null,
        rotina_proxima_data: tarefa.rotinaProximaData || tarefa.data
      });
    }
  } catch (e) { console.error('[db-extra]', e); }
}

async function dbTarefasDelete(id) {
  const list = JSON.parse(appStorage.getItem(TAREFAS_LOCAL_KEY) || '[]');
  const filtered = list.filter(t => t.id !== id);
  appStorage.setItem(TAREFAS_LOCAL_KEY, JSON.stringify(filtered));
  if (!sbClient) return;
  try {
    await sbClient.from('tarefas').delete().eq('id', id);
  } catch (e) { console.error('[db-extra]', e); }
}



// ─── REGRAS ────────────────────────────────────────────────────



async function dbRegrasLoad() {
  if (!sbClient) return _fallbackLoad(REGRAS_LOCAL_KEY, []);
  try {
    const { data, error } = await sbClient.from('regras').select('*').order('posicao', { ascending: true });
    if (error) throw error;
    if (Array.isArray(data)) {
      const list = data.map(r => ({ id: r.id, titulo: r.titulo, descricao: r.descricao || '', categoria: r.categoria || 'Geral', status: r.status || 'vigente', posicao: Number(r.posicao || 0), createdAt: r.created_at, updatedAt: r.updated_at }));
      appStorage.setItem(REGRAS_LOCAL_KEY, JSON.stringify(list));
      return list;
    }
  } catch (e) { console.warn('[db-extra] Regras usando armazenamento local:', e.message || e); }
  return _fallbackLoad(REGRAS_LOCAL_KEY, []);
}

async function dbRegrasSave(regra) {
  const list = _fallbackLoad(REGRAS_LOCAL_KEY, []);
  const index = list.findIndex(r => r.id === regra.id);
  if (index >= 0) list[index] = regra; else list.push(regra);
  appStorage.setItem(REGRAS_LOCAL_KEY, JSON.stringify(list));
  if (!sbClient) return;
  try {
    const uid = await _getUserId();
    const { error } = await sbClient.from('regras').upsert({ id: regra.id, titulo: regra.titulo, descricao: regra.descricao || '', categoria: regra.categoria || 'Geral', status: regra.status || 'vigente', posicao: Number(regra.posicao || 0), created_at: regra.createdAt || new Date().toISOString(), updated_at: regra.updatedAt || new Date().toISOString(), user_id: uid });
    if (error) throw error;
  } catch (e) { console.warn('[db-extra] Regra salva apenas localmente:', e.message || e); }
}

async function dbRegrasDelete(id) {
  appStorage.setItem(REGRAS_LOCAL_KEY, JSON.stringify(_fallbackLoad(REGRAS_LOCAL_KEY, []).filter(r => r.id !== id)));
  if (!sbClient) return;
  try {
    const { error } = await sbClient.from('regras').delete().eq('id', id);
    if (error) throw error;
  } catch (e) { console.warn('[db-extra] Regra removida apenas localmente:', e.message || e); }
}

  root.AppRepositories = root.AppRepositories || {};
  root.AppRepositories.routine = { dbAnotacoesLoad, dbAnotacoesSave, dbAnotacoesDelete, dbTarefasLoad, dbTarefasSave, dbTarefasDelete, dbRegrasLoad, dbRegrasSave, dbRegrasDelete };
})(window);
