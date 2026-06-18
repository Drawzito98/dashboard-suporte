// Colaborador Detail — histórico completo, evolução, ranking, tendências

let currentColabDetail = null;

function _gfData() {
  return typeof globalFilters !== 'undefined' && globalFilters ? globalFilters.aplicar(rawRecords) : (rawRecords || []);
}

function openColabDetail(name) {
  currentColabDetail = name;
  const overlay = document.getElementById('colabDetailOverlay');
  if (!overlay) return;
  overlay.classList.add('open');
  renderColabDetail(name);
}

function closeColabDetail() {
  const overlay = document.getElementById('colabDetailOverlay');
  if (overlay) overlay.classList.remove('open');
  currentColabDetail = null;
}

function renderColabDetail(name) {
  const container = document.getElementById('colabDetailContent');
  if (!container) return;
  const data = _gfData();

  const records = (data).filter(r => r && String(r['Atendente']) === name && !isAggregateName(r['Atendente']));
  if (!records.length) {
    container.innerHTML = '<div class="empty-state"><div class="empty-title">Colaborador não encontrado</div></div>';
    return;
  }

  // Aggregate data
  const totalAssumidos = records.reduce((s, r) => s + (parseInt(r['Assumidos']) || 0), 0);
  const totalFinalizados = records.reduce((s, r) => s + (parseInt(r['Finalizados']) || 0), 0);
  const totalTransferidos = records.reduce((s, r) => s + (parseInt(r['Transferidos']) || 0), 0);
  const scores = records.map(r => r['SCORE']).filter(v => v !== null && v !== undefined && !isNaN(Number(v)));
  const avgScore = scores.length ? scores.reduce((a, b) => a + Number(b), 0) / scores.length : 0;
  const produtividade = totalAssumidos > 0 ? (totalFinalizados / totalAssumidos) * 100 : 0;
  const meses = [...new Set(records.map(r => r['Mês']))].sort();

  // Get ranking position
  const ranking = getOverallRanking ? getOverallRanking(data) : [];
  const rankPos = ranking.findIndex(r => r.name === name) + 1;

  const scoring = computeScoreForCollaborator ? computeScoreForCollaborator(name, data) : { total: 0 };
  const streak = computeStreak ? computeStreak(name) : { count: 0 };

  // Get setor
  const setores = [...new Set(records.map(r => r['Setor']))].filter(Boolean);
  const perfilLink = getPerfilDocsLink(name);

  // Month-over-month evolution
  const monthlyData = meses.map(m => {
    const monthRows = records.filter(r => String(r['Mês']) === m);
    const fin = monthRows.reduce((s, r) => s + (parseInt(r['Finalizados']) || 0), 0);
    const ass = monthRows.reduce((s, r) => s + (parseInt(r['Assumidos']) || 0), 0);
    const tra = monthRows.reduce((s, r) => s + (parseInt(r['Transferidos']) || 0), 0);
    const sc = monthRows.map(r => r['SCORE']).filter(v => v !== null && v !== undefined && !isNaN(Number(v)));
    const avg = sc.length ? sc.reduce((a, b) => a + Number(b), 0) / sc.length : 0;
    return { mes: m, finalizados: fin, assumidos: ass, transferidos: tra, score: avg };
  });

  // Trends (last month vs previous)
  const trend = monthlyData.length >= 2 ? {
    finalizados: monthlyData[monthlyData.length - 1].finalizados - monthlyData[monthlyData.length - 2].finalizados,
    score: monthlyData[monthlyData.length - 1].score - monthlyData[monthlyData.length - 2].score
  } : null;

  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  const isFav = window.__favoriteColabs && window.__favoriteColabs.has(name);
  const aliasMap = buildAliasMap([name]);
  const displayName = getDisplayName(name, aliasMap);

  let html = `
    <div class="colab-detail-header">
      ${typeof colabAvatarHtml === 'function' ? colabAvatarHtml(name, 56) : `<div class="colab-detail-avatar">${escapeHtml(initials)}</div>`}
      <div class="colab-detail-name">
        <h2>${escapeHtml(displayName)}</h2>
        <p>${escapeHtml(setores.join(', '))} · ${meses.length} ${meses.length === 1 ? 'período' : 'períodos'} · #${rankPos} no ranking</p>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <button class="fav-btn" id="colabFavBtn" type="button" title="${isFav ? 'Remover dos favoritos' : 'Favoritar'}">${isFav ? '⭐' : '☆'}</button>
        ${perfilLink ? `<button class="btn-small" id="colabPerfilBtn" type="button">📄 Perfil</button>` : ''}
      </div>
    </div>

    <div class="colab-detail-stats">
      <div class="colab-stat"><div class="colab-stat-value">${totalAssumidos.toLocaleString('pt-BR')}</div><div class="colab-stat-label">Assumidos</div></div>
      <div class="colab-stat"><div class="colab-stat-value">${totalFinalizados.toLocaleString('pt-BR')}</div><div class="colab-stat-label">Finalizados</div></div>
      <div class="colab-stat"><div class="colab-stat-value">${totalTransferidos.toLocaleString('pt-BR')}</div><div class="colab-stat-label">Transferidos</div></div>
      <div class="colab-stat"><div class="colab-stat-value">${avgScore.toFixed(2)}</div><div class="colab-stat-label">Score médio</div></div>
      <div class="colab-stat"><div class="colab-stat-value">${produtividade.toFixed(1)}%</div><div class="colab-stat-label">Produtividade</div></div>
      <div class="colab-stat"><div class="colab-stat-value">${scoring.total.toFixed(1)}</div><div class="colab-stat-label">Pontuação</div></div>
    </div>

    ${trend ? `<div style="margin-bottom:var(--s-5);padding:var(--s-3);border-radius:var(--r-md);background:var(--bg-inset);font-size:13px;color:var(--text-secondary)">
      <strong>Tendências (último mês):</strong>
      Finalizados: <span class="${trend.finalizados >= 0 ? 'trend-up' : 'trend-down'}">${trend.finalizados >= 0 ? '+' : ''}${trend.finalizados}</span> ·
      Score: <span class="${trend.score >= 0 ? 'trend-up' : 'trend-down'}">${trend.score >= 0 ? '+' : ''}${trend.score.toFixed(2)}</span>
      ${streak.count > 0 ? `· 🔥 Sequência: ${streak.count} ${streak.count === 1 ? 'mês' : 'meses'}` : ''}
      ${rankPos <= 3 ? `· 🏆 Top ${rankPos} do ranking` : ''}
    </div>` : ''}
  `;

  // Evolution chart
  if (meses.length >= 2) {
    html += `<div style="margin-bottom:var(--s-5)">
      <h3 style="font-size:13px;font-weight:600;margin-bottom:var(--s-3);color:var(--text-strong)">📈 Evolução Mensal</h3>
      <div class="chart-area"><div class="chart-scroll"><div class="chart-inner" style="height:250px"><canvas id="colabDetailChart"></canvas></div></div></div>
    </div>`;
  }

  // Scoring breakdown
  if (scoring.breakdown) {
    html += `<div style="margin-bottom:var(--s-5)">
      <h3 style="font-size:13px;font-weight:600;margin-bottom:var(--s-3);color:var(--text-strong)">📊 Composição da Pontuação</h3>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--s-2)">
        ${Object.entries(scoring.breakdown).map(([ruleId, pts]) => {
          const rule = (scoringRules || []).find(r => r.id === ruleId);
          if (!rule || pts === 0) return '';
          return `<div style="display:flex;justify-content:space-between;padding:6px 10px;border-radius:var(--r-sm);background:var(--bg-inset);font-size:12px">
            <span>${rule.icon} ${escapeHtml(rule.name)}</span>
            <span style="font-weight:600;color:${pts >= 0 ? 'var(--success)' : 'var(--danger)'}">${pts >= 0 ? '+' : ''}${pts.toFixed(1)}</span>
          </div>`;
        }).filter(Boolean).join('')}
      </div>
    </div>`;
  }

  // Goals assigned to this collaborator
  const colabGoals = (goals || []).filter(g => g.collaborator === name || (!g.collaborator && (g.setor === 'all' || setores.includes(g.setor))));
  if (colabGoals.length) {
    html += `<div style="margin-bottom:var(--s-5)">
      <h3 style="font-size:13px;font-weight:600;margin-bottom:var(--s-3);color:var(--text-strong)">🎯 Metas Relacionadas</h3>
      ${colabGoals.map(g => {
        const progress = typeof getMetaProgress === 'function' ? getMetaProgress(g) : 0;
        const progClass = progress >= 100 ? 'good' : (progress >= 50 ? 'warn' : 'bad');
        return `<div style="display:flex;align-items:center;gap:var(--s-3);padding:var(--s-3);border:1px solid var(--border);border-radius:var(--r-md);margin-bottom:var(--s-2)">
          <div style="flex:1;font-size:13px;font-weight:500">${escapeHtml(g.title)}</div>
          <div style="width:100px"><div class="meta-progress-bar"><div class="meta-progress-fill ${progClass}" style="width:${Math.min(100, progress)}%"></div></div></div>
          <span style="font-size:12px;font-weight:600">${progress}%</span>
        </div>`;
      }).join('')}
    </div>`;
  }

  // Monthly data table
  html += `<h3 style="font-size:13px;font-weight:600;margin-bottom:var(--s-3);color:var(--text-strong)">📋 Histórico Detalhado</h3>
  <div style="overflow-x:auto"><table class="ranking-table">
    <thead><tr><th>Período</th><th>Assumidos</th><th>Finalizados</th><th>Transferidos</th><th>Score</th></tr></thead>
    <tbody>
      ${monthlyData.map(m => `
        <tr>
          <td><strong>${escapeHtml(formatMesLabel ? formatMesLabel(m.mes) : m.mes)}</strong></td>
          <td>${m.assumidos}</td>
          <td>${m.finalizados}</td>
          <td>${m.transferidos}</td>
          <td class="score-cell ${m.score > 0 ? getClasseScore(m.score) : 'score-neutro'}">${m.score > 0 ? m.score.toFixed(2) : '—'}</td>
        </tr>
      `).join('')}
    </tbody>
  </table></div>`;

  container.innerHTML = html;

  // Bind fav button
  const favBtn = document.getElementById('colabFavBtn');
  if (favBtn) {
    favBtn.addEventListener('click', () => {
      toggleFavorite(name);
      favBtn.textContent = window.__favoriteColabs && window.__favoriteColabs.has(name) ? '⭐' : '☆';
      favBtn.title = window.__favoriteColabs && window.__favoriteColabs.has(name) ? 'Remover dos favoritos' : 'Favoritar';
    });
  }

  // Bind perfil button
  const perfilBtn = document.getElementById('colabPerfilBtn');
  if (perfilBtn && perfilLink) {
    perfilBtn.addEventListener('click', () => window.open(perfilLink, '_blank', 'noopener,noreferrer'));
  }

  // Evolution chart
  if (document.getElementById('colabDetailChart') && typeof Chart !== 'undefined') {
    renderColabDetailChart(monthlyData);
  }
}

