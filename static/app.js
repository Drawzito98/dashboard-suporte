// DOM helpers (hoisted)
function q(sel, root = document) { return root.querySelector(sel); }
function qa(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }



// Perfis (Google Docs) — loaded from static/perfis.js (works on file://)
const INACTIVE_COLABS_KEY = 'sistema_inactive_colabs_v1';
const DEFAULT_INACTIVE = ['Caio', 'Carina', 'Diogo', 'Gabriel', 'Jessé', 'Joyce', 'Maxsuel', 'Victor'];

function getInactiveColabs() {
  if (!window.__inactiveColabs) {
    try {
      const raw = localStorage.getItem(INACTIVE_COLABS_KEY);
      if (raw) {
        window.__inactiveColabs = new Set(JSON.parse(raw));
      } else {
        window.__inactiveColabs = new Set(DEFAULT_INACTIVE);
        localStorage.setItem(INACTIVE_COLABS_KEY, JSON.stringify(DEFAULT_INACTIVE));
      }
    } catch (e) {
      window.__inactiveColabs = new Set(DEFAULT_INACTIVE);
    }
  }
  return window.__inactiveColabs;
}

function saveInactiveColabs() {
  try {
    localStorage.setItem(INACTIVE_COLABS_KEY, JSON.stringify([...getInactiveColabs()]));
  } catch (e) {}
  if (typeof dbInativosSave === 'function') {
    dbInativosSave(getInactiveColabs());
  }
}

function setColabActive(name, active) {
  if (!requireAdmin()) return;
  const set = getInactiveColabs();
  if (active) set.delete(name);
  else set.add(name);
  saveInactiveColabs();
}

function isColabActive(name) {
  return !getInactiveColabs().has(name);
}

// ─── SETORES INATIVOS ─────────────────────────────────────

const INACTIVE_SETORES_KEY = 'sistema_inactive_setores_v1';

function getInactiveSetores() {
  if (!window.__inactiveSetores) {
    try {
      const raw = localStorage.getItem(INACTIVE_SETORES_KEY);
      if (raw) {
        window.__inactiveSetores = new Set(JSON.parse(raw));
      } else {
        window.__inactiveSetores = new Set();
        localStorage.setItem(INACTIVE_SETORES_KEY, JSON.stringify([]));
      }
    } catch (e) {
      window.__inactiveSetores = new Set();
    }
  }
  return window.__inactiveSetores;
}

function saveInactiveSetores() {
  try {
    localStorage.setItem(INACTIVE_SETORES_KEY, JSON.stringify([...getInactiveSetores()]));
  } catch (e) {}
  if (typeof dbSetorInativosSave === 'function') {
    dbSetorInativosSave(getInactiveSetores());
  }
}

function setSetorActive(name, active) {
  if (!requireAdmin()) return;
  const set = getInactiveSetores();
  if (active) set.delete(name);
  else set.add(name);
  saveInactiveSetores();
}

function isSetorActive(name) {
  return !getInactiveSetores().has(name);
}

// Foto do colaborador (URL-based, localStorage)
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
  // Google Drive: /file/d/XXXX/view
  let m = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (m) return `https://drive.google.com/thumbnail?id=${m[1]}&sz=w400`;
  // Google Drive: uc?export=view&id=XXXX (already converted)
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
  } catch (e) {}
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

async function cleanDuplicates() {
  const seen = new Map();
  const toRemove = [];
  let kept = 0;

  for (let i = rawRecords.length - 1; i >= 0; i--) {
    const r = rawRecords[i];
    if (!r || !r['Atendente'] || !r['Mês']) continue;
    const key = `${r['Atendente']}|${r['Mês']}|${r['Finalizados']}|${r['Assumidos']}|${r['Transferidos']}|${r['SCORE']}`;
    if (seen.has(key)) {
      toRemove.push({ idx: i, id: r.id });
    } else {
      seen.set(key, true);
      kept++;
    }
  }

  if (!toRemove.length) {
    showToast('Nenhuma duplicata encontrada.', 'ok');
    return;
  }

  setLoading(true, `Removendo ${toRemove.length} duplicatas…`);
  try {
    let removed = 0;
    for (const item of toRemove) {
      if (item.id != null && sbClient) {
        await dbDeleteRecord(item.id);
      }
      rawRecords.splice(item.idx, 1);
      removed++;
    }
    if (typeof invalidateGamificationCache === 'function') invalidateGamificationCache();
    populateFilters(rawRecords);
    updateFilterOptions();
    updateView();
    showToast(`${removed} duplicata(s) removida(s). ${kept} registro(s) mantido(s).`, 'success', 'Limpeza');
  } catch (e) {
    console.error('Erro ao limpar duplicatas:', e);
    showToast('Erro ao limpar duplicatas.', 'error');
  } finally {
    setLoading(false);
  }
}

const HISTORICO_KEY = 'sistema_historico_v1';

function logHistorico(action, rec, extra = {}) {
  try {
    const raw = localStorage.getItem(HISTORICO_KEY);
    const log = raw ? JSON.parse(raw) : [];
    const user = (window.__sbUser && window.__sbUser.email) ? window.__sbUser.email : 'desconhecido';
    const entry = {
      ts: new Date().toISOString(),
      user,
      action,
      colaborador: rec ? rec['Atendente'] || '' : '',
      mes: rec ? rec['Mês'] || '' : '',
      ...extra
    };
    log.push(entry);
    // Keep last 500 entries
    if (log.length > 500) log.splice(0, log.length - 500);
    localStorage.setItem(HISTORICO_KEY, JSON.stringify(log));
    if (typeof dbHistoricoAdd === 'function') {
      dbHistoricoAdd(entry);
    }
  } catch (e) { console.warn('[Historico] Erro ao salvar:', e); }
}

// Migrate old Google Drive URLs to direct format
function migrateColabFotos() {
  try {
    const raw = localStorage.getItem(COLAB_FOTOS_KEY);
    if (!raw) return;
    const map = JSON.parse(raw);
    let changed = false;
    for (const name in map) {
      const normalized = normalizeFotoUrl(map[name]);
      if (normalized !== map[name]) {
        map[name] = normalized;
        changed = true;
      }
    }
    if (changed) {
      localStorage.setItem(COLAB_FOTOS_KEY, JSON.stringify(map));
      console.log('[Fotos] URLs migradas para formato thumbnail:', map);
    }
  } catch (e) {
    console.warn('[Fotos] Erro na migração:', e);
  }
}
migrateColabFotos();

function getColabFotoDebug(name) {
  const url = getColabFoto(name);
  console.log(`[Fotos] getColabFoto("${name}") =`, url);
  return url;
}

function openManageColabs() {
  const overlay = document.getElementById('manageColabsOverlay');
  if (!overlay) return;
  overlay.classList.add('open');
  renderManageColabs();
}

function closeManageColabs() {
  const overlay = document.getElementById('manageColabsOverlay');
  if (overlay) overlay.classList.remove('open');
}

