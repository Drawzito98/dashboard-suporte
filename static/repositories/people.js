// Persistência de people; contratos preservados pelo facade db-extra.js.
(function (root) {
// ─── FOTOS ───────────────────────────────────────────────────────



function photoMap(){const state=typeof AppState!=='undefined'?AppState.get('fotos'):null;return state||_fallbackLoad(FOTOS_LOCAL_KEY,{});}
function publishPhotos(map){_confirmedCache(FOTOS_LOCAL_KEY,map);if(typeof AppState!=='undefined')AppState.publish('fotos',map);window.dispatchEvent(new CustomEvent('colab-fotos-updated'));}
async function dbFotosLoad(){
  const token=AppDataSession.token(),revision=_confirmedRevisions.get('fotos');
  if(!sbClient||!AppDataSession.current(token))return photoMap();
  try{const uid=await _getUserId();if(!uid||!AppDataSession.current(token))return photoMap();const map={};
    for(let start=0;;start+=500){const {data,error}=await sbClient.from('colaborador_fotos').select('*').order('id',{ascending:true}).range(start,start+499);
      if(!AppDataSession.current(token)||revision!==_confirmedRevisions.get('fotos'))return photoMap();if(error||!Array.isArray(data))return photoMap();
      for(const row of data){if(!row.nome)continue;const normalize=value=>typeof normalizeColabFotoName==='function'?normalizeColabFotoName(value):String(value).trim().toLowerCase();Object.keys(map).forEach(name=>{if(name!==row.nome&&normalize(name)===normalize(row.nome))delete map[name];});map[row.nome]=row.foto_url||'';}if(data.length<500)break;
    }publishPhotos(map);return map;
  }catch(_){return photoMap();}
}
async function dbFotoSave(nome,url,draftId){
  if(!requireAdmin())throw Error('Apenas administradores podem alterar fotos.');
  const id=_writeUuid(draftId);
  return _confirmedWrite('fotos',async({request})=>{
    const existing=await request(()=>sbClient.from('colaborador_fotos').select('*').eq('nome',nome).maybeSingle());
    if(existing&&existing.nome!==nome)throw Error('Foto não confirmada.');
    if(!url){if(existing){const removed=await request(()=>sbClient.from('colaborador_fotos').delete().eq('id',existing.id).eq('nome',nome).select('id'));
        if(!Array.isArray(removed)||!removed.some(row=>row.id===existing.id))throw Error('Remoção da foto não confirmada.');}
      const map={...photoMap()};delete map[nome];publishPhotos(map);return {status:'confirmed'};}
    const saved=await request(()=>existing?sbClient.from('colaborador_fotos').update({foto_url:url,updated_at:new Date().toISOString()}).eq('id',existing.id).eq('nome',nome).select('*').single():sbClient.from('colaborador_fotos').upsert({id,nome,foto_url:url,updated_at:new Date().toISOString()},{onConflict:'id'}).select('*').single());
    if(!saved?.id||saved.nome!==nome||saved.foto_url!==url)throw Error('O servidor não confirmou a foto.');
    publishPhotos({...photoMap(),[nome]:saved.foto_url});return {status:'confirmed'};
  });
}

// ─── COLABORADORES INATIVOS ──────────────────────────────────────



async function dbInativosLoad() {
  const token=AppDataSession.token(),revision=_confirmedRevisions.get('inativos');
  if (!sbClient) return null;
  try {
    const uid = await _getUserId();
    if (!uid) return null;
    const { data, error } = await sbClient.from('colab_inativos').select('nome').eq('user_id', uid);
    if(!AppDataSession.current(token)||revision!==_confirmedRevisions.get('inativos'))return null;
    if (!error && Array.isArray(data)) {
      const names = data.map(r => r.nome);
      appStorage.setItem(INATIVOS_LOCAL_KEY, JSON.stringify(names));
      if (typeof window.__inactiveColabs !== 'undefined') {
        window.__inactiveColabs = new Set(names);
      }
      window.dispatchEvent(new CustomEvent('colab-active-state-changed'));
      return new Set(names);
    }
    return null;
  } catch { return null; }
}

async function dbInativosSave(names) {
  if (!requireAdmin()) return;
  const arr = [...names];
  appStorage.setItem(INATIVOS_LOCAL_KEY, JSON.stringify(arr));
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



async function dbSetorInativosLoad() {
  if (!sbClient) return null;
  try {
    const uid = await _getUserId();
    if (!uid) return null;
    const { data, error } = await sbClient.from('setor_inativos').select('nome').eq('user_id', uid);
    if (!error && Array.isArray(data)) {
      const names = data.map(r => r.nome);
      appStorage.setItem(INATIVOS_SETORES_LOCAL_KEY, JSON.stringify(names));
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
  appStorage.setItem(INATIVOS_SETORES_LOCAL_KEY, JSON.stringify(arr));
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


// ─── COLABORADORES INFO (Cadastro) ─────────────────────────────



const profileFields=['data_aniversario','data_admissao','email','setor_atual','tarefas_desempenhadas','objetivos_futuros','observacoes','conduta_negativa','conduta_motivo','feito_relevante','feito_descricao','nivel','salario'];
function profileModel(row){
  const info={id:row.id,updatedAt:row.updated_at};
  for(const field of profileFields)info[field]=field==='salario'?(row[field]==null?null:Number(row[field])):(row[field]||'');
  return info;
}
function profileMap(){return getColabInfoLocal();}
function publishProfiles(map){
  // Preserve a própria cópia anterior à confirmação uniforme, sem mesclá-la no servidor.
  let cacheAllowed=true;
  if(typeof AppState==='undefined'||!AppState.get('colaboradores')){
    try{const previous=appStorage.getItem(COLAB_INFO_LOCAL_KEY),backupKey='sistema_colaboradores_backup_v1';
      if(previous&&Object.keys(JSON.parse(previous)).length&&!appStorage.getItem(backupKey))appStorage.setItem(backupKey,previous);
    }catch(_){cacheAllowed=false;}
  }
  if(cacheAllowed)_confirmedCache(COLAB_INFO_LOCAL_KEY,map);
  if(typeof AppState!=='undefined')AppState.publish('colaboradores',map);
}
async function dbColabInfoLoad(){
  const token=AppDataSession.token(),revision=_confirmedRevisions.get('colaboradores');
  if(!sbClient||!AppDataSession.current(token))return profileMap();
  try{
    const uid=await _getUserId();if(!uid||!AppDataSession.current(token))return profileMap();
    const map={};
    for(let start=0;;start+=500){
      const {data,error}=await sbClient.from('colaboradores_info').select('*').eq('user_id',uid).order('nome',{ascending:true}).order('id',{ascending:true}).range(start,start+499);
      if(!AppDataSession.current(token)||revision!==_confirmedRevisions.get('colaboradores'))return profileMap();
      if(error||!Array.isArray(data)||data.some(r=>r.user_id!==uid||!r.nome))return profileMap();
      data.forEach(row=>{map[row.nome]=profileModel(row);});if(data.length<500)break;
    }
    publishProfiles(map);return map;
  }catch(_){return profileMap();}
}
async function dbColabInfoSave(nome,data){
  if(!requireAdmin())throw Error('Apenas administradores podem alterar cadastros.');
  if(typeof nome!=='string'||!nome.trim())throw Error('Informe o colaborador.');
  const patch={};
  for(const field of profileFields){if(!Object.prototype.hasOwnProperty.call(data,field))continue;
    patch[field]=field==='salario'?(data[field]==null||data[field]===''?null:Number(data[field])):field.startsWith('data_')?(data[field]||null):(data[field]||'');
  }
  if(patch.salario!=null&&(!Number.isFinite(patch.salario)||patch.salario<0||patch.salario>99999999.99))throw Error('Salário inválido.');
  return _confirmedWrite('colaboradores',async({uid,request})=>{
    // A chave única existente (user_id,nome) torna a retentativa idempotente.
    const row=await request(()=>sbClient.from('colaboradores_info').upsert({user_id:uid,nome,...patch,updated_at:new Date().toISOString()},{onConflict:'user_id,nome'}).select('*').single());
    if(!row?.id||row.nome!==nome||row.user_id!==uid)throw Error('O servidor não confirmou o cadastro. Seu rascunho foi mantido.');
    const confirmed=profileModel(row);publishProfiles({...profileMap(),[nome]:confirmed});
    return {status:'confirmed',data:confirmed};
  });
}

// Reativação usada ao cadastrar: somente os registros desta pessoa, nunca a coleção.
async function dbColabActivate(nome){
  if(!requireAdmin())throw Error('Apenas administradores podem reativar colaboradores.');
  const normalize=value=>typeof normalizeInactiveColabName==='function'?normalizeInactiveColabName(value):String(value||'').trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  return _confirmedWrite('inativos',async({uid,request})=>{
    const rows=[];
    for(let start=0;;start+=500){const page=await request(()=>sbClient.from('colab_inativos').select('*').eq('user_id',uid).order('id',{ascending:true}).range(start,start+499));
      if(!Array.isArray(page)||page.some(r=>r.user_id!==uid))throw Error('Não foi possível confirmar a situação do colaborador.');rows.push(...page);if(page.length<500)break;}
    const matches=rows.filter(r=>normalize(r.nome)===normalize(nome));
    for(const row of matches){const removed=await request(()=>sbClient.from('colab_inativos').delete().eq('id',row.id).eq('user_id',uid).select('id'));
      if(!Array.isArray(removed)||!removed.some(r=>r.id===row.id))throw Error('Reativação não confirmada. Tente novamente.');}
    const names=rows.filter(r=>!matches.includes(r)).map(r=>r.nome);
    _confirmedCache(INATIVOS_LOCAL_KEY,names);_confirmedCache('sistema_inactive_colabs_v1',names);
    window.__inactiveColabs=new Set(names);window.dispatchEvent(new CustomEvent('colab-active-state-changed'));
    return {status:'confirmed'};
  });
}


  root.AppRepositories = root.AppRepositories || {};
  root.AppRepositories.people = { dbFotosLoad, dbFotoSave, dbInativosLoad, dbInativosSave, dbSetorInativosLoad, dbSetorInativosSave, dbColabInfoLoad, dbColabInfoSave, dbColabActivate };
})(window);
