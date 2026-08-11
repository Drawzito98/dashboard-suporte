// Projeção Mensal — adicionar/editar resultados de um mês para colaboradores
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
  const data = rawRecords || [];

  // Lista completa do time: todos os registros (sem filtros globais/setor) +
  // cadastros (colaboradores_info) + metas. Exclui apenas colaboradores
  // marcados como INATIVOS (isColabActive).
  const fromRecords = (data || []).filter(r => r && r['Atendente'] && !isAggregateName(r['Atendente'])).map(r => r['Atendente']);
  let extraNames = [];
  try {
    const colabInfo = JSON.parse(localStorage.getItem('sistema_colaboradores_info_v1') || '{}');
    extraNames.push(...Object.keys(colabInfo || {}));
  } catch (e) {}
  try {
    const metas = JSON.parse(localStorage.getItem('sistema_metas_v1') || '[]');
    if (Array.isArray(metas)) extraNames.push(...metas.map(m => m && m.collaborator).filter(Boolean));
  } catch (e) {}
  const names = [...new Set([...fromRecords, ...extraNames])]
    .filter(n => typeof isColabActive !== 'function' || isColabActive(n))
    .sort();
  const setores = [...new Set((data || []).filter(r => r && r['Setor']).map(r => r['Setor']))].sort();
  const months = [...new Set((data || []).filter(r => r && r['Mês']).map(r => r['Mês']))].sort();
  const lastMonth = months.length ? months[months.length - 1] : '';
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
        TMA: r['TMA'] || '',
        TMR: r['TMR'] || '',
        SCORE: r['SCORE'] !== null && r['SCORE'] !== undefined ? Number(r['SCORE']) : '',
        Nota1: parseInt(r['Nota1']) || 0,
        Nota2: parseInt(r['Nota2']) || 0,
        Nota3: parseInt(r['Nota3']) || 0,
        Total: parseInt(r['Total']) || 0,
        Observações: r['Observações'] || r['Observacao'] || '',
        Setor: r['Setor'] || ''
      };
    });
  }

  container.innerHTML = `
    <div style="padding:var(--s-5)">
      <h2 style="font-size:18px;font-weight:700;margin-bottom:var(--s-1)">📅 Novo Registro Mensal</h2>
      <p style="font-size:13px;color:var(--text-secondary);margin-bottom:var(--s-4)">Adicione ou edite os resultados do time para o mês selecionado. Registros já existentes no mês são <strong>atualizados</strong> (não duplicados).</p>

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
        <label class="field" style="flex:1;min-width:180px">
          <span>Colaborador (opcional)</span>
          <select id="projecaoColab" style="width:100%">
            <option value="">Todos os colaboradores</option>
            ${names.map(n => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join('')}
          </select>
        </label>
        <button class="btn-small" id="projecaoCopyBtn" type="button" ${lastMonth ? '' : 'disabled'}>
          📋 Copiar do mês anterior
        </button>
      </div>

      <div id="projecaoEmpty" class="empty-state" style="display:${names.length ? 'none' : 'block'}">
        <div class="empty-title">Nenhum colaborador encontrado</div>
        <div class="empty-sub">Importe um CSV ou cadastre colaboradores na aba Colaboradores antes de lançar resultados.</div>
      </div>

      <div style="overflow-x:auto;max-height:55vh;overflow-y:auto;border:1px solid var(--border);border-radius:var(--r-md)">
        <table class="ranking-table" style="min-width:1320px">
          <thead>
            <tr>
              <th style="position:sticky;top:0;background:var(--bg-elevated);z-index:1">Colaborador</th>
              <th style="position:sticky;top:0;background:var(--bg-elevated);z-index:1">Setor</th>
              <th style="position:sticky;top:0;background:var(--bg-elevated);z-index:1">Assumidos</th>
              <th style="position:sticky;top:0;background:var(--bg-elevated);z-index:1">Finalizados</th>
              <th style="position:sticky;top:0;background:var(--bg-elevated);z-index:1">Transferidos</th>
              <th style="position:sticky;top:0;background:var(--bg-elevated);z-index:1">TMA</th>
              <th style="position:sticky;top:0;background:var(--bg-elevated);z-index:1">TMR</th>
              <th style="position:sticky;top:0;background:var(--bg-elevated);z-index:1">Score</th>
              <th style="position:sticky;top:0;background:var(--bg-elevated);z-index:1">Nota1</th>
              <th style="position:sticky;top:0;background:var(--bg-elevated);z-index:1">Nota2</th>
              <th style="position:sticky;top:0;background:var(--bg-elevated);z-index:1">Nota3</th>
              <th style="position:sticky;top:0;background:var(--bg-elevated);z-index:1">Total</th>
              <th style="position:sticky;top:0;background:var(--bg-elevated);z-index:1">Observação</th>
            </tr>
          </thead>
          <tbody id="projecaoTbody"></tbody>
        </table>
      </div>

      <div style="display:flex;gap:var(--s-3);margin-top:var(--s-4);justify-content:flex-end">
        <button class="btn-small" id="projecaoCancelBtn" type="button">Cancelar</button>
        <button class="btn-primary" id="projecaoSaveBtn" type="button">💾 Salvar registros</button>
      </div>
    </div>
  `;

  const mesInput = document.getElementById('projecaoMes');
  const setorInput = document.getElementById('projecaoSetor');
  const colabInput = document.getElementById('projecaoColab');
  const tbody = document.getElementById('projecaoTbody');

  function existingForMonth(mes) {
    const map = new Map();
    (data || []).filter(r => r && r['Mês'] === mes && r['Atendente']).forEach(r => {
      map.set(r['Atendente'], r);
    });
    return map;
  }

  function renderRows() {
    const mes = mesInput ? mesInput.value : '';
    const selSetor = setorInput ? setorInput.value : '';
    const selColab = colabInput ? colabInput.value : '';
    const existing = existingForMonth(mes);
    let visible = 0;

    tbody.innerHTML = names.map(n => {
      const setor = colabSetor[n] || '';
      if (selSetor && setor !== selSetor) return '';
      if (selColab && n !== selColab) return '';
      visible++;
      const prev = existing.get(n);
      const value = (field, dflt) => (prev && prev[field] !== undefined && prev[field] !== null ? prev[field] : dflt);
      const obs = (prev && prev['Observações']) ? String(prev['Observações']) : '';
      const setorVal = (prev && prev['Setor']) ? prev['Setor'] : setor;
      const marker = prev
        ? ' <span class="proj-exists" title="Já existe registro para este mês — será atualizado">●</span>'
        : '';

      return `<tr data-name="${escapeHtml(n)}">
        <td style="font-weight:500;white-space:nowrap">${escapeHtml(n)}${marker}</td>
        <td><select class="proj-setor" style="width:100%;padding:3px 6px;border-radius:var(--r-sm);border:1px solid var(--border);background:var(--bg-surface);color:var(--text);font-size:12px">
          ${setores.map(s => `<option value="${escapeHtml(s)}" ${s === setorVal ? 'selected' : ''}>${escapeHtml(s)}</option>`).join('')}
        </select></td>
        <td><input type="number" class="proj-input" data-field="Assumidos" value="${value('Assumidos', 0)}" min="0" style="width:55px"/></td>
        <td><input type="number" class="proj-input" data-field="Finalizados" value="${value('Finalizados', 0)}" min="0" style="width:55px"/></td>
        <td><input type="number" class="proj-input" data-field="Transferidos" value="${value('Transferidos', 0)}" min="0" style="width:55px"/></td>
        <td><input type="text" class="proj-input" data-field="TMA" value="${escapeHtml(value('TMA', ''))}" placeholder="1d 2h 18m 20s" style="width:110px;font-size:11px"/></td>
        <td><input type="text" class="proj-input" data-field="TMR" value="${escapeHtml(value('TMR', ''))}" placeholder="1d 2h 18m 20s" style="width:110px;font-size:11px"/></td>
        <td><input type="number" class="proj-input" data-field="SCORE" value="${value('SCORE', '')}" min="0" max="5" step="0.1" style="width:55px"/></td>
        <td><input type="number" class="proj-input" data-field="Nota1" value="${value('Nota1', 0)}" min="0" max="5" step="0.1" style="width:55px"/></td>
        <td><input type="number" class="proj-input" data-field="Nota2" value="${value('Nota2', 0)}" min="0" max="5" step="0.1" style="width:55px"/></td>
        <td><input type="number" class="proj-input" data-field="Nota3" value="${value('Nota3', 0)}" min="0" max="5" step="0.1" style="width:55px"/></td>
        <td><input type="number" class="proj-input" data-field="Total" value="${value('Total', 0)}" min="0" style="width:55px"/></td>
        <td><input type="text" class="proj-input" data-field="Observações" value="${escapeHtml(obs)}" placeholder="Férias/ausente..." style="width:100px;font-size:11px"/></td>
      </tr>`;
    }).join('');

    const emptyEl = document.getElementById('projecaoEmpty');
    if (emptyEl) emptyEl.style.display = names.length ? 'none' : 'block';

    const saveBtn = document.getElementById('projecaoSaveBtn');
    if (saveBtn) saveBtn.textContent = visible ? `💾 Salvar registros (${visible} colaboradores)` : '💾 Salvar registros';
  }

  renderRows();

  const closeBtn = document.getElementById('projecaoClose');
  if (closeBtn && !closeBtn.dataset.bound) {
    closeBtn.dataset.bound = '1';
    closeBtn.addEventListener('click', closeProjecao);
  }
  const cancelBtn = document.getElementById('projecaoCancelBtn');
  if (cancelBtn) cancelBtn.addEventListener('click', closeProjecao);

  if (mesInput) mesInput.addEventListener('change', renderRows);
  if (setorInput) setorInput.addEventListener('change', renderRows);
  if (colabInput) colabInput.addEventListener('change', renderRows);

  // Copy from last month
  const copyBtn = document.getElementById('projecaoCopyBtn');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      if (!lastMonth) return;
      tbody.querySelectorAll('tr').forEach(tr => {
        const name = tr.dataset.name;
        if (!name || !lastMonthData[name]) return;
        tr.querySelectorAll('.proj-input').forEach(inp => {
          const field = inp.dataset.field;
          if (lastMonthData[name][field] !== undefined) inp.value = lastMonthData[name][field];
        });
      });
      showToast('Dados copiados do mês anterior.', 'ok');
    });
  }

  // Save (upsert: atualiza registros existentes do mês, insere novos)
  const saveBtn = document.getElementById('projecaoSaveBtn');
  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      if (!requireAdmin()) return;
      const mes = mesInput ? mesInput.value : '';
      if (!mes) {
        showToast('Selecione um mês.', 'warn');
        return;
      }

      const toInsert = [];
      const toUpdate = [];

      tbody.querySelectorAll('tr').forEach(tr => {
        if (tr.style.display === 'none') return;
        const name = tr.dataset.name;
        if (!name) return;
        const rec = {
          Setor: '',
          Mês: mes,
          Atendente: name,
          Assumidos: 0,
          Transferidos: 0,
          Finalizados: 0,
          TMA: '',
          TMR: '',
          SCORE: null,
          Nota1: 0,
          Nota2: 0,
          Nota3: 0,
          Total: 0,
          Observações: ''
        };
        tr.querySelectorAll('.proj-input').forEach(inp => {
          const f = inp.dataset.field;
          const val = inp.value.trim();
          if (f === 'SCORE') {
            rec.SCORE = val !== '' ? parseFloat(val) : null;
          } else if (f === 'Nota1' || f === 'Nota2' || f === 'Nota3') {
            rec[f] = val !== '' ? parseFloat(val) : 0;
          } else if (f === 'Assumidos' || f === 'Finalizados' || f === 'Transferidos' || f === 'Total') {
            rec[f] = parseInt(val) || 0;
          } else if (f === 'TMA' || f === 'TMR') {
            rec[f] = val;
          } else if (f === 'Observações') {
            rec[f] = val;
          }
        });
        const setorSel = tr.querySelector('.proj-setor');
        rec.Setor = setorSel ? setorSel.value : (colabSetor[name] || '');
        rec.Total = rec.Assumidos + rec.Transferidos + rec.Finalizados;

        // Only include row if at least one field has meaningful data
        const hasData = rec.Assumidos > 0 || rec.Transferidos > 0 || rec.Finalizados > 0 ||
          rec.SCORE !== null || rec.Nota1 > 0 || rec.Nota2 > 0 || rec.Nota3 > 0 ||
          rec.TMA !== '' || rec.TMR !== '' ||
          rec.Observações !== '';
        if (!hasData) return;

        const existingRec = (rawRecords || []).find(r => r && r['Atendente'] === name && String(r['Mês']) === mes);
        if (existingRec) toUpdate.push({ rec, existingRec });
        else toInsert.push(rec);
      });

      if (!toInsert.length && !toUpdate.length) {
        showToast('Nenhum registro para salvar.', 'warn');
        return;
      }

      setLoading(true, 'Salvando registros…');
      try {
        let inserted = 0;
        let updated = 0;
        let pending = 0;

        if (toInsert.length) {
          if (sbClient) {
            const result = await dbSaveRecords(toInsert);
            if (result && Array.isArray(result)) {
              result.forEach((row, i) => { if (row && row.id && toInsert[i]) toInsert[i].id = row.id; });
              inserted = result.length;
            } else if (result === true) {
              inserted = toInsert.length;
            } else {
              toInsert.forEach(rec => addToPendingSync(rec));
              pending += toInsert.length;
            }
          } else {
            toInsert.forEach(rec => addToPendingSync(rec));
            pending += toInsert.length;
          }
          toInsert.forEach(rec => {
            rawRecords.push(rec);
            if (typeof logHistorico === 'function') logHistorico('add', rec, { detalhes: 'Adicionado via novo registro mensal' });
          });
        }

        for (const { rec, existingRec } of toUpdate) {
          const before = Object.assign({}, existingRec);
          Object.assign(existingRec, rec);
          if (existingRec.id != null) {
            const ok = await dbUpdateRecord(existingRec.id, rec);
            if (!ok) pending++;
          }
          if (typeof logHistorico === 'function') logHistorico('edit', existingRec, { campo: 'Registro mensal', before: JSON.stringify(before), after: JSON.stringify(rec) });
          updated++;
        }

        if (typeof invalidateGamificationCache === 'function') invalidateGamificationCache();
        populateFilters(rawRecords);
        updateFilterOptions();
        try { updateView(); } catch (e) { console.error('[Projecao] Erro ao atualizar view:', e); }
        saveState();

        const parts = [];
        if (updated) parts.push(`${updated} atualizado(s)`);
        if (inserted) parts.push(`${inserted} adicionado(s)`);
        if (pending) parts.push(`${pending} pendente(s)`);
        showToast(`${parts.join(', ')} para ${mes}.`, pending ? 'warn' : 'success', 'Registro Mensal');
        closeProjecao();
      } catch (e) {
        console.error('Erro ao salvar projeção:', e);
        showToast('Erro ao salvar. Veja o Console (F12).', 'error');
      } finally {
        setLoading(false);
      }
    });
  }
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
