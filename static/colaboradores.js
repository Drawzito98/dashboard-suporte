// colaboradores.js — Meus Colaboradores (cadastro com dados pessoais)

function renderColaboradores() {
  const container = document.getElementById('colaboradoresContent');
  if (!container) return;

  const colabInfo = JSON.parse(localStorage.getItem('sistema_colaboradores_info_v1') || '{}');
  const colabs = [...new Set((rawRecords || [])
    .filter(r => r && r['Atendente'] && !isAggregateName(r['Atendente']) && isColabActive(r['Atendente']))
    .map(r => r['Atendente']))].sort();

  // Mapa setor por colaborador
  const setorMap = {};
  (rawRecords || []).forEach(r => {
    if (r && r['Atendente'] && r['Setor']) {
      const nome = r['Atendente'];
      if (!setorMap[nome]) setorMap[nome] = new Set();
      setorMap[nome].add(String(r['Setor']).trim());
    }
  });

  let html = '';

  html += '<div style="margin-bottom:var(--s-4)">';
  html += '<h3 style="font-size:16px;font-weight:600;margin-bottom:2px">👥 Meus Colaboradores</h3>';
  html += `<p style="font-size:13px;color:var(--text-secondary)">${colabs.length} colaborador(es) ativos · ${Object.keys(colabInfo).length} com cadastro</p>`;
  html += '</div>';

  if (!colabs.length) {
    html += '<div class="empty-state" style="padding:var(--s-5)"><div class="empty-title">Nenhum colaborador</div><div class="empty-sub">Importe um CSV com dados para ver a lista.</div></div>';
    container.innerHTML = html;
    return;
  }

  html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:var(--s-3)">';
  for (const nome of colabs) {
    const info = colabInfo[nome] || {};
    const hasData = info.data_aniversario || info.data_admissao || info.email || info.observacoes;
    const conduta = info.conduta_negativa === 'true' || info.conduta_negativa === true;
    html += `<div class="card colab-card ${conduta ? 'colab-card-conduta' : ''}" data-nome="${escapeHtml(nome)}" style="cursor:pointer;padding:var(--s-4);transition:box-shadow .15s" title="Clique para ver/editar">`;
    html += '<div style="display:flex;align-items:center;gap:var(--s-3)">';
    html += `<div style="font-size:28px">${typeof colabAvatarHtml === 'function' ? colabAvatarHtml(nome, 36) : '👤'}</div>`;
    html += '<div style="flex:1;min-width:0">';
    html += `<div style="font-weight:600;font-size:14px;display:flex;align-items:center;gap:var(--s-2)">${escapeHtml(nome)}${conduta ? '<span class="conduta-badge" title="Conduta negativa">🚩</span>' : ''}</div>`;
    const setores = setorMap[nome];
    if (setores && setores.size) {
      html += `<div style="font-size:12px;color:var(--text-muted);margin-top:1px">🏢 ${escapeHtml([...setores].join(', '))}</div>`;
    }
    if (info.data_aniversario) {
      const [a,m,d] = info.data_aniversario.split('-');
      html += `<div style="font-size:12px;color:var(--text-secondary);margin-top:2px">🎂 ${d}/${m}</div>`;
    }
    if (info.data_admissao) {
      const [a,m,d] = info.data_admissao.split('-');
      html += `<div style="font-size:12px;color:var(--text-secondary)">📅 Admissão: ${d}/${m}/${a}</div>`;
    }
    if (info.email) {
      html += `<div style="font-size:12px;color:var(--text-secondary)">✉️ ${escapeHtml(info.email)}</div>`;
    }
    if (info.observacoes) {
      html += `<div style="font-size:12px;color:var(--danger);margin-top:2px;padding:2px 6px;background:color-mix(in srgb, var(--danger) 10%, transparent);border-radius:var(--r-sm)">📝 ${escapeHtml(info.observacoes)}</div>`;
    }
    if (!hasData) {
      html += `<div style="font-size:12px;color:var(--text-muted);margin-top:2px">Clique para cadastrar</div>`;
    }
    html += '</div>';
    html += `<div style="font-size:18px;color:var(--text-muted)">${hasData ? '✅' : '➕'}</div>`;
    html += '</div></div>';
  }
  html += '</div>';

  container.innerHTML = html;

  // Click to open overlay
  container.querySelectorAll('.colab-card').forEach(card => {
    card.addEventListener('click', () => {
      const nome = card.dataset.nome;
      openColabDetailOverlay(nome);
    });
  });
}

