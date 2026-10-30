// Persistência de attendance; contratos preservados pelo facade db-extra.js.
(function (root) {
// ─── AUSÊNCIAS (Controle de Ponto) ─────────────────────────────



// Estas tabelas usam BIGINT GENERATED ALWAYS, não UUID do cliente.
const presenceReceipts=new Map();
function presenceId(value){const text=String(value??'');return /^[1-9][0-9]*$/.test(text)&&(typeof value!=='number'||Number.isSafeInteger(value))?text:null;}
function presenceModel(resource,row){
  const base={id:presenceId(row.id),colaborador:row.colaborador,createdAt:row.created_at,updatedAt:row.updated_at};
  if(resource==='ferias')return{...base,data_inicio:row.data_inicio,data_fim:row.data_fim};
  if(resource==='ausencias')return{...base,data:row.data,periodo:row.periodo,motivo:row.motivo||''};
  if(resource==='avaliacao_atendimentos')return{...base,protocolo:row.protocolo,data_atendimento:row.data_atendimento||'',teve_nota:row.teve_nota??row.nota!=null,nota:row.nota==null?null:Number(row.nota),justa:row.justa!==false,resumo:row.resumo||'',orientacao:row.orientacao||'',imagem:row.imagem||''};
  return{...base,data:row.data,setor:row.setor||'',assumidos:Number(row.assumidos||0),transferidos:Number(row.transferidos||0),finalizados:Number(row.finalizados||0),nota:Number(row.nota||0)};
}
function presenceFields(resource,draft){
  if(resource==='ferias')return{colaborador:draft.colaborador,data_inicio:draft.data_inicio,data_fim:draft.data_fim};
  if(resource==='ausencias')return{colaborador:draft.colaborador,data:draft.data,periodo:draft.periodo,motivo:draft.motivo||''};
  if(resource==='avaliacao_atendimentos')return{colaborador:draft.colaborador,protocolo:draft.protocolo,data_atendimento:draft.data_atendimento||'',teve_nota:Boolean(draft.teve_nota),nota:draft.teve_nota?Number(draft.nota):null,justa:draft.justa!==false,resumo:draft.resumo||'',orientacao:draft.orientacao||'',imagem:draft.imagem||''};
  return{colaborador:draft.colaborador,data:draft.data,setor:draft.setor||'',assumidos:Number(draft.assumidos),transferidos:Number(draft.transferidos),finalizados:Number(draft.finalizados),nota:Number(draft.nota)};
}
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
    for(let start=0;;start+=500){const {data,error}=await sbClient.from(resource).select('*').eq('user_id',uid).order(resource==='ferias'?'data_inicio':resource==='avaliacao_atendimentos'?'created_at':'data',{ascending:false}).order('id',{ascending:true}).range(start,start+499);
      if(!AppDataSession.current(token)||revision!==_confirmedRevisions.get(resource))return getPresenceList(resource);
      if(error||!Array.isArray(data)||data.some(row=>row.user_id!==uid||!presenceId(row.id)))return fallback();
      rows.push(...data.map(row=>presenceModel(resource,row)));if(data.length<500)break;
    }publishPresence(resource,rows);if(typeof AppState!=='undefined')AppState.publish('presencaLeitura:'+resource,{confirmed:true,revision});return rows;
  }catch(_){return fallback();}
}
async function savePresence(resource,item){
  if(!requireAdmin())throw Error('Apenas administradores podem alterar estes registros.');
  const draft={...item},id=draft.id==null?null:presenceId(draft.id);
  if(draft.id!=null&&!id)throw Error('Registro local sem identificação confirmada. Atualize a lista e selecione o registro do servidor.');
  const date=value=>/^\d{4}-\d{2}-\d{2}$/.test(String(value))&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
  if(!draft.colaborador)throw Error('Informe o colaborador.');
  if(resource==='ferias'&&(!date(draft.data_inicio)||!date(draft.data_fim)||draft.data_fim<draft.data_inicio))throw Error('Confira as datas.');
  if(resource==='ausencias'&&(!date(draft.data)||!['dia_inteiro','manha','tarde','noite'].includes(draft.periodo)))throw Error('Confira data e período.');
  if(resource==='avaliacao_atendimentos'&&(!String(draft.protocolo||'').trim()||(draft.data_atendimento&&!date(draft.data_atendimento))||(draft.teve_nota&&(draft.nota==null||draft.nota===''||!Number.isFinite(Number(draft.nota))||Number(draft.nota)<1||Number(draft.nota)>5))))throw Error('Confira protocolo, data e nota do cliente (1 a 5, quando avaliado).');
  if(resource==='acompanhamento_diario'&&(!date(draft.data)||['assumidos','transferidos','finalizados'].some(k=>draft[k]===''||!Number.isInteger(Number(draft[k]))||Number(draft[k])<0)||draft.nota===''||!Number.isFinite(Number(draft.nota))||Number(draft.nota)<0||Number(draft.nota)>10))throw Error('Confira data, quantidades inteiras não negativas e nota de 0 a 10.');
  return _confirmedWrite(resource,async({uid,request})=>{
    const fields=presenceFields(resource,draft);
    let row;
    if(id){row=await request(()=>sbClient.from(resource).update({...fields,updated_at:new Date().toISOString()}).eq('id',id).eq('user_id',uid).select('*').single());}
    else{
      if(!draft._requestId)throw Error('Abra o formulário antes de criar um registro.');
      const receiptKey=uid+':'+resource+':'+draft._requestId,receipt=_fallbackLoad('sistema_presenca_confirmada_'+resource+'_v1',null);
      if(presenceReceipts.has(receiptKey)||receipt?.requestId===draft._requestId)throw Error('Esta criação já foi confirmada. Atualize a lista e edite pelo registro confirmado.');
      if(getPresencePending(resource))throw Error('Há uma criação sem confirmação. Consulte a lista e vincule o registro, ou libere uma nova tentativa após conferir.');
      // Reservar ANTES de enviar: rede/RLS/resposta perdida nunca liberam outra inserção automática.
      try{appStorage.setItem('sistema_presenca_pendente_'+resource+'_v1',JSON.stringify({requestId:draft._requestId,data:draft,startedAt:new Date().toISOString()}));}catch(_){throw Error('Não foi possível reservar o envio neste dispositivo. O registro não foi enviado.');}
      row=await request(()=>sbClient.from(resource).insert({user_id:uid,...fields}).select('*').single());
    }
    if(!row||!presenceId(row.id)||row.user_id!==uid||(id&&presenceId(row.id)!==id))throw Error('O servidor não confirmou o registro. O rascunho foi mantido.');
    const confirmed=presenceModel(resource,row);
    if(['avaliacao_atendimentos','acompanhamento_diario'].includes(resource)&&Object.entries(fields).some(([key,value])=>String(confirmed[key]??'')!==String(value??'')))throw Error('O servidor não confirmou os campos enviados. Preserve o rascunho e confira a lista.');
    const list=getPresenceList(resource),index=list.findIndex(record=>String(record.id)===confirmed.id);
    if(index<0)list.unshift(confirmed);else list[index]=confirmed;
    publishPresence(resource,list);
    if(!id){presenceReceipts.set(uid+':'+resource+':'+draft._requestId,confirmed.id);try{appStorage.setItem('sistema_presenca_confirmada_'+resource+'_v1',JSON.stringify({requestId:draft._requestId,id:confirmed.id}));clearPresencePending(resource);}catch(_){/* Sem recibo durável, manter a reserva anterior; confirmação remota continua válida. */}}
    return {status:'confirmed',data:confirmed};
  });
}
async function deletePresence(resource,value){
  if(!requireAdmin())throw Error('Apenas administradores podem excluir estes registros.');const id=presenceId(value);if(!id)throw Error('Atualize a lista para obter o identificador confirmado.');
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



async function dbAvaliacaoAtendLoad(){return loadPresence('avaliacao_atendimentos');}
async function dbAvaliacaoAtendSave(item){return savePresence('avaliacao_atendimentos',item);}
async function dbAvaliacaoAtendDelete(id){return deletePresence('avaliacao_atendimentos',id);}

// ─── FÉRIAS ────────────────────────────────────────────────



function notifyFeriasUpdated() {
  window.dispatchEvent(new Event('ferias-updated'));
}

async function dbFeriasLoad(){return loadPresence('ferias');}
async function dbFeriasSave(item){return savePresence('ferias',item);}
async function dbFeriasDelete(id){return deletePresence('ferias',id);}

// ─── ACOMPANHAMENTO DIÁRIO ─────────────────────────────



async function dbAcompDiarioLoad(){return loadPresence('acompanhamento_diario');}
async function dbAcompDiarioSave(item){return savePresence('acompanhamento_diario',item);}
async function dbAcompDiarioDelete(id){return deletePresence('acompanhamento_diario',id);}

  root.AppRepositories = root.AppRepositories || {};
  root.AppRepositories.attendance = { dbAusenciasLoad, dbAusenciasSave, dbAusenciasDelete, dbAvaliacaoAtendLoad, dbAvaliacaoAtendSave, dbAvaliacaoAtendDelete, notifyFeriasUpdated, dbFeriasLoad, dbFeriasSave, dbFeriasDelete, dbAcompDiarioLoad, dbAcompDiarioSave, dbAcompDiarioDelete };
})(window);
