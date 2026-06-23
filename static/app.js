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
let meetingMode = false;

// -------------------------
// Navegação: Menu inicial / Painel
// -------------------------
function showHomeScreen() {
  const home = document.getElementById('homeScreen');
  const app = document.getElementById('appScreen');
  const homeBtn = document.getElementById('homeBtn');
  if (home) home.style.display = 'flex';
  if (app) app.style.display = 'none';
  if (homeBtn) homeBtn.classList.add('hidden');

  setGlobalEmpty(true);
}

function showAppScreen() {
  const home = document.getElementById('homeScreen');
  const app = document.getElementById('appScreen');
  const homeBtn = document.getElementById('homeBtn');
  if (home) home.style.display = 'none';
  if (app) app.style.display = 'block';
  if (homeBtn) homeBtn.classList.remove('hidden');

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

function resetPanelState() {
  // Reseta filtros, comparações e ordenação (sem apagar dados salvos)
  if (setorSelect) setorSelect.value = 'all';
  if (mesSelect) mesSelect.value = 'all';
  selectedMonths = [];
  if (atendenteSelect) atendenteSelect.value = 'all';
  if (arquivoSelect) arquivoSelect.value = 'all';
  if (viewSelect) viewSelect.value = 'attendee';
  if (metricSelect) metricSelect.value = 'Desempenho';
  if (searchAtendenteInput) searchAtendenteInput.value = '';

  // reset compare + ocultos + ordenação
  compareChosen = [];
  hiddenLabels = new Set();
  currentSort = { key: null, desc: true };

  renderCompareChips && renderCompareChips();
  updatePreviewSortControls && updatePreviewSortControls();
  updateFilterOptions && updateFilterOptions();
}

function goToHomeMenu() {
  resetPanelState();
  clearVisualsOnly();
  showHomeScreen();
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
    favorites: window.__favoriteColabs ? Array.from(window.__favoriteColabs) : [],
    activeTab: (document.querySelector('.tab-btn.active') || {}).getAttribute ? document.querySelector('.tab-btn.active').getAttribute('data-tab') : 'dashboard',
    filters: {
      setor: setorSelect?.value ?? 'all',
      mes: mesSelect?.value ?? 'all',
      mesesSelecionados: Array.isArray(selectedMonths) ? selectedMonths.slice() : [],
      presentationMode,
      meetingMode,
      atendente: atendenteSelect?.value ?? 'all',
      arquivo: arquivoSelect?.value ?? 'all',
      view: viewSelect?.value ?? 'attendee',
      compareSelect: compareSelect?.value ?? 'all',
      metric: metricSelect?.value ?? 'Finalizados',
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
      // Restore favorites
      if (Array.isArray(state.favorites)) {
        window.__favoriteColabs = new Set(state.favorites);
      }
    }

    // re-populate filter options based on restored data
    populateFilters(rawRecords);

    // apply saved selections (if option exists, otherwise fall back)
    if (setorSelect && state.filters?.setor) setorSelect.value = state.filters.setor;
    if (mesSelect && state.filters?.mes) mesSelect.value = state.filters.mes;
    selectedMonths = Array.isArray(state.filters?.mesesSelecionados) ? state.filters.mesesSelecionados.slice() : [];
    presentationMode = !!state.filters?.presentationMode;
    meetingMode = !!state.filters?.meetingMode;
    if (presentationModeToggle) presentationModeToggle.checked = presentationMode;
    if (meetingModeToggle) meetingModeToggle.checked = meetingMode;
    applyMeetingMode();
    if (atendenteSelect && state.filters?.atendente) atendenteSelect.value = state.filters.atendente;
    if (arquivoSelect && state.filters?.arquivo) arquivoSelect.value = state.filters.arquivo;

    if (metricSelect) metricSelect.value = 'Desempenho';
    if (searchAtendenteInput && typeof state.filters?.search === 'string') searchAtendenteInput.value = state.filters.search;
    if (viewSelect && state.filters?.view) viewSelect.value = state.filters.view;

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

function updateStorageUI(status, savedAtIso) {
  const badge = document.getElementById('storageBadge');
  const btnRestore = document.getElementById('restoreSavedBtn');
  const btnClear = document.getElementById('clearSavedBtn');

  const existing = loadSavedState();
  const hasSaved = !!existing;

  if (!badge || !btnRestore || !btnClear) return;

  if (!hasSaved) {
    badge.classList.add('hidden');
    btnRestore.classList.add('hidden');
    btnClear.classList.add('hidden');
    return;
  }

  const savedAt = savedAtIso || existing?.savedAt;
  const when = savedAt ? formatDateTime(savedAt) : '';
  badge.textContent = when ? `Salvo: ${when}` : 'Salvo';
  badge.classList.remove('hidden');

  badge.classList.remove('ok', 'warn');
  if (status === 'warn') badge.classList.add('warn');
  else badge.classList.add('ok');

  btnRestore.classList.remove('hidden');
  btnClear.classList.remove('hidden');
}

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
        ctx.font = isScore || isCount ? '14px system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial' : '12px system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial';
        ctx.fillStyle = isScore ? '#f59e0b' : ((typeof Chart!=='undefined' && Chart.defaults && Chart.defaults.color) ? Chart.defaults.color : (document.documentElement.classList.contains('dark') || document.body.classList.contains('dark') ? '#e2e8f0' : '#334155'));
        if (isCount) ctx.fillStyle = '#1e293b';
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
const meetingModeToggle = document.getElementById('meetingModeToggle');
const atendenteSelect = document.getElementById('atendenteSelect');
const searchAtendenteInput = document.getElementById('searchAtendenteInput');
const compareSelect = document.getElementById('compareSelect');
const arquivoSelect = document.getElementById('arquivoSelect');
const viewSelect = document.getElementById('viewSelect');
const generateReportBtn = document.getElementById('generateReportBtn');
const compareLabel = document.getElementById('compareLabel');
const addCompareBtn = document.getElementById('addCompareBtn');
const clearCompareBtn = document.getElementById('clearCompareBtn');
const compareChips = document.getElementById('compareChips');
let compareChosen = []; // ordered array of names added for comparison
const clearFiltersBtn = document.getElementById('clearFiltersBtn');
const metricSelect = document.getElementById('metricSelect');
const previewTable = document.getElementById('previewTable');
const ctx = document.getElementById('mainChart');
const restoreHiddenBtn = document.getElementById('restoreHiddenBtn');


async function parseCsvFile(file) {
  const text = await file.text();

  // Detect delimiter from header
  const firstLine = (text.split(/\r?\n/)[0] || '').trim();
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semiCount = (firstLine.match(/;/g) || []).length;
  const delimiter = semiCount > commaCount ? ';' : ',';

  // Prefer PapaParse if available
  if (typeof Papa !== 'undefined' && Papa && typeof Papa.parse === 'function') {
    return new Promise((resolve) => {
      Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        delimiter,
        complete: (results) => resolve(results)
      });
    });
  }

  // Offline fallback parser (supports quotes)
  function parseLine(line) {
    const out = [];
    let cur = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];

      if (ch === '"') {
        const next = line[i + 1];
        if (inQuotes && next === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }

      if (!inQuotes && ch === delimiter) {
        out.push(cur);
        cur = '';
        continue;
      }

      cur += ch;
    }
    out.push(cur);
    return out;
  }

  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length < 2) return { data: [], meta: { fields: [] } };

  const headers = parseLine(lines[0]).map(h => (h || '').trim());
  const data = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i]);
    const row = {};
    for (let c = 0; c < headers.length; c++) {
      const key = headers[c] || `col_${c}`;
      row[key] = (values[c] ?? '').trim();
    }
    data.push(row);
  }

  return { data, meta: { fields: headers } };
}

function showImportError(message) {
  try { showToast(message, 'error', 'Importação'); } catch (e) { console.error(message); }
}


