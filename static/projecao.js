// Projeção Mensal — adicionar resultados previstos para meses futuros
function openProjecaoOverlay() {
  const overlay = document.getElementById('projecaoOverlay');
  if (!overlay) return;
  overlay.classList.add('open');
  renderProjecao();
}

function closeProjecao() {
  const overlay = document.getElementById('projecaoOverlay');
  if (overlay) overlay.classList.remove('open');
}

function renderProjecao() {
  const container = document.getElementById('projecaoContent');
  if (!container) return;
  const data = typeof globalFilters !== 'undefined' && globalFilters ? globalFilters.aplicar(rawRecords) : (rawRecords || []);
  const names = [...new Set((data || []).filter(r => r && r['Atendente'] && !isAggregateName(r['Atendente'])).map(r => r['Atendente']))].sort();
  const setores = [...new Set((data || []).filter(r => r && r['Setor']).map(r => r['Setor']))].sort();
  const months = [...new Set((data || []).filter(r => r && r['Mês']).map(r => r['Mês']))].sort();
  const lastMonth = months.length ? months[months.length - 1] : '';

  // Suggest next month
  const nextMonth = suggestNextMonth(months);

  // Build setor map for each collaborator (use most recent setor)
  const colabSetor = {};
  (data || []).filter(r => r && r['Atendente'] && r['Setor']).forEach(r => {
    colabSetor[r['Atendente']] = r['Setor'];
  });

  // Last month data for copy
  const lastMonthData = {};
  if (lastMonth) {
    (data || []).filter(r => r && r['Mês'] === lastMonth).forEach(r => {
      const n = r['Atendente'];
      if (!lastMonthData[n]) lastMonthData[n] = {};
      lastMonthData[n] = {
        Assumidos: parseInt(r['Assumidos']) || 0,
        Finalizados: parseInt(r['Finalizados']) || 0,
        Transferidos: parseInt(r['Transferidos']) || 0,
        SCORE: r['SCORE'] !== null && r['SCORE'] !== undefined ? Number(r['SCORE']) : '',
        Objetivo: parseInt(r['Objetivo']) || 0,
        Setor: r['Setor'] || ''
      };
    });
  }

  let html = `
    <div style="padding:var(--s-5)">
      <h2 style="font-size:18px;font-weight:700;margin-bottom:var(--s-1)">📅 Projeção Mensal</h2>
      <p style="font-size:13px;color:var(--text-secondary);margin-bottom:var(--s-4)">Adicione resultados previstos para colaboradores em um novo mês.</p>

      <div style="display:flex;gap:var(--s-3);margin-bottom:var(--s-4);flex-wrap:wrap;align-items:end">
        <label class="field" style="flex:1;min-width:180px">
          <span>Mês de referência</span>
          <input type="month" id="projecaoMes" value="${nextMonth}" style="width:100%"/>
        </label>
        <label class="field" style="flex:1;min-width:180px">
          <span>Setor (opcional)</span>
          <select id="projecaoSetor" style="width:100%">
            <option value="">Todos os setores</option>
            ${setores.map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('')}
          </select>
        </label>
        <button class="btn-small" id="projecaoCopyBtn" type="button" ${lastMonth ? '' : 'disabled'}>
          📋 Copiar do mês anterior
        </button>
      </div>

      <div style="overflow-x:auto;max-height:55vh;overflow-y:auto;border:1px solid var(--border);border-radius:var(--r-md)">
        <table class="ranking-table" style="min-width:700px">
          <thead>
            <tr>
              <th style="position:sticky;top:0;background:var(--bg-elevated);z-index:1">Colaborador</th>
              <th style="position:sticky;top:0;background:var(--bg-elevated);z-index:1">Setor</th>
              <th style="position:sticky;top:0;background:var(--bg-elevated);z-index:1">Assumidos</th>
              <th style="position:sticky;top:0;background:var(--bg-elevated);z-index:1">Finalizados</th>
              <th style="position:sticky;top:0;background:var(--bg-elevated);z-index:1">Transferidos</th>
              <th style="position:sticky;top:0;background:var(--bg-elevated);z-index:1">Score</th>
              <th style="position:sticky;top:0;background:var(--bg-elevated);z-index:1">Objetivo</th>
            </tr>
          </thead>
          <tbody>
            ${names.map((n, i) => {
              const prev = lastMonthData[n] || {};
              const setor = colabSetor[n] || '';
              return `<tr>
                <td style="font-weight:500">${escapeHtml(n)}</td>
                <td><select class="proj-setor" data-idx="${i}" style="width:100%;padding:3px 6px;border-radius:var(--r-sm);border:1px solid var(--border);background:var(--bg-surface);color:var(--text);font-size:12px">
                  ${setores.map(s => `<option value="${escapeHtml(s)}" ${s === setor ? 'selected' : ''}>${escapeHtml(s)}</option>`).join('')}
                </select></td>
                <td><input type="number" class="proj-input" data-idx="${i}" data-field="Assumidos" value="${prev.Assumidos || 0}" min="0" style="width:70px"/></td>
                <td><input type="number" class="proj-input" data-idx="${i}" data-field="Finalizados" value="${prev.Finalizados || 0}" min="0" style="width:70px"/></td>
                <td><input type="number" class="proj-input" data-idx="${i}" data-field="Transferidos" value="${prev.Transferidos || 0}" min="0" style="width:70px"/></td>
                <td><input type="number" class="proj-input" data-idx="${i}" data-field="SCORE" value="${prev.SCORE !== undefined && prev.SCORE !== '' ? prev.SCORE : ''}" min="0" max="5" step="0.1" style="width:65px"/></td>
                <td><input type="number" class="proj-input" data-idx="${i}" data-field="Objetivo" value="${prev.Objetivo || 0}" min="0" style="width:70px"/></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>

      <div style="display:flex;gap:var(--s-3);margin-top:var(--s-4);justify-content:flex-end">
        <button class="btn-small" id="projecaoCancelBtn" type="button">Cancelar</button>
        <button class="btn-primary" id="projecaoSaveBtn" type="button">💾 Salvar projeção (${names.length} colaboradores)</button>
      </div>
    </div>
  `;

  container.innerHTML = html;

  document.getElementById('projecaoClose').addEventListener('click', closeProjecao);
  document.getElementById('projecaoCancelBtn').addEventListener('click', closeProjecao);

  // Copy from last month
  const copyBtn = document.getElementById('projecaoCopyBtn');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      if (!lastMonth) return;
      const inputs = container.querySelectorAll('.proj-input');
      inputs.forEach(inp => {
        const idx = parseInt(inp.dataset.idx);
        const field = inp.dataset.field;
        const name = names[idx];
        if (name && lastMonthData[name] && lastMonthData[name][field] !== undefined) {
          inp.value = lastMonthData[name][field];
        }
      });
      showToast('Dados copiados do mês anterior.', 'ok');
    });
  }

  // Filter by setor
  const setorSelect = document.getElementById('projecaoSetor');
  if (setorSelect) {
    setorSelect.addEventListener('change', () => {
      const selected = setorSelect.value;
      const rows = container.querySelectorAll('tbody tr');
      rows.forEach((row, idx) => {
        const name = names[idx];
        const setor = colabSetor[name] || '';
        row.style.display = selected && setor !== selected ? 'none' : '';
      });
    });
  }

  // Save
  document.getElementById('projecaoSaveBtn').addEventListener('click', async () => {
    const mesInput = document.getElementById('projecaoMes');
    const mes = mesInput ? mesInput.value : '';
    if (!mes) {
      showToast('Selecione um mês.', 'warn');
      return;
    }

    const inputs = container.querySelectorAll('.proj-input');
    const records = [];
    const seen = new Set();

    inputs.forEach(inp => {
      const idx = parseInt(inp.dataset.idx);
      const field = inp.dataset.field;
      const name = names[idx];
      if (!name) return;
      const key = `${name}_${idx}`;
      if (!seen.has(key)) {
        seen.add(key);
        const setorSelects = container.querySelectorAll('.proj-setor');
        const setor = setorSelects[idx] ? setorSelects[idx].value : (colabSetor[name] || '');

        const rec = {
          Setor: setor,
          Mês: mes,
          Atendente: name,
          Assumidos: 0,
          Transferidos: 0,
          Finalizados: 0,
          SCORE: null,
          Nota1: 0,
          Nota2: 0,
          Nota3: 0,
          Total: 0,
          Objetivo: 0
        };

        // Collect all values for this name
        const nameInputs = container.querySelectorAll(`.proj-input[data-idx="${idx}"]`);
        nameInputs.forEach(ni => {
          const f = ni.dataset.field;
          const val = ni.value.trim();
          if (f === 'SCORE') {
            rec.SCORE = val !== '' ? parseFloat(val) : null;
          } else if (f === 'Assumidos' || f === 'Finalizados' || f === 'Transferidos' || f === 'Objetivo') {
            rec[f] = parseInt(val) || 0;
          }
        });

        rec.Total = rec.Assumidos + rec.Transferidos + rec.Finalizados;

        records.push(rec);
      }
    });

    if (!records.length) {
      showToast('Nenhum registro para salvar.', 'warn');
      return;
    }

    setLoading(true, 'Salvando projeção…');
    try {
      // Save each to Supabase
      let savedCount = 0;
      for (const rec of records) {
        if (sbClient) {
          const inserted = await dbInsertRow(rec);
          if (inserted && inserted.id) {
            rec.id = inserted.id;
          }
        }
        rawRecords.push(rec);
        savedCount++;
      }

      if (typeof invalidateGamificationCache === 'function') invalidateGamificationCache();
      populateFilters(rawRecords);
      updateFilterOptions();
      const filtered = applyCurrentFilters(rawRecords);
      renderChart(filtered);
      renderSummary(filtered);
      saveState();

      showToast(`${savedCount} registro(s) adicionados para ${mes}.`, 'success', 'Projeção');
      closeProjecao();
    } catch (e) {
      console.error('Erro ao salvar projeção:', e);
      showToast('Erro ao salvar. Veja o Console (F12).', 'error');
    } finally {
      setLoading(false);
    }
  });
}

function suggestNextMonth(months) {
  if (!months || !months.length) {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }
  const last = months[months.length - 1];
  const parts = last.split('-');
  if (parts.length !== 2) return last;
  let y = parseInt(parts[0]);
  let m = parseInt(parts[1]);
  m++;
  if (m > 12) { m = 1; y++; }
  return `${y}-${String(m).padStart(2, '0')}`;
}

// Close on backdrop click
document.addEventListener('click', (e) => {
  const overlay = document.getElementById('projecaoOverlay');
  if (overlay && overlay.classList.contains('open') && e.target === overlay) {
    closeProjecao();
  }
});

// Close on Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeProjecao();
});
