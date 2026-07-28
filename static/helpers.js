// helpers.js — Funções compartilhadas para evitar duplicação entre módulos

// ─── Normalização de nomes ────────────────────────────────────────
// Substitui _normalizeName (globalFilters.js), _normName (app.js), normalizeNameForDedup (app.js)
function normalizeNameShared(n) {
  try {
    return String(n || '').trim()
      .normalize('NFD').replace(/\p{Diacritic}/gu, '')
      .replace(/\s*[^\p{L}\p{N}\s]\s*(?:multi[\s\-]?setor)?\s*$/ui, '')
      .replace(/\s*(?:multi[\s\-]?setor)\s*$/i, '')
      .replace(/[^\p{L}\p{N}\s]/gu, '')
      .trim()
      .toLowerCase();
  } catch (e) {
    return String(n || '').toLowerCase().replace(/\s+/g, ' ').trim();
  }
}

// ─── Helpers de data ──────────────────────────────────────────────
// Substitui hoje() duplicado em anotacoes.js e tarefas.js
function hojeShared() {
  return new Date().toISOString().slice(0, 10);
}

// Substitui formatarData() duplicado em anotacoes.js e tarefas.js
function formatarDataShared(dataStr) {
  if (!dataStr) return '';
  const [ano, mes, dia] = dataStr.split('-');
  return `${dia}/${mes}/${ano}`;
}

// ─── Dados filtrados ──────────────────────────────────────────────
// Substitui _gfData(), _fbData(), _liderData(), _rsData() e ~12 expressões inline
function getDataFiltered() {
  if (typeof globalFilters !== 'undefined' && globalFilters) {
    return globalFilters.aplicar(rawRecords);
  }
  return (rawRecords || []);
}

// ─── Escape HTML ──────────────────────────────────────────────────
// Substitui escapeHtml() de dom-helpers.js (mantém compatibilidade)
// Nota: dom-helpers.js já define escapeHtml; esta é uma referência para uso direto
function escapeHtmlShared(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ─── Empty state HTML ─────────────────────────────────────────────
// Substitui 15 ocorrências de empty-state HTML repetido
function emptyStateHtml(title, subtitle) {
  return `<div class="empty-state"><div class="empty-title">${escapeHtmlShared(title)}</div>${subtitle ? `<div class="empty-sub">${escapeHtmlShared(subtitle)}</div>` : ''}</div>`;
}

// ─── Chaves de localStorage centralizadas ─────────────────────────
const STORAGE_KEYS = {
  metas: 'sistema_metas_v1',
  comentarios: 'sistema_comentarios_v1',
  historico: 'sistema_historico_v1',
  scoring: 'sistema_scoring_rules_v1',
  alertas: 'sistema_alertas_config_v1',
  fotos: 'sistema_colab_fotos_v1',
  inativos: 'sistema_colab_inativos_v1',
  setorInativos: 'sistema_setor_inativos_v1',
  feedbacks: 'sistema_feedbacks_v1',
  anotacoes: 'sistema_anotacoes_diarias_v1',
  tarefas: 'sistema_tarefas_v1',
  pontosExtras: 'sistema_pontos_extras_v1',
  colabInfo: 'sistema_colaboradores_info_v1',
  avaliacoes: 'sistema_avaliacoes_v1',
  globalFilters: 'sistema_global_filters_v1',
};

// ─── Helpers de DOM seguros ───────────────────────────────────────
function $(sel, root) { return (root || document).querySelector(sel); }
function $$(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }

// Adiciona evento somente se elemento existir (evita null.addEventListener)
function safeOn(el, event, handler) {
  if (el) el.addEventListener(event, handler);
}
