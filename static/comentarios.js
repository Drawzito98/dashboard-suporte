// Comentários por Período — anotações mensais
const COMENTARIO_DRAFT_KEY='sistema_comentario_rascunho_v1';
let comentarioDraft=null,comentarioDraftLoaded=false,comentarioDraftFailed=false,comentarioBusy=false;
function getComentarios(){
  const map=Object.create(null);for(const row of getComentariosConfirmados()){if(!map[row.mes])map[row.mes]=[];map[row.mes].push(row);}return map;
}
function comentarioMessage(message){const el=document.getElementById('comentariosMessage');if(el)el.textContent=message;}
function comentarioGetDraft(){
  if(!comentarioDraftLoaded){try{const row=JSON.parse(appStorage.getItem(COMENTARIO_DRAFT_KEY)||'null');comentarioDraft=row&&typeof row.texto==='string'&&typeof row.mes==='string'&&typeof row.id==='string'?row:null;}catch(_){comentarioDraft=null;}comentarioDraftLoaded=true;}
  return comentarioDraft;
}
function comentarioStore(draft){
  comentarioDraft=draft;
  try{if(draft)appStorage.setItem(COMENTARIO_DRAFT_KEY,JSON.stringify(draft));else appStorage.removeItem(COMENTARIO_DRAFT_KEY);comentarioDraftFailed=false;return true;}
  catch(_){comentarioDraftFailed=true;comentarioMessage('Não foi possível guardar o rascunho. Mantenha esta tela aberta.');return false;}
}
function comentarioCapture(){
  const input=document.getElementById('comentarioTexto'),draft=comentarioGetDraft();
  if(!input||!draft)return !comentarioDraftFailed||!draft;
  return comentarioStore({...draft,texto:draft.attempted?draft.texto:input.value});
}
async function comentarioRun(operation,done,message='Operação confirmada.'){
  if(comentarioBusy)return;comentarioBusy=true;const token=AppDataSession.token(),host=document.getElementById('comentariosContent');
  const controls=[...host.querySelectorAll('button,textarea')],disabled=controls.map(el=>el.disabled);controls.forEach(el=>el.disabled=true);host.setAttribute('aria-busy','true');comentarioMessage('Aguardando confirmação do servidor…');
  try{await operation();if(AppDataSession.current(token)){done?.();comentarioBusy=false;renderComentarios();comentarioMessage(comentarioDraftFailed?'Operação confirmada. Não foi possível atualizar o rascunho neste dispositivo; confira antes de repetir.':message);}}
  catch(error){if(AppDataSession.current(token)){comentarioBusy=false;renderComentarios();comentarioMessage(error.message||'Operação não confirmada. O rascunho foi mantido.');}}
  finally{comentarioBusy=false;controls.forEach((el,i)=>{if(el.isConnected)el.disabled=disabled[i];});host.removeAttribute('aria-busy');const input=document.getElementById('comentarioTexto');if(input)input.readOnly=Boolean(comentarioGetDraft()?.attempted);}
}
async function addComentario(mes,texto,id){return dbComentarioAdd(mes,texto,id);}
async function delComentario(mes,id){return dbComentarioDel(mes,id);}
function openComentarios(){
  const overlay=document.getElementById('comentariosOverlay');if(!overlay)return;overlay.classList.add('open');renderComentarios();
  dbComentariosLoad().then(()=>{if(overlay.classList.contains('open'))renderComentarios();}).catch(()=>{});
}
function closeComentarios(){
  if(comentarioBusy||!comentarioCapture())return;
  document.getElementById('comentariosOverlay')?.classList.remove('open');
}

