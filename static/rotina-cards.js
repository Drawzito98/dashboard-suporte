// rotina-cards.js — visualizações em cards para tarefas e anotações

const ROTINA_STATUS = [
  { id: 'pendente', label: 'Pendente', icon: '⏳' },
  { id: 'andamento', label: 'Em andamento', icon: '▶️' },
  { id: 'concluida', label: 'Concluída', icon: '✅' },
  { id: 'cancelada', label: 'Cancelada', icon: '❌' }
];
const ROTINA_DRAFT_KEY = 'sistema_tarefa_rascunho_v1';
let routineBusy = false;
function _routineDraft(key) { try { const value=JSON.parse(appStorage.getItem(key)||'null');return value&&typeof value==='object'?value:null; }catch(_){return null;} }
function _routineError(error) {
  const message=error?.message||'Não foi possível confirmar. Sua edição foi mantida.';
  showToast(message,'error','Rotina');
  for(const host of [document.getElementById('tarefasContent'),document.getElementById('anotacoesOverlayContent')]) {
    if(!host)continue;let notice=host.querySelector('.routine-save-message');
    if(!notice){notice=document.createElement('p');notice.className='routine-save-message';notice.setAttribute('role','alert');host.prepend(notice);}notice.textContent=message;
  }
}
function _routineStore(key,value) { if([ROTINA_DRAFT_KEY,ANOTACOES_EDITING_KEY].includes(key)){const id=_writeUuid(value.id);if(value.id&&value.id!==id)value={...value,_localId:value.id};value={...value,id};} try { appStorage.setItem(key,JSON.stringify(value));return true; }catch(_){_routineError(Error('Não foi possível guardar o rascunho neste dispositivo. Mantenha esta tela aberta.'));return false;} }
function _routineClear(key) { appStorage.removeItem(key); }
function _captureTask() {
  if(!document.getElementById('tarefaTituloInput'))return true;
  const draft=_routineDraft(ROTINA_DRAFT_KEY)||{};
  const value=id=>document.getElementById(id).value;
  return _routineStore(ROTINA_DRAFT_KEY,{...draft,id:draft.id||crypto.randomUUID(),titulo:value('tarefaTituloInput'),data:value('tarefaDataInput'),descricao:value('tarefaDescricaoInput'),prioridade:value('tarefaPrioridadeInput'),rotinaAtiva:document.getElementById('tarefaRotinaAtiva').checked,rotinaIntervalo:Math.max(1,Number(value('tarefaRotinaIntervalo')||15)),rotinaUnidade:value('tarefaRotinaUnidade'),rotinaLembreteDias:Number(value('tarefaRotinaLembrete')||0)});
}
function _captureNote() {
  if(!document.getElementById('anotacaoTextoInput'))return true;
  const draft=_routineDraft(ANOTACOES_EDITING_KEY)||{};
  return _routineStore(ANOTACOES_EDITING_KEY,{...draft,id:draft.id||crypto.randomUUID(),data:document.getElementById('anotacaoDataInput').value,conteudo:document.getElementById('anotacaoTextoInput').value,etiquetas:document.getElementById('anotacaoTagsInput').value});
}
function _routineSwitch(key,next) {
  const old=_routineDraft(key);
  if(old&&old.id!==next.id&&!confirm('Descartar o rascunho atual e abrir outra edição?'))return false;
  return _routineStore(key,{...next,id:next.id||crypto.randomUUID(),_editing:Boolean(next.id),_baseData:next.data,createdAt:next.createdAt||new Date().toISOString()});
}
async function _routineRun(operation,done) {
  if(routineBusy)return;
  const token=AppDataSession.token();routineBusy=true;
  const controls=[...document.querySelectorAll('#tarefasContent button,#tarefasContent input,#tarefasContent textarea,#tarefasContent select,#anotacoesOverlayContent button,#anotacoesOverlayContent input,#anotacoesOverlayContent textarea')];
  const previous=controls.map(c=>c.disabled);controls.forEach(c=>c.disabled=true);
  try{await operation();if(AppDataSession.current(token))done?.();}
  catch(error){if(AppDataSession.current(token)){_routineError(error);const host=document.getElementById('tarefasContent');if(host&&_routineDraft('sistema_tarefa_transicao_v1')&&!document.getElementById('tarefaRetryStatusBtn')){const retry=document.createElement('button');retry.id='tarefaRetryStatusBtn';retry.className='btn-small';retry.textContent='Tentar confirmar mudança';retry.onclick=()=>{const pending=_routineDraft('sistema_tarefa_transicao_v1');if(pending)_routineRun(()=>_setTarefaStatus({id:pending.id},pending.target),()=>{routineBusy=false;renderTarefas();});};host.prepend(retry);}}}
  finally{routineBusy=false;controls.forEach((c,i)=>c.disabled=previous[i]);}
}

