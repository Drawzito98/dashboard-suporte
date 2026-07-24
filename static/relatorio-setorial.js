// Relatório Setorial — visão completa por setor, mês a mês

function _rsData() {
  let data;
  if (typeof getCurrentFilteredRows === 'function') data = getCurrentFilteredRows();
  else if (typeof globalFilters !== 'undefined' && globalFilters) data = globalFilters.aplicar(rawRecords || []);
  else data = rawRecords || [];
  if (typeof isSetorActive === 'function') {
    data = data.filter(r => r && isSetorActive(String(r['Setor'] || '').trim()));
  }
  return data;
}

function getFilteredMeses(rows) {
  if (typeof getActiveMonths === 'function') {
    const ativos = getActiveMonths();
    if (ativos.length) return ativos;
  }
  const meses = [...new Set((rows || []).filter(r => r && r['Mês']).map(r => r['Mês']))].filter(Boolean).sort();
  return meses.slice(-6);
}

function _calcDeltaPct(prev, curr) {
  if (prev === null || prev === undefined || prev === 0 || curr === null || curr === undefined) return null;
  return ((curr - prev) / Math.abs(prev)) * 100;
}

function _deltaHtml(delta) {
  if (delta === null || delta === undefined) return '';
  const abs = Math.abs(delta);
  const cls = delta > 0 ? 'trend-up' : (delta < 0 ? 'trend-down' : 'trend-neutral');
  const arrow = delta > 0 ? '\u25B2' : (delta < 0 ? '\u25BC' : '\u2192');
  return ` <span class="${cls}" style="font-size:11px;white-space:nowrap" title="Variação vs mês anterior">${arrow} ${abs.toFixed(1)}%</span>`;
}

// Média de scores por setor (cada setor pesa igual)
function _avgScoreBySetor(rows) {
  const bySetor = {};
  rows.forEach(r => {
    const s = String(r['Setor'] || '').trim();
    if (!s) return;
    const sc = r['SCORE'];
    if (sc == null || isNaN(Number(sc))) return;
    if (!bySetor[s]) bySetor[s] = [];
    bySetor[s].push(Number(sc));
  });
  const avgs = Object.values(bySetor).filter(a => a.length > 0).map(a => a.reduce((x, y) => x + y, 0) / a.length);
  return avgs.length ? avgs.reduce((x, y) => x + y, 0) / avgs.length : 0;
}

// ── Filtros do relatório setorial ──
let __rsFilterState = { sector: null, monthStart: null, monthEnd: null, generated: false };

function _renderFilterBar(setores, meses) {
  const ss = __rsFilterState.sector || '';
  const ms = __rsFilterState.monthStart || '';
  const me = __rsFilterState.monthEnd || '';
  return `<div class="rs-filter-bar">
    <div class="rs-filter-group sector">
      <label>Setor</label>
      <select id="rsFilterSector">
        <option value="">Todos os setores</option>
        ${setores.map(s => `<option value="${escapeHtml(s)}"${ss === s ? ' selected' : ''}>${escapeHtml(s)}</option>`).join('')}
      </select>
    </div>
    <div class="rs-filter-group period">
      <label>De</label>
      <select id="rsFilterMonthStart">
        <option value="">Selecionar</option>
        ${meses.map(m => `<option value="${escapeHtml(m)}"${ms === m ? ' selected' : ''}>${escapeHtml(m)}</option>`).join('')}
      </select>
    </div>
    <div class="rs-filter-group period">
      <label>Até</label>
      <select id="rsFilterMonthEnd">
        <option value="">Selecionar</option>
        ${meses.map(m => `<option value="${escapeHtml(m)}"${me === m ? ' selected' : ''}>${escapeHtml(m)}</option>`).join('')}
      </select>
    </div>
    <button id="rsGenerateBtn" type="button" class="btn-primary" style="padding:var(--s-2) var(--s-4);font-size:13px">${__rsFilterState.generated ? 'Atualizar Relatório' : 'Gerar Relatório'}</button>
    ${__rsFilterState.generated ? '<button id="rsChangeFilterBtn" type="button" class="btn-small" style="padding:var(--s-2) var(--s-3);font-size:13px">Alterar Filtros</button>' : ''}
  </div>`;
}

function __bindFilterEvents(container, setores, meses) {
  const genBtn = document.getElementById('rsGenerateBtn');
  if (genBtn) {
    genBtn.addEventListener('click', () => {
      const sector = document.getElementById('rsFilterSector')?.value || null;
      const monthStart = document.getElementById('rsFilterMonthStart')?.value || null;
      const monthEnd = document.getElementById('rsFilterMonthEnd')?.value || null;
      if (!sector && !monthStart && !monthEnd) {
        if (typeof showToast === 'function') showToast('Selecione ao menos um filtro.', 'warning');
        return;
      }
      if ((monthStart && !monthEnd) || (!monthStart && monthEnd)) {
        if (typeof showToast === 'function') showToast('Selecione o período completo (De e Até).', 'warning');
        return;
      }
      if (monthStart && monthEnd && meses.indexOf(monthStart) > meses.indexOf(monthEnd)) {
        if (typeof showToast === 'function') showToast('"De" deve ser anterior a "Até".', 'warning');
        return;
      }
      __rsFilterState.sector = sector || null;
      __rsFilterState.monthStart = monthStart || null;
      __rsFilterState.monthEnd = monthEnd || null;
      __rsFilterState.generated = true;
      renderRelatorioSetorial();
    });
  }
  const changeBtn = document.getElementById('rsChangeFilterBtn');
  if (changeBtn) {
    changeBtn.addEventListener('click', () => {
      __rsFilterState.generated = false;
      renderRelatorioSetorial();
    });
  }
}