function openColabReport(nome) {
  const overlay = document.getElementById('colabReportOverlay');
  const content = document.getElementById('colabReportContent');
  if (!overlay || !content) return;

  // Get filtered data from current filters
  const filteredData = typeof globalFilters !== 'undefined' && globalFilters ? globalFilters.aplicar(rawRecords || []) : (rawRecords || []);
  const colabRows = filteredData.filter(r => r && String(r['Atendente']) === nome);
  const allRows = filteredData.filter(r => r && r['Atendente'] && !isAggregateName(r['Atendente']) && isColabActive(r['Atendente']));

  // Get period description
  const meses = [...new Set(colabRows.filter(r => r && r['Mês']).map(r => r['Mês']))].sort();
  const periodLabel = meses.length ? meses.join(', ') : 'Todo período';

  // Compute metrics
  const fin = colabRows.reduce((s, r) => s + (parseInt(r['Finalizados']) || 0), 0);
  const ass = colabRows.reduce((s, r) => s + (parseInt(r['Assumidos']) || 0), 0);
  const trans = colabRows.reduce((s, r) => s + (parseInt(r['Transferidos']) || 0), 0);
  const scores = colabRows.map(r => r['SCORE']).filter(v => v !== null && v !== undefined && v !== '');
  const scoreAvg = scores.length ? scores.reduce((a, b) => a + Number(b), 0) / scores.length : null;
  const metaOk = colabRows.filter(r => { const o = parseInt(r['Objetivo']) || 0; const f = parseInt(r['Finalizados']) || 0; return o > 0 && f >= o; }).length;

  // Team averages
  const teamFin = allRows.length ? allRows.reduce((s, r) => s + (parseInt(r['Finalizados']) || 0), 0) / allRows.length : 0;
  const teamScore = allRows.length ? allRows.map(r => r['SCORE']).filter(v => v !== null && v !== undefined && v !== '').reduce((a, b) => a + Number(b), 0) / allRows.filter(r => r['SCORE'] !== null && r['SCORE'] !== undefined && r['SCORE'] !== '').length : 0;
  const teamTrans = allRows.length ? allRows.reduce((s, r) => s + (parseInt(r['Transferidos']) || 0), 0) / allRows.length : 0;

  // Previous period comparison (if filtering by a single month)
  let prevFin = null, prevScore = null;
  if (meses.length === 1) {
    const allMeses = [...new Set((rawRecords || []).filter(r => r && r['Mês']).map(r => r['Mês']))].sort();
    const idx = allMeses.indexOf(meses[0]);
    if (idx > 0) {
      const prevMes = allMeses[idx - 1];
      const prevRows = (rawRecords || []).filter(r => r && String(r['Atendente']) === nome && String(r['Mês']) === prevMes);
      prevFin = prevRows.reduce((s, r) => s + (parseInt(r['Finalizados']) || 0), 0);
      const prevScores = prevRows.map(r => r['SCORE']).filter(v => v !== null && v !== undefined && v !== '');
      prevScore = prevScores.length ? prevScores.reduce((a, b) => a + Number(b), 0) / prevScores.length : null;
    }
  }

  // Gamification score
  let totalScore = null, breakdown = null;
  if (typeof computeScoreForCollaborator === 'function') {
    const sc = computeScoreForCollaborator(nome, colabRows);
    totalScore = sc.total;
    breakdown = sc.breakdown;
  }

  // Helpers
  const fmtPct = (v) => v !== null && v !== undefined && v !== 0 ? (v > 0 ? '+' : '') + v.toFixed(1) + '%' : '';
  const fmtNum = (v) => v !== null && v !== undefined ? Number(v).toFixed(2).replace('.', ',') : '—';
  const fmtInt = (v) => v !== null && v !== undefined ? Math.round(v) : '—';

  // Build report
  let html = '';
  html += '<div class="report-header">';
  html += `<div style="display:flex;align-items:center;gap:var(--s-3)"><div style="font-size:40px">${typeof colabAvatarHtml === 'function' ? colabAvatarHtml(nome, 48) : '👤'}</div><div><h2 style="font-size:22px;font-weight:700;margin:0">${escapeHtml(nome)}</h2><p style="font-size:14px;color:var(--text-secondary);margin:2px 0 0">📅 ${escapeHtml(periodLabel)}</p></div></div>`;
  html += '</div>';

  // ── Metric cards ──
  html += '<div class="report-metrics">';
  const finVar = prevFin !== null ? computeVariation(fin, prevFin) : null;
  const scVar = prevScore !== null && scoreAvg !== null ? computeVariation(scoreAvg, prevScore) : null;
  const metrics = [
    { label: 'Finalizados', value: fmtInt(fin), var: finVar, good: finVar === null || finVar >= 0, team: fmtInt(teamFin) },
    { label: 'Score', value: scoreAvg !== null ? scoreAvg.toFixed(2).replace('.', ',') : '—', var: scVar, good: scoreAvg !== null && scoreAvg >= 4.5, team: teamScore ? teamScore.toFixed(2).replace('.', ',') : '—' },
    { label: 'Assumidos', value: fmtInt(ass), var: null, good: true, team: fmtInt(allRows.length ? allRows.reduce((s, r) => s + (parseInt(r['Assumidos']) || 0), 0) / allRows.length : 0) },
    { label: 'Transferidos', value: fmtInt(trans), var: null, good: trans <= teamTrans * 1.5, team: fmtInt(teamTrans) }
  ];
  for (const m of metrics) {
    const borderColor = m.good ? 'var(--success)' : 'var(--danger)';
    html += `<div class="report-metric-card" style="border-top:3px solid ${borderColor}">`;
    html += `<div class="report-metric-value" style="color:${m.good ? 'var(--success)' : 'var(--danger)'}">${m.value}</div>`;
    html += `<div class="report-metric-label">${m.label}</div>`;
    if (m.var !== null) {
      const varColor = m.var >= 0 ? 'var(--success)' : 'var(--danger)';
      html += `<div class="report-metric-var" style="color:${varColor}">${m.var >= 0 ? '▲' : '▼'} ${Math.abs(m.var).toFixed(1)}%</div>`;
    }
    html += '</div>';
  }

  // Gamification score card
  if (totalScore !== null) {
    html += `<div class="report-metric-card" style="border-top:3px solid var(--accent);background:linear-gradient(135deg,var(--bg-subtle),var(--bg-surface))">`;
    html += `<div class="report-metric-value" style="color:var(--accent);font-size:28px">${totalScore}</div>`;
    html += `<div class="report-metric-label">Pontuação total</div>`;
    html += '</div>';
  }
  html += '</div>';

  // ── Highlights & Lowlights ──
  const highlights = [];
  const lowlights = [];

  if (scoreAvg !== null && scoreAvg >= 4.5) highlights.push(`Score alto (${scoreAvg.toFixed(2).replace('.',',')}) — acima da meta de 4,5 ⭐`);
  else if (scoreAvg !== null) lowlights.push(`Score (${scoreAvg.toFixed(2).replace('.',',')}) — abaixo da meta de 4,5 ⚠️`);

  if (fin > teamFin) highlights.push(`Finalizações acima da média do time (${fmtInt(fin)} vs ${fmtInt(teamFin)}) 📈`);
  else if (fin < teamFin && fin > 0) lowlights.push(`Finalizações abaixo da média do time (${fmtInt(fin)} vs ${fmtInt(teamFin)}) 📉`);

  if (metaOk > 0) highlights.push(`Meta atingida em ${metaOk} mês(es) 🎯`);
  else { const hasMeta = colabRows.some(r => parseInt(r['Objetivo']) > 0); if (hasMeta) lowlights.push(`Meta não atingida 🎯`); }

  if (trans > teamTrans * 1.5) lowlights.push(`Transferências acima do ideal (${fmtInt(trans)} vs ${fmtInt(teamTrans)} média) 🔄`);

  if (finVar !== null && finVar > 5) highlights.push(`Finalizações cresceram ${finVar.toFixed(0)}% em relação ao mês anterior 📈`);
  else if (finVar !== null && finVar < -5) lowlights.push(`Finalizações caíram ${Math.abs(finVar).toFixed(0)}% em relação ao mês anterior 📉`);

  if (scVar !== null && scVar > 0) highlights.push(`Score melhorou em relação ao mês anterior 📈`);
  else if (scVar !== null && scVar < 0) lowlights.push(`Score caiu em relação ao mês anterior 📉`);

  html += '<div class="report-section"><h3 class="report-section-title">✅ Destaques</h3>';
  if (highlights.length) {
    html += '<div class="report-list">';
    for (const h of highlights) html += `<div class="report-item report-item-good">${h}</div>`;
    html += '</div>';
  } else {
    html += '<div style="font-size:13px;color:var(--text-muted);padding:var(--s-2) 0">Nenhum destaque neste período.</div>';
  }
  html += '</div>';

  html += '<div class="report-section"><h3 class="report-section-title">⚠️ Pontos de Atenção</h3>';
  if (lowlights.length) {
    html += '<div class="report-list">';
    for (const l of lowlights) html += `<div class="report-item report-item-bad">${l}</div>`;
    html += '</div>';
  } else {
    html += '<div style="font-size:13px;color:var(--text-muted);padding:var(--s-2) 0">Nenhum ponto de atenção neste período. 🎉</div>';
  }
  html += '</div>';

  // ── Detailed table ──
  html += '<div class="report-section"><h3 class="report-section-title">📋 Métricas Detalhadas</h3>';
  html += '<div class="report-grid">';
  const detRows = [
    { label: 'Finalizados', value: fmtInt(fin), team: fmtInt(teamFin), var: finVar },
    { label: 'Score médio', value: scoreAvg !== null ? scoreAvg.toFixed(2).replace('.',',') : '—', team: teamScore ? teamScore.toFixed(2).replace('.',',') : '—', var: scVar },
    { label: 'Assumidos', value: fmtInt(ass), team: fmtInt(allRows.length ? allRows.reduce((s, r) => s + (parseInt(r['Assumidos']) || 0), 0) / allRows.length : 0), var: null },
    { label: 'Transferidos', value: fmtInt(trans), team: fmtInt(teamTrans), var: null },
  ];
  for (const d of detRows) {
    html += '<div class="report-grid-row">';
    html += `<span class="report-grid-label">${d.label}</span>`;
    html += `<span class="report-grid-value">${d.value}</span>`;
    html += `<span class="report-grid-team">média: ${d.team}</span>`;
    if (d.var !== null) {
      const vc = d.var >= 0 ? 'var(--success)' : 'var(--danger)';
      html += `<span class="report-grid-var" style="color:${vc}">${d.var >= 0 ? '▲' : '▼'} ${Math.abs(d.var).toFixed(1)}%</span>`;
    } else {
      html += '<span class="report-grid-var"></span>';
    }
    html += '</div>';
  }
  html += '</div></div>';

  // ── Bonus/Penalties summary ──
  const allBonus = JSON.parse(localStorage.getItem('sistema_pontos_extras_v1') || '[]');
  const colabBonus = allBonus.filter(b => String(b.colaborador) === nome);
  if (colabBonus.length) {
    const totalPts = colabBonus.reduce((s, b) => s + (parseFloat(b.pontos) || 0), 0);
    html += '<div class="report-section"><h3 class="report-section-title">💰 Bônus & Penalidades</h3>';
    html += `<div style="font-size:13px;color:var(--text-secondary)">Total: <strong style="color:${totalPts >= 0 ? 'var(--success)' : 'var(--danger)'}">${totalPts > 0 ? '+' : ''}${totalPts.toFixed(1)}</strong> pts</div>`;
    html += '</div>';
  }

  content.innerHTML = html;
  overlay.classList.add('open');
}

