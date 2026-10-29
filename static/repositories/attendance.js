// Persistência de attendance; contratos preservados pelo facade db-extra.js.
(function (root) {
// ─── AUSÊNCIAS (Controle de Ponto) ─────────────────────────────



// Estas duas tabelas usam BIGINT GENERATED ALWAYS, não UUID do cliente.
const presenceReceipts=new Map();
function presenceId(value){const text=String(value??'');return /^[1-9][0-9]*$/.test(text)&&(typeof value!=='number'||Number.isSafeInteger(value))?text:null;}
function presenceModel(resource,row){const base={id:presenceId(row.id),colaborador:row.colaborador,createdAt:row.created_at,updatedAt:row.updated_at};return resource==='ferias'?{...base,data_inicio:row.data_inicio,data_fim:row.data_fim}:{...base,data:row.data,periodo:row.periodo,motivo:row.motivo||''};}
function publishPresence(resource,list){
  let cacheAllowed=true;
  if(typeof AppState==='undefined'||!AppState.get(resource)){
    try{const previous=appStorage.getItem(PRESENCE_KEYS[resource]),backup='sistema_presenca_backup_'+resource+'_v1';if(previous&&JSON.parse(previous).length&&!appStorage.getItem(backup))appStorage.setItem(backup,previous);}catch(_){cacheAllowed=false;}
  }
  if(cacheAllowed)_confirmedCache(PRESENCE_KEYS[resource],list);
  if(typeof AppState!=='undefined')AppState.publish(resource,list);
  if(resource==='ferias')notifyFeriasUpdated();
}
async function loadPresence(resource){
  const token=AppDataSession.token(),revision=_confirmedRevisions.get(resource);
  const fallback=()=>{if(AppDataSession.current(token)&&revision===_confirmedRevisions.get(resource)&&typeof AppState!=='undefined')AppState.publish('presencaLeitura:'+resource,{confirmed:false,revision});return getPresenceList(resource);};
  if(!sbClient||!AppDataSession.current(token))return fallback();
  try{const uid=await _getUserId();if(!uid||!AppDataSession.current(token))return fallback();const rows=[];
    for(let start=0;;start+=500){const {data,error}=await sbClient.from(resource).select('*').eq('user_id',uid).order(resource==='ferias'?'data_inicio':'data',{ascending:false}).order('id',{ascending:true}).range(start,start+499);
      if(!AppDataSession.current(token)||revision!==_confirmedRevisions.get(resource))return getPresenceList(resource);
      if(error||!Array.isArray(data)||data.some(row=>row.user_id!==uid||!presenceId(row.id)))return fallback();
      rows.push(...data.map(row=>presenceModel(resource,row)));if(data.length<500)break;
    }publishPresence(resource,rows);if(typeof AppState!=='undefined')AppState.publish('presencaLeitura:'+resource,{confirmed:true,revision});return rows;
  }catch(_){return fallback();}
}
async function savePresence(resource,item){
  if(!requireAdmin())throw Error('Apenas administradores podem alterar férias e ausências.');
  const draft={...item},id=draft.id==null?null:presenceId(draft.id);
  if(draft.id!=null&&!id)throw Error('Registro local sem identificação confirmada. Atualize a lista e selecione o registro do servidor.');
  const date=value=>/^\d{4}-\d{2}-\d{2}$/.test(String(value))&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
  if(!draft.colaborador||(resource==='ferias'?(!date(draft.data_inicio)||!date(draft.data_fim)||draft.data_fim<draft.data_inicio):(!date(draft.data)||!['dia_inteiro','manha','tarde','noite'].includes(draft.periodo))))throw Error('Confira colaborador, datas e período.');
  return _confirmedWrite(resource,async({uid,request})=>{
    const fields=resource==='ferias'?{colaborador:draft.colaborador,data_inicio:draft.data_inicio,data_fim:draft.data_fim}:{colaborador:draft.colaborador,data:draft.data,periodo:draft.periodo,motivo:draft.motivo||''};
    let row;
    if(id){row=await request(()=>sbClient.from(resource).update({...fields,updated_at:new Date().toISOString()}).eq('id',id).eq('user_id',uid).select('*').single());}
    else{
      if(!draft._requestId)throw Error('Abra o formulário antes de criar um registro.');
      const receiptKey=uid+':'+resource+':'+draft._requestId,receipt=_fallbackLoad('sistema_presenca_confirmada_'+resource+'_v1',null);
      if(presenceReceipts.has(receiptKey)||receipt?.requestId===draft._requestId)throw Error('Esta criação já foi confirmada. Atualize a lista e edite pelo registro confirmado.');
      if(getPresencePending(resource))throw Error('Há uma criação sem confirmação. Consulte a lista e vincule o registro, ou libere uma nova tentativa após conferir.');
      // Reservar ANTES de enviar: rede/RLS/resposta perdida nunca liberam outra inserção automática.
      appStorage.setItem('sistema_presenca_pendente_'+resource+'_v1',JSON.stringify({requestId:draft._requestId,data:draft,startedAt:new Date().toISOString()}));
      row=await request(()=>sbClient.from(resource).insert({user_id:uid,...fields}).select('*').single());
    }
    if(!row||!presenceId(row.id)||row.user_id!==uid||(id&&presenceId(row.id)!==id))throw Error('O servidor não confirmou o registro. O rascunho foi mantido.');
    const confirmed=presenceModel(resource,row),list=getPresenceList(resource),index=list.findIndex(record=>String(record.id)===confirmed.id);
    if(index<0)list.unshift(confirmed);else list[index]=confirmed;
    publishPresence(resource,list);
    if(!id){presenceReceipts.set(uid+':'+resource+':'+draft._requestId,confirmed.id);try{appStorage.setItem('sistema_presenca_confirmada_'+resource+'_v1',JSON.stringify({requestId:draft._requestId,id:confirmed.id}));clearPresencePending(resource);}catch(_){/* Sem recibo durável, manter a reserva anterior; confirmação remota continua válida. */}}
    return {status:'confirmed',data:confirmed};
  });
}
async function deletePresence(resource,value){
  if(!requireAdmin())throw Error('Apenas administradores podem excluir férias e ausências.');const id=presenceId(value);if(!id)throw Error('Atualize a lista para obter o identificador confirmado.');
  return _confirmedWrite(resource,async({uid,request})=>{
    const rows=await request(()=>sbClient.from(resource).delete().eq('id',id).eq('user_id',uid).select('id'));
    if(!Array.isArray(rows)||!rows.some(row=>presenceId(row.id)===id))throw Error('Exclusão não confirmada. Atualize a lista antes de tentar novamente.');
    publishPresence(resource,getPresenceList(resource).filter(row=>String(row.id)!==id));return {status:'confirmed',id};
  });
}
async function dbAusenciasLoad(){return loadPresence('ausencias');}
async function dbAusenciasSave(item){return savePresence('ausencias',item);}
async function dbAusenciasDelete(id){return deletePresence('ausencias',id);}

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

async function dbFeriasLoad(){return loadPresence('ferias');}
async function dbFeriasSave(item){return savePresence('ferias',item);}
async function dbFeriasDelete(id){return deletePresence('ferias',id);}

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