function renderColabDetailChart(monthlyData) {
  const canvas = document.getElementById('colabDetailChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const labels = monthlyData.map(m => formatMesLabel ? formatMesLabel(m.mes) : m.mes);
  const finalizados = monthlyData.map(m => m.finalizados);
  const scores = monthlyData.map(m => m.score);

  if (window.__colabDetailChart) {
    try { window.__colabDetailChart.destroy(); } catch (e) {}
  }

  window.__colabDetailChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Finalizados',
          data: finalizados,
          backgroundColor: 'rgba(16,185,129,0.8)',
          yAxisID: 'y',
          order: 2
        },
        {
          label: 'Score médio',
          data: scores,
          type: 'line',
          borderColor: 'rgba(99,102,241,1)',
          backgroundColor: 'rgba(99,102,241,0.1)',
          tension: 0.3,
          fill: true,
          pointRadius: 4,
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
          labels: { usePointStyle: true, boxWidth: 8, boxHeight: 8, padding: 14, font: { size: 11.5 } }
        }
      },
      scales: {
        y: { beginAtZero: true, position: 'left', grid: { color: 'rgba(148,163,184,0.14)' }, ticks: { font: { size: 11 } } },
        y1: { beginAtZero: true, suggestedMax: 5, position: 'right', grid: { display: false }, ticks: { font: { size: 11 } } },
        x: { grid: { display: false }, ticks: { font: { size: 11 } } }
      }
    }
  });
}

// Close overlay on backdrop click
document.addEventListener('click', (e) => {
  const overlay = document.getElementById('colabDetailOverlay');
  if (overlay && overlay.classList.contains('open') && e.target === overlay) {
    closeColabDetail();
  }
});

// Close button
document.addEventListener('DOMContentLoaded', () => {
  const closeBtn = document.getElementById('colabDetailClose');
  if (closeBtn) closeBtn.addEventListener('click', closeColabDetail);

  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeColabDetail();
  });
});
