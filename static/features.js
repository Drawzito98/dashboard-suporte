// ── Features Module ──
// Keyboard shortcuts help, Export PNG, Compare months, Monthly summary

(function () {
  'use strict';

  // ═══════════════════════════════════════════
  // 1. KEYBOARD SHORTCUTS HELP MODAL
  // ═══════════════════════════════════════════
  function showShortcutsHelp() {
    const existing = document.getElementById('shortcutsModal');
    if (existing) { existing.style.display = 'flex'; return; }

    const shortcuts = [
      { keys: ['1-9'], desc: 'Navegar entre abas' },
      { keys: ['/'], desc: 'Focar na busca global' },
      { keys: ['?'], desc: 'Abrir esta ajuda' },
      { keys: ['Esc'], desc: 'Fechar painéis/modais' },
      { keys: ['Ctrl', 'S'], desc: 'Salvar avaliação' },
    ];
    const tabNames = [
      ['1', 'Início'], ['2', 'Dashboard'], ['3', 'Relatório'],
      ['4', 'Gamificação'], ['5', 'Tarefas'], ['6', 'Colaboradores'],
      ['7', 'Líder'], ['8', 'Insights'], ['9', 'Avaliação']
    ];

    const overlay = document.createElement('div');
    overlay.id = 'shortcutsModal';
    overlay.className = 'modal-overlay';
    overlay.style.cssText = 'display:flex;z-index:10000';

    overlay.innerHTML = `
      <div class="modal-box" style="max-width:480px;width:90%;padding:0;overflow:hidden">
        <div style="padding:20px 24px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between">
          <h3 style="margin:0;font-size:1.1em">Atalhos de teclado</h3>
          <button class="btn-small shortcuts-close-btn" style="font-size:18px;line-height:1;padding:4px 8px;border:none;background:none;cursor:pointer;color:var(--muted)">✕</button>
        </div>
        <div style="padding:16px 24px;max-height:60vh;overflow-y:auto">
          <div style="margin-bottom:16px">
            <div style="font-size:12px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px">Navegação</div>
            ${tabNames.map(([num, name]) => `
              <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border)">
                <span style="font-size:13px">${name}</span>
                <kbd style="background:var(--bg);border:1px solid var(--border);border-radius:4px;padding:2px 8px;font-size:12px;font-family:monospace">${num}</kbd>
              </div>
            `).join('')}
          </div>
          <div>
            <div style="font-size:12px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px">Ações</div>
            ${shortcuts.map(s => `
              <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border)">
                <span style="font-size:13px">${s.desc}</span>
                <div style="display:flex;gap:4px">${s.keys.map(k => `<kbd style="background:var(--bg);border:1px solid var(--border);border-radius:4px;padding:2px 8px;font-size:12px;font-family:monospace">${k}</kbd>`).join('<span style="color:var(--muted);font-size:10px">+</span>')}</div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay || e.target.classList.contains('shortcuts-close-btn')) {
        overlay.style.display = 'none';
      }
    });
    overlay.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') overlay.style.display = 'none';
    });

    document.body.appendChild(overlay);
  }
  window.showShortcutsHelp = showShortcutsHelp;

  // ═══════════════════════════════════════════
  // 2. GLOBAL SEARCH
  // ═══════════════════════════════════════════
  function escapeH(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  // ═══════════════════════════════════════════
  // 3. EXPORT DASHBOARD AS IMAGE
  // ═══════════════════════════════════════════
  function initExportButton() {
    const btn = document.createElement('button');
    btn.className = 'export-png-btn';
    btn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
      Exportar imagem
    `;
    btn.title = 'Baixar imagem do dashboard atual';
    btn.style.display = 'none';

    const tabBar = document.getElementById('tabBar');
    if (tabBar) tabBar.parentNode.insertBefore(btn, tabBar.nextSibling);

    // Show only on dashboard tab
    const observer = new MutationObserver(function () {
      const activeTab = document.querySelector('.tab-btn.active');
      btn.style.display = activeTab && activeTab.dataset.tab === 'dashboard' ? 'inline-flex' : 'none';
    });
    const tabBarEl = document.getElementById('tabBar');
    if (tabBarEl) observer.observe(tabBarEl, { attributes: true, subtree: true, attributeFilter: ['class'] });

    btn.addEventListener('click', async function () {
      btn.disabled = true;
      btn.innerHTML = '<span class="export-spinner"></span> Gerando...';

      try {
        // Use html2canvas if available, otherwise fallback to simple approach
        if (typeof html2canvas !== 'undefined') {
          const dashboardPanel = document.querySelector('[data-tab-content="dashboard"]') || document.querySelector('.main-content');
          if (dashboardPanel) {
            const canvas = await html2canvas(dashboardPanel, { scale: 2, useCORS: true, backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--surface').trim() || '#fff' });
            const link = document.createElement('a');
            link.download = `dashboard_${new Date().toISOString().slice(0, 10)}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
          }
        } else {
          // Fallback: copy canvas charts to a single image
          const canvases = document.querySelectorAll('.main-content canvas');
          if (canvases.length) {
            const c = document.createElement('canvas');
            const totalH = Array.from(canvases).reduce((sum, cv) => sum + cv.height, 0);
            const maxW = Math.max(...Array.from(canvases).map(cv => cv.width));
            c.width = maxW;
            c.height = totalH;
            const ctx = c.getContext('2d');
            ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--surface').trim() || '#fff';
            ctx.fillRect(0, 0, c.width, c.height);
            let y = 0;
            canvases.forEach(cv => {
              ctx.drawImage(cv, 0, y);
              y += cv.height;
            });
            const link = document.createElement('a');
            link.download = `dashboard_${new Date().toISOString().slice(0, 10)}.png`;
            link.href = c.toDataURL('image/png');
            link.click();
          }
        }
        if (typeof showToast === 'function') showToast('Imagem exportada!', 'success');
      } catch (err) {
        console.error('Export error:', err);
        if (typeof showToast === 'function') showToast('Erro ao exportar imagem', 'error');
      } finally {
        btn.disabled = false;
        btn.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Exportar imagem`;
      }
    });
  }

  // ═══════════════════════════════════════════
  // 4. MONTHLY COMPARISON VISUAL
  // ═══════════════════════════════════════════
  function initCompareMonths() {
    const compareBtn = document.createElement('button');
    compareBtn.className = 'compare-months-btn';
    compareBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
      Comparar meses
    `;
    compareBtn.style.display = 'none';

    const tabBar = document.getElementById('tabBar');
    if (tabBar) tabBar.parentNode.insertBefore(compareBtn, tabBar.nextSibling);

    const observer = new MutationObserver(function () {
      const activeTab = document.querySelector('.tab-btn.active');
      compareBtn.style.display = activeTab && activeTab.dataset.tab === 'dashboard' ? 'inline-flex' : 'none';
    });
    const tabBarEl = document.getElementById('tabBar');
    if (tabBarEl) observer.observe(tabBarEl, { attributes: true, subtree: true, attributeFilter: ['class'] });

    compareBtn.addEventListener('click', function () {
      showCompareModal();
    });
  }

  function showCompareModal() {
    const existing = document.getElementById('compareModal');
    if (existing) { existing.style.display = 'flex'; return; }

    // Get available months from data
    const months = new Set();
    if (window.rawRecords) {
      window.rawRecords.forEach(r => {
        if (r.data) {
          const d = new Date(r.data + 'T12:00:00');
          months.add(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'));
        }
      });
    }
    const sorted = Array.from(months).sort().reverse();

    function getDataForMonth(ym) {
      if (!window.rawRecords) return null;
      const [y, m] = ym.split('-').map(Number);
      return window.rawRecords.filter(r => {
        if (!r.data) return false;
        const d = new Date(r.data + 'T12:00:00');
        return d.getFullYear() === y && (d.getMonth() + 1) === m;
      });
    }

    function calcStats(data) {
      if (!data || !data.length) return { total: 0, avgScore: 0, motivos: {}, setores: {} };
      const motivos = {};
      const setores = {};
      let totalScore = 0;
      let scored = 0;
      data.forEach(r => {
        motivos[r.motivo || 'Outro'] = (motivos[r.motivo || 'Outro'] || 0) + 1;
        setores[r.setor || 'Sem setor'] = (setores[r.setor || 'Sem setor'] || 0) + 1;
        if (r.nota != null) { totalScore += Number(r.nota); scored++; }
      });
      return { total: data.length, avgScore: scored ? (totalScore / scored).toFixed(1) : '–', motivos, setores };
    }

    const overlay = document.createElement('div');
    overlay.id = 'compareModal';
    overlay.className = 'modal-overlay';
    overlay.style.cssText = 'display:flex;z-index:10000';

    overlay.innerHTML = `
      <div class="modal-box" style="max-width:800px;width:95%;padding:0;overflow:hidden">
        <div style="padding:20px 24px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between">
          <h3 style="margin:0;font-size:1.1em">Comparar meses</h3>
          <button class="btn-small compare-close-btn" style="font-size:18px;line-height:1;padding:4px 8px;border:none;background:none;cursor:pointer;color:var(--muted)">✕</button>
        </div>
        <div style="padding:20px 24px">
          <div style="display:flex;gap:12px;margin-bottom:20px">
            <div style="flex:1">
              <label style="font-size:12px;font-weight:600;color:var(--muted);display:block;margin-bottom:4px">Mês 1</label>
              <select id="compareMonth1" style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius);background:var(--bg);color:var(--text);font-size:14px">
                ${sorted.map((m, i) => `<option value="${m}" ${i === 0 ? 'selected' : ''}>${formatMonth(m)}</option>`)}
              </select>
            </div>
            <div style="flex:1">
              <label style="font-size:12px;font-weight:600;color:var(--muted);display:block;margin-bottom:4px">Mês 2</label>
              <select id="compareMonth2" style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius);background:var(--bg);color:var(--text);font-size:14px">
                ${sorted.map((m, i) => `<option value="${m}" ${i === 1 ? 'selected' : i === 0 && sorted.length > 1 ? '' : i === 0 ? 'selected' : ''}>${formatMonth(m)}</option>`)}
              </select>
            </div>
            <div style="display:flex;align-items:end">
              <button id="compareGoBtn" class="btn" style="white-space:nowrap">Comparar</button>
            </div>
          </div>
          <div id="compareResults" style="min-height:100px"></div>
        </div>
      </div>
    `;

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay || e.target.classList.contains('compare-close-btn')) overlay.style.display = 'none';
    });
    overlay.addEventListener('keydown', function (e) { if (e.key === 'Escape') overlay.style.display = 'none'; });

    document.body.appendChild(overlay);

    document.getElementById('compareGoBtn').addEventListener('click', function () {
      const m1 = document.getElementById('compareMonth1').value;
      const m2 = document.getElementById('compareMonth2').value;
      const s1 = calcStats(getDataForMonth(m1));
      const s2 = calcStats(getDataForMonth(m2));
      const results = document.getElementById('compareResults');

      function diff(a, b) {
        const na = parseFloat(a), nb = parseFloat(b);
        if (isNaN(na) || isNaN(nb)) return '–';
        const d = na - nb;
        const sign = d > 0 ? '+' : '';
        return `<span style="color:${d > 0 ? 'var(--success)' : d < 0 ? 'var(--danger)' : 'var(--muted)'}">${sign}${d.toFixed(1)}</span>`;
      }

      // Top motivos for each month
      function topMotivos(motivos) {
        return Object.entries(motivos).sort((a, b) => b[1] - a[1]).slice(0, 5);
      }

      results.innerHTML = `
        <div style="display:grid;grid-template-columns:1fr auto 1fr;gap:16px">
          <div class="compare-card">
            <div style="font-weight:600;margin-bottom:12px;color:var(--primary)">${formatMonth(m1)}</div>
            <div class="compare-stat"><span>Total</span><strong>${s1.total}</strong></div>
            <div class="compare-stat"><span>Score médio</span><strong>${s1.avgScore}</strong></div>
            <div style="margin-top:12px;font-size:12px;font-weight:600;color:var(--muted)">Top motivos</div>
            ${topMotivos(s1.motivos).map(([m, c]) => `<div class="compare-stat"><span>${m}</span><strong>${c}</strong></div>`).join('')}
          </div>
          <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:0 12px">
            <div class="compare-diff-label">Total</div>
            <div class="compare-diff-value">${diff(s1.total, s2.total)}</div>
            <div class="compare-diff-label">Score</div>
            <div class="compare-diff-value">${diff(s1.avgScore, s2.avgScore)}</div>
          </div>
          <div class="compare-card">
            <div style="font-weight:600;margin-bottom:12px;color:var(--primary)">${formatMonth(m2)}</div>
            <div class="compare-stat"><span>Total</span><strong>${s2.total}</strong></div>
            <div class="compare-stat"><span>Score médio</span><strong>${s2.avgScore}</strong></div>
            <div style="margin-top:12px;font-size:12px;font-weight:600;color:var(--muted)">Top motivos</div>
            ${topMotivos(s2.motivos).map(([m, c]) => `<div class="compare-stat"><span>${m}</span><strong>${c}</strong></div>`).join('')}
          </div>
        </div>
      `;
    });

    // Auto-trigger
    document.getElementById('compareGoBtn').click();
  }

  function formatMonth(ym) {
    const [y, m] = ym.split('-').map(Number);
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    return months[m - 1] + ' ' + y;
  }

  // ═══════════════════════════════════════════
  // 5. MONTHLY SUMMARY (AUTO-GENERATED)
  // ═══════════════════════════════════════════
  function initMonthlySummary() {
    const btn = document.createElement('button');
    btn.className = 'monthly-summary-btn';
    btn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
      Resumo mensal
    `;
    btn.style.display = 'none';

    const tabBar = document.getElementById('tabBar');
    if (tabBar) tabBar.parentNode.insertBefore(btn, tabBar.nextSibling);

    const observer = new MutationObserver(function () {
      const activeTab = document.querySelector('.tab-btn.active');
      btn.style.display = activeTab && activeTab.dataset.tab === 'home' ? 'inline-flex' : 'none';
    });
    const tabBarEl = document.getElementById('tabBar');
    if (tabBarEl) observer.observe(tabBarEl, { attributes: true, subtree: true, attributeFilter: ['class'] });

    btn.addEventListener('click', showMonthlySummary);
  }

  function showMonthlySummary() {
    const now = new Date();
    // Use mês anterior (app sempre tem dados do mês anterior)
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonth = prev.getMonth();
    const prevYear = prev.getFullYear();
    const monthNames = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

    // Filter previous month data
    const monthData = (window.rawRecords || []).filter(r => {
      if (!r.data) return false;
      const d = new Date(r.data + 'T12:00:00');
      return d.getMonth() === prevMonth && d.getFullYear() === prevYear;
    });

    if (!monthData.length) {
      if (typeof showToast === 'function') showToast('Sem registros do mês anterior ainda', 'info');
      return;
    }

    // Calculate stats
    const ranking = window.getOverallRanking ? window.getOverallRanking(monthData) : [];
    const total = monthData.length;
    const motivos = {};
    const setores = {};
    let totalScore = 0, scored = 0;

    monthData.forEach(r => {
      motivos[r.motivo || 'Outro'] = (motivos[r.motivo || 'Outro'] || 0) + 1;
      setores[r.setor || 'Sem setor'] = (setores[r.setor || 'Sem setor'] || 0) + 1;
      if (r.nota != null) { totalScore += Number(r.nota); scored++; }
    });

    const avgScore = scored ? (totalScore / scored).toFixed(1) : '–';
    const topMotivos = Object.entries(motivos).sort((a, b) => b[1] - a[1]).slice(0, 3);
    const topSetor = Object.entries(setores).sort((a, b) => b[1] - a[1])[0];

    // Build summary text
    const lines = [];
    lines.push(`📊 Resumo — ${monthNames[prevMonth].charAt(0).toUpperCase() + monthNames[prevMonth].slice(1)} ${prevYear}`);
    lines.push('');
    lines.push(`📋 Total de registros: ${total}`);
    lines.push(`⭐ Score médio: ${avgScore}`);
    if (ranking.length) {
      lines.push(`🏆 Melhor: ${ranking[0].name} (${ranking[0].score})`);
    }
    if (topMotivos.length) {
      lines.push(`🔍 Motivos principais: ${topMotivos.map(([m, c]) => `${m} (${c})`).join(', ')}`);
    }
    if (topSetor) {
      lines.push(`🏢 Setor com mais demandas: ${topSetor[0]} (${topSetor[1]})`);
    }

    // Tarefas pending
    try {
      const raw = localStorage.getItem('sistema_tarefas_v1');
      if (raw) {
        const tasks = JSON.parse(raw);
        const pending = tasks.filter(t => t.status !== 'concluida');
        if (pending.length) lines.push(`📌 Tarefas pendentes: ${pending.length}`);
      }
    } catch (e) {}

    const text = lines.join('\n');

    const overlay = document.createElement('div');
    overlay.id = 'summaryModal';
    overlay.className = 'modal-overlay';
    overlay.style.cssText = 'display:flex;z-index:10000';

    overlay.innerHTML = `
      <div class="modal-box" style="max-width:520px;width:90%;padding:0;overflow:hidden">
        <div style="padding:20px 24px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between">
          <h3 style="margin:0;font-size:1.1em">Resumo mensal automático</h3>
          <button class="btn-small summary-close-btn" style="font-size:18px;line-height:1;padding:4px 8px;border:none;background:none;cursor:pointer;color:var(--muted)">✕</button>
        </div>
        <div style="padding:20px 24px">
          <pre class="summary-text">${escapeH(text)}</pre>
          <div style="display:flex;gap:8px;margin-top:16px">
            <button class="btn summary-copy-btn" style="flex:1">📋 Copiar texto</button>
            <button class="btn summary-close-go" style="flex:1;background:var(--border);color:var(--text)">Fechar</button>
          </div>
        </div>
      </div>
    `;

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay || e.target.classList.contains('summary-close-btn') || e.target.classList.contains('summary-close-go')) {
        overlay.style.display = 'none';
      }
    });
    overlay.addEventListener('keydown', function (e) { if (e.key === 'Escape') overlay.style.display = 'none'; });

    document.body.appendChild(overlay);

    overlay.querySelector('.summary-copy-btn').addEventListener('click', function () {
      navigator.clipboard.writeText(text).then(function () {
        if (typeof showToast === 'function') showToast('Resumo copiado!', 'success');
      }).catch(function () {
        // Fallback
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        if (typeof showToast === 'function') showToast('Resumo copiado!', 'success');
      });
    });
  }

  // ═══════════════════════════════════════════
  // INIT
  // ═══════════════════════════════════════════
  function init() {
    initExportButton();
    initCompareMonths();
    initMonthlySummary();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