function renderManageColabs() {
  const container = document.getElementById('manageColabsContent');
  if (!container) return;
  const inactive = getInactiveColabs();
  const allNames = [...new Set((rawRecords || []).filter(r => r && r['Atendente'] && !isAggregateName(r['Atendente'])).map(r => r['Atendente']))].sort();

  let html = `
    <div style="padding:var(--s-5)">
      <h2 style="font-size:18px;font-weight:700;margin-bottom:var(--s-1)">👥 Gerenciar Colaboradores</h2>
      <p style="font-size:13px;color:var(--text-secondary);margin-bottom:var(--s-4)">Marque como inativos colaboradores que não fazem mais parte da equipe. Eles serão ocultados dos filtros, ranking e projeções.</p>
      <div style="overflow-x:auto;max-height:55vh;overflow-y:auto;border:1px solid var(--border);border-radius:var(--r-md)">
        <table class="ranking-table">
          <thead><tr><th>Colaborador</th><th style="text-align:center">Ativo</th></tr></thead>
          <tbody>
            ${allNames.map(n => {
              const ativo = !inactive.has(n);
              return `<tr>
                <td style="font-weight:500">${escapeHtml(n)}</td>
                <td style="text-align:center">
                  <label style="display:inline-flex;align-items:center;gap:6px;cursor:pointer">
                    <input type="checkbox" class="colab-active-toggle" data-name="${escapeHtml(n)}" ${ativo ? 'checked' : ''} style="width:18px;height:18px"/>
                    <span style="font-size:12px;color:${ativo ? 'var(--success)' : 'var(--text-muted)'}">${ativo ? 'Ativo' : 'Inativo'}</span>
                  </label>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
      <div style="display:flex;gap:var(--s-3);margin-top:var(--s-4);justify-content:flex-end">
        <button class="btn-primary" id="manageColabsDoneBtn" type="button">✅ Concluído</button>
      </div>
    </div>
  `;

  container.innerHTML = html;

  document.getElementById('manageColabsClose').addEventListener('click', closeManageColabs);
  document.getElementById('manageColabsDoneBtn').addEventListener('click', closeManageColabs);

  container.querySelectorAll('.colab-active-toggle').forEach(cb => {
    cb.addEventListener('change', () => {
      const name = cb.dataset.name;
      const active = cb.checked;
      setColabActive(name, active);
      const label = cb.nextElementSibling;
      if (label) {
        label.textContent = active ? 'Ativo' : 'Inativo';
        label.style.color = active ? 'var(--success)' : 'var(--text-muted)';
      }
    });
  });
}

// ─── GERENCIAR SETORES INATIVOS ────────────────────────────────

function openManageSetores() {
  const overlay = document.getElementById('manageSetoresOverlay');
  if (!overlay) return;
  overlay.classList.add('open');
  renderManageSetores();
}

function closeManageSetores() {
  const overlay = document.getElementById('manageSetoresOverlay');
  if (overlay) overlay.classList.remove('open');
}

function renderManageSetores() {
  const container = document.getElementById('manageSetoresContent');
  if (!container) return;
  const inactive = getInactiveSetores();
  const allSetores = [...new Set((rawRecords || []).filter(r => r && r['Setor']).map(r => r['Setor']))].sort();

  let html = `
    <div style="padding:var(--s-5)">
      <h2 style="font-size:18px;font-weight:700;margin-bottom:var(--s-1)">🏢 Gerenciar Setores</h2>
      <p style="font-size:13px;color:var(--text-secondary);margin-bottom:var(--s-4)">Marque como inativos setores que não são mais relevantes. Eles serão ocultados dos filtros, relatórios e análises.</p>
      <div style="overflow-x:auto;max-height:55vh;overflow-y:auto;border:1px solid var(--border);border-radius:var(--r-md)">
        <table class="ranking-table">
          <thead><tr><th>Setor</th><th style="text-align:center">Ativo</th></tr></thead>
          <tbody>
            ${allSetores.map(s => {
              const ativo = !inactive.has(s);
              return `<tr>
                <td style="font-weight:500">${escapeHtml(s)}</td>
                <td style="text-align:center">
                  <label style="display:inline-flex;align-items:center;gap:6px;cursor:pointer">
                    <input type="checkbox" class="setor-active-toggle" data-name="${escapeHtml(s)}" ${ativo ? 'checked' : ''} style="width:18px;height:18px"/>
                    <span style="font-size:12px;color:${ativo ? 'var(--success)' : 'var(--text-muted)'}">${ativo ? 'Ativo' : 'Inativo'}</span>
                  </label>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
      <div style="display:flex;gap:var(--s-3);margin-top:var(--s-4);justify-content:flex-end">
        <button class="btn-primary" id="manageSetoresDoneBtn" type="button">✅ Concluído</button>
      </div>
    </div>
  `;

  container.innerHTML = html;

  document.getElementById('manageSetoresClose').addEventListener('click', closeManageSetores);
  document.getElementById('manageSetoresDoneBtn').addEventListener('click', closeManageSetores);

  container.querySelectorAll('.setor-active-toggle').forEach(cb => {
    cb.addEventListener('change', () => {
      const name = cb.dataset.name;
      const active = cb.checked;
      setSetorActive(name, active);
      const label = cb.nextElementSibling;
      if (label) {
        label.textContent = active ? 'Ativo' : 'Inativo';
        label.style.color = active ? 'var(--success)' : 'var(--text-muted)';
      }
    });
  });
}

// Close on backdrop click
document.addEventListener('click', (e) => {
  const overlay = document.getElementById('manageColabsOverlay');
  if (overlay && overlay.classList.contains('open') && e.target === overlay) {
    closeManageColabs();
  }
  const overlaySetores = document.getElementById('manageSetoresOverlay');
  if (overlaySetores && overlaySetores.classList.contains('open') && e.target === overlaySetores) {
    closeManageSetores();
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { closeManageColabs(); closeManageSetores(); }
});
function _normName(s) {
  try {
    return (s || "")
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  } catch (e) {
    return (s || "").toLowerCase().replace(/\s+/g, " ").trim();
  }
}

function getPerfilDocsLink(nomeAtendente) {
  const raw = (window.PERFIS_DOCS_MAP || {});
  if (!nomeAtendente) return "";
  // fast exact match
  if (raw[nomeAtendente]) return raw[nomeAtendente];
  // normalized match (more forgiving)
  const target = _normName(nomeAtendente);
  for (const k in raw) {
    if (_normName(k) === target) return raw[k];
  }
  return "";
}

// UX helpers: toast + loading + empty state
function showToast(message, type = 'success', title = null, timeout = 2800) {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <div class="dot" aria-hidden="true"></div>
    <div>
      <p class="toast-title">${(title || (type === 'error' ? 'Atenção' : 'Tudo certo'))}</p>
      <p class="toast-msg">${String(message || '')}</p>
    </div>
  `;
  container.appendChild(toast);
  // auto remove
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-4px)';
    toast.style.transition = 'opacity .18s ease, transform .18s ease';
    setTimeout(() => toast.remove(), 220);
  }, timeout);
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

// App logic: parse CSV, populate filters, draw chart
let rawRecords = [];
let explicitMultiSetorNames = new Set();
let chart = null;

// Normaliza nomes de atendente que vêm marcados como "Multisetor" no CSV
// (ex.: "Dayane Multisetor", "Dayane - Multi-setor", "Dayane (multi setor)")
// para que apareçam apenas uma vez no filtro. Mantemos registro dos nomes
// que vieram explicitamente marcados para destacá-los na exibição.
function stripMultiSetorTag(name) {
  const original = String(name == null ? '' : name);
  const re = /\s*[^\p{L}\p{N}\s]?\s*multi[\s\-]?setor\s*[^\p{L}\p{N}\s]?\s*$/ui;
  const stripped = original
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .replace(re, '');
  if (stripped !== original.normalize('NFD').replace(/\p{Diacritic}/gu, '')) {
    const base = original.replace(/\s*[^\p{L}\p{N}\s]?\s*[Mm][Uu][Ll][Tt][Ii][\s\-]?[Ss][Ee][Tt][Oo][Rr]\s*[^\p{L}\p{N}\s]?\s*$/u, '').trim();
    return { base: base || original.trim(), tagged: true };
  }
  return { base: original.trim(), tagged: false };
}

function normalizeAtendenteOnRecords(records) {
  explicitMultiSetorNames = new Set();
  (records || []).forEach(r => {
    if (!r) return;
    if (typeof r['Atendente'] === 'string') r['Atendente'] = r['Atendente'].trim();
    const { base, tagged } = stripMultiSetorTag(r['Atendente']);
    if (base !== r['Atendente']) r['Atendente'] = base;
    if (tagged && base) explicitMultiSetorNames.add(base);
    // Remove apenas símbolos (★, bullets, etc) — mantém letras acentuadas
    const cleaned = r['Atendente'].replace(/[^\p{L}\p{N}\s]/gu, '').trim();
    if (cleaned && cleaned !== r['Atendente']) r['Atendente'] = cleaned;
  });
  return records;
}
let previewRows = [];
let currentSort = { key: null, desc: true };
let hiddenLabels = new Set();
let selectedMonths = [];
let presentationMode = false;

// -------------------------
// Navegação: Menu inicial / Painel
// -------------------------
function showHomeScreen() {
  const home = document.getElementById('homeScreen');
  const app = document.getElementById('appScreen');
  if (home) home.style.display = 'flex';
  if (app) app.style.display = 'none';
  setGlobalEmpty(true);
}

function showAppScreen() {
  const home = document.getElementById('homeScreen');
  const app = document.getElementById('appScreen');
  if (home) home.style.display = 'none';
  if (app) app.style.display = 'block';
  setGlobalEmpty(!rawRecords || rawRecords.length === 0);
}

function clearVisualsOnly() {
  // Mantém os dados em memória e no localStorage, mas "zera" a visualização do painel
  const summaryCard = document.getElementById('summaryCard');
  const summaryContent = document.getElementById('summaryContent');
  if (summaryCard) summaryCard.style.display = 'none';
  if (summaryContent) summaryContent.innerHTML = '';

  const previewSortControls = document.getElementById('previewSortControls');
  if (previewSortControls) previewSortControls.style.display = 'none';

  const previewTable = document.getElementById('previewTable');
  if (previewTable) previewTable.innerHTML = '';
  previewRows = [];

  setVisualizationPrompt(false);
  setChartEmpty && setChartEmpty(true, 'Importe arquivos para iniciar a análise.');

  // Destrói o gráfico para limpar a área
  if (chart) {
    try { chart.destroy(); } catch (e) {}
    chart = null;
  }
  // limpa canvas (fallback)
  const canvas = document.getElementById('mainChart');
  if (canvas && canvas.getContext) {
    const cctx = canvas.getContext('2d');
    cctx && cctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}



function setVisualizationPrompt(isVisible) {
  const box = document.getElementById('visualizationEmptyState');
  const chartCard = document.getElementById('chartCard');
  const previewCard = document.getElementById('previewCard');
  const summaryCard = document.getElementById('summaryCard');
  if (box) box.classList.toggle('hidden', !isVisible);
  if (chartCard) chartCard.classList.toggle('hidden', isVisible);
  if (previewCard) previewCard.classList.toggle('hidden', isVisible);
  if (isVisible && summaryCard) summaryCard.style.display = 'none';
}

function setChartEmpty(isEmpty, message) {
  const empty = document.getElementById('chartEmpty');
  const canvas = document.getElementById('mainChart');
  if (empty) {
    if (message) {
      const sub = empty.querySelector('.empty-sub');
      if (sub) sub.textContent = message;
    }
    empty.classList.toggle('hidden', !isEmpty);
  }
  if (canvas) canvas.style.display = isEmpty ? 'none' : 'block';
}

// -------------------------
// Persistência (localStorage)
// -------------------------
const STORAGE_KEY = 'sistema_gestao_state_v1';
let isRestoringState = false;

function safeJsonParse(str) {
  try { return JSON.parse(str); } catch (e) { return null; }
}

function formatDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return '';
  return d.toLocaleString('pt-BR', { hour12: false });
}

function getStateSnapshot() {
  // Compute scoring totals for cache
  let gamificationCacheData = null;
  if (typeof getOverallRanking === 'function' && rawRecords && rawRecords.length) {
    try { gamificationCacheData = getOverallRanking(rawRecords).map(r => ({ name: r.name, score: r.score.total })); } catch(e) {}
  }
  return {
    version: 2,
    savedAt: new Date().toISOString(),
    rawRecords,
    hiddenLabels: Array.from(hiddenLabels),
    compareChosen,
    gamificationCache: gamificationCacheData,
    // Removed: favorites (no longer used)
    activeTab: (document.querySelector('.tab-btn.active') || {}).getAttribute ? document.querySelector('.tab-btn.active').getAttribute('data-tab') : 'dashboard',
    filters: {
      setor: setorSelect?.value ?? 'all',
      mes: mesSelect?.value ?? 'all',
      mesesSelecionados: Array.isArray(selectedMonths) ? selectedMonths.slice() : [],
      presentationMode,
      atendente: atendenteSelect?.value ?? 'all',
      arquivo: arquivoSelect?.value ?? 'all',
      compareSelect: compareSelect?.value ?? 'all',
      metric: 'Finalizados',
      search: searchAtendenteInput?.value ?? ''
    },
    currentSort,
    lastReportText: window.__lastReportText || ''
  };
}

let __saveTimeout = null;
function saveState() {
  if (isRestoringState) return;
  const hasData = Array.isArray(rawRecords) && rawRecords.length > 0;
  if (!hasData) return;
  clearTimeout(__saveTimeout);
  __saveTimeout = setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(getStateSnapshot()));
      updateStorageUI('ok');
    } catch (e) {
      updateStorageUI('warn');
    }
  }, 300);
}

function clearSavedState() {
  try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
  updateStorageUI(null);
}

function loadSavedState() {
  let raw = null;
  try { raw = localStorage.getItem(STORAGE_KEY); } catch (e) { raw = null; }
  if (!raw) return null;
  const state = safeJsonParse(raw);
  if (!state || (state.version !== 1 && state.version !== 2) || !Array.isArray(state.rawRecords)) return null;
  return state;
}

function applySavedState(state) {
  isRestoringState = true;
  try {
    rawRecords = normalizeAtendenteOnRecords(state.rawRecords || []);
    hiddenLabels = new Set(Array.isArray(state.hiddenLabels) ? state.hiddenLabels : []);
    compareChosen = Array.isArray(state.compareChosen) ? state.compareChosen : [];
    currentSort = state.currentSort && typeof state.currentSort === 'object' ? state.currentSort : { key: null, desc: true };
    window.__lastReportText = typeof state.lastReportText === 'string' ? state.lastReportText : '';

    // Version 2+ extras
    if (state.version >= 2) {
      // Remove favorites restore (no longer used)
    }

    // re-populate filter options based on restored data
    populateFilters(rawRecords);

    // apply saved selections (if option exists, otherwise fall back)
    if (setorSelect && state.filters?.setor) setorSelect.value = state.filters.setor;
    if (mesSelect && state.filters?.mes) mesSelect.value = state.filters.mes;
    selectedMonths = Array.isArray(state.filters?.mesesSelecionados) ? state.filters.mesesSelecionados.slice() : [];
    presentationMode = !!state.filters?.presentationMode;
    if (presentationModeToggle) presentationModeToggle.checked = presentationMode;
    if (atendenteSelect && state.filters?.atendente) atendenteSelect.value = state.filters.atendente;
    if (arquivoSelect && state.filters?.arquivo) arquivoSelect.value = state.filters.arquivo;

    if (searchAtendenteInput && typeof state.filters?.search === 'string') searchAtendenteInput.value = state.filters.search;

    updateFilterOptions();
    if (compareSelect && state.filters?.compareSelect) compareSelect.value = state.filters.compareSelect;
    renderCompareChips();
    updatePreviewSortControls();
    updateView();
    updateStorageUI('ok', state.savedAt);

    // Restore active tab after state is applied
    if (state.version >= 2 && state.activeTab && state.activeTab !== 'dashboard') {
      setTimeout(() => {
        const tabBtn = document.querySelector(`.tab-btn[data-tab="${state.activeTab}"]`);
        if (tabBtn) tabBtn.click();
      }, 100);
    }
  } finally {
    isRestoringState = false;
  }
}

function updateStorageUI(status, savedAtIso) {}

// Plugin to draw value labels on bars/points so values are visible without hover

function sizeChartInnerForLabels(labelCount, perLabelPx){
  try{
    var inner = document.getElementById('chartInner');
    var wrap = inner && inner.parentElement;
    if (!inner || !wrap) return;
    var per = perLabelPx || 90;
    var target = Math.max(wrap.clientWidth || 0, Math.max(1, labelCount) * per);
    inner.style.width = target + 'px';
    inner.style.minWidth = target + 'px';
    var cnv = document.getElementById('mainChart');
    if (cnv) { cnv.style.width = target + 'px'; }
  }catch(e){}
}

const valueLabelPlugin = {
  id: 'valueLabelPlugin',
  afterDatasetsDraw(chart, args, options) {
    const ctx = chart.ctx;
    chart.data.datasets.forEach((dataset, dsIndex) => {
      const meta = chart.getDatasetMeta(dsIndex);
      if (!meta || !meta.data) return;
      const showInteger = chart.options && chart.options.plugins && chart.options.plugins.valueLabels && chart.options.plugins.valueLabels.integer;
      meta.data.forEach((element, index) => {
        const raw = dataset.data[index];
        if (raw === null || raw === undefined) return;
        const lbl = String(dataset.label || '').toLowerCase();
        const isScore = lbl.includes('score');
        const isCount = lbl.includes('finaliz') || lbl.includes('assumid') || lbl.includes('transferid');
        let text;
        const fmt2 = (n) => {
          try { return Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
          catch(e) { return Number(n).toFixed(2); }
        };
        if (isScore) text = fmt2(raw);
        else if (isCount) text = String(Math.round(raw));
        else text = showInteger ? String(Math.round(raw)) : fmt2(raw);
        ctx.save();
        ctx.font = isScore || isCount ? '500 16px system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial' : '12px system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial';
        const _isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        ctx.fillStyle = isScore ? ((typeof Chart!=='undefined' && Chart.defaults && Chart.defaults.color) ? Chart.defaults.color : (_isDark ? '#e2e8f0' : '#334155')) : ((typeof Chart!=='undefined' && Chart.defaults && Chart.defaults.color) ? Chart.defaults.color : (_isDark ? '#e2e8f0' : '#334155'));
        if (isCount) ctx.fillStyle = _isDark ? '#e2e8f0' : '#1e293b';
        ctx.textAlign = 'center';
        ctx.textBaseline = isScore ? 'bottom' : 'bottom';
        const x = element.x !== undefined ? element.x : (element.getCenterPoint ? element.getCenterPoint().x : null);
        const y = element.y !== undefined ? element.y : (element.getCenterPoint ? element.getCenterPoint().y : null);
        if (x == null || y == null) { ctx.restore(); return; }
        const yOffset = isScore ? -16 : -8;
        ctx.fillText(text, x, y + yOffset);
        ctx.restore();
      });
    });
  }
};

const fileInputPanel = document.getElementById('fileInput');
const homeFileInput = document.getElementById('homeFileInput');
// file input usado para importar no menu inicial (precisa estar fora de container com display:none)
const fileInput = homeFileInput || fileInputPanel;
const setorSelect = document.getElementById('setorSelect');
const mesSelect = document.getElementById('mesSelect');
const monthPicker = document.getElementById('monthPicker');
const monthChecklist = document.getElementById('monthChecklist');
const monthChips = document.getElementById('monthChips');
const selectAllMonthsBtn = document.getElementById('selectAllMonthsBtn');
const clearMonthsBtn = document.getElementById('clearMonthsBtn');
const presentationModeToggle = document.getElementById('presentationModeToggle');
const atendenteSelect = document.getElementById('atendenteSelect');
const searchAtendenteInput = document.getElementById('searchAtendenteInput');
const compareSelect = document.getElementById('compareSelect');
const arquivoSelect = document.getElementById('arquivoSelect');
const generateReportBtn = document.getElementById('generateReportBtn');
const compareLabel = document.getElementById('compareLabel');
const addCompareBtn = document.getElementById('addCompareBtn');
const clearCompareBtn = document.getElementById('clearCompareBtn');
const compareChips = document.getElementById('compareChips');
let compareChosen = []; // ordered array of names added for comparison
const clearFiltersBtn = document.getElementById('clearFiltersBtn');
const previewTable = document.getElementById('previewTable');
const ctx = document.getElementById('mainChart');
const restoreHiddenBtn = document.getElementById('restoreHiddenBtn');

if (typeof Chart !== 'undefined' && Chart.defaults) {
  const initialTheme = document.documentElement.getAttribute('data-theme') || 'light';
  Chart.defaults.color = initialTheme === 'dark' ? '#e2e8f0' : '#1f2937';
}

// ── Removed: parseCsvFile, showImportError, importCsvFiles, onFileInputChange, normalizeRecords, isAggregateName, normalizeNumber, parseDateKey moved to static/csv-import.js ──

// listeners para ambos inputs (menu inicial e painel)
[homeFileInput, fileInputPanel].filter(Boolean).forEach((inp) => {
  inp.addEventListener('change', onFileInputChange);
});

// Empty state action: opens the sidebar file picker
const emptyImportBtn = document.getElementById('emptyImportBtn');
if (emptyImportBtn) {
  emptyImportBtn.addEventListener('click', () => {
    try {
      const picker = document.getElementById('fileInput');
      picker && picker.click();
    } catch (e) {}
  });
}


// When setor or mês change we must refresh the atendente list to show only relevant names
function _rerenderActiveNonDashboardTab() {
  const active = document.querySelector('.tab-btn.active');
  if (!active) return;
  const tab = active.getAttribute('data-tab');
  if (tab === 'relatorio-setorial' && typeof onRelatorioSetorialTabActivated === 'function') onRelatorioSetorialTabActivated();
  else if (tab === 'gamificacao' && typeof onGamificationTabActivated === 'function') onGamificationTabActivated();
  else if (tab === 'metas' && typeof onMetasTabActivated === 'function') onMetasTabActivated();
  else if (tab === 'comparativos' && typeof onComparativosTabActivated === 'function') onComparativosTabActivated();
  else if (tab === 'lider' && typeof onLiderTabActivated === 'function') onLiderTabActivated();
  else if (tab === 'insights' && typeof onInsightsTabActivated === 'function') onInsightsTabActivated();
}
setorSelect.addEventListener('change', () => { updateFilterOptions(); _rerenderActiveNonDashboardTab(); });
mesSelect.addEventListener('change', () => { syncMonthPickerVisibility(); updateFilterOptions(); _rerenderActiveNonDashboardTab(); });
atendenteSelect.addEventListener('change', () => {});
const applyFiltersBtn = document.getElementById('applyFiltersBtn');
if (applyFiltersBtn) applyFiltersBtn.addEventListener('click', () => { updateView(); });
if (arquivoSelect) arquivoSelect.addEventListener('change', () => { updateFilterOptions(); updateView(); });
if (generateReportBtn) generateReportBtn.addEventListener('click', () => { generateAndShowReport(); });
if (compareSelect) compareSelect.addEventListener('change', () => {}); // no-op; use Add button
if (addCompareBtn) addCompareBtn.addEventListener('click', () => { addCompare(); updateView(); });
if (clearCompareBtn) clearCompareBtn.addEventListener('click', () => { clearCompare(); updateView(); });
if (searchAtendenteInput) searchAtendenteInput.addEventListener('input', () => { updateView(); });
if (selectAllMonthsBtn) selectAllMonthsBtn.addEventListener('click', () => { selectedMonths = uniqueSorted(rawRecords.map(r => r['Mês'])); renderMonthPickerOptions(); updateFilterOptions(); updateView(); });
if (clearMonthsBtn) clearMonthsBtn.addEventListener('click', () => { selectedMonths = []; renderMonthPickerOptions(); updateFilterOptions(); updateView(); });
if (presentationModeToggle) presentationModeToggle.addEventListener('change', () => { presentationMode = !!presentationModeToggle.checked; updateView(); saveState(); });
if (clearFiltersBtn) clearFiltersBtn.addEventListener('click', () => { clearFilters(); });
// preview filters handled when rendering preview

// ── Removed: normalizeRecords, isAggregateName, normalizeNumber, parseDateKey moved to static/csv-import.js ──

function uniqueSorted(arr) {
  return Array.from(new Set(arr.filter(Boolean))).sort();
}

function normalizeNameForDedup(n) {
  return String(n || '').trim()
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .replace(/\s*[^\p{L}\p{N}\s]\s*(?:multi[\s\-]?setor)?\s*$/ui, '')
    .replace(/\s*(?:multi[\s\-]?setor)\s*$/i, '')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .trim()
    .toLowerCase();
}


function getActiveMonths() {
  if (mesSelect && mesSelect.value === '__multi__') {
    return Array.isArray(selectedMonths) ? selectedMonths.filter(Boolean) : [];
  }
  if (mesSelect && mesSelect.value && mesSelect.value !== 'all') return [mesSelect.value];
  return [];
}

function monthFilterActive() {
  return getActiveMonths().length > 0;
}

function monthMatches(value) {
  const months = getActiveMonths();
  if (!months.length) return true;
  return months.includes(String(value));
}

function getMonthScopeLabel() {
  const months = getActiveMonths().slice().sort();
  if (!months.length) return 'Todos';
  if (months.length === 1) return months[0];
  return `${months[0]} → ${months[months.length - 1]} (${months.length} meses)`;
}

function syncMonthPickerVisibility() {
  if (!monthPicker || !mesSelect) return;
  monthPicker.classList.toggle('hidden', mesSelect.value !== '__multi__');
}

function renderMonthChips() {
  if (!monthChips) return;
  if (!selectedMonths.length) {
    monthChips.innerHTML = '<span class="badge">Nenhum mês marcado</span>';
    return;
  }
  monthChips.innerHTML = selectedMonths.slice().sort().map(m => `<span class="chip">${escapeHtml(m)} <button data-month="${escapeHtml(m)}" class="chip-remove">×</button></span>`).join(' ');
  Array.from(monthChips.querySelectorAll('.chip-remove')).forEach(btn => {
    btn.addEventListener('click', (e) => {
      const val = e.target.getAttribute('data-month');
      selectedMonths = selectedMonths.filter(m => m !== val);
      const checkbox = monthChecklist && monthChecklist.querySelector(`input[value="${CSS.escape(val)}"]`);
      if (checkbox) checkbox.checked = false;
      renderMonthChips();
      updateFilterOptions();
      updateView();
    });
  });
}

function renderMonthPickerOptions() {
  if (!monthChecklist) return;
  const meses = uniqueSorted(rawRecords.map(r => r['Mês']));
  monthChecklist.innerHTML = meses.map(m => `
<label class="month-option"><input type="checkbox" class="month-checkbox" value="${escapeHtml(m)}" ${selectedMonths.includes(m) ? 'checked' : ''}/><span>${escapeHtml(m)}</span></label>`).join('');
  monthChecklist.querySelectorAll('.month-checkbox').forEach(chk => {
    chk.addEventListener('change', (e) => {
      const val = String(e.target.value);
      if (e.target.checked) {
        if (!selectedMonths.includes(val)) selectedMonths.push(val);
      } else {
        selectedMonths = selectedMonths.filter(m => m !== val);
      }
      selectedMonths.sort();
      renderMonthChips();
      updateFilterOptions();
      updateView();
    });
  });
  renderMonthChips();
  syncMonthPickerVisibility();
}

function buildAliasMap(names) {
  const uniq = Array.from(new Set((names || []).filter(Boolean).map(n => String(n)))).sort((a,b) => a.localeCompare(b, 'pt-BR'));
  const map = new Map();
  uniq.forEach((name, idx) => map.set(name, `Colaborador ${idx + 1}`));
  return map;
}

function getDisplayName(name, aliasMap) {
  if (!presentationMode) return name;
  return (aliasMap && aliasMap.get(name)) || name;
}

function populateFilters(data) {
  const setores = uniqueSorted(data.map(r => r['Setor']));
  const meses = uniqueSorted(data.map(r => r['Mês']));
  const arquivos = uniqueSorted(data.map(r => r['Arquivo']));
  fillSelect(setorSelect, setores);
  fillSelect(mesSelect, meses, { includeMulti: true });
  renderMonthPickerOptions();
  if (arquivoSelect) fillSelect(arquivoSelect, arquivos);
  // atendentes will be populated depending on selected setor/mes/arquivo
}

function updateFilterOptions() {
  syncGlobalState();
  // compute atendentes available for current setor and mês selections
  const setorVal = setorSelect.value;
  const mesVal = getActiveMonths();
  const arquivoVal = arquivoSelect ? arquivoSelect.value : 'all';
  const atendentes = rawRecords
    .filter(r => {
      if (!r) return false;
      if (setorVal !== 'all' && String(r['Setor']) !== setorVal) return false;
      if (!monthMatches(r['Mês'])) return false;
      if (arquivoVal !== 'all' && String(r['Arquivo']) !== arquivoVal) return false;
      return true;
    })
    .map(r => r['Atendente']).filter(a => !isAggregateName(a) && isColabActive(a));
  // Dedup ignorando acentos/caixa/espacos
  const dedupMap = new Map();
  atendentes.forEach(a => {
    const key = normalizeNameForDedup(a);
    if (!dedupMap.has(key)) dedupMap.set(key, a);
  });
  const uniq = Array.from(dedupMap.values()).sort();
  fillSelect(atendenteSelect, uniq);
  // populate compareSelect (multi-select) with the same list when present
  if (compareSelect && compareLabel) {
    fillSelect(compareSelect, uniq);
    // show compare control only when both setor and mês are selected
    if (setorVal !== 'all' && monthFilterActive() && uniq.length>0) {
      compareLabel.style.display = 'inline-block';
    } else {
      compareLabel.style.display = 'none';
      // clear any previous selections
      compareSelect.selectedIndex = -1;
      clearCompare();
    }
  }
  // update preview sort controls visibility based on atendente selection
  updatePreviewSortControls();
}

function updatePreviewSortControls() {
  const ctr = document.getElementById('previewSortControls');
  if (!ctr) return;
  // show when atendente OR (setor+mes) are selected
  const selectedAt = getSelectedAtendentes();
  const showSort = (selectedAt && selectedAt.length>0 && !selectedAt.includes('all')) || (setorSelect.value !== 'all' && monthFilterActive());
  ctr.style.display = showSort ? 'flex' : 'none';
}

function getSelectedAtendentes() {
  // Build ordered selection: Atendente (single) first, then any compareChosen in insertion order
  const ordered = [];
  if (atendenteSelect) {
    const v = atendenteSelect.value;
    if (v && v !== 'all') ordered.push(v);
  }
  // append compareChosen preserving order, avoid duplicates
  compareChosen.forEach(n => { if (!ordered.includes(n)) ordered.push(n); });
  if (ordered.length === 0) return null;
  return ordered;
}

function fillMultiSelect(select, values) {
  if (!select) return;
  select.innerHTML = values.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
}

function addCompare() {
  if (!compareSelect) return;
  const v = compareSelect.value;
  if (!v || v === 'all') return;
  if (!compareChosen.includes(v)) {
    compareChosen.push(v);
    renderCompareChips();
  }
}

function clearCompare() {
  compareChosen = [];
  renderCompareChips();
}

function removeCompare(name) {
  compareChosen = compareChosen.filter(x => x !== name);
  renderCompareChips();
}

function renderCompareChips() {
  if (!compareChips) return;
  compareChips.innerHTML = compareChosen.map(n => `<span class="chip">${escapeHtml(n)} <button data-name="${escapeHtml(n)}" class="chip-remove">×</button></span>`).join(' ');
  // attach handlers
  Array.from(compareChips.querySelectorAll('.chip-remove')).forEach(b => {
    b.addEventListener('click', (e) => { const name = e.target.getAttribute('data-name'); removeCompare(name); updateView(); });
  });
}

function clearFilters() {
  // Clear global filters (source of truth)
  if (typeof globalFilters !== 'undefined' && globalFilters && typeof globalFilters.limpar === 'function') {
    globalFilters.limpar();
  }
  // Also reset local sidebar elements
  if (setorSelect) setorSelect.value = 'all';
  if (mesSelect) mesSelect.value = 'all';
  selectedMonths = [];
  if (atendenteSelect) atendenteSelect.selectedIndex = 0;
  if (arquivoSelect) arquivoSelect.value = 'all';
  // clear compare list
  clearCompare();
  if (compareSelect) compareSelect.selectedIndex = -1;
  // reset sort
  currentSort.key = null; currentSort.desc = true;
  // update UI and data
  updateFilterOptions();
  updateView();
}

function fillSelect(select, values, opts = {}) {
  const includeMulti = !!opts.includeMulti;
  let html = '<option value="all">Todos</option>';
  if (includeMulti) html += '<option value="__multi__">Seleção múltipla</option>';
  html += values.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
  select.innerHTML = html;
}


function escapeHtml(s) {
  if (s == null) return '';
  // Important: this is used both for HTML text and for attribute values.
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Bridge: sincroniza globalFilters → elementos legados da sidebar + estado
 * Garante que o Dashboard use os filtros globais como fonte única.
 */
function syncGlobalState() {
  if (typeof globalFilters === 'undefined' || !globalFilters) return;
  if (typeof setorSelect !== 'undefined' && setorSelect) setorSelect.value = globalFilters.setor || 'all';
  if (typeof atendenteSelect !== 'undefined' && atendenteSelect) atendenteSelect.value = globalFilters.colaborador || 'all';
  if (typeof searchAtendenteInput !== 'undefined' && searchAtendenteInput) searchAtendenteInput.value = globalFilters.pesquisa || '';
  if (typeof mesSelect !== 'undefined' && mesSelect) {
    const p = globalFilters.periodo || 'all';
    if (p === '__multi__') {
      mesSelect.value = '__multi__';
      selectedMonths = Array.isArray(globalFilters.mesesSelecionados) ? globalFilters.mesesSelecionados.slice() : [];
    } else {
      mesSelect.value = p;
      selectedMonths = [];
    }
    if (typeof syncMonthPickerVisibility === 'function') syncMonthPickerVisibility();
    if (typeof renderMonthChips === 'function') renderMonthChips();
  }
}

function syncScrollbar() {
  const wrap = document.querySelector('.preview .table-wrap');
  if (!wrap) return;
  const table = wrap.querySelector('table');
  if (!table) return;
  const previewCard = document.getElementById('previewTable');
  if (!previewCard) return;
  let bar = document.getElementById('previewScrollbar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'previewScrollbar';
    bar.className = 'sync-scrollbar-container';
    bar.innerHTML = '<div class="sync-scrollbar-spacer"></div>';
    previewCard.appendChild(bar);
  }
  const spacer = bar.querySelector('.sync-scrollbar-spacer');
  if (!spacer) return;
  if (table.scrollWidth > wrap.clientWidth) {
    bar.style.display = 'block';
    spacer.style.width = table.scrollWidth + 'px';
    bar.onscroll = () => { wrap.scrollLeft = bar.scrollLeft; };
    wrap.onscroll = () => { bar.scrollLeft = wrap.scrollLeft; };
  } else {
    bar.style.display = 'none';
  }
}

function updateView() {
  syncGlobalState();
  setGlobalEmpty(!rawRecords || rawRecords.length === 0);

  if (!rawRecords || rawRecords.length === 0) {
    setVisualizationPrompt(false);
    return;
  }

  const hasActiveFilters = filtersActive();
  setVisualizationPrompt(!hasActiveFilters);
  if (!hasActiveFilters) {
    const summaryCard = document.getElementById('summaryCard');
    const summaryContent = document.getElementById('summaryContent');
    if (summaryCard) summaryCard.style.display = 'none';
    if (summaryContent) summaryContent.innerHTML = '';
    const previewSortControls = document.getElementById('previewSortControls');
    if (previewSortControls) previewSortControls.style.display = 'none';
    const previewTable = document.getElementById('previewTable');
    if (previewTable) previewTable.innerHTML = '';
    previewRows = [];
    setChartEmpty(true, 'Nenhum filtro aplicado ainda. Selecione um ou mais filtros para visualizar os indicadores.');
    if (chart) {
      try { chart.destroy(); } catch (e) {}
      chart = null;
    }
    return;
  }

  const qLower = (searchAtendenteInput?.value || '').trim().toLowerCase();
  const filtered = rawRecords.filter(r => {
    if (!r) return false;
    if (setorSelect.value !== 'all' && String(r['Setor']) !== setorSelect.value) return false;
    if (setorSelect.value === 'all' && typeof isSetorActive === 'function' && !isSetorActive(String(r['Setor']).trim())) return false;
    if (!monthMatches(r['Mês'])) return false;
    if (arquivoSelect && arquivoSelect.value !== 'all' && String(r['Arquivo']) !== arquivoSelect.value) return false;
    if (qLower) {
      const name = String(r['Atendente'] || '').toLowerCase();
      if (!name.includes(qLower)) return false;
    }
    if (atendenteSelect && atendenteSelect.value !== 'all') {
      if (String(r['Atendente']) !== atendenteSelect.value) return false;
    }
    const selectedAt = getSelectedAtendentes();
    if (selectedAt && !(selectedAt.length === 0 || selectedAt.includes('all'))) {
      if (!selectedAt.includes(String(r['Atendente']))) return false;
    }
    return true;
  });

  // If no filter is active, hide aggregate rows (e.g. "Média Setor", "Total/Média CG")
  const anyFilterActive = filtersActive();
  const visible = anyFilterActive ? filtered : filtered.filter(r => !isAggregateName(r['Atendente']));

  renderPreview(visible.slice(0, 50));

  // Remove inativos do gráfico (colaboradores desligados/transferidos)
  const chartRows = visible.filter(r => isColabActive(r['Atendente']));

  renderChart(chartRows);
  renderSummary(filtered);
  updatePreviewSortControls(); // update controls after filtering
}

function filtersActive() {
  const compareActive = compareChosen && compareChosen.length>0;
  const q = (searchAtendenteInput?.value || '').trim();
  return setorSelect.value !== 'all' || monthFilterActive() || (arquivoSelect && arquivoSelect.value !== 'all') || compareActive || (atendenteSelect && atendenteSelect.value !== 'all') || q.length>0;
}



// ---- Férias / Multi-setor helpers ----
function isFeriasObs(obs) {
  if (obs === null || obs === undefined) return false;
  const t = String(obs).normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  return /\bferias?\b/.test(t);
}
function formatMesLabel(m) {
  const s = String(m || '').trim();
  const mt = s.match(/^(\d{4})-(\d{2})/);
  if (!mt) return s;
  const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  return `${meses[parseInt(mt[2])-1]}/${mt[1]}`;
}
function getFeriasList(rows) {
  const out = [];
  (rows || []).forEach(r => {
    if (isFeriasObs(r && r['Observações'])) {
      out.push({ atendente: String(r['Atendente']||''), mes: String(r['Mês']||''), obs: String(r['Observações']||'') });
    }
  });
  return out;
}
function getMultiSetorMap(rows) {
  const m = new Map();
  (rows || []).forEach(r => {
    const a = String(r && r['Atendente'] || '').trim();
    const sec = String(r && r['Setor'] || '').trim();
    if (!a || !sec) return;
    if (!m.has(a)) m.set(a, new Set());
    m.get(a).add(sec);
  });
  const out = new Map();
  m.forEach((set, a) => { if (set.size > 1) out.set(a, Array.from(set).sort()); });
  // Quando filtro por setor ou colaborador, marca como multisetor quem veio
  // com tag "Multisetor" no CSV, desde que tenha dados no recorte atual.
  const filterOn = setorSelect.value !== 'all' || atendenteSelect.value !== 'all';
  if (filterOn && explicitMultiSetorNames && explicitMultiSetorNames.size) {
    explicitMultiSetorNames.forEach(name => {
      if (!out.has(name) && m.has(name)) {
        out.set(name, Array.from(m.get(name)).sort());
      }
    });
  }
  return out;
}

// Média de scores: média das médias por setor (cada setor pesa igual)
function avgScoreBySetor(rows) {
  const bySetor = {};
  rows.forEach(r => {
    const s = String(r['Setor'] || '').trim();
    if (!s) return;
    const sc = r['SCORE'];
    if (sc == null || Number.isNaN(Number(sc))) return;
    if (!bySetor[s]) bySetor[s] = [];
    bySetor[s].push(Number(sc));
  });
  const setorAvgs = Object.values(bySetor)
    .filter(arr => arr.length > 0)
    .map(arr => arr.reduce((a, b) => a + b, 0) / arr.length);
  return setorAvgs.length ? setorAvgs.reduce((a, b) => a + b, 0) / setorAvgs.length : null;
}

function renderSummary(filtered) {
  const card = document.getElementById('summaryCard');
  const container = document.getElementById('summaryContent');
  if (!card || !container) return;

  const setorSel = setorSelect.value;
  const mesSel = getActiveMonths();
  const atendenteSel = atendenteSelect.value;
  const arquivoSel = arquivoSelect ? arquivoSelect.value : 'all';

  const rows = (filtered || []).filter(r => r && !isAggregateName(r['Atendente']));
  if (!rows.length) { card.style.display = 'none'; container.innerHTML = ''; return; }
  card.style.display = '';
  // Texto de busca (para filtros e comparação mês anterior)
  const qTxt = (searchAtendenteInput?.value || '').trim();
  const qLower = qTxt.toLowerCase();


  // KPIs
  const total = (key) => rows.reduce((s, r) => s + (parseInt(r[key]) || 0), 0);
  const totalAssumidos = total('Assumidos');
  const totalTransferidos = total('Transferidos');
  const totalFinalizados = total('Finalizados');

  const avgScoreNum = avgScoreBySetor(rows);

  const produtividade = totalAssumidos > 0 ? (totalFinalizados / totalAssumidos) : null;
  const taxaTransfer = totalAssumidos > 0 ? (totalTransferidos / totalAssumidos) : null;

  // Variação mês anterior (quando um mês específico está selecionado)
  function prevMonthKey(yyyyMm) {
    const m = String(yyyyMm || '').match(/(\d{4})-(\d{2})/);
    if (!m) return null;
    let y = parseInt(m[1]); let mo = parseInt(m[2]);
    mo -= 1;
    if (mo === 0) { mo = 12; y -= 1; }
    return `${y}-${String(mo).padStart(2,'0')}`;
  }

  let deltaFinalizados = null;
  let deltaAssumidos = null;
  let deltaScore = null;
  if (mesSel.length === 1) {
    const prev = prevMonthKey(mesSel[0]);
    if (prev) {
      const prevRows = rawRecords.filter(r => r && !isAggregateName(r['Atendente']))
        .filter(r => (setorSel === 'all' || String(r['Setor']) === setorSel))
        .filter(r => (arquivoSel === 'all' || String(r['Arquivo']) === arquivoSel))
        .filter(r => String(r['Mês']) === prev)
        .filter(r => {
          if (qLower) {
      const name = String(r['Atendente'] || '').toLowerCase();
      if (!name.includes(qLower)) return false;
    }
    const selectedAt = getSelectedAtendentes();
          if (selectedAt && selectedAt.length && !selectedAt.includes('all')) return selectedAt.includes(String(r['Atendente']));
          return (atendenteSel === 'all' || String(r['Atendente']) === atendenteSel);
        });

      const prevFinal = prevRows.reduce((s, r) => s + (parseInt(r['Finalizados']) || 0), 0);
      const prevAssumidos = prevRows.reduce((s, r) => s + (parseInt(r['Assumidos']) || 0), 0);
      const prevAvgScore = avgScoreBySetor(prevRows);

      if (prevFinal > 0) deltaFinalizados = ((totalFinalizados - prevFinal) / prevFinal) * 100;
      if (prevAssumidos > 0) deltaAssumidos = ((totalAssumidos - prevAssumidos) / prevAssumidos) * 100;
      if (prevAvgScore !== null && avgScoreNum !== null) deltaScore = avgScoreNum - prevAvgScore;
    }
  }

  function fmtInt(n){ return (Number(n)||0).toLocaleString('pt-BR'); }
  function fmtPct(p){ return (p===null||p===undefined||Number.isNaN(p)) ? '—' : `${p.toFixed(1)}%`; }
  function fmtScore(s){
    if (s===null||s===undefined||Number.isNaN(s)) return '—';
    try { return Number(s).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
    catch(e){ return Number(s).toFixed(2); }
  }

  // Alertas simples
  const alerts = [];
  if (avgScoreNum !== null && avgScoreNum < 4.2) alerts.push('Score médio abaixo de 4,20');
  if (taxaTransfer !== null && taxaTransfer > 0.25) alerts.push('Taxa de transferências acima de 25%');
  if (produtividade !== null && produtividade < 0.75) alerts.push('Produtividade (Finalizados/Assumidos) abaixo de 75%');

  const scopeParts = [];
  if (arquivoSel !== 'all') scopeParts.push(`Arquivo: ${escapeHtml(arquivoSel)}`);
  if (setorSel !== 'all') scopeParts.push(`Setor: ${escapeHtml(setorSel)}`);
  if (presentationMode) scopeParts.push('Modo apresentação');
  if (atendenteSel !== 'all') scopeParts.push(`Atendente: ${escapeHtml(atendenteSel)}`);
  const q = qTxt;
  if (qLower) scopeParts.push(`Busca: ${escapeHtml(q)}`);

  const mesesNoEscopo = Array.from(new Set(rows.map(r=>String(r['Mês']||'')).filter(Boolean))).sort();
  const periodoTxt = mesesNoEscopo.length===0 ? '—' : (mesesNoEscopo.length===1 ? mesesNoEscopo[0] : `${mesesNoEscopo[0]} → ${mesesNoEscopo[mesesNoEscopo.length-1]}`);
  const atendentesNoEscopo = Array.from(new Set(rows.map(r=>String(r['Atendente']||'')).filter(Boolean))).length;
  const setoresNoEscopo = Array.from(new Set(rows.map(r=>String(r['Setor']||'')).filter(Boolean))).length;
  container.innerHTML = `
    <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:flex-end">
      <div>
        <div style="font-size:12px;color:var(--muted)">Resumo do escopo</div>
        <div style="font-weight:600">${scopeParts.length ? scopeParts.join(' · ') : 'Todos os dados importados'}</div>
        <div style="margin-top:6px;color:var(--muted);font-size:13px">Período: <strong>${escapeHtml(periodoTxt)}</strong> · Atendentes: <strong>${escapeHtml(String(atendentesNoEscopo))}</strong></div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <span class="badge">Visão: Por atendente (agrupado)</span>
        ${alerts.length ? `<span class="status-badge status-bad">⚠️ ${escapeHtml(alerts.join(' · '))}</span>` : `<span class="status-badge status-ok">OK</span>`}${presentationMode ? `<span class="badge presentation-note">Nomes ocultos na exibição</span>` : ''}
      </div>
    </div>

    <div class="kpi-grid" style="margin-top:12px">
      <div class="kpi"><div class="label">Assumidos</div><div class="value">${fmtInt(totalAssumidos)}</div><div class="sub">${deltaAssumidos===null?'':`Δ mês ant.: ${fmtPct(deltaAssumidos)}`}</div></div>
      <div class="kpi"><div class="label">Transferidos</div><div class="value">${fmtInt(totalTransferidos)}</div><div class="sub">${taxaTransfer===null?'':`Taxa: ${(taxaTransfer*100).toFixed(1)}%`}</div></div>
      <div class="kpi"><div class="label">Finalizados</div><div class="value">${fmtInt(totalFinalizados)}</div><div class="sub">${deltaFinalizados===null?'':`Δ mês ant.: ${fmtPct(deltaFinalizados)}`}</div></div>
      <div class="kpi"><div class="label">Score médio</div><div class="value${avgScoreNum!==null ? ' ' + getClasseScore(avgScoreNum) : ''}">${fmtScore(avgScoreNum)}</div><div class="sub">${deltaScore===null?'':`Δ mês ant.: ${deltaScore>=0?'+':''}${deltaScore.toFixed(2)}`}</div></div>
      <div class="kpi"><div class="label">Produtividade</div><div class="value">${produtividade===null?'—':(produtividade*100).toFixed(1)+'%'}</div><div class="sub">Finalizados / Assumidos</div></div>
      <div class="kpi"><div class="label">Atendentes</div><div class="value">${fmtInt(atendentesNoEscopo)}</div><div class="sub">no escopo</div></div>
      <div class="kpi"><div class="label">Setores</div><div class="value">${fmtInt(setoresNoEscopo)}</div><div class="sub">no escopo</div></div>
    </div>

    ${(() => {
      const fer = getFeriasList(rows);
      const multi = getMultiSetorMap(rows);
      if (!fer.length && !multi.size) return '';
      const aliasMap = buildAliasMap(rows.map(r => r['Atendente']));
      const ferHtml = fer.length ? `<div class="avisos-item avisos-ferias"><span class="avisos-icon">🏖️</span><div><div class="avisos-title">Período de férias</div><ul class="avisos-list">${fer.map(f => `<li><strong>${escapeHtml(getDisplayName(f.atendente, aliasMap))}</strong> — ${escapeHtml(formatMesLabel(f.mes))}${f.obs ? ` <span class="avisos-obs">(${escapeHtml(f.obs)})</span>` : ''}</li>`).join('')}</ul></div></div>` : '';
      const multiHtml = multi.size ? `<div class="avisos-item avisos-multi"><span class="avisos-icon">🔁</span><div><div class="avisos-title">Atuou em mais de um setor</div><ul class="avisos-list">${Array.from(multi.entries()).map(([a, secs]) => `<li><strong>${escapeHtml(getDisplayName(a, aliasMap))}</strong> — ${escapeHtml(secs.join(', '))}</li>`).join('')}</ul></div></div>` : '';
      return `<div class="avisos-card">${ferHtml}${multiHtml}</div>`;
    })()}

    <div class="reportBox">
      <div class="reportActions">
        <button id="copyReportBtn" type="button" class="btn-small">Copiar relatório</button>
        <button id="exportPdfBtn" type="button" class="btn-small">Exportar PDF</button>
<button id="openPerfilDocsBtn" type="button" class="btn-small" style="display:none">Abrir Perfil (Docs)</button>
<button id="refreshReportBtn" type="button" class="btn-small">Atualizar relatório</button>
        <button id="intelReportBtn" type="button" class="btn-small">🤖 Relatório Inteligente</button>
        <button id="deleteReportBtn" type="button" class="btn-small btn-danger">Apagar relatório</button>
      </div>
      <textarea id="reportText" class="reportText" placeholder="Clique em “Gerar relatório executivo” para montar o texto automaticamente…"></textarea>
    </div>
  `;

  // Bind buttons inside summary
  const copyBtn = document.getElementById('copyReportBtn');
  const exportPdfBtn = document.getElementById('exportPdfBtn');
  const openPerfilDocsBtn = document.getElementById('openPerfilDocsBtn');
  const refreshBtn = document.getElementById('refreshReportBtn');
  const intelBtn = document.getElementById('intelReportBtn');
  if (copyBtn) copyBtn.addEventListener('click', () => copyReportToClipboard());
  if (exportPdfBtn) exportPdfBtn.addEventListener('click', () => exportReportToPDF());
  if (intelBtn) intelBtn.addEventListener('click', () => generateIntelReport());
  // Perfil (Docs) button: visible only when a single atendente is selected and a link exists
  if (openPerfilDocsBtn) {
    const selected = (typeof atendenteSelect !== 'undefined' && atendenteSelect && atendenteSelect.value && atendenteSelect.value !== 'all') ? atendenteSelect.value : '';
    const link = getPerfilDocsLink(selected);
    if (!presentationMode && selected && link) {
      openPerfilDocsBtn.style.display = 'inline-flex';
      openPerfilDocsBtn.onclick = () => window.open(link, '_blank', 'noopener,noreferrer');
    } else {
      openPerfilDocsBtn.style.display = 'none';
      openPerfilDocsBtn.onclick = null;
    }
  }
  if (refreshBtn) refreshBtn.addEventListener('click', () => generateAndShowReport());
  const delBtn = document.getElementById('deleteReportBtn');
  if (delBtn) delBtn.addEventListener('click', () => clearReportTextOnly());

  card.style.display = 'block';

  // Preenche relatório se já existir
  if (window.__lastReportText) {
    const ta = document.getElementById('reportText');
    if (ta && !ta.value) ta.value = window.__lastReportText;
  }
}

// ─── VISUAL IMPROVEMENTS: variação % + sparklines ────────────

function getPreviousRecord(colaborador, currentMonth) {
  if (!rawRecords || !currentMonth) return null;
  const parts = currentMonth.split('-');
  if (parts.length !== 2) return null;
  let y = parseInt(parts[0]), m = parseInt(parts[1]);
  m--; if (m < 1) { m = 12; y--; }
  const prevMonth = `${y}-${String(m).padStart(2, '0')}`;
  return rawRecords.find(r => r['Atendente'] === colaborador && r['Mês'] === prevMonth);
}

function computeVariation(current, previous) {
  if (current == null || previous == null || Number(previous) === 0) return null;
  return ((Number(current) - Number(previous)) / Number(previous)) * 100;
}

function variationHTML(variation, suffix = '') {
  if (variation === null) return '<span class="variation-neutro">—</span>';
  const arrow = variation >= 0 ? '↑' : '↓';
  const cls = variation >= 0 ? 'variation-pos' : 'variation-neg';
  return `<span class="${cls}">${arrow} ${Math.abs(variation).toFixed(1)}%${suffix}</span>`;
}

function colabSparkline(colaborador) {
  const records = rawRecords.filter(r => r['Atendente'] === colaborador && r['Mês']);
  const meses = [...new Set(records.map(r => r['Mês']))].filter(Boolean).sort();
  const values = meses.map(m => {
    const r = records.find(x => x['Mês'] === m);
    return r ? Number(r['Finalizados'] || 0) : null;
  }).filter(v => v !== null);
  if (values.length < 2) return '<span class="variation-neutro">—</span>';
  const last6 = values.slice(-6);
  const min = Math.min(...last6), max = Math.max(...last6);
  const range = max - min || 1;
  const w = 60, h = 24, pad = 2;
  const points = last6.map((v, i) => {
    const x = pad + (i / (last6.length - 1)) * (w - pad * 2);
    const y = h - pad - ((v - min) / range) * (h - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const up = last6[last6.length - 1] >= last6[0];
  const color = up ? '#16a34a' : '#dc2626';
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><polyline fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" points="${points}"/></svg>`;
}

function renderPreview(rows) {
  previewRows = rows || [];
  // apply current sort if set
  let toRender = previewRows;
  if (currentSort.key) {
    toRender = sortRows(previewRows, currentSort.key, currentSort.desc);
  }
  renderPreviewDisplay(toRender);
  saveState();
  // update collaborator select in card-header
  const sel = document.getElementById('reportColabSelect');
  if (sel) {
    const colabs = [...new Set((toRender || []).filter(r => r && r['Atendente'] && !isAggregateName(r['Atendente']) && isColabActive(r['Atendente'])).map(r => r['Atendente']))].sort();
    const current = sel.value;
    sel.innerHTML = '<option value="">Relatório individual...</option>' + colabs.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
    if (current && colabs.includes(current)) sel.value = current;
  }
}

function renderPreviewDisplay(rows) {
  const __multiMap = (typeof getMultiSetorMap === 'function') ? getMultiSetorMap(rows) : new Map();
  if (!rows || rows.length === 0) {
    previewTable.innerHTML = '<div class="empty-state"><div class="empty-title">Nenhum dado carregado</div><div class="empty-sub">Importe arquivos para iniciar a análise.</div></div>';
    return;
  }
  // no preview numeric filters here; preview shows provided rows
  const aliasMap = buildAliasMap(rows.map(r => r['Atendente']));
  let keys = Object.keys(rows[0]);
  // exclude internal/metadata columns
  keys = keys.filter(k => !['foto', 'id', 'user_id', 'created_at', 'arquivo', 'objetivo'].includes(k.toLowerCase()));
  // move Observações to the end
  const obsIdx = keys.indexOf('Observações');
  if (obsIdx !== -1) {
    keys.splice(obsIdx, 1);
    keys.push('Observações');
  }
  // Build headers with extra columns
  let headerHtml = '';
  keys.forEach(k => {
    const thClass = k === 'Observações' ? ' class="cell-obs"' : '';
    headerHtml += `<th${thClass}>${escapeHtml(k)}</th>`;
    if (k === 'Finalizados') {
      headerHtml += '<th>Var.%</th><th>📈</th>';
    }
    if (k === 'SCORE') {
      headerHtml += '<th>Var.%</th>';
    }
  });
  headerHtml += '<th>Status</th>';
  const html = [`<div class="table-wrap"><table><thead><tr>${headerHtml}</tr></thead><tbody>`];
  rows.forEach(r => {
    const ridx = rawRecords.indexOf(r);
    const scNum = (r && r['SCORE'] !== undefined && r['SCORE'] !== null && String(r['SCORE']).trim()!=='') ? Number(String(r['SCORE']).replace(',','.')) : null;
    const classeScore = (scNum !== null && !Number.isNaN(scNum)) ? getClasseScore(scNum) : null;
    let statusClass = 'status-ok';
    let statusText = 'OK';
    if (classeScore === 'score-bad') { statusClass = 'status-bad'; statusText = 'Crítico'; }
    else if (classeScore === 'score-warn') { statusClass = 'status-warn'; statusText = 'Atenção'; }

    // Pre-compute previous record for variations
    const prevRec = getPreviousRecord(r['Atendente'], r['Mês']);
    const prevFinal = prevRec ? Number(prevRec['Finalizados'] || 0) : null;
    const prevScore = prevRec ? Number(prevRec['SCORE'] || 0) : null;
    const curFinal = Number(r['Finalizados'] || 0);
    const curScoreVal = scNum;

    let rowHtml = '';
    keys.forEach(k => {
      const raw = r[k];
      if (k === 'SCORE') {
        const display = (raw === null || raw === undefined || String(raw).trim() === '') ? '' : Number(raw).toFixed(2);
        const cls = classeScore ? ' ' + classeScore : '';
        rowHtml += `<td contenteditable="${isAdmin()}" data-idx="${ridx}" data-key="${escapeHtml(k)}" class="cell-edit score-cell${cls}">${escapeHtml(display)}</td>`;
        // Variation for SCORE
        const varScore = (curScoreVal !== null && prevScore !== null) ? computeVariation(curScoreVal, prevScore) : null;
        rowHtml += `<td class="cell-edit" style="text-align:center">${variationHTML(varScore)}</td>`;
        return;
      }
      if (k === 'Finalizados') {
        const num = raw === null || raw === undefined || raw === '' ? '' : String(Math.round(Number(String(raw).replace(/[^0-9.-]/g, ''))));
        rowHtml += `<td contenteditable="${isAdmin()}" data-idx="${ridx}" data-key="${escapeHtml(k)}" class="cell-edit">${escapeHtml(num)}</td>`;
        // Variation for Finalizados
        const varFinal = prevFinal !== null ? computeVariation(curFinal, prevFinal) : null;
        rowHtml += `<td class="cell-edit" style="text-align:center">${variationHTML(varFinal)}</td>`;
        // Sparkline
        rowHtml += `<td class="sparkline-cell">${colabSparkline(r['Atendente'])}</td>`;
        return;
      }
      if (k === 'Assumidos' || k === 'Transferidos') {
        const num = raw === null || raw === undefined || raw === '' ? '' : String(Math.round(Number(String(raw).replace(/[^0-9.-]/g, ''))));
        rowHtml += `<td contenteditable="${isAdmin()}" data-idx="${ridx}" data-key="${escapeHtml(k)}" class="cell-edit">${escapeHtml(num)}</td>`;
        return;
      }
      const txt = raw === null || raw === undefined ? '' : String(raw);
      const shown = (k === 'Atendente') ? getDisplayName(txt, aliasMap) : txt;
      if (k === 'Atendente') {
        const isFer = isFeriasObs(r['Observações']);
        const atName = String(r['Atendente']||'').trim();
        const isMulti = __multiMap.has(atName);
        const badges = `${isFer ? '<span class="row-badge badge-ferias" title="Esteve de férias neste mês">🏖️ Férias</span>' : ''}${isMulti ? `<span class="row-badge badge-multi" title="Atuou em mais de um setor: ${escapeHtml(__multiMap.get(atName).join(', '))}">🔁 Multi-setor</span>` : ''}`;
        rowHtml += `<td contenteditable="${presentationMode || !isAdmin() ? 'false' : 'true'}" data-idx="${ridx}" data-key="${escapeHtml(k)}" class="cell-edit cell-atendente">${escapeHtml(shown)}${badges}</td>`;
        return;
      }
      if (k === 'Observações') {
        const isFer = isFeriasObs(raw);
        rowHtml += `<td contenteditable="${isAdmin()}" data-idx="${ridx}" data-key="${escapeHtml(k)}" class="cell-edit cell-obs ${isFer ? 'cell-ferias' : ''}">${escapeHtml(shown)}</td>`;
        return;
      }
      rowHtml += `<td contenteditable="${isAdmin() && !(k === 'Atendente' && presentationMode)}" data-idx="${ridx}" data-key="${escapeHtml(k)}" class="cell-edit">${escapeHtml(shown)}</td>`;
    });
    html.push('<tr>' + rowHtml + `<td style="white-space:nowrap"><span class="status-badge ${statusClass}">${escapeHtml(statusText)}</span> <button class="btn-small btn-delete" data-idx="${ridx}" title="Remover" aria-label="Remover">🗑️</button></td>` + '</tr>');
  });
  html.push('</tbody></table></div>');
  previewTable.innerHTML = html.join('');

  // Highlight rows based on performance
  const _tbody = previewTable.querySelector('tbody');
  if (_tbody) {
    _tbody.querySelectorAll('tr').forEach((tr, idx) => {
      const row = rows[idx];
      if (!row) return;
      const sc = row['SCORE'];
      if (sc !== null && sc !== undefined && !isNaN(Number(sc))) {
        const cls = getClasseScore(Number(sc));
        if (cls === 'score-good') tr.classList.add('highlight-row');
        else if (cls === 'score-bad') tr.classList.add('attention-row');
      }
    });
  }

  // attach handlers for inline editing and deletion
  previewTable.querySelectorAll('.cell-edit').forEach(td => {
    td.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') { ev.preventDefault(); td.blur(); }
    });
    td.addEventListener('blur', (e) => {
      if (!requireAdmin()) return;
      const scrollX = window.scrollX || 0;
      const scrollY = window.scrollY || 0;
      const el = e.target;
      const idx = Number(el.getAttribute('data-idx'));
      const key = el.getAttribute('data-key');
      const val = el.textContent.trim();
      if (idx < 0 || idx >= rawRecords.length) return;
      const rec = rawRecords[idx];
      if (!rec) return;
      const oldVal = rec[key];
      if (key === 'SCORE') {
        const n = parseFloat(val.replace(/,/g, '.'));
        rec[key] = isNaN(n) ? null : Number(n.toFixed(2));
      } else if (key === 'Finalizados' || key === 'Assumidos' || key === 'Transferidos') {
        const n = parseInt(val.replace(/[^0-9-]/g, ''));
        rec[key] = isNaN(n) ? 0 : n;
      } else {
        rec[key] = val;
      }
      // Só salva no Supabase se o valor mudou e o registro tem id
      if (rec.id != null && rec[key] !== oldVal) {
        const payload = { [key]: rec[key] };
        dbUpdateRecord(rec.id, payload).then(ok => {
          if (!ok) showToast('Erro ao salvar alteração no banco.', 'error');
        });
      }
      if (rec[key] !== oldVal) {
        logHistorico('edit', rec, { campo: key, before: String(oldVal ?? ''), after: String(rec[key] ?? '') });
      }
      if (typeof invalidateGamificationCache === 'function') invalidateGamificationCache();
      updateFilterOptions();
      const filtered = rawRecords.filter(r => {
        if (!r) return false;
    if (setorSelect.value !== 'all' && String(r['Setor']) !== setorSelect.value) return false;
    if (setorSelect.value === 'all' && typeof isSetorActive === 'function' && !isSetorActive(String(r['Setor']).trim())) return false;
    if (!monthMatches(r['Mês'])) return false;
    if (arquivoSelect && arquivoSelect.value !== 'all' && String(r['Arquivo']) !== arquivoSelect.value) return false;
        return true;
      });
      renderChart(filtered);
      renderSummary(filtered);
      window.scrollTo(scrollX, scrollY);
    });
  });

  previewTable.querySelectorAll('.btn-delete').forEach(b => {
    b.addEventListener('click', async (e) => {
      if (!requireAdmin()) return;
      if (!confirm('Tem certeza que deseja excluir este registro?')) return;
      const scrollX = window.scrollX || 0;
      const scrollY = window.scrollY || 0;
      const idx = Number(e.target.getAttribute('data-idx'));
      if (isNaN(idx)) return;
      const rec = rawRecords[idx];
      if (!rec) return;
      // Deleta do Supabase se tiver id
      if (rec.id != null) {
        const ok = await dbDeleteRecord(rec.id);
        if (!ok) {
          showToast('Erro ao remover registro do banco.', 'error');
          return;
        }
      }
      rawRecords.splice(idx, 1);
      logHistorico('delete', rec);
      if (typeof invalidateGamificationCache === 'function') invalidateGamificationCache();
      populateFilters(rawRecords);
      updateFilterOptions();
      updateView();
      window.scrollTo(scrollX, scrollY);
    });
  });

  syncScrollbar();
}

function sortRows(rows, key, desc=true) {
  // Separate aggregate rows from regular rows
  const aggregates = rows.filter(r => r && isAggregateName(r['Atendente']));
  const regular = rows.filter(r => r && !isAggregateName(r['Atendente']));
  
  // Sort only regular rows
  regular.sort((a,b) => {
    const va = a && a[key];
    const vb = b && b[key];
    const na = (va === null || va === undefined || va === '') ? -Infinity : Number(String(va).replace(/[^0-9.-]/g, ''));
    const nb = (vb === null || vb === undefined || vb === '') ? -Infinity : Number(String(vb).replace(/[^0-9.-]/g, ''));
    if (isNaN(na) || isNaN(nb)) {
      const sa = String(va || '').localeCompare(String(vb || ''), 'pt');
      return desc ? -sa : sa;
    }
    return desc ? (nb - na) : (na - nb);
  });
  
  // Return sorted regular rows + aggregates at the end
  return [...regular, ...aggregates];
}

function renderChart(rows) {
  if (!rows) return;
  const rowsForChart = (rows || []).filter(r => !isAggregateName(r['Atendente']));

  if (!rowsForChart.length) { setChartEmpty(true, 'Ajuste os filtros ou importe novos arquivos.'); return; }
  setChartEmpty(false);
  const searchTerm = (searchAtendenteInput?.value || '').trim().toLowerCase();
  const selectedAt = getSelectedAtendentes();
  const finMap = new Map(), assMap = new Map(), scMap = new Map(), scCount = new Map();
  rowsForChart.forEach(r => {
    const k = r['Atendente'] || 'Sem nome';
    if (searchTerm) { const nm = String(k).toLowerCase(); if (!nm.includes(searchTerm)) return; }
    if (hiddenLabels.has(k)) return;
    const fin = parseInt(r['Finalizados']) || 0;
    const ass = parseInt(r['Assumidos']) || 0;
    const sc = r['SCORE'];
    finMap.set(k, (finMap.get(k) || 0) + fin);
    assMap.set(k, (assMap.get(k) || 0) + ass);
    if (sc != null && !isNaN(Number(sc))) {
      scMap.set(k, (scMap.get(k) || 0) + Number(sc));
      scCount.set(k, (scCount.get(k) || 0) + 1);
    }
  });
  let labels = Array.from(finMap.keys());
  if (!labels.length) { replaceChart({ type: 'bar', data: { labels: [], datasets: [] }, options: { plugins: { legend: { display: false } } } }); return; }
  if (selectedAt && selectedAt.length) {
    const present = selectedAt.filter(d => labels.includes(d));
    const rest = labels.filter(l => !present.includes(l)).sort((a,b) => (finMap.get(b)||0) - (finMap.get(a)||0));
    labels = [...present, ...rest];
  } else {
    labels.sort((a,b) => (finMap.get(b)||0) - (finMap.get(a)||0));
  }
  const aliasMap = buildAliasMap(labels);
  const displayLabels = labels.map(l => getDisplayName(l, aliasMap));
  const finData = labels.map(l => finMap.get(l) || 0);
  const assData = labels.map(l => assMap.get(l) || 0);
  const scData = labels.map(l => { const s = scMap.get(l), c = scCount.get(l); return c ? Number((s/c).toFixed(2)) : null; });
  sizeChartInnerForLabels(labels.length, 110);
  const maxVal = Math.max(...finData, ...assData, 1);
  const yMax = Math.ceil(maxVal * 2.2 / 100) * 100 || 200;
  const bgFin = labels.map((_,i) => `rgba(16,185,129,0.85)`);
  const bgAss = labels.map((_,i) => `rgba(37,99,235,0.85)`);
  const cfg = {
    type: 'bar',
    data: {
      labels: displayLabels,
      datasets: [
        { label: 'Assumidos', data: assData, backgroundColor: bgAss, borderRadius: 3, yAxisID: 'y' },
        { label: 'Finalizados', data: finData, backgroundColor: bgFin, borderRadius: 3, yAxisID: 'y' },
        { label: 'Score', type: 'line', data: scData, borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.05)', pointBackgroundColor: '#f59e0b', pointRadius: 5, pointHoverRadius: 7, tension: 0.3, fill: true, yAxisID: 'y1' }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 56, right: 16, bottom: 4, left: 4 } },
      plugins: {
        datalabels: { display: false },
        valueLabels: { integer: false },
        legend: { display: true, position: 'bottom', align: 'center', labels: { usePointStyle: true, pointStyle: 'circle', boxWidth: 8, boxHeight: 8, padding: 16, font: { size: 12 } } },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.92)',
          titleColor: '#f8fafc', bodyColor: '#e2e8f0',
          borderColor: 'rgba(255,255,255,0.08)', borderWidth: 1,
          padding: 12, cornerRadius: 10, displayColors: true, boxPadding: 6,
          callbacks: {
            label: (ctx) => {
              const v = ctx.parsed && ctx.parsed.y !== undefined ? ctx.parsed.y : ctx.raw;
              if ((ctx.dataset.label || '').includes('Score')) return `Score: ${Number(v).toFixed(2)}`;
              return `${ctx.dataset.label}: ${Math.round(v).toLocaleString('pt-BR')}`;
            }
          }
        }
      },
      scales: {
        y: { beginAtZero: true, max: yMax, position: 'left', grid: { color: 'rgba(148,163,184,0.14)' }, ticks: { font: { size: 11.5 } } },
        y1: { beginAtZero: true, position: 'right', grid: { drawOnChartArea: false }, min: 0, max: 5.5, ticks: { font: { size: 11.5 }, callback: v => Number(v).toFixed(2) } },
        x: { grid: { display: false }, ticks: { font: { size: 11.5 } } }
      }
    }
  };
  replaceChart(cfg);
}

function renderTimelineChart(rows) {
  if (!rows) return;
  const rowsForChart = (rows || []).filter(r => !isAggregateName(r['Atendente']));
  if (!rowsForChart.length) { setChartEmpty(true, 'Ajuste os filtros ou importe novos arquivos.'); return; }
  setChartEmpty(false);
  if (!isChartAvailable()) {
    setChartEmpty(true, 'Gráfico indisponível: a biblioteca Chart.js não foi carregada.');
    return;
  }
  const metric = 'Finalizados';

  // Para evolução mensal, usamos as linhas individuais (sem agregados)
  const base = (rows || []).filter(r => !isAggregateName(r['Atendente']));
  const months = uniqueSorted(base.map(r => String(r['Mês'] || '')).filter(Boolean));

  // Decide quais séries mostrar
  let seriesNames = [];
  const selectedAt = getSelectedAtendentes();
  if (selectedAt && selectedAt.length && !selectedAt.includes('all')) {
    seriesNames = selectedAt.slice();
  } else if (Array.isArray(compareChosen) && compareChosen.length) {
    seriesNames = compareChosen.slice();
  } else {
    seriesNames = ['(Total)'];
  }

  const aliasMap = buildAliasMap(base.map(r => r['Atendente']));
  const datasets = seriesNames.map(name => {
    const data = months.map(m => {
      const subset = base.filter(r => String(r['Mês']) === m && (name === '(Total)' || String(r['Atendente']) === name));
      if (!subset.length) return 0;
      if (metric === 'Score') {
        const scores = subset.map(r => r['SCORE']).filter(v => v !== null && v !== undefined && !Number.isNaN(v));
        if (!scores.length) return 0;
        return Math.round((scores.reduce((a,b)=>a+b,0) / scores.length) * 100) / 100;
      }
      // métricas inteiras somadas
      const key = metric === 'Score' ? 'SCORE' : metric;
      return subset.reduce((sum, r) => sum + (parseInt(r[key]) || 0), 0);
    });

    return {
      label: name === '(Total)' ? name : getDisplayName(name, aliasMap),
      data,
      hidden: hiddenLabels.has(name),
      tension: 0.2
    };
  });

  sizeChartInnerForLabels(months.length, 140);
  const ctx = document.getElementById('mainChart').getContext('2d');
  if (chart) chart.destroy();
  chart = new Chart(ctx, {
    type: 'line',
    data: { labels: months, datasets },
    plugins: [valueLabelPlugin],
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 8, right: 8, bottom: 4, left: 4 } },
      plugins: {
        datalabels: { display: false },
        valueLabels: { integer: metric !== 'Score' },
        legend: {
          display: true,
          position: 'bottom',
          align: 'center',
          labels: {
            color: (typeof Chart!=='undefined' && Chart.defaults && Chart.defaults.color) ? Chart.defaults.color : '#475569',
            usePointStyle: true, pointStyle: 'circle',
            boxWidth: 8, boxHeight: 8,
            padding: 18,
            font: { size: 12.5, weight: '600' }
          },
          onClick: (e, legendItem) => {
            const label = legendItem.text;
            if (hiddenLabels.has(label)) hiddenLabels.delete(label);
            else hiddenLabels.add(label);
            saveState();
            updateView();
          }
        },
        tooltip: {
          enabled: true,
          backgroundColor: 'rgba(15, 23, 42, 0.92)',
          titleColor: '#f8fafc', bodyColor: '#e2e8f0',
          borderColor: 'rgba(255,255,255,0.08)', borderWidth: 1,
          padding: 12, cornerRadius: 10, displayColors: true, boxPadding: 6,
          titleFont: { size: 12, weight: '600' }, bodyFont: { size: 12.5 },
          callbacks: {
            label: (ctx) => {
              const v = (ctx.parsed && ctx.parsed.y !== undefined) ? ctx.parsed.y : ctx.raw;
              const isInt = metric !== 'Score';
              const valTxt = isInt ? String(Math.round(v)) : Number(v).toFixed(2);
              const dsLabel = ctx.dataset && ctx.dataset.label ? ctx.dataset.label + ': ' : '';
              return dsLabel + valTxt;
            }
          }
        }
      },
      scales: {
        y: { beginAtZero: true, grid: { color: 'rgba(148,163,184,0.14)' }, ticks: { callback: (v) => (metric !== 'Score') ? String(Math.round(v)) : Number(v).toFixed(2), font: { size: 11.5 } } },
        x: { grid: { display: false }, ticks: { font: { size: 11.5 } } }
      }
    }
  });
}


