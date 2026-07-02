// ferias.js — Registro de Férias (sidebar overlay)

function formatarDataBr(d) {
  if (!d) return '';
  const [ano, mes, dia] = d.split('-');
  return `${dia}/${mes}/${ano}`;
}

function renderFerias(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const saved = JSON.parse(localStorage.getItem(FERIAS_LOCAL_KEY) || '[]');
  const colabs = [...new Set((rawRecords || [])
    .filter(r => r && r['Atendente'] && !isAggregateName(r['Atendente']) && isColabActive(r['Atendente']))
    .map(r => r['Atendente']))].sort();

  let html = '';

  html += '<div class="card" style="margin-bottom:var(--s-4)">';
  html += '<div class="card-header">';
  html += '<div><h3 style="font-size:16px;font-weight:600">Registrar Férias</h3>';
  html += '<p style="font-size:13px;color:var(--text-secondary)">Registre o período de férias de um colaborador</p></div>';
  html += '</div>';

  html += '<div class="ausencias-form">';
  html += '<div class="ausencias-field">';
  html += '<label>Colaborador</label>';
  html += `<select id="feriasColabInput" style="width:100%"><option value="">Selecione...</option>`;
  for (const c of colabs) {
    html += `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`;
  }
  html += '</select>';
  html += '</div>';

  html += '<div class="ausencias-field">';
  html += '<label>Data de início</label>';
  html += `<input type="date" id="feriasInicioInput" style="width:100%">`;
  html += '</div>';

  html += '<div class="ausencias-field">';
  html += '<label>Data de fim</label>';
  html += `<input type="date" id="feriasFimInput" style="width:100%">`;
  html += '</div>';

  html += '<div class="ausencias-actions">';
  html += '<button class="btn-primary" id="feriasSalvarBtn" type="button" style="justify-content:center">Registrar Férias</button>';
  html += '</div>';
  html += '</div>';
  html += '</div>';

  html += '<div class="card">';
  html += '<div class="card-header">';
  html += '<div><h3 style="font-size:16px;font-weight:600">Férias Registradas</h3>';
  html += `<p style="font-size:13px;color:var(--text-secondary)">${saved.length} registro(s)</p></div>`;
  if (saved.length > 0) {
    html += '<button class="btn-small" id="feriasRefreshBtn" type="button">Atualizar</button>';
  }
  html += '</div>';

  if (!saved.length) {
    html += '<div class="empty-state" style="padding:var(--s-5)"><div class="empty-title">Nenhum registro</div><div class="empty-sub">Registre as primeiras férias acima.</div></div>';
  } else {
    html += '<div class="ausencias-list">';
    for (const f of saved) {
      const inicio = new Date(f.data_inicio);
      const fim = new Date(f.data_fim);
      const dias = Math.round((fim - inicio) / (1000 * 60 * 60 * 24)) + 1;
      html += '<div class="ausencias-item">';
      html += '<div class="ausencias-item-info">';
      html += `<strong style="font-size:14px">${escapeHtml(f.colaborador)}</strong>`;
      html += `<span style="font-size:12px;color:var(--text-muted)">${formatarDataBr(f.data_inicio)} → ${formatarDataBr(f.data_fim)} · ${dias} dia(s)</span>`;
      html += '</div>';
      html += '<div class="ausencias-item-actions">';
      html += `<button class="btn-small ferias-del-btn" data-id="${f.id}" type="button" style="color:var(--danger)">Excluir</button>`;
      html += '</div></div>';
    }
    html += '</div>';
  }
  html += '</div>';

  container.innerHTML = html;
  bindFeriasEvents(containerId, saved);
}

function bindFeriasEvents(containerId, saved) {
  document.getElementById('feriasSalvarBtn')?.addEventListener('click', async () => {
    if (!requireAdmin()) return;
    const colaborador = document.getElementById('feriasColabInput').value;
    const data_inicio = document.getElementById('feriasInicioInput').value;
    const data_fim = document.getElementById('feriasFimInput').value;
    if (!colaborador || !data_inicio || !data_fim) {
      showToast('Preencha colaborador, data de início e fim.', 'error', 'Férias');
      return;
    }
    if (data_fim < data_inicio) {
      showToast('Data de fim não pode ser anterior à data de início.', 'error', 'Férias');
      return;
    }
    const item = {
      id: Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6),
      colaborador,
      data_inicio,
      data_fim
    };
    await dbFeriasSave(item);
    document.getElementById('feriasInicioInput').value = '';
    document.getElementById('feriasFimInput').value = '';
    showToast(`Férias registradas para ${colaborador}!`, 'success', 'Férias');
    renderFerias(containerId);
  });

  const container = document.getElementById(containerId);
  if (!container) return;
  container.querySelectorAll('.ferias-del-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!requireAdmin()) return;
      const f = saved.find(x => x.id === btn.dataset.id);
      if (!f || !confirm(`Excluir férias de ${f.colaborador} (${formatarDataBr(f.data_inicio)} → ${formatarDataBr(f.data_fim)})?`)) return;
      await dbFeriasDelete(f.id);
      renderFerias(containerId);
    });
  });
}

function openFeriasOverlay() {
  const overlay = document.getElementById('feriasOverlay');
  if (!overlay) return;
  const content = document.getElementById('feriasOverlayContent');
  if (!content) return;
  content.innerHTML = '<div class="card" style="padding:var(--s-5)"><div class="skeleton skeleton-title"></div><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line"></div></div>';
  overlay.classList.add('open');
  setTimeout(() => renderFerias('feriasOverlayContent'), 50);
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('feriasBtn')?.addEventListener('click', openFeriasOverlay);
  document.getElementById('feriasOverlayClose')?.addEventListener('click', () => {
    document.getElementById('feriasOverlay')?.classList.remove('open');
  });
  const overlay = document.getElementById('feriasOverlay');
  overlay?.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.classList.remove('open');
  });
});
