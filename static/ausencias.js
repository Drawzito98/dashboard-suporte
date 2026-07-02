// ausencias.js — Controle de Ausências (Ponto)

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

function renderAusencias() {
  const container = document.getElementById('ausenciasContent');
  if (!container) return;

  const saved = JSON.parse(localStorage.getItem(AUSENCIAS_LOCAL_KEY) || '[]');
  const colabs = [...new Set((rawRecords || [])
    .filter(r => r && r['Atendente'] && !isAggregateName(r['Atendente']) && isColabActive(r['Atendente']))
    .map(r => r['Atendente']))].sort();

  let html = '';

  html += '<div class="card" style="margin-bottom:var(--s-4)">';
  html += '<div class="card-header">';
  html += '<div><h3 style="font-size:16px;font-weight:600">Registrar Ausência</h3>';
  html += '<p style="font-size:13px;color:var(--text-secondary)">Registre falta, atraso ou ausência de colaboradores</p></div>';
  html += '</div>';

  html += '<div class="ausencias-form">';
  html += '<div class="ausencias-field">';
  html += '<label>Colaborador</label>';
  html += `<select id="ausenciaColabInput" style="width:100%"><option value="">Selecione...</option>`;
  for (const c of colabs) {
    html += `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`;
  }
  html += '</select>';
  html += '</div>';

  html += '<div class="ausencias-field">';
  html += '<label>Data</label>';
  html += `<input type="date" id="ausenciaDataInput" value="${new Date().toISOString().slice(0, 10)}" style="width:100%">`;
  html += '</div>';

  html += '<div class="ausencias-field">';
  html += '<label>Período</label>';
  html += `<select id="ausenciaPeriodoInput" style="width:100%">
    <option value="dia_inteiro">Dia inteiro</option>
    <option value="manha">Manhã</option>
    <option value="tarde">Tarde</option>
    <option value="noite">Noite</option>
  </select>`;
  html += '</div>';

  html += '<div class="ausencias-field">';
  html += '<label>Motivo</label>';
  html += `<input type="text" id="ausenciaMotivoInput" placeholder="Ex: Médico, Particular, Folga..." style="width:100%">`;
  html += '</div>';

  html += '<div class="ausencias-actions">';
  html += '<button class="btn-primary" id="ausenciaSalvarBtn" type="button" style="justify-content:center">Registrar</button>';
  html += '</div>';
  html += '</div>';
  html += '</div>';

  // Lista
  html += '<div class="card">';
  html += '<div class="card-header">';
  html += '<div><h3 style="font-size:16px;font-weight:600">Registros de Ausência</h3>';
  html += `<p style="font-size:13px;color:var(--text-secondary)">${saved.length} registro(s)</p></div>`;
  if (saved.length > 0) {
    html += '<button class="btn-small" id="ausenciaRefreshBtn" type="button">Atualizar</button>';
  }
  html += '</div>';

  if (!saved.length) {
    html += '<div class="empty-state" style="padding:var(--s-5)"><div class="empty-title">Nenhum registro</div><div class="empty-sub">Registre a primeira ausência acima.</div></div>';
  } else {
    html += '<div class="ausencias-list">';
    for (const a of saved) {
      html += '<div class="ausencias-item">';
      html += '<div class="ausencias-item-info">';
      html += `<strong style="font-size:14px">${escapeHtml(a.colaborador)}</strong>`;
      html += `<span style="font-size:12px;color:var(--text-muted)">${formatarData(a.data)} · ${labelPeriodo(a.periodo)}${a.motivo ? ' · ' + escapeHtml(a.motivo) : ''}</span>`;
      html += '</div>';
      html += '<div class="ausencias-item-actions">';
      html += `<button class="btn-small ausencias-del-btn" data-id="${a.id}" type="button" style="color:var(--danger)">Excluir</button>`;
      html += '</div></div>';
    }
    html += '</div>';
  }
  html += '</div>';

  container.innerHTML = html;
  bindAusenciasEvents(saved);
}

function bindAusenciasEvents(saved) {
  const container = document.getElementById('ausenciasContent');
  if (!container) return;

  document.getElementById('ausenciaSalvarBtn')?.addEventListener('click', async () => {
    if (!requireAdmin()) return;
    const colaborador = document.getElementById('ausenciaColabInput').value;
    const data = document.getElementById('ausenciaDataInput').value;
    const periodo = document.getElementById('ausenciaPeriodoInput').value;
    const motivo = document.getElementById('ausenciaMotivoInput').value.trim();
    if (!colaborador || !data) {
      showToast('Selecione o colaborador e a data.', 'error', 'Ausência');
      return;
    }
    const ausencia = {
      id: Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6),
      colaborador,
      data,
      periodo,
      motivo
    };
    await dbAusenciasSave(ausencia);
    document.getElementById('ausenciaMotivoInput').value = '';
    showToast(`Ausência registrada para ${colaborador}!`, 'success', 'Ausências');
    renderAusencias();
  });

  container.querySelectorAll('.ausencias-del-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!requireAdmin()) return;
      const a = saved.find(x => x.id === btn.dataset.id);
      if (!a || !confirm(`Excluir ausência de ${a.colaborador} em ${formatarData(a.data)}?`)) return;
      await dbAusenciasDelete(a.id);
      renderAusencias();
    });
  });
}

function onAusenciasTabActivated() {
  const container = document.getElementById('ausenciasContent');
  if (!container) return;
  container.innerHTML = '<div class="card" style="padding:var(--s-5)"><div class="skeleton skeleton-title"></div><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line"></div></div>';
  setTimeout(() => renderAusencias(), 50);
}
