// Gamificação — ranking, pódio, medalhas, streak, heatmap, evolução
const GAMIFICATION_CACHE_KEY = 'sistema_gamification_cache_v1';
let gamificationCache = null;

function _gfData() {
  return typeof globalFilters !== 'undefined' && globalFilters ? globalFilters.aplicar(rawRecords) : (rawRecords || []);
}

function getGamificationData() {
  if (gamificationCache) return gamificationCache;
  const data = _gfData();
  const ranking = getOverallRanking(data);
  const months = [...new Set((data || []).filter(r => r && r['Mês']).map(r => r['Mês']))].sort();
  const monthlyScores = {};
  months.forEach(m => {
    const monthRows = (data || []).filter(r => r && String(r['Mês']) === m);
    const monthRanking = getOverallRanking(monthRows);
    monthRanking.forEach(item => {
      if (!monthlyScores[item.name]) monthlyScores[item.name] = {};
      monthlyScores[item.name][m] = item.score.total;
    });
  });

  const result = { ranking, months, monthlyScores };
  gamificationCache = result;
  return result;
}

function invalidateGamificationCache() {
  gamificationCache = null;
}

function getMedals(score, ranking, allScores) {
  const medals = [];
  const pos = ranking.findIndex(r => r.name === score.name);
  if (pos === 0) medals.push({ icon: '🥇', name: 'Ouro', desc: '1º lugar no ranking' });
  else if (pos === 1) medals.push({ icon: '🥈', name: 'Prata', desc: '2º lugar no ranking' });
  else if (pos === 2) medals.push({ icon: '🥉', name: 'Bronze', desc: '3º lugar no ranking' });

  const totalScore = score.score.total;
  if (totalScore >= 100) medals.push({ icon: '💎', name: 'Diamante', desc: 'Acima de 100 pontos' });
  else if (totalScore >= 50) medals.push({ icon: '🏅', name: 'Excelência', desc: 'Acima de 50 pontos' });
  else if (totalScore >= 20) medals.push({ icon: '🎖️', name: 'Destaque', desc: 'Acima de 20 pontos' });

  const records = (_gfData()).filter(r => r && String(r['Atendente']) === score.name);
  const scores = records.map(r => r['SCORE']).filter(v => v !== null && v !== undefined);
  const avgScore = scores.length ? scores.reduce((a, b) => a + Number(b), 0) / scores.length : 0;
  if (avgScore >= 4.5) medals.push({ icon: '⭐', name: 'Qualidade', desc: 'Score médio >= 4.5' });

  return medals;
}

function computeStreak(name) {
  const records = (_gfData()).filter(r => r && String(r['Atendente']) === name);
  const months = [...new Set(records.map(r => r['Mês']))].sort();
  if (!months.length) return { count: 0, active: [] };

  // Simple streak: consecutive months with score >= threshold
  let streak = 0;
  let active = [];
  for (let i = 0; i < months.length; i++) {
    const monthRows = records.filter(r => String(r['Mês']) === months[i]);
    const scores = monthRows.map(r => r['SCORE']).filter(v => v !== null && v !== undefined);
    const avg = scores.length ? scores.reduce((a, b) => a + Number(b), 0) / scores.length : 0;
    if (avg >= 4.0) {
      streak++;
      active.push(months[i]);
    } else {
      break;
    }
  }
  return { count: streak, active };
}

