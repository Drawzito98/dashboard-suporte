// Status concerns indicators only; it does not claim all modules are synchronized.
(function () {
  function render() {
    const button = document.getElementById('syncStatusBtn'); if (!button) return;
    const state = typeof AppState !== 'undefined' ? AppState.get('records') : null;
    const count = typeof getPendingSync === 'function' ? getPendingSync().length : 0;
    const offline = navigator.onLine === false || state?.status === 'offline';
    button.classList.toggle('has-pending', count > 0);button.classList.toggle('is-offline', offline);button.dataset.count = String(count);
    let label = 'Aguardando dados', title = 'O estado dos indicadores ainda não foi confirmado.';
    if (state?.status === 'loading') { label = 'Consultando indicadores'; title = 'Buscando a fonte oficial.'; }
    else if (count) { label = count + ' pendente' + (count === 1 ? '' : 's'); title = 'Há alterações de indicadores ainda não confirmadas no servidor. Clique para tentar enviar.'; }
    else if (offline) { label = 'Usando dados locais'; title = 'Servidor indisponível. O cache é desta conta e pode estar desatualizado.'; }
    else if (state?.source === 'server') { label = 'Indicadores atualizados'; title = state?.error === 'cache-unavailable' ? 'Indicadores consultados no servidor; o cache offline não pôde ser salvo.' : 'Indicadores consultados no servidor. O status de outros módulos é independente.'; }
    button.innerHTML = '<span class="sync-status-dot"></span><span>' + label + '</span>';button.title = title;
  }
  async function retry() {
    const button = document.getElementById('syncStatusBtn');
    if (!button || navigator.onLine === false || document.body.dataset.role !== 'admin') return;
    button.disabled = true;
    try { await syncPendingRecords(); } finally { button.disabled = false; render(); }
  }
  document.addEventListener('DOMContentLoaded', () => { document.getElementById('syncStatusBtn')?.addEventListener('click', retry); render(); });
  for (const name of ['app-data-changed','pending-sync-changed','online','offline','storage']) window.addEventListener(name, render);
})();
