// Comparativos Avançados — Colaborador x Colaborador, Setor x Setor, Período x Período

function renderComparativos() {
  const container = document.getElementById('comparativosContent');
  if (!container) return;
  const data = _gfData();

  if (!data || !data.length) {
    container.innerHTML = '<div class="empty-state"><div class="empty-title">Nenhum dado carregado</div><div class="empty-sub">Importe um CSV para usar os comparativos.</div></div>';
    return;
  }

  const setores = [...new Set((data).filter(r => r && r['Setor']).map(r => r['Setor']))].sort();
  const cols = [...new Set((data).filter(r => r && r['Atendente']).map(r => r['Atendente']))].sort();
  const meses = [...new Set((data).filter(r => r && r['Mês']).map(r => r['Mês']))].sort();

  let html = '';

  // Controls
  html += `<div style="margin-bottom:var(--s-5)">
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:var(--s-3);margin-bottom:var(--s-4)">
      <label class="field"><span>Tipo de comparação</span>
        <select id="compTypeSelect">
          <option value="colab">Colaborador x Colaborador</option>
          <option value="setor">Setor x Setor</option>
          <option value="periodo">Período x Período</option>
        </select>
      </label>
      <label class="field" id="compEntityALabel"><span>Entidade A</span>
        <select id="compEntityA"><option value="">Selecione...</option>
          ${cols.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('')}
        </select>
      </label>
      <label class="field" id="compEntityBLabel"><span>Entidade B</span>
        <select id="compEntityB"><option value="">Selecione...</option>
          ${cols.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('')}
        </select>
      </label>
      <label class="field" id="compPeriodLabel" style="display:none"><span>Período A</span>
        <select id="compPeriodA"><option value="">Selecione...</option>
          ${meses.map(m => `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`).join('')}
        </select>
      </label>
      <label class="field" id="compPeriodBLabel" style="display:none"><span>Período B</span>
        <select id="compPeriodB"><option value="">Selecione...</option>
          ${meses.map(m => `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`).join('')}
        </select>
      </label>
    </div>
    <button class="btn-primary" id="runComparisonBtn" type="button" style="max-width:200px">Comparar</button>
  </div>`;

  // Results area
  html += '<div id="comparisonResults"></div>';

  container.innerHTML = html;

  // Bind type change
  const typeSelect = document.getElementById('compTypeSelect');
  const entityALabel = document.getElementById('compEntityALabel');
  const entityBLabel = document.getElementById('compEntityBLabel');
  const periodLabel = document.getElementById('compPeriodLabel');
  const periodBLabel = document.getElementById('compPeriodBLabel');

  if (typeSelect) {
    typeSelect.addEventListener('change', () => {
      const type = typeSelect.value;
      const isPeriod = type === 'periodo';

      // Update entity A/B labels and options
      if (isPeriod) {
        entityALabel.style.display = 'none';
        entityBLabel.style.display = 'none';
        periodLabel.style.display = 'block';
        periodBLabel.style.display = 'block';
        // Fill period selects with months
        fillSelect(document.getElementById('compPeriodA'), meses);
        fillSelect(document.getElementById('compPeriodB'), meses);
      } else {
        entityALabel.style.display = 'block';
        entityBLabel.style.display = 'block';
        periodLabel.style.display = 'none';
        periodBLabel.style.display = 'none';
        const entities = type === 'setor' ? setores : cols;
        fillSelect(document.getElementById('compEntityA'), entities);
        fillSelect(document.getElementById('compEntityB'), entities);
      }
    });
  }

  // Bind compare button
  const runBtn = document.getElementById('runComparisonBtn');
  if (runBtn) {
    runBtn.addEventListener('click', () => runComparison());
  }
}

