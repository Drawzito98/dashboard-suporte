// Central de Insights — análises automáticas de tendências

function formatVar(val, suffix = '') {
  if (val === null || val === undefined) return '<span class="text-muted">—</span>';
  const cls = val >= 0 ? 'variation-pos' : 'variation-neg';
  const arrow = val >= 0 ? '↑' : '↓';
  return `<span class="${cls}" style="font-weight:600">${arrow} ${Math.abs(val).toFixed(1)}${suffix}</span>`;
}

function renderInsights() {
  const container = document.getElementById('insightsContent');
  if (!container) return;
  const data = _gfData();
  if (!data || !data.length) {
    container.innerHTML = '<div class="empty-state"><div class="empty-title">Nenhum dado carregado</div><div class="empty-sub">Importe um CSV para gerar insights.</div></div>';
    return;
  }

  const rows = data.filter(r => r && !isAggregateName(r['Atendente']));
  const meses = [...new Set(rows.map(r => r['Mês']))].filter(Boolean).sort();

  if (meses.length < 2) {
    container.innerHTML = '<div class="empty-state"><div class="empty-title">Dados insuficientes</div><div class="empty-sub">São necessários pelo menos 2 períodos para gerar insights comparativos.</div></div>';
    return;
  }

  const colaboradores = [...new Set(rows.map(r => r['Atendente']))].filter(Boolean).sort();
  const aliasMap = buildAliasMap(colaboradores);

  // Dados coletivos por mês
  const coletivo = {};
  meses.forEach(m => {
    const recs = rows.filter(r => String(r['Mês']) === m);
    const fin = recs.reduce((s, r) => s + (parseInt(r['Finalizados']) || 0), 0);
    const ass = recs.reduce((s, r) => s + (parseInt(r['Assumidos']) || 0), 0);
    const tra = recs.reduce((s, r) => s + (parseInt(r['Transferidos']) || 0), 0);
    const scores = recs.map(r => r['SCORE']).filter(v => v !== null && v !== undefined && !isNaN(Number(v)));
    const avgSc = scores.length ? scores.reduce((a, b) => a + Number(b), 0) / scores.length : 0;
    const cols = recs.length ? [...new Set(recs.map(r => r['Atendente']))].length : 0;
    const prod = ass > 0 ? fin / ass : 0;
    coletivo[m] = { fin, ass, tra, avgSc, cols, prod };
  });

  // Dados individuais por mês
  const ind = {};
  colaboradores.forEach(name => {
    const recs = rows.filter(r => String(r['Atendente']) === name);
    ind[name] = {};
    meses.forEach(m => {
      const r = recs.filter(x => String(x['Mês']) === m);
      const fin = r.reduce((s, x) => s + (parseInt(x['Finalizados']) || 0), 0);
      const ass = r.reduce((s, x) => s + (parseInt(x['Assumidos']) || 0), 0);
      const tra = r.reduce((s, x) => s + (parseInt(x['Transferidos']) || 0), 0);
      const scores = r.map(x => x['SCORE']).filter(v => v !== null && v !== undefined && !isNaN(Number(v)));
      const avgSc = scores.length ? scores.reduce((a, b) => a + Number(b), 0) / scores.length : 0;
      ind[name][m] = { fin, ass, tra, avgSc, prod: ass > 0 ? fin / ass : 0 };
    });
  });

  const ultimo = meses[meses.length - 1];
  const anterior = meses[meses.length - 2];

  const insights = [];
  const ult = coletivo[ultimo];
  const ant = coletivo[anterior];

  // ── 1. Insights de tendência (já existentes) ──
  // Finalizações
  if (ant.fin > 0) {
    const delta = ((ult.fin - ant.fin) / ant.fin) * 100;
    if (Math.abs(delta) > 10) {
      insights.push({
        tipo: delta > 0 ? 'positivo' : 'negativo', icone: delta > 0 ? '📈' : '📉',
        label: delta > 0 ? 'Crescimento de produtividade' : 'Queda de produtividade',
        texto: `${formatMesLabel(ultimo)} vs ${formatMesLabel(anterior)}: ${delta > 0 ? 'aumento' : 'queda'} de ${Math.abs(delta).toFixed(1)}% nas finalizações (${ant.fin} → ${ult.fin}).`
      });
    }
  }

  // Score
  if (ant.avgSc > 0) {
    const deltaSc = ult.avgSc - ant.avgSc;
    if (Math.abs(deltaSc) > 0.2) {
      insights.push({
        tipo: deltaSc > 0 ? 'positivo' : 'negativo', icone: deltaSc > 0 ? '⭐' : '⚠️',
        label: deltaSc > 0 ? 'Evolução de score' : 'Queda de score',
        texto: `${formatMesLabel(ultimo)} vs ${formatMesLabel(anterior)}: score médio ${deltaSc > 0 ? 'subiu' : 'caiu'} ${Math.abs(deltaSc).toFixed(2)} (${ant.avgSc.toFixed(2)} → ${ult.avgSc.toFixed(2)}).`
      });
    }
  }

  // Transferências
  if (ant.tra > 0) {
    const deltaTra = ((ult.tra - ant.tra) / ant.tra) * 100;
    if (Math.abs(deltaTra) > 20) {
      insights.push({
        tipo: deltaTra > 0 ? 'negativo' : 'positivo', icone: '🔄',
        label: deltaTra > 0 ? 'Aumento de transferências' : 'Queda de transferências',
        texto: `${formatMesLabel(ultimo)} vs ${formatMesLabel(anterior)}: transferências ${deltaTra > 0 ? 'subiram' : 'caíram'} ${Math.abs(deltaTra).toFixed(1)}%.`
      });
    }
  }

  // Tendência 3 meses
  if (meses.length >= 3) {
    const u3 = meses.slice(-3);
    const f = u3.map(m => coletivo[m].fin);
    const s = u3.map(m => coletivo[m].avgSc);
    const trend = f[2] - f[0];
    if (Math.abs(trend) > 0) {
      insights.push({
        tipo: trend > 0 ? 'positivo' : 'negativo', icone: trend > 0 ? '🚀' : '🔻',
        label: trend > 0 ? 'Tendência positiva' : 'Tendência negativa',
        texto: `Nos últimos 3 períodos, as finalizações têm tendência de ${trend > 0 ? 'alta' : 'queda'} (${trend > 0 ? '+' : ''}${trend}).`
      });
    }
    const st = s[2] - s[0];
    if (Math.abs(st) > 0.15) {
      insights.push({
        tipo: st > 0 ? 'positivo' : 'negativo', icone: '📊',
        label: st > 0 ? 'Score em alta' : 'Score em queda',
        texto: `Score médio ${st > 0 ? 'subiu' : 'caiu'} ${Math.abs(st).toFixed(2)} nos últimos 3 períodos.`
      });
    }
  }

  // ── 2. Cruzamento de métricas ──
  if (ant.fin > 0) {
    const deltaFinPct = ((ult.fin - ant.fin) / ant.fin) * 100;
    const deltaScVal = ult.avgSc - ant.avgSc;
    const deltaTraPct = ant.tra > 0 ? ((ult.tra - ant.tra) / ant.tra) * 100 : 0;

    // Finalizações subiram mas score caiu
    if (deltaFinPct > 10 && deltaScVal < -0.2) {
      insights.push({
        tipo: 'atencao', icone: '⚖️',
        label: 'Quantidade vs Qualidade',
        texto: `Finalizações subiram ${deltaFinPct.toFixed(0)}% mas o score caiu ${Math.abs(deltaScVal).toFixed(2)}. Pode ser que a velocidade esteja comprometendo a qualidade.`
      });
    }

    // Transferências altas podem estar impactando score
    if (deltaTraPct > 30 && deltaScVal < -0.1) {
      insights.push({
        tipo: 'atencao', icone: '🔄',
        label: 'Transferências impactando score?',
        texto: `Transferências subiram ${deltaTraPct.toFixed(0)}% e o score caiu ${Math.abs(deltaScVal).toFixed(2)}. Vale revisar se há relação.`
      });
    }

    // Cenário ideal: finalizações subiram e score também
    if (deltaFinPct > 10 && deltaScVal > 0.2) {
      insights.push({
        tipo: 'positivo', icone: '🏆',
        label: 'Cenário ideal',
        texto: `Quantidade e qualidade evoluíram juntas: +${deltaFinPct.toFixed(0)}% finalizações e +${deltaScVal.toFixed(2)} no score.`
      });
    }

    // Finalizações caíram mas score subiu
    if (deltaFinPct < -10 && deltaScVal > 0.2) {
      insights.push({
        tipo: 'neutro', icone: '🧠',
        label: 'Mais qualidade, menos volume',
        texto: `Score subiu ${deltaScVal.toFixed(2)} mesmo com ${Math.abs(deltaFinPct).toFixed(0)}% menos finalizações. Time pode estar mais focado em qualidade.`
      });
    }
  }

  // ── 3. Destaques individuais (melhor/pior em cada métrica no último mês) ──
  const destaques = { fin: { melhor: null, valor: -1 }, score: { melhor: null, valor: -1 }, prod: { melhor: null, valor: -1 } };
  colaboradores.forEach(name => {
    const d = ind[name][ultimo];
    if (!d) return;
    if (d.fin > destaques.fin.valor) { destaques.fin.melhor = name; destaques.fin.valor = d.fin; }
    if (d.avgSc > destaques.score.valor) { destaques.score.melhor = name; destaques.score.valor = d.avgSc; }
    if (d.prod > destaques.prod.valor) { destaques.prod.melhor = name; destaques.prod.valor = d.prod; }
  });

  let html = '';

  // ── Mini tabela de evolução do time ──
  html += `<h3 style="font-size:14px;font-weight:600;margin-bottom:var(--s-3);color:var(--text-strong)">📊 Evolução do Time</h3>`;
  html += `<div style="overflow-x:auto;margin-bottom:var(--s-5)"><table class="ranking-table" style="min-width:auto">
    <thead><tr><th>Mês</th><th>Finalizados</th><th>Δ</th><th>Score</th><th>Δ</th><th>Transferências</th><th>Δ</th><th>Prod.</th><th>Colabs</th></tr></thead>
    <tbody>${meses.map((m, i) => {
      const c = coletivo[m];
      const deltaFin = i > 0 && coletivo[meses[i - 1]].fin > 0
        ? ((c.fin - coletivo[meses[i - 1]].fin) / coletivo[meses[i - 1]].fin) * 100 : null;
      const deltaSc = i > 0 && coletivo[meses[i - 1]].avgSc > 0
        ? c.avgSc - coletivo[meses[i - 1]].avgSc : null;
      const deltaTra = i > 0 && coletivo[meses[i - 1]].tra > 0
        ? ((c.tra - coletivo[meses[i - 1]].tra) / coletivo[meses[i - 1]].tra) * 100 : null;
      return `<tr>
        <td><strong>${formatMesLabel(m)}</strong></td>
        <td>${c.fin}</td>
        <td>${formatVar(deltaFin, '%')}</td>
        <td>${c.avgSc > 0 ? c.avgSc.toFixed(2) : '—'}</td>
        <td>${deltaSc !== null ? formatVar(deltaSc) : '<span class="text-muted">—</span>'}</td>
        <td>${c.tra}</td>
        <td>${formatVar(deltaTra, '%')}</td>
        <td>${(c.prod * 100).toFixed(1)}%</td>
        <td>${c.cols}</td>
      </tr>`;
    }).join('')}</tbody>
  </table></div>`;

  // ── Cards de desempenho (melhores do mês) ──
  html += `<h3 style="font-size:14px;font-weight:600;margin-bottom:var(--s-3);color:var(--text-strong)">🏅 Destaques do Período (${formatMesLabel(ultimo)})</h3>`;
  html += `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:var(--s-3);margin-bottom:var(--s-5)">`;

  const cardDefs = [
    { key: 'fin', label: 'Mais finalizações', icon: '📦' },
    { key: 'score', label: 'Maior score', icon: '⭐' },
    { key: 'prod', label: 'Maior produtividade', icon: '🎯' },
  ];
  cardDefs.forEach(def => {
    const d = destaques[def.key];
    const nome = d.melhor ? escapeHtml(getDisplayName(d.melhor, aliasMap)) : '—';
    const valor = d.valor > 0 ? (def.key === 'prod' ? (d.valor * 100).toFixed(0) + '%' : def.key === 'score' ? d.valor.toFixed(2) : d.valor.toLocaleString('pt-BR')) : '—';
    html += `<div style="padding:var(--s-4);border:1px solid var(--border);border-radius:var(--r-lg);background:var(--accent-soft);text-align:center">
      <div style="font-size:18px;margin-bottom:4px">${def.icon}</div>
      <div style="font-size:13px;color:var(--text-secondary)">${def.label}</div>
      <div style="font-size:18px;font-weight:700;color:var(--text-strong);margin-top:4px">${nome}</div>
      <div style="font-size:13px;color:var(--accent);font-weight:600">${valor}</div>
    </div>`;
  });
  html += `</div>`;

  // ── Lista de insights ──
  html += `<h3 style="font-size:14px;font-weight:600;margin-bottom:var(--s-3);color:var(--text-strong)">💡 Insights</h3>`;

  if (!insights.length) {
    html += '<div style="padding:var(--s-4);border:1px solid var(--border);border-radius:var(--r-md);background:var(--bg-surface);color:var(--text-muted);font-size:13px">Nenhum insight significativo — os dados estão estáveis.</div>';
  } else {
    html += insights.map(ins => {
      let bg, border;
      if (ins.tipo === 'positivo') { bg = 'var(--success-soft)'; border = 'var(--success)'; }
      else if (ins.tipo === 'negativo') { bg = 'var(--danger-soft)'; border = 'var(--danger)'; }
      else { bg = 'var(--bg-surface)'; border = 'var(--border)'; }
      return `<div style="display:flex;align-items:flex-start;gap:var(--s-3);padding:var(--s-4);border:1px solid ${border};border-radius:var(--r-md);background:${bg};margin-bottom:var(--s-2)">
        <span style="font-size:18px;line-height:1">${ins.icone}</span>
        <div style="flex:1">
          <div style="font-weight:600;font-size:13px;color:var(--text-strong);margin-bottom:2px">${ins.label}</div>
          <div style="font-size:13px;color:var(--text-secondary);line-height:1.5">${escapeHtml(ins.texto)}</div>
        </div>
      </div>`;
    }).join('');
  }

  container.innerHTML = html;
}

function onInsightsTabActivated() {
  renderInsights();
}
