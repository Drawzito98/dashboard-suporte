// regras.js — quadro Kanban de regras atuais

const REGRAS_COLUNAS = [
  { id: 'vigente', titulo: 'Vigentes', ajuda: 'Regras em uso atualmente' },
  { id: 'revisao', titulo: 'Em revisão', ajuda: 'Regras sendo avaliadas' },
  { id: 'arquivada', titulo: 'Arquivadas', ajuda: 'Histórico fora de uso' }
];
const REGRA_DRAFT_KEY='sistema_regra_rascunho_v1';
let regraEditandoId = null, regraBusy=false, regraDraft=null, regraDraftLoaded=false, regraDraftFailed=false;
function _regrasLista() { return getRegrasConfirmadas(); }
function _regraDraftLoad(){
  if(!regraDraftLoaded){try{regraDraft=JSON.parse(appStorage.getItem(REGRA_DRAFT_KEY)||'null');}catch(_){regraDraft=null;}regraDraftLoaded=true;}
  return regraDraft;
}
function _regraMessage(message){const el=document.getElementById('regrasMessage');if(el)el.textContent=message;}
function _regraStore(draft){
  regraDraft=draft;regraEditandoId=draft?.id??null;
  try{if(draft)appStorage.setItem(REGRA_DRAFT_KEY,JSON.stringify(draft));else appStorage.removeItem(REGRA_DRAFT_KEY);regraDraftFailed=false;return true;}
  catch(_){regraDraftFailed=true;_regraMessage('Não foi possível guardar o rascunho. Mantenha esta tela aberta.');return false;}
}
function _regraCapture(){
  if(!document.getElementById('regraTitulo'))return !regraDraftFailed||!regraDraft;
  const old=_regraDraftLoad();return _regraStore({...old,titulo:document.getElementById('regraTitulo').value,descricao:document.getElementById('regraDescricao').value,categoria:document.getElementById('regraCategoria').value,status:document.getElementById('regraStatus').value});
}
function _regraOpen(row){
  if(regraBusy)return;
  if(!_regraCapture())return;
  const old=_regraDraftLoad();if(old?.id===row?.id&&row)return;
  if(old&&!confirm('Descartar o rascunho atual e abrir outra regra?'))return;
  const draft=row?{...row,_editing:true}:{id:crypto.randomUUID(),titulo:'',descricao:'',categoria:'Geral',status:'vigente',posicao:Date.now(),createdAt:new Date().toISOString(),_editing:false};
  if(!_regraStore(draft))return;document.querySelector('.regra-form-card')?.remove();renderRegras();document.getElementById('regraTitulo')?.focus();
}
async function _regraRun(operation,done){
  if(regraBusy)return;regraBusy=true;const token=AppDataSession.token(),host=document.getElementById('regrasContent');
  const controls=[...host.querySelectorAll('button,input,textarea,select')],disabled=controls.map(el=>el.disabled);
  controls.forEach(el=>el.disabled=true);host.setAttribute('aria-busy','true');_regraMessage('Aguardando confirmação do servidor…');
  try{await operation();if(AppDataSession.current(token)){done?.();regraBusy=false;renderRegras();_regraMessage(regraDraftFailed?'Operação confirmada. Não foi possível atualizar o rascunho neste dispositivo; confira antes de repetir.':'Operação confirmada.');}}
  catch(error){if(AppDataSession.current(token)){controls.forEach((el,i)=>el.disabled=disabled[i]);host.querySelectorAll('.regra-mover').forEach(el=>{const row=_regrasLista().find(r=>r.id===el.dataset.id);if(row)el.value=row.status;});_regraMessage(error.message||'Operação não confirmada. O rascunho foi mantido.');}}
  finally{regraBusy=false;controls.forEach((el,i)=>{if(el.isConnected)el.disabled=disabled[i];});host.removeAttribute('aria-busy');}
}

function _regraData(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('pt-BR');
}