function renderDetailedByMonthChart(rows) {
  if (!rows) return;
  const base = (rows || []).filter(r => !isAggregateName(r['Atendente']));
  if (!base.length) { setChartEmpty(true, 'Ajuste os filtros ou importe novos arquivos.'); return; }
  if (!isChartAvailable()) { setChartEmpty(true, 'Gráfico indisponível: a biblioteca Chart.js não foi carregada.'); return; }
  setChartEmpty(false);

  const months = uniqueSorted(base.map(r => String(r['Mês'] || '')).filter(Boolean));
  if (months.length < 1) { setChartEmpty(true, 'Selecione ao menos um mês.'); return; }
  sizeChartInnerForLabels(months.length, 180);

  const sumBy = (m, field) => base
    .filter(r => String(r['Mês']) === m)
    .reduce((acc, r) => acc + (parseInt(r[field]) || 0), 0);
  const avgScore = (m) => {
    const sc = base.filter(r => String(r['Mês']) === m)
      .map(r => r['SCORE'])
      .filter(v => v !== null && v !== undefined && v !== '' && !Number.isNaN(Number(v)))
      .map(Number);
    if (!sc.length) return null;
    return Math.round((sc.reduce((a,b)=>a+b,0) / sc.length) * 100) / 100;
  };

  const assumidos    = months.map(m => sumBy(m, 'Assumidos'));
  const transferidos = months.map(m => sumBy(m, 'Transferidos'));
  const finalizados  = months.map(m => sumBy(m, 'Finalizados'));
  const scores       = months.map(m => avgScore(m));

  const datasets = [
  { type: 'bar', label: 'Assumidos', categoryPercentage: 0.7, barPercentage: 0.85,    data: assumidos,    backgroundColor: 'rgba(59,130,246,0.8)',  yAxisID: 'y',  order: 3 },
  { type: 'bar', label: 'Transferidos', categoryPercentage: 0.7, barPercentage: 0.85, data: transferidos, backgroundColor: 'rgba(249,115,22,0.8)',  yAxisID: 'y',  order: 3 },
  { type: 'bar', label: 'Finalizados', categoryPercentage: 0.7, barPercentage: 0.85,  data: finalizados,  backgroundColor: 'rgba(16,185,129,0.85)',  yAxisID: 'y',  order: 3 },
  { type: 'line', label: 'Score médio', data: scores, borderColor: 'rgba(139,92,246,1)', backgroundColor: 'rgba(139,92,246,0.15)', borderWidth: 2.5, tension: 0.3, yAxisID: 'yScore', order: 1, spanGaps: true, pointRadius: 5, pointBackgroundColor: 'rgba(139,92,246,1)' }
  ];

  const ctx = document.getElementById('mainChart').getContext('2d');
  if (chart) chart.destroy();
  chart = new Chart(ctx, {
    data: { labels: months, datasets },
    plugins: [valueLabelPlugin],
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 12, right: 8, bottom: 4, left: 4 } },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        valueLabels: { integer: false },
        datalabels: { display: false },
        legend: {
          display: true,
          position: 'bottom',
          align: 'center',
          labels: {
            color: (typeof Chart!=='undefined' && Chart.defaults && Chart.defaults.color) ? Chart.defaults.color : '#475569',
            usePointStyle: true, pointStyle: 'circle',
            boxWidth: 8, boxHeight: 8,
            padding: 18,
            font: { size: 12.5, weight: '600' }
          },
          onClick: (e, legendItem, legend) => {
            const ci = legend.chart;
            const idx = legendItem.datasetIndex;
            const meta = ci.getDatasetMeta(idx);
            meta.hidden = meta.hidden === null ? !ci.data.datasets[idx].hidden : null;
            ci.update();
          }
        },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.92)',
          titleColor: '#f8fafc', bodyColor: '#e2e8f0',
          borderColor: 'rgba(255,255,255,0.08)', borderWidth: 1,
          padding: 12, cornerRadius: 10, displayColors: true, boxPadding: 6,
          titleFont: { size: 12, weight: '600' }, bodyFont: { size: 12.5 },
          callbacks: {
            label: (c) => {
              const v = (c.parsed && c.parsed.y !== undefined) ? c.parsed.y : c.raw;
              if (v === null || v === undefined) return `${c.dataset.label}: —`;
              const isScore = c.dataset.label === 'Score médio';
              return `${c.dataset.label}: ${isScore ? Number(v).toFixed(2) : Math.round(v)}`;
            }
          }
        }
      },
      scales: {
        y: { beginAtZero: true, position: 'left', grid: { color: 'rgba(148,163,184,0.14)' }, title: { display: true, text: 'Atendimentos', font: { size: 11.5, weight: '600' } }, ticks: { callback: v => String(Math.round(v)), font: { size: 11.5 } } },
        yScore: { beginAtZero: true, suggestedMin: 0, suggestedMax: 5, position: 'right', grid: { drawOnChartArea: false }, title: { display: true, text: 'Score médio (0–5)', font: { size: 11.5, weight: '600' } }, ticks: { callback: v => Number(v).toFixed(1), font: { size: 11.5 } } },
        x: { grid: { display: false }, ticks: { font: { size: 11.5 } } }
      }
    }
  });
}

