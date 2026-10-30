// Rascunhos e operações do editor; a persistência permanece na fachada/repository.
(function(root){
  const config={
    ferias:{key:'sistema_ferias_rascunho_v1',host:'feriasOverlayContent',overlay:'feriasOverlay',fields:{colaborador:'feriasColabInput',data_inicio:'feriasInicioInput',data_fim:'feriasFimInput'}},
    avaliacao_atendimentos:{key:'sistema_avaliacao_atend_rascunho_v1',host:'avaliarAtendimentoOverlayContent',overlay:'avaliarAtendimentoOverlay',fields:{protocolo:'avalProtocoloInput',colaborador:'avalColaboradorInput',data_atendimento:'avalDataInput',teve_nota:'avalTeveNotaInput',nota:'avalNotaInput',justa:'avalJustaInput',orientacao:'avalOrientacaoInput',resumo:'avalResumoInput'}},
    acompanhamento_diario:{key:'sistema_acomp_diario_rascunho_v1',host:'acompDiarioOverlayContent',overlay:'acompDiarioOverlay',fields:{colaborador:'acdColabInput',data:'acdDataInput',setor:'acdSetorInput',assumidos:'acdAssumidosInput',transferidos:'acdTransferidosInput',finalizados:'acdFinalizadosInput',nota:'acdNotaInput'}},
    ausencias:{key:'sistema_ausencia_rascunho_v1',host:'ausenciasOverlayContent',overlay:'ausenciasOverlay',fields:{colaborador:'ausenciaColabInput',data:'ausenciaDataInput',periodo:'ausenciaPeriodoInput',motivo:'ausenciaMotivoInput'}}
  },busy={},failed={};
  const scratch={},newResources=['avaliacao_atendimentos','acompanhamento_diario'];
  const draft=resource=>{if(newResources.includes(resource)&&Object.prototype.hasOwnProperty.call(scratch,resource))return scratch[resource];try{return JSON.parse(appStorage.getItem(config[resource].key)||'null');}catch(_){return null;}};
  function message(resource,text){const host=document.getElementById(config[resource].host);if(!host)return;let el=host.querySelector('.presence-message');if(!el){el=document.createElement('p');el.className='ui-message presence-message';el.setAttribute('role','alert');host.prepend(el);}el.textContent=text;}
  function store(resource,value){const stored={...value,_requestId:value._requestId||crypto.randomUUID()};if(newResources.includes(resource))scratch[resource]=stored;try{appStorage.setItem(config[resource].key,JSON.stringify(stored));failed[resource]=false;return true;}catch(_){failed[resource]=true;message(resource,'Não foi possível guardar o rascunho. Mantenha esta tela aberta.');return false;}}
  function capture(resource){const values={};for(const [field,id]of Object.entries(config[resource].fields)){const el=document.getElementById(id);if(!el)return true;values[field]=el.type==='checkbox'?el.checked:el.value;}return store(resource,{...(draft(resource)||{}),...values});}
  function render(resource){if(busy[resource]||failed[resource])return;if(resource==='ferias')renderFerias(config[resource].host);else if(resource==='ausencias')renderAusencias(config[resource].host);else if(resource==='avaliacao_atendimentos')renderAvaliacaoAtendimento(config[resource].host);else renderAcompDiario(config[resource].host);}
  function discard(resource){if(busy[resource]||!confirm(getPresencePending(resource)?'Descartar o rascunho? O envio sem confirmação continua aguardando conferência.':'Descartar este rascunho?'))return;appStorage.removeItem(config[resource].key);delete scratch[resource];failed[resource]=false;render(resource);}
  function edit(resource,row){if(!requireAdmin()||busy[resource])return;const old=draft(resource);if(old&&String(old.id)!==String(row.id)&&!confirm('Descartar o rascunho atual e abrir este registro?'))return;if(old&&String(old.id)===String(row.id))return;if(store(resource,{...row,_editing:true}))render(resource);}
  async function run(resource,operation,done){
    if(busy[resource])return;
    const token=AppDataSession.token(),host=document.getElementById(config[resource].host),controls=[...host.querySelectorAll('button,input,select,textarea')],disabled=controls.map(el=>el.disabled);
    busy[resource]=true;host.setAttribute('aria-busy','true');controls.forEach(el=>el.disabled=true);message(resource,'Aguardando confirmação do servidor…');
    let error;
    try{const result=await operation();if(AppDataSession.current(token))done?.(result);}catch(caught){error=caught;}
    finally{busy[resource]=false;host.removeAttribute('aria-busy');controls.forEach((el,i)=>el.disabled=disabled[i]);}
    if(!AppDataSession.current(token))return;
    render(resource);if(error)message(resource,error.message||'O servidor não confirmou. O rascunho foi mantido.');
  }
  function finish(resource){appStorage.removeItem(config[resource].key);delete scratch[resource];failed[resource]=false;showToast('Registro confirmado.','success',resource==='ferias'?'Férias':resource==='ausencias'?'Ausências':'Atendimentos');}
  function close(resource){if(busy[resource]||(failed[resource]&&!capture(resource)))return false;const overlay=document.getElementById(config[resource].overlay);overlay?.classList.remove('open');overlay?.setAttribute('aria-hidden','true');return true;}
  function open(resource){if(busy[resource])return;const overlay=document.getElementById(config[resource].overlay);if(!overlay)return;overlay.setAttribute('aria-hidden','false');overlay.classList.add('open');render(resource);const token=AppDataSession.token(),load=resource==='ferias'?dbFeriasLoad:resource==='ausencias'?dbAusenciasLoad:resource==='avaliacao_atendimentos'?dbAvaliacaoAtendLoad:dbAcompDiarioLoad;load().then(()=>{if(AppDataSession.current(token))render(resource);}).catch(()=>{});}
  function decorate(resource){
    const host=document.getElementById(config[resource].host);if(!host)return;
    Object.values(config[resource].fields).forEach(id=>{const el=document.getElementById(id);el?.addEventListener('input',()=>capture(resource));el?.addEventListener('change',()=>capture(resource));});
    const actions=document.createElement('div');actions.className='btn-row';
    const drop=document.createElement('button');drop.type='button';drop.className='btn-small';drop.id=resource+'DescartarBtn';drop.textContent='Descartar rascunho';drop.onclick=()=>discard(resource);actions.append(drop);
    const hint=document.createElement('p');hint.className='hint';hint.textContent='Fechar preserva sua edição neste dispositivo.';host.prepend(actions,hint);
    const refresh=document.getElementById(resource==='ferias'?'feriasRefreshBtn':resource==='ausencias'?'ausenciaRefreshBtn':resource==='avaliacao_atendimentos'?'avalRefreshBtn':'acdRefreshBtn');refresh?.addEventListener('click',()=>run(resource,async()=>{await (resource==='ferias'?dbFeriasLoad():resource==='ausencias'?dbAusenciasLoad():resource==='avaliacao_atendimentos'?dbAvaliacaoAtendLoad():dbAcompDiarioLoad());if(!presenceReadConfirmed(resource))throw Error('A consulta ao servidor não foi confirmada. Confira a conexão antes de liberar outra criação.');}));
    const readState=typeof AppState!=='undefined'?AppState.get('presencaLeitura:'+resource):null;if(readState?.confirmed===false)message(resource,'A consulta ao servidor não foi confirmada. A lista mantém a cópia desta conta.');
    const pending=getPresencePending(resource);if(!pending)return;
    const notice=document.createElement('section');notice.className='card';const text=document.createElement('p');text.textContent='Há uma criação sem confirmação. Consulte a lista. Se o registro já aparece, vincule-o ao rascunho antes de salvar novamente.';notice.append(text);
    const release=document.createElement('button');release.type='button';release.className='btn-small';release.id=resource+'LiberarBtn';release.textContent='Permitir novo envio';release.onclick=()=>{if(!requireAdmin()||busy[resource])return;if(!presenceReadConfirmed(resource)){message(resource,'Use Atualizar lista e aguarde uma consulta confirmada ao servidor antes de liberar outra criação.');return;}if(!confirm('O primeiro envio pode ter sido gravado, mesmo sem resposta. Confira a lista para evitar duplicação. Deseja liberar uma nova criação?'))return;try{clearPresencePending(resource);const current=draft(resource);if(current&&!store(resource,{...current,_requestId:crypto.randomUUID()}))return;render(resource);}catch(error){message(resource,error.message);}};notice.append(release);host.prepend(notice);
    const fields=Object.keys(config[resource].fields).concat(resource==='avaliacao_atendimentos'?['imagem']:[]);
    host.querySelectorAll(resource==='ferias'?'.ferias-del-btn':resource==='ausencias'?'.ausencias-del-btn':resource==='avaliacao_atendimentos'?'.aval-del-btn':'.acd-del-btn').forEach(button=>{
      const row=getPresenceList(resource).find(item=>String(item.id)===button.dataset.id);if(!row||!fields.every(field=>String(row[field]??'')===String(pending.data?.[field]??'')))return;
      const link=document.createElement('button');link.type='button';link.className='btn-small presence-link';link.dataset.id=String(row.id);link.textContent='Vincular ao rascunho';
      link.onclick=()=>{if(!requireAdmin()||busy[resource]||!confirm('Usar este registro confirmado para retomar a edição, sem criar outro?'))return;let current=draft(resource);if(current?._requestId===pending.requestId){if(!capture(resource))return;current=draft(resource);}else if(current&&!confirm('Descartar a edição atual e recuperar o rascunho do envio selecionado?'))return;const value=current?._requestId===pending.requestId?current:pending.data;if(!store(resource,{...value,id:row.id,_editing:true}))return;try{clearPresencePending(resource);render(resource);}catch(error){message(resource,error.message);}};button.parentElement.append(link);
    });
  }
  window.addEventListener('beforeunload',event=>{if(newResources.some(resource=>busy[resource]||failed[resource])){event.preventDefault();event.returnValue='';}});
  root.PresenceEditor={draft,store,capture,render,discard,edit,run,finish,open,close,decorate,message,busy:resource=>Boolean(busy[resource]),blocked:resource=>Boolean(busy[resource]||failed[resource])};
})(window);
