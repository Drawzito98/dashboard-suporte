// avaliacao-atendimento.js — Avaliação de Atendimentos (sidebar overlay)
// Campos: protocolo, colaborador (atendente), data do atendimento,
// nota do cliente (1-5, opcional), avaliação justa, orientação do caso,
// resumo e print do atendimento.

const AVAL_ATEND_FILTRO_COLAB_KEY = 'sistema_avaliacao_atend_filtro_colab_v1';
const AVAL_ATEND_FILTRO_NOTA_KEY = 'sistema_avaliacao_atend_filtro_nota_v1';

function todayISO() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function formatDataAtend(iso) {
  if (!iso) return '—';
  if (/^\d{4}-\d{2}-\d{2}/.test(iso)) {
    const [y, m, d] = iso.slice(0, 10).split('-');
    return `${d}/${m}/${y}`;
  }
  const dt = new Date(iso);
  if (isNaN(dt)) return iso;
  return dt.toLocaleDateString('pt-BR');
}

function notaBadgeHtml(a) {
  if (!a.teve_nota || a.nota == null) {
    return '<span style="font-size:11px;padding:1px 7px;border-radius:var(--r-sm);background:rgba(148,163,184,0.15);color:var(--text-secondary)">Sem nota</span>';
  }
  const cor = a.nota >= 4 ? '#10b981' : a.nota >= 3 ? '#f59e0b' : '#ef4444';
  return `<span style="font-size:11px;padding:1px 7px;border-radius:var(--r-sm);background:${cor}1f;color:${cor}">Nota: ${a.nota}</span>`;
}

function normalizeAvalAtend(a) {
  const notaNum = parseFloat(a.nota);
  const teve_nota = a.teve_nota != null ? a.teve_nota : (a.nota != null && a.nota !== '' && !isNaN(notaNum));
  return {
    id: a.id,
    protocolo: a.protocolo || '',
    colaborador: a.colaborador || '',
    data_atendimento: a.data_atendimento || '',
    teve_nota,
    nota: teve_nota && !isNaN(notaNum) ? notaNum : null,
    justa: a.justa !== false,
    resumo: a.resumo || '',
    orientacao: a.orientacao || '',
    imagem: a.imagem || '',
    createdAt: a.createdAt,
    updatedAt: a.updatedAt
  };
}

