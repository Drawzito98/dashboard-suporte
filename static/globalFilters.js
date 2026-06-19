// Filtros Globais Inteligentes — controlam todas as abas simultaneamente
// Módulo independente, não altera lógica existente
// Uso: globalFilters.apply(records) → dados filtrados

const GLOBAL_FILTERS_KEY = 'sistema_global_filters_v1';

const globalFilters = {
  periodo: 'all',
  colaborador: 'all',
  setor: 'all',
  scoreMinimo: 0,
  metaAtingida: 'all',
  favoritos: false,
  pesquisa: '',
  mesesSelecionados: [],

  _listeners: [],

  init() {
    this.carregar();
    this._renderBar();
    this._bindEvents();
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

    if (this.metaAtingida === 'sim') {
      data = data.filter(r => {
        const obj = parseInt(r['Objetivo']) || 0;
        const fin = parseInt(r['Finalizados']) || 0;
        return obj > 0 && fin >= obj;
      });
    } else if (this.metaAtingida === 'nao') {
      data = data.filter(r => {
        const obj = parseInt(r['Objetivo']) || 0;
        const fin = parseInt(r['Finalizados']) || 0;
        return obj > 0 && fin < obj;
      });
    }

    if (this.favoritos && window.__favoriteColabs && window.__favoriteColabs.size) {
      data = data.filter(r => window.__favoriteColabs.has(String(r['Atendente'])));
    }

    if (this.pesquisa) {
      const q = String(this.pesquisa).toLowerCase();
      data = data.filter(r => String(r['Atendente'] || '').toLowerCase().includes(q));
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
        metaAtingida: this.metaAtingida,
        favoritos: this.favoritos,
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
    this.metaAtingida = 'all';
    this.favoritos = false;
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
            <span>Colaborador</span>
            <select id="gfColaborador"><option value="all">Todos</option></select>
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
          <label class="global-filter-field">
            <span>Meta</span>
            <select id="gfMetaAtingida">
              <option value="all">Todas</option>
              <option value="sim">Atingida</option>
              <option value="nao">Não atingida</option>
            </select>
          </label>
          <label class="global-filter-field" style="flex-direction:row;align-items:center;gap:6px;padding-top:18px">
            <input type="checkbox" id="gfFavoritos" style="accent-color:var(--accent)"/>
            <span style="font-size:12px;font-weight:500;color:var(--text-secondary)">⭐ Favoritos</span>
          </label>
          <label class="global-filter-field" style="flex:1;min-width:150px">
            <span>Buscar</span>
            <input type="text" id="gfPesquisa" placeholder="Nome..." style="padding:6px 10px;font-size:12px"/>
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

    const setor = document.getElementById('gfSetor');
    if (setor) {
      setor.addEventListener('change', () => this._updateColaboradorOptions());
    }
  },

  _collectAndNotify() {
    const periodo = document.getElementById('gfPeriodo');
    const setor = document.getElementById('gfSetor');
    const colab = document.getElementById('gfColaborador');
    const score = document.getElementById('gfScoreMinimo');
    const meta = document.getElementById('gfMetaAtingida');
    const fav = document.getElementById('gfFavoritos');
    const pesq = document.getElementById('gfPesquisa');

    this.periodo = periodo ? periodo.value : 'all';
    this.setor = setor ? setor.value : 'all';
    this.colaborador = colab ? colab.value : 'all';
    this.scoreMinimo = score ? parseFloat(score.value) : 0;
    this.metaAtingida = meta ? meta.value : 'all';
    this.favoritos = fav ? fav.checked : false;
    this.pesquisa = pesq ? pesq.value.trim() : '';

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
    setVal('gfColaborador', this.colaborador);
    setVal('gfScoreMinimo', String(this.scoreMinimo));
    setVal('gfMetaAtingida', this.metaAtingida);
    setVal('gfFavoritos', this.favoritos);
    setVal('gfPesquisa', this.pesquisa);

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
    if (this.metaAtingida !== 'all') parts.push(`Meta: ${this.metaAtingida === 'sim' ? '✅' : '❌'}`);
    if (this.favoritos) parts.push('⭐ Favoritos');
    if (this.pesquisa) parts.push(`Busca: ${this.pesquisa}`);
    chips.innerHTML = parts.length
      ? parts.map(p => `<span class="chip">${p}</span>`).join(' ')
      : '<span style="font-size:11px;color:var(--text-muted)">Nenhum filtro global ativo</span>';
  },

  _updateColaboradorOptions() {
    const colab = document.getElementById('gfColaborador');
    const setorEl = document.getElementById('gfSetor');
    if (!colab || !setorEl) return;
    const setorVal = setorEl.value;
    let cols;
    if (setorVal === 'all' || !rawRecords || !rawRecords.length) {
      cols = [...new Set((rawRecords || []).filter(r => r && r['Atendente']).map(r => r['Atendente']))].sort();
    } else {
      cols = [...new Set(rawRecords.filter(r => r && r['Atendente'] && String(r['Setor']) === setorVal).map(r => r['Atendente']))].sort();
    }
    const current = colab.value;
    colab.innerHTML = '<option value="all">Todos</option>' + cols.map(v =>
      `<option value="${String(v).replace(/"/g, '&quot;')}">${String(v).replace(/"/g, '&quot;')}</option>`
    ).join('');
    if (current && [...colab.options].some(o => o.value === current)) {
      colab.value = current;
    } else {
      colab.value = 'all';
    }
  },

  popularOptions() {
    if (!rawRecords || !rawRecords.length) return;
    const meses = [...new Set(rawRecords.filter(r => r && r['Mês']).map(r => r['Mês']))].sort();
    const setores = [...new Set(rawRecords.filter(r => r && r['Setor']).map(r => r['Setor']))].sort();

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
    fill('gfSetor', setores);
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
// 🟢 >= 4.75 Excelente | 🟡 4.70–4.74 Atenção | 🔴 < 4.70 Crítico
function getClasseScore(score) {
  if (score === null || score === undefined || isNaN(Number(score))) {
    return 'score-neutro';
  }
  const n = Number(score);
  if (n < 4.70) return 'score-critico';
  if (n < 4.75) return 'score-atencao';
  return 'score-excelente';
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => globalFilters.init());
} else {
  globalFilters.init();
}
