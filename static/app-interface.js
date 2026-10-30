// Tema, notificações, busca rápida e acessibilidade da interface.
/* ===== Theme toggle (light/dark) ===== */
(function(){
  function getTheme(){
    return document.documentElement.getAttribute('data-theme') || 'light';
  }
  function setTheme(t){
    document.documentElement.setAttribute('data-theme', t);
    try { appStorage.setItem('theme', t); } catch(e) { console.warn('[App] Erro ao salvar tema:', e); }
    if (typeof Chart !== 'undefined' && Chart.defaults) {
      if (typeof ChartTheme !== 'undefined') {
        ChartTheme.applyDefaults();
      } else {
        Chart.defaults.color = t === 'dark' ? '#e2e8f0' : '#1f2937';
      }
    }
    updateButtons(t);
    updateChartTheme();
  }
  function updateButtons(t){
    document.querySelectorAll('.theme-toggle').forEach(function(btn){
      btn.textContent = t === 'dark' ? '☀️' : '🌙';
      btn.setAttribute('aria-label', t === 'dark' ? 'Modo claro' : 'Modo escuro');
    });
  }
  function updateChartTheme(){
    if(typeof Chart === 'undefined') return;
    try {
      if(Chart.instances) {
        Object.values(Chart.instances).forEach(function(c){ try { c.update(); } catch(e){ console.warn('[App] Erro ao atualizar chart:', e); } });
      } else if(Chart.registry){
        document.querySelectorAll('canvas').forEach(function(canvas){
          const inst = Chart.getChart(canvas);
          if(inst) try { inst.update(); } catch(e){ console.warn('[App] Erro ao atualizar chart:', e); }
        });
      }
    } catch(e) { console.error('[App] Erro ao alternar tema:', e); }
  }
  function init(){
    const saved = appStorage.getItem('theme');
    if(saved === 'dark' || saved === 'light') setTheme(saved);
    else if(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) setTheme('dark');
    else setTheme('light');
    document.querySelectorAll('.theme-toggle').forEach(function(btn){
      btn.addEventListener('click', function(){
        // Manual toggle — save preference
        setTheme(getTheme() === 'dark' ? 'light' : 'dark');
      });
    });
    // Auto-switch: follow system when no manual preference saved
    if (window.matchMedia) {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      mq.addEventListener('change', function(ev) {
        const savedNow = appStorage.getItem('theme');
        if (!savedNow) setTheme(ev.matches ? 'dark' : 'light');
      });
    }
    setTimeout(updateTarefasBadge, 100);
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

// ── Notificações UI ──
function initNotificacoesUI() {
  const wrapper = document.getElementById('notifBtnWrapper');
  const btn = document.getElementById('notifBtn');
  const badge = document.getElementById('notifBadge');
  const panel = document.getElementById('notifPanel');
  const body = document.getElementById('notifPanelBody');
  const marcarTodas = document.getElementById('notifMarcarTodasBtn');
  if (!wrapper || !btn || !badge || !panel || !body) return;

  if (!isAdmin()) { wrapper.style.display = 'none'; return; }
  if(wrapper.dataset.notificationsBound==='true')return;
  wrapper.dataset.notificationsBound='true';
  wrapper.style.display = '';

  function atualizarUI() {
    const naoLidas = getNotificacoesNaoLidas();
    if (naoLidas.length) {
      badge.textContent = naoLidas.length;
      badge.style.display = '';
    } else {
      badge.style.display = 'none';
    }
    if (panel.style.display !== 'none') renderPainel();
  }

  function renderPainel() {
    const lista = _currentNotificacoes();
    const status=_notificacoesStatus==='error'?'Consulta indisponível. A lista anterior foi mantida.':_notificacoesStatus==='confirmed'?'Últimas 50 notificações consultadas.':'Notificações ainda não consultadas.';
    const header='<p role="status" class="notif-empty">'+status+'</p><button class="btn-small" type="button" id="notifRefreshBtn">Atualizar lista</button>';
    function bindRefresh(){body.querySelector('#notifRefreshBtn')?.addEventListener('click',async()=>{await dbNotificacoesLoad();atualizarUI();});}
    if (!lista.length) {
      body.innerHTML = header+'<div class="notif-empty">'+(_notificacoesStatus==='confirmed'?'Nenhuma notificação':'Não foi possível confirmar se há notificações.')+'</div>';
      bindRefresh();return;
    }
    body.innerHTML = header+lista.map(n => {
      const tempo = n.created_at ? new Date(/(?:Z|[+-]\d{2}:?\d{2})$/.test(n.created_at)?n.created_at:n.created_at+'Z').toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
      return `<div class="notif-item${n.lida ? ' lida' : ''}" data-id="${escapeHtml(n.id)}" role="button" tabindex="0" aria-label="Marcar notificação como lida">
        <span class="notif-dot"></span>
        <div class="notif-text">${escapeHtml(n.descricao)}<br><small style="color:var(--text-muted)">${escapeHtml(n.actor_email || '')} · ${tempo}</small></div>
      </div>`;
    }).join('');
    bindRefresh();
    body.querySelectorAll('.notif-item').forEach(el=>{
      const mark=async()=>{
        if(el.getAttribute('aria-busy')==='true')return;
        const token=AppDataSession.token();el.setAttribute('aria-busy','true');
        try{await marcarNotificacaoLida(el.dataset.id);}
        catch(error){if(AppDataSession.current(token))showToast(error.message||'Não foi possível confirmar a leitura.','error');}
        finally{if(AppDataSession.current(token))atualizarUI();}
      };
      el.addEventListener('click',mark);
      el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();mark();}});
    });
  }

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = panel.style.display !== 'none';
    panel.style.display = isOpen ? 'none' : '';
    if (!isOpen) renderPainel();
  });

  if (marcarTodas) {
    marcarTodas.addEventListener('click', async () => {
      const token=AppDataSession.token();marcarTodas.disabled=true;
      try{await marcarTodasNotificacoesLidas();}
      catch(error){if(AppDataSession.current(token))showToast(error.message||'Não foi possível confirmar a leitura.','error');}
      finally{if(AppDataSession.current(token)){marcarTodas.disabled=false;atualizarUI();}}
    });
  }

  document.addEventListener('click', (e) => {
    if (!wrapper.contains(e.target)) panel.style.display = 'none';
  });

  onNotificacoesChange(atualizarUI);
  atualizarUI();
}
// ── Removed: buildReportHTML moved to static/reports.js ──