function getAvalAtendSaved(){return getPresenceList('avaliacao_atendimentos').map(normalizeAvalAtend);}
function safeAttendanceImage(value){const source=String(value||'');if(/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=\r\n]+$/.test(source)||/^https:\/\//i.test(source))return source;return '';}
let attendanceImageVersion=0,attendanceImageBusy=false;

function renderAvaliacaoAtendimento(containerId) {
  const container = document.getElementById(containerId);
  if (!container||PresenceEditor.blocked('avaliacao_atendimentos')) return;
  const draft=PresenceEditor.draft('avaliacao_atendimentos');
  const saved = getAvalAtendSaved();
  const colabs = [...new Set((rawRecords || [])
    .filter(r => r && r['Atendente'] && !isAggregateName(r['Atendente']) && isColabActive(r['Atendente']))
    .map(r => r['Atendente']).concat(draft?.colaborador?[draft.colaborador]:[]))].sort();
  const filtroColab = appStorage.getItem(AVAL_ATEND_FILTRO_COLAB_KEY) || '';
  const filtroNota = appStorage.getItem(AVAL_ATEND_FILTRO_NOTA_KEY) || '';

  let html = '';

  html += '<div class="card" style="margin-bottom:var(--s-4)">';
  html += '<div class="card-header">';
  html += '<div><h3 style="font-size:16px;font-weight:600">Avaliação de Atendimentos</h3>';
  html += '<p style="font-size:13px;color:var(--text-secondary)">Registre a avaliação de um atendimento realizado</p></div>';
  html += '</div>';

  html += '<div class="ausencias-form">';
  html += '<div class="ausencias-field">';
  html += '<label>Protocolo / Ticket</label>';
  html += '<input type="text" id="avalProtocoloInput" placeholder="Ex: #12345" style="width:100%">';
  html += '</div>';

  html += '<div class="ausencias-field">';
  html += '<label>Colaborador (atendente)</label>';
  html += '<select id="avalColaboradorInput" style="width:100%"><option value="">Selecione...</option>';
  for (const c of colabs) {
    html += `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`;
  }
  html += '</select>';
  html += '</div>';

  html += '<div class="ausencias-field">';
  html += '<label>Data do atendimento</label>';
  html += `<input type="date" id="avalDataInput" value="${todayISO()}" style="width:100%">`;
  html += '</div>';

  html += '<div class="ausencias-field">';
  html += '<label>Nota do cliente (1 a 5)</label>';
  html += '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">';
  html += '<label class="checkbox-label" style="margin:0"><input type="checkbox" id="avalTeveNotaInput" checked> Cliente avaliou o atendimento</label>';
  html += '<input type="number" id="avalNotaInput" min="1" max="5" step="1" value="" placeholder="1 a 5" style="width:80px">';
  html += '</div>';
  html += '</div>';

  html += '<div class="ausencias-field">';
  html += '<label class="checkbox-label">';
  html += '<input type="checkbox" id="avalJustaInput" checked> Avaliação justa';
  html += '</label>';
  html += '</div>';

  html += '<div class="ausencias-field">';
  html += '<label>Orientação referente ao caso</label>';
  html += '<textarea id="avalOrientacaoInput" rows="2" placeholder="Ex: orientar o cliente a reenviar o documento anexo e validar o prazo de retorno..." style="width:100%;resize:vertical"></textarea>';
  html += '</div>';

  html += '<div class="ausencias-field">';
  html += '<label>Resumo do atendimento</label>';
  html += '<textarea id="avalResumoInput" rows="3" placeholder="Descreva resumidamente o atendimento..." style="width:100%;resize:vertical"></textarea>';
  html += '</div>';

  html += '<div class="ausencias-field">';
  html += '<label>Imagem / Print do atendimento</label>';
  html += '<input type="file" id="avalImagemInput" accept="image/*" style="width:100%">';
  html += '<div id="avalImagemPreview" style="margin-top:8px;max-width:100%;border-radius:var(--r-md);overflow:hidden;display:none">';
  html += '<img id="avalImagemPreviewImg" style="max-width:100%;max-height:200px;display:block;border-radius:var(--r-md)">';
  html += '<button class="btn-small" id="avalImagemRemoveBtn" type="button" style="margin-top:4px">Remover imagem</button>';
  html += '</div>';
  html += '</div>';

  html += '<div class="ausencias-actions">';
  html += '<button class="btn-primary" id="avalSalvarBtn" type="button" style="justify-content:center">Registrar Avaliação</button>';
  html += '</div>';
  html += '</div>';
  html += '</div>';

  html += '<div class="card">';
  html += '<div class="card-header">';
  html += '<div><h3 style="font-size:16px;font-weight:600">Avaliações Registradas</h3>';
  html += `<p style="font-size:13px;color:var(--text-secondary)"><span id="avalAtendCount">${saved.length}</span> registro(s)</p></div>`;
  html += '<button class="btn-small" id="avalRefreshBtn" type="button">Atualizar</button>';
  html += '</div>';

  html += '<div class="ausencias-form" style="grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:var(--s-3)">';
  html += '<div class="ausencias-field">';
  html += '<label>Filtrar atendente</label>';
  html += '<select id="avalFiltroColabInput" style="width:100%"><option value="">Todos</option>';
  for (const c of colabs) {
    html += `<option value="${escapeHtml(c)}" ${c === filtroColab ? 'selected' : ''}>${escapeHtml(c)}</option>`;
  }
  html += '</select>';
  html += '</div>';
  html += '<div class="ausencias-field">';
  html += '<label>Nota</label>';
  html += '<select id="avalFiltroNotaInput" style="width:100%">';
  html += `<option value="">Todas</option>`;
  html += `<option value="com" ${filtroNota === 'com' ? 'selected' : ''}>Com nota do cliente</option>`;
  html += `<option value="sem" ${filtroNota === 'sem' ? 'selected' : ''}>Sem nota do cliente</option>`;
  html += '</select>';
  html += '</div>';
  html += '</div>';

  html += '<div id="avalAtendLista"></div>';
  html += '</div>';

  container.innerHTML = html;
  const ids={protocolo:'avalProtocoloInput',colaborador:'avalColaboradorInput',data_atendimento:'avalDataInput',teve_nota:'avalTeveNotaInput',nota:'avalNotaInput',justa:'avalJustaInput',orientacao:'avalOrientacaoInput',resumo:'avalResumoInput'};
  if(draft)for(const [key,id]of Object.entries(ids)){const el=document.getElementById(id);if(el.type==='checkbox')el.checked=Boolean(draft[key]);else el.value=draft[key]??'';}
  if(draft?.id)document.getElementById('avalSalvarBtn').textContent='Atualizar avaliação';
  container.querySelectorAll('.ausencias-field').forEach(field=>{const input=field.querySelector('input,select,textarea'),label=field.querySelector('label');if(input&&label&&!label.contains(input))label.htmlFor=input.id;});
  renderAvalAtendLista(containerId);
  bindAvaliacaoAtendEvents(containerId);
  PresenceEditor.decorate('avaliacao_atendimentos');
  if(document.body.dataset.role!=='admin')container.querySelectorAll('#avalSalvarBtn,#avalImagemInput').forEach(el=>el.disabled=true);
}

function renderAvalAtendLista(containerId) {
  const lista = document.getElementById('avalAtendLista');
  if (!lista) return;
  const container = document.getElementById(containerId);
  const all = getAvalAtendSaved();
  const filtroColab = appStorage.getItem(AVAL_ATEND_FILTRO_COLAB_KEY) || '';
  const filtroNota = appStorage.getItem(AVAL_ATEND_FILTRO_NOTA_KEY) || '';

  let saved = all;
  if (filtroColab) saved = saved.filter(a => a.colaborador === filtroColab);
  if (filtroNota === 'com') saved = saved.filter(a => a.teve_nota);
  if (filtroNota === 'sem') saved = saved.filter(a => !a.teve_nota);
  saved.sort((a, b) => (b.data_atendimento || b.createdAt || '').localeCompare(a.data_atendimento || a.createdAt || ''));

  const countEl = document.getElementById('avalAtendCount');
  if (countEl) countEl.textContent = all.length;

  if (!saved.length) {
    lista.innerHTML = '<div class="empty-state" style="padding:var(--s-5)"><div class="empty-title">Nenhuma avaliação</div><div class="empty-sub">Registre a primeira avaliação acima ou ajuste os filtros.</div></div>';
    return;
  }

  let html = '<div class="ausencias-list">';
  for (const a of saved) {
    html += '<div class="ausencias-item" style="align-items:flex-start">';
    html += '<div class="ausencias-item-info">';
    html += `<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">`;
    html += `<strong style="font-size:14px">${escapeHtml(a.protocolo)}</strong>`;
    html += `<span style="font-size:12px;color:var(--text-muted)">${escapeHtml(a.colaborador)}</span>`;
    html += `<span style="font-size:12px;color:var(--text-muted)">${escapeHtml(formatDataAtend(a.data_atendimento))}</span>`;
    html += notaBadgeHtml(a);
    html += `<span style="font-size:11px;color:var(--text-muted)">${a.justa ? 'Justa' : 'Injusta'}</span>`;
    html += '</div>';
    if (a.orientacao) {
      html += `<div style="font-size:12.5px;color:var(--text-secondary);margin-top:5px"><strong style="color:var(--text-strong)">Orientação:</strong> ${escapeHtml(a.orientacao)}</div>`;
    }
    if (a.resumo) {
      html += `<div style="font-size:12.5px;color:var(--text-secondary);margin-top:2px">${escapeHtml(a.resumo)}</div>`;
    }
    if (safeAttendanceImage(a.imagem)) {
      html += `<button class="aval-image-open" data-id="${escapeHtml(a.id)}" type="button" aria-label="Ampliar print do protocolo ${escapeHtml(a.protocolo)}" style="padding:0;border:0;background:transparent"><img src="${escapeHtml(safeAttendanceImage(a.imagem))}" alt="Print do atendimento ${escapeHtml(a.protocolo)}" style="max-width:180px;max-height:120px;border-radius:var(--r-sm)"></button>`;
    }
    html += '</div>';
    html += '<div class="ausencias-item-actions">';
    html += `<button class="btn-small aval-edit-btn" data-id="${escapeHtml(a.id)}" type="button">Editar</button>`;
    html += `<button class="btn-small aval-del-btn" data-id="${escapeHtml(a.id)}" type="button" style="color:var(--danger)">Excluir</button>`;
    html += '</div></div>';
  }
  html += '</div>';

  lista.innerHTML = html;

  if (container) {
    container.querySelectorAll('.aval-image-open').forEach(button=>button.addEventListener('click',()=>{const row=all.find(item=>String(item.id)===button.dataset.id);const source=safeAttendanceImage(row?.imagem);if(!source)return;const dialog=document.createElement('dialog');dialog.id='atendimentoImagemDialog';dialog.setAttribute('aria-label','Print do atendimento');dialog.style.cssText='max-width:90vw;padding:16px';const close=document.createElement('button');close.type='button';close.className='btn-small';close.textContent='Fechar imagem';close.onclick=()=>dialog.close();const image=document.createElement('img');image.src=source;image.alt='Print do atendimento';image.style.cssText='display:block;max-width:100%;max-height:75vh;margin-top:12px';dialog.append(close,image);dialog.addEventListener('close',()=>dialog.remove());document.body.append(dialog);dialog.showModal();}));
    container.querySelectorAll('.aval-edit-btn').forEach(button=>button.addEventListener('click',()=>{const row=all.find(item=>String(item.id)===button.dataset.id);if(row)PresenceEditor.edit('avaliacao_atendimentos',row);}));
    container.querySelectorAll('.aval-del-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!requireAdmin()) return;
        const a = all.find(x => String(x.id) === String(btn.dataset.id));
        if (!a || !confirm(`Excluir avaliação do protocolo ${a.protocolo}?`)) return;
        PresenceEditor.run('avaliacao_atendimentos',()=>dbAvaliacaoAtendDelete(a.id));
      });
    });
  }
}

