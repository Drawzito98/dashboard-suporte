// Relatório Setorial — visão completa por setor, mês a mês

function _rsData() {
  if (typeof getCurrentFilteredRows === 'function') return getCurrentFilteredRows();
  if (typeof globalFilters !== 'undefined' && globalFilters) return globalFilters.aplicar(rawRecords || []);
  return rawRecords || [];
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

function renderRelatorioSetorial() {
  const container = document.getElementById('relatorioSetorialContent');
  if (!container) return;
  const data = _rsData();
  if (!data || !data.length) {
    container.innerHTML = '<div class="empty-state"><div class="empty-title">Nenhum dado carregado</div><div class="empty-sub">Importe dados para gerar o relatório setorial.</div></div>';
    return;
  }

  const rows = data.filter(r => r && !isAggregateName(r['Atendente']));
  const meses = getFilteredMeses(rows);
  if (!meses.length) {
    container.innerHTML = '<div class="empty-state"><div class="empty-title">Sem períodos</div><div class="empty-sub">Nenhum mês encontrado no filtro atual.</div></div>';
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
  const scores = rows.map(r => r['SCORE']).filter(v => v !== null && v !== undefined && !isNaN(Number(v)));
  const avgScore = scores.length ? scores.reduce((a, b) => a + Number(b), 0) / scores.length : 0;
  const prodGeral = totalAss > 0 ? totalFin / totalAss : 0;
  const traGeral = totalAss > 0 ? totalTra / totalAss : 0;

  const fmtNum = n => (Number(n) || 0).toLocaleString('pt-BR');
  const fmtScore = n => n > 0 ? n.toFixed(2) : '\u2014';
  const fmtPct = n => n !== null && n !== undefined ? (n * 100).toFixed(1) + '%' : '\u2014';

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

  let html = '';

  // ── Header ──
  html += `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--s-5);flex-wrap:wrap;gap:var(--s-3)">
    <div>
      <h2 style="font-size:18px;font-weight:700;color:var(--text-strong);margin:0">\uD83D\uDCCA Relatório Setorial</h2>
      <p style="font-size:13px;color:var(--text-secondary);margin-top:2px">${meses.length} meses \u00B7 ${setores.length} setores \u00B7 ${meses[0]} a ${meses[meses.length - 1]}</p>
    </div>
    <button class="btn-primary" id="rsPrintBtn" type="button">\uD83D\uDDA8\uFE0F Exportar PNG</button>
  </div>`;

  // ── KPIs gerais ──
  html += `<div class="gamification-stats" style="margin-bottom:var(--s-5)">
    <div class="kpi"><div class="label">Finalizados</div><div class="value">${fmtNum(totalFin)}</div></div>
    <div class="kpi"><div class="label">Assumidos</div><div class="value">${fmtNum(totalAss)}</div></div>
    <div class="kpi"><div class="label">Transferidos</div><div class="value">${fmtNum(totalTra)} (${fmtPct(traGeral)})</div></div>
    <div class="kpi"><div class="label">Score médio</div><div class="value ${avgScore > 0 ? getClasseScore(avgScore) : ''}">${fmtScore(avgScore)}</div></div>
    <div class="kpi"><div class="label">Produtividade</div><div class="value">${fmtPct(prodGeral)}</div></div>
    <div class="kpi"><div class="label">Setores</div><div class="value">${setores.length}</div></div>
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

  if (destaques.length || atencao.length) {
    html += `<div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--s-4);margin-bottom:var(--s-5)">`;
    if (destaques.length) {
      html += `<div class="card" style="padding:var(--s-4)">
        <h3 style="font-size:13px;font-weight:600;margin-bottom:var(--s-3);color:var(--success)">\u2705 Destaques</h3>
        <ul style="margin:0;padding-left:var(--s-4);font-size:13px;color:var(--text-primary);line-height:1.8">
          ${destaques.map(d => `<li>${d}</li>`).join('')}
        </ul>
      </div>`;
    }
    if (atencao.length) {
      html += `<div class="card" style="padding:var(--s-4)">
        <h3 style="font-size:13px;font-weight:600;margin-bottom:var(--s-3);color:var(--danger)">\u26A0\uFE0F Pontos de Atenção</h3>
        <ul style="margin:0;padding-left:var(--s-4);font-size:13px;color:var(--text-primary);line-height:1.8">
          ${atencao.map(a => `<li>${a}</li>`).join('')}
        </ul>
      </div>`;
    }
    html += `</div>`;
  }

  // ── Gráfico de pizza — distribuição de finalizados por setor ──
  html += `<div style="display:flex;gap:var(--s-5);align-items:stretch;margin-bottom:var(--s-5);flex-wrap:wrap">
    <div class="card" style="flex:1;min-width:280px;padding:var(--s-4)">
      <h3 style="font-size:14px;font-weight:600;margin-bottom:var(--s-3);color:var(--text-strong)">\uD83C\uDF7E Distribuição por Setor</h3>
      <p style="font-size:12px;color:var(--text-secondary);margin-bottom:var(--s-3)">Participação de cada setor no total de finalizados</p>
      <div style="height:240px"><canvas id="rsPieChart"></canvas></div>
    </div>
    <div class="card" style="flex:1;min-width:200px;padding:var(--s-4);display:flex;flex-direction:column;justify-content:center;gap:var(--s-2)">
      ${setorMetrics.slice().sort((a, b) => b.fin - a.fin).map(s => {
        const pct = totalFin > 0 ? ((s.fin / totalFin) * 100).toFixed(1) : 0;
        const cor = totalFin > 0 ? `hsl(${Math.round(setorMetrics.indexOf(s) * 360 / setorMetrics.length)}, 60%, 55%)` : '#888';
        return `<div style="display:flex;align-items:center;gap:var(--s-3);font-size:13px">
          <span style="width:10px;height:10px;border-radius:50%;background:${cor};flex-shrink:0"></span>
          <span style="flex:1;font-weight:500;color:var(--text-primary)">${escapeHtml(s.nome)}</span>
          <span style="color:var(--text-secondary)">${fmtNum(s.fin)}</span>
          <span style="font-weight:600;color:var(--text-strong);min-width:40px;text-align:right">${pct}%</span>
        </div>`;
      }).join('')}
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
          <th style="position:sticky;top:0;background:var(--bg-elevated)">Finalizados</th>
          <th style="position:sticky;top:0;background:var(--bg-elevated)">Assumidos</th>
          <th style="position:sticky;top:0;background:var(--bg-elevated)">Transferidos</th>
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
            <td>${fmtNum(md.fin)}${dFin}</td>
            <td>${fmtNum(md.ass)}${dAss}</td>
            <td>${fmtNum(md.tra)}${dTra}</td>
            <td class="score-cell ${cls}">${fmtScore(md.scAvg)}${dSc}</td>
            <td>${fmtPct(md.prod)}${dProd}</td>
            <td>${md.cols}</td>
          </tr>`;
        }).join('')}</tbody>
      </table></div>
      <div style="margin-top:var(--s-4);height:160px">
        <canvas id="rsChart_${setorIdx}"></canvas>
      </div>
    </div>`;
  });

  container.innerHTML = html;

  // ── Renderizar gráficos ──
  if (typeof Chart !== 'undefined') {
    if (!window.__rsCharts) window.__rsCharts = {};
    Object.values(window.__rsCharts).forEach(c => { try { c.destroy(); } catch (e) {} });
    window.__rsCharts = {};

    // Pie chart — distribuição por setor
    const pieCanvas = document.getElementById('rsPieChart');
    if (pieCanvas) {
      const sorted = setorMetrics.slice().sort((a, b) => b.fin - a.fin);
      window.__rsCharts.pieChart = new Chart(pieCanvas.getContext('2d'), {
        type: 'doughnut',
        data: {
          labels: sorted.map(s => s.nome),
          datasets: [{
            data: sorted.map(s => s.fin),
            backgroundColor: sorted.map(s => `hsl(${Math.round(setorMetrics.indexOf(s) * 360 / setorMetrics.length)}, 60%, 55%)`),
            borderColor: '#1e293b',
            borderWidth: 2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '55%',
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: ctx => {
                  const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                  const pct = total > 0 ? ((ctx.parsed / total) * 100).toFixed(1) : 0;
                  return ` ${ctx.label}: ${ctx.parsed.toLocaleString('pt-BR')} (${pct}%)`;
                }
              }
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

      window.__rsCharts[`chart_${setorIdx}`] = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: monthData.map(d => d.label),
          datasets: [
            {
              label: 'Finalizados',
              data: monthData.map(d => d.fin),
              backgroundColor: 'rgba(16,185,129,0.7)',
              yAxisID: 'y',
              order: 2
            },
            {
              label: 'Score médio',
              data: monthData.map(d => d.sc),
              type: 'line',
              borderColor: 'rgba(99,102,241,1)',
              backgroundColor: 'rgba(99,102,241,0.1)',
              tension: 0.3,
              fill: true,
              pointRadius: 3,
              yAxisID: 'y1',
              order: 1
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: true,
              position: 'bottom',
              labels: { usePointStyle: true, boxWidth: 8, boxHeight: 8, padding: 12, font: { size: 10.5 } }
            },
            tooltip: {
              callbacks: {
                label: ctx => ctx.dataset.label + ': ' + (ctx.dataset.yAxisID === 'y1' ? ctx.parsed.y.toFixed(2) : ctx.parsed.y.toLocaleString('pt-BR'))
              }
            }
          },
          scales: {
            y: { beginAtZero: true, position: 'left', grid: { color: 'rgba(148,163,184,0.12)' }, ticks: { font: { size: 10 } } },
            y1: { beginAtZero: true, suggestedMax: 5, position: 'right', grid: { display: false }, ticks: { font: { size: 10 } } },
            x: { grid: { display: false }, ticks: { font: { size: 10 } } }
          }
        }
      });
    });
  }

  // ── Exportar PNG ──
  const printBtn = document.getElementById('rsPrintBtn');
  if (printBtn && typeof html2canvas !== 'undefined') {
    printBtn.addEventListener('click', () => {
      html2canvas(container, {
        scale: 2,
        backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--bg-surface').trim() || '#1e293b',
        allowTaint: false,
        useCORS: true,
        logging: false
      }).then(canvas => {
        const link = document.createElement('a');
        link.download = `relatorio-setorial-${meses[0]}-a-${meses[meses.length - 1]}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
      }).catch(() => {
        if (typeof showToast === 'function') showToast('Erro ao exportar. Tente novamente.', 'error');
      });
    });
  }
}

function onRelatorioSetorialTabActivated() {
  renderRelatorioSetorial();
}
