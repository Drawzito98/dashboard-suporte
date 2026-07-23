// home.js — Painel inicial com visão geral

function renderHome() {
  const container = document.getElementById('homeContent');
  if (!container) return;

  const records = rawRecords || [];
  const activeColabs = records.filter(r => r && r['Atendente'] && !isAggregateName(r['Atendente']));
  const uniqueColabs = [...new Set(activeColabs.map(r => r['Atendente']))].sort();
  const meses = [...new Set(records.filter(r => r && r['Mês']).map(r => r['Mês']))].sort();
  const lastMonth = meses[meses.length - 1] || '';
  const prevMonth = meses.length > 1 ? meses[meses.length - 2] : '';

  // KPI calculations
  const totalRecords = records.length;
  const activeCount = uniqueColabs.length;
  const lastMonthRecords = records.filter(r => r && r['Mês'] === lastMonth);
  const avgScore = lastMonthRecords.length
    ? (lastMonthRecords.reduce((s, r) => s + Number(r['SCORE'] || 0), 0) / lastMonthRecords.length).toFixed(2)
    : '—';
  const totalFinalizados = records.reduce((s, r) => s + Number(r['Finalizados'] || 0), 0);

  // Pending tasks
  let pendingTasks = 0;
  try {
    const tarefas = JSON.parse(localStorage.getItem('sistema_tarefas_v1') || '[]');
    pendingTasks = tarefas.filter(t => t.status === 'pendente').length;
  } catch (e) {}

  // Monthly trend data (last 6 months)
  const trendMonths = meses.slice(-6);
  const trendData = trendMonths.map(m => {
    const monthRecs = records.filter(r => r && r['Mês'] === m && !isAggregateName(r['Atendente']));
    const avg = monthRecs.length
      ? monthRecs.reduce((s, r) => s + Number(r['SCORE'] || 0), 0) / monthRecs.length
      : 0;
    return { month: m, avg: Number(avg.toFixed(2)), total: monthRecs.reduce((s, r) => s + Number(r['Finalizados'] || 0), 0) };
  });

  // Recent activity from historico
  let recentActivity = [];
  try {
    if (typeof dbHistoricoLoad === 'function') {
      recentActivity = dbHistoricoLoad().slice(-5).reverse();
    }
  } catch (e) {}

  // Build HTML
  let html = '';

  // ── Section 1: Welcome + KPIs ──
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
  const userName = currentUser?.user_metadata?.name
    || document.getElementById('currentUserDisplay')?.textContent?.trim()
    || 'Usuário';

  html += `<div class="home-welcome">
    <h2>${greeting}, ${escapeHtml(userName)}</h2>
    <p>Aqui está o resumo da sua equipe</p>
  </div>`;

  html += `<div class="home-kpi-grid">
    <div class="home-kpi">
      <div class="home-kpi-icon" style="background:var(--accent-soft);color:var(--accent)"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></div>
      <div class="home-kpi-value">${activeCount}</div>
      <div class="home-kpi-label">Colaboradores ativos</div>
    </div>
    <div class="home-kpi">
      <div class="home-kpi-icon" style="background:var(--success-soft);color:var(--success)"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>
      <div class="home-kpi-value">${totalRecords.toLocaleString('pt-BR')}</div>
      <div class="home-kpi-label">Registros totais</div>
    </div>
    <div class="home-kpi">
      <div class="home-kpi-icon" style="background:var(--warning-soft);color:var(--warning)"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg></div>
      <div class="home-kpi-value ${Number(avgScore) >= 4.5 ? 'score-excelente' : Number(avgScore) < 4 ? 'score-critico' : ''}">${avgScore}</div>
      <div class="home-kpi-label">Score médio · ${lastMonth || '—'}</div>
    </div>
    <div class="home-kpi">
      <div class="home-kpi-icon" style="background:var(--info-soft);color:var(--info)"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></div>
      <div class="home-kpi-value">${pendingTasks}</div>
      <div class="home-kpi-label">Tarefas pendentes</div>
    </div>
  </div>`;

  // ── Section 2: Quick Actions ──
  html += `<div class="home-section">
    <h3 class="home-section-title">Ações rápidas</h3>
    <div class="home-actions-grid">
      <button class="home-action-btn" onclick="document.getElementById('startBtn').click()">
        <div class="home-action-icon" style="background:var(--accent-soft);color:var(--accent)"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg></div>
        <span>Importar CSV</span>
      </button>
      <button class="home-action-btn" onclick="document.getElementById('addRowTopBtn')?.click()">
        <div class="home-action-icon" style="background:var(--success-soft);color:var(--success)"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></div>
        <span>Novo registro</span>
      </button>
      <button class="home-action-btn" onclick="document.getElementById('generateReportBtn')?.click()">
        <div class="home-action-icon" style="background:var(--warning-soft);color:var(--warning)"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="12" width="4" height="8"/><rect x="10" y="6" width="4" height="14"/><rect x="17" y="9" width="4" height="11"/></svg></div>
        <span>Gerar relatório</span>
      </button>
      <button class="home-action-btn" onclick="document.getElementById('anotacoesBtn')?.click()">
        <div class="home-action-icon" style="background:var(--info-soft);color:var(--info)"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg></div>
        <span>Anotações</span>
      </button>
      <button class="home-action-btn" onclick="document.getElementById('backupCsvBtn')?.click()">
        <div class="home-action-icon" style="background:var(--danger-soft);color:var(--danger)"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></div>
        <span>Backup CSV</span>
      </button>
      <button class="home-action-btn" onclick="document.getElementById('reportesBtn')?.click()">
        <div class="home-action-icon" style="background:var(--accent-soft);color:var(--accent)"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg></div>
        <span>Reportes</span>
      </button>
    </div>
  </div>`;

  // ── Section 3: Recent Activity ──
  if (recentActivity.length > 0) {
    html += `<div class="home-section">
      <h3 class="home-section-title">Atividade recente</h3>
      <div class="home-activity-list">`;
    recentActivity.forEach(item => {
      const time = item.data ? new Date(item.data).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
      html += `<div class="home-activity-item">
        <div class="home-activity-dot"></div>
        <div class="home-activity-body">
          <span class="home-activity-text">${escapeHtml(item.descricao || item.acao || 'Alteração')}</span>
          <span class="home-activity-time">${time}</span>
        </div>
      </div>`;
    });
    html += `</div></div>`;
  }

  // ── Section 5: Mini Trend Chart ──
  if (trendData.length > 1) {
    html += `<div class="home-section">
      <h3 class="home-section-title">Tendência dos últimos meses</h3>
      <div class="home-trend-chart">
        <canvas id="homeTrendCanvas" height="120"></canvas>
      </div>
    </div>`;
  }

  container.innerHTML = html;

  // Render mini trend chart
  if (trendData.length > 1) {
    setTimeout(() => renderHomeTrendChart(trendData), 100);
  }
}