async function importCsvFiles(fileList) {
  const files = Array.from(fileList || []).filter(Boolean);
  if (!files.length) return;

  try {
    const parsed = await Promise.all(files.map(async (f) => {
      const results = await parseCsvFile(f);
      return { file: f, results };
    }));

    const merged = [];
    for (const item of parsed) {
      const fields = item.results?.meta?.fields || [];
      const rows = item.results?.data || [];
      const normalized = normalizeRecords(rows, fields, item.file?.name || 'CSV');

      // Filter out aggregate lines and incomplete rows
      const clean = (normalized || []).filter(r => {
        if (!r) return false;
        if (!r['Setor'] || !r['Mês'] || !r['Atendente']) return false;
        if (isAggregateName(r['Atendente']) || isAggregateName(r['Setor'])) return false;
        return true;
      });

      merged.push(...clean);
    }

    if (!merged.length) {
      showImportError('Não foi possível importar os dados. Verifique se o arquivo é um CSV válido e se as colunas estão corretas.');
      return;
    }

    rawRecords = normalizeAtendenteOnRecords(merged);
    if (typeof invalidateGamificationCache === 'function') invalidateGamificationCache();
    setGlobalEmpty(false);
    populateFilters(rawRecords);
    updateFilterOptions();

    // Salvar no Supabase
    setLoading(true, 'Salvando no banco de dados…');
    const saved = await dbReplaceAll(rawRecords);
    if (saved) {
      showToast(`Dados salvos no banco (${rawRecords.length} registros).`, 'success', 'Supabase');
    } else {
      console.warn('dbReplaceAll retornou false. sbClient:', !!sbClient);
      if (!sbClient) {
        showToast('Cliente Supabase não inicializado. Verifique o console (F12).', 'error', 'Supabase');
      } else {
        showToast('Erro ao salvar no banco. Veja detalhes no console (F12).', 'error', 'Supabase');
      }
    }
    setLoading(false);

    try {
      updateView();
    } catch (e) {
      console.error('updateView failed', e);
      setChartEmpty(true, 'Dados importados, mas ocorreu um erro ao renderizar o gráfico.');
    }
    showAppScreen();
  } catch (err) {
    console.error(err);
    showImportError('Ocorreu um erro ao importar. Se possível, verifique no Console (F12) e tente novamente.');
  }
}




async function onFileInputChange(e) {
  if (!requireAdmin()) return;
  const input = e && e.target ? e.target : null;
  const files = input && input.files ? Array.from(input.files) : [];
  if (!files.length) return;

  if (__isImporting) return;
  __isImporting = true;
  setImportStatus('Importando…');
  setLoading(true, 'Importando CSV…');

  try {
    await importCsvFiles(files);
    showToast('CSV importado com sucesso.', 'success', 'Importação');
  } finally {
    // allow selecting the same file again later (some browsers don't fire change if same file)
    if (input) input.value = '';
    setImportStatus('');
    setLoading(false);
    __isImporting = false;
  }
}


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
if (viewSelect) viewSelect.addEventListener('change', updateView);
if (generateReportBtn) generateReportBtn.addEventListener('click', () => { generateAndShowReport(); });
if (compareSelect) compareSelect.addEventListener('change', () => {}); // no-op; use Add button
if (addCompareBtn) addCompareBtn.addEventListener('click', () => { addCompare(); updateView(); });
if (clearCompareBtn) clearCompareBtn.addEventListener('click', () => { clearCompare(); updateView(); });
metricSelect.addEventListener('change', updateView);
if (searchAtendenteInput) searchAtendenteInput.addEventListener('input', () => { updateView(); });
if (selectAllMonthsBtn) selectAllMonthsBtn.addEventListener('click', () => { selectedMonths = uniqueSorted(rawRecords.map(r => r['Mês'])); renderMonthPickerOptions(); updateFilterOptions(); updateView(); });
if (clearMonthsBtn) clearMonthsBtn.addEventListener('click', () => { selectedMonths = []; renderMonthPickerOptions(); updateFilterOptions(); updateView(); });
if (presentationModeToggle) presentationModeToggle.addEventListener('change', () => { presentationMode = !!presentationModeToggle.checked; updateView(); saveState(); });
if (meetingModeToggle) meetingModeToggle.addEventListener('change', () => {
  meetingMode = !!meetingModeToggle.checked;
  if (meetingMode) {
    presentationMode = true;
    if (presentationModeToggle) presentationModeToggle.checked = true;
  }
  applyMeetingMode();
  updateView();
  saveState();
});
if (clearFiltersBtn) clearFiltersBtn.addEventListener('click', () => { clearFilters(); });
// preview filters handled when rendering preview

function normalizeRecords(rows, fields, sourceName) {
  // Map CSV headers to normalized keys
  const headerMap = {};
  fields.forEach(f => {
    const k = f.normalize('NFKD').replace(/\s+/g, '');
    const lower = k.toLowerCase();
    if (lower.includes('setor')) headerMap[f] = 'Setor';
    else if (lower.includes('mês') || lower.includes('mes')) headerMap[f] = 'Mês';
    else if (lower.includes('atendente')) headerMap[f] = 'Atendente';
    else if (lower.includes('assumid')) headerMap[f] = 'Assumidos';
    else if (lower.includes('transfer')) headerMap[f] = 'Transferidos';
    else if (lower.includes('finaliz')) headerMap[f] = 'Finalizados';
    else if (lower === 'score' || lower.includes('score')) headerMap[f] = 'SCORE';
    else if (lower === 'total' || lower.includes('total')) headerMap[f] = 'Total';
    else if (lower.includes('nota1')) headerMap[f] = 'Nota1';
    else if (lower.includes('nota2')) headerMap[f] = 'Nota2';
    else if (lower.includes('nota3')) headerMap[f] = 'Nota3';
    else if (lower.includes('objetiv') || lower.includes('objetivo')) headerMap[f] = 'Objetivo';
    else if (lower.includes('observ') || lower === 'obs' || lower.includes('coment')) headerMap[f] = 'Observações';
    else headerMap[f] = f.trim();
  });

  return rows.map(r => {
    const out = {};
    if (sourceName) out['Arquivo'] = sourceName;
    for (const rawKey in r) {
      const key = headerMap[rawKey] || rawKey;
      let val = r[rawKey];
      if (typeof val === 'string') val = val.trim();
      if (key === 'Finalizados' || key === 'Total' || key === 'Assumidos' || key === 'Transferidos') out[key] = parseInt(normalizeNumber(val)) || 0;
      else if (key === 'Objetivo') out[key] = val;
      else if (key === 'SCORE') {
        // Score sempre é decimal (0-5). Não tratar ponto como separador de milhar.
        let raw = (val == null) ? '' : String(val).replace(/\u00A0/g, '').trim();
        raw = raw.replace(',', '.').replace(/[^0-9.\-]/g, '');
        const n = parseFloat(raw);
        out[key] = Number.isFinite(n) ? n : null;
      }
      else if (key === 'Nota1' || key === 'Nota2' || key === 'Nota3') out[key] = parseInt(normalizeNumber(val)) || 0;
      else if (key === 'Mês') out[key] = parseDateKey(val);
      else out[key] = val;
    }
    return out;
  });
}

function isAggregateName(name) {
  if (!name) return false;
  // normalize and remove diacritics
  const s = String(name).normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  return /\b(media|media set|media setor|media seto|total)\b/.test(s);
}

function normalizeNumber(s) {
  if (s == null) return '';
  // remove spaces, non-breaking, remove thousands separators (dot or spaces), replace comma decimal -> dot
  let t = String(s).replace(/\u00A0/g, '').replace(/ /g, '');
  // if contains both dot and comma, assume dot thousands, comma decimal
  if (t.indexOf('.') !== -1 && t.indexOf(',') !== -1) {
    t = t.replace(/\./g, '').replace(/,/g, '.');
  } else {
    // remove dots that are likely thousands
    t = t.replace(/\./g, '');
    t = t.replace(/,/g, '.');
  }
  // strip non numeric except dot and minus
  t = t.replace(/[^0-9.\-]/g, '');
  return t;
}

function parseDateKey(raw) {
  if (!raw) return '';
  // Expect formats like 01/02/2025 or 2025-02
  const m = raw.match(/(\d{2})[\/\-](\d{2})[\/\-](\d{4})/);
  if (m) return `${m[3]}-${m[2]}`; // YYYY-MM
  const m2 = raw.match(/(\d{4})-(\d{2})/);
  if (m2) return `${m2[1]}-${m2[2]}`;
  return raw;
}

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

