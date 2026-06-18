// Painel do Líder — resumo executivo da equipe
// Módulo independente, não altera lógica existente

function _gfData() {
  return typeof globalFilters !== 'undefined' && globalFilters ? globalFilters.aplicar(rawRecords) : (rawRecords || []);
}

function renderPainelLider() {
  const container = document.getElementById('painelLiderContent');
  if (!container) return;
  const data = _gfData();
  if (!data || !data.length) {
    container.innerHTML = '<div class="empty-state"><div class="empty-title">Nenhum dado carregado</div><div class="empty-sub">Importe um CSV para visualizar o painel do líder.</div></div>';
    return;
  }

  const rows = (data).filter(r => r && !isAggregateName(r['Atendente']));
  const colaboradores = [...new Set(rows.map(r => r['Atendente']))].filter(Boolean).sort();
  const totalColabs = colaboradores.length;

  const byColab = {};
  colaboradores.forEach(name => {
    const recs = rows.filter(r => String(r['Atendente']) === name);
    const fin = recs.reduce((s, r) => s + (parseInt(r['Finalizados']) || 0), 0);
    const ass = recs.reduce((s, r) => s + (parseInt(r['Assumidos']) || 0), 0);
    const tra = recs.reduce((s, r) => s + (parseInt(r['Transferidos']) || 0), 0);
    const scores = recs.map(r => r['SCORE']).filter(v => v !== null && v !== undefined && !isNaN(Number(v)));
    const avgSc = scores.length ? scores.reduce((a, b) => a + Number(b), 0) / scores.length : 0;
    const prod = ass > 0 ? (fin / ass) : 0;
    const obj = recs.reduce((s, r) => s + (parseInt(r['Objetivo']) || 0), 0);
    byColab[name] = { fin, ass, tra, avgSc, prod, obj };
  });

  const totalFin = Object.values(byColab).reduce((s, v) => s + v.fin, 0);
  const totalAss = Object.values(byColab).reduce((s, v) => s + v.ass, 0);
  const mediaScoreGeral = Object.values(byColab).reduce((s, v) => s + v.avgSc, 0) / Math.max(1, Object.keys(byColab).length);
  const prodGeral = totalAss > 0 ? (totalFin / totalAss) : 0;

  // Colaboradores acima / abaixo da meta (Objetivo)
  const acimaMeta = [];
  const abaixoMeta = [];
  Object.entries(byColab).forEach(([name, data]) => {
    if (data.obj > 0) {
      if (data.fin >= data.obj) acimaMeta.push(name);
      else abaixoMeta.push(name);
    }
  });

  // Maior evolução (comparar último mês com anterior)
  const meses = [...new Set(rows.map(r => r['Mês']))].filter(Boolean).sort();
  let maiorEvolucao = { nome: '', delta: 0 };
  if (meses.length >= 2) {
    const ultimo = meses[meses.length - 1];
    const anterior = meses[meses.length - 2];
    colaboradores.forEach(name => {
      const recsUltimo = rows.filter(r => String(r['Atendente']) === name && String(r['Mês']) === ultimo);
      const recsAnterior = rows.filter(r => String(r['Atendente']) === name && String(r['Mês']) === anterior);
      const finUltimo = recsUltimo.reduce((s, r) => s + (parseInt(r['Finalizados']) || 0), 0);
      const finAnterior = recsAnterior.reduce((s, r) => s + (parseInt(r['Finalizados']) || 0), 0);
      const delta = finUltimo - finAnterior;
      if (delta > maiorEvolucao.delta) {
        maiorEvolucao = { nome: name, delta };
      }
    });
  }

  // Melhor desempenho (mais finalizados)
  const melhorDesempenho = Object.entries(byColab).sort((a, b) => b[1].fin - a[1].fin)[0];

  // Pontos de atenção
  const atencao = [];
  Object.entries(byColab).forEach(([name, data]) => {
    if (data.avgSc > 0 && data.avgSc < 3.5) atencao.push({ name, motivo: `Score baixo (${data.avgSc.toFixed(2)})` });
    if (data.prod < 0.5) atencao.push({ name, motivo: `Produtividade baixa (${(data.prod * 100).toFixed(0)}%)` });
    if (data.obj > 0 && data.fin < data.obj * 0.5) atencao.push({ name, motivo: `Abaixo de 50% da meta` });
  });

  const aliasMap = buildAliasMap(colaboradores);

  let html = '';

  // KPIs gerais
  html += `<div class="gamification-stats">
    <div class="kpi"><div class="label">Colaboradores</div><div class="value">${totalColabs}</div></div>
    <div class="kpi"><div class="label">Total Finalizados</div><div class="value">${totalFin.toLocaleString('pt-BR')}</div></div>
    <div class="kpi"><div class="label">Score médio</div><div class="value">${mediaScoreGeral.toFixed(2)}</div></div>
    <div class="kpi"><div class="label">Produtividade</div><div class="value">${(prodGeral * 100).toFixed(1)}%</div></div>
  </div>`;

  // Cards de destaque
  html += `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:var(--s-4);margin-bottom:var(--s-5)">`;

  // Acima da meta
  html += `<div style="padding:var(--s-5);border:1px solid var(--border);border-radius:var(--r-lg);background:var(--success-soft);text-align:center">
    <div style="font-size:28px;font-weight:700;color:var(--success)">${acimaMeta.length}</div>
    <div style="font-size:13px;color:var(--text-secondary);margin-top:4px">Acima da meta</div>
    ${acimaMeta.length ? `<div style="font-size:11px;color:var(--text-muted);margin-top:6px">${acimaMeta.map(n => escapeHtml(getDisplayName(n, aliasMap))).join(', ')}</div>` : ''}
  </div>`;

  // Abaixo da meta
  html += `<div style="padding:var(--s-5);border:1px solid var(--border);border-radius:var(--r-lg);background:${abaixoMeta.length ? 'var(--danger-soft)' : 'var(--bg-surface)'};text-align:center">
    <div style="font-size:28px;font-weight:700;color:${abaixoMeta.length ? 'var(--danger)' : 'var(--text-muted)'}">${abaixoMeta.length}</div>
    <div style="font-size:13px;color:var(--text-secondary);margin-top:4px">Abaixo da meta</div>
    ${abaixoMeta.length ? `<div style="font-size:11px;color:var(--text-muted);margin-top:6px">${abaixoMeta.map(n => escapeHtml(getDisplayName(n, aliasMap))).join(', ')}</div>` : ''}
  </div>`;

  // Maior evolução
  html += `<div style="padding:var(--s-5);border:1px solid var(--border);border-radius:var(--r-lg);background:var(--accent-soft);text-align:center">
    <div style="font-size:16px;font-weight:600;color:var(--accent)">${maiorEvolucao.nome ? escapeHtml(getDisplayName(maiorEvolucao.nome, aliasMap)) : '—'}</div>
    <div style="font-size:13px;color:var(--text-secondary);margin-top:4px">Maior evolução</div>
    ${maiorEvolucao.delta ? `<div style="font-size:22px;font-weight:700;color:var(--success);margin-top:4px">+${maiorEvolucao.delta}</div>` : ''}
  </div>`;

  // Melhor desempenho
  html += `<div style="padding:var(--s-5);border:1px solid var(--border);border-radius:var(--r-lg);background:var(--warning-soft);text-align:center">
    <div style="font-size:16px;font-weight:600;color:var(--warning)">${melhorDesempenho ? escapeHtml(getDisplayName(melhorDesempenho[0], aliasMap)) : '—'}</div>
    <div style="font-size:13px;color:var(--text-secondary);margin-top:4px">Melhor desempenho</div>
    <div style="font-size:22px;font-weight:700;color:var(--text-strong);margin-top:4px">${melhorDesempenho ? melhorDesempenho[1].fin.toLocaleString('pt-BR') : '0'} finalizações</div>
  </div>`;

  html += `</div>`;

  // Pontos de atenção
  html += `<h3 style="font-size:14px;font-weight:600;margin-bottom:var(--s-3);color:var(--text-strong)">🚨 Pontos de Atenção</h3>`;
  if (atencao.length) {
    html += `<div style="display:flex;flex-direction:column;gap:var(--s-2)">`;
    atencao.forEach(item => {
      html += `<div style="display:flex;align-items:center;gap:var(--s-3);padding:var(--s-3);border:1px solid var(--border);border-radius:var(--r-md);background:var(--danger-soft)">
        <span style="font-size:16px">⚠️</span>
        <span style="font-weight:600;color:var(--text-strong)">${escapeHtml(getDisplayName(item.name, aliasMap))}</span>
        <span style="color:var(--text-secondary);font-size:13px">${escapeHtml(item.motivo)}</span>
      </div>`;
    });
    html += `</div>`;
  } else {
    html += `<div style="padding:var(--s-4);border:1px solid var(--border);border-radius:var(--r-md);background:var(--success-soft);color:var(--success);font-weight:600;font-size:13px">✅ Nenhum ponto de atenção identificado.</div>`;
  }

  // Tabela resumo
  html += `<h3 style="font-size:14px;font-weight:600;margin:var(--s-5) 0 var(--s-3);color:var(--text-strong)">📋 Resumo por Colaborador</h3>`;
  html += `<div style="overflow-x:auto"><table class="ranking-table">
    <thead><tr><th>Colaborador</th><th>Finalizados</th><th>Assumidos</th><th>Transferidos</th><th>Score</th><th>Prod.</th><th>Meta</th><th>Status</th></tr></thead>
    <tbody>${Object.entries(byColab).sort((a, b) => b[1].fin - a[1].fin).map(([name, data]) => {
      const status = data.obj > 0 ? (data.fin >= data.obj ? '✅' : '🔴') : '—';
      const metaTxt = data.obj > 0 ? `${data.fin}/${data.obj}` : '—';
      return `<tr>
        <td><strong>${escapeHtml(getDisplayName(name, aliasMap))}</strong></td>
        <td>${data.fin.toLocaleString('pt-BR')}</td>
        <td>${data.ass.toLocaleString('pt-BR')}</td>
        <td>${data.tra.toLocaleString('pt-BR')}</td>
        <td class="score-cell ${data.avgSc > 0 ? getClasseScore(data.avgSc) : 'score-neutro'}">${data.avgSc > 0 ? data.avgSc.toFixed(2) : '—'}</td>
        <td>${(data.prod * 100).toFixed(0)}%</td>
        <td>${metaTxt}</td>
        <td>${status}</td>
      </tr>`;
    }).join('')}</tbody>
  </table></div>`;

  container.innerHTML = html;
}

function onLiderTabActivated() {
  renderPainelLider();
}
