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

// Configurações por conta: nenhuma escrita durante leitura/renderização.
const settingsConfigs={scoring:{table:'scoring_config',field:'rules',key:'sistema_scoring_confirmado_v1'},alertas:{table:'alertas_config',field:'config',key:'sistema_alertas_confirmado_v1'}};
function settingsSnapshot(kind){return getSettingsConfirmed(kind);}
function publishSettings(kind,snapshot){
  _confirmedCache(settingsConfigs[kind].key,snapshot);
  if(typeof AppState!=='undefined')AppState.publish('settings:'+kind,snapshot);
  if(kind==='scoring'&&typeof loadScoringRules==='function')loadScoringRules();
  if(kind==='alertas'&&typeof loadAlertasConfig==='function')loadAlertasConfig();
  if(typeof invalidateGamificationCache==='function')invalidateGamificationCache();
  if(typeof window.dispatchEvent==='function')window.dispatchEvent(new CustomEvent('settings-confirmed',{detail:{kind}}));
}
function settingsModel(kind,row,uid){
  if(row===null)return{id:null,value:null};
  if(!row?.id||row.user_id!==uid||!Array.isArray(row[settingsConfigs[kind].field])||row[settingsConfigs[kind].field].some(rule=>!rule||typeof rule!=='object'||typeof rule.id!=='string'))throw Error('Configuração não confirmada.');
  return{id:row.id,value:row[settingsConfigs[kind].field]};
}
function sameSettings(value){if(Array.isArray(value))return value.map(sameSettings);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,sameSettings(value[k])]));return value;}
async function loadSettings(kind){
  const token=AppDataSession.token(),revision=_confirmedRevisions.get('settings:'+kind);
  if(!sbClient||!AppDataSession.current(token))return settingsSnapshot(kind)?.value??null;
  try{const uid=await _getUserId();if(!uid||!AppDataSession.current(token))return settingsSnapshot(kind)?.value??null;
    const {data,error}=await sbClient.from(settingsConfigs[kind].table).select('*').eq('user_id',uid).maybeSingle();
    if(!AppDataSession.current(token)||revision!==_confirmedRevisions.get('settings:'+kind)||error)return settingsSnapshot(kind)?.value??null;
    const snapshot=settingsModel(kind,data,uid);publishSettings(kind,snapshot);return snapshot.value;
  }catch(_){return settingsSnapshot(kind)?.value??null;}
}
async function saveSettings(kind,value,draftId){
  if(!requireAdmin())throw Error('Apenas administradores podem alterar configurações.');
  if(!Array.isArray(value)||value.some(rule=>!rule||typeof rule!=='object'||typeof rule.id!=='string')||_writeUuid(draftId)!==draftId)throw Error('Guarde o rascunho antes de salvar.');
  const draft=JSON.parse(JSON.stringify(value)),cfg=settingsConfigs[kind];
  return _confirmedWrite('settings:'+kind,async({uid,request})=>{
    const existing=await request(()=>sbClient.from(cfg.table).select('*').eq('user_id',uid).maybeSingle());
    if(existing===undefined)throw Error('A consulta não confirmou se a configuração existe. Tente novamente.');
    if(existing)settingsModel(kind,existing,uid);
    const id=existing?.id||draftId,fields={[cfg.field]:draft,updated_at:new Date().toISOString()};
    const row=await request(()=>existing?sbClient.from(cfg.table).update(fields).eq('id',id).eq('user_id',uid).select('*').single():sbClient.from(cfg.table).insert({...fields,id,user_id:uid}).select('*').single());
    const snapshot=settingsModel(kind,row,uid);
    if(snapshot.id!==id||JSON.stringify(sameSettings(snapshot.value))!==JSON.stringify(sameSettings(draft)))throw Error('O servidor não confirmou os valores enviados. O rascunho foi mantido.');
    publishSettings(kind,snapshot);return{status:'confirmed',data:snapshot};
  });
}
async function dbScoringLoad(){return loadSettings('scoring');}
async function dbScoringSave(value,id){return saveSettings('scoring',value,id);}
async function dbAlertasLoad(){return loadSettings('alertas');}
async function dbAlertasSave(value,id){return saveSettings('alertas',value,id);}

// ─── PONTOS EXTRAS (Bônus Manuais) ──────────────────────────────



