// acompanhamento-diario.js — Acompanhamento Diário de Atendimentos (sidebar overlay)

function getNivelColaborador(nome) {
  const colabInfo = JSON.parse(localStorage.getItem(COLAB_INFO_LOCAL_KEY) || '{}');
  return colabInfo[nome]?.nivel || '';
}

function renderAcompDiario(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const saved = JSON.parse(localStorage.getItem(ACOMP_DIARIO_LOCAL_KEY) || '[]');
  const colabInfo = JSON.parse(localStorage.getItem(COLAB_INFO_LOCAL_KEY) || '{}');

  const colabs = [...new Set((rawRecords || [])
    .filter(r => r && r['Atendente'] && !isAggregateName(r['Atendente']) && isColabActive(r['Atendente']))
    .map(r => r['Atendente']))].sort();

  const setores = [...new Set((rawRecords || [])
    .filter(r => r && r['Setor'])
    .map(r => String(r['Setor']).trim()))].sort();

  // Rankings
  const rankingFinalizacoes = [...saved]
    .filter(r => r.finalizados > 0)
    .sort((a, b) => b.finalizados - a.finalizados);
  const rankingAssumidos = [...saved]
    .filter(r => r.assumidos > 0)
    .sort((a, b) => b.assumidos - a.assumidos);

  const totalFinalizacoes = saved.reduce((s, r) => s + (r.finalizados || 0), 0);
  const totalAssumidos = saved.reduce((s, r) => s + (r.assumidos || 0), 0);

  let html = '';

  // ── Formulário ──
  html += '<div class="card" style="margin-bottom:var(--s-4)">';
  html += '<div class="card-header">';
  html += '<div><h3 style="font-size:16px;font-weight:600">Registrar Acompanhamento</h3>';
  html += '<p style="font-size:13px;color:var(--text-secondary)">Registre os atendimentos do dia por colaborador</p></div>';
  html += '</div>';

  html += '<div class="ausencias-form">';
  html += '<div class="ausencias-field">';
  html += '<label>Colaborador</label>';
  html += `<select id="acdColabInput" style="width:100%"><option value="">Selecione...</option>`;
  for (const c of colabs) {
    const nivel = colabInfo[c]?.nivel || '';
    html += `<option value="${escapeHtml(c)}">${escapeHtml(c)}${nivel ? ' (' + escapeHtml(nivel) + ')' : ''}</option>`;
  }
  html += '</select>';
  html += '</div>';

  html += '<div class="ausencias-field">';
  html += '<label>Data</label>';
  html += `<input type="date" id="acdDataInput" value="${new Date().toISOString().slice(0, 10)}" style="width:100%">`;
  html += '</div>';

  html += '<div class="ausencias-field">';
  html += '<label>Setor</label>';
  html += `<select id="acdSetorInput" style="width:100%"><option value="">Selecione...</option>`;
  for (const s of setores) {
    html += `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`;
  }
  html += '</select>';
  html += '</div>';

  html += '<div class="ausencias-field">';
  html += '<label>Atendimentos Assumidos</label>';
  html += '<input type="number" id="acdAssumidosInput" min="0" value="0" style="width:100%">';
  html += '</div>';

  html += '<div class="ausencias-field">';
  html += '<label>Atendimentos Transferidos</label>';
  html += '<input type="number" id="acdTransferidosInput" min="0" value="0" style="width:100%">';
  html += '</div>';

  html += '<div class="ausencias-field">';
  html += '<label>Atendimentos Finalizados</label>';
  html += '<input type="number" id="acdFinalizadosInput" min="0" value="0" style="width:100%">';
  html += '</div>';

  html += '<div class="ausencias-field">';
  html += '<label>Nota do dia (0 a 10)</label>';
  html += '<input type="number" id="acdNotaInput" min="0" max="10" step="0.5" value="0" style="width:100%">';
  html += '</div>';

  html += '<div class="ausencias-actions">';
  html += '<button class="btn-primary" id="acdSalvarBtn" type="button" style="justify-content:center">Registrar</button>';
  html += '</div>';
  html += '</div>';
  html += '</div>';

  // ── Rankings ──
  if (saved.length > 0) {
    html += '<div class="card" style="margin-bottom:var(--s-4)">';
    html += '<div class="card-header">';
    html += '<div><h3 style="font-size:16px;font-weight:600">🏆 Rankings</h3>';
    html += `<p style="font-size:13px;color:var(--text-secondary)">${saved.length} registro(s) · ${totalFinalizacoes} finalizados · ${totalAssumidos} assumidos</p></div>`;
    html += '</div>';

    // Finalizações
    html += '<div style="padding:var(--s-3) var(--s-4) 0">';
    html += '<h4 style="font-size:13px;font-weight:600;margin:0 0 var(--s-2) 0;color:var(--accent)">🥇 Finalizações</h4>';
    const topFin = rankingFinalizacoes.slice(0, 10);
    html += '<div style="display:grid;gap:var(--s-1)">';
    for (let i = 0; i < topFin.length; i++) {
      const r = topFin[i];
      const nivel = colabInfo[r.colaborador]?.nivel || '';
      html += '<div style="display:flex;align-items:center;gap:var(--s-2);padding:var(--s-1) var(--s-2);border-radius:var(--r-sm);background:var(--bg-surface)">';
      html += `<span style="font-size:12px;font-weight:700;color:var(--text-muted);min-width:20px">${i + 1}º</span>`;
      html += `<span style="font-size:13px;flex:1">${escapeHtml(r.colaborador)}${nivel ? ' <span style="font-size:11px;color:var(--text-muted)">(' + escapeHtml(nivel) + ')</span>' : ''}</span>`;
      html += `<span style="font-size:13px;font-weight:700;color:var(--success)">${r.finalizados}</span>`;
      html += '</div>';
    }
    html += '</div></div>';

    // Assumidos
    html += '<div style="padding:var(--s-3) var(--s-4) var(--s-4)">';
    html += '<h4 style="font-size:13px;font-weight:600;margin:var(--s-3) 0 var(--s-2) 0;color:var(--accent)">📞 Atendimentos Assumidos</h4>';
    const topAss = rankingAssumidos.slice(0, 10);
    html += '<div style="display:grid;gap:var(--s-1)">';
    for (let i = 0; i < topAss.length; i++) {
      const r = topAss[i];
      const nivel = colabInfo[r.colaborador]?.nivel || '';
      html += '<div style="display:flex;align-items:center;gap:var(--s-2);padding:var(--s-1) var(--s-2);border-radius:var(--r-sm);background:var(--bg-surface)">';
      html += `<span style="font-size:12px;font-weight:700;color:var(--text-muted);min-width:20px">${i + 1}º</span>`;
      html += `<span style="font-size:13px;flex:1">${escapeHtml(r.colaborador)}${nivel ? ' <span style="font-size:11px;color:var(--text-muted)">(' + escapeHtml(nivel) + ')</span>' : ''}</span>`;
      html += `<span style="font-size:13px;font-weight:700;color:var(--success)">${r.assumidos}</span>`;
      html += '</div>';
    }
    html += '</div></div>';

    html += '</div>';
  }

  // ── Lista de Registros ──
  html += '<div class="card">';
  html += '<div class="card-header">';
  html += '<div><h3 style="font-size:16px;font-weight:600">Registros</h3>';
  html += `<p style="font-size:13px;color:var(--text-secondary)">${saved.length} registro(s)</p></div>`;
  html += '<div style="display:flex;gap:var(--s-2)">';
  if (saved.length > 0) {
    html += '<button class="btn-small" id="acdExportBtn" type="button">Exportar CSV</button>';
    html += '<button class="btn-small" id="acdRefreshBtn" type="button">Atualizar</button>';
  }
  html += '</div>';
  html += '</div>';

  if (!saved.length) {
    html += '<div class="empty-state" style="padding:var(--s-5)"><div class="empty-title">Nenhum registro</div><div class="empty-sub">Registre o primeiro acompanhamento acima.</div></div>';
  } else {
    html += '<div class="ausencias-list">';
    for (const r of saved) {
      const nivel = colabInfo[r.colaborador]?.nivel || '';
      html += '<div class="ausencias-item" style="align-items:flex-start">';
      html += '<div class="ausencias-item-info">';
      html += `<strong style="font-size:14px">${escapeHtml(r.colaborador)}${nivel ? ' <span style="font-size:11px;font-weight:400;color:var(--text-muted)">(' + escapeHtml(nivel) + ')</span>' : ''}</strong>`;
      html += `<span style="font-size:12px;color:var(--text-muted)">${r.data}${r.setor ? ' · ' + escapeHtml(r.setor) : ''} · Assumidos: ${r.assumidos} · Transferidos: ${r.transferidos} · Finalizados: ${r.finalizados}${r.nota > 0 ? ' · Nota: ' + r.nota : ''}</span>`;
      html += '</div>';
      html += '<div class="ausencias-item-actions">';
      html += `<button class="btn-small acd-del-btn" data-id="${r.id}" type="button" style="color:var(--danger)">Excluir</button>`;
      html += '</div></div>';
    }
    html += '</div>';
  }
  html += '</div>';

  container.innerHTML = html;
  bindAcompDiarioEvents(containerId, saved);
}

