// Projeções — previsões simples baseadas em histórico
// Módulo independente, não altera lógica existente

function _gfData() {
  return typeof globalFilters !== 'undefined' && globalFilters ? globalFilters.aplicar(rawRecords) : (rawRecords || []);
}

function renderProjecoes() {
  const data = _gfData();
  if (!data || !data.length) {
    return '<div class="empty-state"><div class="empty-title">Sem dados</div><div class="empty-sub">Importe um CSV primeiro.</div></div>';
  }

  const rows = (data).filter(r => r && !isAggregateName(r['Atendente']));
  const meses = [...new Set(rows.map(r => r['Mês']))].filter(Boolean).sort();
  if (meses.length < 2) {
    return '<div class="empty-state"><div class="empty-title">Dados insuficientes</div><div class="empty-sub">São necessários pelo menos 2 períodos para calcular projeções.</div></div>';
  }

  // Calcular médias móveis
  const porMes = {};
  meses.forEach(m => {
    const recs = rows.filter(r => String(r['Mês']) === m);
    const fin = recs.reduce((s, r) => s + (parseInt(r['Finalizados']) || 0), 0);
    const ass = recs.reduce((s, r) => s + (parseInt(r['Assumidos']) || 0), 0);
    const scores = recs.map(r => r['SCORE']).filter(v => v !== null && v !== undefined && !isNaN(Number(v)));
    const avgSc = scores.length ? scores.reduce((a, b) => a + Number(b), 0) / scores.length : 0;
    porMes[m] = { fin, ass, avgSc };
  });

  // Projeção linear simples baseada nos últimos 3 meses ou 2 se não houver 3
  const ultimos = Object.keys(porMes).slice(-Math.min(3, Object.keys(porMes).length));
  const valsFin = ultimos.map(m => porMes[m].fin);
  const valsScore = ultimos.map(m => porMes[m].avgSc);

  const mediaMovelFin = valsFin.reduce((s, v) => s + v, 0) / valsFin.length;
  const mediaMovelScore = valsScore.reduce((s, v) => s + v, 0) / valsScore.length;

  // Tendência (diferença entre último e primeiro do período analisado)
  const tendenciaFin = valsFin.length >= 2 ? valsFin[valsFin.length - 1] - valsFin[0] : 0;
  const tendenciaScore = valsScore.length >= 2 ? valsScore[valsScore.length - 1] - valsScore[0] : 0;

  // Projeção para próximo período
  const passos = valsFin.length;
  const mediaDelta = passos > 1 ? tendenciaFin / (passos - 1) : 0;
  const projFin = Math.round(mediaMovelFin + mediaDelta);
  const projScore = Math.min(5, Math.max(0, mediaMovelScore + (tendenciaScore / Math.max(1, passos - 1))));

  // Colaborador com maior potencial de crescimento
  const cols = [...new Set(rows.map(r => r['Atendente']))].filter(Boolean);
  let maiorPotencial = { nome: '', delta: 0 };
  cols.forEach(name => {
    const recs = rows.filter(r => String(r['Atendente']) === name);
    const mesesC = [...new Set(recs.map(r => r['Mês']))].filter(Boolean).sort();
    if (mesesC.length < 2) return;
    const finUlt = recs.filter(r => String(r['Mês']) === mesesC[mesesC.length - 1]).reduce((s, r) => s + (parseInt(r['Finalizados']) || 0), 0);
    const finAnt = recs.filter(r => String(r['Mês']) === mesesC[mesesC.length - 2]).reduce((s, r) => s + (parseInt(r['Finalizados']) || 0), 0);
    const delta = finUlt - finAnt;
    if (delta > maiorPotencial.delta) {
      maiorPotencial = { nome: name, delta };
    }
  });

  // Score previsto por colaborador
  const aliasMap = buildAliasMap(cols);

  let html = `
    <div class="intel-report-header" style="margin-bottom:var(--s-4)">
      <h3 style="font-size:15px;font-weight:600;color:var(--text-strong);margin:0">🔮 Projeções</h3>
      <span style="font-size:11px;color:var(--text-muted)">Baseado nos últimos ${ultimos.length} períodos</span>
    </div>
    <div class="comp-grid">
      <div class="comp-card">
        <div class="comp-card-header"><h3>Finalizações</h3><p>Previsto para o próximo período</p></div>
        <div style="text-align:center;padding:var(--s-4)">
          <div style="font-size:36px;font-weight:700;color:var(--accent);letter-spacing:-0.03em">${projFin.toLocaleString('pt-BR')}</div>
          <div style="font-size:13px;color:var(--text-secondary);margin-top:4px">Média móvel: ${mediaMovelFin.toFixed(0)}</div>
          <div style="font-size:12px;color:var(--text-muted);margin-top:2px">Tendência: ${tendenciaFin >= 0 ? '+' : ''}${tendenciaFin} unidades</div>
        </div>
      </div>
      <div class="comp-card">
        <div class="comp-card-header"><h3>Score Médio</h3><p>Previsto para o próximo período</p></div>
        <div style="text-align:center;padding:var(--s-4)">
          <div style="font-size:36px;font-weight:700;color:var(--accent);letter-spacing:-0.03em">${projScore.toFixed(2)}</div>
          <div style="font-size:13px;color:var(--text-secondary);margin-top:4px">Média móvel: ${mediaMovelScore.toFixed(2)}</div>
          <div style="font-size:12px;color:var(--text-muted);margin-top:2px">Tendência: ${tendenciaScore >= 0 ? '+' : ''}${tendenciaScore.toFixed(2)}</div>
        </div>
      </div>
    </div>`;

  // Projeções individuais
  html += `<div style="margin-top:var(--s-4)">
    <h3 style="font-size:13px;font-weight:600;margin-bottom:var(--s-3);color:var(--text-strong)">📊 Projeções Individuais</h3>
    <div style="overflow-x:auto"><table class="ranking-table">
      <thead><tr><th>Colaborador</th><th>Média Finalizações</th><th>Projeção</th><th>Tendência</th><th>Score previsto</th></tr></thead>
      <tbody>${cols.sort().map(name => {
        const recs = rows.filter(r => String(r['Atendente']) === name);
        const mesesC = [...new Set(recs.map(r => r['Mês']))].filter(Boolean).sort();
        if (mesesC.length < 2) return '';
        const vals = mesesC.map(m => recs.filter(r => String(r['Mês']) === m).reduce((s, r) => s + (parseInt(r['Finalizados']) || 0), 0));
        const scores = mesesC.map(m => {
          const sc = recs.filter(r => String(r['Mês']) === m).map(r => r['SCORE']).filter(v => v !== null && v !== undefined && !isNaN(Number(v)));
          return sc.length ? sc.reduce((a, b) => a + Number(b), 0) / sc.length : 0;
        });
        const mediaVals = vals.reduce((s, v) => s + v, 0) / vals.length;
        const deltaVals = vals.length >= 2 ? vals[vals.length - 1] - vals[0] : 0;
        const proj = Math.round(mediaVals + (deltaVals / Math.max(1, vals.length - 1)));
        const scMedia = scores.reduce((s, v) => s + v, 0) / scores.length;
        const scUltimo = scores[scores.length - 1];
        const scDelta = scores.length >= 2 ? scores[scores.length - 1] - scores[0] : 0;
        const scProj = Math.min(5, Math.max(0, scMedia + (scDelta / Math.max(1, scores.length - 1))));
        const tendencia = deltaVals >= 0 ? `📈 +${deltaVals}` : `📉 ${deltaVals}`;
        return `<tr>
          <td><strong>${escapeHtml(getDisplayName(name, aliasMap))}</strong></td>
          <td>${mediaVals.toFixed(0)}</td>
          <td><strong>${proj > 0 ? proj : '—'}</strong></td>
          <td style="font-size:12px">${tendencia}</td>
          <td>${scProj > 0 ? scProj.toFixed(2) : '—'}</td>
        </tr>`;
      }).filter(Boolean).join('')}</tbody>
    </table></div>
  </div>`;

  return html;
}

function openTendencias() {
  const btn = document.querySelector('.tab-btn[data-tab="insights"]');
  if (btn) btn.click();
}
