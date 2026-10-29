// bonus.js — Bônus manuais (pontos extras por auxílio, projetos, etc)

const BONUS_EDITING_KEY = 'sistema_bonus_editando_v1';
let bonusBusy=false,bonusDraftFailed=false;
function bonusDraft(){try{const draft=JSON.parse(appStorage.getItem(BONUS_EDITING_KEY)||'null');return draft&&typeof draft==='object'?draft:null;}catch(_){return null;}}
function bonusMessage(text){const host=document.getElementById('bonusContent');if(!host)return;let message=host.querySelector('.bonus-save-message');if(!message){message=document.createElement('p');message.className='ui-message bonus-save-message';message.setAttribute('role','alert');host.prepend(message);}message.textContent=text;}
function storeBonusDraft(draft){
  const id=_writeUuid(draft.id);if(draft.id&&draft.id!==id)draft={...draft,_localId:draft.id};
  try{appStorage.setItem(BONUS_EDITING_KEY,JSON.stringify({...draft,id}));bonusDraftFailed=false;return true;}
  catch(_){bonusDraftFailed=true;bonusMessage('Não foi possível guardar o rascunho neste dispositivo. Mantenha esta tela aberta.');return false;}
}
function captureBonusDraft(){
  if(!document.getElementById('bonusDescricaoInput'))return true;
  const old=bonusDraft()||{id:crypto.randomUUID(),_editing:false,createdAt:new Date().toISOString()};
  return storeBonusDraft({...old,_editing:old._editing??Boolean(old.id),colaborador:document.getElementById('bonusColaboradorInput').value,magnitude:document.getElementById('bonusPontosInput').value,descricao:document.getElementById('bonusDescricaoInput').value,mes:document.getElementById('bonusMesInput').value});
}
async function runBonusWrite(operation,done){
  if(bonusBusy)return;const token=AppDataSession.token();bonusBusy=true;
  const host=document.getElementById('bonusContent'),controls=[...host.querySelectorAll('button,input,select,textarea')],disabled=controls.map(el=>el.disabled);
  host.setAttribute('aria-busy','true');controls.forEach(el=>el.disabled=true);bonusMessage('Aguardando confirmação do servidor…');
  try{await operation();if(AppDataSession.current(token)){bonusBusy=false;done?.();}}
  catch(error){if(AppDataSession.current(token))bonusMessage(error.message||'Lançamento não confirmado. Seu rascunho foi mantido.');}
  finally{bonusBusy=false;host.removeAttribute('aria-busy');controls.forEach((el,i)=>el.disabled=disabled[i]);}
}
function refreshBonusViews(){renderBonus();if(typeof renderGamification==='function')renderGamification();}