function renderRegras() {
  const host = document.getElementById('regrasContent');
  if (!host) return;
  if(regraBusy)return;
  if(!_regraCapture())return;
  const draft=_regraDraftLoad();regraEditandoId=draft?.id??null;
  const regras = _regrasLista().sort((a, b) => (a.posicao || 0) - (b.posicao || 0));
  const editando = draft?{...draft,status:draft._editing?(regras.find(r=>r.id===draft.id)?.status||draft.status):draft.status}:null;
  const isAdmin = document.body.dataset.role === 'admin';

  host.innerHTML = `
    <section class="card regras-header">
      <div><span class="page-eyebrow">Base de conhecimento</span><h2>Regras atuais</h2><p>Registre normas, orientações e decisões da operação em um quadro visual.</p></div>
      ${isAdmin ? '<button class="btn-primary" id="regraNovaBtn" type="button">+ Nova regra</button>' : ''}
    </section>
    ${isAdmin && regraEditandoId !== null ? `<section class="card regra-form-card">
      <div class="card-header"><div><h3>${editando?._editing ? 'Editar regra' : 'Nova regra'}</h3><p>Use um título curto e detalhe a orientação no texto. Para mover uma regra existente, use a coluna no cartão.</p></div></div>
      <div class="grid-2col">
        <label class="field"><span>Título</span><input id="regraTitulo" maxlength="120" value="${escapeHtml(editando?.titulo || '')}" placeholder="Ex: Transferência de atendimentos"></label>
        <label class="field"><span>Categoria</span><input id="regraCategoria" maxlength="40" value="${escapeHtml(editando?.categoria || 'Geral')}" placeholder="Ex: Atendimento"></label>
      </div>
      <label class="field"><span>Descrição</span><textarea id="regraDescricao" rows="5" maxlength="2000" placeholder="Descreva a regra de forma objetiva...">${escapeHtml(editando?.descricao || '')}</textarea></label>
      <label class="field regra-status-field"><span>Coluna</span><select id="regraStatus"${editando?._editing ? ' disabled' : ''}>${REGRAS_COLUNAS.map(c => `<option value="${c.id}"${(editando?.status || 'vigente') === c.id ? ' selected' : ''}>${c.titulo}</option>`).join('')}</select></label>
      <div class="regra-form-actions"><button class="btn-primary" id="regraSalvarBtn" type="button">Salvar regra</button><button class="btn-small" id="regraCancelarBtn" type="button">Descartar rascunho</button></div>
    </section>` : ''}
    <p id="regrasMessage" role="status" aria-live="polite"></p>
    <div class="regras-board" aria-label="Quadro de regras">
      ${REGRAS_COLUNAS.map(coluna => {
        const cards = regras.filter(r => r.status === coluna.id);
        return `<section class="regras-column" data-status="${coluna.id}">
          <header><div><h3>${coluna.titulo}</h3><p>${coluna.ajuda}</p></div><span>${cards.length}</span></header>
          <div class="regras-cards" data-drop-status="${coluna.id}">${cards.length ? cards.map(r => `<article class="regra-card" draggable="${isAdmin}" data-regra-id="${escapeHtml(r.id)}">
            <div class="regra-card-top"><span class="regra-tag">${escapeHtml(r.categoria || 'Geral')}</span>${isAdmin ? `<div><button class="regra-icon-btn regra-editar" data-id="${escapeHtml(r.id)}" title="Editar" type="button">✏️</button><button class="regra-icon-btn regra-excluir" data-id="${escapeHtml(r.id)}" title="Excluir" type="button">🗑️</button></div>` : ''}</div>
            <h4>${escapeHtml(r.titulo)}</h4>
            ${r.descricao ? `<p>${escapeHtml(r.descricao)}</p>` : ''}
            <footer><span>Atualizada em ${_regraData(r.updatedAt || r.createdAt)}</span>${isAdmin ? `<select class="regra-mover" data-id="${escapeHtml(r.id)}" aria-label="Mover ${escapeHtml(r.titulo)}">${REGRAS_COLUNAS.map(c => `<option value="${c.id}"${r.status === c.id ? ' selected' : ''}>${c.titulo}</option>`).join('')}</select>` : ''}</footer>
          </article>`).join('') : '<div class="regra-empty">Nenhuma regra nesta coluna</div>'}</div>
        </section>`;
      }).join('')}
    </div>`;
  _bindRegras(regras);
}

function _bindRegras(regras) {
  document.getElementById('regraNovaBtn')?.addEventListener('click',()=>_regraOpen(null));
  document.getElementById('regraCancelarBtn')?.addEventListener('click',()=>{
    if(regraBusy||!confirm('Descartar este rascunho?'))return;
    if(_regraStore(null)){document.querySelector('.regra-form-card')?.remove();renderRegras();}
  });
  document.querySelector('.regra-form-card')?.addEventListener('input',_regraCapture);
  document.querySelector('.regra-form-card')?.addEventListener('change',_regraCapture);
  document.getElementById('regraSalvarBtn')?.addEventListener('click',()=>{
    if(!requireAdmin()||!_regraCapture())return;
    const draft={..._regraDraftLoad()};draft.titulo=draft.titulo.trim();draft.descricao=draft.descricao.trim();draft.categoria=draft.categoria.trim()||'Geral';
    if(!draft.titulo){_regraMessage('Informe o título da regra.');return;}
    _regraRun(()=>dbRegrasSave(draft),()=>{_regraStore(null);document.querySelector('.regra-form-card')?.remove();});
  });
  document.querySelectorAll('.regra-editar').forEach(btn=>btn.addEventListener('click',()=>_regraOpen(regras.find(r=>r.id===btn.dataset.id))));
  document.querySelectorAll('.regra-excluir').forEach(btn=>btn.addEventListener('click',()=>{
    if(!requireAdmin()||!_regraCapture())return;
    const regra=regras.find(r=>r.id===btn.dataset.id);if(!regra||!confirm(`Excluir a regra “${regra.titulo}”?`))return;
    _regraRun(()=>dbRegrasDelete(regra.id));
  }));
  function move(id,status){
    if(!requireAdmin()||!_regraCapture())return;
    const regra=_regrasLista().find(r=>r.id===id);if(!regra||regra.status===status)return;
    _regraRun(()=>dbRegraMove(id,status,Date.now()));
  }
  document.querySelectorAll('.regra-mover').forEach(select=>select.addEventListener('change',()=>move(select.dataset.id,select.value)));
  document.querySelectorAll('.regra-card[draggable="true"]').forEach(card=>card.addEventListener('dragstart',event=>{
    if(regraBusy){event.preventDefault();return;}event.dataTransfer.setData('text/plain',card.dataset.regraId);
  }));
  document.querySelectorAll('.regras-cards').forEach(column=>{
    column.addEventListener('dragover',event=>{if(!regraBusy){event.preventDefault();column.classList.add('drag-over');}});
    column.addEventListener('dragleave',()=>column.classList.remove('drag-over'));
    column.addEventListener('drop',event=>{event.preventDefault();column.classList.remove('drag-over');if(!regraBusy)move(event.dataTransfer.getData('text/plain'),column.dataset.dropStatus);});
  });
}
function onRegrasTabActivated() {
  renderRegras();
  if(typeof dbRegrasLoad==='function')dbRegrasLoad().then(renderRegras).catch(()=>{});
}
window.addEventListener('beforeunload',event=>{if(!_regraCapture()||regraBusy){event.preventDefault();event.returnValue='';}});