function bindAvaliacaoAtendEvents(containerId){
  const resource='avaliacao_atendimentos',message=text=>PresenceEditor.message(resource,text);
  const preview=()=>{const value=PresenceEditor.draft(resource)?.imagem||'',image=document.getElementById('avalImagemPreviewImg');if(image)image.src=safeAttendanceImage(value);const box=document.getElementById('avalImagemPreview');if(box)box.style.display=value?'block':'none';};preview();
  document.getElementById('avalImagemInput')?.addEventListener('change',event=>{
    const file=event.target.files[0];if(!file)return;
    if(!['image/png','image/jpeg','image/webp','image/gif'].includes(file.type)||file.size>5*1024*1024){message('Selecione PNG, JPEG, WebP ou GIF de até 5 MB. A imagem anterior foi mantida.');event.target.value='';return;}
    if(!PresenceEditor.capture(resource)){event.target.value='';return;}
    const requestId=PresenceEditor.draft(resource)._requestId,version=++attendanceImageVersion,token=AppDataSession.token();attendanceImageBusy=true;
    const reader=new FileReader();reader.onload=()=>{if(version!==attendanceImageVersion||!AppDataSession.current(token))return;attendanceImageBusy=false;if(PresenceEditor.draft(resource)?._requestId!==requestId)return;PresenceEditor.store(resource,{...PresenceEditor.draft(resource),imagem:String(reader.result)});preview();};
    reader.onerror=()=>{if(version===attendanceImageVersion){attendanceImageBusy=false;event.target.value='';message('Não foi possível preparar a imagem. A imagem anterior foi mantida.');}};reader.readAsDataURL(file);
  });
  document.getElementById('avalImagemRemoveBtn')?.addEventListener('click',()=>{attendanceImageVersion++;attendanceImageBusy=false;if(!PresenceEditor.capture(resource))return;PresenceEditor.store(resource,{...PresenceEditor.draft(resource),imagem:''});document.getElementById('avalImagemInput').value='';preview();});
  const sync=()=>{document.getElementById('avalNotaInput').disabled=!document.getElementById('avalTeveNotaInput').checked;};document.getElementById('avalTeveNotaInput')?.addEventListener('change',sync);sync();
  document.getElementById('avalSalvarBtn')?.addEventListener('click',()=>{
    if(!requireAdmin()||PresenceEditor.busy(resource))return;if(attendanceImageBusy){message('Aguarde a preparação da imagem.');return;}if(!PresenceEditor.capture(resource))return;
    const raw=PresenceEditor.draft(resource),draft={...raw,protocolo:raw.protocolo.trim(),nota:raw.teve_nota?(raw.nota===''?'':Number(raw.nota)):null,imagem:raw.imagem||''};
    if(!PresenceEditor.store(resource,draft))return;PresenceEditor.run(resource,()=>dbAvaliacaoAtendSave(draft),()=>PresenceEditor.finish(resource));
  });
  for(const [id,key]of [['avalFiltroColabInput',AVAL_ATEND_FILTRO_COLAB_KEY],['avalFiltroNotaInput',AVAL_ATEND_FILTRO_NOTA_KEY]])document.getElementById(id)?.addEventListener('change',event=>{try{if(event.target.value)appStorage.setItem(key,event.target.value);else appStorage.removeItem(key);PresenceEditor.render(resource);}catch(_){message('Não foi possível guardar o filtro. Sua edição foi mantida.');}});
}
function openAvaliacaoAtendimentoOverlay(){PresenceEditor.open('avaliacao_atendimentos');}
function closeAvaliacaoAtendimentoOverlay(){if(attendanceImageBusy){PresenceEditor.message('avaliacao_atendimentos','Aguarde a preparação da imagem.');return;}PresenceEditor.close('avaliacao_atendimentos');}
window.addEventListener('beforeunload',event=>{if(attendanceImageBusy){event.preventDefault();event.returnValue='';}});
document.addEventListener('DOMContentLoaded',()=>{
  document.getElementById('avaliarAtendimentoBtn')?.addEventListener('click',openAvaliacaoAtendimentoOverlay);
  document.getElementById('avaliarAtendimentoOverlayClose')?.addEventListener('click',closeAvaliacaoAtendimentoOverlay);
  const overlay=document.getElementById('avaliarAtendimentoOverlay');overlay?.addEventListener('click',event=>{if(event.target===overlay)closeAvaliacaoAtendimentoOverlay();});
});