function renderRelatorioSetorial() {
  const container = document.getElementById('relatorioSetorialContent');
  if (!container) return;
  container.classList.add('rs-container');
  const data = _rsData();
  if (!data || !data.length) {
    container.innerHTML = '<div class="empty-state"><div class="empty-title">Nenhum dado carregado</div><div class="empty-sub">Importe dados para gerar o relatório setorial.</div></div>';
    return;
  }

  let rows = data.filter(r => r && !isAggregateName(r['Atendente']));
  const allMeses = getFilteredMeses(rows);
  if (!allMeses.length) {
    container.innerHTML = '<div class="empty-state"><div class="empty-title">Sem períodos</div><div class="empty-sub">Nenhum mês encontrado no filtro atual.</div></div>';
    return;
  }

  // All setores for the filter dropdown (before filtering)
  const bySetorAll = {};
  rows.forEach(r => {
    const s = String(r['Setor'] || '').trim() || '(sem setor)';
    if (!bySetorAll[s]) bySetorAll[s] = [];
    bySetorAll[s].push(r);
  });
  const allSetores = Object.keys(bySetorAll).sort();

  // ── Filter bar ──
  const filterBarHtml = _renderFilterBar(allSetores, allMeses);

  if (!__rsFilterState.generated) {
    container.innerHTML = filterBarHtml + '<div class="empty-state" style="margin-top:var(--s-6)"><div class="empty-title">Selecione um setor e período</div><div class="empty-sub">Escolha o setor e o período de análise acima e clique em "Gerar Relatório" para visualizar os dados.</div></div>';
    __bindFilterEvents(container, allSetores, allMeses);
    return;
  }

  // ── Apply filters ──
  if (__rsFilterState.sector) {
    rows = rows.filter(r => String(r['Setor'] || '').trim() === __rsFilterState.sector);
  }
  if (__rsFilterState.monthStart && __rsFilterState.monthEnd) {
    const sIdx = allMeses.indexOf(__rsFilterState.monthStart);
    const eIdx = allMeses.indexOf(__rsFilterState.monthEnd);
    if (sIdx >= 0 && eIdx >= 0 && sIdx <= eIdx) {
      const range = allMeses.slice(sIdx, eIdx + 1);
      rows = rows.filter(r => range.indexOf(String(r['Mês'] || '')) >= 0);
    }
  }

  const meses = getFilteredMeses(rows);
  if (!meses.length) {
    container.innerHTML = filterBarHtml + '<div class="empty-state" style="margin-top:var(--s-6)"><div class="empty-title">Sem dados para o filtro</div><div class="empty-sub">Tente um período maior ou selecione outro setor.</div></div>';
    __bindFilterEvents(container, allSetores, allMeses);
    return;
  }

  const bySetor = {};
  rows.forEach(r => {
    const s = String(r['Setor'] || '').trim() || '(sem setor)';
    if (!bySetor[s]) bySetor[s] = [];
    bySetor[s].push(r);
  });
  const setores = Object.keys(bySetor).sort();

  const totalFin = rows.reduce((s, r) => s + (parseInt(r['Finalizados']) || 0), 0);
  const totalAss = rows.reduce((s, r) => s + (parseInt(r['Assumidos']) || 0), 0);
  const totalTra = rows.reduce((s, r) => s + (parseInt(r['Transferidos']) || 0), 0);
  const avgScore = _avgScoreBySetor(rows);
  const prodGeral = totalAss > 0 ? totalFin / totalAss : 0;
  const traGeral = totalAss > 0 ? totalTra / totalAss : 0;
  const totalAtendentes = [...new Set(rows.map(r => r['Atendente']))].filter(Boolean).length;

  const fmtNum = n => (Number(n) || 0).toLocaleString('pt-BR');
  const fmtScore = n => n > 0 ? Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '\u2014';
  const fmtPct = n => n !== null && n !== undefined ? (n * 100).toFixed(1) + '%' : '\u2014';
  const _isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const _chartTextColor = typeof ChartTheme !== 'undefined' ? ChartTheme.text() : getComputedStyle(document.documentElement).getPropertyValue('--text-strong').trim() || (_isDark ? '#f8fafc' : '#0f172a');
  const _chartGridColor = typeof ChartTheme !== 'undefined' ? ChartTheme.grid() : (_isDark ? 'rgba(148,163,184,0.2)' : 'rgba(148,163,184,0.15)');
  const _chartSurface = typeof ChartTheme !== 'undefined' ? ChartTheme.surface() : (_isDark ? '#131c2f' : '#ffffff');

  // Métricas por setor (para análise)
  const setorMetrics = setores.map(s => {
    const recs = bySetor[s];
    const fin = recs.reduce((a, r) => a + (parseInt(r['Finalizados']) || 0), 0);
    const ass = recs.reduce((a, r) => a + (parseInt(r['Assumidos']) || 0), 0);
    const tra = recs.reduce((a, r) => a + (parseInt(r['Transferidos']) || 0), 0);
    const sc = recs.map(r => r['SCORE']).filter(v => v !== null && v !== undefined && !isNaN(Number(v)));
    const scAvg = sc.length ? sc.reduce((a, b) => a + Number(b), 0) / sc.length : 0;
    const prod = ass > 0 ? fin / ass : 0;
    const taxaT = ass > 0 ? tra / ass : 0;
    const colabs = [...new Set(recs.map(r => r['Atendente']))].filter(Boolean).length;
    return { nome: s, fin, ass, tra, scAvg, prod, taxaT, colabs };
  });

  let html = filterBarHtml;

  // ── Header ──
  html += `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--s-5);flex-wrap:wrap;gap:var(--s-3)">
    <div>
      <h2 style="font-size:20px;font-weight:700;color:var(--text-strong);margin:0">\uD83D\uDCCA Relatório Setorial</h2>
      <p style="font-size:14px;color:var(--text-secondary);margin-top:2px">${meses.length} meses \u00B7 ${setores.length} setores \u00B7 ${totalAtendentes} atendentes \u00B7 ${meses[0]} a ${meses[meses.length - 1]} \u2014 Rankings, análise setorial, tendências e relatório executivo</p>
    </div>
    <div style="display:flex;gap:var(--s-2);align-items:center">
      <span id="rsPresentationModeIndicator" style="font-size:12px;color:var(--text-muted);display:none">\uD83D\uDCF1 Modo apresentação</span>
      <button id="rsPresentationToggle" class="btn-small" type="button" title="Ocultar botões de ação para captura de tela">\uD83D\uDCF1 Apresentação</button>
      <button class="btn-primary" id="rsPrintBtn" type="button">\uD83D\uDDA8\uFE0F Exportar PNG</button>
    </div>
  </div>`;

  // ── Top 3 Rankings ──
  const colabData = {};
  rows.forEach(r => {
    const nome = String(r['Atendente'] || '').trim();
    if (!nome) return;
    if (typeof isColabActive === 'function' && !isColabActive(nome)) return;
    if (!colabData[nome]) colabData[nome] = { fin: 0, scores: [] };
    colabData[nome].fin += (parseInt(r['Finalizados']) || 0);
    const sc = r['SCORE'];
    if (sc !== null && sc !== undefined && !isNaN(Number(sc))) {
      colabData[nome].scores.push(Number(sc));
    }
  });
  const colabList = Object.entries(colabData).map(([nome, d]) => ({
    nome,
    fin: d.fin,
    score: d.scores.length ? d.scores.reduce((a, b) => a + b, 0) / d.scores.length : 0
  }));

  const topFin = colabList.slice().sort((a, b) => b.fin - a.fin).slice(0, 3);
  const bottomFin = colabList.slice().sort((a, b) => a.fin - b.fin).slice(0, 3);
  const topScore = colabList.filter(c => c.score > 0).sort((a, b) => b.score - a.score).slice(0, 3);
  const bottomScore = colabList.filter(c => c.score > 0).sort((a, b) => a.score - b.score).slice(0, 3);

  html += `<div class="rs-section">
    <h2 class="rs-section-title">\uD83C\uDFC6 Top 3 Rankings</h2>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:var(--s-4)">
      <div class="card" style="padding:var(--s-4)">
        <h3 style="font-size:13px;font-weight:600;color:var(--text-strong);margin:0 0 var(--s-3)">\uD83D\uDD1D Melhores Finaliza\u00E7\u00F5es</h3>
        ${topFin.map((c, i) => `<div style="display:flex;align-items:center;gap:var(--s-2);padding:var(--s-1) 0;font-size:13px">
          <span style="font-weight:700;color:var(--accent);min-width:18px">${i + 1}\u00BA</span>
          <span style="flex:1;color:var(--text-primary)">${escapeHtml(c.nome)}</span>
          <span style="font-weight:600;color:var(--text-strong)">${fmtNum(c.fin)}</span>
        </div>`).join('')}
      </div>
      <div class="card" style="padding:var(--s-4)">
        <h3 style="font-size:13px;font-weight:600;color:var(--text-strong);margin:0 0 var(--s-3)">\uD83D\uDD1D Melhores Score</h3>
        ${topScore.length ? topScore.map((c, i) => `<div style="display:flex;align-items:center;gap:var(--s-2);padding:var(--s-1) 0;font-size:13px">
          <span style="font-weight:700;color:var(--accent);min-width:18px">${i + 1}\u00BA</span>
          <span style="flex:1;color:var(--text-primary)">${escapeHtml(c.nome)}</span>
          <span style="font-weight:600;color:var(--text-strong);font-family:monospace">${fmtScore(c.score)}</span>
        </div>`).join('') : '<div style="font-size:12px;color:var(--text-muted)">Nenhum dado de score</div>'}
      </div>
      <div class="card" style="padding:var(--s-4)">
        <h3 style="font-size:13px;font-weight:600;color:var(--text-strong);margin:0 0 var(--s-3)">\uD83D\uDD3B Piores Score</h3>
        ${bottomScore.length ? bottomScore.map((c, i) => `<div style="display:flex;align-items:center;gap:var(--s-2);padding:var(--s-1) 0;font-size:13px">
          <span style="font-weight:700;color:var(--danger);min-width:18px">${i + 1}\u00BA</span>
          <span style="flex:1;color:var(--text-primary)">${escapeHtml(c.nome)}</span>
          <span style="font-weight:600;color:var(--danger);font-family:monospace">${fmtScore(c.score)}</span>
        </div>`).join('') : '<div style="font-size:12px;color:var(--text-muted)">Nenhum dado de score</div>'}
      </div>
      <div class="card" style="padding:var(--s-4)">
        <h3 style="font-size:13px;font-weight:600;color:var(--text-strong);margin:0 0 var(--s-3)">\uD83D\uDD3B Piores Finaliza\u00E7\u00F5es</h3>
        ${bottomFin.map((c, i) => `<div style="display:flex;align-items:center;gap:var(--s-2);padding:var(--s-1) 0;font-size:13px">
          <span style="font-weight:700;color:var(--danger);min-width:18px">${i + 1}\u00BA</span>
          <span style="flex:1;color:var(--text-primary)">${escapeHtml(c.nome)}</span>
          <span style="font-weight:600;color:var(--danger)">${fmtNum(c.fin)}</span>
        </div>`).join('')}
      </div>
    </div>
  </div>`;

  // ── Destaques e Pontos de Atenção ──
  const destaques = [];
  const atencao = [];

  const bestFin = setorMetrics.slice().sort((a, b) => b.fin - a.fin)[0];
  if (bestFin && bestFin.fin > 0) {
    destaques.push(`${escapeHtml(bestFin.nome)} liderou em finalizações (${fmtNum(bestFin.fin)})`);
  }
  const bestScore = setorMetrics.filter(s => s.scAvg > 0).sort((a, b) => b.scAvg - a.scAvg)[0];
  if (bestScore && bestScore.scAvg >= 4.5) {
    destaques.push(`${escapeHtml(bestScore.nome)} teve o maior score médio (${fmtScore(bestScore.scAvg)})`);
  }
  const bestProd = setorMetrics.filter(s => s.prod > 0).sort((a, b) => b.prod - a.prod)[0];
  if (bestProd && bestProd.prod >= 0.85) {
    destaques.push(`${escapeHtml(bestProd.nome)} teve a maior produtividade (${fmtPct(bestProd.prod)})`);
  }
  if (setorMetrics.filter(s => s.scAvg >= 4.7).length >= 2) {
    destaques.push(`${setorMetrics.filter(s => s.scAvg >= 4.7).length} setores com score \u2265 4,70 \u2014 qualidade consistente`);
  }
  if (avgScore >= 4.2) {
    destaques.push(`Score médio geral em ${fmtScore(avgScore)} \u2014 acima do ideal`);
  }
  if (traGeral !== null && traGeral < 0.15) {
    destaques.push(`Baixa taxa de transferência geral (${fmtPct(traGeral)})`);
  }
  if (prodGeral !== null && prodGeral >= 0.85) {
    destaques.push(`Produtividade geral em ${fmtPct(prodGeral)}`);
  }

  const lowScoreSetores = setorMetrics.filter(s => s.scAvg > 0 && s.scAvg < 4.5);
  lowScoreSetores.forEach(s => {
    atencao.push(`${escapeHtml(s.nome)} com score médio abaixo de 4,50 (${fmtScore(s.scAvg)})`);
  });
  const highTransf = setorMetrics.filter(s => s.taxaT > 0.25);
  highTransf.forEach(s => {
    atencao.push(`${escapeHtml(s.nome)} com taxa de transferência acima de 25% (${fmtPct(s.taxaT)})`);
  });
  const lowProd = setorMetrics.filter(s => s.prod > 0 && s.prod < 0.75);
  lowProd.forEach(s => {
    atencao.push(`${escapeHtml(s.nome)} com produtividade abaixo de 75% (${fmtPct(s.prod)})`);
  });

  if (destaques.length) {
    html += `<div class="rs-section">
      <h2 class="rs-section-title">\u2705 Destaques</h2>
      <div class="rs-list rs-list-success">
        ${destaques.map(d => `<div class="rs-list-item">${d}</div>`).join('')}
      </div>
    </div>`;
  }

  if (atencao.length) {
    html += `<div class="rs-section">
      <h2 class="rs-section-title">\u26A0\uFE0F Pontos de Atenção</h2>
      <div class="rs-list rs-list-danger">
        ${atencao.map(a => `<div class="rs-list-item">${a}</div>`).join('')}
      </div>
    </div>`;
  }

  // ── Gráfico de pizza — distribuição de finalizados por setor ──
  html += `<div style="display:flex;gap:var(--s-5);align-items:stretch;margin-bottom:var(--s-5);flex-wrap:wrap">
    <div class="card" style="flex:1;min-width:280px;padding:var(--s-4)">
      <h3 style="font-size:14px;font-weight:600;margin-bottom:var(--s-3);color:var(--text-strong)">\uD83C\uDF7E Distribuição por Setor</h3>
      <p style="font-size:12px;color:var(--text-secondary);margin-bottom:var(--s-3)">Participação de cada setor no total de finalizados</p>
      <div style="height:280px;position:relative"><canvas id="rsPieChart"></canvas></div>
    </div>
    <div class="card" style="flex:1;min-width:220px;padding:var(--s-4);display:flex;flex-direction:column;gap:var(--s-2)">
      <h3 style="font-size:13px;font-weight:600;color:var(--text-strong);margin:0 0 var(--s-1)">${setorMetrics.length} setor(es)</h3>
      <div style="flex:1;display:flex;flex-direction:column;justify-content:center;gap:var(--s-2)">
      ${setorMetrics.slice().sort((a, b) => b.fin - a.fin).map((s, i) => {
        const pct = totalFin > 0 ? ((s.fin / totalFin) * 100).toFixed(1) : 0;
        const sorted = [...setorMetrics].sort((a, b) => b.fin - a.fin);
        const idx = sorted.indexOf(s);
        const neutralColors = typeof ChartTheme !== 'undefined' ? ChartTheme.neutralPalette(setorMetrics.length) : ['#2563eb','#059669','#d97706','#7c3aed','#ea580c','#0891b2','#e11d48','#8b5cf6','#16a34a','#f97316'];
        const cor = totalFin > 0 ? (neutralColors[idx] || '#94a3b8') : '#94a3b8';
        return `<div style="display:flex;align-items:center;gap:var(--s-3);font-size:13px">
          <span style="width:12px;height:12px;border-radius:3px;background:${cor};flex-shrink:0;box-shadow:0 1px 3px rgba(0,0,0,0.2)"></span>
          <span style="flex:1;font-weight:500;color:var(--text-primary)">${escapeHtml(s.nome)}</span>
          <span style="color:var(--text-secondary);font-size:12px">${fmtNum(s.fin)}</span>
          <span style="font-weight:700;color:var(--text-strong);min-width:48px;text-align:right;font-size:13px">${pct}%</span>
        </div>`;
      }).join('')}
      </div>
    </div>
  </div>`;

  // ── Tabela comparativa entre setores ──
  html += `<h3 style="font-size:15px;font-weight:600;margin-bottom:var(--s-3);color:var(--text-strong)">\uD83D\uDD01 Comparativo entre Setores</h3>`;
  html += `<div style="overflow-x:auto;margin-bottom:var(--s-5)"><table class="ranking-table">
    <thead><tr><th>Setor</th><th>Finalizados</th><th>Assumidos</th><th>Transferidos</th><th>Score</th><th>Prod.</th><th>Colabs</th></tr></thead>
    <tbody>${setorMetrics.map(s => {
      const classeSc = s.scAvg > 0 ? getClasseScore(s.scAvg) : '';
      return `<tr>
        <td><strong>${escapeHtml(s.nome)}</strong></td>
        <td>${fmtNum(s.fin)}</td>
        <td>${fmtNum(s.ass)}</td>
        <td>${fmtNum(s.tra)}</td>
        <td class="score-cell ${classeSc}">${fmtScore(s.scAvg)}</td>
        <td>${fmtPct(s.prod)}</td>
        <td>${s.colabs}</td>
      </tr>`;
    }).join('')}</tbody>
  </table></div>`;

  // ── Detalhamento por setor — mês a mês ──
  html += `<h3 style="font-size:15px;font-weight:600;margin-bottom:var(--s-3);color:var(--text-strong)">\uD83D\uDCCB Detalhamento por Setor</h3>`;

  setores.forEach((s, setorIdx) => {
    const recs = bySetor[s];
    const fin = recs.reduce((a, r) => a + (parseInt(r['Finalizados']) || 0), 0);
    const ass = recs.reduce((a, r) => a + (parseInt(r['Assumidos']) || 0), 0);
    const tra = recs.reduce((a, r) => a + (parseInt(r['Transferidos']) || 0), 0);
    const sc = recs.map(r => r['SCORE']).filter(v => v !== null && v !== undefined && !isNaN(Number(v)));
    const scAvg = sc.length ? sc.reduce((a, b) => a + Number(b), 0) / sc.length : 0;
    const prod = ass > 0 ? fin / ass : 0;

    const monthData = meses.map(m => {
      const mRecs = recs.filter(r => String(r['Mês']) === m);
      const mFin = mRecs.reduce((a, r) => a + (parseInt(r['Finalizados']) || 0), 0);
      const mAss = mRecs.reduce((a, r) => a + (parseInt(r['Assumidos']) || 0), 0);
      const mTra = mRecs.reduce((a, r) => a + (parseInt(r['Transferidos']) || 0), 0);
      const mSc = mRecs.map(r => r['SCORE']).filter(v => v !== null && v !== undefined && !isNaN(Number(v)));
      const mScAvg = mSc.length ? mSc.reduce((a, b) => a + Number(b), 0) / mSc.length : 0;
      const mProd = mAss > 0 ? mFin / mAss : 0;
      const mCols = [...new Set(mRecs.map(r => r['Atendente']))].filter(Boolean).length;
      return { mes: m, fin: mFin, ass: mAss, tra: mTra, scAvg: mScAvg, prod: mProd, cols: mCols, hasData: mRecs.length > 0 };
    });

    html += `<div class="card" style="margin-bottom:var(--s-4);padding:var(--s-5)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--s-4);flex-wrap:wrap;gap:var(--s-2)">
        <div>
          <h3 style="font-size:16px;font-weight:700;color:var(--text-strong);margin:0">${escapeHtml(s)}</h3>
          <span style="font-size:12px;color:var(--text-secondary)">Total: ${fmtNum(fin)} fin \u00B7 Score ${fmtScore(scAvg)} \u00B7 Prod ${fmtPct(prod)}</span>
        </div>
      </div>
      <div style="overflow-x:auto"><table class="ranking-table" style="min-width:680px">
        <thead><tr>
          <th style="position:sticky;top:0;background:var(--bg-elevated)">Mês</th>
          <th style="position:sticky;top:0;background:var(--bg-elevated)">Assumidos</th>
          <th style="position:sticky;top:0;background:var(--bg-elevated)">Transferidos</th>
          <th style="position:sticky;top:0;background:var(--bg-elevated)">Finalizados</th>
          <th style="position:sticky;top:0;background:var(--bg-elevated)">Score</th>
          <th style="position:sticky;top:0;background:var(--bg-elevated)">Prod.</th>
          <th style="position:sticky;top:0;background:var(--bg-elevated)">Colabs</th>
        </tr></thead>
        <tbody>${monthData.map((md, mi) => {
          if (!md.hasData) return `<tr><td><strong>${md.mes}</strong></td><td colspan="6" style="color:var(--text-muted);font-size:12px">Sem dados</td></tr>`;
          const cls = md.scAvg > 0 ? getClasseScore(md.scAvg) : '';
          const prev = mi > 0 ? monthData[mi - 1] : null;
          const dFin = prev && prev.hasData ? _deltaHtml(_calcDeltaPct(prev.fin, md.fin)) : '';
          const dAss = prev && prev.hasData ? _deltaHtml(_calcDeltaPct(prev.ass, md.ass)) : '';
          const dTra = prev && prev.hasData ? _deltaHtml(_calcDeltaPct(prev.tra, md.tra)) : '';
          const dSc = prev && prev.hasData && prev.scAvg > 0 ? _deltaHtml(_calcDeltaPct(prev.scAvg, md.scAvg)) : '';
          const dProd = prev && prev.hasData && prev.prod > 0 ? _deltaHtml(_calcDeltaPct(prev.prod, md.prod)) : '';
          return `<tr>
            <td><strong>${md.mes}</strong></td>
            <td>${fmtNum(md.ass)}${dAss}</td>
            <td>${fmtNum(md.tra)}${dTra}</td>
            <td>${fmtNum(md.fin)}${dFin}</td>
            <td class="score-cell ${cls}">${fmtScore(md.scAvg)}${dSc}</td>
            <td>${fmtPct(md.prod)}${dProd}</td>
            <td>${md.cols}</td>
          </tr>`;
        }).join('')}</tbody>
      </table></div>
      <div style="margin-top:var(--s-4);height:220px">
        <canvas id="rsChart_${setorIdx}"></canvas>
      </div>
    </div>`;
  });



  // ── Próximos passos e plano de ação ──
  const passos = [];
  const MEDIA_SCORE = 4.5;
  const ALTA_TRANSF = 0.25;
  const BAIXA_PROD = 0.7;

  setorMetrics.forEach(s => {
    if (s.scAvg > 0 && s.scAvg < MEDIA_SCORE) {
      passos.push(`Revisar processo do setor \u201C${escapeHtml(s.nome)}\u201D para elevar o score (atual: ${fmtScore(s.scAvg)}). Meta: ${MEDIA_SCORE}+`);
    } else if (s.taxaT > ALTA_TRANSF) {
      passos.push(`Reduzir taxa de transferência do setor \u201C${escapeHtml(s.nome)}\u201D (${fmtPct(s.taxaT)}). Investigar causas e criar plano de ação.`);
    } else if (s.prod < BAIXA_PROD) {
      passos.push(`Melhorar produtividade do setor \u201C${escapeHtml(s.nome)}\u201D (${fmtPct(s.prod)}). Avaliar carga e distribuição de chamados.`);
    } else {
      passos.push(`Manter o padrão de qualidade e produtividade do setor \u201C${escapeHtml(s.nome)}\u201D (score ${fmtScore(s.scAvg)}, prod ${fmtPct(s.prod)}).`);
    }
  });

  if (avgScore >= MEDIA_SCORE) {
    passos.push('Monitorar indicadores mensalmente para detecção precoce de desvios.');
  }
  passos.push('Agendar próxima revisão de indicadores em 30 dias.');

  html += `<div class="rs-section">
    <h2 class="rs-section-title">📋 Próximos Passos e Plano de Ação</h2>
    <div class="rs-list rs-list-info">
      ${passos.map(p => `<div class="rs-list-item">${p}</div>`).join('')}
    </div>
  </div>`;

  // ── Relatório Executivo ──
  html += `<div class="reportBox" style="margin-top:var(--s-6)">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--s-3);flex-wrap:wrap;gap:var(--s-2)">
      <h3 style="font-size:14px;font-weight:600;color:var(--text-strong);margin:0">📝 Relatório Executivo</h3>
      <div style="display:flex;gap:var(--s-2);flex-wrap:wrap">
        <button id="copyReportBtn" type="button" class="btn-small">Copiar relatório</button>
        <button id="exportPdfBtn" type="button" class="btn-small">Exportar PDF</button>
        <button id="refreshReportBtn" type="button" class="btn-small">Atualizar</button>
        <button id="intelReportBtn" type="button" class="btn-small">🤖 Relatório Inteligente</button>
        <button id="deleteReportBtn" type="button" class="btn-small btn-danger">Apagar</button>
      </div>
    </div>
    <textarea id="reportText" class="reportText" placeholder="Clique em “Gerar relatório executivo” no menu lateral para montar o texto automaticamente…"></textarea>
  </div>`;

  container.innerHTML = html;

  // ── Bind dos botões do relatório executivo ──
  __bindFilterEvents(container, allSetores, allMeses);
  const copyBtn = document.getElementById('copyReportBtn');
  const exportPdfBtn = document.getElementById('exportPdfBtn');
  const refreshBtn = document.getElementById('refreshReportBtn');
  const intelBtn = document.getElementById('intelReportBtn');
  const delBtn = document.getElementById('deleteReportBtn');
  if (copyBtn && typeof copyReportToClipboard === 'function') copyBtn.addEventListener('click', () => copyReportToClipboard());
  if (exportPdfBtn && typeof exportReportToPDF === 'function') exportPdfBtn.addEventListener('click', () => exportReportToPDF());
  if (intelBtn && typeof generateIntelReport === 'function') intelBtn.addEventListener('click', () => generateIntelReport());
  if (refreshBtn && typeof generateAndShowReport === 'function') refreshBtn.addEventListener('click', () => generateAndShowReport());
  if (delBtn && typeof clearReportTextOnly === 'function') delBtn.addEventListener('click', () => clearReportTextOnly());
  // Preenche relatório se já existir
  if (window.__lastReportText) {
    const ta = document.getElementById('reportText');
    if (ta && !ta.value) ta.value = window.__lastReportText;
  }

  // ── Renderizar gráficos ──
  if (typeof Chart !== 'undefined') {
    if (!window.__rsCharts) window.__rsCharts = {};
    Object.values(window.__rsCharts).forEach(c => { try { c.destroy(); } catch (e) { console.warn('[RelatorioSetorial] Erro ao destruir chart:', e); } });
    window.__rsCharts = {};

    // Pie chart — distribuição por setor
    const pieCanvas = document.getElementById('rsPieChart');
    if (pieCanvas) {
      const sorted = setorMetrics.slice().sort((a, b) => b.fin - a.fin);
      const totalPie = sorted.reduce((s, x) => s + x.fin, 0);
      if (typeof ChartDataLabels !== 'undefined') {
        Chart.register(ChartDataLabels);
      }
      const neutralColors = typeof ChartTheme !== 'undefined'
        ? ChartTheme.neutralPalette(sorted.length)
        : ['#2563eb','#059669','#d97706','#7c3aed','#ea580c','#0891b2','#e11d48','#8b5cf6','#16a34a','#f97316'];
      const pieColors = sorted.map((_, i) => neutralColors[i] || '#94a3b8');
      const pieBorder = sorted.map((_, i) => {
        const c = neutralColors[i] || '#94a3b8';
        return c + '60';
      });
      window.__rsCharts.pieChart = new Chart(pieCanvas.getContext('2d'), {
        type: 'doughnut',
        data: {
          labels: sorted.map(s => s.nome),
          datasets: [{
            data: sorted.map(s => s.fin),
            backgroundColor: pieColors,
            borderColor: _chartSurface,
            borderWidth: 3,
            hoverOffset: 14
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '38%',
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                color: _chartTextColor,
                font: { size: 13, weight: '500' },
                padding: 16,
                boxWidth: 16,
                boxHeight: 16,
                borderRadius: 4,
                usePointStyle: true
              }
            },
            tooltip: {
              backgroundColor: _chartSurface,
              titleColor: _chartTextColor,
              bodyColor: _chartTextColor,
              borderColor: _chartGridColor,
              borderWidth: 1,
              padding: 12,
              cornerRadius: 8,
              callbacks: {
                label: ctx => {
                  const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                  const pct = total > 0 ? ((ctx.parsed / total) * 100).toFixed(1) : 0;
                  return ` ${ctx.label}: ${ctx.parsed.toLocaleString('pt-BR')} (${pct}%)`;
                }
              }
            },
            datalabels: {
              color: '#ffffff',
              font: { weight: 'bold', size: 13 },
              formatter: (value) => {
                const pct = totalPie > 0 ? (value / totalPie * 100) : 0;
                return pct >= 5 ? pct.toFixed(1) + '%' : '';
              },
              offset: 2,
              display: (ctx) => {
                const pct = totalPie > 0 ? (ctx.dataset.data[ctx.dataIndex] / totalPie * 100) : 0;
                return pct >= 5;
              },
              backgroundColor: ctx => {
                const pct = totalPie > 0 ? (ctx.dataset.data[ctx.dataIndex] / totalPie * 100) : 0;
                return pct >= 5 ? (neutralColors[ctx.dataIndex] || '#64748b') : 'transparent';
              },
              borderRadius: 6,
              padding: { top: 4, bottom: 4, left: 8, right: 8 }
            }
          }
        }
      });
    }

    setores.forEach((s, setorIdx) => {
      const canvas = document.getElementById(`rsChart_${setorIdx}`);
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const recs = bySetor[s];
      const monthData = meses.map(m => {
        const mRecs = recs.filter(r => String(r['Mês']) === m);
        const mFin = mRecs.reduce((a, r) => a + (parseInt(r['Finalizados']) || 0), 0);
        const mSc = mRecs.map(r => r['SCORE']).filter(v => v !== null && v !== undefined && !isNaN(Number(v)));
        const mScAvg = mSc.length ? mSc.reduce((a, b) => a + Number(b), 0) / mSc.length : 0;
        return { label: typeof formatMesLabel === 'function' ? formatMesLabel(m) : m, fin: mFin, sc: mScAvg };
      });

      const barColor = typeof ChartTheme !== 'undefined' ? ChartTheme.blue() : (_isDark ? 'rgba(96,165,250,0.8)' : 'rgba(37,99,235,0.8)');
      window.__rsCharts[`chart_${setorIdx}`] = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: monthData.map(d => d.label),
          datasets: [{
            label: 'Finalizados',
            data: monthData.map(d => d.fin),
            backgroundColor: barColor,
            borderRadius: 6,
            borderSkipped: false,
            yAxisID: 'y'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            datalabels: {
              labels: {
                value: {
                  anchor: 'center',
                  align: 'center',
                  color: '#ffffff',
                  font: { weight: 'bold', size: 14 },
                  formatter: value => value.toLocaleString('pt-BR')
                },
                score: {
                  display: ctx => {
                    const i = ctx.dataIndex;
                    return monthData[i]?.sc > 0;
                  },
                  anchor: 'end',
                  align: 'end',
                  color: _chartTextColor,
                  font: { weight: '700', size: 14 },
                  formatter: (value, ctx) => {
                    const i = ctx.dataIndex;
                    const sc = monthData[i]?.sc;
                    return sc > 0 ? '☆ ' + Number(sc).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '';
                  },
                  offset: 6
                }
              }
            },
            tooltip: {
              backgroundColor: _chartSurface,
              titleColor: _chartTextColor,
              bodyColor: _chartTextColor,
              borderColor: _chartGridColor,
              borderWidth: 1,
              padding: 12,
              cornerRadius: 8,
              callbacks: {
                label: ctx => {
                  const i = ctx.dataIndex;
                  const sc = monthData[i]?.sc;
                  return `Finalizados: ${ctx.parsed.y.toLocaleString('pt-BR')}${sc > 0 ? ` | Score: ${Number(sc).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ''}`;
                }
              }
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              grace: '20%',
              position: 'left',
              grid: { color: _chartGridColor },
              ticks: { font: { size: 13, weight: '500' }, color: _chartTextColor, padding: 8 }
            },
            x: {
              grid: { display: false },
              ticks: { font: { size: 13, weight: '500' }, color: _chartTextColor, padding: 8 }
            }
          }
        }
      });
    });
  }

  // ── Presentation Mode Toggle ──
  const presToggle = document.getElementById('rsPresentationToggle');
  const presIndicator = document.getElementById('rsPresentationModeIndicator');
  if (presToggle) {
    let presActive = false;
    presToggle.addEventListener('click', () => {
      presActive = !presActive;
      if (presActive) {
        container.classList.add('rs-presentation-mode');
        container.querySelectorAll('button').forEach(b => { if (b.id !== 'rsPrintBtn' && b.id !== 'rsPresentationToggle') b.style.display = 'none'; });
        container.querySelectorAll('.btn-small').forEach(b => { if (b.id !== 'rsPresentationToggle') b.style.display = 'none'; });
        presToggle.textContent = '\uD83D\uDCF1 Modo Normal';
        if (presIndicator) { presIndicator.style.display = 'inline'; }
      } else {
        container.classList.remove('rs-presentation-mode');
        container.querySelectorAll('button').forEach(b => b.style.display = '');
        container.querySelectorAll('.btn-small').forEach(b => b.style.display = '');
        presToggle.textContent = '\uD83D\uDCF1 Apresentação';
        if (presIndicator) { presIndicator.style.display = 'none'; }
      }
    });
  }

  // ── Exportar PNG ──
  const printBtn = document.getElementById('rsPrintBtn');
  if (printBtn && typeof html2canvas !== 'undefined') {
    printBtn.addEventListener('click', () => {
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      html2canvas(container, {
        scale: 3,
        backgroundColor: isDark ? '#0f172a' : '#ffffff',
        allowTaint: false,
        useCORS: true,
        logging: false,
        onclone: function(doc) {
          const cloned = doc.querySelector('.rs-container');
          if (cloned) cloned.style.background = isDark ? '#0f172a' : '#ffffff';
        }
      }).then(canvas => {
        const link = document.createElement('a');
        link.download = `relatorio-setorial-${meses[0]}-a-${meses[meses.length - 1]}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        if (typeof showToast === 'function') showToast('PNG exportado com sucesso!', 'success');
      }).catch(() => {
        if (typeof showToast === 'function') showToast('Erro ao exportar. Tente novamente.', 'error');
      });
    });
  }
}

function _showModalAtendentes(nomes) {
  const overlay = document.createElement('div');
  overlay.className = 'rs-modal-overlay';
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

  const box = document.createElement('div');
  box.className = 'rs-modal-box';

  box.innerHTML = `
    <div class="rs-modal-header">
      <h3 class="rs-modal-title">Atendentes (${nomes.length})</h3>
      <button type="button" class="rs-modal-close">&times;</button>
    </div>
    <div class="rs-modal-body">
      <ul class="rs-modal-list">
        ${nomes.map(n => `<li>${escapeHtml ? escapeHtml(n) : n}</li>`).join('')}
      </ul>
    </div>
  `;

  box.querySelector('button').addEventListener('click', () => overlay.remove());
  overlay.appendChild(box);
  document.body.appendChild(overlay);
}

function onRelatorioSetorialTabActivated() {
  renderRelatorioSetorial();
}