function renderBonus() {
  const container = document.getElementById('bonusContent');
  if (!container) return;

  if(bonusBusy||bonusDraftFailed)return;
  const saved=getPontosExtrasLocal(),editing=bonusDraft();
  const isEditing=Boolean(editing&&(editing._editing??Boolean(editing.id)));

  const colabs = [...new Set((rawRecords || [])
    .filter(r => r && r['Atendente'] && !isAggregateName(r['Atendente']) && isColabActive(r['Atendente']))
    .map(r => r['Atendente']).concat(editing?.colaborador?[editing.colaborador]:[]))].sort();

  let html = '';

  // ── Header ──
  html += '<div style="margin-bottom:var(--s-4)">';
  html += '<h3 style="font-size:16px;font-weight:600;margin-bottom:2px">🌟 Bônus & Penalidades</h3>';
  html += '<p style="font-size:13px;color:var(--text-secondary)">Pontos extras por auxílio, projetos, ou descontos manuais.</p>';
  html += '</div>';

  // ── Formulário ──
  html += '<div style="background:var(--bg-subtle);border-radius:var(--r-md);padding:var(--s-4);margin-bottom:var(--s-4)">';
  const formTitle = isEditing ? (Number(editing.pontos)<0?'✏️ Editar penalidade':'✏️ Editar bônus') : '➕ Novo lançamento';
  html += `<div style="font-size:13px;font-weight:600;margin-bottom:var(--s-3)">${formTitle}</div>`;
  html += '<div class="grid-2col" style="margin-bottom:var(--s-3)">';
  html += '<div class="field"><span>Colaborador</span>';
  html += `<select id="bonusColaboradorInput" aria-label="Colaborador"${isEditing?' disabled':''}>`;
  html += `<option value="">Selecione...</option>`;
  for (const c of colabs) {
    const sel = editing?.colaborador === c ? ' selected' : '';
    html += `<option value="${escapeHtml(c)}"${sel}>${escapeHtml(c)}</option>`;
  }
  html += '</select></div>';
  html += '<div class="field"><span>Pontos</span>';
  html += `<input type="number" id="bonusPontosInput" aria-label="Pontos" step="0.5" min="0.5" max="999" placeholder="Ex: 3" value="${escapeHtml(String(editing?.magnitude??(editing?Math.abs(parseFloat(editing.pontos)||1):1)))}">`;
  html += '</div></div>';
  html += '<div class="field" style="margin-bottom:var(--s-3)"><span>Descrição</span>';
  html += `<textarea id="bonusDescricaoInput" aria-label="Descrição" style="width:100%;min-height:50px;font-size:13px;line-height:1.6" placeholder="Ex: Auxiliou a equipe no projeto X...">${editing ? escapeHtml(editing.descricao || '') : ''}</textarea>`;
  html += '</div>';
  html += '<div class="field" style="margin-bottom:var(--s-3)"><span>Mês de referência (opcional)</span>';
  html += '<select id="bonusMesInput" aria-label="Mês de referência">';
  html += '<option value="">-- Sem mês --</option>';
  const _availMeses = [...new Set((rawRecords || []).filter(r => r && r['Mês']).map(r => r['Mês']).concat(editing?.mes?[editing.mes]:[]))].sort();
  const _editingMes = editing?.mes || '';
  for (const m of _availMeses) {
    const sel = _editingMes === m ? ' selected' : '';
    html += `<option value="${escapeHtml(m)}"${sel}>${escapeHtml(m)}</option>`;
  }
  html += '</select></div>';
  html += '<p class="hint">O cálculo por mês considera apenas lançamentos com o mesmo mês de referência.</p>';
  if (isEditing) {
    html += '<div style="display:flex;gap:var(--s-2)">';
    html += `<button class="btn-primary" id="bonusSalvarBtn" type="button" style="flex:1">💾 Atualizar</button>`;
    html += `<button class="btn-small" id="bonusCancelarBtn" type="button">Cancelar</button>`;
    html += '</div>';
  } else {
    html += '<div style="display:flex;gap:var(--s-2)">';
    html += `<button class="btn-primary" id="bonusAdicionarBtn" type="button" style="flex:1;background:var(--success)">➕ Conceder bônus</button>`;
    html += `<button class="btn-primary" id="bonusRemoverBtn" type="button" style="flex:1;background:var(--danger)">➖ Registrar penalidade</button>`;
    html += '</div>';
  }
  html += '<button class="btn-small" id="bonusDescartarBtn" type="button">Descartar rascunho</button><p class="hint">Fechar preserva a edição neste dispositivo. Editar mantém a pessoa e o tipo do lançamento.</p></div>';

  // ── Resumo ──
  const acumulo = {};
  for (const b of saved) {
    if (!acumulo[b.colaborador]) acumulo[b.colaborador] = 0;
    acumulo[b.colaborador] += parseFloat(b.pontos) || 0;
  }
  const topColabs = Object.entries(acumulo).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const totalPts = Object.values(acumulo).reduce((s, v) => s + v, 0);

  // ── Lista ──
  html += '<div style="font-size:13px;color:var(--text-secondary);margin-bottom:var(--s-3)">';
  html += `${saved.length} registro(s) · ${Object.keys(acumulo).length} colaborador(es) · <strong>${totalPts.toFixed(1)}</strong> pts totais`;
  if (topColabs.length) {
    html += ` · ${topColabs.map(([n, p]) => `${escapeHtml(n)} (${p > 0 ? '+' : ''}${p.toFixed(1)})`).join(', ')}`;
  }
  html += '</div>';

  if (!saved.length) {
    html += '<div class="empty-state" style="padding:var(--s-4)"><div class="empty-title">Nenhum bônus ainda</div><div class="empty-sub">Conceda o primeiro bônus acima.</div></div>';
  } else {
    html += '<div style="display:flex;flex-direction:column;gap:var(--s-2);max-height:320px;overflow-y:auto">';
    for (const b of saved) {
      const pts = parseFloat(b.pontos) || 0;
      const isNeg = pts < 0;
      html += `<div style="display:flex;align-items:center;gap:var(--s-3);padding:var(--s-2) var(--s-3);border:1px solid var(--border);border-radius:var(--r-sm)">`;
      html += `<div style="font-size:16px;font-weight:700;${isNeg ? 'color:var(--danger);min-width:48px' : 'color:var(--success);min-width:48px'};text-align:center">${pts > 0 ? '+' : ''}${pts.toFixed(1)}</div>`;
      html += `<div style="flex:1;min-width:0">`;
      html += `<div style="font-size:13px;font-weight:600">${escapeHtml(b.colaborador)}</div>`;
      if (b.descricao) {
        html += `<div style="font-size:12px;color:var(--text-secondary);margin-top:1px">${escapeHtml(b.descricao)}</div>`;
      }
      const mesInfo = b.mes ? `📅 ${escapeHtml(b.mes)}` : '';
      html += `<div style="font-size:11px;color:var(--text-muted);margin-top:1px">${mesInfo}${mesInfo ? ' · ' : ''}${b.createdAt ? new Date(b.createdAt).toLocaleString('pt-BR') : ''}</div>`;
      html += '</div>';
      html += '<div style="display:flex;gap:var(--s-1)">';
      html += `<button class="btn-small bonus-editar-btn" data-id="${b.id}" aria-label="Editar lançamento de ${escapeHtml(b.colaborador)}" type="button">✏️</button>`;
      html += `<button class="btn-small btn-delete bonus-excluir-btn" data-id="${b.id}" aria-label="Excluir lançamento de ${escapeHtml(b.colaborador)}" type="button">🗑️</button>`;
      html += '</div></div>';
    }
    html += '</div>';
  }

  container.innerHTML = html;
  bindBonusEvents(saved);
}