function runComparison() {
  const typeSelect = document.getElementById('compTypeSelect');
  const resultsDiv = document.getElementById('comparisonResults');
  if (!typeSelect || !resultsDiv) return;

  const type = typeSelect.value;

  if (type === 'colab') {
    const a = document.getElementById('compEntityA')?.value;
    const b = document.getElementById('compEntityB')?.value;
    if (!a || !b) { showToast('Selecione dois colaboradores para comparar.', 'warn', 'Comparativo'); return; }
    if (a === b) { showToast('Selecione colaboradores diferentes.', 'warn', 'Comparativo'); return; }
    resultsDiv.innerHTML = renderColabComparison(a, b);
  } else if (type === 'setor') {
    const a = document.getElementById('compEntityA')?.value;
    const b = document.getElementById('compEntityB')?.value;
    if (!a || !b) { showToast('Selecione dois setores para comparar.', 'warn', 'Comparativo'); return; }
    if (a === b) { showToast('Selecione setores diferentes.', 'warn', 'Comparativo'); return; }
    resultsDiv.innerHTML = renderSetorComparison(a, b);
  } else if (type === 'periodo') {
    const a = document.getElementById('compPeriodA')?.value;
    const b = document.getElementById('compPeriodB')?.value;
    if (!a || !b) { showToast('Selecione dois períodos para comparar.', 'warn', 'Comparativo'); return; }
    if (a === b) { showToast('Selecione períodos diferentes.', 'warn', 'Comparativo'); return; }
    resultsDiv.innerHTML = renderPeriodComparison(a, b);
  }
}

function renderColabComparison(nameA, nameB) {
  const data = _gfData();
  const rowsA = (data).filter(r => r && String(r['Atendente']) === nameA);
  const rowsB = (data).filter(r => r && String(r['Atendente']) === nameB);

  const sum = (rows, key) => rows.reduce((s, r) => s + (parseInt(r[key]) || 0), 0);
  const avgScore = (rows) => {
    const scores = rows.map(r => r['SCORE']).filter(v => v !== null && v !== undefined && !isNaN(Number(v)));
    return scores.length ? scores.reduce((a, b) => a + Number(b), 0) / scores.length : 0;
  };

  const dataA = {
    assumidos: sum(rowsA, 'Assumidos'),
    finalizados: sum(rowsA, 'Finalizados'),
    transferidos: sum(rowsA, 'Transferidos'),
    score: avgScore(rowsA),
    meses: [...new Set(rowsA.map(r => r['Mês']))].length
  };
  const dataB = {
    assumidos: sum(rowsB, 'Assumidos'),
    finalizados: sum(rowsB, 'Finalizados'),
    transferidos: sum(rowsB, 'Transferidos'),
    score: avgScore(rowsB),
    meses: [...new Set(rowsB.map(r => r['Mês']))].length
  };

  const winner = (a, b, higher) => {
    if (a === b) return 'neutral';
    return (higher ? (a > b) : (a < b)) ? 'comp-winner' : 'comp-loser';
  };

  const aliasMap = buildAliasMap([nameA, nameB]);
  const displayA = getDisplayName(nameA, aliasMap);
  const displayB = getDisplayName(nameB, aliasMap);

  return `<div class="comp-grid">
    <div class="comp-card">
      <div class="comp-card-header"><h3>${escapeHtml(displayA)}</h3></div>
      <div class="comp-row"><span class="comp-label">Assumidos</span><span class="comp-value ${winner(dataA.assumidos, dataB.assumidos, true)}">${dataA.assumidos.toLocaleString('pt-BR')}</span></div>
      <div class="comp-row"><span class="comp-label">Finalizados</span><span class="comp-value ${winner(dataA.finalizados, dataB.finalizados, true)}">${dataA.finalizados.toLocaleString('pt-BR')}</span></div>
      <div class="comp-row"><span class="comp-label">Transferidos</span><span class="comp-value ${winner(dataA.transferidos, dataB.transferidos, false)}">${dataA.transferidos.toLocaleString('pt-BR')}</span></div>
<div class="comp-row"><span class="comp-label">Score médio</span><span class="comp-value ${winner(dataA.score, dataB.score, true)}"><span class="${getClasseScore(dataA.score)}">${dataA.score.toFixed(2)}</span></span></div>
...
      <div class="comp-card-header"><h3>${escapeHtml(displayB)}</h3></div>
      <div class="comp-row"><span class="comp-label">Assumidos</span><span class="comp-value ${winner(dataB.assumidos, dataA.assumidos, true)}">${dataB.assumidos.toLocaleString('pt-BR')}</span></div>
      <div class="comp-row"><span class="comp-label">Finalizados</span><span class="comp-value ${winner(dataB.finalizados, dataA.finalizados, true)}">${dataB.finalizados.toLocaleString('pt-BR')}</span></div>
      <div class="comp-row"><span class="comp-label">Transferidos</span><span class="comp-value ${winner(dataB.transferidos, dataA.transferidos, false)}">${dataB.transferidos.toLocaleString('pt-BR')}</span></div>
      <div class="comp-row"><span class="comp-label">Score médio</span><span class="comp-value ${winner(dataB.score, dataA.score, true)}"><span class="${getClasseScore(dataB.score)}">${dataB.score.toFixed(2)}</span></span></div>
      <div class="comp-row"><span class="comp-label">Períodos</span><span class="comp-value">${dataB.meses}</span></div>
    </div>
  </div>`;
}

