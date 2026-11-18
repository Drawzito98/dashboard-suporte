// ausencias.js — Controle de Ausências (sidebar overlay)

function formatarData(d) {
  if (!d) return '';
  const [ano, mes, dia] = d.split('-');
  return `${dia}/${mes}/${ano}`;
}

function labelPeriodo(p) {
  const map = {
    dia_inteiro: 'Dia inteiro',
    manha: 'Manhã',
    tarde: 'Tarde',
    noite: 'Noite'
  };
  return map[p] || p;
}

function renderAusencias(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if(PresenceEditor.blocked('ausencias'))return;
  const saved=getPresenceList('ausencias'),draft=PresenceEditor.draft('ausencias');
  const colabs = [...new Set((rawRecords || [])
    .filter(r => r && r['Atendente'] && !isAggregateName(r['Atendente']) && isColabActive(r['Atendente']))
    .map(r => r['Atendente']).concat(draft?.colaborador?[draft.colaborador]:[]))].sort();

  let html = '';

  html += '<div class="card" style="margin-bottom:var(--s-4)">';
  html += '<div class="card-header">';
  html += `<div><h3 style="font-size:16px;font-weight:600">${draft?.id?'Atualizar Ausência':'Registrar Ausência'}</h3>`;
  html += '<p style="font-size:13px;color:var(--text-secondary)">Registre falta, atraso ou ausência de colaboradores</p></div>';
  html += '</div>';

  html += '<div class="ausencias-form">';
  html += '<div class="ausencias-field">';
  html += '<label for="ausenciaColabInput">Colaborador</label>';
  html += `<select id="ausenciaColabInput" style="width:100%"><option value="">Selecione...</option>`;
  for (const c of colabs) {
    html += `<option value="${escapeHtml(c)}"${draft?.colaborador===c?' selected':''}>${escapeHtml(c)}</option>`;
  }
  html += '</select>';
  html += '</div>';

  html += '<div class="ausencias-field">';
  html += '<label for="ausenciaDataInput">Data</label>';
  html += `<input type="date" id="ausenciaDataInput" value="${draft?.data||new Date().toISOString().slice(0, 10)}" style="width:100%">`;
  html += '</div>';

  html += '<div class="ausencias-field">';
  html += '<label for="ausenciaPeriodoInput">Período</label>';
  html += `<select id="ausenciaPeriodoInput" style="width:100%">
    <option value="dia_inteiro">Dia inteiro</option>
    <option value="manha">Manhã</option>
    <option value="tarde">Tarde</option>
    <option value="noite">Noite</option>
  </select>`;
  html += '</div>';

  html += '<div class="ausencias-field">';
  html += '<label for="ausenciaMotivoInput">Motivo</label>';
  html += `<input type="text" id="ausenciaMotivoInput" value="${escapeHtml(draft?.motivo||'')}" placeholder="Ex: Médico, Particular, Folga..." style="width:100%">`;
  html += '</div>';

  html += '<div class="ausencias-actions">';
  html += `<button class="btn-primary" id="ausenciaSalvarBtn" type="button" style="justify-content:center">${draft?.id?'Atualizar':'Registrar'}</button>`;
  html += '</div>';
  html += '</div>';
  html += '</div>';

  html += '<div class="card">';
  html += '<div class="card-header">';
  html += '<div><h3 style="font-size:16px;font-weight:600">Registros de Ausência</h3>';
  html += `<p style="font-size:13px;color:var(--text-secondary)">${saved.length} registro(s)</p></div>`;
  html += '<button class="btn-small" id="ausenciaRefreshBtn" type="button">Atualizar lista</button>';
  html += '</div>';

  if (!saved.length) {
    html += '<div class="empty-state" style="padding:var(--s-5)"><div class="empty-title">Nenhum registro</div><div class="empty-sub">Registre a primeira ausência acima.</div></div>';
  } else {
    html += '<div class="ausencias-list">';
    for (const a of saved) {
      html += '<div class="ausencias-item">';
      html += '<div class="ausencias-item-info">';
      html += `<strong style="font-size:14px">${escapeHtml(a.colaborador)}</strong>`;
      html += `<span style="font-size:12px;color:var(--text-muted)">${formatarData(a.data)} · ${escapeHtml(labelPeriodo(a.periodo))}${a.motivo ? ' · ' + escapeHtml(a.motivo) : ''}</span>`;
      html += '</div>';
      html += '<div class="ausencias-item-actions">';
      html += `<button class="btn-small ausencias-del-btn" data-id="${escapeHtml(a.id)}" type="button" style="color:var(--danger)">Excluir</button>`;
      html += '</div></div>';
    }
    html += '</div>';
  }
  html += '</div>';

  container.innerHTML = html;
  if(draft?.periodo)document.getElementById('ausenciaPeriodoInput').value=draft.periodo;
  bindAusenciasEvents(containerId,saved);
  PresenceEditor.decorate('ausencias');
}

function bindAusenciasEvents(containerId,saved){
  document.getElementById('ausenciaSalvarBtn')?.addEventListener('click',()=>{
    if(!requireAdmin()||PresenceEditor.busy('ausencias')||!PresenceEditor.capture('ausencias'))return;
    const draft=PresenceEditor.draft('ausencias');
    if(!draft.colaborador||!draft.data){PresenceEditor.message('ausencias','Selecione o colaborador e a data.');return;}
    PresenceEditor.run('ausencias',()=>dbAusenciasSave({...draft,motivo:draft.motivo.trim()}),()=>PresenceEditor.finish('ausencias'));
  });
  document.getElementById(containerId)?.querySelectorAll('.ausencias-del-btn').forEach(button=>button.addEventListener('click',()=>{
    if(!requireAdmin()||PresenceEditor.busy('ausencias'))return;const row=saved.find(item=>String(item.id)===button.dataset.id);
    if(!row||!confirm(`Excluir ausência de ${row.colaborador} em ${formatarData(row.data)}?`))return;
    PresenceEditor.run('ausencias',()=>dbAusenciasDelete(row.id),()=>showToast('Exclusão confirmada.','success','Ausências'));
  }));
}
function openAusenciasOverlay(){PresenceEditor.open('ausencias');}
document.addEventListener('DOMContentLoaded',()=>{
  document.getElementById('ausenciasBtn')?.addEventListener('click',openAusenciasOverlay);
  document.getElementById('ausenciasOverlayClose')?.addEventListener('click',()=>PresenceEditor.close('ausencias'));
  const overlay=document.getElementById('ausenciasOverlay');overlay?.addEventListener('click',event=>{if(event.target===overlay)PresenceEditor.close('ausencias');});
});
