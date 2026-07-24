// ─── Fotos dos Colaboradores ───────────────────────────────
const COLAB_FOTOS_KEY = 'sistema_colab_fotos_v1';

function getColabFoto(name) {
  if (!name) return '';
  try {
    const raw = localStorage.getItem(COLAB_FOTOS_KEY);
    const map = raw ? JSON.parse(raw) : {};
    const url = map[name] || '';
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
    dbFotoSave(name, finalUrl);
  }
}

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
