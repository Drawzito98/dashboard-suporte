// Persistência de rotina: somente respostas confirmadas entram na lista.
(function (root) {
const activityPrefix = 'atividade-colaborador:v1:';
const configs = {
  tarefas: { table: 'tarefas', key: TAREFAS_LOCAL_KEY, model: r => ({ id:r.id, titulo:r.titulo, descricao:r.descricao||'', data:r.data, prioridade:r.prioridade, status:r.status,
    rotinaAtiva:Boolean(r.rotina_ativa), rotinaUnidade:r.rotina_unidade||'dias', rotinaIntervalo:Number(r.rotina_intervalo||1), rotinaLembreteDias:Number(r.rotina_lembrete_dias||0),
    rotinaUltimaConclusao:r.rotina_ultima_conclusao||'', rotinaProximaData:r.rotina_proxima_data||'', createdAt:r.created_at, updatedAt:r.updated_at }) },
  anotacoes: { table:'anotacoes_diarias', key:ANOTACOES_LOCAL_KEY, model:r=>({id:r.id,data:r.data,conteudo:r.conteudo||'',etiquetas:r.etiquetas||'',favorito:Boolean(r.favorito),createdAt:r.created_at,updatedAt:r.updated_at}) }
};
function list(resource) {
  const state = typeof AppState !== 'undefined' ? AppState.get(resource) : null;
  return Array.isArray(state) ? [...state] : _confirmedList(configs[resource].key);
}
function publish(resource, rows) {
  _confirmedCache(configs[resource].key, rows);
  if (typeof AppState !== 'undefined') AppState.publish(resource, rows);
}
function noteFilter(query, resource) { return resource === 'anotacoes' ? query.not('conteudo','like',activityPrefix+'%') : query; }
async function load(resource) {
  const token=AppDataSession.token(), revision=_confirmedRevisions.get(resource), config=configs[resource];
  if (!sbClient || !AppDataSession.current(token)) return list(resource);
  try {
    const uid=await _getUserId();
    if (!uid || !AppDataSession.current(token)) return list(resource);
    const rows=[];
    for(let start=0;;start+=500) {
      const {data,error}=await noteFilter(sbClient.from(config.table).select('*').eq('user_id',uid),resource).order('data',{ascending:false}).order('id',{ascending:true}).range(start,start+499);
      if(!AppDataSession.current(token)||revision!==_confirmedRevisions.get(resource))return list(resource);
      if(error||!Array.isArray(data)||data.some(r=>r.user_id!==uid))return list(resource);
      rows.push(...data.filter(r=>resource!=='anotacoes'||!String(r.conteudo||'').startsWith(activityPrefix)).map(config.model));
      if(data.length<500)break;
    }
    publish(resource,rows);return rows;
  }catch(_){return list(resource);}
}
function confirmRow(resource,row,id,uid,oldId) {
  if(!row||row.id!==id||row.user_id!==uid||(resource==='anotacoes'&&String(row.conteudo||'').startsWith(activityPrefix)))throw Error('O servidor não confirmou. Seu rascunho foi mantido.');
  const confirmed=configs[resource].model(row), rows=list(resource), at=rows.findIndex(r=>r.id===id||(oldId&&r.id===oldId));
  if(at<0)rows.unshift(confirmed);else rows[at]=confirmed;
  publish(resource,rows);return {status:'confirmed',data:confirmed};
}
function taskAdmin(){if(!requireAdmin())throw Error('Apenas administradores podem alterar tarefas.');}
async function dbAnotacoesLoad(){return load('anotacoes');}
async function dbTarefasLoad(){return load('tarefas');}
async function dbAnotacoesSave(note){
  const draft={...note,id:_writeUuid(note.id)};
  if(String(draft.conteudo||'').startsWith(activityPrefix))throw Error('Use o editor de atividades para este conteúdo.');
  return _confirmedWrite('anotacoes',async({uid,request})=>{
    // A tabela também contém atividades: nunca sobrescrever uma delas por ID.
    const existing=await request(()=>sbClient.from('anotacoes_diarias').select('*').eq('id',draft.id).eq('user_id',uid).maybeSingle());
    if(existing&&(existing.user_id!==uid||String(existing.conteudo||'').startsWith(activityPrefix)))throw Error('Esta é uma atividade, não uma anotação.');
    const fields={data:draft.data,conteudo:draft.conteudo||'',etiquetas:draft.etiquetas||'',updated_at:new Date().toISOString()};
    const saved=await request(()=>existing
      ? noteFilter(sbClient.from('anotacoes_diarias').update(fields).eq('id',draft.id).eq('user_id',uid),'anotacoes').select('*').single()
      : sbClient.from('anotacoes_diarias').upsert({...fields,id:draft.id,user_id:uid,favorito:Boolean(draft.favorito),created_at:draft.createdAt||new Date().toISOString()},{onConflict:'id'}).select('*').single());
    return confirmRow('anotacoes',saved,draft.id,uid,draft._localId);
  });
}
async function dbAnotacaoFavorito(id,favorito){
  return _confirmedWrite('anotacoes',async({uid,request})=>{
    const row=await request(()=>noteFilter(sbClient.from('anotacoes_diarias').update({favorito:Boolean(favorito),updated_at:new Date().toISOString()}).eq('id',id).eq('user_id',uid),'anotacoes').select('*').single());
    return confirmRow('anotacoes',row,id,uid);
  });
}
async function dbTarefasSave(task){
  taskAdmin();const draft={...task,id:_writeUuid(task.id)};
  return _confirmedWrite('tarefas',async({uid,request})=>{
    const current=list('tarefas').find(r=>r.id===draft.id);
    const row={id:draft.id,user_id:uid,titulo:draft.titulo,descricao:draft.descricao||'',data:current&&draft._baseData&&draft.data===draft._baseData?current.data:draft.data,prioridade:draft.prioridade,status:current?.status||draft.status||'pendente',
      rotina_ativa:Boolean(draft.rotinaAtiva),rotina_unidade:draft.rotinaUnidade||'dias',rotina_intervalo:Number(draft.rotinaIntervalo||1),rotina_lembrete_dias:Number(draft.rotinaLembreteDias||0),
      rotina_ultima_conclusao:current?.rotinaUltimaConclusao||draft.rotinaUltimaConclusao||null,rotina_proxima_data:current?.rotinaProximaData||draft.rotinaProximaData||draft.data,
      created_at:draft.createdAt||new Date().toISOString(),updated_at:new Date().toISOString()};
    const saved=await request(()=>sbClient.from('tarefas').upsert(row,{onConflict:'id'}).select('*').single());
    return confirmRow('tarefas',saved,draft.id,uid,draft._localId);
  });
}
async function dbTarefaStatus(id,patch){
  taskAdmin();const allowed=['pendente','andamento','concluida','cancelada'];
  if(!allowed.includes(patch.status))throw Error('Status inválido.');
  const fields={status:patch.status,updated_at:new Date().toISOString()};
  // A conclusão recorrente envia o destino calculado uma vez, também na retentativa.
  if(patch.rotinaUltimaConclusao){fields.rotina_ultima_conclusao=patch.rotinaUltimaConclusao;fields.data=patch.data;fields.rotina_proxima_data=patch.rotinaProximaData;}
  return _confirmedWrite('tarefas',async({uid,request})=>{
    const saved=await request(()=>sbClient.from('tarefas').update(fields).eq('id',id).eq('user_id',uid).select('*').single());
    return confirmRow('tarefas',saved,id,uid);
  });
}
async function remove(resource,id){
  return _confirmedWrite(resource,async({uid,request})=>{
    const rows=await request(()=>noteFilter(sbClient.from(configs[resource].table).delete().eq('id',id).eq('user_id',uid),resource).select('id'));
    if(!Array.isArray(rows)||!rows.some(r=>r.id===id))throw Error('Exclusão não confirmada. Atualize a lista e tente novamente.');
    publish(resource,list(resource).filter(r=>r.id!==id));return {status:'confirmed',id};
  });
}
async function dbAnotacoesDelete(id){return remove('anotacoes',id);}
async function dbTarefasDelete(id){taskAdmin();return remove('tarefas',id);}

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
  root.AppRepositories.routine = { dbAnotacoesLoad, dbAnotacoesSave, dbAnotacoesDelete, dbAnotacaoFavorito, dbTarefasLoad, dbTarefasSave, dbTarefasDelete, dbTarefaStatus, dbRegrasLoad, dbRegrasSave, dbRegrasDelete };
})(window);
