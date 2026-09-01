// Filtros Globais Inteligentes — controlam todas as abas simultaneamente
// Módulo independente, não altera lógica existente
// Uso: globalFilters.apply(records) → dados filtrados

const GLOBAL_FILTERS_KEY = 'sistema_global_filters_v1';

// Normaliza nome para deduplicação: usa normalizeNameShared (helpers.js)
function _normalizeName(n) {
  return typeof normalizeNameShared === 'function' ? normalizeNameShared(n) : String(n || '').trim().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/\s*[^\p{L}\p{N}\s]\s*(?:multi[\s\-]?setor)?\s*$/ui, '').replace(/\s*(?:multi[\s\-]?setor)\s*$/i, '').replace(/[^\p{L}\p{N}\s]/gu, '').trim().toLowerCase();
}

function _nivelColaborador(nome) {
  try {
    const info = JSON.parse(localStorage.getItem('sistema_colaboradores_info_v1') || '{}');
    const alvo = _normalizeName(nome);
    const entry = Object.entries(info).find(([key]) => _normalizeName(key) === alvo);
    return String(entry?.[1]?.nivel || '').trim().toUpperCase();
  } catch (_) { return ''; }
}

const globalFilters = {
  periodo: 'all',
  colaborador: 'all',
  setor: 'all',
  nivel: 'all',
  pesquisa: '',
  mesesSelecionados: [],
  mesInicio: '',
  mesFim: '',
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

  correspondeNivel(record) {
    return !this.nivel || this.nivel === 'all' || _nivelColaborador(record?.['Atendente']) === this.nivel;
  },

  aplicar(records) {
    if (!records || !records.length) return records;
    let data = records;

    if (this.periodo && this.periodo !== 'all' && this.periodo !== '__multi__' && this.periodo !== '__range__') {
      data = data.filter(r => String(r['Mês']) === this.periodo);
    } else if (this.periodo === '__range__' && this.mesInicio && this.mesFim) {
      data = data.filter(r => String(r['Mês']) >= this.mesInicio && String(r['Mês']) <= this.mesFim);
    } else if (this.periodo === '__multi__' && Array.isArray(this.mesesSelecionados) && this.mesesSelecionados.length) {
      const set = new Set(this.mesesSelecionados.map(String));
      data = data.filter(r => set.has(String(r['Mês'])));
    }

    if (this.setor && this.setor !== 'all') {
      data = data.filter(r => String(r['Setor']) === this.setor);
    } else if (typeof isSetorActive === 'function') {
      data = data.filter(r => isSetorActive(String(r['Setor']).trim()));
    }

    if (this.nivel && this.nivel !== 'all') {
      data = data.filter(r => _nivelColaborador(r['Atendente']) === this.nivel);
    }

    if (this.colaborador && this.colaborador !== 'all') {
      data = data.filter(r => String(r['Atendente']) === this.colaborador);
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
        nivel: this.nivel,
        pesquisa: this.pesquisa,
        mesesSelecionados: this.mesesSelecionados,
        mesInicio: this.mesInicio,
        mesFim: this.mesFim
      };
      localStorage.setItem(GLOBAL_FILTERS_KEY, JSON.stringify(obj));
    } catch (e) { console.warn('[GlobalFilters] Erro:', e); }
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
    } catch (e) { console.warn('[GlobalFilters] Erro:', e); }
  },

  limpar() {
    this.periodo = 'all';
    this.colaborador = 'all';
    this.setor = 'all';
    this.nivel = 'all';
    this.pesquisa = '';
    this.mesesSelecionados = [];
    this.mesInicio = '';
    this.mesFim = '';
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
            <span>Período mensal</span>
            <select id="gfPeriodo"><option value="all">Todos</option></select>
          </label>
          <label class="global-filter-field">
            <span>Setor</span>
            <select id="gfSetor"><option value="all">Todos</option></select>
          </label>
          <label class="global-filter-field">
            <span>Nível</span>
            <select id="gfNivel"><option value="all">Todos</option></select>
          </label>
          <label class="global-filter-field global-filter-field--flex" style="min-width:180px">
            <span>Colaborador / Busca</span>
            <input type="text" id="gfPesquisa" placeholder="Digite um nome ou busque..." list="gfColabList" autocomplete="off" style="padding:6px 10px;font-size:12px"/>
            <datalist id="gfColabList"></datalist>
          </label>
          <div style="display:flex;align-items:flex-end;padding-bottom:2px;gap:4px">
            <button class="btn-small" id="gfApplyBtn" type="button" style="padding:6px 12px;font-size:12px">Filtrar</button>
            <button class="btn-small" id="gfClearBtn" type="button" style="padding:6px 12px;font-size:12px">Limpar</button>
          </div>
        </div>
        <div id="gfMonthRange" class="global-filter-multi global-filter-range" style="display:none">
          <div class="multi-label">Intervalo mensal:</div>
          <label class="global-filter-field"><span>De</span><select id="gfMonthStart"></select></label>
          <label class="global-filter-field"><span>Até</span><select id="gfMonthEnd"></select></label>
          <div class="multi-actions"><button type="button" class="btn-small gf-range-shortcut" data-months="3">Últimos 3 meses</button><button type="button" class="btn-small gf-range-shortcut" data-months="6">Últimos 6 meses</button><button type="button" class="btn-small gf-range-shortcut" data-months="12">Últimos 12 meses</button></div>
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
        const multiPanel = document.getElementById('gfMonthMulti');
        const rangePanel = document.getElementById('gfMonthRange');
        if (multiPanel) multiPanel.style.display = periodo.value === '__multi__' ? '' : 'none';
        if (rangePanel) rangePanel.style.display = periodo.value === '__range__' ? '' : 'none';
        if (periodo.value !== '__multi__') this.mesesSelecionados = [];
      });
    }

    document.querySelectorAll('.gf-range-shortcut').forEach(button => button.addEventListener('click', () => {
      const options = [...(document.getElementById('gfMonthEnd')?.options || [])].map(o => o.value).filter(Boolean);
      if (!options.length) return;
      const count = Number(button.dataset.months || 3);
      const end = options[options.length - 1];
      const start = options[Math.max(0, options.length - count)];
      document.getElementById('gfPeriodo').value = '__range__';
      document.getElementById('gfMonthStart').value = start;
      document.getElementById('gfMonthEnd').value = end;
      this._collectAndNotify();
    }));

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
    const nivel = document.getElementById('gfNivel');
    if (setor) {
      setor.addEventListener('change', () => this._updateColaboradorOptions());
    }
    if (nivel) {
      nivel.addEventListener('change', () => this._updateColaboradorOptions());
    }
  },

  _collectAndNotify() {
    const periodo = document.getElementById('gfPeriodo');
    const setor = document.getElementById('gfSetor');
    const pesq = document.getElementById('gfPesquisa');
    const nivel = document.getElementById('gfNivel');

    this.periodo = periodo ? periodo.value : 'all';
    this.setor = setor ? setor.value : 'all';
    this.nivel = nivel ? nivel.value : 'all';
    this.mesInicio = document.getElementById('gfMonthStart')?.value || '';
    this.mesFim = document.getElementById('gfMonthEnd')?.value || '';
    if (this.periodo === '__range__' && this.mesInicio > this.mesFim) {
      const temp = this.mesInicio; this.mesInicio = this.mesFim; this.mesFim = temp;
    }

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
    setVal('gfNivel', this.nivel);
    setVal('gfMonthStart', this.mesInicio);
    setVal('gfMonthEnd', this.mesFim);

    const pesq = document.getElementById('gfPesquisa');
    if (pesq) {
      pesq.value = this.colaborador !== 'all' ? this.colaborador : this.pesquisa;
    }

    const rangePanel = document.getElementById('gfMonthRange');
    if (rangePanel) rangePanel.style.display = this.periodo === '__range__' ? '' : 'none';
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
      } else if (this.periodo === '__range__') {
        parts.push(`Período: ${this.mesInicio || '—'} até ${this.mesFim || '—'}`);
      } else {
        parts.push(`Período: ${this.periodo}`);
      }
    }
    if (this.setor && this.setor !== 'all') parts.push(`Setor: ${this.setor}`);
    if (this.nivel && this.nivel !== 'all') parts.push(`Nível: ${this.nivel}`);
    if (this.colaborador && this.colaborador !== 'all') parts.push(`Colab: ${this.colaborador}`);
    if (this.pesquisa) parts.push(`Busca: ${this.pesquisa}`);
    chips.innerHTML = parts.length
      ? parts.map(p => `<span class="chip">${p}</span>`).join(' ')
      : '<span style="font-size:11px;color:var(--text-muted)">Nenhum filtro global ativo</span>';
  },

  _updateColaboradorOptions() {
    const setorEl = document.getElementById('gfSetor');
    if (!setorEl) return;
    const setorVal = setorEl.value;
    const nivelVal = document.getElementById('gfNivel')?.value || this.nivel || 'all';

    let activeMonths = null;
    if (this.periodo && this.periodo !== 'all' && this.periodo !== '__multi__' && this.periodo !== '__range__') {
      activeMonths = [this.periodo];
    } else if (this.periodo === '__range__' && this.mesInicio && this.mesFim) {
      activeMonths = [...new Set((rawRecords || []).map(r => String(r['Mês'] || '')).filter(m => m >= this.mesInicio && m <= this.mesFim))];
    } else if (this.periodo === '__multi__' && Array.isArray(this.mesesSelecionados) && this.mesesSelecionados.length) {
      activeMonths = this.mesesSelecionados;
    }

    let nameMap = new Map();
    const raw = rawRecords || [];
    for (const r of raw) {
      if (!r || !r['Atendente']) continue;
      if (setorVal !== 'all' && String(r['Setor']) !== setorVal) continue;
      if (nivelVal !== 'all' && _nivelColaborador(r['Atendente']) !== nivelVal) continue;
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
      if (opts && opts.includeRange) html += '<option value="__range__">Intervalo de meses</option>';
      if (opts && opts.includeMulti) html += '<option value="__multi__">Meses específicos (avançado)</option>';
      html += vals.map(v => `<option value="${String(v).replace(/"/g, '&quot;')}">${String(v).replace(/"/g, '&quot;')}</option>`).join('');
      sel.innerHTML = html;
      if (current && [...sel.options].some(o => o.value === current)) sel.value = current;
    };

    fill('gfPeriodo', meses, { includeRange: true, includeMulti: true });
    const monthOptions = meses.map(m => `<option value="${String(m).replace(/"/g, '&quot;')}">${String(m).replace(/"/g, '&quot;')}</option>`).join('');
    const rangeStart = document.getElementById('gfMonthStart');
    const rangeEnd = document.getElementById('gfMonthEnd');
    if (rangeStart) rangeStart.innerHTML = monthOptions;
    if (rangeEnd) rangeEnd.innerHTML = monthOptions;
    if (!this.mesInicio && meses.length) this.mesInicio = meses[Math.max(0, meses.length - 5)];
    if (!this.mesFim && meses.length) this.mesFim = meses[meses.length - 1];
    if (rangeStart) rangeStart.value = this.mesInicio;
    if (rangeEnd) rangeEnd.value = this.mesFim;
    fill('gfSetor', filteredSetores);
    let niveis = [];
    try {
      const info = JSON.parse(localStorage.getItem('sistema_colaboradores_info_v1') || '{}');
      niveis = [...new Set(Object.values(info).map(item => String(item?.nivel || '').trim().toUpperCase()).filter(Boolean))].sort();
    } catch (_) {}
    fill('gfNivel', niveis);
    this._updateColaboradorOptions();

    const checkList = document.getElementById('gfMonthChecklist');
    if (checkList) {
      checkList.innerHTML = meses.map(m =>
        `<label class="month-option"><input type="checkbox" value="${String(m).replace(/"/g, '&quot;')}"> ${String(m).replace(/"/g, '&quot;')}</label>`
      ).join('');
    }

    const rangePanel = document.getElementById('gfMonthRange');
    if (rangePanel) rangePanel.style.display = this.periodo === '__range__' ? '' : 'none';
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
