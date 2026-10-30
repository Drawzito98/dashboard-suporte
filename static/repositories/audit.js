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

// ─── HISTÓRICO ───────────────────────────────────────────────────



async function dbHistoricoLoad() {
  if (!sbClient) return _fallbackLoad(HISTORICO_LOCAL_KEY, []);
  try {
    const { data, error } = await sbClient.from('historico').select('*').order('created_at', { ascending: false }).limit(500);
    if (!error && Array.isArray(data)) {
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
      appStorage.setItem(HISTORICO_LOCAL_KEY, JSON.stringify(log));
      return log;
    }
    return _fallbackLoad(HISTORICO_LOCAL_KEY, []);
  } catch {
    return _fallbackLoad(HISTORICO_LOCAL_KEY, []);
  }
}

async function dbHistoricoAdd(entry) {
  const log = JSON.parse(appStorage.getItem(HISTORICO_LOCAL_KEY) || '[]');
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
  appStorage.setItem(HISTORICO_LOCAL_KEY, JSON.stringify(log));
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


  root.AppRepositories = root.AppRepositories || {};
  root.AppRepositories.audit = { dbComentariosLoad, dbComentarioAdd, dbComentarioDel, dbHistoricoLoad, dbHistoricoAdd };
})(window);
