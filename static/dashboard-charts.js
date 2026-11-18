// Renderização do Dashboard; usa o estado/seletores de compatibilidade do app.
(function (root) {
function sizeChartInnerForLabels(labelCount, perLabelPx){
  try{
    var inner = document.getElementById('chartInner');
    var wrap = inner && inner.parentElement;
    if (!inner || !wrap) return;
    var per = perLabelPx || 90;
    var target = Math.max(wrap.clientWidth || 0, Math.max(1, labelCount) * per);
    inner.style.width = target + 'px';
    inner.style.minWidth = target + 'px';
    var cnv = document.getElementById('mainChart');
    if (cnv) { cnv.style.width = target + 'px'; }
  }catch(e){ console.error('[App] Erro:', e); }
}

const valueLabelPlugin = {
  id: 'valueLabelPlugin',
  afterDatasetsDraw(chart, args, options) {
    const ctx = chart.ctx;
    chart.data.datasets.forEach((dataset, dsIndex) => {
      const meta = chart.getDatasetMeta(dsIndex);
      if (!meta || !meta.data) return;
      const showInteger = chart.options && chart.options.plugins && chart.options.plugins.valueLabels && chart.options.plugins.valueLabels.integer;
      meta.data.forEach((element, index) => {
        const raw = dataset.data[index];
        if (raw === null || raw === undefined) return;
        const lbl = String(dataset.label || '').toLowerCase();
        const isScore = lbl.includes('score');
        const isCount = lbl.includes('finaliz') || lbl.includes('assumid') || lbl.includes('transferid');
        let text;
        const fmt2 = (n) => {
          try { return Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
          catch(e) { return Number(n).toFixed(2); }
        };
        if (isScore) text = fmt2(raw);
        else if (isCount) text = String(Math.round(raw));
        else text = showInteger ? String(Math.round(raw)) : fmt2(raw);
        ctx.save();
        ctx.font = isScore || isCount ? '500 16px system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial' : '12px system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial';
        ctx.fillStyle = typeof ChartTheme !== 'undefined' ? ChartTheme.text() : (Chart.defaults && Chart.defaults.color ? Chart.defaults.color : '#1f2937');
        if (isCount) ctx.fillStyle = typeof ChartTheme !== 'undefined' ? ChartTheme.strong() : (Chart.defaults && Chart.defaults.color ? Chart.defaults.color : '#0f172a');
        ctx.textAlign = 'center';
        ctx.textBaseline = isScore ? 'bottom' : 'bottom';
        const x = element.x !== undefined ? element.x : (element.getCenterPoint ? element.getCenterPoint().x : null);
        const y = element.y !== undefined ? element.y : (element.getCenterPoint ? element.getCenterPoint().y : null);
        if (x == null || y == null) { ctx.restore(); return; }
        const yOffset = isScore ? -16 : -8;
        ctx.fillText(text, x, y + yOffset);
        ctx.restore();
      });
    });
  }
};


function renderChart(rows) {
  if (!rows) return;
  const rowsForChart = (rows || []).filter(r => !isAggregateName(r['Atendente']));

  if (!rowsForChart.length) { setChartEmpty(true, 'Ajuste os filtros ou importe novos arquivos.'); return; }
  setChartEmpty(false);

  // Quando filtrado para um único atendente, mostra evolução mensal
  const singleAtendente = atendenteSelect && atendenteSelect.value && atendenteSelect.value !== 'all';
  if (singleAtendente) {
    renderSingleEvolutionChart(rowsForChart);
    return;
  }

  const searchTerm = (searchAtendenteInput?.value || '').trim().toLowerCase();
  const selectedAt = getSelectedAtendentes();
  const finMap = new Map(), assMap = new Map(), scMap = new Map(), scCount = new Map();
  rowsForChart.forEach(r => {
    const k = r['Atendente'] || 'Sem nome';
    if (searchTerm) { const nm = String(k).toLowerCase(); if (!nm.includes(searchTerm)) return; }
    if (hiddenLabels.has(k)) return;
    const fin = parseInt(r['Finalizados']) || 0;
    const ass = parseInt(r['Assumidos']) || 0;
    const sc = r['SCORE'];
    finMap.set(k, (finMap.get(k) || 0) + fin);
    assMap.set(k, (assMap.get(k) || 0) + ass);
    if (sc != null && !isNaN(Number(sc))) {
      scMap.set(k, (scMap.get(k) || 0) + Number(sc));
      scCount.set(k, (scCount.get(k) || 0) + 1);
    }
  });
  let labels = Array.from(finMap.keys());
  if (!labels.length) { replaceChart({ type: 'bar', data: { labels: [], datasets: [] }, options: { plugins: { legend: { display: false } } } }); return; }
  if (selectedAt && selectedAt.length) {
    const present = selectedAt.filter(d => labels.includes(d));
    const rest = labels.filter(l => !present.includes(l)).sort((a,b) => (finMap.get(b)||0) - (finMap.get(a)||0));
    labels = [...present, ...rest];
  } else {
    labels.sort((a,b) => (finMap.get(b)||0) - (finMap.get(a)||0));
  }
  const aliasMap = buildAliasMap(labels);
  const displayLabels = labels.map(l => getDisplayName(l, aliasMap));
  const firstNameLabels = displayLabels.map(l => getFirstName(l));
  const finData = labels.map(l => finMap.get(l) || 0);
  const assData = labels.map(l => assMap.get(l) || 0);
  const scData = labels.map(l => { const s = scMap.get(l), c = scCount.get(l); return c ? Number((s/c).toFixed(2)) : null; });
  sizeChartInnerForLabels(labels.length, 110);
  const maxVal = Math.max(...finData, ...assData, 1);
  const yMax = Math.ceil(maxVal * 2.2 / 100) * 100 || 200;
  const ct = typeof ChartTheme !== 'undefined' ? ChartTheme : null;
  const bgFin = labels.map(() => ct ? ct.green() : 'rgba(16,185,129,0.85)');
  const bgAss = labels.map(() => ct ? ct.blue() : 'rgba(37,99,235,0.85)');
  const cfg = {
    type: 'bar',
    data: {
      labels: displayLabels,
      datasets: [
        { label: 'Assumidos', data: assData, backgroundColor: bgAss, borderRadius: 3, yAxisID: 'y' },
        { label: 'Finalizados', data: finData, backgroundColor: bgFin, borderRadius: 3, yAxisID: 'y' },
        { label: 'Score', type: 'line', data: scData, borderColor: ct ? ct.amber() : '#f59e0b', backgroundColor: ct ? (ct.isDark() ? 'rgba(251,191,36,0.08)' : 'rgba(245,158,11,0.05)') : 'rgba(245,158,11,0.05)', pointBackgroundColor: ct ? ct.amber() : '#f59e0b', pointRadius: 5, pointHoverRadius: 7, tension: 0.3, fill: true, yAxisID: 'y1' }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 56, right: 16, bottom: 4, left: 4 } },
      plugins: {
        datalabels: { display: false },
        valueLabels: { integer: false },
        legend: { display: true, position: 'bottom', align: 'center', labels: { color: ct ? ct.text() : undefined, usePointStyle: true, pointStyle: 'circle', boxWidth: 10, boxHeight: 10, padding: 18, font: { size: 13 } } },
        tooltip: Object.assign({
          callbacks: {
            label: (ctx) => {
              const v = ctx.parsed && ctx.parsed.y !== undefined ? ctx.parsed.y : ctx.raw;
              if ((ctx.dataset.label || '').includes('Score')) return `Score: ${Number(v).toFixed(2)}`;
              return `${ctx.dataset.label}: ${Math.round(v).toLocaleString('pt-BR')}`;
            }
          }
        }, ct ? ct.tooltip() : {
          backgroundColor: 'rgba(15, 23, 42, 0.92)',
          titleColor: '#f8fafc', bodyColor: '#e2e8f0',
          borderColor: 'rgba(255,255,255,0.08)', borderWidth: 1,
          padding: 12, cornerRadius: 10, displayColors: true, boxPadding: 6
        })
      },
      scales: {
        y: { beginAtZero: true, max: yMax, position: 'left', grid: { color: ct ? ct.grid() : 'rgba(148,163,184,0.14)' }, ticks: { font: { size: 13 }, color: ct ? ct.text() : undefined } },
        y1: { beginAtZero: true, position: 'right', grid: { drawOnChartArea: false }, min: 0, max: 5.5, ticks: { font: { size: 13 }, color: ct ? ct.text() : undefined, callback: v => Number(v).toFixed(2) } },
        x: { grid: { display: false }, ticks: { font: { size: 13 }, color: ct ? ct.text() : undefined, callback: function(val, idx) { return firstNameLabels[idx]; } } }
      }
    }
  };
  replaceChart(cfg);
}

function renderSingleEvolutionChart(rows) {
  if (!rows || !rows.length) { setChartEmpty(true, 'Nenhum dado para o período selecionado. Tente outro mês ou período.'); return; }
  setChartEmpty(false);
  const months = uniqueSorted(rows.map(r => String(r['Mês'] || '')).filter(Boolean));
  if (!months.length) { setChartEmpty(true, 'Nenhum período encontrado.'); return; }

  const assData = months.map(m => rows.filter(r => String(r['Mês']) === m).reduce((s, r) => s + (parseInt(r['Assumidos']) || 0), 0));
  const finData = months.map(m => rows.filter(r => String(r['Mês']) === m).reduce((s, r) => s + (parseInt(r['Finalizados']) || 0), 0));
  const scData = months.map(m => {
    const scores = rows.filter(r => String(r['Mês']) === m).map(r => r['SCORE']).filter(v => v != null && !isNaN(Number(v)));
    return scores.length ? Number((scores.reduce((a, b) => a + Number(b), 0) / scores.length).toFixed(2)) : null;
  });

  sizeChartInnerForLabels(months.length, 140);
  const maxVal = Math.max(...assData, ...finData, 1);
  const yMax = Math.ceil(maxVal * 1.4 / 100) * 100 || 200;

  const ct = typeof ChartTheme !== 'undefined' ? ChartTheme : null;
  const cfg = {
    type: 'bar',
    data: {
      labels: months,
      datasets: [
        { label: 'Assumidos', data: assData, backgroundColor: ct ? ct.blue() : 'rgba(37,99,235,0.8)', borderRadius: 3, yAxisID: 'y' },
        { label: 'Finalizados', data: finData, backgroundColor: ct ? ct.green() : 'rgba(16,185,129,0.8)', borderRadius: 3, yAxisID: 'y' },
        { label: 'Score', type: 'line', data: scData, borderColor: ct ? ct.amber() : '#f59e0b', backgroundColor: ct ? (ct.isDark() ? 'rgba(251,191,36,0.08)' : 'rgba(245,158,11,0.05)') : 'rgba(245,158,11,0.05)', pointBackgroundColor: ct ? ct.amber() : '#f59e0b', pointRadius: 5, pointHoverRadius: 7, tension: 0.3, fill: true, yAxisID: 'y1' }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 56, right: 16, bottom: 4, left: 4 } },
      plugins: {
        datalabels: { display: false },
        valueLabels: { integer: false },
        legend: { display: true, position: 'bottom', align: 'center', labels: { color: ct ? ct.text() : undefined, usePointStyle: true, pointStyle: 'circle', boxWidth: 8, boxHeight: 8, padding: 16, font: { size: 12 } } },
        tooltip: Object.assign({
          callbacks: {
            label: (ctx) => {
              const v = ctx.parsed && ctx.parsed.y !== undefined ? ctx.parsed.y : ctx.raw;
              if ((ctx.dataset.label || '').includes('Score')) return `Score: ${Number(v).toFixed(2)}`;
              return `${ctx.dataset.label}: ${Math.round(v).toLocaleString('pt-BR')}`;
            }
          }
        }, ct ? ct.tooltip({ padding: 12, cornerRadius: 10 }) : {
          backgroundColor: 'rgba(15, 23, 42, 0.92)',
          titleColor: '#f8fafc', bodyColor: '#e2e8f0',
          borderColor: 'rgba(255,255,255,0.08)', borderWidth: 1,
          padding: 12, cornerRadius: 10, displayColors: true, boxPadding: 6
        })
      },
      scales: {
        y: { beginAtZero: true, max: yMax, position: 'left', grid: { color: ct ? ct.grid() : 'rgba(148,163,184,0.14)' }, ticks: { font: { size: 13 }, color: ct ? ct.text() : undefined } },
        y1: { beginAtZero: true, position: 'right', grid: { drawOnChartArea: false }, min: 0, max: 5.5, ticks: { font: { size: 13 }, color: ct ? ct.text() : undefined, callback: v => Number(v).toFixed(2) } },
        x: { grid: { display: false }, ticks: { font: { size: 13 }, color: ct ? ct.text() : undefined } }
      }
    }
  };
  replaceChart(cfg);
}

function renderTimelineChart(rows) {
  if (!rows) return;
  const rowsForChart = (rows || []).filter(r => !isAggregateName(r['Atendente']));
  if (!rowsForChart.length) { setChartEmpty(true, 'Ajuste os filtros ou importe novos arquivos.'); return; }
  setChartEmpty(false);
  if (!isChartAvailable()) {
    setChartEmpty(true, 'Gráfico indisponível: a biblioteca Chart.js não foi carregada.');
    return;
  }
  const metric = 'Finalizados';

  // Para evolução mensal, usamos as linhas individuais (sem agregados)
  const base = (rows || []).filter(r => !isAggregateName(r['Atendente']));
  const months = uniqueSorted(base.map(r => String(r['Mês'] || '')).filter(Boolean));

  // Decide quais séries mostrar
  let seriesNames = [];
  const selectedAt = getSelectedAtendentes();
  if (selectedAt && selectedAt.length && !selectedAt.includes('all')) {
    seriesNames = selectedAt.slice();
  } else if (Array.isArray(compareChosen) && compareChosen.length) {
    seriesNames = compareChosen.slice();
  } else {
    seriesNames = ['(Total)'];
  }

  const aliasMap = buildAliasMap(base.map(r => r['Atendente']));
  const datasets = seriesNames.map(name => {
    const data = months.map(m => {
      const subset = base.filter(r => String(r['Mês']) === m && (name === '(Total)' || String(r['Atendente']) === name));
      if (!subset.length) return 0;
      if (metric === 'Score') {
        const scores = subset.map(r => r['SCORE']).filter(v => v !== null && v !== undefined && !Number.isNaN(v));
        if (!scores.length) return 0;
        return Math.round((scores.reduce((a,b)=>a+b,0) / scores.length) * 100) / 100;
      }
      // métricas inteiras somadas
      const key = metric === 'Score' ? 'SCORE' : metric;
      return subset.reduce((sum, r) => sum + (parseInt(r[key]) || 0), 0);
    });

    return {
      label: name === '(Total)' ? name : getDisplayName(name, aliasMap),
      data,
      hidden: hiddenLabels.has(name),
      tension: 0.2
    };
  });

  sizeChartInnerForLabels(months.length, 140);
  const ctx = document.getElementById('mainChart').getContext('2d');
  if (chart) chart.destroy();
  chart = new Chart(ctx, {
    type: 'line',
    data: { labels: months, datasets },
    plugins: [valueLabelPlugin],
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 8, right: 8, bottom: 4, left: 4 } },
      plugins: {
        datalabels: { display: false },
        valueLabels: { integer: metric !== 'Score' },
        legend: {
          display: true,
          position: 'bottom',
          align: 'center',
          labels: {
            color: typeof ChartTheme !== 'undefined' ? ChartTheme.text() : (Chart.defaults && Chart.defaults.color ? Chart.defaults.color : '#475569'),
            usePointStyle: true, pointStyle: 'circle',
            boxWidth: 8, boxHeight: 8,
            padding: 18,
            font: { size: 13, weight: '600' }
          },
          onClick: (e, legendItem) => {
            const label = legendItem.text;
            if (hiddenLabels.has(label)) hiddenLabels.delete(label);
            else hiddenLabels.add(label);
            saveState();
            updateView();
          }
        },
        tooltip: Object.assign({
          enabled: true,
          titleFont: { size: 13, weight: '600' }, bodyFont: { size: 13 },
          callbacks: {
            label: (ctx) => {
              const v = (ctx.parsed && ctx.parsed.y !== undefined) ? ctx.parsed.y : ctx.raw;
              const isInt = metric !== 'Score';
              const valTxt = isInt ? String(Math.round(v)) : Number(v).toFixed(2);
              const dsLabel = ctx.dataset && ctx.dataset.label ? ctx.dataset.label + ': ' : '';
              return dsLabel + valTxt;
            }
          }
        }, typeof ChartTheme !== 'undefined' ? ChartTheme.tooltip({ padding: 12, cornerRadius: 10 }) : {
          backgroundColor: 'rgba(15, 23, 42, 0.92)',
          titleColor: '#f8fafc', bodyColor: '#e2e8f0',
          borderColor: 'rgba(255,255,255,0.08)', borderWidth: 1,
          padding: 12, cornerRadius: 10, displayColors: true, boxPadding: 6
        })
      },
      scales: {
        y: { beginAtZero: true, grid: { color: typeof ChartTheme !== 'undefined' ? ChartTheme.grid() : 'rgba(148,163,184,0.14)' }, ticks: { callback: (v) => (metric !== 'Score') ? String(Math.round(v)) : Number(v).toFixed(2), font: { size: 13 }, color: typeof ChartTheme !== 'undefined' ? ChartTheme.text() : undefined } },
        x: { grid: { display: false }, ticks: { font: { size: 13 }, color: typeof ChartTheme !== 'undefined' ? ChartTheme.text() : undefined } }
      }
    }
  });
}


