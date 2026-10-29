// DOM helpers, escapeHtml → static/dom-helpers.js
// Inactive colabs/setores → static/inactive-state.js
// Colab fotos/avatar → static/colab-fotos.js

const APP_VERSION = '1.27.0';

// Foto do colaborador → static/colab-fotos.js

function _normName(s) {
  return typeof normalizeNameShared === 'function' ? normalizeNameShared(s) : (function() {
    try {
      return (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
    } catch (e) {
      return (s || "").toLowerCase().replace(/\s+/g, " ").trim();
    }
  })();
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

// UX helpers (toast, loading, empty) → static/ux-helpers.js

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

function deduplicateRecords(records) {
  const map = new Map();
  const toRemove = [];
  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    if (!r) continue;
    const key = `${r['Mês'] || ''}|${r['Atendente'] || ''}`;
    if (map.has(key)) {
      const existing = map.get(key);
      const scoreExisting = (existing.Assumidos || 0) + (existing.Finalizados || 0) + (existing.SCORE ? 1 : 0) + (existing.Nota1 || 0) + (existing.Nota2 || 0) + (existing.Nota3 || 0);
      const scoreCurrent = (r.Assumidos || 0) + (r.Finalizados || 0) + (r.SCORE ? 1 : 0) + (r.Nota1 || 0) + (r.Nota2 || 0) + (r.Nota3 || 0);
      if (scoreCurrent > scoreExisting) {
        toRemove.push(existing);
        map.set(key, r);
      } else {
        toRemove.push(r);
      }
    } else {
      map.set(key, r);
    }
  }
  if (toRemove.length > 0) {
    records = records.filter(r => !toRemove.includes(r));
  }

  // Atualiza a interface com os dados limpos
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
  if (typeof AppDataSession !== 'undefined' && !AppDataSession.owner()) return;
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
    try { chart.destroy(); } catch (e) { console.warn('[App] Erro ao destruir chart:', e); }
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
    try { gamificationCacheData = getOverallRanking(rawRecords).map(r => ({ name: r.name, score: r.score.total })); } catch(e) { console.error('[App] Erro ao atualizar cache gamificação:', e); }
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
  const sessionToken = typeof AppDataSession !== 'undefined' ? AppDataSession.token() : null;
  __saveTimeout = setTimeout(() => {
    try {
      if (sessionToken && !AppDataSession.current(sessionToken)) return;
      appStorage.setItem(STORAGE_KEY, JSON.stringify(getStateSnapshot()));
      updateStorageUI('ok');
    } catch (e) {
      updateStorageUI('warn');
    }
  }, 300);
}

function clearSavedState() {
  try { appStorage.removeItem(STORAGE_KEY); } catch (e) { console.warn('[App] Erro ao limpar storage:', e); }
  updateStorageUI(null);
}

function loadSavedState() {
  let raw = null;
  try { raw = appStorage.getItem(STORAGE_KEY); } catch (e) { raw = null; }
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
  if (typeof ChartTheme !== 'undefined') {
    ChartTheme.applyDefaults();
  } else {
    const initialTheme = document.documentElement.getAttribute('data-theme') || 'light';
    Chart.defaults.color = initialTheme === 'dark' ? '#e2e8f0' : '#1f2937';
  }
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
    } catch (e) { console.error('[App] Erro ao processar dados:', e); }
  });
}


// When setor or mês change we must refresh the atendente list to show only relevant names
function _rerenderActiveNonDashboardTab() {
  const active = document.querySelector('.tab-btn.active');
  if (!active) return;
  const tab = active.getAttribute('data-tab');
  if (tab === 'home' && typeof onHomeTabActivated === 'function') onHomeTabActivated();
  else if (tab === 'relatorio-setorial' && typeof onRelatorioSetorialTabActivated === 'function') onRelatorioSetorialTabActivated();
  else if (tab === 'saude-operacional' && typeof onSaudeOperacionalTabActivated === 'function') onSaudeOperacionalTabActivated();
  else if (tab === 'metas' && typeof onMetasTabActivated === 'function') onMetasTabActivated();
  else if (tab === 'gamificacao' && typeof onGamificationTabActivated === 'function') { onGamificationTabActivated(); if (typeof onMetasTabActivated === 'function') onMetasTabActivated(); }
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
  return typeof normalizeNameShared === 'function' ? normalizeNameShared(n) : String(n || '').trim().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/\s*[^\p{L}\p{N}\s]\s*(?:multi[\s\-]?setor)?\s*$/ui, '').replace(/\s*(?:multi[\s\-]?setor)\s*$/i, '').replace(/[^\p{L}\p{N}\s]/gu, '').trim().toLowerCase();
}


// Month filters → static/month-filters.js

function buildAliasMap(names) {
  const uniq = Array.from(new Set((names || []).filter(Boolean).map(n => String(n)))).sort((a,b) => a.localeCompare(b, 'pt-BR'));
  const map = new Map();
  uniq.forEach((name, idx) => map.set(name, `Colaborador ${idx + 1}`));
  return map;
}

