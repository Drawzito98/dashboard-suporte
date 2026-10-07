// Mantém todos os setores do mês e associa cadastros mesmo com diferenças de escrita.
function buildProjecaoSectorIndex(records, info) {
  const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toLowerCase();
  const history = new Map();
  const current = new Map();
  const labels = new Map();
  const addLabel = value => { const label = String(value || '').trim().replace(/\s+/g, ' '); if (label && !labels.has(normalize(label))) labels.set(normalize(label), label); return label; };
  (records || []).forEach(row => {
    if (!row || !row.Atendente || !row.Setor) return;
    const name = normalize(row.Atendente); const month = String(row['Mês'] || ''); const sector = addLabel(row.Setor);
    if (!history.has(name)) history.set(name, new Map());
    const months = history.get(name);
    if (!months.has(month)) months.set(month, new Set());
    months.get(month).add(normalize(sector));
  });
  Object.entries(info || {}).forEach(([name, value]) => { if (value?.setor_atual) current.set(normalize(name), normalize(addLabel(value.setor_atual))); });
  function sectorsFor(name, month) {
    const key = normalize(name); const months = history.get(key);
    if (months?.has(month)) return [...months.get(month)].map(sector => labels.get(sector));
    if (current.has(key)) return [labels.get(current.get(key))];
    const latest = months ? [...months.keys()].sort().pop() : undefined;
    return latest === undefined ? [] : [...months.get(latest)].map(sector => labels.get(sector));
  }
  return { options: [...labels.values()].sort((a, b) => a.localeCompare(b, 'pt-BR')), sectorsFor,
    belongs: (name, sector, month) => !sector || sectorsFor(name, month).some(value => normalize(value) === normalize(sector)),
    equal: (a, b) => normalize(a) === normalize(b) };
}

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
  let colabInfo = {};
  try {
    colabInfo = JSON.parse(localStorage.getItem('sistema_colaboradores_info_v1') || '{}');
    extraNames.push(...Object.keys(colabInfo || {}));
  } catch (e) {}
  try {
    const metas = JSON.parse(localStorage.getItem('sistema_metas_v1') || '[]');
    if (Array.isArray(metas)) extraNames.push(...metas.map(m => m && m.collaborator).filter(Boolean));
  } catch (e) {}
  const names = [...new Set([...fromRecords, ...extraNames])]
    .filter(n => typeof isColabActive !== 'function' || isColabActive(n))
    .sort();
  let sectorIndex = buildProjecaoSectorIndex(data, colabInfo);
  const setores = sectorIndex.options;
  const months = [...new Set((data || []).filter(r => r && r['Mês']).map(r => r['Mês']))].sort();
  const nextMonth = suggestNextMonth(months);

  container.innerHTML = `
    <div class="projecao-layout">
      <h2 class="projecao-title" style="font-size:18px;font-weight:700;margin-bottom:var(--s-1)">📅 Novo Registro Mensal</h2>
      <p style="font-size:13px;color:var(--text-secondary);margin-bottom:var(--s-4)">Adicione ou edite os resultados do time para o mês selecionado. Registros já existentes no mês são <strong>atualizados</strong> (não duplicados).</p>

      <div class="projecao-filters">
        <label class="field" style="flex:1;min-width:180px">
          <span>Mês de referência</span>
          <input type="month" id="projecaoMes" value="${nextMonth}" style="width:100%" aria-describedby="projecaoMesHint"/>
          <small id="projecaoMesHint">Escolha o mês e o ano, inclusive 2027 ou anos seguintes.</small>
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
        <label class="field" style="flex:1;min-width:180px">
          <span>Preenchimento</span>
          <select id="projecaoStatus" style="width:100%"><option value="all">Todos</option><option value="filled">Preenchidos</option><option value="empty">Não preenchidos</option></select>
        </label>

      </div>

      <div id="projecaoEmpty" class="empty-state" style="display:${names.length ? 'none' : 'block'}">
        <div class="empty-title">Nenhum colaborador encontrado</div>
        <div class="empty-sub">Importe um CSV ou cadastre colaboradores na aba Colaboradores antes de lançar resultados.</div>
      </div>

      <div class="projecao-data-actions">
        <button class="btn-small" id="projecaoCopyBtn" type="button">📋 Copiar do mês anterior</button>
        <button class="btn-small" id="projecaoCopyNextBtn" type="button">📋 Copiar do mês seguinte</button>
        <button class="btn-small projecao-reset" id="projecaoResetBtn" type="button">Zerar dados do mês</button>
      </div>
      <p class="projecao-action-hint">Copiar preenche apenas os colaboradores exibidos. Zerar abrange todo o mês, inclusive registros ocultos pelos filtros. As alterações só são aplicadas ao salvar.</p>
      <p id="projecaoSummary" class="projecao-summary" role="status" aria-live="polite"></p>
      <div class="projecao-table-scroll" tabindex="0" role="region" aria-label="Dados mensais dos colaboradores">
        <table class="ranking-table" style="min-width:1320px">
          <thead>
            <tr>
              <th style="position:sticky;top:0;left:0;background:var(--bg-elevated);z-index:4">Colaborador</th>
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

      <div class="projecao-actions">
        <button class="btn-small" id="projecaoCancelBtn" type="button">Cancelar</button>
        <button class="btn-primary" id="projecaoSaveBtn" type="button">💾 Salvar registros</button>
      </div>
    </div>
  `;

  const mesInput = document.getElementById('projecaoMes');
  const setorInput = document.getElementById('projecaoSetor');
  const colabInput = document.getElementById('projecaoColab');
  const tbody = document.getElementById('projecaoTbody');
  const statusInput = document.getElementById('projecaoStatus');
  const drafts = new Map();
  const resetMonths = new Set();
  const draftKey = (month, name) => JSON.stringify([month, name]);
  const hasData = rec => rec && (['Assumidos', 'Finalizados', 'Transferidos', 'Nota1', 'Nota2', 'Nota3'].some(f => Number(rec[f]) > 0) || (rec.SCORE !== null && rec.SCORE !== undefined && rec.SCORE !== '') || ['TMA', 'TMR', 'Observações'].some(f => String(rec[f] || '').trim() !== ''));
  let renderedMonth = mesInput.value;
  function readRow(tr) {
    const rec = { Atendente: tr.dataset.name, 'Mês': renderedMonth, Setor: tr.querySelector('.proj-setor')?.value || '' };
    tr.querySelectorAll('.proj-input').forEach(inp => {
      const f = inp.dataset.field; const val = inp.value.trim();
      rec[f] = f === 'SCORE' ? (val === '' ? null : Number(val)) : ['Nota1','Nota2','Nota3'].includes(f) ? Number(val) || 0 : ['Assumidos','Finalizados','Transferidos','Total'].includes(f) ? parseInt(val) || 0 : val;
    });
    rec.Total = rec.Assumidos + rec.Transferidos + rec.Finalizados;
    return rec;
  }
  function captureRow(tr) {
    const rec = readRow(tr);
    drafts.set(draftKey(renderedMonth, rec.Atendente), rec);
    tr.querySelector('[data-field="Total"]').value = rec.Total;
  }
  function updateSummary() {
    const existing = existingForMonth(mesInput.value);
    const sectorNames = names.filter(n => sectorIndex.belongs(n, setorInput.value, mesInput.value));
    const filled = sectorNames.filter(n => existing.has(n) || hasData(drafts.get(draftKey(mesInput.value, n)))).length;
    const pending = [...drafts.values()].filter(rec => rec['Mês'] === mesInput.value).length;
    document.getElementById('projecaoSummary').textContent = `${sectorNames.length} colaboradores · ${filled} preenchidos · ${sectorNames.length - filled} não preenchidos · ${tbody.rows.length} exibidos${pending ? ` · ${pending} alterações não salvas no mês` : ''}. Preenchido indica registro salvo ou com algum dado informado. Alterações digitadas são preservadas ao trocar os filtros enquanto esta janela estiver aberta.`;
    const save = document.getElementById('projecaoSaveBtn');
    if (save) save.textContent = pending ? `💾 Salvar alterações do mês (${pending})` : '💾 Salvar registros';
  }

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
    renderedMonth = mes;
    const available = names.filter(n => sectorIndex.belongs(n, selSetor, mes));
    colabInput.innerHTML = '<option value="">Todos os colaboradores</option>' + available.map(n => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join('');
    colabInput.value = available.includes(selColab) ? selColab : '';
    let visible = 0;
    let rowIdx = 0;

    tbody.innerHTML = names.map((n, i) => {
      const personSectors = sectorIndex.sectorsFor(n, mes);
      const setor = personSectors.find(value => sectorIndex.equal(value, selSetor)) || personSectors[0] || '';
      if (!sectorIndex.belongs(n, selSetor, mes)) return '';
      if (colabInput.value && n !== colabInput.value) return '';
      const draft = drafts.get(draftKey(mes, n));
      const filled = existing.has(n) || hasData(draft);
      if (statusInput.value === 'filled' && !filled || statusInput.value === 'empty' && filled) return '';
      visible++;
      const rowBg = rowIdx % 2 === 1 ? 'var(--bg-inset)' : 'var(--bg-surface)';
      rowIdx++;
      const prev = draft || existing.get(n);
      const value = (field, dflt) => (prev && prev[field] !== undefined && prev[field] !== null ? prev[field] : dflt);
      const obs = (prev && prev['Observações']) ? String(prev['Observações']) : '';
      const setorVal = (prev && prev['Setor']) ? prev['Setor'] : setor;
      const marker = ` <span class="projecao-row-status ${draft ? 'is-draft' : existing.has(n) ? 'is-saved' : 'is-empty'}">${draft ? 'Não salvo' : existing.has(n) ? 'Salvo' : 'Não preenchido'}</span>`;

      return `<tr data-name="${escapeHtml(n)}">
        <td style="position:sticky;left:0;z-index:2;background:${rowBg};font-weight:500;white-space:nowrap">${escapeHtml(n)}${marker}</td>
        <td><select class="proj-setor" style="width:100%;padding:3px 6px;border-radius:var(--r-sm);border:1px solid var(--border);background:var(--bg-surface);color:var(--text);font-size:12px">
          ${setores.map(s => `<option value="${escapeHtml(s)}" ${sectorIndex.equal(s, setorVal) ? 'selected' : ''}>${escapeHtml(s)}</option>`).join('')}
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
    if (emptyEl) {
      emptyEl.style.display = visible ? 'none' : 'block';
      emptyEl.querySelector('.empty-title').textContent = names.length ? 'Nenhum colaborador neste filtro' : 'Nenhum colaborador encontrado';
      emptyEl.querySelector('.empty-sub').textContent = names.length ? 'Altere o setor, o colaborador ou o filtro de preenchimento para conferir os demais registros.' : 'Importe um CSV ou cadastre colaboradores antes de lançar resultados.';
    }

    const saveBtn = document.getElementById('projecaoSaveBtn');
    updateSummary();
    updateCopyButtons();
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
  statusInput.addEventListener('change', renderRows);
  tbody.addEventListener('input', event => { const tr = event.target.closest('tr'); if (!tr) return; captureRow(tr); tr.querySelector('.projecao-row-status').textContent = 'Não salvo'; tr.querySelector('.projecao-row-status').className = 'projecao-row-status is-draft'; updateSummary(); });
  tbody.addEventListener('change', event => { const tr = event.target.closest('tr'); if (tr) { captureRow(tr); updateSummary(); } });

  function updateCopyButtons() {
    [-1, 1].forEach(offset => {
      const sourceMonth = shiftProjecaoMonth(mesInput.value, offset);
      const button = document.getElementById(offset < 0 ? 'projecaoCopyBtn' : 'projecaoCopyNextBtn');
      const available = sourceMonth && (data || []).some(row => row && row['Mês'] === sourceMonth && row.Atendente);
      button.disabled = !available;
      button.title = available ? `Copiar de ${sourceMonth} para ${mesInput.value}, apenas pessoas exibidas` : `Sem dados em ${sourceMonth || 'um mês válido'} para copiar`;
    });
    document.getElementById('projecaoResetBtn').disabled = !mesInput.value;
  }
  function copyMonth(offset) {
    if (!requireAdmin()) return;
    const sourceMonth = shiftProjecaoMonth(mesInput.value, offset);
    if (!sourceMonth) return;
    const source = existingForMonth(sourceMonth);
    let copied = 0;
    tbody.querySelectorAll('tr').forEach(tr => {
      const row = source.get(tr.dataset.name);
      if (!row) return;
      tr.querySelectorAll('.proj-input').forEach(input => {
        const field = input.dataset.field;
        const numeric = ['Assumidos','Finalizados','Transferidos','Nota1','Nota2','Nota3','Total'].includes(field);
        input.value = row[field] ?? (field === 'Observações' ? row.Observacao || '' : numeric ? 0 : '');
      });
      captureRow(tr);
      const marker = tr.querySelector('.projecao-row-status'); marker.textContent = 'Não salvo'; marker.className = 'projecao-row-status is-draft';
      copied++;
    });
    updateSummary();
    showToast(copied ? `${copied} colaboradores copiados de ${sourceMonth}. Clique em salvar para aplicar.` : 'Nenhuma pessoa exibida tem dados no mês de origem.', copied ? 'ok' : 'warn');
  }
  document.getElementById('projecaoCopyBtn').addEventListener('click', () => copyMonth(-1));
  document.getElementById('projecaoCopyNextBtn').addEventListener('click', () => copyMonth(1));
  const zeroRecord = (name, month, sector) => ({ Atendente: name, 'Mês': month, Setor: sector || '', Assumidos: 0, Finalizados: 0, Transferidos: 0, Total: 0, Nota1: 0, Nota2: 0, Nota3: 0, SCORE: null, TMA: '', TMR: '', 'Observações': '' });
  document.getElementById('projecaoResetBtn').addEventListener('click', () => {
    if (!requireAdmin()) return;
    const month = mesInput.value;
    if (!month) return;
    if (!window.confirm(`Zerar todos os dados de ${month}, inclusive pessoas ocultas pelos filtros? Quantidades e notas serão zeradas; score, tempos e observações serão limpos. Nomes e setores serão mantidos. A limpeza só será aplicada ao clicar em Salvar.`)) return;
    const existing = existingForMonth(month);
    const allNames = new Set([...names, ...existing.keys(), ...[...drafts.values()].filter(row => row['Mês'] === month).map(row => row.Atendente)]);
    allNames.forEach(name => {
      const previous = drafts.get(draftKey(month, name)) || existing.get(name);
      const sector = previous?.Setor || sectorIndex.sectorsFor(name, month)[0] || '';
      drafts.set(draftKey(month, name), zeroRecord(name, month, sector));
    });
    resetMonths.add(month);
    renderRows();
    showToast(`Dados de ${month} preparados para zerar. Clique em salvar para aplicar.`, 'warn');
  });

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

      const recordsToSave = new Map();
      tbody.querySelectorAll('tr').forEach(tr => { const rec = readRow(tr); if (hasData(rec)) recordsToSave.set(rec.Atendente, rec); });
      // Inclui também os rascunhos que ficaram ocultos ao mudar os filtros.
      drafts.forEach(rec => { if (rec['Mês'] === mes) recordsToSave.set(rec.Atendente, { ...rec }); });
      const updatedRecords = new Set();
      recordsToSave.forEach(rec => {
        const name = rec.Atendente;
        if (!hasData(rec) && !(rawRecords || []).some(r => r && r.Atendente === name && String(r['Mês']) === mes)) return;
        const existingRec = (rawRecords || []).find(r => r && r['Atendente'] === name && String(r['Mês']) === mes);
        if (existingRec) {
          const update = resetMonths.has(mes) && !hasData(rec) ? { ...rec, Setor: existingRec.Setor } : rec;
          toUpdate.push({ rec: update, existingRec }); updatedRecords.add(existingRec);
        }
        else toInsert.push(rec);
      });

      if (resetMonths.has(mes)) {
        (rawRecords || []).filter(row => row && String(row['Mês']) === mes && !updatedRecords.has(row)).forEach(existingRec => {
          toUpdate.push({ existingRec, rec: zeroRecord(existingRec.Atendente, mes, existingRec.Setor) });
        });
      }

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
        drafts.forEach((rec, key) => { if (rec['Mês'] === mes) drafts.delete(key); });
        resetMonths.delete(mes);
        renderRows();
      } catch (e) {
        console.error('Erro ao salvar projeção:', e);
        showToast('Erro ao salvar. Veja o Console (F12).', 'error');
      } finally {
        setLoading(false);
      }
    });
  }
}

function shiftProjecaoMonth(month, offset) {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(String(month || ''));
  if (!match) return '';
  const index = Number(match[1]) * 12 + Number(match[2]) - 1 + offset;
  const year = Math.floor(index / 12);
  if (year < 1 || year > 9999) return '';
  return `${String(year).padStart(4, '0')}-${String(index % 12 + 1).padStart(2, '0')}`;
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

if (typeof module !== 'undefined' && module.exports) module.exports = { buildProjecaoSectorIndex, shiftProjecaoMonth };