function renderDetailedByMonthChart(rows) {
  if (!rows) return;
  const base = (rows || []).filter(r => !isAggregateName(r['Atendente']));
  if (!base.length) { setChartEmpty(true, 'Ajuste os filtros ou importe novos arquivos.'); return; }
  if (!isChartAvailable()) { setChartEmpty(true, 'Gráfico indisponível: a biblioteca Chart.js não foi carregada.'); return; }
  setChartEmpty(false);

  const months = uniqueSorted(base.map(r => String(r['Mês'] || '')).filter(Boolean));
  if (months.length < 1) { setChartEmpty(true, 'Selecione ao menos um mês.'); return; }
  sizeChartInnerForLabels(months.length, 180);

  const sumBy = (m, field) => base
    .filter(r => String(r['Mês']) === m)
    .reduce((acc, r) => acc + (parseInt(r[field]) || 0), 0);
  const avgScore = (m) => {
    const sc = base.filter(r => String(r['Mês']) === m)
      .map(r => r['SCORE'])
      .filter(v => v !== null && v !== undefined && v !== '' && !Number.isNaN(Number(v)))
      .map(Number);
    if (!sc.length) return null;
    return Math.round((sc.reduce((a,b)=>a+b,0) / sc.length) * 100) / 100;
  };

  const assumidos    = months.map(m => sumBy(m, 'Assumidos'));
  const transferidos = months.map(m => sumBy(m, 'Transferidos'));
  const finalizados  = months.map(m => sumBy(m, 'Finalizados'));
  const scores       = months.map(m => avgScore(m));

  const ct = typeof ChartTheme !== 'undefined' ? ChartTheme : null;
  const datasets = [
  { type: 'bar', label: 'Assumidos', categoryPercentage: 0.7, barPercentage: 0.85,    data: assumidos,    backgroundColor: ct ? ct.blue() : 'rgba(59,130,246,0.8)',  yAxisID: 'y',  order: 3 },
  { type: 'bar', label: 'Transferidos', categoryPercentage: 0.7, barPercentage: 0.85, data: transferidos, backgroundColor: ct ? ct.orange() : 'rgba(249,115,22,0.8)',  yAxisID: 'y',  order: 3 },
  { type: 'bar', label: 'Finalizados', categoryPercentage: 0.7, barPercentage: 0.85,  data: finalizados,  backgroundColor: ct ? ct.green() : 'rgba(16,185,129,0.85)',  yAxisID: 'y',  order: 3 },
  { type: 'line', label: 'Score médio', data: scores, borderColor: ct ? ct.purple() : 'rgba(139,92,246,1)', backgroundColor: ct ? (ct.isDark() ? 'rgba(167,139,250,0.2)' : 'rgba(139,92,246,0.15)') : 'rgba(139,92,246,0.15)', borderWidth: 2.5, tension: 0.3, yAxisID: 'yScore', order: 1, spanGaps: true, pointRadius: 5, pointBackgroundColor: ct ? ct.purple() : 'rgba(139,92,246,1)' }
  ];

  const ctx = document.getElementById('mainChart').getContext('2d');
  if (chart) chart.destroy();
  chart = new Chart(ctx, {
    data: { labels: months, datasets },
    plugins: [valueLabelPlugin],
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 12, right: 8, bottom: 4, left: 4 } },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        valueLabels: { integer: false },
        datalabels: { display: false },
        legend: {
          display: true,
          position: 'bottom',
          align: 'center',
          labels: {
            color: typeof ChartTheme !== 'undefined' ? ChartTheme.text() : (Chart.defaults && Chart.defaults.color ? Chart.defaults.color : '#475569'),
            usePointStyle: true, pointStyle: 'circle',
            boxWidth: 8, boxHeight: 8,
            padding: 18,
            font: { size: 13, weight: '600' }
          },
          onClick: (e, legendItem, legend) => {
            const ci = legend.chart;
            const idx = legendItem.datasetIndex;
            const meta = ci.getDatasetMeta(idx);
            meta.hidden = meta.hidden === null ? !ci.data.datasets[idx].hidden : null;
            ci.update();
          }
        },
        tooltip: Object.assign({
          titleFont: { size: 13, weight: '600' }, bodyFont: { size: 13 },
          callbacks: {
            label: (c) => {
              const v = (c.parsed && c.parsed.y !== undefined) ? c.parsed.y : c.raw;
              if (v === null || v === undefined) return `${c.dataset.label}: —`;
              const isScore = c.dataset.label === 'Score médio';
              return `${c.dataset.label}: ${isScore ? Number(v).toFixed(2) : Math.round(v)}`;
            }
          }
        }, typeof ChartTheme !== 'undefined' ? ChartTheme.tooltip({ padding: 12, cornerRadius: 10 }) : {
          backgroundColor: 'rgba(15, 23, 42, 0.92)',
          titleColor: '#f8fafc', bodyColor: '#e2e8f0',
          borderColor: 'rgba(255,255,255,0.08)', borderWidth: 1,
          padding: 12, cornerRadius: 10, displayColors: true, boxPadding: 6
        })
      },
      scales: {
        y: { beginAtZero: true, position: 'left', grid: { color: typeof ChartTheme !== 'undefined' ? ChartTheme.grid() : 'rgba(148,163,184,0.14)' }, title: { display: true, text: 'Atendimentos', font: { size: 11.5, weight: '600' }, color: typeof ChartTheme !== 'undefined' ? ChartTheme.text() : undefined }, ticks: { callback: v => String(Math.round(v)), font: { size: 13 }, color: typeof ChartTheme !== 'undefined' ? ChartTheme.text() : undefined } },
        yScore: { beginAtZero: true, suggestedMin: 0, suggestedMax: 5, position: 'right', grid: { drawOnChartArea: false }, title: { display: true, text: 'Score médio (0–5)', font: { size: 11.5, weight: '600' }, color: typeof ChartTheme !== 'undefined' ? ChartTheme.text() : undefined }, ticks: { callback: v => Number(v).toFixed(1), font: { size: 13 }, color: typeof ChartTheme !== 'undefined' ? ChartTheme.text() : undefined } },
        x: { grid: { display: false }, ticks: { font: { size: 13 }, color: typeof ChartTheme !== 'undefined' ? ChartTheme.text() : undefined } }
      }
    }
  });
}