function _rotinaSaved() {
  try { return AppState.get('tarefas') || JSON.parse(appStorage.getItem('sistema_tarefas_v1') || '[]'); } catch (_) { return []; }
}
function _rotinaPriority(t) {
  const labels = { alta: 'Alta', media: 'Média', baixa: 'Baixa' };
  return `<span class="rotina-prioridade prioridade-${t.prioridade || 'media'}">${labels[t.prioridade] || 'Média'}</span>`;
}
function _rotinaStatusOptions(status) {
  return ROTINA_STATUS.map(s => `<option value="${s.id}"${s.id === status ? ' selected' : ''}>${s.icon} ${s.label}</option>`).join('');
}
function _rotinaCard(t, compact) {
  const done = t.status === 'concluida';
  const overdue = !done && t.status !== 'cancelada' && t.data < hoje();
  return `<article class="rotina-card${done ? ' is-done' : ''}" data-tarefa-id="${t.id}" draggable="true">
    <div class="rotina-card-top">${_rotinaPriority(t)}<div><button class="regra-icon-btn tarefa-card-editar" data-id="${t.id}" title="Editar">✏️</button><button class="regra-icon-btn tarefa-card-excluir" data-id="${t.id}" title="Excluir">🗑️</button></div></div>
    <h4>${escapeHtml(t.titulo)}</h4>
    ${!compact && t.descricao ? `<p>${escapeHtml(t.descricao)}</p>` : ''}
    <div class="rotina-card-meta"><span class="${overdue ? 'is-overdue' : ''}">📅 ${formatarData(t.data)}${overdue ? ' · atrasada' : ''}</span>${t.rotinaAtiva ? '<span>🔁 Recorrente</span>' : ''}</div>
    <select class="tarefa-card-status" data-id="${t.id}" aria-label="Alterar status">${_rotinaStatusOptions(t.status)}</select>
  </article>`;
}

