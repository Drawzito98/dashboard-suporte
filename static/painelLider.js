// Painel do Líder — resumo executivo da equipe

function _liderData() {
  return typeof getDataFiltered === 'function' ? getDataFiltered() : (typeof globalFilters !== 'undefined' && globalFilters ? globalFilters.aplicar(rawRecords) : (rawRecords || []));
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
  // Filtra inativos (guarda para função ainda não carregada)
  const activeRows = typeof isColabActive === 'function' ? rows.filter(r => isColabActive(r['Atendente'])) : rows;
  const colaboradores = [...new Set(activeRows.map(r => r['Atendente']))].filter(Boolean).sort();
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
  const colabInfo = JSON.parse(appStorage.getItem('sistema_colaboradores_info_v1') || '{}');
  const flaggedColabs = new Set();
  Object.entries(colabInfo).forEach(([nm, info]) => {
    if ((info.conduta_negativa === 'true' || info.conduta_negativa === true) && colaboradores.includes(nm))
      flaggedColabs.add(nm);
  });
  const condutaBadge = (nm) => flaggedColabs.has(nm) ? ` <span class="conduta-badge" title="${escapeHtml(colabInfo[nm]?.conduta_motivo || 'Conduta negativa')}">🚩</span>` : '';

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
  const melhorScore = Object.entries(byColab).filter(e => e[1].avgSc > 0).sort((a, b) => b[1].avgSc - a[1].avgSc)[0];

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
  html += `<div class="lider-highlights">`;

  if (maiorEvol.nome && globalFilters.periodo !== 'all') {
    html += `<div class="lider-highlight">
      <div class="lider-highlight-name">${escapeHtml(getDisplayName(maiorEvol.nome, aliasMap))}${condutaBadge(maiorEvol.nome)}</div>
      <div class="lider-highlight-label">Maior evolução em finalizações</div>
      <div class="lider-growth-value">+${maiorEvol.delta} finalizações</div>
    </div>`;
  }

  html += `<div class="lider-highlight-volume">
    <div class="lider-volume-name">${melhorDesempenho ? escapeHtml(getDisplayName(melhorDesempenho[0], aliasMap)) + condutaBadge(melhorDesempenho[0]) : '—'}</div>
    <div class="lider-highlight-label">Mais finalizações</div>
    <div class="lider-highlight-value">${melhorDesempenho ? melhorDesempenho[1].fin.toLocaleString('pt-BR') : '0'} finalizações</div>
  </div>`;

  html += `<div class="lider-highlight">
    <div class="lider-highlight-name">${melhorScore ? escapeHtml(getDisplayName(melhorScore[0], aliasMap)) + condutaBadge(melhorScore[0]) : '—'}</div>
    <div class="lider-highlight-label">Maior score médio</div>
    <div class="lider-highlight-value">${melhorScore ? melhorScore[1].avgSc.toFixed(2) : '—'}</div>
  </div>`;

  html += `</div>`;

  // Pontos de atenção (deduplicados)
  const seen = new Set();
  html += `<h3 class="lider-section-title"><svg class="ui-icon" aria-hidden="true"><use href="#ui-icon-attention"></use></svg> Pontos de Atenção</h3>`;
  if (atencao.length) {
    html += `<div class="lider-attention-list">`;
    atencao.filter(a => {
      const key = a.name + a.motivo;
      if (seen.has(key)) return false; seen.add(key); return true;
    }).forEach(item => {
      html += `<div class="lider-attention-item">
        <span class="lider-item-icon">${item.icon}</span>
        <span class="lider-person-name">${escapeHtml(getDisplayName(item.name, aliasMap))}${condutaBadge(item.name)}</span>
        <span class="lider-attention-reason">${escapeHtml(item.motivo)}</span>
      </div>`;
    });
    html += `</div>`;
  } else {
    html += `<div class="lider-clear-attention">✅ Nenhum ponto de atenção identificado.</div>`;
  }

  // 💡 Sugestões automáticas (só com período filtrado)
  if (typeof globalFilters !== 'undefined' && globalFilters.periodo !== 'all') {
  const sugestoes = [];
  const META_SCORE = 4.70;

  colaboradores.forEach(name => {
    const d = byColab[name];
    const s = [];

    // Score abaixo da meta
    if (d.avgSc > 0 && d.avgSc < META_SCORE) {
      const diff = META_SCORE - d.avgSc;
      s.push({ icon: '📚', texto: `Score ${d.avgSc.toFixed(2)} — abaixo da meta (${META_SCORE}). Foco em qualidade.` });
    } else if (d.avgSc >= META_SCORE) {
      s.push({ icon: '✅', texto: `Score ${d.avgSc.toFixed(2)} dentro da meta. Estável.` });
    }

    // Transferências altas
    if (d.ass > 0) {
      const taxaTra = d.tra / d.ass;
      if (taxaTra > 0.30) {
        s.push({ icon: '🔄', texto: `${(taxaTra * 100).toFixed(0)}% dos atendimentos são transferidos. Revisar triagem.` });
      } else if (taxaTra < 0.15 && d.ass > 5) {
        s.push({ icon: '✅', texto: `Taxa de transferências controlada (${(taxaTra * 100).toFixed(0)}%).` });
      }
    }

    // Variação de finalizações
    if (d.finAnterior > 0) {
      const varFin = ((d.finUltimo - d.finAnterior) / d.finAnterior) * 100;
      if (varFin > 20) {
        s.push({ icon: '📈', texto: `Finalizações subiram ${varFin.toFixed(0)}% em relação ao mês anterior. Bom ritmo.` });
      } else if (varFin < -20) {
        s.push({ icon: '📉', texto: `Finalizações caíram ${Math.abs(varFin).toFixed(0)}%. Verificar se houve afastamento ou mudança.` });
      }
    }

    // Variação de score
    if (d.scAnterior > 0 && d.scUltimo > 0) {
      const varSc = d.scUltimo - d.scAnterior;
      if (varSc < -0.3) {
        s.push({ icon: '⚠️', texto: `Score caiu ${Math.abs(varSc).toFixed(2)} em relação ao mês anterior. Acompanhar.` });
      }
    }

    // Produtividade baixa (comparada à média)
    if (d.prod > 0 && prodGeral > 0 && d.prod < prodGeral * 0.7) {
      s.push({ icon: '⚡', texto: `Produtividade ${(d.prod * 100).toFixed(0)}% abaixo da média do time (${(prodGeral * 100).toFixed(0)}%).` });
    }

    // Cenário ideal
    if (d.avgSc >= META_SCORE && d.finAnterior > 0 && d.finUltimo >= d.finAnterior && d.tra / Math.max(1, d.ass) < 0.20) {
      s.push({ icon: '🏆', texto: `Colaborador estável: score ok, finalizações mantidas, transferências controladas.` });
    }

    if (s.length > 0) {
      sugestoes.push({ name, sugestoes: s });
    }
  });

  // Ordenar: quem tem mais sugestões primeiro, depois por nome
  sugestoes.sort((a, b) => b.sugestoes.length - a.sugestoes.length || a.name.localeCompare(b.name));

  html += `<div class="lider-suggestions">
    <h3 class="lider-section-title"><svg class="ui-icon" aria-hidden="true"><use href="#ui-icon-insight"></use></svg> Sugestões por Colaborador</h3>`;

  if (sugestoes.length === 0) {
    html += `<div class="lider-clear-suggestions">✅ Nenhuma sugestão no momento — time estável.</div>`;
  } else {
    html += `<div class="lider-suggestion-list">`;
    sugestoes.forEach(({ name, sugestoes: sugs }) => {
      const d = byColab[name];
      const hasConduta = flaggedColabs.has(name);
      html += `<div class="lider-suggestion-card">
        <div class="lider-suggestion-header">
          <span class="lider-item-icon">${sugs[0].icon}</span>
          <strong class="lider-suggestion-name">${escapeHtml(getDisplayName(name, aliasMap))}${condutaBadge(name)}</strong>
          <span class="lider-person-metrics">${d.fin.toLocaleString('pt-BR')} fin · Score ${d.avgSc > 0 ? d.avgSc.toFixed(2) : '—'} · ${(d.prod * 100).toFixed(0)}% prod</span>
        </div>
        <div class="lider-suggestion-body">${sugs.map(sg =>
          `<div class="lider-suggestion-line">
            <span class="lider-suggestion-icon">${sg.icon}</span>
            <span>${escapeHtml(sg.texto)}</span>
          </div>`
        ).join('')}</div>
      </div>`;
    });
    html += `</div>`;
  }

  html += `</div>`; }
  html += `<h3 class="lider-section-title"><svg class="ui-icon" aria-hidden="true"><use href="#ui-icon-clipboard"></use></svg> Resumo por Colaborador</h3>`;
  html += `<div class="lider-summary-table table-wrap" data-scroll-label="Resumo por colaborador da liderança"><table class="ranking-table">
    <thead><tr><th>Colaborador</th><th>Finalizados</th><th>Δ Fin</th><th>Score</th><th>Δ Score</th><th>Prod.</th><th>Meta</th><th>Status</th><th></th></tr></thead>
    <tbody>${Object.entries(byColab).sort((a, b) => b[1].fin - a[1].fin).map(([name, d]) => {
      const status = d.obj > 0 ? (d.fin >= d.obj ? '✅' : '🔴') : '—';
      const metaTxt = d.obj > 0 ? `${d.fin}/${d.obj}` : '—';
      const deltaFin = d.finAnterior > 0 ? d.finUltimo - d.finAnterior : null;
      const deltaSc = d.scAnterior > 0 ? (d.scUltimo - d.scAnterior) : null;
      const finClass = deltaFin !== null ? (deltaFin >= 0 ? 'variation-pos' : 'variation-neg') : '';
      const scClass = deltaSc !== null ? (deltaSc >= 0 ? 'variation-pos' : 'variation-neg') : '';
      return `<tr${flaggedColabs.has(name) ? ' class="lider-row-flagged"' : ''}>
        <td><strong>${escapeHtml(getDisplayName(name, aliasMap))}${condutaBadge(name)}</strong></td>
        <td>${d.fin.toLocaleString('pt-BR')}</td>
        <td class="${finClass} lider-delta">${deltaFin !== null ? (deltaFin >= 0 ? '↑ +' : '↓ ') + deltaFin : '—'}</td>
        <td class="score-cell ${d.avgSc > 0 ? getClasseScore(d.avgSc) : 'score-neutro'}">${d.avgSc > 0 ? d.avgSc.toFixed(2) : '—'}</td>
        <td class="${scClass} lider-delta">${deltaSc !== null ? (deltaSc >= 0 ? '↑ +' : '↓ ') + deltaSc.toFixed(2) : '—'}</td>
        <td>${(d.prod * 100).toFixed(0)}%</td>
        <td>${metaTxt}</td>
        <td>${status}</td>
        <td><button class="btn-small colab-info-btn" data-nome="${escapeHtml(name)}" aria-label="Ver dados de ${escapeHtml(getDisplayName(name, aliasMap))}" type="button" title="Ver dados do colaborador">👤</button></td>
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
