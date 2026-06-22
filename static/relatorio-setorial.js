// Relatório Setorial — visão completa por setor, mês a mês

function _rsData() {
  if (typeof getCurrentFilteredRows === 'function') return getCurrentFilteredRows();
  if (typeof globalFilters !== 'undefined' && globalFilters) return globalFilters.aplicar(rawRecords || []);
  return rawRecords || [];
}

function getFilteredMeses(rows) {
  // Se getActiveMonths existir (app.js carregado), usa o filtro período ativo
  if (typeof getActiveMonths === 'function') {
    const ativos = getActiveMonths();
    if (ativos.length) return ativos;
  }
  // Fallback: últimos 6 meses dos dados
  const meses = [...new Set((rows || []).filter(r => r && r['Mês']).map(r => r['Mês']))].filter(Boolean).sort();
  return meses.slice(-6);
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

  // Agrupar por setor
  const bySetor = {};
  rows.forEach(r => {
    const s = String(r['Setor'] || '').trim() || '(sem setor)';
    if (!bySetor[s]) bySetor[s] = [];
    bySetor[s].push(r);
  });
  const setores = Object.keys(bySetor).sort();

  // Totais gerais
  const totalFin = rows.reduce((s, r) => s + (parseInt(r['Finalizados']) || 0), 0);
  const totalAss = rows.reduce((s, r) => s + (parseInt(r['Assumidos']) || 0), 0);
  const totalTra = rows.reduce((s, r) => s + (parseInt(r['Transferidos']) || 0), 0);
  const scores = rows.map(r => r['SCORE']).filter(v => v !== null && v !== undefined && !isNaN(Number(v)));
  const avgScore = scores.length ? scores.reduce((a, b) => a + Number(b), 0) / scores.length : 0;
  const prodGeral = totalAss > 0 ? totalFin / totalAss : 0;
  const traGeral = totalAss > 0 ? totalTra / totalAss : 0;

  const fmtNum = n => (Number(n) || 0).toLocaleString('pt-BR');
  const fmtScore = n => n > 0 ? n.toFixed(2) : '—';
  const fmtPct = n => n !== null && n !== undefined ? (n * 100).toFixed(1) + '%' : '—';

  let html = '';

  // Header + Print button
  html += `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--s-5);flex-wrap:wrap;gap:var(--s-3)">
    <div>
      <h2 style="font-size:18px;font-weight:700;color:var(--text-strong);margin:0">📊 Relatório Setorial</h2>
      <p style="font-size:13px;color:var(--text-secondary);margin-top:2px">${meses.length} meses · ${setores.length} setores · ${meses[0]} a ${meses[meses.length - 1]}</p>
    </div>
    <button class="btn-primary" id="rsPrintBtn" type="button">🖨️ Exportar PNG</button>
  </div>`;

  // KPIs gerais
  html += `<div class="gamification-stats" style="margin-bottom:var(--s-5)">
    <div class="kpi"><div class="label">Finalizados</div><div class="value">${fmtNum(totalFin)}</div></div>
    <div class="kpi"><div class="label">Assumidos</div><div class="value">${fmtNum(totalAss)}</div></div>
    <div class="kpi"><div class="label">Transferidos</div><div class="value">${fmtNum(totalTra)} (${fmtPct(traGeral)})</div></div>
    <div class="kpi"><div class="label">Score médio</div><div class="value">${fmtScore(avgScore)}</div></div>
    <div class="kpi"><div class="label">Produtividade</div><div class="value">${fmtPct(prodGeral)}</div></div>
    <div class="kpi"><div class="label">Setores</div><div class="value">${setores.length}</div></div>
  </div>`;

  // Tabela comparativa entre setores (totais do período)
  html += `<h3 style="font-size:15px;font-weight:600;margin-bottom:var(--s-3);color:var(--text-strong)">🔁 Comparativo entre Setores</h3>`;
  html += `<div style="overflow-x:auto;margin-bottom:var(--s-5)"><table class="ranking-table">
    <thead><tr><th>Setor</th><th>Finalizados</th><th>Assumidos</th><th>Transferidos</th><th>Score</th><th>Prod.</th><th>Colabs</th></tr></thead>
    <tbody>${setores.map(s => {
      const recs = bySetor[s];
      const fin = recs.reduce((a, r) => a + (parseInt(r['Finalizados']) || 0), 0);
      const ass = recs.reduce((a, r) => a + (parseInt(r['Assumidos']) || 0), 0);
      const tra = recs.reduce((a, r) => a + (parseInt(r['Transferidos']) || 0), 0);
      const sc = recs.map(r => r['SCORE']).filter(v => v !== null && v !== undefined && !isNaN(Number(v)));
      const scAvg = sc.length ? sc.reduce((a, b) => a + Number(b), 0) / sc.length : 0;
      const prod = ass > 0 ? fin / ass : 0;
      const colabs = [...new Set(recs.map(r => r['Atendente']))].filter(Boolean).length;
      const classeSc = scAvg > 0 ? getClasseScore(scAvg) : '';
      return `<tr>
        <td><strong>${escapeHtml(s)}</strong></td>
        <td>${fmtNum(fin)}</td>
        <td>${fmtNum(ass)}</td>
        <td>${fmtNum(tra)}</td>
        <td class="score-cell ${classeSc}">${fmtScore(scAvg)}</td>
        <td>${fmtPct(prod)}</td>
        <td>${colabs}</td>
      </tr>`;
    }).join('')}</tbody>
  </table></div>`;

  // Detalhamento por setor — mês a mês
  html += `<h3 style="font-size:15px;font-weight:600;margin-bottom:var(--s-3);color:var(--text-strong)">📋 Detalhamento por Setor</h3>`;

  setores.forEach(s => {
    const recs = bySetor[s];
    const fin = recs.reduce((a, r) => a + (parseInt(r['Finalizados']) || 0), 0);
    const ass = recs.reduce((a, r) => a + (parseInt(r['Assumidos']) || 0), 0);
    const tra = recs.reduce((a, r) => a + (parseInt(r['Transferidos']) || 0), 0);
    const sc = recs.map(r => r['SCORE']).filter(v => v !== null && v !== undefined && !isNaN(Number(v)));
    const scAvg = sc.length ? sc.reduce((a, b) => a + Number(b), 0) / sc.length : 0;
    const prod = ass > 0 ? fin / ass : 0;

    html += `<div class="card" style="margin-bottom:var(--s-4);padding:var(--s-5)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--s-4);flex-wrap:wrap;gap:var(--s-2)">
        <div>
          <h3 style="font-size:16px;font-weight:700;color:var(--text-strong);margin:0">${escapeHtml(s)}</h3>
          <span style="font-size:12px;color:var(--text-secondary)">Total: ${fmtNum(fin)} fin · Score ${fmtScore(scAvg)} · Prod ${fmtPct(prod)}</span>
        </div>
      </div>
      <div style="overflow-x:auto"><table class="ranking-table" style="min-width:500px">
        <thead><tr>
          <th style="position:sticky;top:0;background:var(--bg-elevated)">Mês</th>
          <th style="position:sticky;top:0;background:var(--bg-elevated)">Finalizados</th>
          <th style="position:sticky;top:0;background:var(--bg-elevated)">Assumidos</th>
          <th style="position:sticky;top:0;background:var(--bg-elevated)">Transferidos</th>
          <th style="position:sticky;top:0;background:var(--bg-elevated)">Score</th>
          <th style="position:sticky;top:0;background:var(--bg-elevated)">Prod.</th>
          <th style="position:sticky;top:0;background:var(--bg-elevated)">Colabs</th>
        </tr></thead>
        <tbody>${meses.map(m => {
          const mRecs = recs.filter(r => String(r['Mês']) === m);
          if (!mRecs.length) return `<tr><td>${m}</td><td colspan="6" style="color:var(--text-muted);font-size:12px">Sem dados</td></tr>`;
          const mFin = mRecs.reduce((a, r) => a + (parseInt(r['Finalizados']) || 0), 0);
          const mAss = mRecs.reduce((a, r) => a + (parseInt(r['Assumidos']) || 0), 0);
          const mTra = mRecs.reduce((a, r) => a + (parseInt(r['Transferidos']) || 0), 0);
          const mSc = mRecs.map(r => r['SCORE']).filter(v => v !== null && v !== undefined && !isNaN(Number(v)));
          const mScAvg = mSc.length ? mSc.reduce((a, b) => a + Number(b), 0) / mSc.length : 0;
          const mProd = mAss > 0 ? mFin / mAss : 0;
          const mCols = [...new Set(mRecs.map(r => r['Atendente']))].filter(Boolean).length;
          const cls = mScAvg > 0 ? getClasseScore(mScAvg) : '';
          return `<tr>
            <td><strong>${m}</strong></td>
            <td>${fmtNum(mFin)}</td>
            <td>${fmtNum(mAss)}</td>
            <td>${fmtNum(mTra)}</td>
            <td class="score-cell ${cls}">${fmtScore(mScAvg)}</td>
            <td>${fmtPct(mProd)}</td>
            <td>${mCols}</td>
          </tr>`;
        }).join('')}</tbody>
      </table></div>
    </div>`;
  });

  container.innerHTML = html;

  // Print/Export PNG
  const printBtn = document.getElementById('rsPrintBtn');
  if (printBtn && typeof html2canvas !== 'undefined') {
    printBtn.addEventListener('click', () => {
      const target = container;
      html2canvas(target, {
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
        showToast('Erro ao exportar. Tente novamente.', 'error');
      });
    });
  }
}

function onRelatorioSetorialTabActivated() {
  renderRelatorioSetorial();
}
