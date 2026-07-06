// ferias.js — Registro de Férias (sidebar overlay)

function formatarDataBr(d) {
  if (!d) return '';
  const [ano, mes, dia] = d.split('-');
  return `${dia}/${mes}/${ano}`;
}

function temFeriasSobrepostas(colaborador, inicio, fim, ignoreId) {
  const saved = JSON.parse(localStorage.getItem(FERIAS_LOCAL_KEY) || '[]');
  return saved.some(f => {
    if (ignoreId && String(f.id) === String(ignoreId)) return false;
    if (f.colaborador !== colaborador) return false;
    return inicio <= f.data_fim && fim >= f.data_inicio;
  });
}

function feriasConfirmModal(colaborador, inicio, fim) {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'mt-modal-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.5);backdrop-filter:blur(4px);z-index:200;display:none;align-items:center;justify-content:center;padding:20px';
    overlay.innerHTML = `
      <div style="width:100%;max-width:400px;background:var(--bg-surface,#fff);border:1px solid var(--border,#e2e8f0);border-radius:var(--r-xl,12px);box-shadow:var(--shadow-lg,0 12px 40px rgba(0,0,0,0.12));padding:24px;position:relative">
        <h3 style="font-size:18px;font-weight:600;color:var(--text-strong);margin:0 0 12px">Excluir Férias</h3>
        <p style="color:var(--text-secondary);font-size:14px;line-height:1.5;margin:0 0 20px">Tem certeza que deseja excluir as férias de <strong>${escapeHtml(colaborador)}</strong> (${inicio} → ${fim})?</p>
        <div style="display:flex;justify-content:flex-end;gap:8px">
          <button class="btn-small" id="fCancelBtn" type="button">Cancelar</button>
          <button class="btn-primary" id="fConfirmBtn" type="button" style="background:var(--danger);border-color:var(--danger)">Excluir</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.style.display = 'flex');

    const close = (result) => { overlay.remove(); resolve(result); };
    overlay.querySelector('#fCancelBtn').onclick = () => close(false);
    overlay.querySelector('#fConfirmBtn').onclick = () => close(true);
    overlay.onclick = (e) => { if (e.target === overlay) close(false); };
  });
}

function statusFerias(data_inicio, data_fim) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const inicio = new Date(data_inicio + 'T00:00:00');
  const fim = new Date(data_fim + 'T00:00:00');
  if (hoje > fim) return { label: 'Completas', color: 'var(--text-muted)', bg: 'transparent', border: 'var(--border)' };
  if (hoje >= inicio && hoje <= fim) return { label: 'Ativa', color: '#fff', bg: '#22c55e', border: '#22c55e' };
  return { label: 'Agendada', color: '#fff', bg: '#3b82f6', border: '#3b82f6' };
}

function exportFeriasCSV(saved) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const linhas = [['Colaborador', 'Data Início', 'Data Fim', 'Dias', 'Status']];
  for (const f of saved) {
    const inicio = new Date(f.data_inicio + 'T00:00:00');
    const fim = new Date(f.data_fim + 'T00:00:00');
    const dias = Math.round((fim - inicio) / (1000 * 60 * 60 * 24)) + 1;
    const st = statusFerias(f.data_inicio, f.data_fim);
    linhas.push([f.colaborador, f.data_inicio, f.data_fim, String(dias), st.label]);
  }
  const csv = linhas.map(l => l.map(c => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ferias_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
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
  html += '<div style="display:flex;gap:var(--s-2)">';
  if (saved.length > 0) {
    html += '<button class="btn-small" id="feriasExportBtn" type="button">Exportar CSV</button>';
    html += '<button class="btn-small" id="feriasRefreshBtn" type="button">Atualizar</button>';
  }
  html += '</div>';
  html += '</div>';

  if (!saved.length) {
    html += '<div class="empty-state" style="padding:var(--s-5)"><div class="empty-title">Nenhum registro</div><div class="empty-sub">Registre as primeiras férias acima.</div></div>';
  } else {
    html += '<div class="ausencias-list">';
    for (const f of saved) {
      const inicio = new Date(f.data_inicio + 'T00:00:00');
      const fim = new Date(f.data_fim + 'T00:00:00');
      const dias = Math.round((fim - inicio) / (1000 * 60 * 60 * 24)) + 1;
      const st = statusFerias(f.data_inicio, f.data_fim);
      html += '<div class="ausencias-item">';
      html += '<div class="ausencias-item-info">';
      html += '<div style="display:flex;align-items:center;gap:var(--s-2);flex-wrap:wrap">';
      html += `<strong style="font-size:14px">${escapeHtml(f.colaborador)}</strong>`;
      html += `<span style="display:inline-block;font-size:11px;font-weight:600;padding:2px 8px;border-radius:999px;color:${st.color};background:${st.bg};border:1px solid ${st.border}">${st.label}</span>`;
      html += '</div>';
      html += `<span style="font-size:12px;color:var(--text-muted)">${formatarDataBr(f.data_inicio)} → ${formatarDataBr(f.data_fim)} · ${dias} dia(s)</span>`;
      html += '</div>';
      html += '<div class="ausencias-item-actions">';
      html += `<button class="btn-small ferias-del-btn" data-id="${escapeHtml(f.id)}" type="button" style="color:var(--danger)">Excluir</button>`;
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
    if (temFeriasSobrepostas(colaborador, data_inicio, data_fim)) {
      showToast(`${colaborador} já possui férias neste período!`, 'error', 'Férias');
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

  document.getElementById('feriasExportBtn')?.addEventListener('click', () => {
    exportFeriasCSV(saved);
  });

  const container = document.getElementById(containerId);
  if (!container) return;
  container.querySelectorAll('.ferias-del-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!requireAdmin()) return;
      const id = btn.dataset.id;
      const f = saved.find(x => String(x.id) === id);
      if (!f) return;
      const ok = await feriasConfirmModal(f.colaborador, formatarDataBr(f.data_inicio), formatarDataBr(f.data_fim));
      if (!ok) return;
      await dbFeriasDelete(id);
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