function renderSetorComparison(setorA, setorB) {
  const data = _gfData();
  const rowsA = (data).filter(r => r && String(r['Setor']) === setorA);
  const rowsB = (data).filter(r => r && String(r['Setor']) === setorB);

  const sum = (rows, key) => rows.reduce((s, r) => s + (parseInt(r[key]) || 0), 0);
  const avgScore = (rows) => {
    const scores = rows.map(r => r['SCORE']).filter(v => v !== null && v !== undefined && !isNaN(Number(v)));
    return scores.length ? scores.reduce((a, b) => a + Number(b), 0) / scores.length : 0;
  };

  const dataA = {
    assumidos: sum(rowsA, 'Assumidos'),
    finalizados: sum(rowsA, 'Finalizados'),
    transferidos: sum(rowsA, 'Transferidos'),
    score: avgScore(rowsA),
    cols: [...new Set(rowsA.map(r => r['Atendente']))].length
  };
  const dataB = {
    assumidos: sum(rowsB, 'Assumidos'),
    finalizados: sum(rowsB, 'Finalizados'),
    transferidos: sum(rowsB, 'Transferidos'),
    score: avgScore(rowsB),
    cols: [...new Set(rowsB.map(r => r['Atendente']))].length
  };

  const winner = (a, b, higher) => {
    if (a === b) return 'neutral';
    return (higher ? (a > b) : (a < b)) ? 'comp-winner' : 'comp-loser';
  };

  return `<div class="comp-grid">
    <div class="comp-card">
      <div class="comp-card-header"><h3>${escapeHtml(setorA)}</h3></div>
      <div class="comp-row"><span class="comp-label">Colaboradores</span><span class="comp-value">${dataA.cols}</span></div>
      <div class="comp-row"><span class="comp-label">Assumidos</span><span class="comp-value ${winner(dataA.assumidos, dataB.assumidos, true)}">${dataA.assumidos.toLocaleString('pt-BR')}</span></div>
      <div class="comp-row"><span class="comp-label">Finalizados</span><span class="comp-value ${winner(dataA.finalizados, dataB.finalizados, true)}">${dataA.finalizados.toLocaleString('pt-BR')}</span></div>
      <div class="comp-row"><span class="comp-label">Transferidos</span><span class="comp-value ${winner(dataA.transferidos, dataB.transferidos, false)}">${dataA.transferidos.toLocaleString('pt-BR')}</span></div>
      <div class="comp-row"><span class="comp-label">Score médio</span><span class="comp-value ${winner(dataA.score, dataB.score, true)}"><span class="${getClasseScore(dataA.score)}">${dataA.score.toFixed(2)}</span></span></div>
    </div>
    <div class="comp-card">
      <div class="comp-card-header"><h3>${escapeHtml(setorB)}</h3></div>
      <div class="comp-row"><span class="comp-label">Colaboradores</span><span class="comp-value">${dataB.cols}</span></div>
      <div class="comp-row"><span class="comp-label">Assumidos</span><span class="comp-value ${winner(dataB.assumidos, dataA.assumidos, true)}">${dataB.assumidos.toLocaleString('pt-BR')}</span></div>
      <div class="comp-row"><span class="comp-label">Finalizados</span><span class="comp-value ${winner(dataB.finalizados, dataA.finalizados, true)}">${dataB.finalizados.toLocaleString('pt-BR')}</span></div>
      <div class="comp-row"><span class="comp-label">Transferidos</span><span class="comp-value ${winner(dataB.transferidos, dataA.transferidos, false)}">${dataB.transferidos.toLocaleString('pt-BR')}</span></div>
      <div class="comp-row"><span class="comp-label">Score médio</span><span class="comp-value ${winner(dataB.score, dataA.score, true)}"><span class="${getClasseScore(dataB.score)}">${dataB.score.toFixed(2)}</span></span></div>
    </div>
  </div>`;
}