function renderTarefas(reset = false) {
  if(routineBusy)return;
  if(reset!==true&&!_captureTask())return;
  const host = document.getElementById('tarefasContent');
  if (!host) return;
  const saved = _rotinaSaved();
  verificarLembretesRotina(saved);
  const pendingStatus = _routineDraft('sistema_tarefa_transicao_v1');
  const view = appStorage.getItem('sistema_tarefas_view_v1') || 'kanban';
  const editing = _routineDraft(ROTINA_DRAFT_KEY);
  const formOpen = Boolean(editing);
  host.innerHTML = `
    <section class="card rotina-overview"><div><span class="page-eyebrow">Organização pessoal</span><h2>Rotina</h2><p>Acompanhe o fluxo das tarefas ou consulte a agenda em lista.</p></div><div class="rotina-header-actions"><button class="btn-small" id="rotinaAnotacoesBtn">📝 Anotações</button><button class="btn-primary" id="tarefaNovaBtn">+ Nova tarefa</button></div></section>
    ${pendingStatus ? '<section class="card"><p>Uma mudança de status ainda não foi confirmada.</p><button class="btn-small" id="tarefaRetryStatusBtn">Tentar confirmar mudança</button><button class="btn-small" id="tarefaDiscardStatusBtn">Descartar tentativa</button></section>' : ''}
    ${formOpen ? `<section class="card rotina-form-card"><div class="card-header"><div><h3>${editing?._editing ? 'Editar tarefa' : 'Nova tarefa'}</h3><p>Cadastre a atividade e defina prazo e prioridade.</p></div></div>
      <div class="grid-2col"><label class="field"><span>Título</span><input id="tarefaTituloInput" value="${escapeHtml(editing?.titulo || '')}" maxlength="120"></label><div class="grid-2col"><label class="field"><span>Data</span><input type="date" id="tarefaDataInput" value="${editing?.data || hoje()}"></label><label class="field"><span>Prioridade</span><select id="tarefaPrioridadeInput"><option value="baixa"${editing?.prioridade === 'baixa' ? ' selected' : ''}>🟢 Baixa</option><option value="media"${!editing || editing.prioridade === 'media' ? ' selected' : ''}>🟡 Média</option><option value="alta"${editing?.prioridade === 'alta' ? ' selected' : ''}>🔴 Alta</option></select></label></div></div>
      <label class="field"><span>Descrição</span><textarea id="tarefaDescricaoInput" rows="4">${escapeHtml(editing?.descricao || '')}</textarea></label>
      <div class="rotina-repeat"><label><input type="checkbox" id="tarefaRotinaAtiva"${editing?.rotinaAtiva ? ' checked' : ''}> Repetir verificação</label><label>a cada <input type="number" min="1" id="tarefaRotinaIntervalo" value="${editing?.rotinaIntervalo || 15}"> <select id="tarefaRotinaUnidade"><option value="dias">dias</option><option value="semanas"${editing?.rotinaUnidade === 'semanas' ? ' selected' : ''}>semanas</option><option value="meses"${editing?.rotinaUnidade === 'meses' ? ' selected' : ''}>meses</option></select></label><label>avisar <select id="tarefaRotinaLembrete"><option value="0">no dia</option><option value="1"${editing?.rotinaLembreteDias === 1 ? ' selected' : ''}>1 dia antes</option><option value="3"${editing?.rotinaLembreteDias === 3 ? ' selected' : ''}>3 dias antes</option><option value="7"${editing?.rotinaLembreteDias === 7 ? ' selected' : ''}>7 dias antes</option></select></label></div>
      <div class="regra-form-actions"><button class="btn-primary" id="tarefaSalvarBtn">Salvar tarefa</button><button class="btn-small" id="tarefaCancelarBtn">Cancelar</button></div>
    </section>` : ''}
    <section class="card rotina-board-card"><div class="card-header"><div><h3>Minhas tarefas</h3><p>${saved.length} tarefa(s)</p></div><div class="view-switch"><button class="btn-small${view === 'kanban' ? ' active' : ''}" data-task-view="kanban">▦ Kanban</button><button class="btn-small${view === 'lista' ? ' active' : ''}" data-task-view="lista">☷ Lista</button><button class="btn-small" id="tarefaRefreshBtn" title="Atualizar">🔄</button></div></div>
      ${view === 'kanban' ? `<div class="rotina-kanban">${ROTINA_STATUS.map(s => { const cards = saved.filter(t => (t.status || 'pendente') === s.id); return `<section class="rotina-column"><header><h3>${s.icon} ${s.label}</h3><span>${cards.length}</span></header><div class="rotina-dropzone" data-task-status="${s.id}">${cards.length ? cards.map(t => _rotinaCard(t, false)).join('') : '<div class="regra-empty">Nenhuma tarefa</div>'}</div></section>`; }).join('')}</div>` : `<div class="rotina-lista">${saved.length ? saved.slice().sort((a,b) => String(a.data).localeCompare(String(b.data))).map(t => _rotinaCard(t, true)).join('') : '<div class="empty-state"><div class="empty-title">Nenhuma tarefa</div></div>'}</div>`}
    </section>`;
  _bindRotinaCards(saved);
  updateTarefasBadge();
}