function drawBar(labels, data, label, opts = {}) {
  const integer = !!opts.integer;
  const prioritize = opts.prioritize || null;

  // If prioritize (an atendente name) is provided, move it first in labels/data
  if (prioritize) {
    const idx = labels.indexOf(prioritize);
    if (idx > 0) {
      const val = data[idx];
      labels.splice(idx, 1);
      data.splice(idx, 1);
      labels.unshift(prioritize);
      data.unshift(val);
    }
  }

  const bg = labels.map((_,i) => `rgba(37,99,235,${Math.max(0.4, 0.9 - i*0.05)})`);
  sizeChartInnerForLabels(labels.length, 90);
  const cfg = {
    type: 'bar',
    data: { labels, datasets: [{ label, data, backgroundColor: bg }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 12, right: 8, bottom: 4, left: 4 } },
      plugins: {
        valueLabels: { integer },
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.92)',
          titleColor: '#f8fafc', bodyColor: '#e2e8f0',
          borderColor: 'rgba(255,255,255,0.08)', borderWidth: 1,
          padding: 12, cornerRadius: 10, displayColors: true, boxPadding: 6,
          titleFont: { size: 12, weight: '600' }, bodyFont: { size: 12.5 },
          callbacks: {
            label: (ctx) => {
              const v = ctx.parsed && ctx.parsed.y !== undefined ? ctx.parsed.y : ctx.raw;
              return `${ctx.dataset.label ? ctx.dataset.label + ': ' : ''}${integer ? String(Math.round(v)) : Number(v).toFixed(2)}`;
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(148,163,184,0.14)' },
          ticks: { callback: (v) => integer ? String(Math.round(v)) : Number(v).toFixed(2), font: { size: 11.5 } }
        },
        x: { grid: { display: false }, ticks: { font: { size: 11.5 } } }
      }
    }
  };
  replaceChart(cfg);
}