function bonusModel(row){return {id:row.id,colaborador:row.colaborador,descricao:row.descricao||'',pontos:parseFloat(row.pontos)||0,mes:row.mes||'',createdAt:row.created_at,updatedAt:row.updated_at};}
function publishBonuses(list){
  let cacheAllowed=true;
  if(typeof AppState==='undefined'||!AppState.get('pontosExtras')){
    try{const old=appStorage.getItem(PONTOS_EXTRAS_LOCAL_KEY),key='sistema_bonus_backup_v1';if(old&&JSON.parse(old).length&&!appStorage.getItem(key))appStorage.setItem(key,old);}catch(_){cacheAllowed=false;}
  }
  if(cacheAllowed)_confirmedCache(PONTOS_EXTRAS_LOCAL_KEY,list);
  if(typeof invalidateGamificationCache==='function')invalidateGamificationCache();
  if(typeof AppState!=='undefined')AppState.publish('pontosExtras',list);
}
async function dbPontosExtrasLoad(){
  const token=AppDataSession.token(),revision=_confirmedRevisions.get('pontosExtras');
  if(!sbClient||!AppDataSession.current(token))return getPontosExtrasLocal();
  try{
    const uid=await _getUserId();if(!uid||!AppDataSession.current(token))return getPontosExtrasLocal();
    const rows=[];
    for(let start=0;;start+=500){
      const {data,error}=await sbClient.from('pontos_extras').select('*').eq('user_id',uid).order('created_at',{ascending:false}).order('id',{ascending:true}).range(start,start+499);
      if(!AppDataSession.current(token)||revision!==_confirmedRevisions.get('pontosExtras'))return getPontosExtrasLocal();
      if(error||!Array.isArray(data)||data.some(row=>row.user_id!==uid))return getPontosExtrasLocal();
      rows.push(...data.map(bonusModel));if(data.length<500)break;
    }
    publishBonuses(rows);return rows;
  }catch(_){return getPontosExtrasLocal();}
}
async function dbPontosExtrasSave(bonus){
  if(!requireAdmin())throw Error('Apenas administradores podem alterar bônus e penalidades.');
  const draft={...bonus,id:_writeUuid(bonus.id)};
  if(!draft.colaborador||!Number.isFinite(Number(draft.pontos))||!Number(draft.pontos))throw Error('Informe colaborador e pontos válidos.');
  return _confirmedWrite('pontosExtras',async({uid,request})=>{
    const row=await request(()=>sbClient.from('pontos_extras').upsert({id:draft.id,user_id:uid,colaborador:draft.colaborador,descricao:draft.descricao||'',pontos:Number(draft.pontos),mes:draft.mes||'',created_at:draft.createdAt||new Date().toISOString(),updated_at:new Date().toISOString()},{onConflict:'id'}).select('*').single());
    if(!row||row.id!==draft.id||row.user_id!==uid)throw Error('O servidor não confirmou o lançamento. Seu rascunho foi mantido.');
    const confirmed=bonusModel(row),list=getPontosExtrasLocal(),index=list.findIndex(item=>item.id===draft.id||(draft._localId&&item.id===draft._localId));
    if(index<0)list.unshift(confirmed);else list[index]=confirmed;
    publishBonuses(list);return {status:'confirmed',data:confirmed};
  });
}
async function dbPontosExtrasDelete(id){
  if(!requireAdmin())throw Error('Apenas administradores podem excluir bônus e penalidades.');
  return _confirmedWrite('pontosExtras',async({uid,request})=>{
    const rows=await request(()=>sbClient.from('pontos_extras').delete().eq('id',id).eq('user_id',uid).select('id'));
    if(!Array.isArray(rows)||!rows.some(row=>row.id===id))throw Error('Exclusão não confirmada. Atualize a lista e tente novamente.');
    publishBonuses(getPontosExtrasLocal().filter(item=>item.id!==id));return {status:'confirmed',id};
  });
}


  root.AppRepositories = root.AppRepositories || {};
  root.AppRepositories.performance = { dbMetasLoad, dbMetasSave, dbMetasDelete, dbScoringLoad, dbScoringSave, dbAlertasLoad, dbAlertasSave, dbPontosExtrasLoad, dbPontosExtrasSave, dbPontosExtrasDelete };
})(window);