function renderComentarios() {
  const container = document.getElementById('comentariosContent');
  if (!container||comentarioBusy||!comentarioCapture()) return;
  const draft=comentarioGetDraft();

  const data = typeof getDataFiltered === 'function' ? getDataFiltered() : (typeof globalFilters !== 'undefined' && globalFilters ? globalFilters.aplicar(rawRecords) : (rawRecords || []));
  const meses = [...new Set((data || []).filter(r => r && r['Mês']).map(r => r['Mês']))].sort();
  const map = getComentarios();

  let html = `
    <div style="padding:var(--s-5)">
      <h2 style="font-size:18px;font-weight:700;margin-bottom:var(--s-1)">💬 Comentários por Período</h2>
      <p style="font-size:13px;color:var(--text-secondary);margin-bottom:var(--s-4)">Anotações e observações sobre cada mês.</p>
      <p id="comentariosMessage" role="status" aria-live="polite"></p>
      <button class="btn-small" id="comentariosAtualizar" type="button">Atualizar lista</button>
      ${draft?`<section class="card" id="comentarioEditor"><h3>Comentário para ${escapeHtml(draft.mes)}</h3>
        <label class="field"><span>Comentário</span><textarea id="comentarioTexto" rows="4"${draft.attempted?' readonly':''}>${escapeHtml(draft.texto)}</textarea></label>
        ${draft.attempted?'<p>Há um envio para conferir. Confirmar consulta o mesmo comentário antes de tentar enviar. Para escrever outro texto, descarte este rascunho.</p>':''}
        <button class="btn-primary" id="comentarioSalvar" type="button">${draft.attempted?'Confirmar envio':'Salvar comentário'}</button>
        <button class="btn-small" id="comentarioDescartar" type="button">Descartar rascunho</button>
      </section>`:''}
      <div class="table-wrap" style="overflow-x:auto;max-height:60vh;overflow-y:auto;border:1px solid var(--border);border-radius:var(--r-md)">
        <table class="ranking-table" style="min-width:500px">
          <thead>
            <tr>
              <th style="position:sticky;top:0;background:var(--bg-elevated);z-index:1">Período</th>
              <th style="position:sticky;top:0;background:var(--bg-elevated);z-index:1">Comentários</th>
              <th style="position:sticky;top:0;background:var(--bg-elevated);z-index:1;width:100px">Ações</th>
            </tr>
          </thead>
          <tbody>
            ${meses.length ? meses.map(m => {
              const comments = map[m] || [];
              return `<tr>
                <td style="font-weight:600;vertical-align:top;padding-top:14px">${escapeHtml(m)} ${comments.length ? `<span style="font-size:11px;color:var(--text-muted)">(${comments.length})</span>` : ''}</td>
                <td style="vertical-align:top;padding-top:10px">
                  <div class="comentarios-thread">
                    ${comments.length ? comments.map(c => `
                      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;padding:8px 10px;margin-bottom:6px;background:var(--bg-inset);border-radius:var(--r-sm)">
                        <div style="flex:1;font-size:13px;line-height:1.4">
                          <div>${escapeHtml(c.texto)}</div>
                          <div style="font-size:10px;color:var(--text-muted);margin-top:4px">${escapeHtml(c.user)} · ${new Date(c.ts).toLocaleString('pt-BR')}</div>
                        </div>
                        <button class="btn-small del-comentario-btn" data-mes="${escapeHtml(m)}" data-id="${escapeHtml(c.id)}" type="button" aria-label="Excluir comentário de ${escapeHtml(c.user)} em ${escapeHtml(m)}" style="font-size:12px;padding:2px 6px;color:var(--danger)">✕</button>
                      </div>
                    `).join('') : `<span style="font-size:12px;color:var(--text-muted)">Nenhum comentário</span>`}
                  </div>
                </td>
                <td style="vertical-align:top;padding-top:14px">
                  <button class="btn-small add-comentario-btn" data-mes="${escapeHtml(m)}" type="button" aria-label="Adicionar comentário para ${escapeHtml(m)}">✏️</button>
                </td>
              </tr>`;
            }).join('') : `<tr><td colspan="3" style="text-align:center;padding:30px;color:var(--text-muted)">Nenhum período encontrado.</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;

  container.innerHTML = html;

  document.getElementById('comentariosAtualizar')?.addEventListener('click',()=>{
    if(!comentarioCapture())return;comentarioRun(()=>dbComentariosLoad(),null,'Lista consultada. Em falha de conexão, a última lista confirmada é mantida.');
  });
  document.getElementById('comentarioTexto')?.addEventListener('input',comentarioCapture);
  document.getElementById('comentarioSalvar')?.addEventListener('click',()=>{
    if(comentarioBusy||!comentarioCapture())return;
    const draft=comentarioGetDraft();if(!draft.texto.trim()){comentarioMessage('Escreva o comentário.');return;}
    const pending={...draft,texto:draft.texto.trim(),attempted:true};if(!comentarioStore(pending))return;
    comentarioRun(()=>addComentario(pending.mes,pending.texto,pending.id),()=>{comentarioStore(null);document.getElementById('comentarioEditor')?.remove();});
  });
  document.getElementById('comentarioDescartar')?.addEventListener('click',()=>{
    if(comentarioBusy)return;const draft=comentarioGetDraft();
    if(!confirm(draft?.attempted?'Descartar o rascunho? O envio anterior pode já ter sido aplicado. Confira a lista antes de criar outro comentário.':'Descartar este rascunho?'))return;
    if(comentarioStore(null)){document.getElementById('comentarioEditor')?.remove();renderComentarios();}
  });
  container.querySelectorAll('.add-comentario-btn').forEach(btn=>btn.addEventListener('click',()=>{
    if(comentarioBusy||!comentarioCapture())return;
    const old=comentarioGetDraft(),mes=btn.dataset.mes;if(old?.mes===mes){document.getElementById('comentarioTexto')?.focus();return;}
    if(old&&!confirm(old.attempted?'Descartar o rascunho e abrir outro período? O envio anterior pode já ter sido aplicado.':'Descartar o rascunho e abrir outro período?'))return;
    if(!comentarioStore({id:crypto.randomUUID(),mes,texto:'',attempted:false}))return;
    document.getElementById('comentarioEditor')?.remove();renderComentarios();document.getElementById('comentarioTexto')?.focus();
  }));
  container.querySelectorAll('.del-comentario-btn').forEach(btn=>btn.addEventListener('click',()=>{
    if(comentarioBusy||!comentarioCapture()||!confirm('Remover este comentário?'))return;
    if(comentarioGetDraft()?.id===btn.dataset.id){comentarioMessage('Confirme ou descarte o rascunho deste comentário antes de excluí-lo.');return;}
    comentarioRun(()=>delComentario(btn.dataset.mes,btn.dataset.id));
  }));
}

document.getElementById('comentariosClose')?.addEventListener('click',closeComentarios);
window.addEventListener('beforeunload',event=>{if(!comentarioCapture()||comentarioBusy){event.preventDefault();event.returnValue='';}});

// Close on backdrop
document.addEventListener('click', (e) => {
  const overlay = document.getElementById('comentariosOverlay');
  if (overlay && overlay.classList.contains('open') && e.target === overlay) closeComentarios();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeComentarios();
});

document.getElementById('comentariosBtn')?.addEventListener('click', openComentarios);
