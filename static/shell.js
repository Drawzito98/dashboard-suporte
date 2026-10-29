// Presentation only: existing tab buttons, handlers, IDs and permissions are retained.
(function () {
  const bar = document.getElementById('tabBar');
  const nav = document.getElementById('domainNav');
  if (!bar || !nav) return;
  document.body.classList.add('shell-v2');
  const groups = [
    ['inicio', 'Início', ['home']],
    ['operacao', 'Operação', ['saude-operacional', 'relatorio-setorial', 'dashboard', 'insights', 'metas']],
    ['pessoas', 'Pessoas', ['colaboradores', 'lider', 'avaliacao', 'perfil-pdi', 'mapeamento-time', 'ponto']],
    ['rotina', 'Rotina', ['tarefas', 'regras']]
  ];
  const buttons = [...bar.querySelectorAll('.tab-btn[data-tab]')];
  const last = new Map();
  // Keep the original controls and their listeners/badges.
  const analysisTabs = ['dashboard', 'relatorio-setorial', 'insights'];
  let lastAnalysis = 'relatorio-setorial';
  const primary = document.createElement('div'); primary.id = 'shellPrimaryTabs'; primary.setAttribute('role', 'tablist');
  const analysis = document.createElement('div'); analysis.id = 'shellAnalysisTabs'; analysis.setAttribute('role', 'tablist'); analysis.setAttribute('aria-label', 'Visualizações de análise');
  const analysisEntry = document.createElement('button');
  analysisEntry.id = 'shell-analysis-entry';
  const analysisPanel = document.createElement('div'); analysisPanel.id = 'shellAnalysisPanel'; analysisPanel.setAttribute('role', 'tabpanel'); analysisPanel.setAttribute('aria-labelledby', analysisEntry.id);
  analysisEntry.type = 'button'; analysisEntry.className = 'shell-analysis-entry'; analysisEntry.textContent = 'Análises';
  analysisEntry.setAttribute('role', 'tab'); analysisEntry.setAttribute('aria-controls', 'shellAnalysisPanel');
  analysisEntry.addEventListener('click', () => {
    const target = buttons.find(button => button.dataset.tab === lastAnalysis && allowed(button)) || buttons.find(button => analysisTabs.includes(button.dataset.tab) && allowed(button));
    target?.click();
  });
  primary.append(...buttons.filter(button => !analysisTabs.includes(button.dataset.tab)));
  const overview = buttons.find(button => button.dataset.tab === 'saude-operacional');
  overview?.after(analysisEntry);
  analysis.append(...analysisTabs.map(tab => buttons.find(button => button.dataset.tab === tab)).filter(Boolean));
  bar.setAttribute('role', 'presentation');
  analysisPanel.append(analysis);
  bar.replaceChildren(primary, analysisPanel);
  const labels = { 'saude-operacional': 'Visão geral', dashboard: 'Indicadores', 'relatorio-setorial': 'Relatório por setor', insights: 'Tendências e alertas' };
  buttons.forEach(button => { if (labels[button.dataset.tab]) {
    const icon = button.querySelector('.tab-icon');
    button.replaceChildren(...(icon ? [icon, document.createTextNode(' ')] : []), document.createTextNode(labels[button.dataset.tab]));
  }});
  const dialog = document.getElementById('toolsDialog');
  const trigger = document.getElementById('menuBtn');
  let returnFocus;
  function allowed(button) {
    // Domain hiding uses hidden; role restrictions continue to use the original CSS.
    const hidden = button.hidden; button.hidden = false;
    const permitted = !button.disabled && getComputedStyle(button).display !== 'none';
    button.hidden = hidden;
    return permitted;
  }
  // Scroll only the tab strip: revealing a destination must not move page content.
  function reveal(button) {
    if (!button || button.hidden || bar.hidden || !window.matchMedia('(max-width: 900px)').matches) return;
    const strip = button.closest('[role=tablist]') || bar;
    const bounds = strip.getBoundingClientRect(), target = button.getBoundingClientRect();
    if (target.left < bounds.left) strip.scrollLeft -= bounds.left - target.left;
    else if (target.right > bounds.right) strip.scrollLeft += target.right - bounds.right;
  }
  bar.addEventListener('focusin', event => reveal(event.target.closest('.tab-btn, .shell-analysis-entry')));
  window.addEventListener('resize', () => reveal(buttons.find(button => button.classList.contains('active'))));
  function sync(tab) {
    const group = groups.find(([, , tabs]) => tabs.includes(tab)) || groups[0];
    last.set(group[0], tab);
    nav.querySelectorAll('button').forEach(button => {
      button.setAttribute('aria-current', button.dataset.domain === group[0] ? 'page' : 'false');
    });
    const inAnalysis = group[0] === 'operacao' && analysisTabs.includes(tab);
    if (inAnalysis) lastAnalysis = tab;
    analysisEntry.hidden = group[0] !== 'operacao' || !buttons.some(button => analysisTabs.includes(button.dataset.tab) && allowed(button));
    analysisEntry.classList.toggle('active', inAnalysis);
    analysisEntry.setAttribute('aria-selected', String(inAnalysis));
    analysisEntry.tabIndex = inAnalysis ? 0 : -1;
    analysisPanel.hidden = !inAnalysis;
    analysis.hidden = !inAnalysis;
    primary.setAttribute('aria-label', 'Telas de ' + group[1]);
    buttons.forEach(button => {
      button.hidden = !group[2].includes(button.dataset.tab) || (analysisTabs.includes(button.dataset.tab) && !inAnalysis);
      button.setAttribute('tabindex', button.dataset.tab === tab ? '0' : '-1');
    });
    bar.setAttribute('aria-label', 'Telas de ' + group[1]);
    bar.hidden = group[2].length === 1;
    reveal(inAnalysis ? analysisEntry : buttons.find(button => button.dataset.tab === tab));
    if (inAnalysis) reveal(buttons.find(button => button.dataset.tab === tab));
  }
  function refresh() {
    // Temporarily reveal for role CSS inspection; no data or role is changed.
    buttons.forEach(button => button.hidden = false);
    nav.replaceChildren();
    groups.forEach(([id, label, tabs]) => {
      if (!buttons.some(button => tabs.includes(button.dataset.tab) && allowed(button))) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.domain = id;
      button.textContent = label;
      button.addEventListener('click', () => {
        buttons.forEach(item => item.hidden = false);
        const candidates = tabs.map(tab => buttons.find(item => item.dataset.tab === tab)).filter(item => item && allowed(item));
        const target = candidates.find(item => item.dataset.tab === last.get(id)) || candidates[0];
        if (target) { target.click(); sync(target.dataset.tab); }
      });
      nav.appendChild(button);
    });
    sync(document.querySelector('#tabBar .tab-btn.active')?.dataset.tab || 'home');
  }
  function openTools() {
    if (!dialog || document.body.dataset.role === 'colaborador' || dialog.open) return;
    returnFocus = document.activeElement;
    dialog.showModal();
  }
  trigger?.addEventListener('click', openTools);
  document.getElementById('closeToolsBtn')?.addEventListener('click', () => dialog.close());
  dialog?.addEventListener('click', event => { if (event.target === dialog) {
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  } });
  dialog?.addEventListener('close', () => returnFocus?.focus());
  // Close before existing action handlers open their own overlays.
  dialog?.addEventListener('click', event => {
    if (event.target.closest('.sidebar button') && !event.target.closest('#legacySidebarFilters')) dialog.close();
  }, true);
  window.appShell = { sync, refresh, openTools };
  document.addEventListener('app-role-ready', () => { dialog?.close(); refresh(); });
  refresh();
})();