function drawBar(labels, data, label, opts = {}) {
  const integer = !!opts.integer;
  const prioritize = opts.prioritize || null;

  // If prioritize (an atendente name) is provided, move it first in labels/data
  if (prioritize) {
    const idx = labels.indexOf(prioritize);
    if (idx > 0) {
      const val = data[idx];
      labels.splice(idx, 1);
      data.splice(idx, 1);
      labels.unshift(prioritize);
      data.unshift(val);
    }
  }

  const ct = typeof ChartTheme !== 'undefined' ? ChartTheme : null;
  const neutralPalette = ct ? ct.neutralPalette(labels.length) : ['#2563eb','#059669','#d97706','#7c3aed','#ea580c','#0891b2','#e11d48','#8b5cf6','#16a34a','#f97316'];
  const bg = labels.map((_,i) => neutralPalette ? neutralPalette[i] || neutralPalette[neutralPalette.length-1] : (ct ? ct.blue() : `rgba(37,99,235,${Math.max(0.4, 0.9 - i*0.05)})`));
  sizeChartInnerForLabels(labels.length, 90);
  const cfg = {
    type: 'bar',
    data: { labels, datasets: [{ label, data, backgroundColor: bg }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 12, right: 8, bottom: 4, left: 4 } },
      plugins: {
        valueLabels: { integer },
        legend: { display: false },
        tooltip: Object.assign({
          titleFont: { size: 13, weight: '600' }, bodyFont: { size: 13 },
          callbacks: {
            label: (ctx) => {
              const v = ctx.parsed && ctx.parsed.y !== undefined ? ctx.parsed.y : ctx.raw;
              return `${ctx.dataset.label ? ctx.dataset.label + ': ' : ''}${integer ? String(Math.round(v)) : Number(v).toFixed(2)}`;
            }
          }
        }, ct ? ct.tooltip({ padding: 12, cornerRadius: 10 }) : {
          backgroundColor: 'rgba(15, 23, 42, 0.92)',
          titleColor: '#f8fafc', bodyColor: '#e2e8f0',
          borderColor: 'rgba(255,255,255,0.08)', borderWidth: 1,
          padding: 12, cornerRadius: 10, displayColors: true, boxPadding: 6
        })
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: ct ? ct.grid() : 'rgba(148,163,184,0.14)' },
          ticks: { callback: (v) => integer ? String(Math.round(v)) : Number(v).toFixed(2), font: { size: 13 }, color: ct ? ct.text() : undefined }
        },
        x: { grid: { display: false }, ticks: { font: { size: 13 }, color: ct ? ct.text() : undefined } }
      }
    }
  };
  replaceChart(cfg);
}