function renderHomeTrendChart(data) {
  const canvas = document.getElementById('homeTrendCanvas');
  if (!canvas || typeof Chart === 'undefined') return;

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const textColor = isDark ? '#b0bcd4' : '#4a4540';

  const accentColor = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#2563eb';
  const successColor = getComputedStyle(document.documentElement).getPropertyValue('--success').trim() || '#047857';

  new Chart(canvas, {
    type: 'line',
    data: {
      labels: data.map(d => d.month),
      datasets: [
        {
          label: 'Score Médio',
          data: data.map(d => d.avg),
          borderColor: accentColor,
          backgroundColor: accentColor + '18',
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointHoverRadius: 6,
          borderWidth: 2,
          yAxisID: 'y'
        },
        {
          label: 'Finalizados',
          data: data.map(d => d.total),
          borderColor: successColor,
          backgroundColor: 'transparent',
          borderDash: [4, 4],
          tension: 0.4,
          pointRadius: 3,
          pointHoverRadius: 5,
          borderWidth: 2,
          yAxisID: 'y1'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { position: 'bottom', labels: { font: { size: 11, family: 'Inter' }, padding: 16, color: textColor, usePointStyle: true, pointStyle: 'circle' } } },
      scales: {
        x: { grid: { display: false }, ticks: { color: textColor, font: { size: 11 } } },
        y: { position: 'left', grid: { color: gridColor }, ticks: { color: textColor, font: { size: 11 } }, title: { display: true, text: 'Score', color: textColor, font: { size: 10 } } },
        y1: { position: 'right', grid: { drawOnChartArea: false }, ticks: { color: textColor, font: { size: 11 } }, title: { display: true, text: 'Finalizados', color: textColor, font: { size: 10 } } }
      }
    }
  });
}

function onHomeTabActivated() {
  renderHome();
}
