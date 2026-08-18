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
    if (info.nivel) {
      html += `<div style="font-size:11px;font-weight:600;color:var(--text-muted);margin-top:1px">${escapeHtml(info.nivel)}</div>`;
    }
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
      html += `<div style="font-size:12px;color:var(--danger);margin-top:2px;padding:2px 6px;background:var(--danger-soft);border-radius:var(--r-sm)">📝 ${escapeHtml(info.observacoes)}</div>`;
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
  const filteredData = typeof getDataFiltered === 'function' ? getDataFiltered() : (typeof globalFilters !== 'undefined' && globalFilters ? globalFilters.aplicar(rawRecords || []) : (rawRecords || []));
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
  let prevFin = null, prevScore = null, prevAss = null, prevTrans = null;
  if (meses.length === 1) {
    const allMeses = [...new Set((rawRecords || []).filter(r => r && r['Mês']).map(r => r['Mês']))].sort();
    const idx = allMeses.indexOf(meses[0]);
    if (idx > 0) {
      const prevMes = allMeses[idx - 1];
      const prevRows = (rawRecords || []).filter(r => r && String(r['Atendente']) === nome && String(r['Mês']) === prevMes);
      prevFin = prevRows.reduce((s, r) => s + (parseInt(r['Finalizados']) || 0), 0);
      prevAss = prevRows.reduce((s, r) => s + (parseInt(r['Assumidos']) || 0), 0);
      prevTrans = prevRows.reduce((s, r) => s + (parseInt(r['Transferidos']) || 0), 0);
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
  const assVar = prevAss !== null ? computeVariation(ass, prevAss) : null;
  const transVar = prevTrans !== null ? computeVariation(trans, prevTrans) : null;
  const metrics = [
    { label: 'Finalizados', value: fmtInt(fin), var: finVar, good: finVar === null || finVar >= 0, team: fmtInt(teamFin) },
    { label: 'Score', value: scoreAvg !== null ? scoreAvg.toFixed(2).replace('.', ',') : '—', var: scVar, good: scoreAvg !== null && scoreAvg >= 4.70, team: teamScore ? teamScore.toFixed(2).replace('.', ',') : '—' },
    { label: 'Assumidos', value: fmtInt(ass), var: assVar, good: assVar === null || assVar >= 0, team: fmtInt(allRows.length ? allRows.reduce((s, r) => s + (parseInt(r['Assumidos']) || 0), 0) / allRows.length : 0) },
    { label: 'Transferidos', value: fmtInt(trans), var: transVar, good: transVar === null || transVar <= 0, team: fmtInt(teamTrans) }
  ];
  for (const m of metrics) {
    const borderColor = m.good ? 'var(--success)' : 'var(--danger)';
    html += `<div class="report-metric-card" style="border-top:3px solid ${borderColor}">`;
    html += `<div class="report-metric-value" style="color:${m.good ? 'var(--success)' : 'var(--danger)'}">${m.value}</div>`;
    html += `<div class="report-metric-label">${m.label}</div>`;
    if (m.var !== null) {
      const varCls = m.var >= 0 ? 'variation-pos' : 'variation-neg';
      html += `<div class="report-metric-var"><span class="${varCls}">${m.var >= 0 ? '▲' : '▼'} ${Math.abs(m.var).toFixed(1)}%</span></div>`;
    }
    html += '</div>';
  }
  html += '</div>';

  // ── Highlights & Lowlights ──
  const highlights = [];
  const lowlights = [];

  if (scoreAvg !== null && scoreAvg >= 4.70) highlights.push(`Score alto (${scoreAvg.toFixed(2).replace('.',',')}) — acima da meta de 4,70 ⭐`);
  else if (scoreAvg !== null) lowlights.push(`Score (${scoreAvg.toFixed(2).replace('.',',')}) — abaixo da meta de 4,70 ⚠️`);

  if (fin > teamFin) highlights.push(`Finalizações acima da média do time (${fmtInt(fin)} vs ${fmtInt(teamFin)}) 📈`);
  else if (fin < teamFin && fin > 0) lowlights.push(`Finalizações abaixo da média do time (${fmtInt(fin)} vs ${fmtInt(teamFin)}) 📉`);

  if (metaOk > 0) highlights.push(`Meta atingida em ${metaOk} mês(es) 🎯`);
  else { const hasMeta = colabRows.some(r => parseInt(r['Objetivo']) > 0); if (hasMeta) lowlights.push(`Meta não atingida 🎯`); }

  if (trans > teamTrans * 1.5) lowlights.push(`Transferências acima do ideal (${fmtInt(trans)} vs ${fmtInt(teamTrans)} média) 🔄`);

  if (finVar !== null && finVar > 5) highlights.push(`Finalizações cresceram ${finVar.toFixed(0)}% em relação ao mês anterior 📈`);
  else if (finVar !== null && finVar < -5) lowlights.push(`Finalizações caíram ${Math.abs(finVar).toFixed(0)}% em relação ao mês anterior 📉`);

  if (scVar !== null && scVar > 0) highlights.push(`Score melhorou em relação ao mês anterior 📈`);
  else if (scVar !== null && scVar < 0) lowlights.push(`Score caiu em relação ao mês anterior 📉`);

  if (assVar !== null && assVar > 5) highlights.push(`Assumidos cresceram ${assVar.toFixed(0)}% em relação ao mês anterior 📈`);
  else if (assVar !== null && assVar < -5) lowlights.push(`Assumidos caíram ${Math.abs(assVar).toFixed(0)}% em relação ao mês anterior 📉`);

  if (transVar !== null && transVar > 5) lowlights.push(`Transferências subiram ${transVar.toFixed(0)}% em relação ao mês anterior ⚠️`);
  else if (transVar !== null && transVar < -5) highlights.push(`Transferências caíram ${Math.abs(transVar).toFixed(0)}% em relação ao mês anterior ✅`);

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
    { label: 'Assumidos', value: fmtInt(ass), team: fmtInt(allRows.length ? allRows.reduce((s, r) => s + (parseInt(r['Assumidos']) || 0), 0) / allRows.length : 0), var: assVar },
    { label: 'Transferidos', value: fmtInt(trans), team: fmtInt(teamTrans), var: transVar },
  ];
  for (const d of detRows) {
    html += '<div class="report-grid-row">';
    html += `<span class="report-grid-label">${d.label}</span>`;
    html += `<span class="report-grid-value">${d.value}</span>`;
    html += `<span class="report-grid-team">média: ${d.team}</span>`;
    if (d.var !== null) {
      const vCls = d.var >= 0 ? 'variation-pos' : 'variation-neg';
      html += `<span class="report-grid-var"><span class="${vCls}">${d.var >= 0 ? '▲' : '▼'} ${Math.abs(d.var).toFixed(1)}%</span></span>`;
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
  overlay.style.removeProperty("display");
  overlay.setAttribute("aria-hidden", "false");
  overlay.classList.add('open');
}

function openColabDetailOverlay(nome) {
  const overlay = document.getElementById("colabDetailOverlay");
  const content = document.getElementById("colabDetailContent");
  if (!overlay || !content) return;

  const colabInfo = JSON.parse(localStorage.getItem("sistema_colaboradores_info_v1") || "{}");
  const info = colabInfo[nome] || {};
  const setores = [...new Set((rawRecords || [])
    .filter(r => r && r["Atendente"] === nome && r["Setor"])
    .map(r => String(r["Setor"]).trim()))];
  const condutaChecked = info.conduta_negativa === "true" || info.conduta_negativa === true;
  const nivelAtual = info.nivel || "";

  let html = `<div class="ci-dialog">`;
  html += `<header class="ci-dialog-header">
    <div class="ci-dialog-avatar">${typeof colabAvatarHtml === "function" ? colabAvatarHtml(nome, 48) : "👤"}</div>
    <div class="ci-dialog-title">
      <span>Perfil do colaborador</span>
      <h2>${escapeHtml(nome)}</h2>
      <p>${setores.length ? escapeHtml(setores.join(", ")) : "Setor não identificado"}</p>
    </div>
  </header>`;

  html += `<form id="colabInfoForm" class="ci-dialog-form">`;
  html += `<section class="ci-form-section">
    <div class="ci-form-section-title"><div><strong>Dados cadastrais</strong><small>Informações básicas do colaborador</small></div></div>
    <div class="ci-form-grid">
      <label class="field"><span>Aniversário</span><input type="date" id="ciAniversario" value="${info.data_aniversario || ""}"></label>
      <label class="field"><span>Admissão</span><input type="date" id="ciAdmissao" value="${info.data_admissao || ""}"></label>
      <label class="field ci-span-2"><span>E-mail</span><input type="email" id="ciEmail" placeholder="email@exemplo.com" value="${escapeHtml(info.email || "")}"></label>
    </div>
  </section>`;

  html += `<section class="ci-form-section">
    <div class="ci-form-section-title"><div><strong>Desenvolvimento e perfil</strong><small>Dados utilizados no acompanhamento e no Mapeamento de Time</small></div></div>
    <div class="ci-form-grid">
      <label class="field ci-span-2"><span>Nível de atendimento</span>
        <select id="ciNivel">
          <option value="">Selecione...</option>
          <option value="N1"${nivelAtual === "N1" ? " selected" : ""}>N1</option>
          <option value="N2"${nivelAtual === "N2" ? " selected" : ""}>N2</option>
          <option value="N3"${nivelAtual === "N3" ? " selected" : ""}>N3</option>
        </select>
      </label>
      <label class="field ci-span-2"><span>Tarefas que já desempenhou</span><textarea id="ciTarefas" rows="3" placeholder="Ex.: Atendimento N1, suporte por chat, projeto de migração...">${escapeHtml(info.tarefas_desempenhadas || "")}</textarea></label>
      <label class="field ci-span-2"><span>Objetivos futuros</span><textarea id="ciObjetivos" rows="3" placeholder="Ex.: Assumir liderança, aprender uma ferramenta, mudar de nível...">${escapeHtml(info.objetivos_futuros || "")}</textarea></label>
    </div>
  </section>`;

  html += `<section class="ci-form-section ci-detractor-section${condutaChecked ? " is-active" : ""}" id="ciCondutaField">
    <div class="ci-form-section-title ci-detractor-title">
      <div><strong>🚩 Pontos detratores</strong><small>Registre sinais de atenção relevantes para o acompanhamento</small></div>
      <label class="ci-native-toggle">
        <input type="checkbox" id="ciCondutaToggle" ${condutaChecked ? "checked" : ""}>
        <span>Possui ponto detrator</span>
      </label>
    </div>
    <label class="field ci-detractor-reason" id="ciCondutaMotivoField" ${condutaChecked ? "" : "hidden"}>
      <span>Motivo do ponto detrator</span>
      <textarea id="ciCondutaMotivo" rows="4" placeholder="Descreva o fato de forma objetiva, incluindo contexto quando necessário...">${escapeHtml(info.conduta_motivo || "")}</textarea>
      <small>Use informações factuais. Este registro ficará associado ao colaborador.</small>
    </label>
  </section>`;

  html += `<section class="ci-form-section">
    <div class="ci-form-section-title"><div><strong>Observações gerais</strong><small>Contexto adicional que não se enquadra como ponto detrator</small></div></div>
    <label class="field"><textarea id="ciObservacoes" rows="4" placeholder="Registre observações gerais sobre o colaborador...">${escapeHtml(info.observacoes || "")}</textarea></label>
  </section>`;

  const allBonus = JSON.parse(localStorage.getItem("sistema_pontos_extras_v1") || "[]");
  const penalties = allBonus.filter(b => String(b.colaborador) === nome && (parseFloat(b.pontos) || 0) < 0);
  if (penalties.length) {
    html += `<section class="ci-form-section"><div class="ci-form-section-title"><div><strong>Histórico de penalidades</strong><small>${penalties.length} registro(s)</small></div></div><div class="ci-penalty-list">`;
    for (const penalty of penalties) {
      const pts = Math.abs(parseFloat(penalty.pontos) || 0);
      const meta = [];
      if (penalty.mes) meta.push(escapeHtml(penalty.mes));
      if (penalty.createdAt) meta.push(new Date(penalty.createdAt).toLocaleString("pt-BR"));
      html += `<div class="ci-penalty-item"><strong>-${pts.toFixed(1)}</strong><div><span>${escapeHtml(penalty.descricao || "Penalidade registrada")}</span><small>${meta.join(" · ")}</small></div></div>`;
    }
    html += `</div></section>`;
  }

  html += `<div class="ci-dialog-actions">
    <button class="btn-small ci-clear-button" id="ciLimparBtn" type="button">Limpar dados</button>
    <button class="btn-primary" id="ciSalvarBtn" type="button">Salvar alterações</button>
  </div></form></div>`;

  content.innerHTML = html;
  overlay.style.removeProperty("display");
  overlay.setAttribute("aria-hidden", "false");
  overlay.classList.add("open");

  const condutaToggle = document.getElementById("ciCondutaToggle");
  condutaToggle.addEventListener("change", () => {
    const active = condutaToggle.checked;
    document.getElementById("ciCondutaMotivoField").hidden = !active;
    document.getElementById("ciCondutaField").classList.toggle("is-active", active);
    if (active) requestAnimationFrame(() => document.getElementById("ciCondutaMotivo").focus({ preventScroll: true }));
  });

  document.getElementById("ciSalvarBtn").addEventListener("click", async () => {
    if (!requireAdmin()) return;
    const data = {
      data_aniversario: document.getElementById("ciAniversario").value || "",
      data_admissao: document.getElementById("ciAdmissao").value || "",
      email: document.getElementById("ciEmail").value.trim(),
      tarefas_desempenhadas: document.getElementById("ciTarefas").value.trim(),
      objetivos_futuros: document.getElementById("ciObjetivos").value.trim(),
      observacoes: document.getElementById("ciObservacoes").value.trim(),
      conduta_negativa: condutaToggle.checked ? "true" : "",
      conduta_motivo: document.getElementById("ciCondutaMotivo").value.trim(),
      nivel: document.getElementById("ciNivel").value
    };
    await dbColabInfoSave(nome, data);
    showToast(`Dados de ${nome} salvos!`, "success", "Colaboradores");
    closeColabDetail();
    renderColaboradores();
  });

  document.getElementById("ciLimparBtn").addEventListener("click", async () => {
    if (!requireAdmin()) return;
    if (!confirm(`Limpar todos os dados cadastrais de ${nome}?`)) return;
    await dbColabInfoSave(nome, {
      data_aniversario: "", data_admissao: "", email: "", nivel: "",
      tarefas_desempenhadas: "", objetivos_futuros: "", observacoes: "",
      conduta_negativa: "", conduta_motivo: ""
    });
    showToast(`Dados de ${nome} removidos!`, "success", "Colaboradores");
    closeColabDetail();
    renderColaboradores();
  });
}

// Report overlay close button
document.getElementById('colabReportClose')?.addEventListener('click', () => {
  document.getElementById('colabReportOverlay')?.classList.remove('open');
});
document.getElementById('colabReportPrint')?.addEventListener('click', async () => {
  const content = document.getElementById('colabReportContent');
  if (!content) return;
  const nome = content.querySelector('.report-header h2')?.textContent || 'colaborador';
  showToast('Capturando relatório…', 'ok');
  try {
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg-surface').trim() || '#1e293b';
    content.style.padding = 'var(--s-6)';
    const canvas = await html2canvas(content, { scale: 2, useCORS: true, backgroundColor: bg });
    content.style.padding = '';
    const link = document.createElement('a');
    link.download = `relatorio_${nome.replace(/\s+/g, '_').normalize('NFD').replace(/\p{Diacritic}/gu, '')}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    showToast('Relatório salvo como imagem!', 'success', 'Exportar');
  } catch (e) {
    showToast('Erro ao capturar relatório: ' + e.message, 'error');
  }
});

function onColaboradoresTabActivated() {
  const container = document.getElementById('colaboradoresContent');
  if (!container) return;
  container.innerHTML = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:var(--s-3);padding:var(--s-4)"><div class="card" style="padding:var(--s-5)"><div class="skeleton skeleton-title"></div><div class="skeleton skeleton-line"></div></div><div class="card" style="padding:var(--s-5)"><div class="skeleton skeleton-title"></div><div class="skeleton skeleton-line"></div></div><div class="card" style="padding:var(--s-5)"><div class="skeleton skeleton-title"></div><div class="skeleton skeleton-line"></div></div></div>';
  setTimeout(() => renderColaboradores(), 50);
}
