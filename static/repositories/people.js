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

// Situação por conta: mutações individuais, nunca substituição da coleção.
const inactiveConfigs={
  inativos:{table:'colab_inativos',key:'sistema_inativos_confirmados_v1',event:'colab-active-state-changed'},
  setorInativos:{table:'setor_inativos',key:'sistema_setores_inativos_confirmados_v1',event:'setor-active-state-changed'}
};
function inactiveRows(resource){const state=typeof AppState!=='undefined'?AppState.get(resource):null;return Array.isArray(state)?state:_confirmedList(inactiveConfigs[resource].key);}
function publishInactive(resource,rows){
  _confirmedCache(inactiveConfigs[resource].key,rows);
  if(typeof AppState!=='undefined')AppState.publish(resource,rows);
  window[resource==='inativos'?'__inactiveColabs':'__inactiveSetores']=new Set(rows.map(r=>r.nome));
  window.dispatchEvent(new CustomEvent(inactiveConfigs[resource].event));
}
async function fetchInactive(resource,uid,request){
  const rows=[];
  for(let start=0;;start+=500){
    const page=await request(()=>sbClient.from(inactiveConfigs[resource].table).select('*').eq('user_id',uid).order('id',{ascending:true}).range(start,start+499));
    if(!Array.isArray(page)||page.some(r=>!r.id||r.user_id!==uid||typeof r.nome!=='string'))throw Error('Não foi possível confirmar a lista de inativos.');
    rows.push(...page);if(page.length<500)break;
  }
  return rows;
}
async function loadInactive(resource){
  const token=AppDataSession.token(),revision=_confirmedRevisions.get(resource);
  if(!sbClient||!AppDataSession.current(token))return new Set(inactiveRows(resource).map(r=>r.nome));
  try{
    const uid=await _getUserId();if(!uid||!AppDataSession.current(token))return new Set(inactiveRows(resource).map(r=>r.nome));
    const rows=await fetchInactive(resource,uid,async build=>{const result=await build();if(!AppDataSession.current(token)||revision!==_confirmedRevisions.get(resource))throw Error('Leitura desatualizada.');if(result.error)throw result.error;return result.data;});
    if(!AppDataSession.current(token)||revision!==_confirmedRevisions.get(resource))return new Set(inactiveRows(resource).map(r=>r.nome));
    publishInactive(resource,rows);return new Set(rows.map(r=>r.nome));
  }catch(_){return new Set(inactiveRows(resource).map(r=>r.nome));}
}
function inactiveEquivalent(resource,a,b){return resource==='inativos'?
  (typeof normalizeInactiveColabName==='function'?normalizeInactiveColabName(a)===normalizeInactiveColabName(b):String(a).trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()===String(b).trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()):a===b;}
async function setInactive(resource,change){
  if(!requireAdmin())throw Error('Apenas administradores podem alterar a situação.');
  if(!change||typeof change.name!=='string'||!change.name.trim()||typeof change.active!=='boolean')throw Error('Informe uma alteração individual de situação.');
  const {active,id}=change,name=resource==='inativos'?change.name.trim():change.name;
  if(!active&&_writeUuid(id)!==id)throw Error('Guarde o identificador da alteração antes de enviar.');
  return _confirmedWrite(resource,async({uid,request})=>{
    let rows=await fetchInactive(resource,uid,request);publishInactive(resource,rows);
    const matches=rows.filter(r=>inactiveEquivalent(resource,r.nome,name));
    if(active){
      let removed=0;
      for(const row of matches){
        try{
          const result=await request(()=>sbClient.from(inactiveConfigs[resource].table).delete().eq('id',row.id).eq('user_id',uid).select('id'));
          if(!Array.isArray(result)||!result.some(r=>r.id===row.id))throw Error('Exclusão não confirmada.');
          rows=rows.filter(r=>r.id!==row.id);publishInactive(resource,rows);removed++;
        }catch(error){throw Error(removed+' remoção(ões) confirmada(s). A reativação ainda precisa de conferência. '+error.message);}
      }
    }else if(!matches.length){
      const row=await request(()=>sbClient.from(inactiveConfigs[resource].table).insert({id,user_id:uid,nome:name}).select('*').single());
      if(!row||row.id!==id||row.user_id!==uid||row.nome!==name)throw Error('Inativação não confirmada. Sua escolha foi mantida.');
      rows.push(row);publishInactive(resource,rows);
    }
    return{status:'confirmed',name,active};
  });
}
async function dbInativosLoad(){return loadInactive('inativos');}
async function dbSetorInativosLoad(){return loadInactive('setorInativos');}
async function dbInativosSave(change){return setInactive('inativos',change);}
async function dbSetorInativosSave(change){return setInactive('setorInativos',change);}

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
async function dbColabActivate(nome){return setInactive('inativos',{name:nome,active:true});}

  root.AppRepositories = root.AppRepositories || {};
  root.AppRepositories.people = { dbFotosLoad, dbFotoSave, dbInativosLoad, dbInativosSave, dbSetorInativosLoad, dbSetorInativosSave, dbColabInfoLoad, dbColabInfoSave, dbColabActivate };
})(window);