function exportAcompDiarioCSV(saved) {
  const linhas = [['Colaborador', 'Data', 'Setor', 'Assumidos', 'Transferidos', 'Finalizados', 'Nota']];
  for (const r of saved) {
    linhas.push([r.colaborador, r.data, r.setor, String(r.assumidos), String(r.transferidos), String(r.finalizados), String(r.nota)]);
  }
  const csv = linhas.map(l => l.map(c => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `acompanhamento_diario_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function bindAcompDiarioEvents(containerId, saved) {
  document.getElementById('acdSalvarBtn')?.addEventListener('click', async () => {
    if (!requireAdmin()) return;
    const colaborador = document.getElementById('acdColabInput').value;
    const data = document.getElementById('acdDataInput').value;
    const setor = document.getElementById('acdSetorInput').value;
    const assumidos = parseInt(document.getElementById('acdAssumidosInput').value) || 0;
    const transferidos = parseInt(document.getElementById('acdTransferidosInput').value) || 0;
    const finalizados = parseInt(document.getElementById('acdFinalizadosInput').value) || 0;
    const nota = parseFloat(document.getElementById('acdNotaInput').value) || 0;
    if (!colaborador || !data) {
      showToast('Selecione o colaborador e a data.', 'error', 'Acompanhamento');
      return;
    }
    const item = {
      id: Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6),
      colaborador,
      data,
      setor,
      assumidos,
      transferidos,
      finalizados,
      nota
    };
    await dbAcompDiarioSave(item);
    document.getElementById('acdAssumidosInput').value = '0';
    document.getElementById('acdTransferidosInput').value = '0';
    document.getElementById('acdFinalizadosInput').value = '0';
    document.getElementById('acdNotaInput').value = '0';
    showToast(`Registro salvo para ${colaborador}!`, 'success', 'Acompanhamento');
    renderAcompDiario(containerId);
  });

  document.getElementById('acdExportBtn')?.addEventListener('click', () => {
    exportAcompDiarioCSV(saved);
  });

  const container = document.getElementById(containerId);
  if (!container) return;
  container.querySelectorAll('.acd-del-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!requireAdmin()) return;
      const r = saved.find(x => x.id === btn.dataset.id);
      if (!r || !confirm(`Excluir registro de ${r.colaborador} em ${r.data}?`)) return;
      await dbAcompDiarioDelete(r.id);
      renderAcompDiario(containerId);
    });
  });
}

function openAcompDiarioOverlay() {
  const overlay = document.getElementById('acompDiarioOverlay');
  if (!overlay) return;
  const content = document.getElementById('acompDiarioOverlayContent');
  if (!content) return;
  content.innerHTML = '<div class="card" style="padding:var(--s-5)"><div class="skeleton skeleton-title"></div><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line"></div></div>';
  overlay.classList.add('open');
  setTimeout(() => renderAcompDiario('acompDiarioOverlayContent'), 50);
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('acompDiarioBtn')?.addEventListener('click', openAcompDiarioOverlay);
  document.getElementById('acompDiarioOverlayClose')?.addEventListener('click', () => {
    document.getElementById('acompDiarioOverlay')?.classList.remove('open');
  });
  const overlay = document.getElementById('acompDiarioOverlay');
  overlay?.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.classList.remove('open');
  });
});
