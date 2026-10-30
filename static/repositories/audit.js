// Persistência de audit; contratos preservados pelo facade db-extra.js.
(function (root) {
// Comentários são compartilhados e não possuem user_id nem política UPDATE.
const commentsKey='sistema_comentarios_confirmados_v1';
function commentsList(){const rows=typeof AppState!=='undefined'?AppState.get('comentarios'):null;return Array.isArray(rows)?rows:_confirmedList(commentsKey);}
function publishComments(rows){_confirmedCache(commentsKey,rows);if(typeof AppState!=='undefined')AppState.publish('comentarios',rows);}
function commentModel(row){return{id:row.id,mes:row.mes,texto:row.texto,user:row.user_email||'desconhecido',ts:row.created_at};}
function commentMap(rows){const map=Object.create(null);for(const row of rows){if(!map[row.mes])map[row.mes]=[];map[row.mes].push(row);}return map;}
function commentId(id){if(_writeUuid(id)!==id)throw Error('Identificador inválido. Atualize a lista antes de continuar.');return id;}
function confirmComment(row,id,mes,texto,email){
  if(!row||row.id!==id||row.mes!==mes||row.texto!==texto||(row.user_email||'')!==email)throw Error('Comentário não confirmado. Consulte a lista e preserve o rascunho.');
  const entry=commentModel(row),rows=commentsList(),at=rows.findIndex(r=>r.id===id);if(at<0)rows.push(entry);else rows[at]=entry;
  publishComments(rows);return{status:'confirmed',data:entry};
}
async function dbComentariosLoad(){
  const token=AppDataSession.token(),revision=_confirmedRevisions.get('comentarios');
  if(!sbClient||!AppDataSession.current(token))return commentMap(commentsList());
  try{
    const uid=await _getUserId();if(!uid||!AppDataSession.current(token))return commentMap(commentsList());
    const rows=[];
    for(let start=0;;start+=500){
      const {data,error}=await sbClient.from('comentarios').select('*').order('created_at',{ascending:true}).order('id',{ascending:true}).range(start,start+499);
      if(!AppDataSession.current(token)||revision!==_confirmedRevisions.get('comentarios'))return commentMap(commentsList());
      if(error||!Array.isArray(data))return commentMap(commentsList());
      rows.push(...data.map(commentModel));if(data.length<500)break;
    }
    publishComments(rows);return commentMap(rows);
  }catch(_){return commentMap(commentsList());}
}
async function dbComentarioAdd(mes,texto,id){
  commentId(id);texto=String(texto||'').trim();mes=String(mes||'').trim();
  if(!mes||!texto)throw Error('Informe o período e o comentário.');
  return _confirmedWrite('comentarios',async({uid,request,check})=>{
    const auth=await sbClient.auth.getUser();check();
    if(auth.error||auth.data?.user?.id!==uid)throw Error('Confirme sua sessão antes de enviar.');
    const email=auth.data.user.email||'';
    // INSERT com UUID estável; retentativa consulta o mesmo ID, sem UPDATE/upsert.
    const existing=await request(()=>sbClient.from('comentarios').select('*').eq('id',id).maybeSingle());
    if(existing)return confirmComment(existing,id,mes,texto,email);
    const row=await request(()=>sbClient.from('comentarios').insert({id,mes,texto,user_email:email}).select('*').single());
    return confirmComment(row,id,mes,texto,email);
  });
}
async function dbComentarioDel(mes,id){
  commentId(id);
  return _confirmedWrite('comentarios',async({request})=>{
    const rows=await request(()=>sbClient.from('comentarios').delete().eq('id',id).eq('mes',mes).select('id'));
    if(!Array.isArray(rows)||!rows.some(row=>row.id===id))throw Error('Exclusão não confirmada. Atualize a lista para conferir.');
    publishComments(commentsList().filter(row=>row.id!==id));return{status:'confirmed',id};
  });
}

// Histórico compartilhado: confirmados e envios pendentes são coleções distintas.
const historyKey='sistema_historico_confirmado_v1',historyPendingKey='sistema_historico_pendente_v1';
function historyList(){const rows=typeof AppState!=='undefined'?AppState.get('historico'):null;return Array.isArray(rows)?rows:_confirmedList(historyKey);}
function historyPending(){return _confirmedList(historyPendingKey);}
function historyPublish(rows){rows=rows.slice().sort((a,b)=>String(a.ts).localeCompare(String(b.ts))).slice(-500);_confirmedCache(historyKey,rows);if(typeof AppState!=='undefined')AppState.publish('historico',rows);}
function historyModel(r){return{id:r.id,ts:r.created_at,user:r.user_email||'',action:r.action,colaborador:r.colaborador,mes:r.mes,campo:r.campo,before:r.before_value,after:r.after_value,detalhes:r.detalhes};}
function historyPayload(entry,email){return{id:entry.id,action:String(entry.action??''),colaborador:String(entry.colaborador??''),mes:String(entry.mes??''),campo:String(entry.campo??''),before_value:String(entry.before??''),after_value:String(entry.after??''),detalhes:String(entry.detalhes??''),user_email:email};}
function historyMatches(row,payload){return row&&Object.keys(payload).every(key=>row[key]===payload[key]);}
function historyForget(ids){const rows=historyPending().filter(e=>!ids.includes(e.id));_confirmedCache(historyPendingKey,rows);}
async function dbHistoricoLoad(){
  const token=AppDataSession.token(),revision=_confirmedRevisions.get('historico');
  if(!sbClient||!AppDataSession.current(token))return historyList();
  try{
    const uid=await _getUserId();if(!uid||!AppDataSession.current(token))return historyList();
    const {data,error}=await sbClient.from('historico').select('*').order('created_at',{ascending:false}).order('id',{ascending:false}).limit(500);
    if(!AppDataSession.current(token)||revision!==_confirmedRevisions.get('historico'))return historyList();
    if(error||!Array.isArray(data))throw Error('Consulta não confirmada.');
    if(typeof AppState!=='undefined')AppState.publish('historicoStatus','confirmed');
    historyPublish(data.map(historyModel));
    historyForget(historyPending().filter(entry=>data.some(row=>historyMatches(row,entry.payload))).map(e=>e.id));
    return historyList();
  }catch(_){if(AppDataSession.current(token)&&typeof AppState!=='undefined')AppState.publish('historicoStatus','error');return historyList();}
}
async function dbHistoricoAdd(entry){
  const id=_writeUuid(entry.id);if(entry.id&&entry.id!==id)throw Error('Identificador de histórico inválido.');
  return _confirmedWrite('historico',async({uid,request,check})=>{
    const auth=await sbClient.auth.getUser();check();
    if(auth.error||auth.data?.user?.id!==uid)throw Error('Confirme sua sessão antes de registrar o histórico.');
    const email=auth.data.user.email||'',payload=historyPayload({...entry,id},email),pending=historyPending(),existingPending=pending.find(e=>e.id===id);
    if(existingPending&&JSON.stringify(existingPending.payload)!==JSON.stringify(payload))throw Error('O envio pendente possui outro conteúdo.');
    if(!existingPending){
      // Se não for possível preservar o envio, não iniciar a escrita de rede.
      appStorage.setItem(historyPendingKey,JSON.stringify([...pending,{...entry,id,user:email,payload}]));
    }
    let row=await request(()=>sbClient.from('historico').select('*').eq('id',id).maybeSingle());
    if(!row)row=await request(()=>sbClient.from('historico').insert(payload).select('*').single());
    if(!historyMatches(row,payload)||!row.created_at)throw Error('Histórico não confirmado. Consulte a lista antes de tentar novamente.');
    historyPublish([...historyList().filter(e=>e.id!==id),historyModel(row)]);historyForget([id]);
    return{status:'confirmed',data:historyModel(row)};
  });
}


  root.AppRepositories = root.AppRepositories || {};
  root.AppRepositories.audit = { dbComentariosLoad, dbComentarioAdd, dbComentarioDel, dbHistoricoLoad, dbHistoricoAdd };
})(window);