async function _setTarefaStatus(t,status) {
  const token=AppDataSession.token(),key='sistema_tarefa_transicao_v1';
  const pending=_routineDraft(key);
  if(pending&&(pending.id!==t.id||pending.target!==status))throw Error('Há uma mudança de status sem confirmação. Repita a mesma ação para confirmá-la.');
  const patch=pending?.patch||{status};
  if(!pending&&status==='concluida'&&t.rotinaAtiva) {
    patch.rotinaUltimaConclusao=hoje();patch.data=t.rotinaProximaData||t.data;
    patch.rotinaProximaData=proximaRotina(patch.data,t.rotinaIntervalo||1,t.rotinaUnidade||'dias');patch.status='pendente';
  }
  if(!_routineStore(key,{id:t.id,target:status,patch}))throw Error('Mudança de status não enviada.');
  await dbTarefaStatus(t.id,patch);if(!AppDataSession.current(token))throw Error('Sessão alterada.');_routineClear(key);
}
function _bindRotinaCards(saved) {
  const host=document.getElementById('tarefasContent');
  host.querySelectorAll('.rotina-form-card input,.rotina-form-card select,.rotina-form-card textarea').forEach(input=>{input.addEventListener('input',_captureTask);input.addEventListener('change',_captureTask);});
  document.getElementById('rotinaAnotacoesBtn')?.addEventListener('click',openAnotacoesOverlay);
  document.getElementById('tarefaNovaBtn')?.addEventListener('click',()=>{if(!_captureTask()||!_routineSwitch(ROTINA_DRAFT_KEY,{data:hoje(),prioridade:'media',rotinaIntervalo:15}))return;renderTarefas(true);document.getElementById('tarefaTituloInput')?.focus();});
  document.getElementById('tarefaCancelarBtn')?.addEventListener('click',()=>{if(!confirm('Descartar este rascunho?'))return;_routineClear(ROTINA_DRAFT_KEY);renderTarefas(true);});
  host.querySelectorAll('[data-task-view]').forEach(b=>b.addEventListener('click',()=>{if(!_captureTask())return;appStorage.setItem('sistema_tarefas_view_v1',b.dataset.taskView);renderTarefas();}));
  document.getElementById('tarefaSalvarBtn')?.addEventListener('click',()=>{
    if(!requireAdmin()||!_captureTask())return;
    const t=_routineDraft(ROTINA_DRAFT_KEY);if(!t?.titulo?.trim()||!t.data){_routineError(Error('Preencha título e data.'));return;}
    _routineRun(()=>dbTarefasSave({...t,titulo:t.titulo.trim(),descricao:t.descricao.trim()}),()=>{_routineClear(ROTINA_DRAFT_KEY);routineBusy=false;renderTarefas(true);showToast('Tarefa salva!','success','Tarefas');});
  });
  host.querySelectorAll('.tarefa-card-editar').forEach(b=>b.addEventListener('click',()=>{const t=saved.find(x=>x.id===b.dataset.id);if(!t||!_captureTask())return;const current=_routineDraft(ROTINA_DRAFT_KEY);if(current?.id===t.id)return;if(!_routineSwitch(ROTINA_DRAFT_KEY,t))return;renderTarefas(true);document.getElementById('tarefaTituloInput')?.focus();}));
  host.querySelectorAll('.tarefa-card-excluir').forEach(b=>b.addEventListener('click',()=>{const t=saved.find(x=>x.id===b.dataset.id);if(!requireAdmin()||!t||!confirm(`Excluir tarefa “${t.titulo}”?`))return;_routineRun(()=>dbTarefasDelete(t.id),()=>{if(_routineDraft('sistema_tarefa_transicao_v1')?.id===t.id)_routineClear('sistema_tarefa_transicao_v1');routineBusy=false;renderTarefas();});}));
  const change=(t,status)=>_routineRun(()=>_setTarefaStatus(t,status),()=>{routineBusy=false;renderTarefas();showToast('Status confirmado.','success','Rotina');});
  document.getElementById('tarefaDiscardStatusBtn')?.addEventListener('click',()=>{if(!requireAdmin()||!confirm('Descartar a tentativa pendente e consultar o estado atual da tarefa?'))return;_routineClear('sistema_tarefa_transicao_v1');_routineRun(dbTarefasLoad,()=>{routineBusy=false;renderTarefas();});});
  document.getElementById('tarefaRetryStatusBtn')?.addEventListener('click',()=>{const pending=_routineDraft('sistema_tarefa_transicao_v1');if(pending)change({id:pending.id},pending.target);});
  host.querySelectorAll('.tarefa-card-status').forEach(select=>select.addEventListener('change',()=>{const t=saved.find(x=>x.id===select.dataset.id),status=select.value;select.value=t?.status||'pendente';if(requireAdmin()&&t)change(t,status);}));
  host.querySelectorAll('.rotina-card').forEach(c=>c.addEventListener('dragstart',e=>{if(routineBusy){e.preventDefault();return;}e.dataTransfer.setData('text/plain',c.dataset.tarefaId);}));
  host.querySelectorAll('.rotina-dropzone').forEach(z=>{z.addEventListener('dragover',e=>e.preventDefault());z.addEventListener('drop',e=>{e.preventDefault();const t=saved.find(x=>x.id===e.dataTransfer.getData('text/plain'));if(requireAdmin()&&t&&t.status!==z.dataset.taskStatus)change(t,z.dataset.taskStatus);});});
  document.getElementById('tarefaRefreshBtn')?.addEventListener('click',()=>_routineRun(dbTarefasLoad,()=>{routineBusy=false;renderTarefas();}));
}
function onTarefasTabActivated(){renderTarefas();const token=AppDataSession.token();dbTarefasLoad().then(()=>{if(AppDataSession.current(token))renderTarefas();}).catch(()=>{});}

