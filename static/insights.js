// Central de Insights — análises automáticas de tendências
// Módulo independente, não altera lógica existente

function _gfData() {
  return typeof globalFilters !== 'undefined' && globalFilters ? globalFilters.aplicar(rawRecords) : (rawRecords || []);
}

function renderInsights() {
  const container = document.getElementById('insightsContent');
  if (!container) return;
  const data = _gfData();
  if (!data || !data.length) {
    container.innerHTML = '<div class="empty-state"><div class="empty-title">Nenhum dado carregado</div><div class="empty-sub">Importe um CSV para gerar insights.</div></div>';
    return;
  }

  const rows = (data).filter(r => r && !isAggregateName(r['Atendente']));
  const meses = [...new Set(rows.map(r => r['Mês']))].filter(Boolean).sort();

  if (meses.length < 2) {
    container.innerHTML = '<div class="empty-state"><div class="empty-title">Dados insuficientes</div><div class="empty-sub">São necessários pelo menos 2 períodos para gerar insights comparativos.</div></div>';
    return;
  }

  const coletivo = {};
  meses.forEach(m => {
    const recs = rows.filter(r => String(r['Mês']) === m);
    const fin = recs.reduce((s, r) => s + (parseInt(r['Finalizados']) || 0), 0);
    const ass = recs.reduce((s, r) => s + (parseInt(r['Assumidos']) || 0), 0);
    const tra = recs.reduce((s, r) => s + (parseInt(r['Transferidos']) || 0), 0);
    const scores = recs.map(r => r['SCORE']).filter(v => v !== null && v !== undefined && !isNaN(Number(v)));
    const avgSc = scores.length ? scores.reduce((a, b) => a + Number(b), 0) / scores.length : 0;
    const cols = [...new Set(recs.map(r => r['Atendente']))].length;
    coletivo[m] = { fin, ass, tra, avgSc, cols };
  });

  const insights = [];

  // Crescimento / Queda de finalizações
  for (let i = 1; i < meses.length; i++) {
    const atual = coletivo[meses[i]];
    const anterior = coletivo[meses[i - 1]];
    if (!atual || !anterior || anterior.fin === 0) continue;
    const delta = ((atual.fin - anterior.fin) / anterior.fin) * 100;
    if (delta > 10) {
      insights.push({
        tipo: 'positivo',
        icone: '📈',
        label: 'Crescimento de produtividade',
        texto: `${formatMesLabel(meses[i])} vs ${formatMesLabel(meses[i - 1])}: aumento de ${delta.toFixed(1)}% nas finalizações (${anterior.fin} → ${atual.fin}).`
      });
    } else if (delta < -10) {
      insights.push({
        tipo: 'negativo',
        icone: '📉',
        label: 'Queda de produtividade',
        texto: `${formatMesLabel(meses[i])} vs ${formatMesLabel(meses[i - 1])}: queda de ${Math.abs(delta).toFixed(1)}% nas finalizações (${anterior.fin} → ${atual.fin}).`
      });
    }
  }

  // Evolução de score
  for (let i = 1; i < meses.length; i++) {
    const atual = coletivo[meses[i]];
    const anterior = coletivo[meses[i - 1]];
    if (!atual || !anterior || anterior.avgSc === 0) continue;
    const delta = atual.avgSc - anterior.avgSc;
    if (delta > 0.2) {
      insights.push({
        tipo: 'positivo',
        icone: '⭐',
        label: 'Evolução de score',
        texto: `${formatMesLabel(meses[i])} vs ${formatMesLabel(meses[i - 1])}: score médio subiu ${delta.toFixed(2)} (${anterior.avgSc.toFixed(2)} → ${atual.avgSc.toFixed(2)}).`
      });
    } else if (delta < -0.2) {
      insights.push({
        tipo: 'negativo',
        icone: '⚠️',
        label: 'Queda de score',
        texto: `${formatMesLabel(meses[i])} vs ${formatMesLabel(meses[i - 1])}: score médio caiu ${Math.abs(delta).toFixed(2)} (${anterior.avgSc.toFixed(2)} → ${atual.avgSc.toFixed(2)}).`
      });
    }
  }

  // Tendências (últimos 3 meses)
  if (meses.length >= 3) {
    const ultimos3 = meses.slice(-3);
    const fins = ultimos3.map(m => coletivo[m].fin);
    const scores = ultimos3.map(m => coletivo[m].avgSc);

    // Tendência de finalizações
    const finTrend = fins[2] - fins[0];
    if (finTrend > 0) {
      insights.push({
        tipo: 'positivo',
        icone: '🚀',
        label: 'Tendência positiva',
        texto: `Nos últimos 3 períodos, as finalizações apresentam tendência de alta (+${finTrend}).`
      });
    } else if (finTrend < 0) {
      insights.push({
        tipo: 'negativo',
        icone: '🔻',
        label: 'Tendência negativa',
        texto: `Nos últimos 3 períodos, as finalizações apresentam tendência de queda (${finTrend}).`
      });
    }

    // Tendência de score
    const scoreTrend = scores[2] - scores[0];
    if (scoreTrend > 0.15) {
      insights.push({
        tipo: 'positivo',
        icone: '📊',
        label: 'Score em alta',
        texto: `Score médio cresceu ${scoreTrend.toFixed(2)} nos últimos 3 períodos. Qualidade em evolução.`
      });
    } else if (scoreTrend < -0.15) {
      insights.push({
        tipo: 'negativo',
        icone: '📊',
        label: 'Score em queda',
        texto: `Score médio caiu ${Math.abs(scoreTrend).toFixed(2)} nos últimos 3 períodos. Atenção à qualidade.`
      });
    }

    // Produtividade
    const asses = ultimos3.map(m => coletivo[m].ass);
    const prodTrend = asses[2] > 0 && asses[0] > 0 ? ((fins[2] / asses[2]) - (fins[0] / asses[0])) * 100 : 0;
    if (Math.abs(prodTrend) > 5) {
      insights.push({
        tipo: prodTrend > 0 ? 'positivo' : 'negativo',
        icone: '🎯',
        label: 'Produtividade',
        texto: `Produtividade ${prodTrend > 0 ? 'aumentou' : 'diminuiu'} ${Math.abs(prodTrend).toFixed(1)}% nos últimos 3 períodos.`
      });
    }
  }

  // Insights individuais
  const cols = [...new Set(rows.map(r => r['Atendente']))].filter(Boolean);
  cols.forEach(name => {
    const recs = rows.filter(r => String(r['Atendente']) === name);
    const mesesColab = [...new Set(recs.map(r => r['Mês']))].filter(Boolean).sort();
    if (mesesColab.length < 2) return;
    const ult = mesesColab[mesesColab.length - 1];
    const ant = mesesColab[mesesColab.length - 2];
    const finUlt = recs.filter(r => String(r['Mês']) === ult).reduce((s, r) => s + (parseInt(r['Finalizados']) || 0), 0);
    const finAnt = recs.filter(r => String(r['Mês']) === ant).reduce((s, r) => s + (parseInt(r['Finalizados']) || 0), 0);
    if (finAnt > 0) {
      const delta = ((finUlt - finAnt) / finAnt) * 100;
      if (delta > 30) {
        insights.push({
          tipo: 'positivo',
          icone: '🔥',
          label: 'Destaque individual',
          texto: `${name} teve crescimento de ${delta.toFixed(0)}% nas finalizações no último período.`
        });
      } else if (delta < -30) {
        insights.push({
          tipo: 'negativo',
          icone: '⚠️',
          label: 'Atenção individual',
          texto: `${name} teve queda de ${Math.abs(delta).toFixed(0)}% nas finalizações no último período.`
        });
      }
    }
  });

  if (!insights.length) {
    container.innerHTML = '<div class="empty-state"><div class="empty-title">Nenhum insight significativo</div><div class="empty-sub">Os dados estão estáveis — sem variações relevantes para destacar.</div></div>';
    return;
  }

  const aliasMap = buildAliasMap(cols);
  let html = insights.map(ins => {
    const bg = ins.tipo === 'positivo' ? 'var(--success-soft)' : 'var(--danger-soft)';
    const border = ins.tipo === 'positivo' ? 'var(--success)' : 'var(--danger)';
    return `<div style="display:flex;align-items:flex-start;gap:var(--s-3);padding:var(--s-4);border:1px solid var(--border);border-radius:var(--r-md);background:${bg};margin-bottom:var(--s-2)">
      <span style="font-size:20px;line-height:1">${ins.icone}</span>
      <div style="flex:1">
        <div style="font-weight:600;font-size:13px;color:var(--text-strong);margin-bottom:2px">${ins.label}</div>
        <div style="font-size:13px;color:var(--text-secondary);line-height:1.5">${escapeHtml(ins.texto)}</div>
      </div>
    </div>`;
  }).join('');

  // Projeções (tendencia) - mostrar aqui também
  html += `<div style="margin-top:var(--s-5)">${renderProjecoes()}</div>`;

  container.innerHTML = html;
}

function onInsightsTabActivated() {
  renderInsights();
}