// Preferências do workspace e busca rápida do painel administrativo.
(function () {
  function buildCommandPalette() {
    if (document.getElementById('adminCommandPalette')) return;
    const overlay = document.createElement('div');
    overlay.id = 'adminCommandPalette';
    overlay.className = 'command-palette-overlay';
    overlay.hidden = true;
    overlay.innerHTML = '<div class="command-palette" role="dialog" aria-modal="true" aria-label="Busca rápida"><div class="command-search"><span aria-hidden="true">⌕</span><input id="commandPaletteInput" type="search" placeholder="Buscar telas e ações..." autocomplete="off"><kbd>Esc</kbd></div><div class="command-results" id="commandPaletteResults"></div><div class="command-footer"><span>↑↓ navegar</span><span>Enter abrir</span><span>Ctrl K buscar</span></div></div>';
    document.body.appendChild(overlay);

    const input = overlay.querySelector('#commandPaletteInput');
    const results = overlay.querySelector('#commandPaletteResults');
    let activeIndex = 0;
    let visibleActions = [];

    function collectActions() {
      const elements = [...document.querySelectorAll('#tabBar .tab-btn[data-tab], .sidebar .btn-small[id]')];
      const seen = new Set();
      const actions = elements.map(element => {
        const label = element.textContent.replace(/\s+/g, ' ').trim();
        if (!label || seen.has(label)) return null;
        seen.add(label);
        return { label, kind: element.matches('.tab-btn') ? 'Tela' : 'Ação', run: () => element.click() };
      }).filter(Boolean);

      const records = Array.isArray(window.rawRecords) ? window.rawRecords : (typeof rawRecords !== 'undefined' && Array.isArray(rawRecords) ? rawRecords : []);
      const people = [...new Set(records.map(row => String(row?.['Atendente'] || '').trim()).filter(name => name && (typeof isAggregateName !== 'function' || !isAggregateName(name)) && (typeof isColabActive !== 'function' || isColabActive(name))))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
      people.forEach(name => {
        const label = 'Abrir perfil de ' + name;
        if (seen.has(label)) return;
        seen.add(label);
        actions.push({ label, kind: 'Colaborador', run: () => { if (typeof openColabDetail === 'function') openColabDetail(name); } });
      });

      const sectors = [...new Set(records.map(row => String(row?.['Setor'] || '').trim()).filter(name => name && (typeof isSetorActive !== 'function' || isSetorActive(name))))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
      sectors.forEach(sector => {
        const label = 'Filtrar setor ' + sector;
        if (seen.has(label)) return;
        seen.add(label);
        actions.push({ label, kind: 'Setor', run: () => {
          document.querySelector('#tabBar .tab-btn[data-tab="dashboard"]')?.click();
          if (typeof globalFilters !== 'undefined' && globalFilters) {
            globalFilters.setor = sector;
            globalFilters.colaborador = 'all';
            globalFilters.pesquisa = '';
            globalFilters._syncUI();
            globalFilters._notify();
          }
        } });
      });
      return actions;
    }

    function renderResults(query) {
      const normalized = String(query || '').trim().toLocaleLowerCase('pt-BR');
      visibleActions = collectActions().filter(item => !normalized || item.label.toLocaleLowerCase('pt-BR').includes(normalized)).slice(0, 10);
      activeIndex = Math.min(activeIndex, Math.max(visibleActions.length - 1, 0));
      results.innerHTML = '';
      if (!visibleActions.length) {
        const empty = document.createElement('div');
        empty.className = 'command-empty';
        empty.textContent = 'Nenhum resultado encontrado';
        results.appendChild(empty);
        return;
      }
      visibleActions.forEach((item, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'command-result' + (index === activeIndex ? ' is-active' : '');
        button.innerHTML = '<span></span><small></small>';
        button.querySelector('span').textContent = item.label;
        button.querySelector('small').textContent = item.kind;
        button.addEventListener('mouseenter', () => { activeIndex = index; results.querySelectorAll('.command-result').forEach((itemButton, itemIndex) => itemButton.classList.toggle('is-active', itemIndex === activeIndex)); });
        button.addEventListener('click', () => { item.run(); closePalette(); });
        results.appendChild(button);
      });
    }

    let paletteOpener;
    function openPalette() {
      paletteOpener = document.activeElement;
      overlay.hidden = false;
      document.body.classList.add('command-palette-open');
      activeIndex = 0;
      input.value = '';
      renderResults('');
      requestAnimationFrame(() => input.focus());
    }
    function closePalette() {
      overlay.hidden = true;
      document.body.classList.remove('command-palette-open');
      if (paletteOpener?.isConnected) paletteOpener.focus();
    }
    window.openAdminCommandPalette = openPalette;
    window.closeAdminCommandPalette = closePalette;
    overlay.addEventListener('click', event => { if (event.target === overlay) closePalette(); });
    input.addEventListener('input', () => { activeIndex = 0; renderResults(input.value); });
    input.addEventListener('keydown', event => {
      if (event.key === 'ArrowDown') { event.preventDefault(); activeIndex = Math.min(activeIndex + 1, visibleActions.length - 1); renderResults(input.value); }
      if (event.key === 'ArrowUp') { event.preventDefault(); activeIndex = Math.max(activeIndex - 1, 0); renderResults(input.value); }
      if (event.key === 'Enter' && visibleActions[activeIndex]) { event.preventDefault(); visibleActions[activeIndex].run(); closePalette(); }
      if (event.key === 'Escape') closePalette();
    });
    document.addEventListener('keydown', event => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k' && !document.querySelector('dialog:modal')) { event.preventDefault(); overlay.hidden ? openPalette() : closePalette(); }
      else if (event.key === 'Escape' && !overlay.hidden) closePalette();
      if (event.key === 'Tab' && !overlay.hidden) {
        const controls = [input, ...results.querySelectorAll('button')];
        if (event.shiftKey && document.activeElement === controls[0]) { event.preventDefault(); controls.at(-1).focus(); }
        else if (!event.shiftKey && document.activeElement === controls.at(-1)) { event.preventDefault(); input.focus(); }
      }
    });
  }

  function initAdminWorkspace() {
    if (document.body.dataset.role !== 'admin' || document.body.dataset.workspaceReady === 'true') return;
    document.body.dataset.workspaceReady = 'true';
    document.querySelectorAll('#tabBar .tab-btn[data-tab]').forEach(button => {
      if (!button.title) button.title = button.textContent.replace(/\s+/g, ' ').trim();
    });

    const topbarRight = document.querySelector('.topbar-right');
    if (topbarRight && !document.getElementById('quickCommandBtn')) {
      const quickButton = document.createElement('button');
      quickButton.id = 'quickCommandBtn';
      quickButton.type = 'button';
      quickButton.className = 'btn-small quick-command-btn';
      quickButton.innerHTML = '<span aria-hidden="true">⌕</span><span>Buscar</span><kbd>Ctrl K</kbd>';
      quickButton.addEventListener('click', () => window.openAdminCommandPalette?.());
      topbarRight.prepend(quickButton);
    }

    const dropdown = document.getElementById('userDropdown');
    if (dropdown && !dropdown.querySelector('[data-workspace-preferences]')) {
      const preferences = document.createElement('div');
      preferences.dataset.workspacePreferences = 'true';
      preferences.className = 'user-dropdown-preferences';
      preferences.innerHTML = '<button class="user-dropdown-item" type="button" data-pref="theme">Alternar tema</button><button class="user-dropdown-item" type="button" data-pref="tools">Ferramentas</button><button class="user-dropdown-item" type="button" data-pref="density">Alternar densidade das tabelas</button>';
      preferences.addEventListener('click', event => {
        const action = event.target.closest('[data-pref]')?.dataset.pref;
        if (action === 'theme') document.getElementById('themeToggle')?.click();
        if (action === 'tools') window.appShell?.openTools();
        if (action === 'density') document.getElementById('compactTableBtn')?.click();
      });
      dropdown.appendChild(preferences);
    }
    buildCommandPalette();
  }

  document.addEventListener('app-role-ready', initAdminWorkspace);
  if (document.body.dataset.role === 'admin') initAdminWorkspace();
})();

// Interface review v3: semantics, mobile account actions and dialog accessibility.
(function () {
  function initInterfaceAccessibility() {
    const tabBar = document.getElementById("tabBar");
    if (tabBar) {
      tabBar.querySelectorAll(".tab-btn[data-tab]").forEach((button) => {
        const name = button.dataset.tab;
        const panel = document.getElementById("tab-" + name);
        button.id = "tab-button-" + name;
        button.setAttribute("aria-controls", "tab-" + name);
        button.setAttribute("tabindex", button.classList.contains("active") ? "0" : "-1");
        if (panel) panel.setAttribute("aria-labelledby", button.id);
      });
      tabBar.addEventListener("keydown", (event) => {
        if (!['ArrowDown', 'ArrowUp', 'ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
        const list = event.target.closest('[role="tablist"]') || tabBar;
        const buttons = [...list.querySelectorAll('[role="tab"]')].filter(button => button.getClientRects().length && !button.disabled);
        const current = buttons.indexOf(document.activeElement);
        if (current < 0) return;
        event.preventDefault();
        const forward = event.key === 'ArrowDown' || event.key === 'ArrowRight';
        const index = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (current + (forward ? 1 : -1) + buttons.length) % buttons.length;
        buttons[index]?.focus();
      });
    }

    const userDropdown = document.getElementById("userDropdown");
    if (userDropdown && !document.getElementById("mobilePresentationBtn")) {
      const mobileActions = document.createElement("div");
      mobileActions.className = "user-dropdown-mobile-actions";
      mobileActions.setAttribute("aria-label", "Preferências e sessão");
      mobileActions.innerHTML = `<button class="user-dropdown-item" id="mobilePresentationBtn" type="button">Modo apresentação</button><button class="user-dropdown-item" id="mobileThemeBtn" type="button">Alternar tema</button><button class="user-dropdown-item user-dropdown-danger" id="mobileLogoutBtn" type="button">Sair</button>`;
      userDropdown.appendChild(mobileActions);
    }

    const proxyActions = [
      ["mobilePresentationBtn", "presentationModeToggle"],
      ["mobileThemeBtn", "themeToggle"],
      ["mobileLogoutBtn", "switchAccountBtn"]
    ];
    proxyActions.forEach(([proxyId, targetId]) => {
      const proxy = document.getElementById(proxyId);
      const target = document.getElementById(targetId);
      if (!proxy || !target) return;
      proxy.addEventListener("click", () => {
        if (target.matches("input")) {
          target.checked = !target.checked;
          target.dispatchEvent(new Event("change", { bubbles: true }));
        } else target.click();
        const dropdown = document.getElementById("userDropdown");
        if (dropdown) dropdown.style.display = "none";
      });
    });


  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initInterfaceAccessibility);
  else initInterfaceAccessibility();
})();

window.addEventListener('ferias-updated', () => {
  if (rawRecords.length && document.querySelector('.tab-btn.active')?.dataset.tab === 'dashboard') updateView();
});