// ── Anotações em cards pesquisáveis ──
function _notasSaved() { try { return AppState.get('anotacoes') || JSON.parse(appStorage.getItem('sistema_anotacoes_diarias_v1') || '[]'); } catch (_) { return []; } }
function _notaTags(value) { return String(value || '').split(',').map(v => v.trim()).filter(Boolean).slice(0, 6); }
function renderAnotacoes(reset = false) {
  if(routineBusy)return;
  if(reset!==true&&!_captureNote())return;
  const host = document.getElementById('anotacoesOverlayContent'); if (!host) return;
  const saved = _notasSaved(), editing = _routineDraft(ANOTACOES_EDITING_KEY);
  const query = sessionStorage.getItem('anotacoes_busca') || '', onlyFav = sessionStorage.getItem('anotacoes_favoritas') === '1';
  const visible = saved.filter(n => (!onlyFav || n.favorito) && (!query || `${n.conteudo} ${n.etiquetas || ''} ${n.data}`.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR')))).sort((a,b) => Number(Boolean(b.favorito)) - Number(Boolean(a.favorito)) || String(b.data).localeCompare(String(a.data)));
  host.innerHTML = `<section class="card nota-form-card"><div class="card-header"><div><h3>${editing?._editing ? 'Editar anotação' : 'Nova anotação'}</h3><p>Registre uma observação e use etiquetas para encontrá-la depois.</p></div></div><div class="grid-2col"><label class="field"><span>Data</span><input type="date" id="anotacaoDataInput" value="${editing?.data || hoje()}"></label><label class="field"><span>Etiquetas</span><input id="anotacaoTagsInput" value="${escapeHtml(editing?.etiquetas || '')}" placeholder="Ex: reunião, processo, ideia"></label></div><label class="field"><span>Anotação</span><textarea id="anotacaoTextoInput" rows="6" placeholder="Escreva sua anotação...">${escapeHtml(editing?.conteudo || '')}</textarea></label><div class="regra-form-actions"><button class="btn-primary" id="anotacaoSalvarBtn">${editing?._editing ? 'Atualizar' : 'Salvar'} anotação</button>${editing?.id ? '<button class="btn-small" id="anotacaoCancelarBtn">Cancelar</button>' : ''}</div></section>
    <section class="card notas-library"><div class="card-header"><div><h3>Anotações</h3><p>${visible.length} de ${saved.length} anotação(ões)</p></div><button class="btn-small" id="anotacaoRefreshBtn">🔄</button></div><div class="notas-toolbar"><input id="anotacaoBusca" type="search" value="${escapeHtml(query)}" placeholder="Buscar nas anotações e etiquetas..."><button class="btn-small${onlyFav ? ' active' : ''}" id="anotacaoFavFilter">⭐ Favoritas</button></div>
    <div class="notas-grid">${visible.length ? visible.map(n => `<article class="nota-card${n.favorito ? ' is-favorite' : ''}" data-nota-id="${n.id}"><div class="nota-card-top"><strong>📅 ${formatarData(n.data)}</strong><button class="nota-fav-btn" data-id="${n.id}" title="${n.favorito ? 'Remover dos favoritos' : 'Favoritar'}">${n.favorito ? '★' : '☆'}</button></div><p>${escapeHtml(n.conteudo)}</p><div class="nota-tags">${_notaTags(n.etiquetas).map(t => `<span>${escapeHtml(t)}</span>`).join('')}</div><footer><button class="btn-small anotacao-ver-btn" data-id="${n.id}">Ver</button><button class="btn-small anotacao-editar-btn" data-id="${n.id}">✏️</button><button class="btn-small btn-delete anotacao-excluir-btn" data-id="${n.id}">🗑️</button></footer></article>`).join('') : '<div class="regra-empty">Nenhuma anotação encontrada</div>'}</div></section>`;
  _bindNotasCards(saved);
}
function _bindNotasCards(saved) {
  const host = document.getElementById('anotacoesOverlayContent');
  document.getElementById('anotacaoBusca')?.addEventListener('input', e => { sessionStorage.setItem('anotacoes_busca', e.target.value); renderAnotacoes(); document.getElementById('anotacaoBusca')?.focus(); });
  document.getElementById('anotacaoFavFilter')?.addEventListener('click', () => { sessionStorage.setItem('anotacoes_favoritas', sessionStorage.getItem('anotacoes_favoritas') === '1' ? '0' : '1'); renderAnotacoes(); });
  host.querySelectorAll('.nota-form-card input,.nota-form-card textarea').forEach(input=>{input.addEventListener('input',_captureNote);input.addEventListener('change',_captureNote);});
  document.getElementById('anotacaoSalvarBtn')?.addEventListener('click',()=>{
    if(!_captureNote())return;const n=_routineDraft(ANOTACOES_EDITING_KEY);
    if(!n?.data||!n.conteudo?.trim()){_routineError(Error('Preencha a data e o conteúdo.'));return;}
    _routineRun(()=>dbAnotacoesSave({...n,conteudo:n.conteudo.trim(),etiquetas:n.etiquetas.trim()}),()=>{_routineClear(ANOTACOES_EDITING_KEY);routineBusy=false;renderAnotacoes(true);showToast('Anotação salva!','success','Anotações');});
  });
  document.getElementById('anotacaoCancelarBtn')?.addEventListener('click',()=>{if(!confirm('Descartar este rascunho?'))return;_routineClear(ANOTACOES_EDITING_KEY);renderAnotacoes(true);});
  host.querySelectorAll('.nota-fav-btn').forEach(b=>b.addEventListener('click',()=>{const n=saved.find(x=>x.id===b.dataset.id);if(n)_routineRun(()=>dbAnotacaoFavorito(n.id,!n.favorito),()=>{routineBusy=false;renderAnotacoes();});}));
  host.querySelectorAll('.anotacao-editar-btn').forEach(b=>b.addEventListener('click',()=>{const n=saved.find(x=>x.id===b.dataset.id);if(!n)return;const current=_routineDraft(ANOTACOES_EDITING_KEY);if(current?.id===n.id)return;
    // O formulário vazio não constitui uma edição a descartar.
    if(!current?.conteudo&&!current?.etiquetas)_routineClear(ANOTACOES_EDITING_KEY);
    if(!_routineSwitch(ANOTACOES_EDITING_KEY,n))return;renderAnotacoes(true);document.getElementById('anotacaoTextoInput')?.focus();}));
  host.querySelectorAll('.anotacao-excluir-btn').forEach(b=>b.addEventListener('click',()=>{const n=saved.find(x=>x.id===b.dataset.id);if(!n||!confirm(`Excluir anotação de ${formatarData(n.data)}?`))return;_routineRun(()=>dbAnotacoesDelete(n.id),()=>{routineBusy=false;renderAnotacoes();});}));
  host.querySelectorAll('.anotacao-ver-btn').forEach(b => b.addEventListener('click', () => { const n = saved.find(x => x.id === b.dataset.id); if (!n) return; const overlay = document.getElementById('anotacaoViewOverlay') || criarAnotacaoOverlay(), content = document.getElementById('anotacaoViewContent'); content.innerHTML = `<div class="nota-view"><div class="card-header"><h2>📅 ${formatarData(n.data)}</h2><button class="btn-small" id="anotacaoViewCloseBtn">✕ Fechar</button></div><div class="nota-tags">${_notaTags(n.etiquetas).map(t => `<span>${escapeHtml(t)}</span>`).join('')}</div><pre>${escapeHtml(n.conteudo)}</pre></div>`; overlay.classList.add('open'); document.getElementById('anotacaoViewCloseBtn').onclick = () => overlay.classList.remove('open'); }));
  document.getElementById('anotacaoRefreshBtn')?.addEventListener('click', () => _routineRun(dbAnotacoesLoad,()=>{routineBusy=false;renderAnotacoes();}));
}