function drawLine(labels, data, label) {
  const cfg = {
    type: 'line',
    data: { labels, datasets: [{ label, data, borderColor: 'rgba(37,99,235,1)', backgroundColor: 'rgba(37,99,235,0.1)', tension: 0.3, fill: true, pointBackgroundColor: 'rgba(37,99,235,1)', pointRadius: 4 }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const v = ctx.parsed && ctx.parsed.y !== undefined ? ctx.parsed.y : ctx.raw;
              return `${ctx.dataset.label ? ctx.dataset.label + ': ' : ''}${Number(v).toFixed(2)}`;
            }
          }
        }
      },
      scales: {
        y: { ticks: { callback: (v) => Number(v).toFixed(2) } }
      }
    }
  };
  replaceChart(cfg);
}

function replaceChart(cfg) {
  if (!isChartAvailable()) {
    setChartEmpty(true, 'Gráfico indisponível: a biblioteca Chart.js não foi carregada.');
    return;
  }
  if (!cfg.plugins) cfg.plugins = [];
  // ensure our value label plugin is included
  if (!cfg.plugins.find(p => p && p.id === 'valueLabelPlugin')) cfg.plugins.push(valueLabelPlugin);
  if (chart) chart.destroy();
  chart = new Chart(ctx.getContext('2d'), cfg);
  // Attach click handler on canvas to allow hiding/restoring collaborators by label/bar click
  try {
    ctx.onclick = (evt) => {
      if (!chart) return;
      const points = chart.getElementsAtEventForMode(evt, 'nearest', { intersect: false }, true);
      if (!points || points.length === 0) return;
      const idx = points[0].index;
      const label = chart.data && chart.data.labels && chart.data.labels[idx];
      if (!label) return;
      if (hiddenLabels.has(label)) {
        if (confirm(`Restaurar colaborador "${label}"?`)) {
          hiddenLabels.delete(label);
          updateView();
        }
      } else {
        if (confirm(`Ocultar colaborador "${label}"?`)) {
          hiddenLabels.add(label);
          updateView();
        }
      }
    };
  } catch (e) {
    // ignore attach errors
  }
}

