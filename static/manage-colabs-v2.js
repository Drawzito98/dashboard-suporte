// Gerenciadores de situação: uma escolha durável por domínio, sem envio automático.
(function(){
  'use strict';
  const esc=v=>typeof escapeHtmlShared==='function'?escapeHtmlShared(String(v??'')):escapeHtml(String(v??''));
  const configs={
    colabs:{host:'manageColabsContent',close:'manageColabsClose',done:'manageColabsDoneBtn',key:'sistema_colab_situacao_pendente_v1',title:'Gerenciar colaboradores',item:'Colaborador',toggle:'colab-active-toggle',load:()=>dbInativosLoad(),save:p=>setColabActive(p.name,p.active,p.id),active:n=>isColabActive(n),inactive:()=>getInactiveColabs()},
    setores:{host:'manageSetoresContent',close:'manageSetoresClose',done:'manageSetoresDoneBtn',key:'sistema_setor_situacao_pendente_v1',title:'Gerenciar setores',item:'Setor',toggle:'setor-active-toggle',load:()=>dbSetorInativosLoad(),save:p=>setSetorActive(p.name,p.active,p.id),active:n=>isSetorActive(n),inactive:()=>getInactiveSetores()}
  };
  const states={colabs:{loaded:false,pending:null,busy:false,failed:false},setores:{loaded:false,pending:null,busy:false,failed:false}};
  function state(kind){const s=states[kind];if(!s.loaded){try{const p=JSON.parse(appStorage.getItem(configs[kind].key)||'null');s.pending=p&&typeof p.name==='string'&&typeof p.active==='boolean'&&typeof p.id==='string'?p:null;}catch(_){}s.loaded=true;}return s;}
  function message(kind,text){const el=document.getElementById(kind+'SituationMessage');if(el)el.textContent=text;}
  function store(kind,pending){const s=state(kind),previous=s.pending;s.pending=pending;try{if(pending)appStorage.setItem(configs[kind].key,JSON.stringify(pending));else appStorage.removeItem(configs[kind].key);s.failed=false;return true;}catch(_){if(pending===null)s.pending=previous;s.failed=true;message(kind,'Não foi possível guardar a escolha. Mantenha esta tela aberta.');return false;}}
  function names(kind){
    const key=kind==='colabs'?'Atendente':'Setor',records=typeof rawRecords!=='undefined'?rawRecords:[],registered=kind==='colabs'&&typeof getColabInfoLocal==='function'?Object.keys(getColabInfoLocal()):[];
    return [...new Set([...(records||[]).map(r=>r?.[key]).filter(Boolean),...registered,...configs[kind].inactive()])].filter(n=>n&&(kind!=='colabs'||typeof isAggregateName!=='function'||!isAggregateName(n))).sort((a,b)=>a.localeCompare(b,'pt-BR'));
  }
  async function run(kind,operation,done,success='Situação confirmada.'){
    const s=state(kind);if(s.busy)return;s.busy=true;render(kind);const token=AppDataSession.token();message(kind,'Aguardando confirmação do servidor…');
    try{await operation();if(AppDataSession.current(token)){done?.();s.busy=false;render(kind);message(kind,s.failed?'Situação confirmada, mas não foi possível atualizar a escolha neste dispositivo. Confira antes de repetir.':success);}}
    catch(error){if(AppDataSession.current(token)){s.busy=false;render(kind);message(kind,error.message||'Alteração não confirmada. Sua escolha foi mantida.');}}
    finally{s.busy=false;}
  }
  function close(kind){if(kind==='colabs')closeManageColabs();else closeManageSetores();}
  function render(kind){
    const c=configs[kind],s=state(kind),host=document.getElementById(c.host);if(!host)return;
    const registered=kind==='colabs'&&typeof getColabInfoLocal==='function'?Object.keys(getColabInfoLocal()):[];
    const allNames=names(kind),admin=document.body.dataset.role==='admin',pending=s.pending;
    host.setAttribute('aria-busy',String(s.busy));
    host.innerHTML=`<div class="mc-panel"><div class="mc-header"><div><span>${kind==='colabs'?'GESTÃO DA EQUIPE':'GESTÃO DOS SETORES'}</span><h2>${c.title}</h2><p>A situação confirmada controla a exibição nos filtros e análises desta conta.</p></div>${kind==='colabs'&&admin?`<button class="btn-primary" id="manageColabsAddBtn" type="button"${s.busy||pending?' disabled':''}>+ Novo colaborador</button>`:''}</div>
      <p id="${kind}SituationMessage" role="status" aria-live="polite"></p>
      ${pending?`<section class="card"><p>Escolha para conferir: <strong>${esc(pending.name)}</strong> → ${pending.active?'Ativo':'Inativo'}.</p><p>A lista abaixo mostra a situação confirmada. Fechar preserva esta escolha; nada será reenviado automaticamente.</p><button class="btn-primary" data-retry type="button"${s.busy||!admin?' disabled':''}>Confirmar escolha</button> <button class="btn-small" data-discard type="button"${s.busy?' disabled':''}>Descartar escolha</button></section>`:''}
      <div class="mc-summary"><strong>${allNames.length}</strong><span>${kind==='colabs'?'colaboradores':'setores'} na lista</span></div>
      <button class="btn-small" data-refresh type="button"${s.busy?' disabled':''}>Atualizar lista</button>
      ${allNames.length?`<div class="mc-table table-wrap"><table class="ranking-table"><thead><tr><th>${c.item}</th>${kind==='colabs'?'<th>Origem</th>':''}<th>Situação</th></tr></thead><tbody>${allNames.map(name=>{const active=c.active(name);return `<tr><td><strong>${esc(name)}</strong></td>${kind==='colabs'?`<td><span class="mc-origin">${registered.includes(name)?'Cadastro':'Dados importados'}</span></td>`:''}<td><label class="mc-toggle"><input type="checkbox" class="${c.toggle}" data-name="${esc(name)}" aria-label="${esc(name)} ativo"${active?' checked':''}${s.busy||pending||!admin?' disabled':''}><span class="${active?'is-active':''}">${active?'Ativo':'Inativo'}</span></label></td></tr>`;}).join('')}</tbody></table></div>`:'<div class="empty-state"><div class="empty-title">Nenhum item encontrado</div></div>'}
      <div class="mc-footer"><button class="btn-primary" id="${c.done}" type="button"${s.busy?' disabled':''}>Concluído</button></div></div>`;
    document.getElementById(c.done)?.addEventListener('click',()=>close(kind));
    host.querySelector('[data-refresh]')?.addEventListener('click',()=>refresh(kind));
    host.querySelector('[data-retry]')?.addEventListener('click',()=>{if(!requireAdmin()||!s.pending||!store(kind,s.pending))return;const p={...s.pending};run(kind,()=>c.save(p),()=>store(kind,null));});
    host.querySelector('[data-discard]')?.addEventListener('click',()=>{if(s.busy||!confirm('Descartar esta escolha? Uma tentativa anterior pode já ter sido aplicada. Consulte a lista antes de escolher novamente.'))return;if(store(kind,null))render(kind);});
    host.querySelectorAll('.'+c.toggle).forEach(input=>input.addEventListener('change',()=>{
      if(s.busy||s.pending||!requireAdmin()){render(kind);return;}
      const p={name:input.dataset.name,active:input.checked,id:crypto.randomUUID()};
      if(!store(kind,p)){render(kind);message(kind,'Não foi possível guardar a escolha. Mantenha esta tela aberta.');return;}
      run(kind,()=>c.save(p),()=>store(kind,null));
    }));
    if(kind==='colabs')document.getElementById('manageColabsAddBtn')?.addEventListener('click',()=>{if(kind!=='colabs'||s.busy||s.pending||!requireAdmin())return;closeManageColabs();if(typeof openNovoColaboradorModal==='function')openNovoColaboradorModal();});
  }
  function refresh(kind){return run(kind,()=>configs[kind].load(),null,'Lista consultada. Em falha de conexão, a última situação confirmada é mantida.');}
  window.ActiveManagers={refresh,canClose:kind=>{const s=state(kind);return !s.busy&&!s.failed;}};
  window.renderManageColabs=()=>render('colabs');window.renderManageSetores=()=>render('setores');
  for(const kind of Object.keys(configs))document.getElementById(configs[kind].close)?.addEventListener('click',()=>close(kind));
  window.addEventListener('beforeunload',event=>{if(Object.values(states).some(s=>s.busy||s.failed)){event.preventDefault();event.returnValue='';}});
})();
