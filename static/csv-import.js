function handleError(context, fn, fallback) {
  try { return fn(); } catch (e) {
    console.error(`[${context}]`, e);
    if (typeof fallback === 'function') fallback(e);
    if (typeof showToast === 'function' && context) {
      showToast(`Erro em ${context}.`, 'error', null, 3000);
    }
  }
}

function normalizeRecords(rows, fields, sourceName) {
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
  const s = String(name).normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  return /\b(media|media set|media setor|media seto|total)\b/.test(s);
}

function normalizeNumber(s) {
  if (s == null) return '';
  let t = String(s).replace(/\u00A0/g, '').replace(/ /g, '');
  if (t.indexOf('.') !== -1 && t.indexOf(',') !== -1) {
    t = t.replace(/\./g, '').replace(/,/g, '.');
  } else {
    t = t.replace(/\./g, '');
    t = t.replace(/,/g, '.');
  }
  t = t.replace(/[^0-9.\-]/g, '');
  return t;
}

function parseDateKey(raw) {
  if (!raw) return '';
  const m = raw.match(/(\d{2})[\/\-](\d{2})[\/\-](\d{4})/);
  if (m) return `${m[3]}-${m[2]}`;
  const m2 = raw.match(/(\d{4})-(\d{2})/);
  if (m2) return `${m2[1]}-${m2[2]}`;
  return raw;
}

async function parseCsvFile(file) {
  const text = await file.text();
  const firstLine = (text.split(/\r?\n/)[0] || '').trim();
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semiCount = (firstLine.match(/;/g) || []).length;
  const delimiter = semiCount > commaCount ? ';' : ',';

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
  handleError('Importação', () => showToast(message, 'error', 'Importação'));
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

    // Validate before import
    if (typeof CSVValidator !== 'undefined') {
      const allFields = [];
      for (const item of parsed) {
        const fields = item.results?.meta?.fields || [];
        fields.forEach(f => { if (!allFields.includes(f)) allFields.push(f); });
      }
      const valResult = CSVValidator.validate(merged, allFields);
      const reportHtml = CSVValidator.formatReport(valResult);

      if (!valResult.valid) {
        showImportError('Validação falhou:<br><br>' + reportHtml);
        return;
      }

      // Show validation report and ask for confirmation if there are warnings
      if (valResult.warnings.length > 0) {
        const confirmed = await new Promise(resolve => {
          const overlay = document.createElement('div');
          overlay.className = 'modal-overlay';
          overlay.innerHTML = `
            <div class="modal-box csv-validation-modal">
              <h3>Validação do CSV</h3>
              <div class="csv-validation-report">${reportHtml}</div>
              <div class="modal-actions">
                <button class="btn-cancel" id="csvValCancel">Cancelar</button>
                <button class="btn-primary" id="csvValConfirm">Importar Mesmo Assim</button>
              </div>
            </div>`;
          document.body.appendChild(overlay);
          overlay.querySelector('#csvValCancel').onclick = () => { overlay.remove(); resolve(false); };
          overlay.querySelector('#csvValConfirm').onclick = () => { overlay.remove(); resolve(true); };
          overlay.addEventListener('click', e => { if (e.target === overlay) { overlay.remove(); resolve(false); } });
        });
        if (!confirmed) return;
      }
    }

    rawRecords = normalizeAtendenteOnRecords(merged);
    if (typeof invalidateGamificationCache === 'function') invalidateGamificationCache();
    setGlobalEmpty(false);
    populateFilters(rawRecords);
    updateFilterOptions();

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
    if (input) input.value = '';
    setImportStatus('');
    setLoading(false);
    __isImporting = false;
  }
}
