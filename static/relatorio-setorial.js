// Relatório Setorial — visão completa por setor, mês a mês

function _rsData() {
  let data;
  if (typeof getCurrentFilteredRows === 'function') data = getCurrentFilteredRows();
  else if (typeof getDataFiltered === 'function') data = getDataFiltered();
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

function _avgDuration(rows, key) {
  if (typeof parseDurationToSeconds !== 'function') return null;
  const vals = [];
  (rows || []).forEach(r => {
    const s = parseDurationToSeconds(r && r[key]);
    if (s !== null && s !== undefined && !isNaN(s)) vals.push(s);
  });
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

function _fmtDuration(sec) {
  if (sec === null || sec === undefined || isNaN(sec) || sec <= 0) return '\u2014';
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.round((sec % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${Math.round(sec)}s`;
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
  const fmtPct = n => n !== null && n !== undefined ? (n * 100).toFixed(1).replace('.', ',') + '%' : '\u2014';
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
    return { nome: s, fin, ass, tra, scAvg, prod, taxaT, colabs, tma: _avgDuration(recs, 'TMA'), tmr: _avgDuration(recs, 'TMR') };
  });

  // TMA/TMR geral = média das médias por setor (cada setor pesa igual, sem pesos)
  const _durAvg = arr => {
    const vals = arr.filter(v => v !== null && v !== undefined && !isNaN(v));
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  };
  const tmaGeral = _durAvg(setorMetrics.map(s => s.tma));
  const tmrGeral = _durAvg(setorMetrics.map(s => s.tmr));
  const hasTma = tmaGeral !== null;
  const hasTmr = tmrGeral !== null;
  const hasDur = hasTma || hasTmr;

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
      <button class="btn-primary" id="rsPdfBtn" type="button">\uD83D\uDCC4 PDF (equipe)</button>
    </div>
  </div>`;

  // ── KPI cards com variação vs período anterior ──
  const baseData = _rsData();
  let prevRange = [];
  if (meses.length) {
    const firstIdx = allMeses.indexOf(meses[0]);
    if (firstIdx > 0) prevRange = allMeses.slice(Math.max(0, firstIdx - meses.length), firstIdx);
  }
  const prevRows = baseData.filter(r => r && !isAggregateName(r['Atendente']))
      .filter(r => !__rsFilterState.sector || String(r['Setor'] || '').trim() === __rsFilterState.sector)
      .filter(r => prevRange.indexOf(String(r['Mês'] || '')) >= 0);
  const prevFin = prevRows.reduce((s, r) => s + (parseInt(r['Finalizados']) || 0), 0);
  const prevAss = prevRows.reduce((s, r) => s + (parseInt(r['Assumidos']) || 0), 0);
  const prevTra = prevRows.reduce((s, r) => s + (parseInt(r['Transferidos']) || 0), 0);
  const prevAvg = _avgScoreBySetor(prevRows);
  const prevProd = prevAss > 0 ? prevFin / prevAss : 0;
  const prevTraG = prevAss > 0 ? prevTra / prevAss : 0;
  const hasPrev = !!prevRows.length;
  const prevSetorMetrics = {};
  prevRows.forEach(r => {
    const s = String(r['Setor'] || '').trim() || '(sem setor)';
    if (!prevSetorMetrics[s]) prevSetorMetrics[s] = { fin: 0, ass: 0, tra: 0, sc: [] };
    prevSetorMetrics[s].fin += parseInt(r['Finalizados']) || 0;
    prevSetorMetrics[s].ass += parseInt(r['Assumidos']) || 0;
    prevSetorMetrics[s].tra += parseInt(r['Transferidos']) || 0;
    const v = r['SCORE'];
    if (v !== null && v !== undefined && !isNaN(Number(v))) prevSetorMetrics[s].sc.push(Number(v));
  });
  const prevSetorMap = {};
  Object.keys(prevSetorMetrics).forEach(s => {
    const d = prevSetorMetrics[s];
    const scAvg = d.sc.length ? d.sc.reduce((a, b) => a + b, 0) / d.sc.length : 0;
    prevSetorMap[s] = { fin: d.fin, ass: d.ass, tra: d.tra, scAvg, prod: d.ass > 0 ? d.fin / d.ass : 0, taxaT: d.ass > 0 ? d.tra / d.ass : 0 };
  });
  const _arrowCls = v => v > 0 ? 'trend-up' : (v < 0 ? 'trend-down' : 'trend-neutral');
  const _arrow = v => v > 0 ? '\u25B2' : (v < 0 ? '\u25BC' : '\u2192');
  const _prevLabel = hasPrev ? `vs ${prevRange[0]}${prevRange.length > 1 ? '\u2013' + prevRange[prevRange.length - 1] : ''}` : 'sem período anterior';
  const _deltaSpan = (d, invert) => {
    if (d === null || d === undefined || isNaN(d)) return '';
    const cls = _arrowCls(invert ? -d : d);
    const arrow = _arrow(d);
    return `<span class="${cls}">${arrow} ${d > 0 ? '+' : ''}${Math.abs(d).toFixed(1).replace('.', ',')}%</span>`;
  };
  const kpiCards = [
    { label: 'Assumidos', value: fmtNum(totalAss), sub: _deltaSpan(_calcDeltaPct(prevAss, totalAss)) },
    { label: 'Transferidos', value: fmtNum(totalTra), sub: _deltaSpan(_calcDeltaPct(prevTra, totalTra), true) },
    { label: 'Finalizados', value: fmtNum(totalFin), sub: _deltaSpan(_calcDeltaPct(prevFin, totalFin)) },
    { label: 'Score médio', value: fmtScore(avgScore), sub: _deltaSpan(_calcDeltaPct(prevAvg, avgScore)) },
    { label: 'Produtividade', value: fmtPct(prodGeral), sub: _deltaSpan(_calcDeltaPct(prevProd, prodGeral)) },
    { label: 'Taxa Transferência', value: fmtPct(traGeral), sub: _deltaSpan(_calcDeltaPct(prevTraG, traGeral), true) }
  ];
  if (hasTma) kpiCards.push({ label: 'TMA médio', value: _fmtDuration(tmaGeral), sub: '<span class="trend-neutral">Tempo médio de atendimento</span>' });
  if (hasTmr) kpiCards.push({ label: 'TMR médio', value: _fmtDuration(tmrGeral), sub: '<span class="trend-neutral">Tempo médio de resposta</span>' });
  html += `<div class="kpi-grid" style="margin:0 0 var(--s-5)">
    ${kpiCards.map(c => `<div class="kpi"><div class="label">${c.label}</div><div class="value">${c.value}</div><div class="sub">${c.sub || '<span class="trend-neutral">' + _prevLabel + '</span>'}</div></div>`).join('')}
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
        <h3 style="font-size:13px;font-weight:600;color:var(--text-strong);margin:0 0 var(--s-3)">\uD83D\uDD3B Menores Scores</h3>
        ${bottomScore.length ? bottomScore.map((c, i) => `<div style="display:flex;align-items:center;gap:var(--s-2);padding:var(--s-1) 0;font-size:13px">
          <span style="font-weight:700;color:var(--danger);min-width:18px">${i + 1}\u00BA</span>
          <span style="flex:1;color:var(--text-primary)">${escapeHtml(c.nome)}</span>
          <span style="font-weight:600;color:var(--danger);font-family:monospace">${fmtScore(c.score)}</span>
        </div>`).join('') : '<div style="font-size:12px;color:var(--text-muted)">Nenhum dado de score</div>'}
      </div>
      <div class="card" style="padding:var(--s-4)">
        <h3 style="font-size:13px;font-weight:600;color:var(--text-strong);margin:0 0 var(--s-3)">\uD83D\uDD3B Menores Finaliza\u00E7\u00F5es</h3>
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
  if (avgScore >= 4.5) {
    destaques.push(`Score médio geral em ${fmtScore(avgScore)} \u2014 na meta de qualidade`);
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

  // ── Próximos passos e plano de ação inteligente ──
  const MEDIA_SCORE = 4.5;
  const ALTA_TRANSF = 0.25;
  const BAIXA_PROD = 0.75;
  const actionItems = setorMetrics.map(s => {
    const prev = prevSetorMap[s.nome] || null;
    const dScore = prev && prev.scAvg > 0 ? _calcDeltaPct(prev.scAvg, s.scAvg) : null;
    const dProd = prev && prev.prod > 0 ? _calcDeltaPct(prev.prod, s.prod) : null;
    const dTransf = prev && prev.taxaT > 0 ? _calcDeltaPct(prev.taxaT, s.taxaT) : null;
    const dFin = prev && prev.fin > 0 ? _calcDeltaPct(prev.fin, s.fin) : null;
    const dAss = prev && prev.ass > 0 ? _calcDeltaPct(prev.ass, s.ass) : null;
    const issues = [];

    if (s.scAvg > 0 && s.scAvg < MEDIA_SCORE) {
      const severe = s.scAvg < 4.2;
      issues.push({ weight: severe ? 3 : 2, evidence: `Score ${fmtScore(s.scAvg)}${dScore !== null ? ` (${dScore < 0 ? "queda" : "alta"} de ${Math.abs(dScore).toFixed(1).replace(".", ",")}%)` : ""}`, action: 'Revisar avaliações com menor nota, identificar os dois motivos mais frequentes e realizar calibração com a equipe.', goal: `Score ≥ ${fmtScore(MEDIA_SCORE)}` });
    } else if (s.scAvg >= MEDIA_SCORE && dScore !== null && dScore <= -5) {
      issues.push({ weight: 2, evidence: `Score ainda adequado, mas caiu ${Math.abs(dScore).toFixed(1).replace('.', ',')}%`, action: 'Auditar a queda de qualidade antes que o indicador fique abaixo da meta.', goal: 'Reverter a tendência no próximo período' });
    }
    if (s.taxaT > ALTA_TRANSF) {
      issues.push({ weight: s.taxaT >= 0.35 ? 3 : 2, evidence: `Transferências em ${fmtPct(s.taxaT)}${dTransf !== null ? ` (${dTransf > 0 ? "alta" : "queda"} de ${Math.abs(dTransf).toFixed(1).replace(".", ",")}%)` : ""}`, action: 'Mapear os principais destinos e motivos das transferências e corrigir lacunas de roteamento ou conhecimento.', goal: 'Transferências ≤ 25,0%' });
    } else if (dTransf !== null && dTransf >= 20) {
      issues.push({ weight: 1, evidence: `Transferências cresceram ${dTransf.toFixed(1).replace('.', ',')}%`, action: 'Monitorar motivos de transferência antes que a taxa ultrapasse o limite.', goal: 'Interromper a tendência de alta' });
    }
    if (s.prod < BAIXA_PROD) {
      issues.push({ weight: s.prod < 0.65 ? 3 : 2, evidence: `Produtividade em ${fmtPct(s.prod)}${dProd !== null ? ` (${dProd < 0 ? "queda" : "alta"} de ${Math.abs(dProd).toFixed(1).replace(".", ",")}%)` : ""}`, action: 'Revisar carga, distribuição dos chamados e gargalos entre assumidos e finalizados.', goal: 'Produtividade ≥ 75,0%' });
    } else if (dProd !== null && dProd <= -10) {
      issues.push({ weight: 2, evidence: `Produtividade caiu ${Math.abs(dProd).toFixed(1).replace('.', ',')}%`, action: 'Comparar escala, volume e tipos de chamados para localizar a origem da queda.', goal: 'Recuperar o nível do período anterior' });
    }
    if (dFin !== null && dFin <= -15 && (dAss === null || dAss > -5)) {
      issues.push({ weight: 2, evidence: `Finalizações caíram ${Math.abs(dFin).toFixed(1).replace('.', ',')}% com demanda estável`, action: 'Verificar formação de fila, ausências e concentração de chamados complexos.', goal: 'Recuperar o volume sem reduzir a qualidade' });
    }
    if (hasTma && s.tma !== null && tmaGeral > 0 && s.tma > tmaGeral * 1.2) {
      issues.push({ weight: 1, evidence: `TMA ${_fmtDuration(s.tma)}, mais de 20% acima da referência`, action: 'Analisar etapas que prolongam o atendimento e compartilhar práticas dos setores mais ágeis.', goal: `TMA próximo de ${_fmtDuration(tmaGeral)}` });
    }
    if (hasTmr && s.tmr !== null && tmrGeral > 0 && s.tmr > tmrGeral * 1.2) {
      issues.push({ weight: 1, evidence: `TMR ${_fmtDuration(s.tmr)}, mais de 20% acima da referência`, action: 'Revisar tempo de primeira resposta, cobertura da fila e horários de pico.', goal: `TMR próximo de ${_fmtDuration(tmrGeral)}` });
    }

    const score = issues.reduce((sum, issue) => sum + issue.weight, 0);
    const priority = score >= 6 ? 'critical' : score >= 3 ? 'high' : score > 0 ? 'attention' : 'monitor';
    const prazo = priority === 'critical' ? '7 dias' : priority === 'high' ? '15 dias' : '30 dias';
    if (!issues.length) issues.push({ weight: 0, evidence: `Score ${fmtScore(s.scAvg)} · produtividade ${fmtPct(s.prod)} · transferências ${fmtPct(s.taxaT)}`, action: 'Manter o padrão e documentar as práticas que sustentaram o resultado.', goal: 'Preservar os indicadores no próximo período' });
    return { setor: s.nome, priority, score, prazo, sample: s.ass < 30 ? 'Amostra reduzida' : `${fmtNum(s.ass)} assumidos`, issues };
  }).sort((a, b) => b.score - a.score || a.setor.localeCompare(b.setor, 'pt-BR'));

  const visibleActions = actionItems.slice(0, __rsFilterState.sector ? actionItems.length : 6);
  const criticalCount = actionItems.filter(item => item.priority === 'critical').length;
  const highCount = actionItems.filter(item => item.priority === 'high').length;
  const priorityLabels = { critical: 'Urgente', high: 'Prioridade alta', attention: 'Atenção', monitor: 'Manutenção' };

  html += `<div class="rs-section rs-action-section">
    <div class="rs-action-heading">
      <div><h2 class="rs-section-title">📋 Próximos Passos e Plano de Ação</h2><p>Recomendações calculadas para os filtros atuais${hasPrev ? ` e comparadas com ${escapeHtml(_prevLabel.replace('vs ', ''))}` : ''}.</p></div>
      <div class="rs-action-summary"><span class="critical">${criticalCount} urgente(s)</span><span class="high">${highCount} prioridade(s) alta(s)</span></div>
    </div>
    <div class="rs-action-grid">
      ${visibleActions.map(item => `<article class="rs-action-card is-${item.priority}">
        <header><div><span class="rs-action-priority">${priorityLabels[item.priority]}</span><h3>${escapeHtml(item.setor)}</h3></div><span class="rs-action-deadline">Revisão em ${item.prazo}</span></header>
        <div class="rs-action-evidence"><strong>Diagnóstico</strong>${item.issues.slice(0, 3).map(issue => `<span>${issue.evidence}</span>`).join('')}</div>
        <div class="rs-action-recommendation"><strong>Ação recomendada</strong><p>${item.issues.slice(0, 3).map(issue => issue.action).join(' ')}</p></div>
        <footer><span><strong>Meta:</strong> ${item.issues.slice(0, 2).map(issue => issue.goal).join(' · ')}</span><small>${item.sample}</small></footer>
      </article>`).join('')}
    </div>
    ${actionItems.length > visibleActions.length ? `<p class="rs-action-overflow">Exibindo as 6 maiores prioridades entre ${actionItems.length} setores para manter a leitura executiva.</p>` : ''}
  </div>`;
  // ── Gráfico de pizza — distribuição de finalizados por setor ──
  html += `<div style="display:flex;gap:var(--s-5);align-items:stretch;margin-bottom:var(--s-5);flex-wrap:wrap">
    <div class="card" style="flex:1;min-width:280px;padding:var(--s-4)">
      <h3 style="font-size:14px;font-weight:600;margin-bottom:var(--s-3);color:var(--text-strong)">\uD83D\uDCCA Distribuição por Setor</h3>
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
    <thead><tr><th>Setor</th><th>Finalizados</th><th>Assumidos</th><th>Transferidos</th><th>Score</th><th>Prod.</th>${hasTma ? '<th>TMA</th>' : ''}${hasTmr ? '<th>TMR</th>' : ''}<th>Colabs</th></tr></thead>
    <tbody>${setorMetrics.map(s => {
      const classeSc = s.scAvg > 0 ? getClasseScore(s.scAvg) : '';
      return `<tr>
        <td><strong>${escapeHtml(s.nome)}</strong></td>
        <td>${fmtNum(s.fin)}</td>
        <td>${fmtNum(s.ass)}</td>
        <td>${fmtNum(s.tra)}</td>
        <td class="score-cell ${classeSc}">${fmtScore(s.scAvg)}</td>
        <td>${fmtPct(s.prod)}</td>
        ${hasTma ? `<td>${s.tma !== null ? _fmtDuration(s.tma) : '\u2014'}</td>` : ''}
        ${hasTmr ? `<td>${s.tmr !== null ? _fmtDuration(s.tmr) : '\u2014'}</td>` : ''}
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
      return { mes: m, fin: mFin, ass: mAss, tra: mTra, scAvg: mScAvg, prod: mProd, cols: mCols, hasData: mRecs.length > 0, tma: _avgDuration(mRecs, 'TMA'), tmr: _avgDuration(mRecs, 'TMR') };
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
          ${hasTma ? '<th style="position:sticky;top:0;background:var(--bg-elevated)">TMA</th>' : ''}
          ${hasTmr ? '<th style="position:sticky;top:0;background:var(--bg-elevated)">TMR</th>' : ''}
          <th style="position:sticky;top:0;background:var(--bg-elevated)">Colabs</th>
        </tr></thead>
        <tbody>${monthData.map((md, mi) => {
          if (!md.hasData) return `<tr><td><strong>${md.mes}</strong></td><td colspan="${6 + (hasTma ? 1 : 0) + (hasTmr ? 1 : 0)}" style="color:var(--text-muted);font-size:12px">Sem dados</td></tr>`;
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
            ${hasTma ? `<td>${md.tma !== null ? _fmtDuration(md.tma) : '\u2014'}</td>` : ''}
            ${hasTmr ? `<td>${md.tmr !== null ? _fmtDuration(md.tmr) : '\u2014'}</td>` : ''}
            <td>${md.cols}</td>
          </tr>`;
        }).join('')}</tbody>
      </table></div>
      <div style="margin-top:var(--s-4);height:220px">
        <canvas id="rsChart_${setorIdx}"></canvas>
      </div>
    </div>`;
  });




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

  // ── Exportar PDF (equipe) — somente métricas por setor, sem nomes ──
  const pdfBtn = document.getElementById('rsPdfBtn');
  if (pdfBtn) {
    pdfBtn.addEventListener('click', () => {
      exportSetorPdf(setorMetrics, meses, { avgScore, prodGeral, traGeral, totalAtendentes, totalAss, totalFin, totalTra, hasPrev, prevLabel: prevRange.length ? prevRange[0] + (prevRange.length > 1 ? '\u2013' + prevRange[prevRange.length - 1] : '') : '', setorMetricsPrev: prevSetorMap, totalFinPrev: prevFin, totalAssPrev: prevAss, totalTraPrev: prevTra, avgScorePrev: prevAvg, prodGeralPrev: prevProd, traGeralPrev: prevTraG, hasTma, hasTmr, tmaGeral, tmrGeral });
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

// Exporta PDF em paisagem A4 com métricas agregadas por setor (sem nomes de colaboradores).
function exportSetorPdf(setorMetrics, meses, opts) {
  if (typeof window.jspdf === 'undefined') {
    if (typeof showToast === 'function') showToast('Biblioteca de PDF não carregada.', 'error');
    return;
  }
  opts = opts || {};
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF('l', 'mm', 'a4');
  const pageW = 297;
  const pageH = 210;
  const M = 14;
  const isDark = opts.isDark !== undefined ? opts.isDark : (typeof document !== 'undefined' && document.documentElement && document.documentElement.getAttribute('data-theme') === 'dark');
  const C = isDark ? {
    page: '#0f172a',
    fg: '#f1f5f9',
    muted: '#94a3b8',
    rowAlt: '#1e293b',
    border: '#334155',
    accent: '#3b82f6',
    white: '#ffffff',
    green: '#34d399',
    red: '#f87171',
    neutral: '#94a3b8'
  } : {
    page: '#ffffff',
    fg: '#0f172a',
    muted: '#64748b',
    rowAlt: '#f1f5f9',
    border: '#e2e8f0',
    accent: '#2563eb',
    white: '#ffffff',
    green: '#059669',
    red: '#dc2626',
    neutral: '#64748b'
  };
  const accent = C.accent;
  const fg = C.fg;
  const muted = C.muted;
  const light = C.rowAlt;
  const border = C.border;
  const white = C.white;

  const period = meses && meses.length ? (meses.length === 1 ? String(meses[0]) : `${meses[0]} \u2013 ${meses[meses.length - 1]}`) : '—';
  const now = new Date().toLocaleString('pt-BR', { hour12: false });
  const fmtInt = n => (Number(n) || 0).toLocaleString('pt-BR');
  const fmtScore = n => n > 0 ? Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '\u2014';
  const fmtPct = n => n !== null && n !== undefined && !isNaN(n) ? (n * 100).toFixed(1).replace('.', ',') + '%' : '\u2014';
  const setFont = (style, size) => doc.setFont('helvetica', style).setFontSize(size);

  const totalFin = opts.totalFin !== undefined ? opts.totalFin : setorMetrics.reduce((s, m) => s + m.fin, 0);
  const totalAss = opts.totalAss !== undefined ? opts.totalAss : setorMetrics.reduce((s, m) => s + m.ass, 0);
  const totalTra = opts.totalTra !== undefined ? opts.totalTra : setorMetrics.reduce((s, m) => s + m.tra, 0);
  const avgScore = opts.avgScore !== undefined ? opts.avgScore : (setorMetrics.length ? setorMetrics.reduce((s, m) => s + m.scAvg, 0) / setorMetrics.length : 0);
  const prodGeral = opts.prodGeral !== undefined ? opts.prodGeral : (totalAss > 0 ? totalFin / totalAss : 0);
  const traGeral = opts.traGeral !== undefined ? opts.traGeral : (totalAss > 0 ? totalTra / totalAss : 0);

  function drawHeader(y) {
    doc.setFillColor(accent);
    doc.rect(0, 0, pageW, 26, 'F');
    doc.setTextColor(white);
    setFont('bold', 17); doc.text('Resumo por Setor', M, 11);
    setFont('normal', 10); doc.text('IXC CG \u00B7 Painel de Suporte', M, 18.5);
    setFont('bold', 11); doc.text(`Período: ${period}`, pageW - M, 11, { align: 'right' });
    setFont('normal', 9); doc.text(`Gerado em ${now}`, pageW - M, 18.5, { align: 'right' });
    return y;
  }

  function drawFooter(page) {
    doc.setPage(page);
    doc.setFontSize(8);
    doc.setTextColor(muted);
    doc.text('Métricas por setor \u00B7 sem identificação individual de colaboradores', pageW / 2, pageH - 5, { align: 'center' });
  }

  const hasPrev = !!opts.hasPrev;
  const prevLabel = opts.prevLabel || '';
  const prevMap = opts.setorMetricsPrev || {};
  const green = C.green;
  const red = C.red;
  const neutral = C.neutral;

  const pctDelta = (p, c) => (p === 0 ? null : _calcDeltaPct(p, c));
  const fmtDeltaPct = d => d === null || d === undefined || isNaN(d) ? '' : `${d > 0 ? '+' : ''}${Math.abs(d).toFixed(1).replace('.', ',')}%`;
  const deltaColor = d => d > 0 ? green : (d < 0 ? red : neutral);
  const dirOf = d => d === null || d === undefined || isNaN(d) ? null : (d > 0 ? 'up' : (d < 0 ? 'down' : 'flat'));

  function drawDelta(x, yBase, dir, color, txt, size) {
    if (!dir || !txt) return;
    doc.setTextColor(color);
    doc.setFillColor(color);
    doc.setDrawColor(color);
    const cy = yBase - 1.8;
    if (dir === 'up') doc.triangle(x - 1.7, cy + 1.1, x + 1.7, cy + 1.1, x, cy - 1.8, 'F');
    else if (dir === 'down') doc.triangle(x - 1.7, cy - 1.1, x + 1.7, cy - 1.1, x, cy + 1.8, 'F');
    else { doc.setLineWidth(0.5); doc.line(x - 1.7, cy, x + 1.7, cy); }
    setFont('bold', size || 7);
    doc.text(txt, x + 4.3, yBase, { align: 'left' });
  }

  // Deltas gerais (cards) — sempre em % de variação
  const g = {
    ass: hasPrev ? pctDelta(opts.totalAssPrev, totalAss) : null,
    tra: hasPrev ? pctDelta(opts.totalTraPrev, totalTra) : null,
    fin: hasPrev ? pctDelta(opts.totalFinPrev, totalFin) : null,
    score: hasPrev ? pctDelta(opts.avgScorePrev, avgScore) : null,
    prod: hasPrev ? pctDelta(opts.prodGeralPrev, prodGeral) : null,
    traG: hasPrev ? pctDelta(opts.traGeralPrev, traGeral) : null
  };
  const gText = {
    ass: fmtDeltaPct(g.ass),
    tra: fmtDeltaPct(g.tra),
    fin: fmtDeltaPct(g.fin),
    score: fmtDeltaPct(g.score),
    prod: fmtDeltaPct(g.prod),
    traG: fmtDeltaPct(g.traG)
  };
  const gColor = {
    ass: deltaColor(g.ass),
    tra: deltaColor(g.tra),
    fin: deltaColor(g.fin),
    score: deltaColor(g.score),
    prod: deltaColor(g.prod),
    traG: deltaColor(g.traG === null ? null : -g.traG)
  };
  const gDir = {
    ass: dirOf(g.ass),
    tra: dirOf(g.tra),
    fin: dirOf(g.fin),
    score: dirOf(g.score),
    prod: dirOf(g.prod),
    traG: dirOf(g.traG)
  };

  let page = 1;
  doc.setFillColor(C.page);
  doc.rect(0, 0, pageW, pageH, 'F');
  let y = drawHeader(0);

  // KPI cards (com variação vs período anterior)
  const kpis = [
    { key: 'ass', label: 'Assumidos', value: fmtInt(totalAss), txt: gText.ass },
    { key: 'tra', label: 'Transferidos', value: fmtInt(totalTra), txt: gText.tra },
    { key: 'fin', label: 'Finalizados', value: fmtInt(totalFin), txt: gText.fin },
    { key: 'score', label: 'Score Médio', value: fmtScore(avgScore), txt: gText.score },
    { key: 'prod', label: 'Produtividade', value: fmtPct(prodGeral), txt: gText.prod },
    { key: 'traG', label: 'Taxa Transferência', value: fmtPct(traGeral), txt: gText.traG }
  ];
  const gap = 7;
  const cardW = (pageW - M * 2 - gap * (kpis.length - 1)) / kpis.length;
  const cardH = 28;
  y = 34;
  kpis.forEach((k, i) => {
    const x = M + i * (cardW + gap);
    doc.setFillColor(light);
    doc.setDrawColor(border);
    doc.roundedRect(x, y, cardW, cardH, 2.5, 2.5, 'FD');
    doc.setTextColor(muted); setFont('bold', 8); doc.text(String(k.label).toUpperCase(), x + 4, y + 8);
    doc.setTextColor(fg); setFont('bold', 16); doc.text(k.value, x + 4, y + 19);
    if (k.txt) {
      drawDelta(x + 5.5, y + 25, gDir[k.key], gColor[k.key], k.txt, 8);
    }
  });
  y += cardH + 8;

  if (opts.hasTma || opts.hasTmr) {
    const parts = [];
    if (opts.hasTma) parts.push(`TMA m\u00E9dio: ${_fmtDuration(opts.tmaGeral)}`);
    if (opts.hasTmr) parts.push(`TMR m\u00E9dio: ${_fmtDuration(opts.tmrGeral)}`);
    doc.setTextColor(fg); setFont('bold', 9);
    doc.text(parts.join('   \u00B7   '), M, y);
    y += 6;
  }

  if (hasPrev && prevLabel) {
    doc.setTextColor(muted); setFont('normal', 9);
    doc.text(`Variação vs período anterior (${prevLabel})`, M, y);
    y += 6;
  }

  // Table — Setor | Assumidos | Transferidos | Finalizados | Score | Produtividade | Tx Transf. | TMA? | TMR? (+ delta em cada célula)
  const hasDur = opts.hasTma || opts.hasTmr;
  const durCols = (opts.hasTma ? 1 : 0) + (opts.hasTmr ? 1 : 0);
  const cols = hasDur
    ? [
        { label: 'Setor', w: 38, align: 'left' },
        { label: 'Assumidos', w: 27, align: 'left' },
        { label: 'Transferidos', w: 27, align: 'left' },
        { label: 'Finalizados', w: 29, align: 'left' },
        { label: 'Score', w: 25, align: 'left' },
        { label: 'Produtividade', w: 30, align: 'left' },
        { label: 'Tx Transf.', w: 26, align: 'left' },
        ...(opts.hasTma ? [{ label: 'TMA', w: 30, align: 'left' }] : []),
        ...(opts.hasTmr ? [{ label: 'TMR', w: 30, align: 'left' }] : [])
      ]
    : [
        { label: 'Setor', w: 52, align: 'left' },
        { label: 'Assumidos', w: 34, align: 'left' },
        { label: 'Transferidos', w: 34, align: 'left' },
        { label: 'Finalizados', w: 36, align: 'left' },
        { label: 'Score', w: 30, align: 'left' },
        { label: 'Produtividade', w: 38, align: 'left' },
        { label: 'Tx Transf.', w: 34, align: 'left' }
      ];
  const rowH = 15;
  const tableW = cols.reduce((s, c) => s + c.w, 0);
  const startX = (pageW - tableW) / 2;

  function drawTableHeader() {
    doc.setFillColor(accent);
    doc.rect(startX, y, tableW, rowH, 'F');
    doc.setTextColor(white);
    setFont('bold', 10);
    let cx = startX;
    cols.forEach(c => {
      doc.text(c.label, cx + 4, y + 7, { align: 'left' });
      cx += c.w;
    });
    y += rowH;
  }

  drawTableHeader();

  const sorted = setorMetrics.slice().sort((a, b) => b.fin - a.fin);
  sorted.forEach((m, i) => {
    if (y + rowH > pageH - 12) {
      doc.addPage('l', 'mm', 'a4');
      page += 1;
      y = 16;
      doc.setFillColor(C.page);
      doc.rect(0, 0, pageW, pageH, 'F');
      drawTableHeader();
    }
    const p = prevMap[m.nome];
    const pct = (pv, cv) => pctDelta(pv, cv);
    const d = {
      ass: hasPrev && p ? fmtDeltaPct(pct(p.ass, m.ass)) : '',
      tra: hasPrev && p ? fmtDeltaPct(pct(p.tra, m.tra)) : '',
      fin: hasPrev && p ? fmtDeltaPct(pct(p.fin, m.fin)) : '',
      score: hasPrev && p && p.scAvg > 0 ? fmtDeltaPct(pct(p.scAvg, m.scAvg)) : '',
      prod: hasPrev && p && p.prod > 0 ? fmtDeltaPct(pct(p.prod, m.prod)) : '',
      traG: hasPrev && p && p.taxaT > 0 ? fmtDeltaPct(pct(p.taxaT, m.taxaT)) : ''
    };
    const dDir = {
      ass: hasPrev && p ? dirOf(m.ass - p.ass) : null,
      tra: hasPrev && p ? dirOf(m.tra - p.tra) : null,
      fin: hasPrev && p ? dirOf(m.fin - p.fin) : null,
      score: hasPrev && p && p.scAvg > 0 ? dirOf(m.scAvg - p.scAvg) : null,
      prod: hasPrev && p && p.prod > 0 ? dirOf(m.prod - p.prod) : null,
      traG: hasPrev && p && p.taxaT > 0 ? dirOf(m.taxaT - p.taxaT) : null
    };
    const dCol = {
      ass: hasPrev && p ? deltaColor(m.ass - p.ass) : neutral,
      tra: hasPrev && p ? deltaColor(m.tra - p.tra) : neutral,
      fin: hasPrev && p ? deltaColor(m.fin - p.fin) : neutral,
      score: hasPrev && p && p.scAvg > 0 ? deltaColor(m.scAvg - p.scAvg) : neutral,
      prod: hasPrev && p && p.prod > 0 ? deltaColor(m.prod - p.prod) : neutral,
      traG: hasPrev && p && p.taxaT > 0 ? deltaColor(-(m.taxaT - p.taxaT)) : neutral
    };
    doc.setFillColor(i % 2 ? light : C.page);
    doc.rect(startX, y, tableW, rowH, 'F');
    doc.setTextColor(fg);
    setFont('normal', 10);
    doc.text(m.nome, startX + 4, y + 6.5, { align: 'left' });
    const cells = [
      { v: fmtInt(m.ass), dv: d.ass, dc: dCol.ass, dir: dDir.ass },
      { v: fmtInt(m.tra), dv: d.tra, dc: dCol.tra, dir: dDir.tra },
      { v: fmtInt(m.fin), dv: d.fin, dc: dCol.fin, dir: dDir.fin },
      { v: fmtScore(m.scAvg), dv: d.score, dc: dCol.score, dir: dDir.score },
      { v: fmtPct(m.prod), dv: d.prod, dc: dCol.prod, dir: dDir.prod },
      { v: fmtPct(m.taxaT), dv: d.traG, dc: dCol.traG, dir: dDir.traG },
      ...(opts.hasTma ? [{ v: m.tma !== null && m.tma !== undefined ? _fmtDuration(m.tma) : '\u2014', dv: '', dc: neutral, dir: null }] : []),
      ...(opts.hasTmr ? [{ v: m.tmr !== null && m.tmr !== undefined ? _fmtDuration(m.tmr) : '\u2014', dv: '', dc: neutral, dir: null }] : [])
    ];
    let cx = startX + cols[0].w;
    cells.forEach((c, ci) => {
      const w = cols[ci + 1].w;
      doc.setTextColor(fg);
      doc.text(c.v, cx + 4, y + 6.5, { align: 'left' });
      if (c.dv) {
        drawDelta(cx + 5.5, y + 13, c.dir, c.dc, c.dv, 8);
      }
      cx += w;
    });
    y += rowH;
  });

  y += 8;
  if (y > pageH - 14) { doc.addPage('l', 'mm', 'a4'); page += 1; y = 16; doc.setFillColor(C.page); doc.rect(0, 0, pageW, pageH, 'F'); }
  doc.setFontSize(9);
  doc.setTextColor(muted);
  doc.text(`Total: ${setorMetrics.length} setor(es) \u00B7 ${opts.totalAtendentes !== undefined ? fmtInt(opts.totalAtendentes) + ' atendente(s)' : ''} \u00B7 ${meses ? meses.length : 0} mês(es)`.replace(/\s*\u00B7\s*/g, ' \u00B7 '), M, y);

  for (let p = 1; p <= page; p++) drawFooter(p);
  doc.save(`resumo-por-setor-${String(period).replace(/[^\w\-]+/g, '-')}.pdf`);
  if (typeof showToast === 'function') showToast('PDF exportado com sucesso!', 'success');
}
