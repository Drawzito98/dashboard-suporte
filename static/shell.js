// Presentation only: existing tab buttons, handlers, IDs and permissions are retained.
(function () {
  const bar = document.getElementById('tabBar');
  const nav = document.getElementById('domainNav');
  if (!bar || !nav) return;
  document.body.classList.add('shell-v2');
  const groups = [
    ['inicio', 'Início', ['home']],
    ['operacao', 'Operação', ['dashboard', 'relatorio-setorial', 'saude-operacional', 'insights']],
    ['pessoas', 'Pessoas', ['colaboradores', 'lider', 'avaliacao', 'perfil-pdi', 'mapeamento-time', 'ponto']],
    ['rotina', 'Rotina', ['tarefas', 'regras']]
  ];
  const buttons = [...bar.querySelectorAll('.tab-btn[data-tab]')];
  const last = new Map();
  // Keep the original controls and their listeners/badges.
  bar.replaceChildren(...buttons);
  const dialog = document.getElementById('toolsDialog');
  const trigger = document.getElementById('menuBtn');
  let returnFocus;
  function allowed(button) {
    // Domain hiding uses hidden; role restrictions continue to use the original CSS.
    return !button.disabled && getComputedStyle(button).display !== 'none';
  }
  // Scroll only the tab strip: revealing a destination must not move page content.
  function reveal(button) {
    if (!button || button.hidden || bar.hidden || !window.matchMedia('(max-width: 900px)').matches) return;
    const bounds = bar.getBoundingClientRect(), target = button.getBoundingClientRect();
    if (target.left < bounds.left) bar.scrollLeft -= bounds.left - target.left;
    else if (target.right > bounds.right) bar.scrollLeft += target.right - bounds.right;
  }
  bar.addEventListener('focusin', event => reveal(event.target.closest('.tab-btn')));
  window.addEventListener('resize', () => reveal(buttons.find(button => button.classList.contains('active'))));
  function sync(tab) {
    const group = groups.find(([, , tabs]) => tabs.includes(tab)) || groups[0];
    last.set(group[0], tab);
    nav.querySelectorAll('button').forEach(button => {
      button.setAttribute('aria-current', button.dataset.domain === group[0] ? 'page' : 'false');
    });
    buttons.forEach(button => {
      button.hidden = !group[2].includes(button.dataset.tab);
      button.setAttribute('tabindex', button.dataset.tab === tab ? '0' : '-1');
    });
    bar.setAttribute('aria-label', 'Telas de ' + group[1]);
    bar.hidden = group[2].length === 1;
    reveal(buttons.find(button => button.dataset.tab === tab));
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
        const candidates = buttons.filter(item => tabs.includes(item.dataset.tab) && allowed(item));
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