function renderGamification() {
  const container = document.getElementById('gamificationContent');
  if (!container) return;
  const gf = _gfData();
  if (!gf || !gf.length) {
    container.innerHTML = '<div class="empty-state"><div class="empty-title">Nenhum dado carregado</div><div class="empty-sub">Importe um CSV para visualizar a gamificação.</div></div>';
    return;
  }

  const data = getGamificationData();
  const { ranking, months, monthlyScores } = data;
  if (!ranking.length) {
    container.innerHTML = '<div class="empty-state"><div class="empty-title">Sem dados de ranking</div><div class="empty-sub">Não foi possível calcular a pontuação.</div></div>';
    return;
  }

  const top3 = ranking.slice(0, 3);
  const aliasMap = buildAliasMap(ranking.map(r => r.name));
  const topScoreVal = ranking.length > 0 ? ranking[0].score.total : 0;

  // Média geral = média dos SCOREs reais (0-5), não dos pontos acumulados
  let mediaGeral = 0;
  const allRecords = _gfData();
  const allScores = allRecords.filter(r => r && r['SCORE'] !== null && r['SCORE'] !== undefined).map(r => Number(r['SCORE']));
  if (allScores.length) {
    mediaGeral = allScores.reduce((a, b) => a + b, 0) / allScores.length;
  }

  let html = '';

  // Stats summary
  html += `<div class="gamification-stats">
    <div class="kpi"><div class="label">Colaboradores</div><div class="value">${ranking.length}</div></div>
    <div class="kpi"><div class="label">Maior pontuação</div><div class="value">${Math.round(topScoreVal)}</div></div>
    <div class="kpi"><div class="label">Média geral</div><div class="value">${mediaGeral.toFixed(2)}</div></div>
    <div class="kpi"><div class="label">Períodos</div><div class="value">${months.length}</div></div>
  </div>`;

  // Podium top 3
  if (top3.length) {
    const podiumOrder = top3.length === 3 ? [top3[1], top3[0], top3[2]] : top3;
    html += '<div class="podium">';
    podiumOrder.forEach((item, i) => {
      const isFirst = item === top3[0];
      const isSecond = item === top3[1];
      const isThird = item === top3[2];
      const cls = isFirst ? 'podium-1st' : (isSecond ? 'podium-2nd' : 'podium-3rd');
      const medal = isFirst ? '🥇' : (isSecond ? '🥈' : '🥉');
      const label = isFirst ? '1º Lugar' : (isSecond ? '2º Lugar' : '3º Lugar');
      const score = item.score.total;
      html += `<div class="podium-item ${cls}">
        <div class="podium-medal">${medal}</div>
        <div class="podium-bar"></div>
        <div class="podium-rank">${label}</div>
        <div style="margin:4px 0">${typeof colabAvatarHtml === 'function' ? colabAvatarHtml(item.name, 44) : ''}</div>
        <div class="podium-name" title="${escapeHtml(item.name)}">${escapeHtml(getDisplayName(item.name, aliasMap))}</div>
        <div class="podium-score">${score.toFixed(1)} pts</div>
      </div>`;
    });
    html += '</div>';
  }

  // Ranking table
  html += '<div style="margin-top:var(--s-5)"><h3 style="font-size:15px;font-weight:600;margin-bottom:var(--s-3);color:var(--text-strong)">📋 Ranking Completo</h3>';
  html += '<div style="overflow-x:auto"><table class="ranking-table">';
  html += '<thead><tr><th>#</th><th>Colaborador</th><th>Pontuação</th><th>+/-</th><th>Medalhas</th><th>🔥 Sequência</th><th></th></tr></thead><tbody>';
  ranking.forEach((item, i) => {
    const medals = getMedals(item, ranking, ranking);
    const streak = computeStreak(item.name);
    const posClass = i === 0 ? 'gold' : (i === 1 ? 'silver' : (i === 2 ? 'bronze' : ''));
    const medalIcons = medals.slice(0, 3).map(m => `<span title="${escapeHtml(m.name + ': ' + m.desc)}">${m.icon}</span>`).join(' ');
    const isFav = window.__favoriteColabs && window.__favoriteColabs.has(item.name);

    const breakdown = item.score.breakdown || {};
    const posPts = Object.values(breakdown).filter(v => v > 0).reduce((s, v) => s + v, 0);
    const negPts = Object.values(breakdown).filter(v => v < 0).reduce((s, v) => s + v, 0);

    html += `<tr class="${isFav ? 'highlight-row' : ''}">
      <td><span class="rank-pos-badge ${posClass}">${i + 1}</span></td>
      <td style="display:flex;align-items:center;gap:8px">${typeof colabAvatarHtml === 'function' ? colabAvatarHtml(item.name, 28) : ''}<strong>${escapeHtml(getDisplayName(item.name, aliasMap))}</strong></td>
      <td><strong>${item.score.total.toFixed(1)}</strong></td>
      <td style="font-size:11px;white-space:nowrap">
        ${posPts > 0 ? `<span style="color:var(--success);font-weight:600">+${posPts.toFixed(1)}</span>` : ''}
        ${negPts < 0 ? `<span style="color:var(--danger);font-weight:600;margin-left:4px">${negPts.toFixed(1)}</span>` : ''}
      </td>
      <td style="font-size:16px">${medalIcons || '—'}</td>
      <td>${streak.count > 0 ? `🔥 ${streak.count} ${streak.count === 1 ? 'mês' : 'meses'}` : '—'}</td>
      <td style="white-space:nowrap">
        <button class="btn-small foto-btn" data-name="${escapeHtml(item.name)}" type="button" title="Adicionar foto">📷</button>
        <button class="btn-small breakdown-toggle-btn" data-target="bd-${i}" type="button">🔍 Detalhar</button>
        <button class="btn-small view-colab-btn" data-name="${escapeHtml(item.name)}" type="button">Ver perfil</button>
      </td>
    </tr>`;

    // Scoring breakdown detail row (hidden by default)
    const rulesBreakdown = scoringRules
      .filter(r => (breakdown[r.id] || 0) !== 0)
      .map(r => {
        const pts = breakdown[r.id] || 0;
        return `<div style="display:flex;justify-content:space-between;padding:5px 10px;border-radius:var(--r-sm);background:var(--bg-surface);font-size:12px">
          <span>${r.icon} ${escapeHtml(r.name)}</span>
          <span style="font-weight:600;color:${pts >= 0 ? 'var(--success)' : 'var(--danger)'}">${pts >= 0 ? '+' : ''}${pts.toFixed(1)}</span>
        </div>`;
      }).join('');

    html += `<tr id="bd-${i}" class="breakdown-detail-row" style="display:none">
      <td colspan="7">
        <div style="padding:8px 16px 12px;background:var(--bg-inset);border-radius:var(--r-md);margin:4px 0">
          <div style="font-size:11px;font-weight:600;margin-bottom:8px;color:var(--text-muted);letter-spacing:0.5px">DETALHAMENTO — PONTOS GANHOS E PERDIDOS</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px">${rulesBreakdown}</div>
        </div>
      </td>
    </tr>`;
  });
  html += '</tbody></table></div></div>';

  // Medals section
  html += '<div style="margin-top:var(--s-6)"><h3 style="font-size:15px;font-weight:600;margin-bottom:var(--s-3);color:var(--text-strong)">🏅 Medalhas e Conquistas</h3>';
  const allMedals = [
    { icon: '🥇', name: 'Ouro', desc: '1º lugar no ranking geral' },
    { icon: '🥈', name: 'Prata', desc: '2º lugar no ranking geral' },
    { icon: '🥉', name: 'Bronze', desc: '3º lugar no ranking geral' },
    { icon: '💎', name: 'Diamante', desc: 'Acumular 100+ pontos' },
    { icon: '🏅', name: 'Excelência', desc: 'Acumular 50+ pontos' },
    { icon: '🎖️', name: 'Destaque', desc: 'Acumular 20+ pontos' },
    { icon: '⭐', name: 'Qualidade', desc: 'Score médio ≥ 4.5' },
    { icon: '🔥', name: 'Sequência', desc: '3+ meses consecutivos com score ≥ 4.0' },
  ];

  html += '<div class="medals-grid">';
  allMedals.forEach(m => {
    let earned = false;
    if (m.name === 'Ouro') earned = ranking.length > 0 && ranking[0].score.total >= 0;
    if (m.name === 'Prata') earned = ranking.length > 1;
    if (m.name === 'Bronze') earned = ranking.length > 2;
    if (m.name === 'Diamante') earned = ranking.some(r => r.score.total >= 100);
    if (m.name === 'Excelência') earned = ranking.some(r => r.score.total >= 50);
    if (m.name === 'Destaque') earned = ranking.some(r => r.score.total >= 20);
    if (m.name === 'Qualidade') {
      earned = ranking.some(r => {
        const records = _gfData().filter(rec => rec && String(rec['Atendente']) === r.name);
        const scores = records.map(rec => rec['SCORE']).filter(v => v !== null && v !== undefined);
        const avg = scores.length ? scores.reduce((a, b) => a + Number(b), 0) / scores.length : 0;
        return avg >= 4.5;
      });
    }
    if (m.name === 'Sequência') earned = ranking.some(r => computeStreak(r.name).count >= 3);

    html += `<div class="medal-card ${earned ? 'earned' : 'locked'}">
      <div class="medal-icon">${m.icon}</div>
      <div class="medal-name">${m.name}</div>
      <div class="medal-desc">${m.desc}</div>
      ${earned ? '<div style="font-size:10px;color:var(--success);font-weight:600">✅ Desbloqueada</div>' : '<div style="font-size:10px;color:var(--text-muted)">🔒 Bloqueada</div>'}
    </div>`;
  });
  html += '</div></div>';

  // Heatmap section
  if (months.length) {
    html += '<div style="margin-top:var(--s-6)"><h3 style="font-size:15px;font-weight:600;margin-bottom:var(--s-3);color:var(--text-strong)">🗓️ Heatmap Mensal — Pontuação</h3>';
    const topN = ranking.slice(0, 10);
    html += '<div class="heatmap">';
    topN.forEach(item => {
      const name = item.name;
      html += '<div class="heatmap-row">';
      html += `<div class="heatmap-label" title="${escapeHtml(name)}">${escapeHtml(getDisplayName(name, aliasMap))}</div>`;
      html += '<div class="heatmap-cells">';
      const levels = [0, 1, 2, 3, 4];
      months.forEach(m => {
        const score = monthlyScores[name] && monthlyScores[name][m];
        let level = 0;
        if (score !== undefined) {
          const maxScore = Math.max(...ranking.map(r => {
            const s = monthlyScores[r.name] && monthlyScores[r.name][m];
            return s || 0;
          }), 1);
          const ratio = score / maxScore;
          if (ratio > 0.8) level = 4;
          else if (ratio > 0.6) level = 3;
          else if (ratio > 0.4) level = 2;
          else if (ratio > 0.2) level = 1;
        }
        html += `<div class="heatmap-cell level-${level}" title="${escapeHtml(m)}: ${score !== undefined ? score.toFixed(1) : 0} pts"></div>`;
      });
      html += '</div></div>';
    });
    html += '<div class="heatmap-row" style="margin-top:4px"><div class="heatmap-label"></div><div class="heatmap-cells">';
    months.forEach(m => {
      html += `<div style="width:20px;font-size:8px;color:var(--text-muted);text-align:center;overflow:hidden;text-overflow:ellipsis">${m.slice(5)}</div>`;
    });
    html += '</div></div></div></div>';
  }

  // Individual evolution chart with collaborator selector
  if (months.length && ranking.length) {
    const names = ranking.map(r => r.name);
    const selectedName = window.__selectedEvolutionColab || ranking[0].name;
    html += `<div style="margin-top:var(--s-6)">
      <div style="display:flex;align-items:center;gap:var(--s-3);margin-bottom:var(--s-3);flex-wrap:wrap">
        <h3 style="font-size:15px;font-weight:600;color:var(--text-strong);margin:0">📈 Evolução Individual</h3>
        <select id="evolutionColabSelect" style="flex:1;max-width:260px;padding:6px 10px;border-radius:var(--r-sm);border:1px solid var(--border);background:var(--bg-surface);color:var(--text);font-size:13px">
          ${names.map(n => `<option value="${escapeHtml(n)}" ${n === selectedName ? 'selected' : ''}>${escapeHtml(getDisplayName(n, aliasMap))}</option>`).join('')}
        </select>
        <span id="evolutionAvgBadge" style="font-size:13px;color:var(--text-secondary)"></span>
      </div>
      <div class="chart-area"><div class="chart-scroll"><div class="chart-inner" style="height:280px"><canvas id="individualEvolutionChart"></canvas></div></div></div>
    </div>`;
  }

  container.innerHTML = html;

  // Bind view-colab buttons
  container.querySelectorAll('.view-colab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const name = btn.getAttribute('data-name');
      if (typeof openColabDetail === 'function') openColabDetail(name);
    });
  });

  // Bind breakdown toggle buttons
  container.querySelectorAll('.breakdown-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');
      const row = document.getElementById(targetId);
      if (row) {
        const isHidden = row.style.display === 'none';
        row.style.display = isHidden ? 'table-row' : 'none';
        btn.textContent = isHidden ? '🔽 Ocultar' : '🔍 Detalhar';
      }
    });
  });

  // Bind foto buttons
  container.querySelectorAll('.foto-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!requireAdmin()) return;
      const name = btn.getAttribute('data-name');
      if (!name) return;
      const current = typeof getColabFoto === 'function' ? getColabFoto(name) : '';
      const url = prompt(`URL da foto para ${name}${current ? '\n(Deixe vazio para remover)' : ''}`, current);
      if (url === null) return;
      if (typeof setColabFoto === 'function') setColabFoto(name, url.trim());
      renderGamification();
    });
  });

  // Render individual evolution chart & bind selector
  const indivCanvas = document.getElementById('individualEvolutionChart');
  if (indivCanvas && typeof Chart !== 'undefined') {
    const selectedName = window.__selectedEvolutionColab || ranking[0].name;
    renderIndividualScoreChart(selectedName, months, ranking, aliasMap);
    const select = document.getElementById('evolutionColabSelect');
    if (select) {
      select.addEventListener('change', () => {
        window.__selectedEvolutionColab = select.value;
        renderIndividualScoreChart(select.value, months, ranking, aliasMap);
      });
    }
  }
}