function getFirstName(name) {
  if (!name) return '';
  return String(name).split(' ')[0];
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


// escapeHtml → static/dom-helpers.js

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
    if (p === '__range__') {
      mesSelect.value = 'all';
      selectedMonths = [];
    } else
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
  document.body.classList.toggle('presentation-mode', presentationMode);
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
      try { chart.destroy(); } catch (e) { console.warn('[App] Erro ao destruir chart:', e); }
      chart = null;
    }
    return;
  }

  const qLower = (searchAtendenteInput?.value || '').trim().toLowerCase();
  const globalSource = typeof globalFilters !== 'undefined' && globalFilters ? globalFilters.aplicar(rawRecords) : rawRecords;
  const filtered = globalSource.filter(r => {
    if (!r) return false;
    if (setorSelect.value !== 'all' && String(r['Setor']) !== setorSelect.value) return false;
    if (setorSelect.value === 'all' && typeof isSetorActive === 'function' && !isSetorActive(String(r['Setor']).trim())) return false;
    if (!monthMatches(r['Mês'])) return false;
    if (arquivoSelect && arquivoSelect.value !== 'all' && String(r['Arquivo']) !== arquivoSelect.value) return false;
    if (qLower) {
      if (typeof globalFilters !== 'undefined') {
        if (!globalFilters.correspondePesquisa(r, qLower)) return false;
      } else if (!String(r['Atendente'] || '').toLowerCase().includes(qLower)) return false;
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
  return setorSelect.value !== 'all' || monthFilterActive() || (arquivoSelect && arquivoSelect.value !== 'all') || compareActive || (atendenteSelect && atendenteSelect.value !== 'all') || q.length>0 || (typeof globalFilters !== 'undefined' && ((globalFilters.nivel && globalFilters.nivel !== 'all') || (globalFilters.periodo && globalFilters.periodo !== 'all')));
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
    const ferias = r ? getFeriasResultado(r.Atendente, [r]) : null;
    if (ferias?.esteve && !out.some(item => item.atendente === r.Atendente && item.mes === r['Mês'])) {
      out.push({ atendente: String(r['Atendente']||''), mes: String(r['Mês']||''), obs: ferias.detalhes });
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
        .filter(r => typeof globalFilters === 'undefined' || globalFilters.correspondeNivel(r))
        .filter(r => (setorSel === 'all' || String(r['Setor']) === setorSel))
        .filter(r => (arquivoSel === 'all' || String(r['Arquivo']) === arquivoSel))
        .filter(r => String(r['Mês']) === prev)
        .filter(r => {
          if (qLower) {
      if (typeof globalFilters !== 'undefined') {
        if (!globalFilters.correspondePesquisa(r, qLower)) return false;
      } else if (!String(r['Atendente'] || '').toLowerCase().includes(qLower)) return false;
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
        ${alerts.length ? `<span class="badge" style="background:var(--badge-alert-bg);border-color:var(--badge-alert-border);color:var(--badge-alert-text)">⚠️ ${escapeHtml(alerts.join(' · '))}</span>` : `<span class="badge" style="background:var(--badge-ok-bg);border-color:var(--badge-ok-border);color:var(--badge-ok-text)">OK</span>`}${presentationMode ? `<span class="badge presentation-note">Nomes ocultos na exibição</span>` : ''}
      </div>
    </div>

    <div class="kpi-grid" style="margin-top:12px">
      <div class="kpi kpi-drill" data-kpi="assumidos"><div class="label">Assumidos</div><div class="value">${fmtInt(totalAssumidos)}</div><div class="sub">${deltaAssumidos===null?'':`<span class="${deltaAssumidos>=0?'variation-pos':'variation-neg'}">${deltaAssumidos>=0?'▲':'▼'} mês ant.: ${fmtPct(deltaAssumidos)}</span>`}</div></div>
      <div class="kpi kpi-drill" data-kpi="transferidos"><div class="label">Transferidos</div><div class="value">${fmtInt(totalTransferidos)}</div><div class="sub">${taxaTransfer===null?'':`Taxa: ${(taxaTransfer*100).toFixed(1)}%`}</div></div>
      <div class="kpi kpi-drill" data-kpi="finalizados"><div class="label">Finalizados</div><div class="value">${fmtInt(totalFinalizados)}</div><div class="sub">${deltaFinalizados===null?'':`<span class="${deltaFinalizados>=0?'variation-pos':'variation-neg'}">${deltaFinalizados>=0?'▲':'▼'} mês ant.: ${fmtPct(deltaFinalizados)}</span>`}</div></div>
      <div class="kpi kpi-drill" data-kpi="score"><div class="label">Score médio</div><div class="value${avgScoreNum!==null ? ' ' + getClasseScore(avgScoreNum) : ''}">${fmtScore(avgScoreNum)}</div><div class="sub">${deltaScore===null?'':`<span class="${deltaScore>=0?'variation-pos':'variation-neg'}">${deltaScore>=0?'▲':'▼'} mês ant.: ${deltaScore>=0?'+':''}${deltaScore.toFixed(2)}</span>`}</div></div>
      <div class="kpi kpi-drill" data-kpi="produtividade"><div class="label">Produtividade</div><div class="value">${produtividade===null?'—':(produtividade*100).toFixed(1)+'%'}</div><div class="sub">Finalizados / Assumidos</div></div>
      <div class="kpi kpi-drill" data-kpi="atendentes"><div class="label">Atendentes</div><div class="value">${fmtInt(atendentesNoEscopo)}</div><div class="sub">no escopo</div></div>
      <div class="kpi kpi-drill" data-kpi="setores"><div class="label">Setores</div><div class="value">${fmtInt(setoresNoEscopo)}</div><div class="sub">no escopo</div></div>
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
  `;

  card.style.display = 'block';
}

// ─── KPI Drill-down: clique no card mostra detalhamento por setor ───

function showKpiBreakdown(kpiType, rows) {
  const filtered = rows.filter(r => r && !isAggregateName(r['Atendente']));
  if (!filtered.length) return;

  const labels = {
    assumidos: 'Assumidos',
    transferidos: 'Transferidos',
    finalizados: 'Finalizados',
    score: 'Score médio',
    produtividade: 'Produtividade',
    atendentes: 'Atendentes',
    setores: 'Setores'
  };
  const title = labels[kpiType] || kpiType;

  // Mesmo escopo (filtros legados) com mês forçado — para comparar com o mês anterior
  function rowsForMonth(month) {
    const setorVal = setorSelect.value;
    const arquivoVal = arquivoSelect ? arquivoSelect.value : 'all';
    const selectedAt = getSelectedAtendentes();
    const qLower = (searchAtendenteInput?.value || '').trim().toLowerCase();
    const source = (rawRecords || []).filter(r => typeof globalFilters === 'undefined' || globalFilters.correspondeNivel(r));
    return source.filter(r => {
      if (!r) return false;
      if (String(r['Mês']) !== String(month)) return false;
      if (isAggregateName(r['Atendente'])) return false;
      if (setorVal !== 'all' && String(r['Setor']) !== setorVal) return false;
      if (setorVal === 'all' && typeof isSetorActive === 'function' && !isSetorActive(String(r['Setor']).trim())) return false;
      if (arquivoVal !== 'all' && String(r['Arquivo']) !== arquivoVal) return false;
      if (qLower && !(typeof globalFilters !== 'undefined' ? globalFilters.correspondePesquisa(r, qLower) : String(r['Atendente'] || '').toLowerCase().includes(qLower))) return false;
      if (selectedAt && selectedAt.length && !selectedAt.includes('all')) {
        if (!selectedAt.includes(String(r['Atendente']))) return false;
      } else if (atendenteSelect && atendenteSelect.value !== 'all') {
        if (String(r['Atendente']) !== atendenteSelect.value) return false;
      }
      return true;
    });
  }

  function aggregate(recs) {
    const m = {};
    recs.forEach(r => {
      const s = String(r['Setor'] || '').trim() || 'Sem setor';
      if (!m[s]) m[s] = { count: 0, assumidos: 0, transferidos: 0, finalizados: 0, scores: [] };
      m[s].count++;
      m[s].assumidos += parseInt(r['Assumidos']) || 0;
      m[s].transferidos += parseInt(r['Transferidos']) || 0;
      m[s].finalizados += parseInt(r['Finalizados']) || 0;
      const sc = parseFloat(r['SCORE']);
      if (!isNaN(sc)) m[s].scores.push(sc);
    });
    return m;
  }

  function aggregateTotal(agg) {
    return Object.values(agg).reduce((t, d) => {
      t.count += d.count;
      t.assumidos += d.assumidos;
      t.transferidos += d.transferidos;
      t.finalizados += d.finalizados;
      t.scores = t.scores.concat(d.scores);
      return t;
    }, { count: 0, assumidos: 0, transferidos: 0, finalizados: 0, scores: [] });
  }

  function metricValue(data) {
    if (kpiType === 'score') return data.scores.length ? data.scores.reduce((a, b) => a + b, 0) / data.scores.length : null;
    if (kpiType === 'produtividade') return data.assumidos > 0 ? data.finalizados / data.assumidos : null;
    if (kpiType === 'atendentes') return data.count;
    if (kpiType === 'setores') return 1;
    return data[kpiType];
  }

  function fmtVal(v) {
    if (v === null || v === undefined || Number.isNaN(v)) return '—';
    if (kpiType === 'score') return Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (kpiType === 'produtividade') return (Number(v) * 100).toFixed(1) + '%';
    return Number(v).toLocaleString('pt-BR');
  }

  function deltaHTML(cur, prev) {
    if (cur === null || cur === undefined || Number.isNaN(cur) || prev === null || prev === undefined || Number.isNaN(prev)) return null;
    let d, txt, cls;
    if (kpiType === 'score') {
      d = Math.round(cur * 100) - Math.round(prev * 100);
      if (d === 0) return '<span class="variation-neutro">=</span>';
      txt = `${d > 0 ? '▲' : '▼'} ${d > 0 ? '+' : ''}${(Math.abs(d) / 100).toFixed(2)}`;
      cls = d > 0 ? 'variation-pos' : 'variation-neg';
    } else if (kpiType === 'produtividade') {
      d = Math.round(cur * 1000) - Math.round(prev * 1000);
      if (d === 0) return '<span class="variation-neutro">=</span>';
      txt = `${d > 0 ? '▲' : '▼'} ${d > 0 ? '+' : ''}${(Math.abs(d) / 10).toFixed(1)} pp`;
      cls = d > 0 ? 'variation-pos' : 'variation-neg';
    } else {
      if (prev === 0) return cur === 0 ? null : '<span class="variation-neutro">▲ novo</span>';
      const pct = ((cur - prev) / prev) * 100;
      if (pct === 0) return '<span class="variation-neutro">=</span>';
      txt = `${pct > 0 ? '▲' : '▼'} ${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`;
      cls = pct > 0 ? 'variation-pos' : 'variation-neg';
    }
    return `<span class="${cls}">${txt}</span>`;
  }

  const scopeMonths = [...new Set(filtered.map(r => String(r['Mês'])).filter(Boolean))].sort();
  const periodoTxt = !scopeMonths.length ? 'Sem período' : (scopeMonths.length === 1 ? scopeMonths[0] : `${scopeMonths[0]} → ${scopeMonths[scopeMonths.length - 1]}`);

  // ── Por mês (evolução só quando há mais de um mês no escopo) ──
  let monthSection = '';
  if (kpiType !== 'setores' && scopeMonths.length > 1) {
    const monthRows = [];
    let prevVal = null;
    scopeMonths.forEach(m => {
      const monthRecs = filtered.filter(r => String(r['Mês']) === m);
      const val = metricValue(aggregateTotal(aggregate(monthRecs)));
      const d = deltaHTML(val, prevVal);
      monthRows.push(`<tr><td>${escapeHtml(m)}</td><td class="kpi-drill-value">${fmtVal(val)}</td><td class="kpi-drill-delta">${d || '<span class="variation-neutro">—</span>'}</td></tr>`);
      prevVal = val;
    });
    monthSection = `
      <h3 class="kpi-drill-sub">Por mês — qual mês subiu ou desceu</h3>
      <table class="kpi-drill-table">
        <thead><tr><th>Mês</th><th class="kpi-drill-value">${title}</th><th class="kpi-drill-delta">Δ mês ant.</th></tr></thead>
        <tbody>${monthRows.join('')}</tbody>
      </table>`;
  }

  // ── Por setor (com Δ vs mês anterior quando há mês único selecionado) ──
  const singleMonth = scopeMonths.length === 1 ? scopeMonths[0] : null;
  let prevMonthKey = null;
  if (singleMonth) {
    const m = String(singleMonth).match(/(\d{4})-(\d{2})/);
    if (m) {
      let y = parseInt(m[1]); let mo = parseInt(m[2]);
      mo -= 1;
      if (mo === 0) { mo = 12; y -= 1; }
      prevMonthKey = `${y}-${String(mo).padStart(2, '0')}`;
    }
  }
  const prevAgg = prevMonthKey ? aggregate(rowsForMonth(prevMonthKey)) : null;
  const showDelta = !!(prevMonthKey && prevAgg);

  const sectorAgg = aggregate(filtered);
  const entries = Object.entries(sectorAgg).sort((a, b) => a[0].localeCompare(b[0]));
  let sectorRows = '';
  let total = 0;
  const isCount = kpiType === 'assumidos' || kpiType === 'transferidos' || kpiType === 'finalizados' || kpiType === 'atendentes';
  entries.forEach(([setor, data]) => {
    const val = metricValue(data);
    const prevVal = prevAgg && prevAgg[setor] ? metricValue(prevAgg[setor]) : null;
    const d = showDelta ? deltaHTML(val, prevVal) : null;
    const deltaTd = showDelta
      ? `<td class="kpi-drill-delta">${d || '<span class="variation-neutro">—</span>'}</td>`
      : '';
    if (typeof val === 'number') total += val;
    sectorRows += `<tr><td>${escapeHtml(setor)}</td><td class="kpi-drill-value">${fmtVal(val)}</td>${deltaTd}</tr>`;
  });
  if (isCount) {
    sectorRows += `<tr class="kpi-drill-total"><td>Total</td><td class="kpi-drill-value">${total.toLocaleString('pt-BR')}</td>${showDelta ? '<td class="kpi-drill-delta"></td>' : ''}</tr>`;
  }

  const sectorSection = `
    <h3 class="kpi-drill-sub">Por setor${showDelta ? ' — Δ vs ' + escapeHtml(prevMonthKey) : ''}</h3>
    <table class="kpi-drill-table">
      <thead><tr><th>Setor</th><th class="kpi-drill-value">${title}</th>${showDelta ? '<th class="kpi-drill-delta">Δ mês ant.</th>' : ''}</tr></thead>
      <tbody>${sectorRows}</tbody>
    </table>`;

  const overlay = document.createElement('div');
  overlay.className = 'kpi-drill-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', title);
  overlay.innerHTML = `
    <div class="kpi-drill-panel kpi-drill-panel--wide">
      <div class="kpi-drill-header">
        <div>
          <h2>${title} — detalhamento</h2>
          <div style="font-size:12px;color:var(--text-muted);margin-top:2px">Período: ${escapeHtml(periodoTxt)}</div>
        </div>
        <button class="kpi-drill-close" type="button">✕</button>
      </div>
      ${monthSection}
      ${sectorSection}
    </div>
  `;
  document.body.appendChild(overlay);
  function closeOverlay() { overlay.remove(); document.removeEventListener('keydown', onKey); }
  function onKey(ev) { if (ev.key === 'Escape') closeOverlay(); }
  overlay.querySelector('.kpi-drill-close').addEventListener('click', closeOverlay);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeOverlay(); });
  document.addEventListener('keydown', onKey);
  overlay.querySelector('.kpi-drill-close').focus();
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
  const colorVar = up ? 'var(--variation-pos)' : 'var(--variation-neg)';
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><polyline fill="none" stroke="${colorVar}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" points="${points}"/></svg>`;
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
    if (typeof applyPreviewColumns === 'function') applyPreviewColumns(previewTable, []);
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
    const active = currentSort.key === k;
    const direction = active ? (currentSort.desc ? 'descending' : 'ascending') : 'none';
    headerHtml += `<th${thClass} aria-sort="${direction}"><button type="button" class="preview-sort-column" data-sort-index="${keys.indexOf(k)}" title="Clique para ordenar">${escapeHtml(k)} <span aria-hidden="true">${active ? (currentSort.desc ? '▼' : '▲') : '↕'}</span></button></th>`;
    if (k === 'Finalizados') {
      headerHtml += '<th>Var.%</th>';
    }
    if (k === 'SCORE') {
      headerHtml += '<th>Var.%</th>';
    }
    if (k === 'Total') {
      headerHtml += '<th>📈</th>';
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
        const ferias = getFeriasResultado(r.Atendente, [r]);
        const isFer = ferias.esteve;
        const atName = String(r['Atendente']||'').trim();
        const isMulti = __multiMap.has(atName);
        const badges = `${isFer ? `<span contenteditable="false" class="row-badge badge-ferias" title="${escapeHtml(ferias.detalhes)}">🏖️ Esteve de férias</span>` : ''}${isMulti ? `<span class="row-badge badge-multi" title="Atuou em mais de um setor: ${escapeHtml(__multiMap.get(atName).join(', '))}">🔁 Multi-setor</span>` : ''}`;
        rowHtml += `<td contenteditable="${presentationMode || !isAdmin() ? 'false' : 'true'}" data-idx="${ridx}" data-key="${escapeHtml(k)}" class="cell-edit cell-atendente">${escapeHtml(shown)}${badges}</td>`;
        return;
      }
      if (k === 'Observações') {
        const isFer = isFeriasObs(raw);
        rowHtml += `<td contenteditable="${isAdmin()}" data-idx="${ridx}" data-key="${escapeHtml(k)}" class="cell-edit cell-obs ${isFer ? 'cell-ferias' : ''}">${escapeHtml(shown)}</td>`;
        return;
      }
      rowHtml += `<td contenteditable="${isAdmin() && !(k === 'Atendente' && presentationMode)}" data-idx="${ridx}" data-key="${escapeHtml(k)}" class="cell-edit">${escapeHtml(shown)}</td>`;
      if (k === 'Total') {
        rowHtml += `<td class="sparkline-cell">${colabSparkline(r['Atendente'])}</td>`;
      }
    });
    html.push('<tr>' + rowHtml + `<td style="white-space:nowrap"><span class="status-badge ${statusClass}">${escapeHtml(statusText)}</span> <button class="btn-small btn-delete" data-idx="${ridx}" title="Remover" aria-label="Remover">🗑️</button></td>` + '</tr>');
  });
  html.push('</tbody></table></div>');
  previewTable.innerHTML = html.join('');
  if (typeof applyPreviewColumns === 'function') applyPreviewColumns(previewTable, keys);
  previewTable.querySelectorAll('[data-sort-index]').forEach(button => {
    button.addEventListener('click', () => {
      const key = keys[Number(button.dataset.sortIndex)];
      currentSort.desc = currentSort.key === key ? !currentSort.desc : true;
      currentSort.key = key;
      renderPreview(previewRows);
      previewTable.querySelector(`[data-sort-index="${keys.indexOf(key)}"]`)?.focus();
    });
  });

  // Highlight rows based on performance
  const _tbody = previewTable.querySelector('tbody');
  if (_tbody) {
    _tbody.querySelectorAll('tr').forEach((tr, idx) => {
      const row = rows[idx];
      if (!row) return;
      const sc = row['SCORE'];
      if (sc !== null && sc !== undefined && !isNaN(Number(sc))) {
        const cls = getClasseScore(Number(sc));
        if (cls === 'score-excelente') tr.classList.add('highlight-row');
        else if (cls === 'score-critico') tr.classList.add('attention-row');
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
      const cellValue = el.cloneNode(true);
      cellValue.querySelectorAll('.row-badge').forEach(badge => badge.remove());
      const val = cellValue.textContent.trim();
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
          if (!ok) {
            const preserved = getPendingSync().some(record => String(record.id) === String(rec.id));
            showToast(preserved ? 'Alteração preservada nesta conta; envio ao servidor pendente.' : 'Não foi possível preservar a alteração. Tente novamente.', preserved ? 'warning' : 'error');
          }
        }).catch(() => {});
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

function parseDurationToSeconds(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim().toLowerCase();
  if (!s) return null;
  let total = 0;
  let matched = false;
  const d = s.match(/(\d+(?:[.,]\d+)?)\s*d/);
  if (d) { total += parseFloat(d[1].replace(',', '.')) * 86400; matched = true; }
  const h = s.match(/(\d+(?:[.,]\d+)?)\s*h/);
  if (h) { total += parseFloat(h[1].replace(',', '.')) * 3600; matched = true; }
  const mi = s.match(/(\d+(?:[.,]\d+)?)\s*m(?!s)/);
  if (mi) { total += parseFloat(mi[1].replace(',', '.')) * 60; matched = true; }
  const sec = s.match(/(\d+(?:[.,]\d+)?)\s*s/);
  if (sec) { total += parseFloat(sec[1].replace(',', '.')); matched = true; }
  if (matched) return total;
  const c = s.split(':');
  if (c.length >= 2 && c.every(x => x.trim() !== '' && !isNaN(parseFloat(x.trim())))) {
    const nums = c.map(x => parseFloat(x.trim()));
    if (c.length === 2) return nums[0] * 60 + nums[1];
    if (c.length === 3) return nums[0] * 3600 + nums[1] * 60 + nums[2];
  }
  const n = parseFloat(s.replace(/,/g, '.'));
  return isNaN(n) ? null : n;
}

function sortRows(rows, key, desc=true) {
  // Separate aggregate rows from regular rows
  const aggregates = rows.filter(r => r && isAggregateName(r['Atendente']));
  const regular = rows.filter(r => r && !isAggregateName(r['Atendente']));

  const isDuration = key === 'TMA' || key === 'TMR';
  const numericValue = value => {
    if (value === null || value === undefined || String(value).trim() === '') return null;
    let text = String(value).trim().replace(/\s/g, '').replace(/%$/, '');
    if (text.includes(',')) text = text.replace(/\./g, '').replace(',', '.');
    const number = Number(text);
    return Number.isFinite(number) ? number : null;
  };
  // Sort only regular rows
  regular.sort((a,b) => {
    const va = a && a[key];
    const vb = b && b[key];
    let na, nb;
    if (isDuration) {
      na = parseDurationToSeconds(va);
      nb = parseDurationToSeconds(vb);
    } else {
      na = numericValue(va);
      nb = numericValue(vb);
    }
    if (na === null && nb === null) {
      const sa = String(va || '').localeCompare(String(vb || ''), 'pt');
      return desc ? -sa : sa;
    }
    if (na === null) return 1;
    if (nb === null) return -1;
    return desc ? (nb - na) : (na - nb);
  });

  // Return sorted regular rows + aggregates at the end
  return [...regular, ...aggregates];
}

function renderChart(rows) { return DashboardCharts.render(rows); }

// expose for debugging (removed in production)

// wire preview sort buttons

function getCurrentFilteredRows() {
  const setorVal = setorSelect.value;
  const mesVal = getActiveMonths();
  const arquivoVal = arquivoSelect ? arquivoSelect.value : 'all';
  const selectedAt = getSelectedAtendentes();

  const source = typeof globalFilters !== 'undefined' && globalFilters ? globalFilters.aplicar(rawRecords) : rawRecords;
  return source.filter(r => {
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

function buildReportText(options) { return DashboardReport.build(options); }

// ── Removed: clearReportTextOnly, generateAndShowReport, copyReportToClipboard, exportReportToPDF, exportPDFcomGrafico, escapeHtml moved to static/reports.js; handleError moved to static/csv-import.js ──

document.addEventListener('DOMContentLoaded', async () => {
  const vEl = document.getElementById('appVersion');
  if (vEl) vEl.textContent = 'v' + APP_VERSION;
  // Aguarda autenticação (se Supabase estiver disponível)
  if (sbClient) {
    const user = await initAuth();
    if (!user) {
      return;
    }
  }

  // Define papel do usuário (admin/viewer)
  if (sbClient) {
    const { data: { user } } = await sbClient.auth.getUser();
    if (user) {
      const role = getTrustedUserRole(user);
      if (role === 'admin') {
        document.body.dataset.role = 'admin';
      } else {
        document.body.dataset.role = 'colaborador';
      }
      document.dispatchEvent(new CustomEvent('app-role-ready', { detail: { role: document.body.dataset.role } }));
      if (!role) {
        try {
          await fetch('/api/users', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: user.id, role: 'viewer' })
        });
      } catch (e) { console.error('[App] Erro:', e); }
      }
      // Bloqueio: usuário não-admin com ativo=false não acessa o app
      if (isTrustedAccountBlocked(user)) {
        // Se já viu a tela de erro antes, desloga e volta pro login
        if (sessionStorage.getItem('blocked_error_shown')) {
          await sbClient.auth.signOut();
          sessionStorage.removeItem('blocked_error_shown');
          window.location.reload();
          return;
        }
        sessionStorage.setItem('blocked_error_shown', '1');
        const appScreen = document.getElementById('appScreen');
        if (appScreen) {
          appScreen.style.display = 'none';
          const authScreen = document.getElementById('authScreen');
          if (authScreen) authScreen.style.display = 'none';
          document.getElementById('authLoading')?.classList.add('hidden');
          const blocked = document.createElement('div');
          blocked.id = 'blockedScreen';
          blocked.style.cssText = 'display:flex;align-items:center;justify-content:center;min-height:100vh;padding:20px;text-align:center;background:var(--bg)';
          blocked.innerHTML = `<div style="max-width:420px">
            <div style="font-size:48px;margin-bottom:16px">⚠️</div>
            <h1 style="font-size:22px;margin-bottom:8px">Erro ao carregar o painel</h1>
            <p style="color:var(--text-secondary);font-size:14px;margin-bottom:24px">Ocorreu um erro inesperado ao carregar o Painel de Suporte. Tente novamente mais tarde ou reporte o erro ao administrador.</p>
            <button id="solicitarDesbloqueioBtn" class="btn-primary" type="button" style="width:100%;justify-content:center">Reportar erro ao administrador</button>
            <div id="solicitarDesbloqueioStatus" style="margin-top:12px;font-size:13px;display:none"></div>
          </div>`;
          document.body.appendChild(blocked);

          document.getElementById('solicitarDesbloqueioBtn').addEventListener('click', async () => {
            const btn = document.getElementById('solicitarDesbloqueioBtn');
            const status = document.getElementById('solicitarDesbloqueioStatus');
            btn.disabled = true;
            btn.textContent = 'Enviando...';
            status.style.display = 'none';
            try {
              const { error } = await sbClient
                .from('reportes')
                .insert({
                  nome: user.email || 'Desconhecido',
                  email: user.email || '',
                  assunto: 'Solicitação de desbloqueio',
                  mensagem: `Usuário ${user.email} está tentando acessar o sistema e está bloqueado.`
                });
              if (error) throw error;
              status.style.cssText = 'margin-top:12px;font-size:13px;display:block;padding:10px;background:var(--success-bg,#d1fae5);color:var(--success-text,#065f46);border-radius:8px';
              status.textContent = 'Relato enviado! Você será redirecionado.';
              btn.style.display = 'none';
              setTimeout(async () => {
                await sbClient.auth.signOut();
                sessionStorage.removeItem('blocked_error_shown');
                window.location.reload();
              }, 2000);
            } catch (e) {
              status.style.cssText = 'margin-top:12px;font-size:13px;display:block;padding:10px;background:var(--danger-bg,#fee2e2);color:var(--danger-text,#991b1b);border-radius:8px';
              status.textContent = 'Erro ao enviar: ' + (e.message || 'tente novamente.');
              btn.disabled = false;
              btn.textContent = 'Reportar erro ao administrador';
            }
          });
        }
        return;
      }
      // Mostra usuário logado na topbar
      const display = document.getElementById('currentUserDisplay');
      if (display) {
        display.textContent = user.user_metadata?.name || user.email;
      }
      // Dropdown header shows email
      const ddEmail = document.getElementById('userDropdownEmail');
      if (ddEmail) ddEmail.textContent = user.email;

      // User dropdown toggle
      const userWrapper = document.getElementById('userMenuWrapper');
      const userDropdown = document.getElementById('userDropdown');
      if (display && userDropdown) {
        display.addEventListener('click', (e) => {
          e.stopPropagation();
          const open = userDropdown.style.display !== 'none';
          userDropdown.style.display = open ? 'none' : 'block';
          display.setAttribute('aria-expanded', !open);
        });
        document.addEventListener('click', () => {
          userDropdown.style.display = 'none';
          display.setAttribute('aria-expanded', 'false');
        });
      }

      // Edit name modal
      const editNameBtn = document.getElementById('editNameBtn');
      const editNameModal = document.getElementById('editNameModal');
      const editNameInput = document.getElementById('editNameInput');
      const editNameSaveBtn = document.getElementById('editNameSaveBtn');
      const editNameCancelBtn = document.getElementById('editNameCancelBtn');
      const editNameError = document.getElementById('editNameError');

      if (editNameBtn && editNameModal) {
        editNameBtn.addEventListener('click', () => {
          userDropdown.style.display = 'none';
          editNameInput.value = user.user_metadata?.name || '';
          editNameError.classList.add('hidden');
          editNameModal.style.display = 'flex';
          editNameInput.focus();
        });
        editNameCancelBtn?.addEventListener('click', () => {
          editNameModal.style.display = 'none';
        });
        editNameModal.addEventListener('click', (e) => {
          if (e.target === editNameModal) editNameModal.style.display = 'none';
        });
        editNameSaveBtn?.addEventListener('click', async () => {
          const newName = editNameInput.value.trim();
          if (!newName) { editNameError.textContent = 'Digite um nome.'; editNameError.classList.remove('hidden'); return; }
          editNameSaveBtn.disabled = true;
          editNameSaveBtn.textContent = 'Salvando...';
          const { error } = await sbClient.auth.updateUser({ data: { name: newName } });
          editNameSaveBtn.disabled = false;
          editNameSaveBtn.textContent = 'Salvar';
          if (error) {
            editNameError.textContent = error.message;
            editNameError.classList.remove('hidden');
          } else {
            user.user_metadata = { ...user.user_metadata, name: newName };
            if (display) display.textContent = newName;
            editNameModal.style.display = 'none';
            showToast('Nome atualizado!', 'success');
          }
        });
        editNameInput?.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') editNameSaveBtn?.click();
        });
      }
    }
  }

  // Perfis de colaborador continuam sem acesso aos dados gerenciais.
  if (document.body.dataset.role === "colaborador") {
    const homeScreen = document.getElementById("homeScreen");
    const appScreen = document.getElementById("appScreen");
    if (homeScreen) homeScreen.style.display = "none";
    if (appScreen) appScreen.style.display = "block";
    const content = document.querySelector('#appScreen .content');
    if (content) content.innerHTML = '<section class="card"><h2>Área do colaborador</h2><p>Nenhum módulo está disponível para este perfil no momento.</p></section>';
    setLoading(false);
    return;
  }

  // Carrega dados extras do Supabase (metas, comentários, scoring, fotos, etc.)
  if (typeof initDbExtra === 'function') {
    setLoading(true, 'Carregando dados...');
    initDbExtra().then(() => {
      if (typeof AppDataSession !== 'undefined' && !AppDataSession.owner()) return;
      window.__inactiveColabs = null; window.__inactiveSetores = null;
      if (typeof loadScoringRules === 'function') loadScoringRules();
      if (typeof loadAlertasConfig === 'function') loadAlertasConfig();
      if (typeof globalFilters !== 'undefined') {
        globalFilters.popularOptions();
        globalFilters._notify();
      }
      setLoading(false);
      if (isAdmin() && typeof dbNotificacoesLoad === 'function') {
            dbNotificacoesLoad().then(initNotificacoesUI).catch(() => {});
      }
      if (typeof initReportesNotifications === 'function') {
        initReportesNotifications();
      }
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

  // Empty server results remain empty; repository fallback is scoped to this session.
  const supabaseRecords = await dbLoadRecords();
  if (Array.isArray(supabaseRecords)) {
    rawRecords = deduplicateRecords(normalizeAtendenteOnRecords(supabaseRecords));
    if (typeof invalidateGamificationCache === 'function') invalidateGamificationCache();
    populateFilters(rawRecords);
    globalFilters?.popularOptions(); updateFilterOptions();
    handleError('updateView', () => updateView()); showAppScreen();
  } else if (typeof AppDataSession !== 'undefined' && AppDataSession.owner()) {
    rawRecords = []; populateFilters(rawRecords); updateFilterOptions(); showAppScreen();
  }

// Inicia no Menu inicial (mantém restauração automática em memória, mas só mostra painel quando você entrar)
const startBtn = document.getElementById('startBtn');
const openSavedBtn = document.getElementById('openSavedBtn');
const homeSavedInfo = document.getElementById('homeSavedInfo');

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
  if (Array.isArray(supabaseRecords)) {
    rawRecords = normalizeAtendenteOnRecords(supabaseRecords);
    if (typeof invalidateGamificationCache === 'function') invalidateGamificationCache();
    setGlobalEmpty(false);
    populateFilters(rawRecords);
    updateFilterOptions();
    try { updateView(); } catch (e) { console.error('[App] Erro ao atualizar view:', e); }
    clearSavedState();
    updateStorageUI('ok', null);
    showAppScreen();
    const official = AppState.get('records')?.source === 'server';
    showToast(official ? 'Indicadores atualizados com os dados do servidor e as pendências desta conta.' : 'Dados locais desta conta restaurados; o servidor ainda não foi confirmado.', official ? 'success' : 'warning', 'Indicadores');
  } else {
    showToast('Não foi possível validar a sessão para restaurar os indicadores.', 'warning');
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
  if (cleanDupBtn) cleanDupBtn.addEventListener('click', () => { if (!requireAdmin()) return; if (!confirm('Remover registros duplicados? Esta ação não pode ser desfeita.')) return; cleanDuplicates(); });
  if (exportCsvBtn) exportCsvBtn.addEventListener('click', () => { exportCsv(); });
  const backupCsvBtn = document.getElementById('backupCsvBtn');
  if (backupCsvBtn) backupCsvBtn.addEventListener('click', () => { backupCsv(); });
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
    appStorage.setItem(COMPACT_KEY, enabled ? '1' : '');
    const btn = document.getElementById('compactTableBtn');
    if (btn) btn.innerHTML = enabled ? '📏 Visão normal' : '📏 Visão compacta';
  }
  applyCompact(appStorage.getItem(COMPACT_KEY) === '1');
  const compactBtn = document.getElementById('compactTableBtn');
  if (compactBtn) {
    compactBtn.addEventListener('click', () => {
      applyCompact(!document.body.classList.contains('table-compact'));
    });
  }

  // ── Ferramentas: painéis acessíveis sem recriar ações existentes ──
  document.querySelectorAll('.panel-collapsible .panel-header').forEach(header => {
    const panel = header.closest('.panel-collapsible');
    const sync = () => header.setAttribute('aria-expanded', String(!panel?.classList.contains('collapsed')));
    header.setAttribute('role', 'button');
    header.setAttribute('tabindex', '0');
    if (header.dataset.toggle) header.setAttribute('aria-controls', header.dataset.toggle);
    sync();
    header.addEventListener('click', () => { panel?.classList.toggle('collapsed'); sync(); });
    header.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); header.click(); }
    });
  });

  // ── KPI drill-down (delegation on summaryContent) ──
  document.getElementById('summaryContent')?.addEventListener('click', (e) => {
    const kpi = e.target.closest('.kpi-drill');
    if (!kpi) return;
    const kpiType = kpi.dataset.kpi;
    const rows = getCurrentFilteredRows();
    showKpiBreakdown(kpiType, rows);
  });

  updatePreviewSortControls();

  // ===== Tab System =====
  const tabBar = document.getElementById('tabBar');
  if (tabBar) {
    const pageContext = {
      home: ['Início', 'Visão geral da operação e acessos rápidos'],
      dashboard: ['Indicadores', 'Desempenho, qualidade e produtividade do suporte'],
      'relatorio-setorial': ['Relatório por setor', 'Resultados, evolução e destaques por setor'],
      'saude-operacional': ['Visão geral da operação', 'Resultados consolidados e pontos de atenção'],
      metas: ['Metas da operação', 'Objetivos e progresso no recorte selecionado'],
      tarefas: ['Rotina', 'Agenda, tarefas e anotações diárias'],
      regras: ['Regras', 'Quadro de normas e orientações atuais'],
      colaboradores: ['Equipe', 'Perfis 360º e acompanhamento individual'],
      ponto: ['Auditoria de Ponto', 'Importação, jornadas e conferência dos cartões de ponto'],
      lider: ['Acompanhamento da equipe', 'Acompanhamento gerencial e alertas da operação'],
      insights: ['Tendências e alertas', 'Diagnósticos automáticos e oportunidades de melhoria'],
      avaliacao: ['Avaliação de desempenho', 'Avaliações de desempenho e feedback estruturado'],
      'perfil-pdi': ['Análise de perfil e PDI', 'Evidências, objetivos e planos de desenvolvimento'],
      'mapeamento-time': ['Mapeamento de Time', 'Perfis, talentos e ações de desenvolvimento']
    };
    const updatePageContext = (tab) => {
      const context = pageContext[tab] || pageContext.home;
      document.body.dataset.activeTab = tab;
      window.appShell?.sync(tab);
      if (typeof globalFilters !== 'undefined') globalFilters.atualizarContexto();
      const title = document.getElementById('appPageTitle');
      const description = document.getElementById('appPageDescription');
      if (title) title.textContent = context[0];
      if (description) description.textContent = context[1];
    };

    tabBar.addEventListener('click', (e) => {
      const tabBtn = e.target.closest('.tab-btn');
      if (!tabBtn) return;
      const tab = tabBtn.getAttribute('data-tab');
      if (!tab) return;

      // Update active state
      tabBar.querySelectorAll('.tab-btn').forEach(b => { b.classList.remove('active'); b.setAttribute('aria-selected', 'false'); });
      tabBtn.classList.add('active');
      tabBtn.setAttribute('aria-selected', 'true');
      updatePageContext(tab);

      // Show/hide tab content
      document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
      const target = document.getElementById('tab-' + tab);
      if (target) target.classList.add('active');

      // Call per-tab initialization
      if (tab === 'perfil-pdi' && typeof onPerfilPdiTabActivated === 'function') onPerfilPdiTabActivated();
      if (tab === 'ponto' && typeof onPontoTabActivated === 'function') onPontoTabActivated();
      if (tab === 'home' && typeof onHomeTabActivated === 'function') {
        onHomeTabActivated();
      }
      if (tab === 'lider' && typeof onLiderTabActivated === 'function') {
        onLiderTabActivated();
      }
      if (tab === 'insights' && typeof onInsightsTabActivated === 'function') {
        onInsightsTabActivated();
      }
      if (tab === 'tarefas' && typeof onTarefasTabActivated === 'function') {
        onTarefasTabActivated();
      }
      if (tab === 'regras' && typeof onRegrasTabActivated === 'function') {
        onRegrasTabActivated();
      }
      if (tab === 'colaboradores' && typeof onColaboradoresTabActivated === 'function') {
        onColaboradoresTabActivated();
      }
      if (tab === 'mapeamento-time' && typeof onMapeamentoTimeTabActivated === 'function') {
        onMapeamentoTimeTabActivated();
      }
      if (tab === 'saude-operacional' && typeof onSaudeOperacionalTabActivated === 'function') {
        onSaudeOperacionalTabActivated();
      }
      if (tab === 'relatorio-setorial' && typeof onRelatorioSetorialTabActivated === 'function') {
        onRelatorioSetorialTabActivated();
      }
      if (tab === 'avaliacao' && typeof onAvaliacaoTabActivated === 'function') {
        onAvaliacaoTabActivated();
      }
      if (tab === 'metas' && typeof onMetasTabActivated === 'function') onMetasTabActivated();
      if (tab === 'dashboard') {
        updateView();
      }

      // Refresh chart if chart canvas was resized/hidden
      if (tab === 'dashboard' && chart) {
        try { chart.resize(); } catch(e) { console.warn('[App] Erro ao redimensionar chart:', e); }
      }

      // Persist active tab
      try { appStorage.setItem('sistema_active_tab', tab); } catch(e) { console.warn('[App] Erro ao salvar aba:', e); }
    });

    const initialTab = tabBar.querySelector('.tab-btn.active');
    if (initialTab) updatePageContext(initialTab.getAttribute('data-tab'));

    // Presentation exit button
    const presExitBtn = document.getElementById('presentationExitBtn');
    if (presExitBtn) {
      presExitBtn.addEventListener('click', () => {
        presentationMode = false;
        if (presentationModeToggle) presentationModeToggle.checked = false;
        updateView();
        saveState();
      });
    }
  }

  // Restore last active tab
  try {
    const isColab = document.body.dataset.role === 'colaborador';
    if (isColab) {
      const { data: { user } } = await sbClient.auth.getUser();
      const csvNome = user?.user_metadata?.csv_nome;
      if (csvNome) {
        document.body.dataset.colabCsvNome = csvNome;
        document.body.dataset.colabCsvSetor = user?.user_metadata?.csv_setor || '';
        // Popula global filter bar com seletor de período
        const filterBar = document.getElementById('globalFilterBar');
        if (filterBar) {
          filterBar.innerHTML = `
            <div class="global-filter-inner">
              <div class="global-filter-row">
                <div class="global-filter-field" style="min-width:auto">
                  <span>Período</span>
                  <div style="display:flex;flex-wrap:wrap;gap:var(--s-1);align-items:center">
                    <div id="colabMonthChecklist" style="display:flex;flex-wrap:wrap;gap:4px"></div>
                  </div>
                </div>
                <div style="display:flex;gap:var(--s-1);align-items:flex-end;padding-bottom:2px">
                  <button class="btn-small" id="colabSelectAllBtn" type="button" style="font-size:11px">Todos</button>
                  <button class="btn-small" id="colabClearBtn" type="button" style="font-size:11px">Limpar</button>
                  <button class="btn-primary" id="colabFilterBtn" type="button" style="font-size:12px;padding:4px 16px;justify-content:center">Filtrar</button>
                </div>
              </div>
            </div>
          `;
        }
        // Abre dashboard tab e aplica filtros após carregar dados
        const waitForData = setInterval(() => {
          if (typeof rawRecords !== 'undefined' && rawRecords.length) {
            clearInterval(waitForData);
            if (atendenteSelect) {
              atendenteSelect.value = csvNome;
              atendenteSelect.disabled = true;
              atendenteSelect.style.opacity = '0.8';
            }
            if (setorSelect && user?.user_metadata?.csv_setor) {
              const setorVal = user.user_metadata.csv_setor;
              // Espera options carregarem
              setTimeout(() => {
                setorSelect.value = setorVal;
                setorSelect.disabled = true;
                setorSelect.style.opacity = '0.8';
                updateView();
              }, 500);
            }
            // Inicializa seletor de período (checkboxes + filtrar)
            const checklist = document.getElementById('colabMonthChecklist');
            if (checklist) {
              const meses = uniqueSorted(rawRecords.filter(r => String(r['Atendente']) === csvNome).map(r => r['Mês']));
              checklist.innerHTML = meses.map(m => `
<label style="font-size:12px;padding:3px 8px;border-radius:4px;border:1px solid var(--border);background:var(--bg-surface);cursor:pointer;display:flex;align-items:center;gap:4px;transition:all .15s">
  <input type="checkbox" class="colab-month-cb" value="${escapeHtml(m)}" style="margin:0"/>
  <span>${escapeHtml(m)}</span>
</label>`).join('');
              // Marca inicialmente todos
              checklist.querySelectorAll('.colab-month-cb').forEach(cb => { cb.checked = true; });
              selectedMonths = meses.slice();
              // Sincroniza globalFilters para syncGlobalState não resetar
              if (typeof globalFilters !== 'undefined' && globalFilters) {
                globalFilters.mesesSelecionados = meses.slice();
                globalFilters.periodo = '__multi__';
              }
            }
            document.getElementById('colabSelectAllBtn')?.addEventListener('click', () => {
              const meses = uniqueSorted(rawRecords.filter(r => String(r['Atendente']) === csvNome).map(r => r['Mês']));
              document.querySelectorAll('.colab-month-cb').forEach(cb => { cb.checked = true; });
              selectedMonths = meses.slice();
            });
            document.getElementById('colabClearBtn')?.addEventListener('click', () => {
              document.querySelectorAll('.colab-month-cb').forEach(cb => { cb.checked = false; });
              selectedMonths = [];
            });
            document.getElementById('colabFilterBtn')?.addEventListener('click', () => {
              const checked = document.querySelectorAll('.colab-month-cb:checked');
              if (!checked.length) {
                showToast('Selecione ao menos um mês para filtrar.', 'warn');
                return;
              }
              selectedMonths = [];
              checked.forEach(cb => { selectedMonths.push(cb.value); });
              if (typeof globalFilters !== 'undefined' && globalFilters) {
                globalFilters.mesesSelecionados = selectedMonths.slice();
                globalFilters.periodo = '__multi__';
              }
              updateView();
            });
            // Trava filtros no globalFilters para syncGlobalState não resetar
            if (typeof globalFilters !== 'undefined' && globalFilters) {
              globalFilters.setor = user?.user_metadata?.csv_setor || '';
              globalFilters.colaborador = csvNome;
            }
            updateView();
            const dashboardBtn = tabBar?.querySelector('.tab-btn[data-tab="dashboard"]');
            if (dashboardBtn) dashboardBtn.click();
          }
        }, 200);
        setTimeout(() => clearInterval(waitForData), 15000);
      } else {
        document.getElementById('appScreen')?.querySelector('.app')?.style.setProperty('display', 'none');
        const msg = document.createElement('div');
        msg.style.cssText = 'display:flex;align-items:center;justify-content:center;min-height:80vh;padding:20px;text-align:center';
        msg.innerHTML = '<div style="max-width:400px"><h2 style="font-size:20px;margin-bottom:8px">Acesso restrito ao painel</h2><p style="color:var(--text-secondary);font-size:14px">Use o formulário público em <a href="/reportlider" style="color:var(--primary)">/reportlider</a> para enviar suas mensagens.</p></div>';
        document.getElementById('appScreen')?.appendChild(msg);
      }
    } else {
      const savedTab = appStorage.getItem('sistema_active_tab');
      if (savedTab && savedTab !== 'dashboard') {
        const btn = tabBar && tabBar.querySelector(`.tab-btn[data-tab="${savedTab}"]`);
        if (btn) btn.click();
      }
    }
  } catch(e) { console.error('[App] Erro:', e); }

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

  // ===== Toggle Comparativos (dentro do Dashboard) =====
  const toggleCompBtn = document.getElementById('toggleComparativosBtn');
  if (toggleCompBtn) {
    toggleCompBtn.addEventListener('click', () => {
      const section = document.getElementById('comparativosDashboardSection');
      if (!section) return;
      const isHidden = section.style.display === 'none' || section.style.display === '';
      if (isHidden) {
        section.style.display = '';
        if (typeof renderComparativos === 'function') renderComparativos();
        toggleCompBtn.textContent = '📉 Fechar Comparativos';
      } else {
        section.style.display = 'none';
        toggleCompBtn.textContent = '📈 Comparativos';
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
        if (tab === 'home' && typeof onHomeTabActivated === 'function') onHomeTabActivated();
        else if (tab === 'dashboard') { updateView(); const compSec = document.getElementById('comparativosDashboardSection'); if (compSec && compSec.style.display !== 'none' && typeof renderComparativos === 'function') renderComparativos(); }
        else if (tab === 'metas' && typeof onMetasTabActivated === 'function') onMetasTabActivated();
        else if (tab === 'gamificacao' && typeof onGamificationTabActivated === 'function') { onGamificationTabActivated(); if (typeof onMetasTabActivated === 'function') onMetasTabActivated(); }
        else if (tab === 'colaboradores' && typeof renderColaboradores === 'function') renderColaboradores();
        else if (tab === 'lider' && typeof onLiderTabActivated === 'function') onLiderTabActivated();
        else if (tab === 'insights' && typeof onInsightsTabActivated === 'function') onInsightsTabActivated();
        else if (tab === 'relatorio-setorial' && typeof onRelatorioSetorialTabActivated === 'function') onRelatorioSetorialTabActivated();
        else if (tab === 'saude-operacional' && typeof onSaudeOperacionalTabActivated === 'function') onSaudeOperacionalTabActivated();
        else if (tab === 'avaliacao' && typeof onAvaliacaoTabActivated === 'function') onAvaliacaoTabActivated();
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
    } else {
      addToPendingSync(newRec);
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

// Legacy rendering bridge. Data ownership/status live in AppState.
window.addEventListener('records-sync-complete', () => {
  const state = AppState.get('records');
  if (!state || !AppDataSession.owner()) return;
  rawRecords = deduplicateRecords(normalizeAtendenteOnRecords(state.view));
  if (typeof invalidateGamificationCache === 'function') invalidateGamificationCache();
  populateFilters(rawRecords); updateFilterOptions(); updateView();
});
window.addEventListener('app-session-invalidated', () => {
  clearTimeout(__saveTimeout); rawRecords = []; previewRows = []; window.__lastReportText = '';
  document.body.dataset.role = '';
  document.querySelectorAll('dialog[open]').forEach(dialog => dialog.close());
  document.querySelectorAll('.colab-detail-overlay.open').forEach(overlay => overlay.classList.remove('open'));
  const screen = document.getElementById('appScreen'); if (screen) screen.style.display = 'none';
});
