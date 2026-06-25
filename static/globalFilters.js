// Filtros Globais Inteligentes — controlam todas as abas simultaneamente
// Módulo independente, não altera lógica existente
// Uso: globalFilters.apply(records) → dados filtrados

const GLOBAL_FILTERS_KEY = 'sistema_global_filters_v1';

// Normaliza nome para deduplicação: trim + lowercase + remove acentos + remove tags/símbolos
function _normalizeName(n) {
  return String(n || '').trim()
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .replace(/\s*[^\p{L}\p{N}\s]\s*(?:multi[\s\-]?setor)?\s*$/ui, '')
    .replace(/\s*(?:multi[\s\-]?setor)\s*$/i, '')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .trim()
    .toLowerCase();
}

const globalFilters = {
  periodo: 'all',
  colaborador: 'all',
  setor: 'all',
  scoreMinimo: 0,
  pesquisa: '',
  mesesSelecionados: [],
  _colabNames: [],

  _listeners: [],

  init() {
    this._renderBar();
    this._bindEvents();
    this.limpar();
  },

  onChange(cb) {
    this._listeners.push(cb);
  },

  _notify() {
    this._salvar();
    this._updateChips();
    this._listeners.forEach(cb => { try { cb(); } catch (e) {} });
  },

  aplicar(records) {
    if (!records || !records.length) return records;
    let data = records;

    if (this.periodo && this.periodo !== 'all' && this.periodo !== '__multi__') {
      data = data.filter(r => String(r['Mês']) === this.periodo);
    } else if (this.periodo === '__multi__' && Array.isArray(this.mesesSelecionados) && this.mesesSelecionados.length) {
      const set = new Set(this.mesesSelecionados.map(String));
      data = data.filter(r => set.has(String(r['Mês'])));
    }

    if (this.setor && this.setor !== 'all') {
      data = data.filter(r => String(r['Setor']) === this.setor);
    } else if (typeof isSetorActive === 'function') {
      data = data.filter(r => isSetorActive(String(r['Setor']).trim()));
    }

    if (this.colaborador && this.colaborador !== 'all') {
      data = data.filter(r => String(r['Atendente']) === this.colaborador);
    }

    if (this.scoreMinimo > 0) {
      data = data.filter(r => {
        const sc = r['SCORE'];
        return sc !== null && sc !== undefined && !isNaN(Number(sc)) && Number(sc) >= this.scoreMinimo;
      });
    }

    if (this.pesquisa) {
      const q = String(this.pesquisa).toLowerCase();
      data = data.filter(r => {
        const cols = [r['Atendente'], r['Setor'], r['Mês'], r['Arquivo']];
        return cols.some(v => String(v || '').toLowerCase().includes(q));
      });
    }

    return data;
  },

  _salvar() {
    try {
      const obj = {
        periodo: this.periodo,
        colaborador: this.colaborador,
        setor: this.setor,
        scoreMinimo: this.scoreMinimo,
        pesquisa: this.pesquisa,
        mesesSelecionados: this.mesesSelecionados
      };
      localStorage.setItem(GLOBAL_FILTERS_KEY, JSON.stringify(obj));
    } catch (e) {}
  },

  carregar() {
    try {
      const raw = localStorage.getItem(GLOBAL_FILTERS_KEY);
      if (raw) {
        const obj = JSON.parse(raw);
        Object.keys(obj).forEach(k => {
          if (k in this) this[k] = obj[k];
        });
      }
    } catch (e) {}
  },

  limpar() {
    this.periodo = 'all';
    this.colaborador = 'all';
    this.setor = 'all';
    this.scoreMinimo = 0;
    this.pesquisa = '';
    this.mesesSelecionados = [];
    this._syncUI();
    this._notify();
  },

  _renderBar() {
    const container = document.getElementById('globalFilterBar');
    if (!container) return;
    if (container.dataset.rendered) return;
    container.dataset.rendered = '1';

    container.innerHTML = `
      <div class="global-filter-inner">
        <div class="global-filter-row">
          <label class="global-filter-field">
            <span>Período</span>
            <select id="gfPeriodo"><option value="all">Todos</option></select>
          </label>
          <label class="global-filter-field">
            <span>Setor</span>
            <select id="gfSetor"><option value="all">Todos</option></select>
          </label>
          <label class="global-filter-field">
            <span>Score mín.</span>
            <select id="gfScoreMinimo">
              <option value="0">0</option>
              <option value="3.0">3.0</option>
              <option value="3.5">3.5</option>
              <option value="4.0">4.0</option>
              <option value="4.5">4.5</option>
            </select>
          </label>
          <label class="global-filter-field" style="flex:1;min-width:180px">
            <span>Colaborador / Busca</span>
            <input type="text" id="gfPesquisa" placeholder="Digite um nome ou busque..." list="gfColabList" autocomplete="off" style="padding:6px 10px;font-size:12px"/>
            <datalist id="gfColabList"></datalist>
          </label>
          <div style="display:flex;align-items:flex-end;padding-bottom:2px;gap:4px">
            <button class="btn-small" id="gfApplyBtn" type="button" style="padding:6px 12px;font-size:12px">Filtrar</button>
            <button class="btn-small" id="gfClearBtn" type="button" style="padding:6px 12px;font-size:12px">Limpar</button>
          </div>
        </div>
        <div id="gfMonthMulti" class="global-filter-multi" style="display:none">
          <div class="multi-label">Selecione os meses desejados:</div>
          <div class="multi-actions">
            <button type="button" class="btn-small" id="gfSelectAllMonths">Selecionar tudo</button>
            <button type="button" class="btn-small" id="gfClearMonths">Limpar</button>
          </div>
          <div id="gfMonthChecklist" class="month-checklist"></div>
        </div>
        <div id="globalFilterChips" class="global-filter-chips"></div>
      </div>
    `;
  },

  _bindEvents() {
    const applyBtn = document.getElementById('gfApplyBtn');
    const clearBtn = document.getElementById('gfClearBtn');

    if (applyBtn) applyBtn.addEventListener('click', () => this._collectAndNotify());
    if (clearBtn) clearBtn.addEventListener('click', () => this.limpar());

    const pesquisa = document.getElementById('gfPesquisa');
    if (pesquisa) {
      pesquisa.addEventListener('keydown', (e) => { if (e.key === 'Enter') this._collectAndNotify(); });
    }

    const periodo = document.getElementById('gfPeriodo');
    if (periodo) {
      periodo.addEventListener('change', () => {
        const panel = document.getElementById('gfMonthMulti');
        if (panel) panel.style.display = periodo.value === '__multi__' ? '' : 'none';
        if (periodo.value !== '__multi__' && periodo.value !== 'all') {
          this.mesesSelecionados = [];
        }
      });
    }

    const selAll = document.getElementById('gfSelectAllMonths');
    const clearM = document.getElementById('gfClearMonths');
    if (selAll) selAll.addEventListener('click', () => {
      const checks = document.querySelectorAll('#gfMonthChecklist input[type="checkbox"]');
      const meses = [];
      checks.forEach(cb => { cb.checked = true; meses.push(cb.value); });
      this.mesesSelecionados = meses;
      this._updateChips();
    });
    if (clearM) clearM.addEventListener('click', () => {
      document.querySelectorAll('#gfMonthChecklist input[type="checkbox"]').forEach(cb => cb.checked = false);
      this.mesesSelecionados = [];
      this._updateChips();
    });

    const checkList = document.getElementById('gfMonthChecklist');
    if (checkList) {
      checkList.addEventListener('change', (e) => {
        if (e.target && e.target.type === 'checkbox') {
          this.mesesSelecionados = [];
          document.querySelectorAll('#gfMonthChecklist input[type="checkbox"]:checked').forEach(cb => {
            this.mesesSelecionados.push(cb.value);
          });
          this._updateChips();
        }
      });
    }

    const periodoEl = document.getElementById('gfPeriodo');
    if (periodoEl) {
      periodoEl.addEventListener('change', () => this._updateColaboradorOptions());
    }
    const setor = document.getElementById('gfSetor');
    if (setor) {
      setor.addEventListener('change', () => this._updateColaboradorOptions());
    }
  },

  _collectAndNotify() {
    const periodo = document.getElementById('gfPeriodo');
    const setor = document.getElementById('gfSetor');
    const score = document.getElementById('gfScoreMinimo');
    const pesq = document.getElementById('gfPesquisa');

    this.periodo = periodo ? periodo.value : 'all';
    this.setor = setor ? setor.value : 'all';
    this.scoreMinimo = score ? parseFloat(score.value) : 0;

    const q = pesq ? pesq.value.trim() : '';
    if (q && this._colabNames.some(n => n.toLowerCase() === q.toLowerCase())) {
      this.colaborador = q;
      this.pesquisa = '';
    } else {
      this.colaborador = 'all';
      this.pesquisa = q;
    }

    if (this.periodo === '__multi__') {
      this.mesesSelecionados = [];
      document.querySelectorAll('#gfMonthChecklist input[type="checkbox"]:checked').forEach(cb => {
        this.mesesSelecionados.push(cb.value);
      });
    } else {
      this.mesesSelecionados = [];
    }

    this._notify();
  },

  _syncUI() {
    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) {
        if (el.type === 'checkbox') el.checked = !!val;
        else el.value = String(val);
      }
    };
    setVal('gfPeriodo', this.periodo);
    setVal('gfSetor', this.setor);
    setVal('gfScoreMinimo', String(this.scoreMinimo));

    const pesq = document.getElementById('gfPesquisa');
    if (pesq) {
      pesq.value = this.colaborador !== 'all' ? this.colaborador : this.pesquisa;
    }

    const panel = document.getElementById('gfMonthMulti');
    if (panel) panel.style.display = this.periodo === '__multi__' ? '' : 'none';
    if (this.periodo === '__multi__') {
      const checks = document.querySelectorAll('#gfMonthChecklist input[type="checkbox"]');
      const set = new Set((this.mesesSelecionados || []).map(String));
      checks.forEach(cb => { cb.checked = set.has(cb.value); });
    }
  },

  _updateChips() {
    const chips = document.getElementById('globalFilterChips');
    if (!chips) return;
    const parts = [];
    if (this.periodo && this.periodo !== 'all') {
      if (this.periodo === '__multi__') {
        const sel = Array.isArray(this.mesesSelecionados) ? this.mesesSelecionados : [];
        parts.push(`Período: ${sel.length ? sel.slice().sort().join(', ') : 'Nenhum'}`);
      } else {
        parts.push(`Período: ${this.periodo}`);
      }
    }
    if (this.setor && this.setor !== 'all') parts.push(`Setor: ${this.setor}`);
    if (this.colaborador && this.colaborador !== 'all') parts.push(`Colab: ${this.colaborador}`);
    if (this.scoreMinimo > 0) parts.push(`Score ≥ ${this.scoreMinimo}`);
    if (this.pesquisa) parts.push(`Busca: ${this.pesquisa}`);
    chips.innerHTML = parts.length
      ? parts.map(p => `<span class="chip">${p}</span>`).join(' ')
      : '<span style="font-size:11px;color:var(--text-muted)">Nenhum filtro global ativo</span>';
  },

  _updateColaboradorOptions() {
    const setorEl = document.getElementById('gfSetor');
    if (!setorEl) return;
    const setorVal = setorEl.value;

    let activeMonths = null;
    if (this.periodo && this.periodo !== 'all' && this.periodo !== '__multi__') {
      activeMonths = [this.periodo];
    } else if (this.periodo === '__multi__' && Array.isArray(this.mesesSelecionados) && this.mesesSelecionados.length) {
      activeMonths = this.mesesSelecionados;
    }

    let nameMap = new Map();
    const raw = rawRecords || [];
    for (const r of raw) {
      if (!r || !r['Atendente']) continue;
      if (setorVal !== 'all' && String(r['Setor']) !== setorVal) continue;
      if (activeMonths && !activeMonths.includes(String(r['Mês']))) continue;
      const orig = String(r['Atendente']).trim();
      const key = _normalizeName(orig);
      if (!nameMap.has(key)) nameMap.set(key, orig);
    }
    let cols = Array.from(nameMap.values()).sort();
    if (typeof isColabActive === 'function') {
      cols = cols.filter(c => isColabActive(c));
    }
    this._colabNames = cols;

    const dataList = document.getElementById('gfColabList');
    if (dataList) {
      dataList.innerHTML = cols.map(v =>
        `<option value="${String(v).replace(/"/g, '&quot;')}">`
      ).join('');
    }
  },

  popularOptions() {
    if (!rawRecords || !rawRecords.length) return;
    const meses = [...new Set(rawRecords.filter(r => r && r['Mês']).map(r => r['Mês']))].sort();
    const setores = [...new Set(rawRecords.filter(r => r && r['Setor']).map(r => r['Setor']))].sort();
    const filteredSetores = typeof isSetorActive === 'function' ? setores.filter(s => isSetorActive(s)) : setores;

    const fill = (id, vals, opts) => {
      const sel = document.getElementById(id);
      if (!sel) return;
      const current = sel.value;
      let html = '<option value="all">Todos</option>';
      if (opts && opts.includeMulti) html += '<option value="__multi__">Seleção múltipla</option>';
      html += vals.map(v => `<option value="${String(v).replace(/"/g, '&quot;')}">${String(v).replace(/"/g, '&quot;')}</option>`).join('');
      sel.innerHTML = html;
      if (current && [...sel.options].some(o => o.value === current)) sel.value = current;
    };

    fill('gfPeriodo', meses, { includeMulti: true });
    fill('gfSetor', filteredSetores);
    this._updateColaboradorOptions();

    const checkList = document.getElementById('gfMonthChecklist');
    if (checkList) {
      checkList.innerHTML = meses.map(m =>
        `<label class="month-option"><input type="checkbox" value="${String(m).replace(/"/g, '&quot;')}"> ${String(m).replace(/"/g, '&quot;')}</label>`
      ).join('');
    }

    const panel = document.getElementById('gfMonthMulti');
    if (panel) panel.style.display = this.periodo === '__multi__' ? '' : 'none';
    if (this.periodo === '__multi__' && Array.isArray(this.mesesSelecionados)) {
      const set = new Set(this.mesesSelecionados.map(String));
      document.querySelectorAll('#gfMonthChecklist input[type="checkbox"]').forEach(cb => {
        cb.checked = set.has(cb.value);
      });
    }
  }
};

// ===== Função global de classificação de score =====
// 🟢 >= 4.70 Excelente (meta) | 🟡 4.50–4.69 Atenção | 🔴 < 4.50 Crítico
function getClasseScore(score) {
  if (score === null || score === undefined || isNaN(Number(score))) {
    return 'score-neutro';
  }
  const n = Number(score);
  if (n < 4.50) return 'score-critico';
  if (n < 4.70) return 'score-atencao';
  return 'score-excelente';
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => globalFilters.init());
} else {
  globalFilters.init();
}
