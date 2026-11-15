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

function formatarOcorrenciaAusencia(record) {
  if (record.tipo === 'atraso') return 'Atraso · ' + record.minutos_atraso + ' min';
  const period = labelPeriodo(record.periodo);
  return (record.tipo === 'falta' ? 'Falta' : 'Registro anterior') + (period ? ' · ' + period : '');
}

function renderAusencias(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const saved = _fallbackLoad(AUSENCIAS_LOCAL_KEY, []);
  const colabs = [...new Set((rawRecords || [])
    .filter(r => r && r['Atendente'] && !isAggregateName(r['Atendente']) && isColabActive(r['Atendente']))
    .map(r => r['Atendente']))].sort();

  let html = '';

  html += '<div class="card" style="margin-bottom:var(--s-4)">';
  html += '<div class="card-header">';
  html += '<div><h3 style="font-size:16px;font-weight:600">Registrar Ausência</h3>';
  html += '<p style="font-size:13px;color:var(--text-secondary)">Registre faltas e atrasos dos colaboradores.</p></div>';
  html += '</div>';

  html += '<form class="ausencias-form" id="ausenciaForm">';
  html += '<div class="ausencias-field">';
  html += '<label for="ausenciaColabInput">Colaborador</label>';
  html += `<select id="ausenciaColabInput" required style="width:100%"><option value="">Selecione...</option>`;
  for (const c of colabs) {
    html += `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`;
  }
  html += '</select>';
  html += '</div>';

  html += '<div class="ausencias-field">';
  html += '<label for="ausenciaDataInput">Data</label>';
  html += `<input type="date" id="ausenciaDataInput" required value="${new Date().toISOString().slice(0, 10)}" style="width:100%">`;
  html += '</div>';

  html += '<div class="ausencias-field"><label for="ausenciaTipoInput">Tipo</label>';
  html += '<select id="ausenciaTipoInput"><option value="falta">Falta</option><option value="atraso">Atraso</option></select></div>';

  html += '<div class="ausencias-field" id="ausenciaPeriodoField">';
  html += '<label for="ausenciaPeriodoInput">Período da falta</label>';
  html += `<select id="ausenciaPeriodoInput" style="width:100%">
    <option value="dia_inteiro">Dia inteiro</option>
    <option value="manha">Manhã</option>
    <option value="tarde">Tarde</option>
    <option value="noite">Noite</option>
  </select>`;
  html += '</div>';

  html += '<div class="ausencias-field" id="ausenciaMinutosField" hidden>';
  html += '<label for="ausenciaMinutosInput">Minutos de atraso</label>';
  html += '<input id="ausenciaMinutosInput" type="number" min="1" max="1440" step="1" disabled></div>';

  html += '<div class="ausencias-field">';
  html += '<label for="ausenciaMotivoInput">Motivo (opcional)</label>';
  html += `<input type="text" id="ausenciaMotivoInput" placeholder="Ex: Médico, Particular, Folga..." style="width:100%">`;
  html += '</div>';

  html += '<div class="ausencias-actions">';
  html += '<button class="btn-primary" id="ausenciaSalvarBtn" type="submit" style="justify-content:center">Registrar</button>';
  html += '</div><p id="ausenciaStatus" role="status"></p></form></div>';

  html += '<div class="card">';
  html += '<div class="card-header">';
  html += '<div><h3 style="font-size:16px;font-weight:600">Registros de faltas e atrasos</h3>';
  html += `<p style="font-size:13px;color:var(--text-secondary)">${saved.length} registro(s)</p></div>`;
  html += '<button class="btn-small" id="ausenciaRefreshBtn" type="button">Atualizar</button>';
  html += '</div>';

  if (!saved.length) {
    html += '<div class="empty-state" style="padding:var(--s-5)"><div class="empty-title">Nenhum registro</div><div class="empty-sub">Registre a primeira ausência acima.</div></div>';
  } else {
    html += '<div class="ausencias-list">';
    for (const a of saved) {
      html += '<div class="ausencias-item">';
      html += '<div class="ausencias-item-info">';
      html += `<strong style="font-size:14px">${escapeHtml(a.colaborador)}</strong>`;
      html += `<span style="font-size:12px;color:var(--text-muted)">${escapeHtml(formatarData(a.data))} · ${escapeHtml(formatarOcorrenciaAusencia(a))}${a.motivo ? ' · ' + escapeHtml(a.motivo) : ''}</span>`;
      html += '</div>';
      html += '<div class="ausencias-item-actions">';
      html += `<button class="btn-small ausencias-del-btn" data-id="${escapeHtml(String(a.id))}" type="button" style="color:var(--danger)">Excluir</button>`;
      html += '</div></div>';
    }
    html += '</div>';
  }
  html += '</div>';

  container.innerHTML = html;
  bindAusenciasEvents(containerId, saved);
}

function bindAusenciasEvents(containerId, saved) {
  const container = document.getElementById(containerId);
  const form = container.querySelector('#ausenciaForm');
  const field = suffix => form.querySelector('#ausencia' + suffix);
  const type = field('TipoInput');
  const minutes = field('MinutosInput');
  const status = field('Status');
  type.addEventListener('change', () => {
    const delay = type.value === 'atraso';
    field('PeriodoField').hidden = delay;
    field('PeriodoInput').disabled = delay;
    field('MinutosField').hidden = !delay;
    minutes.disabled = !delay;
    minutes.required = delay;
    status.textContent = '';
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const submit = field('SalvarBtn');
    if (submit.disabled || !requireAdmin()) return;
    submit.disabled = true;
    status.textContent = 'Salvando…';
    try {
      await dbAusenciasSave({
        colaborador: field('ColabInput').value,
        data: field('DataInput').value,
        tipo: type.value,
        periodo: field('PeriodoInput').value,
        minutos_atraso: minutes.valueAsNumber,
        motivo: field('MotivoInput').value.trim()
      });
      showToast('Ocorrência registrada.', 'success', 'Ausências');
      renderAusencias(containerId);
    } catch (error) {
      status.textContent = error.message;
    } finally {
      submit.disabled = false;
    }
  });

  const refresh = container.querySelector('#ausenciaRefreshBtn');
  refresh.addEventListener('click', async () => {
    refresh.disabled = true;
    await dbAusenciasLoad();
    renderAusencias(containerId);
  });

  container.querySelectorAll('.ausencias-del-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!requireAdmin()) return;
      const a = saved.find(item => String(item.id) === btn.dataset.id);
      if (!a || !confirm('Excluir ocorrência de ' + a.colaborador + ' em ' + formatarData(a.data) + '?')) return;
      btn.disabled = true;
      try {
        await dbAusenciasDelete(a.id);
        renderAusencias(containerId);
      } catch (error) {
        showToast(error.message, 'error', 'Ausências');
        btn.disabled = false;
      }
    });
  });
}

function openAusenciasOverlay() {
  const overlay = document.getElementById('ausenciasOverlay');
  if (!overlay) return;
  const content = document.getElementById('ausenciasOverlayContent');
  if (!content) return;
  content.innerHTML = '<div class="card" style="padding:var(--s-5)"><div class="skeleton skeleton-title"></div><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line"></div></div>';
  overlay.classList.add('open');
  setTimeout(() => renderAusencias('ausenciasOverlayContent'), 50);
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('ausenciasBtn')?.addEventListener('click', openAusenciasOverlay);
  document.getElementById('ausenciasOverlayClose')?.addEventListener('click', () => {
    document.getElementById('ausenciasOverlay')?.classList.remove('open');
  });
  const overlay = document.getElementById('ausenciasOverlay');
  overlay?.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.classList.remove('open');
  });
});
