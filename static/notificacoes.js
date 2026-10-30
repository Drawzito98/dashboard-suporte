// Notificações compartilhadas: leitura administrativa e confirmação por ID.
let _notificacoesCache = null;
let _notificacoesListeners = [];
let _notificacoesOwner = null;
let _notificacoesStatus = 'idle';
function onNotificacoesChange(fn){_notificacoesListeners.push(fn);}
function _emitNotificacoesChange(){_notificacoesListeners.forEach(fn=>{try{fn(_notificacoesCache);}catch(error){console.warn('Não foi possível atualizar a visualização de notificações.',error);}});}
function _currentNotificacoes(){return _notificacoesOwner===AppDataSession.owner()&&AppDataSession.owner()?(_notificacoesCache||[]):[];}
function getNotificacoesNaoLidas(){return _currentNotificacoes().filter(n=>!n.lida);}
function _notificationId(id){if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id||''))throw Error('Notificação inválida. Atualize a lista.');return id;}
async function criarNotificacao(tipo,descricao,link){
  const token=AppDataSession.token(),user=getCurrentUser();
  if(!user||isAdmin()||!AppDataSession.current(token)||user.id!==token.owner)return{status:'skipped'};
  try{
    if(!sbClient)throw Error('Sem conexão.');
    const uid=await _getUserId();if(!AppDataSession.current(token)||uid!==token.owner)return{status:'cancelled'};
    // O autor não-admin não possui SELECT. Conferir erro do INSERT sem exigir retorno proibido pela RLS.
    const {error}=await sbClient.from('notificacoes').insert({id:crypto.randomUUID(),tipo,descricao,link:link||'',actor_id:uid,actor_email:user.email||''});
    if(!AppDataSession.current(token))return{status:'cancelled'};
    if(error)throw error;
    return{status:'accepted'};
  }catch(error){
    if(AppDataSession.current(token)){
      console.warn('Notificação não confirmada.',error);
      if(typeof showToast==='function')showToast('A ação foi salva, mas a notificação à gestão não foi confirmada.','error');
    }
    return{status:'unconfirmed'};
  }
}
async function dbNotificacoesLoad(){
  const token=AppDataSession.token(),revision=_confirmedRevisions.get('notificacoes');
  if(!sbClient||!isAdmin()||!AppDataSession.current(token))return[];
  try{
    const uid=await _getUserId();if(!AppDataSession.current(token)||uid!==token.owner||!isAdmin())return[];
    const {data,error}=await sbClient.from('notificacoes').select('*').order('created_at',{ascending:false}).order('id',{ascending:false}).limit(50);
    if(!AppDataSession.current(token)||revision!==_confirmedRevisions.get('notificacoes'))return _currentNotificacoes();
    if(error||!Array.isArray(data))throw Error('Consulta não confirmada.');
    _notificacoesCache=data;_notificacoesOwner=token.owner;_notificacoesStatus='confirmed';_emitNotificacoesChange();return data;
  }catch(error){
    if(AppDataSession.current(token)&&revision===_confirmedRevisions.get('notificacoes')){_notificacoesStatus='error';_emitNotificacoesChange();}
    return _currentNotificacoes();
  }
}
async function _markNotificacoes(ids){
  ids=[...new Set(ids.map(_notificationId))];
  if(!ids.length)return{status:'confirmed',ids:[]};
  return _confirmedWrite('notificacoes',async({request})=>{
    if(!isAdmin())throw Error('Acesso administrativo necessário.');
    const rows=await request(()=>sbClient.from('notificacoes').update({lida:true}).in('id',ids).select('id,lida'));
    const confirmed=Array.isArray(rows)?rows.filter(row=>ids.includes(row.id)&&row.lida===true).map(row=>row.id):[];
    _notificacoesCache=_currentNotificacoes().map(row=>confirmed.includes(row.id)?{...row,lida:true}:row);
    _notificacoesOwner=AppDataSession.owner();_emitNotificacoesChange();
    if(ids.some(id=>!confirmed.includes(id)))throw Error('Algumas notificações não foram confirmadas como lidas. Atualize a lista ou tente novamente.');
    return{status:'confirmed',ids:confirmed};
  });
}
async function marcarNotificacaoLida(id){return _markNotificacoes([id]);}
async function marcarTodasNotificacoesLidas(){return _markNotificacoes(getNotificacoesNaoLidas().map(n=>n.id));}
window.addEventListener('app-session-invalidated',()=>{
  _notificacoesCache=null;_notificacoesOwner=null;_notificacoesStatus='idle';_emitNotificacoesChange();
});