function bindBonusEvents(saved){
  const container=document.getElementById('bonusContent');if(!container)return;
  container.querySelectorAll('input,select,textarea').forEach(el=>{el.addEventListener('input',captureBonusDraft);el.addEventListener('change',captureBonusDraft);});
  function save(sign){
    if(!requireAdmin()||bonusBusy||!captureBonusDraft())return;
    const draft=bonusDraft(),amount=Number(draft.magnitude);
    if(!draft.colaborador||!Number.isFinite(amount)||amount<=0){bonusMessage('Selecione um colaborador e informe uma quantidade de pontos positiva.');return;}
    const editing=draft._editing??Boolean(draft.id),originalSign=Number(draft.pontos)<0?-1:1;
    if(!editing&&draft._sendSign&&draft._sendSign!==sign){bonusMessage('Há um lançamento sem confirmação. Repita a mesma ação ou descarte o rascunho para iniciar outro.');return;}
    const chosen=editing?originalSign:sign;
    if(!storeBonusDraft({...draft,_sendSign:chosen}))return;
    runBonusWrite(()=>dbPontosExtrasSave({...draft,pontos:amount*chosen,descricao:draft.descricao.trim()}),()=>{
      appStorage.removeItem(BONUS_EDITING_KEY);refreshBonusViews();showToast('Lançamento confirmado.','success','Bônus e penalidades');
    });
  }
  document.getElementById('bonusAdicionarBtn')?.addEventListener('click',()=>save(1));
  document.getElementById('bonusRemoverBtn')?.addEventListener('click',()=>save(-1));
  document.getElementById('bonusSalvarBtn')?.addEventListener('click',()=>save());
  const discard=()=>{if(bonusBusy||!confirm('Descartar este rascunho?'))return;appStorage.removeItem(BONUS_EDITING_KEY);bonusDraftFailed=false;renderBonus();};
  document.getElementById('bonusCancelarBtn')?.addEventListener('click',discard);
  document.getElementById('bonusDescartarBtn')?.addEventListener('click',discard);
  container.querySelectorAll('.bonus-editar-btn').forEach(button=>button.addEventListener('click',()=>{
    if(!requireAdmin()||bonusBusy)return;const row=saved.find(item=>item.id===button.dataset.id);if(!row)return;
    const draft=bonusDraft();if(draft?.id===row.id)return;
    if(draft&&!confirm('Descartar o rascunho atual e editar este lançamento?'))return;
    if(!storeBonusDraft({...row,_editing:true,magnitude:String(Math.abs(row.pontos))}))return;renderBonus();
  }));
  container.querySelectorAll('.bonus-excluir-btn').forEach(button=>button.addEventListener('click',()=>{
    if(!requireAdmin()||bonusBusy)return;if(bonusDraftFailed&&!captureBonusDraft())return;const row=saved.find(item=>item.id===button.dataset.id);
    if(!row||!confirm(`Excluir lançamento de ${row.pontos} pts para ${row.colaborador}?`))return;
    runBonusWrite(()=>dbPontosExtrasDelete(row.id),()=>{refreshBonusViews();showToast('Exclusão confirmada.','success','Bônus e penalidades');});
  }));
  const refresh=document.createElement('button');refresh.type='button';refresh.id='bonusAtualizarBtn';refresh.className='btn-small';refresh.textContent='Atualizar lista';
  refresh.onclick=()=>runBonusWrite(dbPontosExtrasLoad,refreshBonusViews);container.prepend(refresh);
}
function closeBonusPanel(){
  if(bonusBusy)return false;
  if(bonusDraftFailed&&!captureBonusDraft())return false;
  const overlay=document.getElementById('bonusOverlay');if(!overlay)return false;
  overlay.classList.remove('open');overlay.style.removeProperty('display');overlay.setAttribute('aria-hidden','true');return true;
}
function toggleBonusPanel(){
  if(!requireAdmin())return;const overlay=document.getElementById('bonusOverlay');if(!overlay)return;
  if(overlay.classList.contains('open')){closeBonusPanel();return;}
  overlay.style.removeProperty('display');overlay.setAttribute('aria-hidden','false');overlay.classList.add('open');renderBonus();
  const token=AppDataSession.token();dbPontosExtrasLoad().then(()=>{if(AppDataSession.current(token))renderBonus();}).catch(()=>{});
}
document.getElementById('bonusOverlayClose')?.addEventListener('click',closeBonusPanel);

document.getElementById('bonusPanelBtn')?.addEventListener('click',toggleBonusPanel);