// expose for debugging
window.__app = { rawRecords };

// wire preview sort buttons

function getCurrentFilteredRows() {
  const setorVal = setorSelect.value;
  const mesVal = getActiveMonths();
  const arquivoVal = arquivoSelect ? arquivoSelect.value : 'all';
  const selectedAt = getSelectedAtendentes();

  return rawRecords.filter(r => {
    if (!r) return false;
    if (setorVal !== 'all' && String(r['Setor']) !== setorVal) return false;
    if (setorVal === 'all' && typeof isSetorActive === 'function' && !isSetorActive(String(r['Setor']).trim())) return false;
    if (mesVal.length && !mesVal.includes(String(r['Mês']))) return false;
    if (arquivoVal !== 'all' && String(r['Arquivo']) !== arquivoVal) return false;
    if (selectedAt && selectedAt.length && !selectedAt.includes('all')) {
      if (!selectedAt.includes(String(r['Atendente']))) return false;
    } else {
      if (atendenteSelect.value !== 'all' && String(r['Atendente']) !== atendenteSelect.value) return false;
    }
    return true;
  }).filter(r => !isAggregateName(r['Atendente']));
}

function buildReportText() {
  const now = new Date();
  const setorVal = setorSelect.value;
  const mesVal = getActiveMonths();
  const arquivoVal = arquivoSelect ? arquivoSelect.value : 'all';

  const rows = getCurrentFilteredRows();
  if (!rows.length) return 'Sem dados no escopo atual.';

  const sum = (key) => rows.reduce((s, r) => s + (parseInt(r[key]) || 0), 0);
  const totalAss = sum('Assumidos');
  const totalFin = sum('Finalizados');
  const totalTrans = sum('Transferidos');

  const avgScore = avgScoreBySetor(rows);

  const produtividade = totalAss > 0 ? (totalFin / totalAss) : null;
  const taxaTrans = totalAss > 0 ? (totalTrans / totalAss) : null;

  const scope = [];
  if (arquivoVal !== 'all') scope.push(`Arquivo: ${arquivoVal}`);
  if (setorVal !== 'all') scope.push(`Setor: ${setorVal}`);
  if (mesVal.length) scope.push(`Período: ${getMonthScopeLabel()}`);
  if (presentationMode) scope.push('Modo apresentação ativo');
  const q = (searchAtendenteInput?.value || '').trim();
  if (q) scope.push(`Busca: ${q}`);

  const byAtt = {};
  rows.forEach(r => {
    const a = String(r['Atendente'] || '').trim();
    if (!a) return;
    if (!byAtt[a]) byAtt[a] = { Assumidos:0, Finalizados:0, Transferidos:0, scores:[] };
    byAtt[a].Assumidos += parseInt(r['Assumidos']) || 0;
    byAtt[a].Finalizados += parseInt(r['Finalizados']) || 0;
    byAtt[a].Transferidos += parseInt(r['Transferidos']) || 0;
    const sc = r['SCORE'];
    if (sc !== null && sc !== undefined && !Number.isNaN(Number(sc))) byAtt[a].scores.push(Number(sc));
  });

  const aliasMap = buildAliasMap(Object.keys(byAtt));
  const ranking = Object.entries(byAtt).map(([name, v]) => {
    const sc = v.scores.length ? (v.scores.reduce((a,b)=>a+b,0)/v.scores.length) : null;
    const prod = v.Assumidos>0 ? (v.Finalizados/v.Assumidos) : null;
    return { name, displayName: getDisplayName(name, aliasMap), ...v, avgScore: sc, prod };
  });

  const topFin = ranking.slice().sort((a,b)=>b.Finalizados-a.Finalizados);
  const topScore = ranking.filter(x=>x.avgScore!==null).sort((a,b)=>b.avgScore-a.avgScore);
  const lowScore = ranking.filter(x=>x.avgScore!==null).sort((a,b)=>a.avgScore-b.avgScore);

  function fmtInt(n){ return (Number(n)||0).toLocaleString('pt-BR'); }
  function fmtScore(n){ return (n===null||n===undefined||Number.isNaN(n)) ? '—' : n.toFixed(2); }
  function fmtPct(n){ return (n===null||n===undefined||Number.isNaN(n)) ? '—' : (n*100).toFixed(1)+'%'; }

  const SEP = '────────────────────────────────────────────';
  const L = [];
  L.push('📊 RELATÓRIO EXECUTIVO');
  L.push(now.toLocaleString('pt-BR', { hour12:false }));
  L.push(scope.length ? `Escopo: ${scope.join(' · ')}` : 'Escopo: todos os dados importados');
  L.push('');

  // ── RESUMO ──
  L.push(SEP);
  L.push('  RESUMO DO PERÍODO');
  L.push(SEP);
  L.push('');
  L.push(`  Finalizados . . . . . . . . . ${fmtInt(totalFin)}`);
  L.push(`  Assumidos  . . . . . . . . . . ${fmtInt(totalAss)}`);
  L.push(`  Transferidos  . . . . . . . . ${fmtInt(totalTrans)}${taxaTrans===null?'':`  (taxa ${fmtPct(taxaTrans)})`}`);
  L.push(`  Score médio . . . . . . . . . ${fmtScore(avgScore)}`);
  L.push(`  Produtividade (Fin./Ass.) . . ${fmtPct(produtividade)}`);
  L.push(`  Colaboradores . . . . . . . . ${fmtInt(ranking.length)}`);

  // ── SETORES ──
  const bySetor = {};
  rows.forEach(r => {
    const s = String(r['Setor'] || '').trim() || '(sem setor)';
    if (!bySetor[s]) bySetor[s] = { Assumidos:0, Finalizados:0, Transferidos:0, scores:[], atendentes:new Set() };
    bySetor[s].Assumidos += parseInt(r['Assumidos']) || 0;
    bySetor[s].Finalizados += parseInt(r['Finalizados']) || 0;
    bySetor[s].Transferidos += parseInt(r['Transferidos']) || 0;
    const sc0 = r['SCORE'];
    if (sc0 !== null && sc0 !== undefined && !Number.isNaN(Number(sc0))) bySetor[s].scores.push(Number(sc0));
    const a0 = String(r['Atendente'] || '').trim();
    if (a0) bySetor[s].atendentes.add(a0);
  });
  const setoresOrd = Object.entries(bySetor).sort((a,b)=>b[1].Finalizados-a[1].Finalizados);
  if (setoresOrd.length > 0 || setorVal === 'all') {
    L.push('');
    L.push(SEP);
    L.push('  DADOS POR SETOR');
    L.push(SEP);
    setoresOrd.forEach(([nome, v]) => {
      const sc2 = v.scores.length ? (v.scores.reduce((a,b)=>a+b,0)/v.scores.length) : null;
      const prod2 = v.Assumidos>0 ? (v.Finalizados/v.Assumidos) : null;
      const taxT = v.Assumidos>0 ? (v.Transferidos/v.Assumidos) : null;
      L.push('');
      L.push(`  ▸ ${nome}   ·   ${v.atendentes.size} atendente${v.atendentes.size===1?'':'s'}`);
      L.push(`      Finalizados . . . . . ${fmtInt(v.Finalizados)}`);
      L.push(`      Assumidos  . . . . . . ${fmtInt(v.Assumidos)}`);
      L.push(`      Transferidos  . . . . ${fmtInt(v.Transferidos)}${taxT===null?'':`  (taxa ${fmtPct(taxT)})`}`);
      L.push(`      Score médio . . . . . ${fmtScore(sc2)}`);
      L.push(`      Produtividade . . . . ${fmtPct(prod2)}`);
    });
  }

  // ── DESTAQUES ✅ ──
  L.push('');
  L.push(SEP);
  L.push('  ✅ DESTAQUES');
  L.push(SEP);
  const destaques = [];
  if (topFin.length && topFin[0].Finalizados > 0) {
    destaques.push(`  ✅ ${topFin[0].displayName} liderou em finalizações com ${fmtInt(topFin[0].Finalizados)}.`);
  }
  if (topScore.length && topScore[0].avgScore >= 4.5) {
    destaques.push(`  ✅ ${topScore[0].displayName} teve o maior score (${fmtScore(topScore[0].avgScore)}).`);
  }
  const highProd = ranking.filter(x => x.prod !== null && x.prod >= 0.85 && x.Assumidos >= 5);
  if (highProd.length) {
    const nomes = highProd.slice(0, 3).map(x => x.displayName).join(', ');
    destaques.push(`  ✅ Produtividade alta (≥85%): ${nomes}.`);
  }
  if (ranking.filter(x => x.avgScore !== null && x.avgScore >= 4.70).length >= 3) {
    destaques.push(`  ✅ ${ranking.filter(x => x.avgScore >= 4.70).length} colaboradores com score ≥ 4,70 — qualidade consistente.`);
  }
  if (avgScore !== null && avgScore >= 4.2) {
    destaques.push(`  ✅ Score médio da equipe em ${fmtScore(avgScore)} — acima do ideal.`);
  }
  if (taxaTrans !== null && taxaTrans < 0.15) {
    destaques.push(`  ✅ Baixa taxa de transferências (${fmtPct(taxaTrans)}).`);
  }
  if (produtividade !== null && produtividade >= 0.85) {
    destaques.push(`  ✅ Produtividade da equipe em ${fmtPct(produtividade)}.`);
  }
  if (!destaques.length) destaques.push('  ℹ️  Nenhum destaque relevante neste período.');
  L.push('');
  destaques.forEach(d => L.push(d));
  L.push('');

  // ── PONTOS DE ATENÇÃO ⚠️ ──
  L.push(SEP);
  L.push('  ⚠️ PONTOS DE ATENÇÃO');
  L.push(SEP);
  const atencoes = [];
  if (avgScore !== null && avgScore < 4.2) {
    atencoes.push(`  ⚠️  Score médio abaixo de 4,20 (${fmtScore(avgScore)}).`);
  }
  if (taxaTrans !== null && taxaTrans > 0.25) {
    atencoes.push(`  ⚠️  Taxa de transferências acima de 25% (${fmtPct(taxaTrans)}).`);
  }
  if (produtividade !== null && produtividade < 0.75) {
    atencoes.push(`  ⚠️  Produtividade abaixo de 75% (${fmtPct(produtividade)}).`);
  }
  const lowProdList = ranking.filter(x => x.prod !== null && x.prod < 0.6 && x.Assumidos >= 3);
  if (lowProdList.length) {
    atencoes.push(`  ⚠️  Produtividade baixa: ${lowProdList.slice(0, 3).map(x => x.displayName).join(', ')}${lowProdList.length > 3 ? ` e mais ${lowProdList.length - 3}` : ''}.`);
  }
  if (lowScore.length) {
    const abaixo70 = lowScore.filter(x => x.avgScore < 4.70);
    if (abaixo70.length) {
      atencoes.push(`  ⚠️  Score abaixo da meta (4,70): ${abaixo70.slice(0, 3).map(x => `${x.displayName} (${fmtScore(x.avgScore)})`).join(', ')}${abaixo70.length > 3 ? ` e mais ${abaixo70.length - 3}` : ''}.`);
    }
  }
  if (!atencoes.length) atencoes.push('  ✅  Nenhum ponto crítico identificado neste período.');
  L.push('');
  atencoes.forEach(a => L.push(a));
  L.push('');

  // ── TOP — FINALIZADOS ──
  const top5fin = topFin.slice(0, 5);
  L.push(SEP);
  L.push('  TOP 5 — FINALIZADOS');
  L.push(SEP);
  L.push('');
  top5fin.forEach((x, i) => {
    L.push(`  ${i+1}.  ${x.displayName}  —  ${fmtInt(x.Finalizados)}   (Score: ${fmtScore(x.avgScore)} · Prod.: ${fmtPct(x.prod)})`);
  });

  // ── TOP — SCORE ──
  L.push('');
  L.push(SEP);
  L.push('  TOP 5 — SCORE');
  L.push(SEP);
  L.push('');
  const top5score = topScore.slice(0, 5);
  if (top5score.length) {
    top5score.forEach((x, i) => {
      L.push(`  ${i+1}.  ${x.displayName}  —  ${fmtScore(x.avgScore)}   (Final.: ${fmtInt(x.Finalizados)} · Transf.: ${fmtInt(x.Transferidos)})`);
    });
  } else {
    L.push('  ℹ️  Sem score no escopo.');
  }

  // ── PONTOS DE ATENÇÃO — MENORES SCORES ──
  L.push('');
  L.push(SEP);
  L.push('  PONTOS DE ATENÇÃO — MENORES SCORES');
  L.push(SEP);
  L.push('');
  const bottom5 = lowScore.slice(0, 5);
  if (bottom5.length) {
    bottom5.forEach((x, i) => {
      L.push(`  ${i+1}.  ${x.displayName}  —  ${fmtScore(x.avgScore)}   (Transf.: ${fmtInt(x.Transferidos)} · Prod.: ${fmtPct(x.prod)})`);
    });
  } else {
    L.push('  ℹ️  Sem score no escopo.');
  }

  // ── RESUMO POR COLABORADOR ──
  L.push('');
  L.push(SEP);
  L.push('  RESUMO POR COLABORADOR');
  L.push(SEP);
  L.push('');
  ranking.sort((a,b) => b.Finalizados - a.Finalizados).forEach(x => {
    const varScore = x.avgScore !== null && avgScore !== null && avgScore > 0
      ? ((x.avgScore - avgScore) / avgScore * 100).toFixed(1) : null;
    const sinal = varScore !== null ? (Number(varScore) >= 0 ? '+' : '') : '';
    L.push(`  ${x.displayName.padEnd(20)} Fin: ${fmtInt(x.Finalizados).padStart(5)} | Score: ${fmtScore(x.avgScore).padStart(5)}${varScore !== null ? ` (${sinal}${varScore}% vs time)` : ''} | Prod.: ${fmtPct(x.prod).padStart(5)}`);
  });

  return L.join('\n');
}


