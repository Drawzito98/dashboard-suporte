// ─── Fotos dos Colaboradores ───────────────────────────────
const COLAB_FOTOS_KEY = 'sistema_colab_fotos_v1';

function normalizeColabFotoName(name) {
  return String(name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function findColabFotoUrl(map, name) {
  if (!map || typeof map !== 'object') return '';
  if (map[name]) return map[name];

  const normalizedName = normalizeColabFotoName(name);
  if (!normalizedName) return '';
  const exactKey = Object.keys(map).find(key => normalizeColabFotoName(key) === normalizedName);
  if (exactKey) return map[exactKey] || '';

  const targetTokens = normalizedName.split(' ');
  if (targetTokens.length < 2) return '';
  const compatibleKeys = Object.keys(map).filter(key => {
    const keyTokens = normalizeColabFotoName(key).split(' ').filter(Boolean);
    if (keyTokens.length < 2) return false;
    const shorter = targetTokens.length <= keyTokens.length ? targetTokens : keyTokens;
    const longer = targetTokens.length <= keyTokens.length ? keyTokens : targetTokens;
    return shorter.every(token => longer.includes(token));
  });
  return compatibleKeys.length === 1 ? (map[compatibleKeys[0]] || '') : '';
}

function getColabFoto(name) {
  if (!name) return '';
  try {
    const raw = localStorage.getItem(COLAB_FOTOS_KEY);
    const map = raw ? JSON.parse(raw) : {};
    const url = findColabFotoUrl(map, name);
    return normalizeFotoUrl(url);
  } catch (e) { return ''; }
}

function normalizeFotoUrl(url) {
  if (!url) return '';
  let m = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (m) return `https://drive.google.com/thumbnail?id=${m[1]}&sz=w400`;
  m = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (m) return `https://drive.google.com/thumbnail?id=${m[1]}&sz=w400`;
  return url;
}

function setColabFoto(name, url) {
  try {
    const raw = localStorage.getItem(COLAB_FOTOS_KEY);
    const map = raw ? JSON.parse(raw) : {};
    if (url) map[name] = normalizeFotoUrl(url);
    else delete map[name];
    localStorage.setItem(COLAB_FOTOS_KEY, JSON.stringify(map));
  } catch (e) { console.warn('[ColabFotos] Erro ao obter URL foto:', e); }
  if (typeof dbFotoSave === 'function') {
    const finalUrl = url ? normalizeFotoUrl(url) : '';
    return dbFotoSave(name, finalUrl);
  }
  return Promise.resolve();
}

window.addEventListener('colab-fotos-updated', () => {
  const activeTab = document.querySelector('.tab-btn.active')?.dataset.tab;
  if (activeTab === 'gamificacao' && typeof renderGamification === 'function') renderGamification();
  if (activeTab === 'colaboradores' && typeof renderColaboradores === 'function') renderColaboradores();
  if (activeTab === 'dashboard' && typeof updateView === 'function') updateView();
});

function colabAvatarHtml(name, size = 32) {
  if (!name) return '';
  const foto = getColabFoto(name);
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const initialsHtml = `<span style="display:inline-flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;border-radius:50%;background:var(--bg-inset);color:var(--text-secondary);font-size:${size * 0.4}px;font-weight:600;vertical-align:middle;flex-shrink:0">${escapeHtml(initials)}</span>`;
  if (foto) {
    return `<span style="display:inline-flex;position:relative;vertical-align:middle">${initialsHtml}<img src="${escapeHtml(foto)}" alt="${escapeHtml(name)}" style="position:absolute;inset:0;width:100%;height:100%;border-radius:50%;object-fit:cover" onerror="this.style.display='none'"/></span>`;
  }
  return initialsHtml;
}