function renderIndividualScoreChart(name, months, ranking, aliasMap) {
  const canvas = document.getElementById('individualEvolutionChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  // Compute monthly SCORE averages for this collaborator
  const data = _gfData();
  const records = data.filter(r => r && String(r['Atendente']) === name);
  const scores = months.map(m => {
    const monthRows = records.filter(r => String(r['Mês']) === m);
    const vals = monthRows.map(r => r['SCORE']).filter(v => v !== null && v !== undefined && !isNaN(Number(v)));
    return vals.length ? vals.reduce((a, b) => a + Number(b), 0) / vals.length : null;
  });

  // Update badge
  const badge = document.getElementById('evolutionAvgBadge');
  if (badge) {
    const valid = scores.filter(s => s !== null);
    const avg = valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : 0;
    const pos = ranking.findIndex(r => r.name === name) + 1;
    badge.textContent = `Score médio: ${avg.toFixed(2)} · #${pos}º no ranking`;
  }

  // Determine color based on score trend
  const lastVal = scores.filter(s => s !== null).slice(-1)[0] || 0;
  const lineColor = lastVal >= 4 ? 'rgba(16,185,129,0.9)' : (lastVal >= 3 ? 'rgba(249,115,22,0.9)' : 'rgba(239,68,68,0.9)');

  if (window.__individualEvolutionChart) {
    try { window.__individualEvolutionChart.destroy(); } catch (e) {}
  }

  window.__individualEvolutionChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: months,
      datasets: [{
        label: getDisplayName(name, aliasMap),
        data: scores,
        borderColor: lineColor,
        backgroundColor: lineColor.replace('0.9', '0.1'),
        tension: 0.3,
        fill: true,
        pointRadius: 5,
        pointBackgroundColor: scores.map(s => s !== null ? lineColor : 'transparent'),
        spanGaps: false
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.92)',
          titleColor: '#f8fafc',
          bodyColor: '#e2e8f0',
          padding: 12,
          cornerRadius: 10,
          callbacks: {
            label: (ctx) => `Score: ${ctx.parsed.y !== null ? ctx.parsed.y.toFixed(2) : '—'}`
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          suggestedMax: 5,
          grid: { color: 'rgba(148,163,184,0.14)' },
          ticks: { font: { size: 11.5 }, stepSize: 1 }
        },
        x: {
          grid: { display: false },
          ticks: { font: { size: 11.5 } }
        }
      }
    }
  });
}

// Tab activation hook
function onGamificationTabActivated() {
  invalidateGamificationCache();
  renderGamification();
}
