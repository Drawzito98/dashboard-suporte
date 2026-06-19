// Painel do Líder — resumo executivo da equipe

function _liderData() {
  return typeof globalFilters !== 'undefined' && globalFilters ? globalFilters.aplicar(rawRecords) : (rawRecords || []);
}

function renderPainelLider() {
  const container = document.getElementById('painelLiderContent');
  if (!container) return;
  const data = _liderData();
  if (!data || !data.length) {
    container.innerHTML = '<div class="empty-state"><div class="empty-title">Nenhum dado carregado</div><div class="empty-sub">Importe um CSV para visualizar o painel do líder.</div></div>';
    return;
  }

  const rows = data.filter(r => r && !isAggregateName(r['Atendente']));
  const colaboradores = [...new Set(rows.map(r => r['Atendente']))].filter(Boolean).sort();
  const meses = [...new Set(rows.map(r => r['Mês']))].filter(Boolean).sort();
  const ultimoMes = meses.length >= 2 ? meses[meses.length - 1] : null;
  const mesAnterior = meses.length >= 2 ? meses[meses.length - 2] : null;

  // Dados agregados por colaborador (total + último mês + mês anterior)
  const byColab = {};
  colaboradores.forEach(name => {
    const recs = rows.filter(r => String(r['Atendente']) === name);
    const recsUltimo = ultimoMes ? rows.filter(r => String(r['Atendente']) === name && String(r['Mês']) === ultimoMes) : [];
    const recsAnterior = mesAnterior ? rows.filter(r => String(r['Atendente']) === name && String(r['Mês']) === mesAnterior) : [];

    const sum = (arr, key) => arr.reduce((s, r) => s + (parseInt(r[key]) || 0), 0);
    const avgScore = (arr) => {
      const scores = arr.map(r => r['SCORE']).filter(v => v !== null && v !== undefined && !isNaN(Number(v)));
      return scores.length ? scores.reduce((a, b) => a + Number(b), 0) / scores.length : 0;
    };

    const fin = sum(recs, 'Finalizados');
    const ass = sum(recs, 'Assumidos');
    const tra = sum(recs, 'Transferidos');
    const avgSc = avgScore(recs);
    const prod = ass > 0 ? fin / ass : 0;
    const obj = sum(recs, 'Objetivo');

    // Dados do último mês para delta
    const finUltimo = sum(recsUltimo, 'Finalizados');
    const finAnterior = sum(recsAnterior, 'Finalizados');
    const scUltimo = avgScore(recsUltimo);
    const scAnterior = avgScore(recsAnterior);

    byColab[name] = {
      fin, ass, tra, avgSc, prod, obj,
      finUltimo, finAnterior, scUltimo, scAnterior
    };
  });

  const totalFin = Object.values(byColab).reduce((s, v) => s + v.fin, 0);
  const totalAss = Object.values(byColab).reduce((s, v) => s + v.ass, 0);
  const mediaScoreGeral = Object.values(byColab).reduce((s, v) => s + v.avgSc, 0) / Math.max(1, Object.keys(byColab).length);
  const prodGeral = totalAss > 0 ? totalFin / totalAss : 0;
  const aliasMap = buildAliasMap(colaboradores);

  // Colaboradores com conduta negativa
  const colabInfo = JSON.parse(localStorage.getItem('sistema_colaboradores_info_v1') || '{}');
  const flaggedColabs = new Set();
  Object.entries(colabInfo).forEach(([nm, info]) => {
    if ((info.conduta_negativa === 'true' || info.conduta_negativa === true) && colaboradores.includes(nm))
      flaggedColabs.add(nm);
  });
  const condutaBadge = (nm) => flaggedColabs.has(nm) ? ' 🚩' : '';

  // Meta status
  const acimaMeta = [], abaixoMeta = [];
  Object.entries(byColab).forEach(([name, d]) => {
    if (d.obj > 0) {
      if (d.fin >= d.obj) acimaMeta.push(name);
      else abaixoMeta.push(name);
    }
  });

  // Melhor evolução (finalizados último vs anterior)
  let maiorEvol = { nome: '', delta: -Infinity };
  colaboradores.forEach(name => {
    const d = byColab[name];
    if (d.finAnterior > 0) {
      const delta = d.finUltimo - d.finAnterior;
      if (delta > maiorEvol.delta) maiorEvol = { nome: name, delta };
    }
  });

  // Melhor desempenho
  const melhorDesempenho = Object.entries(byColab).sort((a, b) => b[1].fin - a[1].fin)[0];

  // ── Pontos de atenção ──
  const atencao = [];

  flaggedColabs.forEach(name => {
    const info = colabInfo[name] || {};
    atencao.push({
      name,
      motivo: info.conduta_motivo || 'Conduta negativa (sem detalhes)',
      icon: '🚩'
    });
  });

  Object.entries(byColab).forEach(([name, d]) => {
    if (d.avgSc > 0 && d.avgSc < 4.5)
      atencao.push({ name, motivo: `Score ${d.avgSc.toFixed(2)} (abaixo de 4.5)`, icon: '⚠️' });
    if (d.prod > 0 && d.prod < 0.5)
      atencao.push({ name, motivo: `Produtividade ${(d.prod * 100).toFixed(0)}%`, icon: '⚠️' });
    if (d.obj > 0 && d.fin < d.obj * 0.5)
      atencao.push({ name, motivo: `Menos de 50% da meta (${d.fin}/${d.obj})`, icon: '🎯' });
    if (d.finAnterior > 0 && d.finUltimo < d.finAnterior * 0.7)
      atencao.push({ name, motivo: `Queda >30% nas finalizações (${d.finAnterior} → ${d.finUltimo})`, icon: '📉' });
    if (d.avgSc > 0 && d.scUltimo > 0 && d.scUltimo < d.scAnterior - 0.3)
      atencao.push({ name, motivo: `Score caiu ${(d.scAnterior - d.scUltimo).toFixed(2)} no último mês`, icon: '📉' });
  });
  // Produtividade abaixo da média do time
  Object.entries(byColab).forEach(([name, d]) => {
    if (d.prod > 0 && prodGeral > 0 && d.prod < prodGeral * 0.7)
      atencao.push({ name, motivo: `Produtividade ${(d.prod * 100).toFixed(0)}% (abaixo da média ${(prodGeral * 100).toFixed(0)}%)`, icon: '📊' });
  });

  let html = '';

  // KPIs
  html += `<div class="gamification-stats">
    <div class="kpi"><div class="label">Colaboradores</div><div class="value">${colaboradores.length}</div></div>
    <div class="kpi"><div class="label">Total Finalizados</div><div class="value">${totalFin.toLocaleString('pt-BR')}</div></div>
    <div class="kpi"><div class="label">Score médio</div><div class="value">${mediaScoreGeral.toFixed(2)}</div></div>
    <div class="kpi"><div class="label">Produtividade</div><div class="value">${(prodGeral * 100).toFixed(1)}%</div></div>
  </div>`;

  // Cards
  html += `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:var(--s-4);margin-bottom:var(--s-5)">`;

  html += `<div style="padding:var(--s-4);border:1px solid var(--border);border-radius:var(--r-lg);background:var(--success-soft);text-align:center">
    <div style="font-size:26px;font-weight:700;color:var(--success)">${acimaMeta.length}</div>
    <div style="font-size:13px;color:var(--text-secondary);margin-top:4px">Acima da meta</div>
    ${acimaMeta.length ? `<div style="font-size:11px;color:var(--text-muted);margin-top:6px">${acimaMeta.map(n => escapeHtml(getDisplayName(n, aliasMap)) + condutaBadge(n)).join(', ')}</div>` : ''}
  </div>`;

  html += `<div style="padding:var(--s-4);border:1px solid var(--border);border-radius:var(--r-lg);background:${abaixoMeta.length ? 'var(--danger-soft)' : 'var(--bg-surface)'};text-align:center">
    <div style="font-size:26px;font-weight:700;color:${abaixoMeta.length ? 'var(--danger)' : 'var(--text-muted)'}">${abaixoMeta.length}</div>
    <div style="font-size:13px;color:var(--text-secondary);margin-top:4px">Abaixo da meta</div>
    ${abaixoMeta.length ? `<div style="font-size:11px;color:var(--text-muted);margin-top:6px">${abaixoMeta.map(n => escapeHtml(getDisplayName(n, aliasMap)) + condutaBadge(n)).join(', ')}</div>` : ''}
  </div>`;

  html += `<div style="padding:var(--s-4);border:1px solid var(--border);border-radius:var(--r-lg);background:var(--accent-soft);text-align:center">
    <div style="font-size:15px;font-weight:600;color:var(--accent)">${maiorEvol.nome ? escapeHtml(getDisplayName(maiorEvol.nome, aliasMap)) + condutaBadge(maiorEvol.nome) : '—'}</div>
    <div style="font-size:13px;color:var(--text-secondary);margin-top:4px">Maior evolução</div>
    ${maiorEvol.delta > -Infinity ? `<div style="font-size:20px;font-weight:700;color:var(--success);margin-top:4px">+${maiorEvol.delta}</div>` : ''}
  </div>`;

  html += `<div style="padding:var(--s-4);border:1px solid var(--border);border-radius:var(--r-lg);background:var(--warning-soft);text-align:center">
    <div style="font-size:15px;font-weight:600;color:var(--warning)">${melhorDesempenho ? escapeHtml(getDisplayName(melhorDesempenho[0], aliasMap)) + condutaBadge(melhorDesempenho[0]) : '—'}</div>
    <div style="font-size:13px;color:var(--text-secondary);margin-top:4px">Melhor desempenho</div>
    <div style="font-size:20px;font-weight:700;color:var(--text-strong);margin-top:4px">${melhorDesempenho ? melhorDesempenho[1].fin.toLocaleString('pt-BR') : '0'} finalizações</div>
  </div>`;

  html += `</div>`;

  // Pontos de atenção (deduplicados)
  const seen = new Set();
  html += `<h3 style="font-size:14px;font-weight:600;margin-bottom:var(--s-3);color:var(--text-strong)">🚨 Pontos de Atenção</h3>`;
  if (atencao.length) {
    html += `<div style="display:flex;flex-direction:column;gap:var(--s-2);margin-bottom:var(--s-5)">`;
    atencao.filter(a => {
      const key = a.name + a.motivo;
      if (seen.has(key)) return false; seen.add(key); return true;
    }).forEach(item => {
      html += `<div style="display:flex;align-items:center;gap:var(--s-3);padding:var(--s-3);border:1px solid var(--border);border-radius:var(--r-md);background:var(--danger-soft)">
        <span style="font-size:14px">${item.icon}</span>
        <span style="font-weight:600;color:var(--text-strong);font-size:13px">${escapeHtml(getDisplayName(item.name, aliasMap))}${condutaBadge(item.name)}</span>
        <span style="color:var(--text-secondary);font-size:12px">${escapeHtml(item.motivo)}</span>
      </div>`;
    });
    html += `</div>`;
  } else {
    html += `<div style="padding:var(--s-4);border:1px solid var(--border);border-radius:var(--r-md);background:var(--success-soft);color:var(--success);font-weight:600;font-size:13px;margin-bottom:var(--s-5)">✅ Nenhum ponto de atenção identificado.</div>`;
  }

  // Tabela com Δ
  html += `<h3 style="font-size:14px;font-weight:600;margin-bottom:var(--s-3);color:var(--text-strong)">📋 Resumo por Colaborador</h3>`;
  html += `<div style="overflow-x:auto;margin-bottom:var(--s-2)"><table class="ranking-table">
    <thead><tr><th>Colaborador</th><th>Finalizados</th><th>Δ Fin</th><th>Score</th><th>Δ Score</th><th>Prod.</th><th>Meta</th><th>Status</th><th></th></tr></thead>
    <tbody>${Object.entries(byColab).sort((a, b) => b[1].fin - a[1].fin).map(([name, d]) => {
      const status = d.obj > 0 ? (d.fin >= d.obj ? '✅' : '🔴') : '—';
      const metaTxt = d.obj > 0 ? `${d.fin}/${d.obj}` : '—';
      const deltaFin = d.finAnterior > 0 ? d.finUltimo - d.finAnterior : null;
      const deltaSc = d.scAnterior > 0 ? (d.scUltimo - d.scAnterior) : null;
      const finClass = deltaFin !== null ? (deltaFin >= 0 ? 'variation-pos' : 'variation-neg') : '';
      const scClass = deltaSc !== null ? (deltaSc >= 0 ? 'variation-pos' : 'variation-neg') : '';
      return `<tr${flaggedColabs.has(name) ? ' style="background:var(--danger-soft)"' : ''}>
        <td><strong>${escapeHtml(getDisplayName(name, aliasMap))}${condutaBadge(name)}</strong></td>
        <td>${d.fin.toLocaleString('pt-BR')}</td>
        <td class="${finClass}" style="font-size:12px">${deltaFin !== null ? (deltaFin >= 0 ? '↑ +' : '↓ ') + deltaFin : '—'}</td>
        <td class="score-cell ${d.avgSc > 0 ? getClasseScore(d.avgSc) : 'score-neutro'}">${d.avgSc > 0 ? d.avgSc.toFixed(2) : '—'}</td>
        <td class="${scClass}" style="font-size:12px">${deltaSc !== null ? (deltaSc >= 0 ? '↑ +' : '↓ ') + deltaSc.toFixed(2) : '—'}</td>
        <td>${(d.prod * 100).toFixed(0)}%</td>
        <td>${metaTxt}</td>
        <td>${status}</td>
        <td><button class="btn-small colab-info-btn" data-nome="${name}" type="button" title="Ver dados do colaborador" style="font-size:11px">👤</button></td>
      </tr>`;
    }).join('')}</tbody>
  </table></div>`;

  container.innerHTML = html;

  // Bind colab info buttons
  container.querySelectorAll('.colab-info-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const nome = btn.dataset.nome;
      if (typeof openColabDetailOverlay === 'function') {
        openColabDetailOverlay(nome);
      } else {
        showToast('Abra a aba Colaboradores para gerenciar.', 'info', 'Liderança');
      }
    });
  });
}

function onLiderTabActivated() {
  renderPainelLider();
}
