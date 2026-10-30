// Situação confirmada por conta. As chaves antigas ficam preservadas, sem reenvio.
const DEFAULT_INACTIVE = ['Caio', 'Carina', 'Diogo', 'Gabriel', 'Jessé', 'Joyce', 'Maxsuel', 'Victor'];
function inactiveSnapshot(resource,key,fallback){
  const state=typeof AppState!=='undefined'?AppState.get(resource):null;
  if(Array.isArray(state))return new Set(state.map(row=>row.nome));
  try{const cached=JSON.parse(appStorage.getItem(key)||'null');if(Array.isArray(cached))return new Set(cached.map(row=>row.nome));}catch(_){}
  return new Set(fallback);
}
function getInactiveColabs(){return inactiveSnapshot('inativos','sistema_inativos_confirmados_v1',DEFAULT_INACTIVE);}
function normalizeInactiveColabName(name){return typeof normalizeNameShared==='function'?normalizeNameShared(name):String(name||'').trim().normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase();}
async function setColabActive(name,active,id){return dbInativosSave({name,active,id});}
function isColabActive(name){const normalized=normalizeInactiveColabName(name);return !normalized||![...getInactiveColabs()].some(inactive=>normalizeInactiveColabName(inactive)===normalized);}
function getInactiveSetores(){return inactiveSnapshot('setorInativos','sistema_setores_inativos_confirmados_v1',[]);}
async function setSetorActive(name,active,id){return dbSetorInativosSave({name,active,id});}
function isSetorActive(name){return !getInactiveSetores().has(name);}
function refreshActiveConsumers(){
  if(typeof rawRecords==='undefined')return;
  if(typeof invalidateGamificationCache==='function')invalidateGamificationCache();
  if(typeof globalFilters!=='undefined'){globalFilters.popularOptions();globalFilters._notify();}
  if(typeof updateFilterOptions==='function')updateFilterOptions();
  if(typeof updateView==='function')updateView();
  if(typeof renderColaboradores==='function')renderColaboradores();
}
window.addEventListener('colab-active-state-changed',refreshActiveConsumers);
window.addEventListener('setor-active-state-changed',refreshActiveConsumers);
