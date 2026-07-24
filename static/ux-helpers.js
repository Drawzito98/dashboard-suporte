// ─── UX Helpers: Toast / Loading / Empty State ─────────────
function showToast(message, type = 'success', title = null, timeout = 2800) {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <div class="dot" aria-hidden="true"></div>
    <div style="flex:1;min-width:0">
      <p class="toast-title">${(title || (type === 'error' ? 'Atenção' : 'Tudo certo'))}</p>
      <p class="toast-msg">${String(message || '')}</p>
    </div>
    <button class="toast-close" type="button" aria-label="Fechar notificação">&times;</button>
    <div class="toast-progress" style="animation-duration:${timeout}ms"></div>
  `;
  container.appendChild(toast);
  let remaining = timeout;
  let start = Date.now();
  let timer;
  function dismiss() {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-4px)';
    toast.style.transition = 'opacity .18s ease, transform .18s ease';
    setTimeout(() => toast.remove(), 220);
  }
  function schedule() {
    start = Date.now();
    timer = setTimeout(dismiss, remaining);
  }
  toast.querySelector('.toast-close').addEventListener('click', () => { clearTimeout(timer); dismiss(); });
  toast.addEventListener('mouseenter', () => { clearTimeout(timer); remaining -= (Date.now() - start); });
  toast.addEventListener('mouseleave', () => { schedule(); });
  schedule();
}

function setLoading(isOn, text = 'Processando…') {
  const overlay = document.getElementById('loadingOverlay');
  if (!overlay) return;
  const label = overlay.querySelector('.loading-text');
  if (label) label.textContent = text || 'Processando…';
  overlay.classList.toggle('hidden', !isOn);
}

function setGlobalEmpty(isEmpty) {
  const el = document.getElementById('globalEmptyState');
  if (!el) return;
  el.classList.toggle('hidden', !isEmpty);
}

let __isImporting = false;
function setImportStatus(msg) {
  const el = q('#importStatus');
  if (!el) return;
  el.textContent = msg || '';
}

function isChartAvailable() {
  return (typeof Chart !== 'undefined') && Chart && (typeof Chart === 'function' || typeof Chart === 'object');
}