// ── Removed: clearReportTextOnly, generateAndShowReport, copyReportToClipboard, exportReportToPDF, exportPDFcomGrafico, escapeHtml moved to static/reports.js; handleError moved to static/csv-import.js ──

document.addEventListener('DOMContentLoaded', async () => {
  console.log('[App] DOMContentLoaded disparado! sbClient:', !!sbClient);
  // Aguarda autenticação (se Supabase estiver disponível)
  if (sbClient) {
    const user = await initAuth();
    console.log('[App] initAuth retornou user:', !!user);
    if (!user) {
      // Se não logou, não carrega dados do app
      console.log('[App] Sem usuario, abortando');
      return;
    }
  }

  // Define papel do usuário (admin/viewer)
  if (sbClient) {
    const { data: { user } } = await sbClient.auth.getUser();
    if (user) {
      const role = user.user_metadata?.role;
      if (role === 'admin') {
        document.body.dataset.role = 'admin';
      } else {
        document.body.dataset.role = 'viewer';
      }
      if (!role) {
        try {
          await fetch('/api/users', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: user.id, role: 'viewer' })
          });
        } catch (e) {}
      }
      // Mostra usuário logado na topbar
      const dropdownEmail = document.getElementById('dropdownUserEmail');
      if (dropdownEmail) {
        dropdownEmail.textContent = user.email;
      }
      const avatar = document.getElementById('userAvatar');
      if (avatar) {
        avatar.textContent = '👤';
      }
      // User menu toggle
      const menuBtn = document.getElementById('userMenuBtn');
      const dropdown = document.getElementById('userDropdown');
      if (menuBtn && dropdown) {
        menuBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          dropdown.classList.toggle('open');
        });
        document.addEventListener('click', () => dropdown.classList.remove('open'), { capture: true });
      }
    }
  }

  // Carrega dados extras do Supabase (metas, comentários, scoring, fotos, etc.)
  if (typeof initDbExtra === 'function') {
    setLoading(true, 'Carregando dados...');
    initDbExtra().then(() => {
      setLoading(false);
      console.log('[App] db-extra carregado do Supabase');
    }).catch(() => setLoading(false));
  }

  const btnF = document.getElementById('sortFinalizadosBtn');
  const btnS = document.getElementById('sortScoreBtn');
  const btnA = document.getElementById('sortAssumidosBtn');
  const btnT = document.getElementById('sortTransferidosBtn');
  const btnR = document.getElementById('resetSortBtn');
  const addRowBtn = document.getElementById('addRowBtn');
  const addRowTopBtn = document.getElementById('addRowTopBtn');
  const exportCsvBtn = document.getElementById('exportCsvBtn');
  const restoreSavedBtn = document.getElementById('restoreSavedBtn');
  const clearSavedBtn = document.getElementById('clearSavedBtn');

  // Tenta carregar do Supabase primeiro
  console.log('[App] Iniciando carregamento... sbClient:', !!sbClient);
  const supabaseRecords = await dbLoadRecords();
  console.log('[App] supabaseRecords:', supabaseRecords?.length, 'registros');
  if (supabaseRecords && supabaseRecords.length > 0) {
    console.log('[App] Usando dados do Supabase');
    rawRecords = normalizeAtendenteOnRecords(supabaseRecords);
    console.log('[App] rawRecords apos normalize:', rawRecords?.length, 'registros, primeiro:', rawRecords?.[0]);
    if (typeof invalidateGamificationCache === 'function') invalidateGamificationCache();
    console.log('[App] chamando populateFilters...');
    populateFilters(rawRecords);
    console.log('[App] chamando globalFilters.popularOptions...');
    if (typeof globalFilters !== 'undefined' && globalFilters && typeof globalFilters.popularOptions === 'function') {
      globalFilters.popularOptions();
    }
    console.log('[App] chamando updateFilterOptions...');
    updateFilterOptions();
    console.log('[App] chamando updateView...');
    handleError('updateView', () => updateView());
    clearSavedState();
    console.log('[App] chamando showAppScreen...');
    showAppScreen();
    console.log('[App] TUDO OK');
  } else {
    // Fallback: localStorage (ou dados de sessão anterior)
    console.log('[App] Supabase vazio/indisponivel, tentando localStorage');
    syncMonthPickerVisibility();
    const saved = loadSavedState();
    if (saved) {
      console.log('[App] Dados encontrados no localStorage:', saved.rawRecords?.length, 'registros');
      applySavedState(saved);
      if (sbClient) showAppScreen();
    } else {
      console.log('[App] Nenhum dado no localStorage');
      updateStorageUI(null);
      if (sbClient) showAppScreen();
    }
  }