function drawLine(labels, data, label) {
  const ct = typeof ChartTheme !== 'undefined' ? ChartTheme : null;
  const cfg = {
    type: 'line',
    data: { labels, datasets: [{ label, data, borderColor: ct ? ct.blue() : 'rgba(37,99,235,1)', backgroundColor: ct ? (ct.isDark() ? 'rgba(96,165,250,0.15)' : 'rgba(37,99,235,0.1)') : 'rgba(37,99,235,0.1)', tension: 0.3, fill: true, pointBackgroundColor: ct ? ct.blue() : 'rgba(37,99,235,1)', pointRadius: 4 }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        tooltip: Object.assign({
          callbacks: {
            label: (ctx) => {
              const v = ctx.parsed && ctx.parsed.y !== undefined ? ctx.parsed.y : ctx.raw;
              return `${ctx.dataset.label ? ctx.dataset.label + ': ' : ''}${Number(v).toFixed(2)}`;
            }
          }
        }, ct ? ct.tooltip() : {})
      },
      scales: {
        y: { ticks: { callback: (v) => Number(v).toFixed(2), color: ct ? ct.text() : undefined } }
      }
    }
  };
  replaceChart(cfg);
}

function replaceChart(cfg) {
  if (!isChartAvailable()) {
    setChartEmpty(true, 'Gráfico indisponível: a biblioteca Chart.js não foi carregada.');
    return;
  }
  if (!cfg.plugins) cfg.plugins = [];
  // ensure our value label plugin is included
  if (!cfg.plugins.find(p => p && p.id === 'valueLabelPlugin')) cfg.plugins.push(valueLabelPlugin);
  if (chart) chart.destroy();
  chart = new Chart(ctx.getContext('2d'), cfg);
  // Attach click handler on canvas to allow hiding/restoring collaborators by label/bar click
  try {
    ctx.onclick = (evt) => {
      if (!chart) return;
      const points = chart.getElementsAtEventForMode(evt, 'nearest', { intersect: false }, true);
      if (!points || points.length === 0) return;
      const idx = points[0].index;
      const label = chart.data && chart.data.labels && chart.data.labels[idx];
      if (!label) return;
      if (hiddenLabels.has(label)) {
        if (confirm(`Restaurar colaborador "${label}"?`)) {
          hiddenLabels.delete(label);
          updateView();
        }
      } else {
        if (confirm(`Ocultar colaborador "${label}"?`)) {
          hiddenLabels.add(label);
          updateView();
        }
      }
    };
  } catch (e) {
    // ignore attach errors
  }
}


root.DashboardCharts = { render: renderChart };
})(window);