function renderPeriodComparison(periodA, periodB) {
  const data = _gfData();
  const rowsA = (data).filter(r => r && String(r['Mês']) === periodA);
  const rowsB = (data).filter(r => r && String(r['Mês']) === periodB);

  const sum = (rows, key) => rows.reduce((s, r) => s + (parseInt(r[key]) || 0), 0);
  const avgScore = (rows) => {
    const scores = rows.map(r => r['SCORE']).filter(v => v !== null && v !== undefined && !isNaN(Number(v)));
    return scores.length ? scores.reduce((a, b) => a + Number(b), 0) / scores.length : 0;
  };

  const dataA = {
    assumidos: sum(rowsA, 'Assumidos'),
    finalizados: sum(rowsA, 'Finalizados'),
    transferidos: sum(rowsA, 'Transferidos'),
    score: avgScore(rowsA),
    cols: [...new Set(rowsA.map(r => r['Atendente']))].length
  };
  const dataB = {
    assumidos: sum(rowsB, 'Assumidos'),
    finalizados: sum(rowsB, 'Finalizados'),
    transferidos: sum(rowsB, 'Transferidos'),
    score: avgScore(rowsB),
    cols: [...new Set(rowsB.map(r => r['Atendente']))].length
  };

  const pctChange = (a, b) => {
    if (b === 0) return a > 0 ? '+∞' : '0%';
    const change = ((a - b) / b) * 100;
    return (change >= 0 ? '+' : '') + change.toFixed(1) + '%';
  };

  return `<div class="comp-grid">
    <div class="comp-card">
      <div class="comp-card-header"><h3>${escapeHtml(periodA)}</h3></div>
      <div class="comp-row"><span class="comp-label">Colaboradores</span><span class="comp-value">${dataA.cols}</span></div>
      <div class="comp-row"><span class="comp-label">Assumidos</span><span class="comp-value">${dataA.assumidos.toLocaleString('pt-BR')}</span></div>
      <div class="comp-row"><span class="comp-label">Finalizados</span><span class="comp-value">${dataA.finalizados.toLocaleString('pt-BR')}</span></div>
      <div class="comp-row"><span class="comp-label">Transferidos</span><span class="comp-value">${dataA.transferidos.toLocaleString('pt-BR')}</span></div>
      <div class="comp-row"><span class="comp-label">Score médio</span><span class="comp-value"><span class="${getClasseScore(dataA.score)}">${dataA.score.toFixed(2)}</span></span></div>
    </div>
    <div class="comp-card">
      <div class="comp-card-header"><h3>${escapeHtml(periodB)}</h3></div>
      <div class="comp-row"><span class="comp-label">Colaboradores</span><span class="comp-value">${dataB.cols}</span></div>
      <div class="comp-row"><span class="comp-label">Assumidos</span><span class="comp-value">${dataB.assumidos.toLocaleString('pt-BR')} <span class="${dataA.assumidos <= dataB.assumidos ? 'trend-up' : 'trend-down'}">(${pctChange(dataB.assumidos, dataA.assumidos)})</span></span></div>
      <div class="comp-row"><span class="comp-label">Finalizados</span><span class="comp-value">${dataB.finalizados.toLocaleString('pt-BR')} <span class="${dataA.finalizados <= dataB.finalizados ? 'trend-up' : 'trend-down'}">(${pctChange(dataB.finalizados, dataA.finalizados)})</span></span></div>
      <div class="comp-row"><span class="comp-label">Transferidos</span><span class="comp-value">${dataB.transferidos.toLocaleString('pt-BR')} <span class="${dataA.transferidos >= dataB.transferidos ? 'trend-up' : 'trend-down'}">(${pctChange(dataB.transferidos, dataA.transferidos)})</span></span></div>
      <div class="comp-row"><span class="comp-label">Score médio</span><span class="comp-value"><span class="${getClasseScore(dataB.score)}">${dataB.score.toFixed(2)}</span> <span class="${dataA.score <= dataB.score ? 'trend-up' : 'trend-down'}">(${(dataB.score - dataA.score) >= 0 ? '+' : ''}${(dataB.score - dataA.score).toFixed(2)})</span></span></div>
    </div>
  </div>`;
}

// Tab activation hook
function onComparativosTabActivated() {
  renderComparativos();
}
