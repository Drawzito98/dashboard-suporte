(function () {
  function pendingCount() {
    return typeof getPendingSync === 'function' ? getPendingSync().length : 0;
  }

  function renderSyncStatus() {
    const button = document.getElementById('syncStatusBtn');
    if (!button) return;
    const count = pendingCount();
    const offline = navigator.onLine === false;
    button.classList.toggle('has-pending', count > 0);
    button.classList.toggle('is-offline', offline);
    button.dataset.count = String(count);
    if (offline) {
      button.innerHTML = `<span class="sync-status-dot"></span><span>${count ? `${count} pendente${count === 1 ? '' : 's'}` : 'Offline'}</span>`;
      button.title = count ? 'Os dados serão enviados quando a conexão voltar.' : 'Sem conexão com o servidor.';
    } else if (count) {
      button.innerHTML = `<span class="sync-status-dot"></span><span>${count} pendente${count === 1 ? '' : 's'}</span>`;
      button.title = 'Clique para tentar sincronizar agora.';
    } else {
      button.innerHTML = '<span class="sync-status-dot"></span><span>Sincronizado</span>';
      button.title = 'Todos os registros estão sincronizados.';
    }
  }

  async function retryPendingSync() {
    const button = document.getElementById('syncStatusBtn');
    if (!button || pendingCount() === 0 || navigator.onLine === false || document.body.dataset.role !== 'admin') return;
    button.disabled = true;
    button.innerHTML = '<span class="sync-status-dot"></span><span>Sincronizando...</span>';
    try {
      await syncPendingRecords();
    } finally {
      button.disabled = false;
      renderSyncStatus();
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('syncStatusBtn')?.addEventListener('click', retryPendingSync);
    renderSyncStatus();
  });
  window.addEventListener('pending-sync-changed', renderSyncStatus);
  window.addEventListener('online', renderSyncStatus);
  window.addEventListener('offline', renderSyncStatus);
  window.addEventListener('storage', event => { if (event.key === 'sistema_pending_sync') renderSyncStatus(); });
})();