// Inicia no Menu inicial (mantém restauração automática em memória, mas só mostra painel quando você entrar)
const startBtn = document.getElementById('startBtn');
const openSavedBtn = document.getElementById('openSavedBtn');
const homeSavedInfo = document.getElementById('homeSavedInfo');
const homeBtn = document.getElementById('homeBtn');

const savedForHome = loadSavedState();
if (savedForHome && openSavedBtn) {
  openSavedBtn.classList.remove('hidden');
  const when = savedForHome?.savedAt ? formatDateTime(savedForHome.savedAt) : '';
  if (homeSavedInfo) homeSavedInfo.textContent = when ? `Último painel salvo em: ${when}` : 'Existe um painel salvo neste navegador.';
} else {
  if (homeSavedInfo) homeSavedInfo.textContent = 'Dica: após carregar e ajustar, seus dados ficam salvos automaticamente neste navegador.';
}




if (startBtn) startBtn.addEventListener('keydown', (ev) => {
  if (ev.key === 'Enter' || ev.key === ' ') {
    ev.preventDefault();
    const inp = document.getElementById('homeFileInput');
    inp && inp.click();
  }
});


if (startBtn) startBtn.addEventListener('click', () => {
  const inp = document.getElementById('homeFileInput');
  inp && inp.click();
});

if (openSavedBtn) openSavedBtn.addEventListener('click', async () => {
  const supabaseRecords = await dbLoadRecords();
  if (supabaseRecords && supabaseRecords.length > 0) {
    rawRecords = normalizeAtendenteOnRecords(supabaseRecords);
    if (typeof invalidateGamificationCache === 'function') invalidateGamificationCache();
    setGlobalEmpty(false);
    populateFilters(rawRecords);
    updateFilterOptions();
    try { updateView(); } catch (e) {}
    clearSavedState();
    updateStorageUI('ok', null);
    showAppScreen();
    showToast(`${rawRecords.length} registros carregados do banco.`, 'success', 'Supabase');
  } else {
    const st = loadSavedState();
    if (st) applySavedState(st);
    showAppScreen();
  }
});

// Se já existir estado em memória (restaurado acima), mantém oculto até o usuário entrar
if (!rawRecords || !rawRecords.length) {
  showHomeScreen();
}



  if (btnF) btnF.addEventListener('click', () => { 
    if (currentSort.key === 'Finalizados') currentSort.desc = !currentSort.desc; else { currentSort.key = 'Finalizados'; currentSort.desc = true; }
    renderPreview(previewRows);
  });
  if (btnS) btnS.addEventListener('click', () => { 
    if (currentSort.key === 'SCORE') currentSort.desc = !currentSort.desc; else { currentSort.key = 'SCORE'; currentSort.desc = true; }
    renderPreview(previewRows);
  });
  if (btnA) btnA.addEventListener('click', () => { 
    if (currentSort.key === 'Assumidos') currentSort.desc = !currentSort.desc; else { currentSort.key = 'Assumidos'; currentSort.desc = true; }
    renderPreview(previewRows);
  });
  if (btnT) btnT.addEventListener('click', () => { 
    if (currentSort.key === 'Transferidos') currentSort.desc = !currentSort.desc; else { currentSort.key = 'Transferidos'; currentSort.desc = true; }
    renderPreview(previewRows);
  });
  if (btnR) btnR.addEventListener('click', () => { currentSort.key = null; currentSort.desc = true; renderPreview(previewRows); });
  if (addRowBtn) addRowBtn.addEventListener('click', () => { if (!requireAdmin()) return; addRow(); });
  if (addRowTopBtn) addRowTopBtn.addEventListener('click', () => { if (!requireAdmin()) return; openProjecaoOverlay(); });
  const cleanDupBtn = document.getElementById('cleanDupBtn');
  if (cleanDupBtn) cleanDupBtn.addEventListener('click', () => { if (!requireAdmin()) return; cleanDuplicates(); });
  if (exportCsvBtn) exportCsvBtn.addEventListener('click', () => { exportCsv(); });
  document.getElementById('gerarRelatorioCompactBtn')?.addEventListener('click', () => {
    const sel = document.getElementById('reportColabSelect');
    if (!sel || !sel.value) { showToast('Selecione um colaborador.', 'error', 'Relatório'); return; }
    if (typeof openColabReport === 'function') openColabReport(sel.value);
  });
  if (restoreHiddenBtn) restoreHiddenBtn.addEventListener('click', () => { hiddenLabels.clear(); updateView(); });
  const exportChartPngBtn = document.getElementById('exportChartPngBtn');
  if (exportChartPngBtn) exportChartPngBtn.addEventListener('click', () => { exportChartAsPNG(); });
  // Exportar PDF é vinculado em renderSummary() — abre HTML bonito em nova aba

  // ── Compact table toggle ──
  const COMPACT_KEY = 'sistema_table_compact';
  function applyCompact(enabled) {
    document.body.classList.toggle('table-compact', enabled);
    localStorage.setItem(COMPACT_KEY, enabled ? '1' : '');
    const btn = document.getElementById('compactTableBtn');
    if (btn) btn.innerHTML = enabled ? '📏 Visão normal' : '📏 Visão compacta';
  }
  applyCompact(localStorage.getItem(COMPACT_KEY) === '1');
  const compactBtn = document.getElementById('compactTableBtn');
  if (compactBtn) {
    compactBtn.addEventListener('click', () => {
      applyCompact(!document.body.classList.contains('table-compact'));
    });
  }

  // ── Collapsible sidebar panels ──
  document.querySelectorAll('.panel-collapsible .panel-header').forEach(header => {
    header.addEventListener('click', () => {
      const panel = header.closest('.panel-collapsible');
      if (panel) panel.classList.toggle('collapsed');
    });
  });

  updatePreviewSortControls();

  // ===== Tab System =====
  const tabBar = document.getElementById('tabBar');
  if (tabBar) {
    tabBar.addEventListener('click', (e) => {
      const tabBtn = e.target.closest('.tab-btn');
      if (!tabBtn) return;
      const tab = tabBtn.getAttribute('data-tab');
      if (!tab) return;

      // Update active state
      tabBar.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      tabBtn.classList.add('active');

      // Show/hide tab content
      document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
      const target = document.getElementById('tab-' + tab);
      if (target) target.classList.add('active');

      // Call per-tab initialization
      if (tab === 'gamificacao' && typeof onGamificationTabActivated === 'function') {
        onGamificationTabActivated();
      }
      if (tab === 'metas' && typeof onMetasTabActivated === 'function') {
        onMetasTabActivated();
      }
      if (tab === 'comparativos' && typeof onComparativosTabActivated === 'function') {
        onComparativosTabActivated();
      }
      if (tab === 'lider' && typeof onLiderTabActivated === 'function') {
        onLiderTabActivated();
      }
      if (tab === 'insights' && typeof onInsightsTabActivated === 'function') {
        onInsightsTabActivated();
      }
      if (tab === 'feedbacks' && typeof onFeedbacksTabActivated === 'function') {
        onFeedbacksTabActivated();
      }
      if (tab === 'anotacoes' && typeof onAnotacoesTabActivated === 'function') {
        onAnotacoesTabActivated();
      }
      if (tab === 'tarefas' && typeof onTarefasTabActivated === 'function') {
        onTarefasTabActivated();
      }
      if (tab === 'colaboradores' && typeof onColaboradoresTabActivated === 'function') {
        onColaboradoresTabActivated();
      }
      if (tab === 'relatorio-setorial' && typeof onRelatorioSetorialTabActivated === 'function') {
        onRelatorioSetorialTabActivated();
      }
      if (tab === 'dashboard') {
        updateView();
      }

      // Refresh chart if chart canvas was resized/hidden
      if (tab === 'dashboard' && chart) {
        try { chart.resize(); } catch(e) {}
      }

      // Persist active tab
      try { localStorage.setItem('sistema_active_tab', tab); } catch(e) {}
    });
  }

  // Restore last active tab
  try {
    const savedTab = localStorage.getItem('sistema_active_tab');
    if (savedTab && savedTab !== 'dashboard') {
      const btn = tabBar && tabBar.querySelector(`.tab-btn[data-tab="${savedTab}"]`);
      if (btn) btn.click();
    }
  } catch(e) {}

  // ===== Initialize Scoring Rules UI =====
  if (typeof renderScoringRules === 'function') {
    renderScoringRules();
  }

  // ===== Refresh Gamification =====
  const refreshGamBtn = document.getElementById('refreshGamificacaoBtn');
  if (refreshGamBtn) {
    refreshGamBtn.addEventListener('click', () => {
      if (typeof invalidateGamificationCache === 'function') invalidateGamificationCache();
      if (typeof renderGamification === 'function') renderGamification();
      showToast('Gamificação atualizada!', 'success');
    });
  }

  // ===== Add Meta =====
  const addMetaBtn = document.getElementById('addMetaBtn');
  if (addMetaBtn) {
    addMetaBtn.addEventListener('click', () => {
      // Scroll to the meta form
      const saveBtn = document.getElementById('saveMetaBtn');
      if (saveBtn) saveBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  // ===== Refresh Painel Líder =====
  const refreshLiderBtn = document.getElementById('refreshLiderBtn');
  if (refreshLiderBtn) {
    refreshLiderBtn.addEventListener('click', () => {
      if (typeof renderPainelLider === 'function') renderPainelLider();
      showToast('Painel do líder atualizado!', 'success');
    });
  }

  // ===== Refresh Insights =====
  const refreshInsightsBtn = document.getElementById('refreshInsightsBtn');
  if (refreshInsightsBtn) {
    refreshInsightsBtn.addEventListener('click', () => {
      if (typeof renderInsights === 'function') renderInsights();
      showToast('Insights atualizados!', 'success');
    });
  }

  // ===== Reset Alertas =====
  const resetAlertasBtn = document.getElementById('resetAlertasBtn');
  if (resetAlertasBtn && typeof resetAlertasConfig === 'function') {
    resetAlertasBtn.addEventListener('click', () => {
      if (!requireAdmin()) return;
      if (confirm('Resetar configuração de alertas para os valores padrão?')) {
        resetAlertasConfig();
        showToast('Alertas resetados.', 'success');
      }
    });
  }

  // ===== Refresh Comparativos =====
  const refreshCompBtn = document.getElementById('refreshComparativosBtn');
  if (refreshCompBtn) {
    refreshCompBtn.addEventListener('click', () => {
      if (typeof renderComparativos === 'function') renderComparativos();
      showToast('Comparativos atualizados!', 'success');
    });
  }

  // ===== Manage Colabs / Setores buttons =====
  const manageColabsBtn = document.getElementById('manageColabsBtn');
  if (manageColabsBtn) manageColabsBtn.addEventListener('click', openManageColabs);
  const manageSetoresBtn = document.getElementById('manageSetoresBtn');
  if (manageSetoresBtn) manageSetoresBtn.addEventListener('click', openManageSetores);

  // ===== Init Metas on load =====
  if (typeof loadMetas === 'function') loadMetas();

  // ===== Global Filters bridge: re-render all tabs on filter change =====
  if (typeof globalFilters !== 'undefined' && globalFilters && typeof globalFilters.onChange === 'function') {
    globalFilters.onChange(() => {
      syncGlobalState();
      invalidateGamificationCache && invalidateGamificationCache();
      const activeTab = document.querySelector('.tab-btn.active');
      if (activeTab) {
        const tab = activeTab.getAttribute('data-tab');
        if (tab === 'dashboard') updateView();
        else if (tab === 'gamificacao' && typeof onGamificationTabActivated === 'function') onGamificationTabActivated();
        else if (tab === 'metas' && typeof onMetasTabActivated === 'function') onMetasTabActivated();
        else if (tab === 'comparativos' && typeof onComparativosTabActivated === 'function') onComparativosTabActivated();
        else if (tab === 'lider' && typeof onLiderTabActivated === 'function') onLiderTabActivated();
        else if (tab === 'insights' && typeof onInsightsTabActivated === 'function') onInsightsTabActivated();
        else if (tab === 'relatorio-setorial' && typeof onRelatorioSetorialTabActivated === 'function') onRelatorioSetorialTabActivated();
      }
    });
  }

  // ===== Popular global filter options whenever data changes =====
  const __origPopulateFilters = populateFilters;
  populateFilters = function(data) {
    __origPopulateFilters(data);
    if (typeof globalFilters !== 'undefined' && globalFilters && typeof globalFilters.popularOptions === 'function') {
      globalFilters.popularOptions();
    }
  };

  // ===== Resize handler for scrollbar sync =====
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { if (typeof syncScrollbar === 'function') syncScrollbar(); }, 150);
  });
});

// ── Removed: toggleFavorite, generateIntelReport, exportChartAsPNG, exportCsv moved to static/reports.js ──

async function addRow() {
  const newRec = { Setor: '', 'Mês': '', Atendente: '', Assumidos: 0, Transferidos: 0, Finalizados: 0, SCORE: null, Nota1: 0, Nota2: 0, Nota3: 0, Total: 0, Objetivo: 0 };
  if (sbClient) {
    const inserted = await dbInsertRow(newRec);
    if (inserted && inserted.id) {
      newRec.id = inserted.id;
    }
  }
  rawRecords.push(newRec);
  if (typeof invalidateGamificationCache === 'function') invalidateGamificationCache();
  populateFilters(rawRecords);
  updateFilterOptions();
  const filtered = rawRecords.filter(r => {
    if (!r) return false;
    if (setorSelect.value !== 'all' && String(r['Setor']) !== setorSelect.value) return false;
    if (!monthMatches(r['Mês'])) return false;
    if (arquivoSelect && arquivoSelect.value !== 'all' && String(r['Arquivo']) !== arquivoSelect.value) return false;
    return true;
  });
  renderChart(filtered);
  renderSummary(filtered);
  renderPreviewDisplay([newRec]);
  saveState();
  setTimeout(() => {
    const td = previewTable.querySelector('.cell-edit');
    if (td) {
      td.focus();
      setCaretToEnd(td);
    }
  }, 50);
}

function setCaretToEnd(el) {
  if (!el) return;
  el.focus();
  const sel = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  sel.removeAllRanges();
  sel.addRange(range);
}

/* ===== Theme toggle (light/dark) ===== */
(function(){
  function getTheme(){
    return document.documentElement.getAttribute('data-theme') || 'light';
  }
  function setTheme(t){
    document.documentElement.setAttribute('data-theme', t);
    try { localStorage.setItem('theme', t); } catch(e) {}
    if (typeof Chart !== 'undefined' && Chart.defaults) {
      Chart.defaults.color = t === 'dark' ? '#e2e8f0' : '#1f2937';
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
        Object.values(Chart.instances).forEach(function(c){ try { c.update(); } catch(e){} });
      } else if(Chart.registry){
        document.querySelectorAll('canvas').forEach(function(canvas){
          const inst = Chart.getChart(canvas);
          if(inst) try { inst.update(); } catch(e){}
        });
      }
    } catch(e) {}
  }
  function init(){
    const saved = localStorage.getItem('theme');
    if(saved === 'dark' || saved === 'light') setTheme(saved);
    else if(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) setTheme('dark');
    else setTheme('light');
    document.querySelectorAll('.theme-toggle').forEach(function(btn){
      btn.addEventListener('click', function(){
        setTheme(getTheme() === 'dark' ? 'light' : 'dark');
      });
    });
    setTimeout(updateTarefasBadge, 100);
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
// ── Removed: buildReportHTML moved to static/reports.js ──