function applyMeetingMode() {
  document.body.classList.toggle('meeting-mode', !!meetingMode);
  if (presentationModeToggle) {
    presentationModeToggle.classList.toggle('is-locked', !!meetingMode);
    presentationModeToggle.title = meetingMode
      ? 'No modo reunião os nomes ficam ocultos automaticamente.'
      : 'Oculta nomes na tela para apresentação aos colaboradores';
    const input = presentationModeToggle.querySelector('input');
    if (input) input.disabled = !!meetingMode;
  }
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
  if (viewSelect) viewSelect.value = 'attendee';
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

  // Auto-detecção da visão do gráfico:
  //   colaborador único → evolução mensal (timeline)
  //   setor ou múltiplos → ranking por colaborador (attendee)
  // Salva a escolha manual do usuário para restaurar quando limpar o filtro de colaborador
  const singleColab = atendenteSelect && atendenteSelect.value !== 'all';
  const lastViewKey = 'sistema_last_chart_view';
  if (viewSelect) {
    if (singleColab) {
      if (viewSelect.value !== 'timeline') {
        try { localStorage.setItem(lastViewKey, viewSelect.value); } catch (e) {}
        viewSelect.value = 'timeline';
      }
    } else {
      const saved = localStorage.getItem(lastViewKey);
      if (saved && ['attendee','timeline','detailed'].includes(saved)) viewSelect.value = saved;
    }
  }
  const _vw = viewSelect ? viewSelect.value : 'attendee';
  if (_vw === 'timeline') renderTimelineChart(chartRows);
  else if (_vw === 'detailed') renderDetailedByMonthChart(chartRows);
  else renderChart(chartRows);
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
  // Texto de busca (para filtros e comparação mês anterior)
  const qTxt = (searchAtendenteInput?.value || '').trim();
  const qLower = qTxt.toLowerCase();


  // KPIs
  const total = (key) => rows.reduce((s, r) => s + (parseInt(r[key]) || 0), 0);
  const totalAssumidos = total('Assumidos');
  const totalTransferidos = total('Transferidos');
  const totalFinalizados = total('Finalizados');

  const scores = rows.map(r => r['SCORE']).filter(v => v !== null && v !== undefined && !Number.isNaN(Number(v)));
  const avgScoreNum = scores.length ? (scores.reduce((a,b)=>a+Number(b),0) / scores.length) : null;

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
      const prevScores = prevRows.map(r => r['SCORE']).filter(v => v !== null && v !== undefined && !Number.isNaN(Number(v)));
      const prevAvgScore = prevScores.length ? (prevScores.reduce((a,b)=>a+Number(b),0)/prevScores.length) : null;

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
  if (mesSel.length) scopeParts.push(`Período: ${escapeHtml(getMonthScopeLabel())}`);
  if (presentationMode) scopeParts.push('Modo apresentação');
  if (meetingMode) scopeParts.push('Modo reunião');
  if (atendenteSel !== 'all') scopeParts.push(`Atendente: ${escapeHtml(atendenteSel)}`);
  const q = qTxt;
  if (qLower) scopeParts.push(`Busca: ${escapeHtml(q)}`);

  const mesesNoEscopo = Array.from(new Set(rows.map(r=>String(r['Mês']||'')).filter(Boolean))).sort();
  const periodoTxt = mesesNoEscopo.length===0 ? '—' : (mesesNoEscopo.length===1 ? mesesNoEscopo[0] : `${mesesNoEscopo[0]} → ${mesesNoEscopo[mesesNoEscopo.length-1]}`);
  const atendentesNoEscopo = Array.from(new Set(rows.map(r=>String(r['Atendente']||'')).filter(Boolean))).length;
  container.innerHTML = `
    <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:flex-end">
      <div>
        <div style="font-size:12px;color:var(--muted)">Resumo do escopo</div>
        <div style="font-weight:600">${scopeParts.length ? scopeParts.join(' · ') : 'Todos os dados importados'}</div>
        <div style="margin-top:6px;color:var(--muted);font-size:13px">Período: <strong>${escapeHtml(periodoTxt)}</strong> · Atendentes: <strong>${escapeHtml(String(atendentesNoEscopo))}</strong></div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <span class="badge">${(viewSelect && viewSelect.value === 'timeline') ? 'Visão: Evolução mensal' : ((viewSelect && viewSelect.value === 'detailed') ? 'Visão: Detalhada por mês' : 'Visão: Por atendente (agrupado)')}</span>
        ${alerts.length ? `<span class="badge" style="background:#fff7ed;border-color:#fed7aa;color:#9a3412">⚠️ ${escapeHtml(alerts.join(' · '))}</span>` : `<span class="badge" style="background:#ecfeff;border-color:#a5f3fc;color:#155e75">OK</span>`}${presentationMode ? `<span class="badge presentation-note">Nomes ocultos na exibição</span>` : ''}${meetingMode ? `<span class="badge meeting-note">Foco em reunião</span>` : ''}
      </div>
    </div>

    <div class="kpi-grid" style="margin-top:12px">
      <div class="kpi"><div class="label">Assumidos</div><div class="value">${fmtInt(totalAssumidos)}</div><div class="sub">${deltaAssumidos===null?'':`Δ mês ant.: ${fmtPct(deltaAssumidos)}`}</div></div>
      <div class="kpi"><div class="label">Finalizados</div><div class="value">${fmtInt(totalFinalizados)}</div><div class="sub">${deltaFinalizados===null?'':`Δ mês ant.: ${fmtPct(deltaFinalizados)}`}</div></div>
      <div class="kpi"><div class="label">Transferidos</div><div class="value">${fmtInt(totalTransferidos)}</div><div class="sub">${taxaTransfer===null?'':`Taxa: ${(taxaTransfer*100).toFixed(1)}%`}</div></div>
      <div class="kpi"><div class="label">Score médio</div><div class="value${avgScoreNum!==null ? ' ' + getClasseScore(avgScoreNum) : ''}">${fmtScore(avgScoreNum)}</div><div class="sub">${deltaScore===null?'':`Δ mês ant.: ${deltaScore>=0?'+':''}${deltaScore.toFixed(2)}`}</div></div>
      <div class="kpi"><div class="label">Produtividade</div><div class="value">${produtividade===null?'—':(produtividade*100).toFixed(1)+'%'}</div><div class="sub">Finalizados / Assumidos</div></div>
      <div class="kpi"><div class="label">Registros</div><div class="value">${fmtInt(rows.length)}</div><div class="sub">linhas no escopo</div></div>
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

    ${meetingMode ? `<div class="meeting-banner"><div><strong>Modo reunião ativo</strong><span>Exibição limpa para apresentar os resultados do setor sem expor nomes.</span></div></div>` : ''}

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
  updateReportBar(toRender);
}

function updateReportBar(rows) {
  const bar = document.getElementById('previewReportBar');
  const sel = document.getElementById('reportColabSelect');
  if (!bar || !sel) return;
  const colabs = [...new Set((rows || []).filter(r => r && r['Atendente'] && !isAggregateName(r['Atendente']) && isColabActive(r['Atendente'])).map(r => r['Atendente']))].sort();
  if (colabs.length < 1) { bar.style.display = 'none'; return; }
  const current = sel.value;
  sel.innerHTML = '<option value="">Selecione um colaborador...</option>' + colabs.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
  if (current && colabs.includes(current)) sel.value = current;
  bar.style.display = 'flex';
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
  keys = keys.filter(k => !['foto', 'id', 'user_id', 'created_at'].includes(k.toLowerCase()));
  // Build headers with extra columns
  let headerHtml = '';
  keys.forEach(k => {
    headerHtml += `<th>${escapeHtml(k)}</th>`;
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
    if (classeScore === 'score-critico') { statusClass = 'status-bad'; statusText = 'Crítico'; }
    else if (classeScore === 'score-atencao') { statusClass = 'status-warn'; statusText = 'Atenção'; }

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
        rowHtml += `<td contenteditable="${isAdmin()}" data-idx="${ridx}" data-key="${escapeHtml(k)}" class="cell-edit ${isFer ? 'cell-ferias' : ''}">${escapeHtml(shown)}</td>`;
        return;
      }
      rowHtml += `<td contenteditable="${isAdmin() && !(k === 'Atendente' && presentationMode)}" data-idx="${ridx}" data-key="${escapeHtml(k)}" class="cell-edit">${escapeHtml(shown)}</td>`;
    });
    html.push('<tr>' + rowHtml + `<td style="white-space:nowrap"><span class="status-badge ${statusClass}">${escapeHtml(statusText)}</span> <button class="btn-small btn-report-row" data-idx="${ridx}" title="Relatório de desempenho" aria-label="Relatório">📊</button> <button class="btn-small btn-delete" data-idx="${ridx}" title="Remover" aria-label="Remover">🗑️</button></td>` + '</tr>');
  });
  html.push('</tbody></table></div>');
  previewTable.innerHTML = html.join('');

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

  previewTable.querySelectorAll('.btn-report-row').forEach(b => {
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = Number(e.target.getAttribute('data-idx'));
      if (isNaN(idx)) return;
      const row = previewRows[idx];
      if (!row) return;
      const nome = String(row['Atendente'] || '').trim();
      if (nome && typeof openColabReport === 'function') openColabReport(nome);
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
    const bgFin = labels.map((_,i) => `rgba(16,185,129,0.85)`);
    const bgAss = labels.map((_,i) => `rgba(37,99,235,0.85)`);
    const cfg = {
      type: 'bar',
      data: {
        labels: displayLabels,
        datasets: [
          { label: 'Assumidos', data: assData, backgroundColor: bgAss, borderRadius: 3, yAxisID: 'y' },
          { label: 'Finalizados', data: finData, backgroundColor: bgFin, borderRadius: 3, yAxisID: 'y' },
          { label: 'Score', type: 'line', data: scData, borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.15)', pointBackgroundColor: '#f59e0b', pointRadius: 4, pointHoverRadius: 6, tension: 0.3, fill: true, yAxisID: 'y1' }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { top: 32, right: 12, bottom: 4, left: 4 } },
        plugins: {
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
          y: { beginAtZero: true, position: 'left', grid: { color: 'rgba(148,163,184,0.14)' }, ticks: { font: { size: 11.5 } } },
          y1: { beginAtZero: true, position: 'right', grid: { drawOnChartArea: false }, min: 0, max: 5, ticks: { font: { size: 11.5 }, callback: v => Number(v).toFixed(2) } },
          x: { grid: { display: false }, ticks: { font: { size: 11.5 } } }
        }
      }
    };
    replaceChart(cfg);
  }
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
  const rawMetric = metricSelect.value;
  const metric = rawMetric === 'Desempenho' ? 'Finalizados' : rawMetric;

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

  const scores = rows.map(r => r['SCORE']).filter(v => v !== null && v !== undefined && !Number.isNaN(Number(v)));
  const avgScore = scores.length ? (scores.reduce((a,b)=>a+Number(b),0)/scores.length) : null;

  const produtividade = totalAss > 0 ? (totalFin / totalAss) : null;
  const taxaTrans = totalAss > 0 ? (totalTrans / totalAss) : null;

  const scope = [];
  if (arquivoVal !== 'all') scope.push(`Arquivo: ${arquivoVal}`);
  if (setorVal !== 'all') scope.push(`Setor: ${setorVal}`);
  if (mesVal.length) scope.push(`Período: ${getMonthScopeLabel()}`);
  if (presentationMode) scope.push('Modo apresentação ativo');
  if (meetingMode) scope.push('Modo reunião ativo');
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


function clearReportTextOnly() {
  const ok = confirm('Apagar apenas o texto do relatório gerado?');
  if (!ok) return;
  const ta = document.getElementById('reportText');
  if (ta) ta.value = '';
  window.__lastReportText = '';
  // Mantém o painel e os dados; apenas remove o texto salvo do relatório
  saveState();
}
function generateAndShowReport() {
  // Gera o relatório e garante feedback visual (sem depender do botão "Atualizar")
  try {
    setLoading(true, 'Gerando relatório…');
    const card = document.getElementById('summaryCard');
    const ta = document.getElementById('reportText');

    const text = buildReportText();
    window.__lastReportText = text;

    if (card) card.style.display = 'block';
    if (ta) {
      ta.value = text;
      ta.focus({ preventScroll: true });
    }

    // rola até a seção do relatório para ficar óbvio que gerou
    const target = document.getElementById('summaryCard') || document.getElementById('summarySection') || ta;
    if (target && target.scrollIntoView) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    showToast('Relatório gerado com sucesso.', 'success', 'Relatório');
    saveState();
  } catch (e) {
    console.error('generateAndShowReport failed', e);
    showToast('Erro ao gerar relatório. Veja o Console (F12).', 'error', 'Relatório');
  } finally {
    setLoading(false);
  }
}

async function copyReportToClipboard() {
  const ta = document.getElementById('reportText');
  const text = ta ? ta.value : (window.__lastReportText || '');
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
  } catch (e) {
    // fallback
    const temp = document.createElement('textarea');
    temp.value = text;
    document.body.appendChild(temp);
    temp.select();
    document.execCommand('copy');
    temp.remove();
  }
}
function exportReportToPDF() {
  const ta = document.getElementById('reportText');
  const text = (ta && ta.value) ? ta.value.trim() : '';
  if (!text) {
    showToast('Nada para exportar. Gere o relatório primeiro.', 'warn');
    return;
  }
  const html = buildReportHTML(text);
  const w = window.open('', '_blank');
  if (!w) {
    showToast('Não consegui abrir a janela de impressão. Verifique bloqueador de pop-ups.', 'error');
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
  showToast('Abrindo exportação para PDF…', 'ok');
}

async function exportPDFcomGrafico() {
  setLoading(true, 'Gerando PDF…');
  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageW = 190;
    let y = 15;

    // Título
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Relatório Executivo - Dashboard de Suporte', pageW / 2, y, { align: 'center' });
    y += 10;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, pageW / 2, y, { align: 'center' });
    y += 12;

    // Captura o texto do relatório
    const ta = document.getElementById('reportText');
    const text = (ta && ta.value) ? ta.value.trim() : '';
    if (text) {
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('Indicadores', pageW / 2, y, { align: 'center' });
      y += 7;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      const lines = doc.splitTextToSize(text, pageW);
      for (const line of lines) {
        if (y > 275) { doc.addPage(); y = 15; }
        doc.text(line, 10, y);
        y += 5;
      }
      y += 8;
    }

    // Captura o gráfico
    const canvas = document.getElementById('mainChart');
    const chartCard = document.getElementById('chartCard');
    if (canvas && chartCard && chartCard.style.display !== 'none') {
      if (y > 240) { doc.addPage(); y = 15; }
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Gráfico de Desempenho', pageW / 2, y, { align: 'center' });
      y += 5;
      const chartImg = canvas.toDataURL('image/png');
      const imgW = 180;
      const imgH = (canvas.height / canvas.width) * imgW;
      doc.addImage(chartImg, 'PNG', 10, y, imgW, Math.min(imgH, 120));
      y += Math.min(imgH, 120) + 10;
    }

    // Captura os cards de resumo (KPIs)
    const summaryCard = document.getElementById('summaryCard');
    if (summaryCard && summaryCard.style.display !== 'none') {
      if (y > 250) { doc.addPage(); y = 15; }
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Resumo', pageW / 2, y, { align: 'center' });
      y += 5;
      try {
        const summaryCanvas = await html2canvas(summaryCard, { scale: 2, useCORS: true });
        const imgData = summaryCanvas.toDataURL('image/png');
        const imgW2 = 180;
        const imgH2 = (summaryCanvas.height / summaryCanvas.width) * imgW2;
        doc.addImage(imgData, 'PNG', 10, y, imgW2, Math.min(imgH2, 80));
        y += Math.min(imgH2, 80) + 5;
      } catch (e) {}
    }

    // Abre em nova aba para preview (não baixa automaticamente)
    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    showToast('PDF aberto em nova aba. Use o botão de download do visualizador.', 'success', 'PDF');
  } catch (e) {
    console.error('Erro ao gerar PDF:', e);
    showToast('Erro ao gerar PDF: ' + e.message, 'error');
  } finally {
    setLoading(false);
  }
}

function escapeHtml(str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
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
      const display = document.getElementById('currentUserDisplay');
      if (display) {
        display.textContent = user.email;
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
    try { updateView(); } catch (e) { console.error('[App] updateView error:', e); }
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

if (homeBtn) homeBtn.addEventListener('click', () => {
  goToHomeMenu();
});

// Se já existir estado em memória (restaurado acima), mantém oculto até o usuário entrar
if (!rawRecords || !rawRecords.length) {
  showHomeScreen();
}

  if (restoreSavedBtn) restoreSavedBtn.addEventListener('click', async () => {
    if (rawRecords && rawRecords.length > 0) {
      showToast('Dados já carregados.', 'success', 'Supabase');
      return;
    }
    const supabaseRecords = await dbLoadRecords();
    if (supabaseRecords && supabaseRecords.length > 0) {
      rawRecords = normalizeAtendenteOnRecords(supabaseRecords);
      if (typeof invalidateGamificationCache === 'function') invalidateGamificationCache();
      setGlobalEmpty(false);
      populateFilters(rawRecords);
      updateFilterOptions();
      try { updateView(); } catch (e) {}
      showToast(`${rawRecords.length} registros carregados do banco.`, 'success', 'Supabase');
    } else {
      const st = loadSavedState();
      if (st) applySavedState(st);
    }
  });

  if (clearSavedBtn) clearSavedBtn.addEventListener('click', () => {
    if (!requireAdmin()) return;
    if (confirm('Remover os dados salvos deste app no navegador?')) {
      clearSavedState();
    }
  });

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
  document.getElementById('gerarRelatorioBtn')?.addEventListener('click', () => {
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

  // ===== Global Search =====
  const globalSearchInput = document.getElementById('globalSearchInput');
  const globalSearchResults = document.getElementById('globalSearchResults');
  let searchTimeout = null;

  if (globalSearchInput && globalSearchResults) {
    globalSearchInput.addEventListener('input', () => {
      clearTimeout(searchTimeout);
      const q = globalSearchInput.value.trim().toLowerCase();
      if (q.length < 2) { globalSearchResults.classList.remove('open'); return; }

      searchTimeout = setTimeout(() => {
        const names = [...new Set((rawRecords || []).filter(r => r && r['Atendente']).map(r => r['Atendente']))];
        const matches = names.filter(n => String(n).toLowerCase().includes(q)).slice(0, 10);
        if (!matches.length) { globalSearchResults.classList.remove('open'); return; }

        globalSearchResults.innerHTML = matches.map(name => {
          const score = typeof computeScoreForCollaborator === 'function' ? computeScoreForCollaborator(name, rawRecords) : null;
          const pts = score ? score.total.toFixed(1) : '';
          return `<div class="global-search-result-item" data-name="${escapeHtml(name)}">
            <span style="font-weight:600;color:var(--accent);font-size:14px">${escapeHtml(name.charAt(0).toUpperCase())}</span>
            <div>
              <div class="global-search-result-name">${escapeHtml(name)}</div>
              ${pts ? `<div class="global-search-result-meta">${pts} pts</div>` : ''}
            </div>
          </div>`;
        }).join('');

        globalSearchResults.classList.add('open');

        globalSearchResults.querySelectorAll('.global-search-result-item').forEach(item => {
          item.addEventListener('click', () => {
            const name = item.getAttribute('data-name');
            globalSearchInput.value = '';
            globalSearchResults.classList.remove('open');
            if (typeof openColabDetail === 'function') openColabDetail(name);
          });
        });
      }, 250);
    });

    globalSearchInput.addEventListener('blur', () => {
      setTimeout(() => globalSearchResults.classList.remove('open'), 200);
    });

    globalSearchInput.addEventListener('focus', () => {
      if (globalSearchResults.querySelector('.global-search-result-item')) {
        globalSearchResults.classList.add('open');
      }
    });
  }

  // ===== Favorites System =====
  window.__favoriteColabs = new Set();
  try {
    const saved = localStorage.getItem('sistema_favorites_v1');
    if (saved) {
      JSON.parse(saved).forEach(name => window.__favoriteColabs.add(name));
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

  // ===== Extend persistence save on updateView =====
  const _originalRenderSummary = renderSummary;
  renderSummary = function(filtered) {
    _originalRenderSummary(filtered);
    // Save favorites + active tab with state
    try { localStorage.setItem('sistema_favorites_v1', JSON.stringify(Array.from(window.__favoriteColabs || []))); } catch(e) {}
  };

  // ===== Highlight rows in preview based on performance =====
  const _originalRenderPreviewDisplay = renderPreviewDisplay;
  renderPreviewDisplay = function(rows) {
    _originalRenderPreviewDisplay(rows);
    // Add highlight classes based on performance
    if (!rows || !rows.length) return;
    const table = document.querySelector('#previewTable table');
    if (!table) return;
    const tbody = table.querySelector('tbody');
    if (!tbody) return;
    const trs = tbody.querySelectorAll('tr');
    trs.forEach((tr, idx) => {
      const row = rows[idx];
      if (!row) return;
      const sc = row['SCORE'];
      const fin = parseInt(row['Finalizados']) || 0;
      const name = String(row['Atendente'] || '');
      if (window.__favoriteColabs && window.__favoriteColabs.has(name)) {
        tr.classList.add('highlight-row');
      }
      if (sc !== null && sc !== undefined && !isNaN(Number(sc))) {
        const cls = getClasseScore(Number(sc));
        if (cls === 'score-excelente') tr.classList.add('highlight-row');
        else if (cls === 'score-critico') tr.classList.add('attention-row');
      }
    });
  };
  // ===== Resize handler for scrollbar sync =====
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { if (typeof syncScrollbar === 'function') syncScrollbar(); }, 150);
  });
});

// ===== Global Favorites Toggle =====
function toggleFavorite(name) {
  if (!window.__favoriteColabs) window.__favoriteColabs = new Set();
  if (window.__favoriteColabs.has(name)) {
    window.__favoriteColabs.delete(name);
  } else {
    window.__favoriteColabs.add(name);
  }
  try { localStorage.setItem('sistema_favorites_v1', JSON.stringify(Array.from(window.__favoriteColabs))); } catch(e) {}
  // Refresh views
  if (typeof updateView === 'function') updateView();
  if (typeof renderGamification === 'function') renderGamification();
}

// ===== Intel Report Generator =====
function generateIntelReport() {
  try {
    const rows = getCurrentFilteredRows();
    if (!rows.length) {
      showToast('Sem dados no escopo atual para gerar análise.', 'warn', 'Relatório Inteligente');
      return;
    }

    const totalAss = rows.reduce((s, r) => s + (parseInt(r['Assumidos']) || 0), 0);
    const totalFin = rows.reduce((s, r) => s + (parseInt(r['Finalizados']) || 0), 0);
    const totalTrans = rows.reduce((s, r) => s + (parseInt(r['Transferidos']) || 0), 0);
    const scores = rows.map(r => r['SCORE']).filter(v => v !== null && v !== undefined && !isNaN(Number(v)));
    const avgScore = scores.length ? scores.reduce((a, b) => a + Number(b), 0) / scores.length : 0;
    const prod = totalAss > 0 ? (totalFin / totalAss) : 0;
    const taxaTrans = totalAss > 0 ? (totalTrans / totalAss) : 0;

    // By collaborator
    const byColab = {};
    rows.forEach(r => {
      const a = String(r['Atendente'] || '').trim();
      if (!a) return;
      if (!byColab[a]) byColab[a] = { assumidos: 0, finalizados: 0, transferidos: 0, scores: [] };
      byColab[a].assumidos += parseInt(r['Assumidos']) || 0;
      byColab[a].finalizados += parseInt(r['Finalizados']) || 0;
      byColab[a].transferidos += parseInt(r['Transferidos']) || 0;
      const sc = r['SCORE'];
      if (sc !== null && sc !== undefined && !isNaN(Number(sc))) byColab[a].scores.push(Number(sc));
    });

    const entries = Object.entries(byColab).map(([name, v]) => ({
      name,
      ...v,
      avgScore: v.scores.length ? v.scores.reduce((a, b) => a + b, 0) / v.scores.length : 0
    }));

    const sortedByFin = [...entries].sort((a, b) => b.finalizados - a.finalizados);
    const sortedByScore = [...entries].filter(e => e.avgScore > 0).sort((a, b) => b.avgScore - a.avgScore);

    const leader = sortedByFin[0];
    const bestScore = sortedByScore[0];
    const worstScore = [...sortedByScore].reverse()[0];

    // Calculate growth vs previous period
    const meses = [...new Set(rows.map(r => r['Mês']))].sort();
    let growthText = '';
    if (meses.length >= 2) {
      const currentMes = meses[meses.length - 1];
      const prevMes = meses[meses.length - 2];
      const currentRows = rows.filter(r => String(r['Mês']) === currentMes);
      const prevRows = rows.filter(r => String(r['Mês']) === prevMes);
      const currFin = currentRows.reduce((s, r) => s + (parseInt(r['Finalizados']) || 0), 0);
      const prevFin = prevRows.reduce((s, r) => s + (parseInt(r['Finalizados']) || 0), 0);
      if (prevFin > 0) {
        const growth = ((currFin - prevFin) / prevFin) * 100;
        growthText = `A equipe apresentou ${growth >= 0 ? 'crescimento' : 'queda'} de ${Math.abs(growth).toFixed(1)}% em relação ao período anterior.`;
      }
    }

    // Build report
    const lines = [];
    lines.push(`📊 Análise Inteligente do Período`);
    lines.push('');
    if (leader) {
      lines.push(`🏆 Destaque: ${leader.name} liderou com ${leader.finalizados} finalizações ${leader.avgScore > 0 ? `e score médio de ${leader.avgScore.toFixed(2)}` : ''}.`);
    }
    if (growthText) lines.push(growthText);
    lines.push('');
    lines.push(`📈 Resumo: ${totalFin} finalizações, ${totalAss} assumidos, ${totalTrans} transferidos. Score médio: ${avgScore.toFixed(2)}. Produtividade: ${(prod * 100).toFixed(1)}%.`);
    if (avgScore < 4.0) lines.push(`⚠️ Score médio baixo (${avgScore.toFixed(2)}) — abaixo do ideal de 4.5.`);
    if (taxaTrans > 0.25) lines.push(`⚠️ Taxa de transferências elevada (${(taxaTrans * 100).toFixed(1)}%) — acima de 25%.`);
    if (prod < 0.7) lines.push(`⚠️ Produtividade baixa (${(prod * 100).toFixed(1)}%) — abaixo de 70%.`);

    // Strengths
    lines.push('');
    lines.push('✅ Pontos Fortes');
    if (bestScore && bestScore.avgScore >= 4.5) {
      lines.push(`  • Score de qualidade: ${bestScore.name} com média ${bestScore.avgScore.toFixed(2)}`);
    }
    if (prod >= 0.8) lines.push(`  • Produtividade elevada (${(prod * 100).toFixed(1)}%)`);
    const top3 = sortedByFin.slice(0, 3);
    if (top3.length) {
      lines.push(`  • Top finalizações: ${top3.map((e, i) => `${i+1}º ${e.name} (${e.finalizados})`).join(', ')}`);
    }

    // Opportunities
    lines.push('');
    lines.push('🔶 Oportunidades de Melhoria');
    if (worstScore && worstScore.avgScore < 4.0) {
      lines.push(`  • Score mais baixo: ${worstScore.name} (${worstScore.avgScore.toFixed(2)})`);
    }
    if (taxaTrans > 0.2) lines.push(`  • Reduzir taxa de transferências (${(taxaTrans * 100).toFixed(1)}%)`);
    const lowProd = entries.filter(e => e.assumidos > 0 && (e.finalizados / e.assumidos) < 0.6);
    if (lowProd.length) {
      lines.push(`  • Produtividade abaixo de 60%: ${lowProd.map(e => e.name).join(', ')}`);
    }

    // Alerts
    lines.push('');
    lines.push('🚨 Alertas');
    const alerts = [];
    if (avgScore < 3.5) alerts.push('Score crítico — abaixo de 3.5');
    if (taxaTrans > 0.35) alerts.push('Transferências muito elevadas');
    if (prod < 0.5) alerts.push('Produtividade crítica');
    if (entries.some(e => e.scores.length > 0 && e.avgScore < 3.0)) {
      const lowScorers = entries.filter(e => e.scores.length > 0 && e.avgScore < 3.0);
      alerts.push(`${lowScorers.length} colaborador(es) com score abaixo de 3.0`);
    }
    if (!alerts.length) alerts.push('Nenhum alerta crítico identificado.');
    alerts.forEach(a => lines.push(`  • ${a}`));

    // Recommendations
    lines.push('');
    lines.push('💡 Recomendações');
    if (avgScore < 4.0) lines.push('  • Implementar programa de capacitação em qualidade');
    if (taxaTrans > 0.2) lines.push('  • Revisar processo de triagem para reduzir transferências');
    if (prod < 0.75) lines.push('  • Otimizar roteamento de chamados para aumentar produtividade');
    if (entries.some(e => e.scores.length > 0 && e.avgScore >= 4.8)) {
      const topQual = entries.filter(e => e.scores.length > 0 && e.avgScore >= 4.8);
      lines.push(`  • Reconhecer e replicar práticas de ${topQual[0].name} como referência de qualidade`);
    }
    lines.push('  • Acompanhar evolução semanal dos indicadores para ação preventiva');

    const reportText = lines.join('\n');

    // Display the report
    const container = document.getElementById('intelReportContainer');
    if (container) {
      container.style.display = 'block';
      container.innerHTML = `
        <div class="intel-report-header">
          <h3>🤖 Relatório Inteligente</h3>
          <div style="display:flex;gap:8px">
            <button class="btn-small" id="copyIntelReportBtn" type="button">📋 Copiar</button>
            <button class="btn-small" id="closeIntelReportBtn" type="button">✕</button>
          </div>
        </div>
        <div class="intel-report-content">${escapeHtml(reportText)}</div>
      `;

      const copyBtn = document.getElementById('copyIntelReportBtn');
      if (copyBtn) {
        copyBtn.addEventListener('click', () => {
          navigator.clipboard.writeText(reportText).catch(() => {});
          showToast('Relatório copiado!', 'success');
        });
      }

      const closeBtn = document.getElementById('closeIntelReportBtn');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => {
          container.style.display = 'none';
        });
      }
    }

    showToast('Relatório inteligente gerado!', 'success', '🤖 IA');
  } catch (err) {
    console.error(err);
    showToast('Erro ao gerar relatório inteligente.', 'error');
  }
}

function exportChartAsPNG() {
  try {
    const canvas = document.getElementById('mainChart');
    if (!canvas || !chart) { showToast ? showToast('Nenhum gráfico para exportar.', 'warn') : alert('Nenhum gráfico para exportar.'); return; }
    // Compose a new canvas with solid background so PNG is legible in light/dark
    const isDark = document.documentElement.classList.contains('dark') || document.body.classList.contains('dark') || (document.documentElement.getAttribute('data-theme') === 'dark');
    const bg = isDark ? '#0f172a' : '#ffffff';
    const w = canvas.width, h = canvas.height;
    const out = document.createElement('canvas');
    out.width = w; out.height = h;
    const octx = out.getContext('2d');
    octx.fillStyle = bg;
    octx.fillRect(0, 0, w, h);
    octx.drawImage(canvas, 0, 0);
    const url = out.toDataURL('image/png');
    const a = document.createElement('a');
    const ts = new Date().toISOString().replace(/[:.]/g,'-').slice(0,19);
    a.href = url;
    a.download = `grafico-resultados-${ts}.png`;
    document.body.appendChild(a); a.click(); a.remove();
  } catch (err) {
    console.error(err);
    alert('Não foi possível exportar o gráfico em PNG.');
  }
}

async function addRow() {
  const newRec = { Setor: '', 'Mês': '', Atendente: '', Assumidos: 0, Transferidos: 0, Finalizados: 0, SCORE: null, Nota1: 0, Nota2: 0, Nota3: 0, Total: 0, Objetivo: 0 };
  // Tenta salvar no Supabase
  if (sbClient) {
    const inserted = await dbInsertRow(newRec);
    if (inserted && inserted.id) {
      newRec.id = inserted.id;
    }
  }
  rawRecords.push(newRec);
  if (typeof invalidateGamificationCache === 'function') invalidateGamificationCache();
  // refresh filters and charts
  populateFilters(rawRecords);
  updateFilterOptions();
  // update chart/summary using current filters (so totals include the new row)
  const filtered = rawRecords.filter(r => {
    if (!r) return false;
    if (setorSelect.value !== 'all' && String(r['Setor']) !== setorSelect.value) return false;
    if (!monthMatches(r['Mês'])) return false;
    if (arquivoSelect && arquivoSelect.value !== 'all' && String(r['Arquivo']) !== arquivoSelect.value) return false;
    return true;
  });
  renderChart(filtered);
  renderSummary(filtered);
  // show the new record in preview as an editable single-row view and focus first cell
  renderPreviewDisplay([newRec]);
  saveState();
  // focus the first editable cell of the newly rendered preview
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

function exportCsv() {
  if (!rawRecords || rawRecords.length === 0) {
    alert('Sem dados para exportar');
    return;
  }
  // derive headers from first record (preserve order of common columns)
  const preferred = ['Setor','Mês','Atendente','Assumidos','Transferidos','Finalizados','SCORE','Nota1','Nota2','Nota3','Total','Objetivo'];
  const keys = Array.from(new Set([...(rawRecords[0] ? Object.keys(rawRecords[0]) : []), ...preferred]));
  // ensure preferred order
  const orderedKeys = preferred.concat(keys.filter(k => !preferred.includes(k)));
  const rows = [orderedKeys.join(',')];
  rawRecords.forEach(r => {
    const vals = orderedKeys.map(k => {
      let v = r[k];
      if (v === null || v === undefined) return '';
      // format SCORE with dot
      if (k === 'SCORE') return String(typeof v === 'number' ? v.toFixed(2) : v).replace(/,/g, '.');
      // integers
      if (k === 'Assumidos' || k === 'Transferidos' || k === 'Finalizados') return String(Math.round(Number(v) || 0));
      const s = String(v);
      // escape if needed
      if (s.includes(',') || s.includes('\n') || s.includes('"')) return '"' + s.replace(/"/g, '""') + '"';
      return s;
    });
    rows.push(vals.join(','));
  });
  const csv = rows.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'export.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* ===== Theme toggle (light/dark) ===== */
(function(){
  function getTheme(){
    return document.documentElement.getAttribute('data-theme') || 'light';
  }
  function setTheme(t){
    document.documentElement.setAttribute('data-theme', t);
    try { localStorage.setItem('theme', t); } catch(e){}
    updateButtons(t);
    updateChartTheme();
  }
  function updateButtons(t){
    var dark = t === 'dark';
    document.querySelectorAll('.theme-toggle').forEach(function(btn){
      var icon = btn.querySelector('.theme-icon');
      var label = btn.querySelector('.theme-label');
      if (icon) icon.textContent = dark ? '☀️' : '🌙';
      if (label) label.textContent = dark ? 'Modo claro' : 'Modo escuro';
      btn.setAttribute('aria-pressed', dark ? 'true' : 'false');
    });
  }
  function updateChartTheme(){
    if (typeof Chart === 'undefined') return;
    var dark = getTheme() === 'dark';
    Chart.defaults.color = dark ? '#cbd5e1' : '#64748b';
    Chart.defaults.borderColor = dark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.08)';
    // Re-render any existing chart instance the app uses
    try {
      if (window.Chart && Chart.instances) {
        Object.values(Chart.instances).forEach(function(c){ try { c.update(); } catch(e){} });
      }
    } catch(e){}
  }
  function init(){
    updateButtons(getTheme());
    updateChartTheme();
    document.querySelectorAll('.theme-toggle').forEach(function(btn){
      btn.addEventListener('click', function(){
        setTheme(getTheme() === 'dark' ? 'light' : 'dark');
      });
    });
  }
  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

// === Report HTML (modern, dark mode) ===
function buildReportHTML(text) {
  const title = 'Relatório Executivo';
  const now = new Date();
  const dateStr = now.toLocaleString('pt-BR', { hour12:false });
  const SEP_RE = /^[─-]{5,}\s*$/;
  const rawLines = String(text).split('\n');

  const headerLines = [];
  let i = 0;
  while (i < rawLines.length && !SEP_RE.test(rawLines[i])) { headerLines.push(rawLines[i]); i++; }

  const sections = [];
  while (i < rawLines.length) {
    if (SEP_RE.test(rawLines[i])) {
      const titleLine = (rawLines[i+1] || '').trim();
      let j = i + 2;
      if (SEP_RE.test(rawLines[j] || '')) j++;
      const body = [];
      while (j < rawLines.length && !SEP_RE.test(rawLines[j])) { body.push(rawLines[j]); j++; }
      while (body.length && body[0].trim() === '') body.shift();
      while (body.length && body[body.length-1].trim() === '') body.pop();
      sections.push({ title: titleLine, body });
      i = j;
    } else { i++; }
  }

  const dotPair = (line) => {
    const m = line.match(/^\s*(.+?)\s+\.[ .]*\s+(.+?)\s*$/);
    return m ? { label: m[1].trim(), value: m[2].trim() } : null;
  };

  function renderSectionBody(body, kind) {
    if (kind === 'resumo') {
      const items = body.map(l => dotPair(l)).filter(Boolean);
      if (!items.length) return `<pre class="raw">${escapeHtml(body.join('\n'))}</pre>`;
      return `<div class="kpi-grid">${items.map(it => `
          <div class="kpi">
            <div class="kpi-label">${escapeHtml(it.label)}</div>
            <div class="kpi-value">${escapeHtml(it.value)}</div>
          </div>`).join('')}</div>`;
    }
    if (kind === 'setor') {
      const cards = [];
      let cur = null;
      body.forEach(l => {
        const m = l.match(/^\s*▸\s*(.+)$/);
        if (m) {
          if (cur) cards.push(cur);
          const parts = m[1].split('·').map(s => s.trim());
          cur = { name: parts[0] || '', meta: parts.slice(1).join(' · '), items: [] };
        } else if (cur) {
          const dp = dotPair(l);
          if (dp) cur.items.push(dp);
        }
      });
      if (cur) cards.push(cur);
      if (!cards.length) return `<pre class="raw">${escapeHtml(body.join('\n'))}</pre>`;
      return `<div class="setor-grid">${cards.map(c => `
          <div class="setor-card">
            <div class="setor-head">
              <div class="setor-name">${escapeHtml(c.name)}</div>
              ${c.meta ? `<div class="setor-meta">${escapeHtml(c.meta)}</div>` : ''}
            </div>
            <div class="setor-rows">
              ${c.items.map(it => `
                <div class="setor-row">
                  <span class="setor-row-label">${escapeHtml(it.label)}</span>
                  <span class="setor-row-value">${escapeHtml(it.value)}</span>
                </div>`).join('')}
            </div>
          </div>`).join('')}</div>`;
    }
    if (kind === 'destaques') {
      const items = body.map(l => l.trim()).filter(Boolean);
      return `<ul class="destaques">${items.map(t => {
        const isOk = t.includes('✅');
        const isWarn = t.includes('⚠');
        const cls = isOk ? 'ok' : (isWarn ? 'warn' : '');
        return `<li class="${cls}">${escapeHtml(t.replace(/^[✅⚠️\s]+/, ''))}</li>`;
      }).join('')}</ul>`;
    }
    if (kind === 'rank') {
      const rows = body.map(l => {
        const m = l.match(/^\s*(\d+)\.\s+(.+?)\s+—\s+(.+?)\s*(?:\((.+)\))?\s*$/);
        if (!m) return null;
        return { pos: m[1], name: m[2].trim(), value: m[3].trim(), extra: (m[4] || '').trim() };
      }).filter(Boolean);
      if (!rows.length) return `<pre class="raw">${escapeHtml(body.join('\n'))}</pre>`;
      return `<ol class="rank">${rows.map(r => `
          <li>
            <span class="rank-pos">${escapeHtml(r.pos)}</span>
            <div class="rank-main">
              <div class="rank-name">${escapeHtml(r.name)}</div>
              ${r.extra ? `<div class="rank-extra">${escapeHtml(r.extra)}</div>` : ''}
            </div>
            <span class="rank-value">${escapeHtml(r.value)}</span>
          </li>`).join('')}</ol>`;
    }
    return `<pre class="raw">${escapeHtml(body.join('\n'))}</pre>`;
  }

  function classify(t) {
    const u = (t || '').toUpperCase();
    if (u.includes('RESUMO')) return 'resumo';
    if (u.includes('SETOR')) return 'setor';
    if (u.includes('MENORES SCORES') || u.includes('TOP')) return 'rank';
    if (u.includes('DESTAQUES') || u.includes('ATENÇÃO') || u.includes('ATENÇÕES')) return 'destaques';
    return 'raw';
  }

  const escopoLine = headerLines.find(l => /^Escopo:/i.test(l)) || '';
  const escopo = escopoLine.replace(/^Escopo:\s*/i, '').trim();

  const sectionsHTML = sections.map(s => `
      <section class="card">
        <h2>${escapeHtml(s.title)}</h2>
        ${renderSectionBody(s.body, classify(s.title))}
      </section>`).join('');

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${title} — ${dateStr}</title>
<style>
  :root {
    color-scheme: light dark;
    --bg:#f6f7fb; --fg:#0f172a; --muted:#64748b;
    --card:#ffffff; --card-border:#e5e7eb;
    --accent:#4f46e5; --accent-soft:#eef2ff;
    --ok-bg:#ecfdf5; --ok-fg:#065f46; --ok-border:#a7f3d0;
    --warn-bg:#fff7ed; --warn-fg:#9a3412; --warn-border:#fed7aa;
    --shadow: 0 1px 2px rgba(15,23,42,.04), 0 4px 16px rgba(15,23,42,.06);
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg:#0b1020; --fg:#e6e9f2; --muted:#94a3b8;
      --card:#121a33; --card-border:#1f2a4a;
      --accent:#818cf8; --accent-soft:#1a2350;
      --ok-bg:#0f2a22; --ok-fg:#6ee7b7; --ok-border:#134e3a;
      --warn-bg:#2a1a0d; --warn-fg:#fdba74; --warn-border:#7c3a14;
      --shadow: 0 1px 2px rgba(0,0,0,.4), 0 8px 24px rgba(0,0,0,.35);
    }
  }
  html, body { background: var(--bg); color: var(--fg); }
  body { font-family: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, Arial, sans-serif; margin:0; padding:32px; -webkit-font-smoothing: antialiased; }
  .wrap { max-width:980px; margin:0 auto; }
  .topbar { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:24px; gap:16px; flex-wrap:wrap; }
  .brand { display:flex; align-items:center; gap:12px; }
  .brand .dot { width:10px; height:10px; border-radius:999px; background:var(--accent); box-shadow:0 0 0 4px var(--accent-soft); }
  .brand h1 { margin:0; font-size:22px; letter-spacing:-.01em; }
  .meta { font-size:12px; color:var(--muted); text-align:right; line-height:1.6; }
  .actions { display:flex; gap:8px; justify-content:flex-end; margin-top:8px; }
  .btn { appearance:none; border:1px solid var(--card-border); background:var(--card); color:var(--fg); padding:8px 14px; border-radius:10px; font-size:13px; cursor:pointer; box-shadow:var(--shadow); }
  .btn:hover { border-color:var(--accent); color:var(--accent); }
  .scope { display:inline-block; padding:6px 12px; border-radius:999px; background:var(--accent-soft); color:var(--accent); font-size:12px; font-weight:600; margin-bottom:24px; }
  .card { background:var(--card); border:1px solid var(--card-border); border-radius:16px; padding:22px 24px; margin-bottom:20px; box-shadow:var(--shadow); page-break-inside:avoid; break-inside:avoid; }
  .card h2 { margin:0 0 16px; font-size:13px; font-weight:700; text-transform:uppercase; letter-spacing:.08em; color:var(--muted); }
  .kpi-grid { display:grid; gap:14px; grid-template-columns:repeat(auto-fit, minmax(180px,1fr)); }
  .kpi { background:var(--bg); border:1px solid var(--card-border); border-radius:12px; padding:14px 16px; }
  .kpi-label { font-size:12px; color:var(--muted); margin-bottom:6px; }
  .kpi-value { font-size:22px; font-weight:700; letter-spacing:-.01em; font-variant-numeric:tabular-nums; }
  .setor-grid { display:grid; gap:16px; grid-template-columns:repeat(auto-fit, minmax(280px,1fr)); }
  .setor-card { border:1px solid var(--card-border); border-radius:14px; padding:16px 18px; background:var(--bg); }
  .setor-head { margin-bottom:12px; padding-bottom:10px; border-bottom:1px dashed var(--card-border); }
  .setor-name { font-size:15px; font-weight:700; }
  .setor-meta { font-size:12px; color:var(--muted); margin-top:2px; }
  .setor-rows { display:flex; flex-direction:column; gap:8px; }
  .setor-row { display:flex; justify-content:space-between; gap:12px; font-size:13px; }
  .setor-row-label { color:var(--muted); }
  .setor-row-value { font-variant-numeric:tabular-nums; font-weight:600; }
  .destaques { list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:10px; }
  .destaques li { padding:12px 14px; border-radius:10px; font-size:13.5px; line-height:1.45; border:1px solid var(--card-border); background:var(--bg); }
  .destaques li.ok { background:var(--ok-bg); color:var(--ok-fg); border-color:var(--ok-border); }
  .destaques li.warn { background:var(--warn-bg); color:var(--warn-fg); border-color:var(--warn-border); }
  .rank { list-style:none; padding:0; margin:0; }
  .rank li { display:flex; align-items:center; gap:14px; padding:12px 4px; border-bottom:1px dashed var(--card-border); }
  .rank li:last-child { border-bottom:none; }
  .rank-pos { flex:0 0 auto; width:28px; height:28px; border-radius:8px; display:inline-flex; align-items:center; justify-content:center; background:var(--accent-soft); color:var(--accent); font-weight:700; font-size:13px; }
  .rank-main { flex:1 1 auto; min-width:0; }
  .rank-name { font-size:14px; font-weight:600; }
  .rank-extra { font-size:12px; color:var(--muted); margin-top:2px; }
  .rank-value { font-variant-numeric:tabular-nums; font-weight:700; font-size:15px; }
  pre.raw { white-space:pre-wrap; word-wrap:break-word; margin:0; font-size:13px; line-height:1.6; color:var(--fg); }
  .footer-meta { color:var(--muted); font-size:11px; text-align:center; margin-top:8px; }
  @media print {
    body { padding:0; background:#fff; color:#000; }
    .actions, .btn { display:none !important; }
    .card { box-shadow:none; border-color:#ddd; background:#fff; }
    .kpi, .setor-card { background:#fafafa; }
    .scope { background:#eef; color:#224; }
    pre.raw, .kpi-value, .rank-value, .setor-row-value { color:#000 !important; }
  }
</style>
</head>
<body>
  <div class="wrap">
    <div class="topbar">
      <div class="brand"><span class="dot"></span><h1>${title}</h1></div>
      <div>
        <div class="meta">Gerado em ${escapeHtml(dateStr)}</div>
        <div class="actions"><button class="btn" onclick="window.print()">Imprimir / Salvar PDF</button></div>
      </div>
    </div>
    ${escopo ? `<div class="scope">${escapeHtml(escopo)}</div>` : ''}
    ${sectionsHTML}
    <div class="footer-meta">${escapeHtml(title)} · ${now.getFullYear()}</div>
  </div>
</body>
</html>`;
}