function openColabDetailOverlay(nome) {
  const overlay = document.getElementById('colabDetailOverlay');
  const content = document.getElementById('colabDetailContent');
  if (!overlay || !content) return;

  const colabInfo = JSON.parse(localStorage.getItem('sistema_colaboradores_info_v1') || '{}');
  const info = colabInfo[nome] || {};

  let html = '';
  const setores = [...new Set((rawRecords || []).filter(r => r && r['Atendente'] === nome && r['Setor']).map(r => String(r['Setor']).trim()))];
  html += `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--s-4)">`;
  html += `<div style="display:flex;align-items:center;gap:var(--s-3)"><div style="font-size:32px">${typeof colabAvatarHtml === 'function' ? colabAvatarHtml(nome, 40) : '👤'}</div><div><h3 style="font-size:18px;font-weight:600;margin:0">${escapeHtml(nome)}</h3><p style="font-size:13px;color:var(--text-secondary);margin:0">${setores.length ? '🏢 '+escapeHtml(setores.join(', ')) : 'Informações do colaborador'}</p></div></div>`;
  html += '</div>';

  html += '<form id="colabInfoForm" style="display:grid;grid-template-columns:1fr 1fr;gap:var(--s-3)">';

  html += '<div class="field"><span>Data de Aniversário</span>';
  html += `<input type="date" id="ciAniversario" value="${info.data_aniversario || ''}">`;
  html += '</div>';

  html += '<div class="field"><span>Data de Admissão</span>';
  html += `<input type="date" id="ciAdmissao" value="${info.data_admissao || ''}">`;
  html += '</div>';

  html += '<div class="field" style="grid-column:1/-1"><span>Email</span>';
  html += `<input type="email" id="ciEmail" placeholder="email@exemplo.com" value="${escapeHtml(info.email || '')}">`;
  html += '</div>';

  html += `<div class="field" style="grid-column:1/-1"><span>Tarefas que já desempenhou</span>`;
  html += `<textarea id="ciTarefas" style="width:100%;min-height:70px;font-size:13px;line-height:1.6" placeholder="Ex: Atendimento N1, Suporte Chat, Projeto Migração...">${escapeHtml(info.tarefas_desempenhadas || '')}</textarea>`;
  html += '</div>';

  html += `<div class="field" style="grid-column:1/-1"><span>Objetivos Futuros</span>`;
  html += `<textarea id="ciObjetivos" style="width:100%;min-height:70px;font-size:13px;line-height:1.6" placeholder="Ex: Assumir liderança, aprender ferramenta X...">${escapeHtml(info.objetivos_futuros || '')}</textarea>`;
  html += '</div>';

  const condutaChecked = info.conduta_negativa === 'true' || info.conduta_negativa === true;

  html += `<div class="field" style="grid-column:1/-1;display:flex;align-items:center;gap:var(--s-3);padding:var(--s-3);border:1px solid ${condutaChecked ? 'var(--danger)' : 'var(--border)'};border-radius:var(--r-md)">
    <span style="font-size:18px">🚩</span>
    <div style="flex:1">
      <div style="font-size:13px;font-weight:600;color:var(--text-strong)">Destacar por conduta negativa</div>
      <div style="font-size:11px;color:var(--text-muted)">Ex: desrespeito, faltas, reclamações recorrentes</div>
    </div>
    <label style="position:relative;display:inline-block;width:44px;height:24px;flex-shrink:0">
      <input type="checkbox" id="ciCondutaToggle" ${condutaChecked ? 'checked' : ''} style="opacity:0;width:0;height:0">
      <span style="position:absolute;cursor:pointer;inset:0;background:${condutaChecked ? 'var(--danger)' : 'var(--border)'};border-radius:12px;transition:.2s"></span>
      <span style="position:absolute;content:'';height:18px;width:18px;left:3px;bottom:3px;background:var(--bg-surface);border-radius:50%;transition:.2s;transform:${condutaChecked ? 'translateX(20px)' : 'translateX(0)'}"></span>
    </label>
  </div>`;

  html += `<div class="field" style="grid-column:1/-1" id="ciCondutaMotivoField" ${condutaChecked ? '' : 'hidden'}>
    <span>Motivo da conduta</span>
    <textarea id="ciCondutaMotivo" style="width:100%;min-height:60px;font-size:13px;line-height:1.6;border-color:var(--danger)" placeholder="Descreva o motivo do destaque...">${escapeHtml(info.conduta_motivo || '')}</textarea>
  </div>`;

  html += `<div class="field" style="grid-column:1/-1"><span>Observações</span>`;
  html += `<textarea id="ciObservacoes" style="width:100%;min-height:70px;font-size:13px;line-height:1.6" placeholder="Qualquer observação adicional...">${escapeHtml(info.observacoes || '')}</textarea>`;
  html += '</div>';

  html += '<div style="grid-column:1/-1;display:flex;gap:var(--s-2);padding-top:var(--s-2)">';
  html += `<button class="btn-primary" id="ciSalvarBtn" type="button" style="flex:1">💾 Salvar</button>`;
  html += `<button class="btn-small" id="ciLimparBtn" type="button">🗑️ Limpar dados</button>`;
  html += '</div>';

  html += '</form>';

  // ── Histórico de penalidades ──
  const allBonus = JSON.parse(localStorage.getItem('sistema_pontos_extras_v1') || '[]');
  const penalties = allBonus.filter(b => String(b.colaborador) === nome && (parseFloat(b.pontos) || 0) < 0);
  if (penalties.length) {
    html += '<div style="grid-column:1/-1;margin-top:var(--s-4)">';
    html += '<h4 style="font-size:14px;font-weight:600;margin:0 0 var(--s-3) 0">📋 Histórico de penalidades</h4>';
    html += '<div style="display:flex;flex-direction:column;gap:var(--s-2)">';
    for (const p of penalties) {
      const pts = Math.abs(parseFloat(p.pontos) || 0);
      html += '<div style="display:flex;align-items:flex-start;gap:var(--s-3);padding:var(--s-2) var(--s-3);border:1px solid var(--border);border-radius:var(--r-sm)">';
      html += `<div style="font-size:16px;font-weight:700;color:var(--danger);min-width:48px;text-align:center">-${pts.toFixed(1)}</div>`;
      html += '<div style="flex:1;min-width:0">';
      if (p.descricao) {
        html += `<div style="font-size:13px">${escapeHtml(p.descricao)}</div>`;
      }
      html += '<div style="font-size:11px;color:var(--text-muted);margin-top:1px">';
      const parts = [];
      if (p.mes) parts.push(`📅 ${escapeHtml(p.mes)}`);
      if (p.createdAt) parts.push(new Date(p.createdAt).toLocaleString('pt-BR'));
      html += parts.join(' · ');
      html += '</div></div></div>';
    }
    html += '</div></div>';
  }

  content.innerHTML = html;
  overlay.classList.add('open');

  document.getElementById('ciSalvarBtn').addEventListener('click', async () => {
    if (!requireAdmin()) return;
    const data = {
      data_aniversario: document.getElementById('ciAniversario').value || '',
      data_admissao: document.getElementById('ciAdmissao').value || '',
      email: document.getElementById('ciEmail').value.trim(),
      tarefas_desempenhadas: document.getElementById('ciTarefas').value.trim(),
      objetivos_futuros: document.getElementById('ciObjetivos').value.trim(),
      observacoes: document.getElementById('ciObservacoes').value.trim(),
      conduta_negativa: document.getElementById('ciCondutaToggle').checked ? 'true' : '',
      conduta_motivo: document.getElementById('ciCondutaMotivo').value.trim()
    };
    await dbColabInfoSave(nome, data);
    showToast(`Dados de ${nome} salvos!`, 'success', 'Colaboradores');
    overlay.classList.remove('open');
    if (typeof renderColaboradores === 'function') renderColaboradores();
  });

  document.getElementById('ciCondutaToggle').addEventListener('change', () => {
    const field = document.getElementById('ciCondutaMotivoField');
    if (field) field.hidden = !document.getElementById('ciCondutaToggle').checked;
  });

  document.getElementById('ciLimparBtn').addEventListener('click', async () => {
    if (!requireAdmin()) return;
    if (!confirm(`Limpar todos os dados cadastrais de ${nome}?`)) return;
    const data = {
      data_aniversario: '', data_admissao: '', email: '',
      tarefas_desempenhadas: '', objetivos_futuros: '', observacoes: '',
      conduta_negativa: '', conduta_motivo: ''
    };
    await dbColabInfoSave(nome, data);
    showToast(`Dados de ${nome} removidos!`, 'success', 'Colaboradores');
    overlay.classList.remove('open');
    if (typeof renderColaboradores === 'function') renderColaboradores();
  });
}

// Report overlay close button
document.getElementById('colabReportClose')?.addEventListener('click', () => {
  document.getElementById('colabReportOverlay')?.classList.remove('open');
});

function onColaboradoresTabActivated() {
  const container = document.getElementById('colaboradoresContent');
  if (!container) return;
  container.innerHTML = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:var(--s-3);padding:var(--s-4)"><div class="card" style="padding:var(--s-5)"><div class="skeleton skeleton-title"></div><div class="skeleton skeleton-line"></div></div><div class="card" style="padding:var(--s-5)"><div class="skeleton skeleton-title"></div><div class="skeleton skeleton-line"></div></div><div class="card" style="padding:var(--s-5)"><div class="skeleton skeleton-title"></div><div class="skeleton skeleton-line"></div></div></div>';
  setTimeout(() => renderColaboradores(), 50);
}
