(function (root) {
  'use strict';
  const VERSION = 'mvp-2';
  const UNCERTAIN = 'Não foi possível interpretar este registro com segurança.';
  const UNCERTAIN_CARD = 'Não foi possível interpretar este cartão de ponto com segurança. Revise os dados antes de continuar.';
  const DEFAULT_RULES = Object.freeze({ tolerancia_batida: 5, tolerancia_diaria: 10, regra_batida_manual: 'conferir', regra_hora_extra: 'informar', regra_folga: 'conferir', regra_batida_ausente: 'inconsistencia', regra_debito: 'inconsistencia', regra_adicional: 'conferir' });
  function minutes(value, duration = false) {
    const match = String(value ?? '').match(duration ? /^([+-]?)(\d{1,3}):([0-5]\d)$/ : /^()([01]\d|2[0-3]):([0-5]\d)$/);
    return match ? (match[1] === '-' ? -1 : 1) * (+match[2] * 60 + +match[3]) : null;
  }
  function dateISO(value) {
    const m = String(value).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!m) return null;
    const d = new Date(Date.UTC(+m[3], +m[2] - 1, +m[1]));
    return d.getUTCFullYear() === +m[3] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[1] ? `${m[3]}-${m[2]}-${m[1]}` : null;
  }
  function normalizeName(name) { return String(name).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim(); }
  function identify(name, employees) {
    const hits = employees.filter(e => normalizeName(e.nome) === normalizeName(name));
    return hits.length === 1 ? hits[0].id : null;
  }
  // Group PDF text by page and baseline; retain positions and source strings.
  function pageLines(items, page) {
    const groups = [];
    for (const item of items.filter(i => i.str && i.str.trim())) {
      const y = item.transform[5];
      let group = groups.find(g => Math.abs(g.y - y) < 2);
      if (!group) { group = { page, y, items: [] }; groups.push(group); }
      group.items.push({ text: item.str, x: item.transform[4], y, width: item.width });
    }
    return groups.sort((a, b) => b.y - a.y).map(g => ({ page, baseline: g.y, text: g.items.sort((a, b) => a.x - b.x).map(i => i.text).join(' '), cells: g.items }));
  }
  const TABLE_KEYS = ['entrada_1', 'saida_1', 'entrada_2', 'saida_2', 'entrada_3', 'saida_3', 'horas_normais', 'debito', 'credito', 'saldo', 'noturno'];
  function headerColumns(line, kind = 'principal') {
    if (!(kind === 'principal' ? /\bDATA\b/i : /\bDIA\b/i).test(line.text)) return null;
    const cells = (line.cells || []).flatMap(c => {
      const matches = [...c.text.matchAll(/(?:ENTRADA|SA[IÍ]DA|ENT\.|SAI\.)\s*\d+/gi)];
      if (matches.length < 2) return [c];
      // PDF.js may coalesce neighboring labels. Derive each anchor from the
      // source item's geometry and substring, never from employee-specific coordinates.
      return matches.map(m => ({ text: m[0], x: c.x + c.width * m.index / c.text.length, width: c.width * m[0].length / c.text.length }));
    });
    const aliases = { horas_normais: ['normais', 'horas normais', 'h. normais'], debito: ['bdeb.', 'bdeb', 'debito', 'deb.'], credito: ['bcred.', 'bcred', 'credito', 'cred.'], saldo: ['bsaldo', 'saldo'], noturno: ['not.', 'noturno', 'horas noturnas'] };
    const definitions = [];
    for (let n = 1; n <= 12; n++) { definitions.push([`entrada_${n}`, [`entrada ${n}`, `entrada${n}`, `ent. ${n}`]], [`saida_${n}`, [`saida ${n}`, `saida${n}`, `sai. ${n}`]]); }
    if (kind === 'principal') definitions.push(...Object.entries(aliases));
    const columns = definitions.map(([key, labels]) => {
      for (let i = 0; i < cells.length; i++) {
        const c = cells[i], current = normalizeName(c.text);
        if (labels.includes(current)) return { key, x: c.x + c.width / 2 };
        if (i + 1 < cells.length && labels.includes(normalizeName(current + ' ' + cells[i + 1].text))) return { key, x: (c.x + cells[i + 1].x + cells[i + 1].width) / 2 };
      }
      return null;
    }).filter(Boolean).sort((a, b) => a.x - b.x);
    return ['entrada_1', 'saida_1'].every(k => columns.some(c => c.key === k)) && columns.every((c, i) => !i || c.x > columns[i - 1].x) ? columns : null;
  }
  function positionedFields(line, anchors) {
    const fields = Object.fromEntries(anchors.map(c => [c.key, null]));
    const unknown = [];
    for (const cell of line.cells || []) {
      const text = cell.text.trim();
      if (!/^[+-]?\d{1,3}:\d{2}[*^mM]?$|^--:--$|^(FOLGA|Feriado)$/i.test(text)) {
        if (/\d{1,3}:\d{2}/.test(text)) unknown.push(text);
        continue;
      }
      const center = cell.x + cell.width / 2;
      if (center < anchors[0].x - (anchors[1].x - anchors[0].x) / 2) { unknown.push(text); continue; }
      const index = anchors.findIndex((c, i) => i === anchors.length - 1 || center < (c.x + anchors[i + 1].x) / 2);
      const key = anchors[index].key;
      if (fields[key] !== null) unknown.push(text); else fields[key] = text;
    }
    return { fields, segura: unknown.length === 0 };
  }
  function extract(lines, start, end) {
    const rows = [], warnings = [], names = new Set(), justifications = [], unparsed = [], periods = [], totalsFound = [], documentSchedules = [], legends = [];
    const availablePeriods = lines.map(l => l.text.match(/per[ií]odo\s*:\s*(\d{2}\/\d{2}\/\d{4})\s*(?:at[eé]|a|-)\s*(\d{2}\/\d{2}\/\d{4})/i)).filter(Boolean).map(m => ({ inicio: dateISO(m[1]), fim: dateISO(m[2]) }));
    const uniquePeriods = [...new Map(availablePeriods.map(p => [JSON.stringify(p), p])).values()];
    if (!start && !end && uniquePeriods.length === 1 && uniquePeriods[0].inicio && uniquePeriods[0].fim) { start = uniquePeriods[0].inicio; end = uniquePeriods[0].fim; }
    for (const l of lines) { const legend = l.text.match(/^\s*\(([\^*])\)\s*[-–]\s*(.+)$/); if (legend) legends.push({ marcador: legend[1], descricao: legend[2] }); }
    let section = 'principal', justificationDate = null, columns = null, columnPage = null, scheduleColumns = null, schedulePage = null;
    const resolveDate = value => {
      let date = dateISO(value);
      if (value.length === 5 && start && end) {
        const candidates = [];
        for (let year = +start.slice(0, 4); year <= +end.slice(0, 4); year++) {
          const candidate = dateISO(`${value}/${year}`);
          if (candidate && candidate >= start && candidate <= end) candidates.push(candidate);
        }
        date = candidates.length === 1 ? candidates[0] : null;
      }
      return date;
    };
    for (const [lineIndex, line] of lines.entries()) {
      const n = line.text.match(/(?:colaborador|funcion[aá]rio|empregado|nome)\s*:\s*([^\d:]+?)(?=\s+(?:CPF|PIS|CTPS|matr[ií]cula|cargo|setor)\b|$)/i);
      if (n) names.add(n[1].trim());
      if (!n && /(?:\bnome(?: do (?:empregado|funcion[aá]rio|colaborador))?|\bempregado|\bfuncion[aá]rio|\bcolaborador)\s*:/i.test(line.text)) {
        const label = (line.cells || []).find(c => /^(?:nome(?: do (?:empregado|funcion[aá]rio|colaborador))?|empregado|funcion[aá]rio|colaborador)\s*:$/i.test(c.text.trim()));
        if (label) {
          const rightLabel = line.cells.filter(c => c.x > label.x && /:\s*$/.test(c.text)).sort((a, b) => a.x - b.x)[0];
          for (const next of lines.slice(lineIndex + 1)) {
            if (next.page !== line.page) break;
            const candidate = (next.cells || []).filter(c => c.x >= label.x - 2 && (!rightLabel || c.x < rightLabel.x)).map(c => c.text).join(' ').trim();
            if (candidate.includes(':') && !/\d{2}:\d{2}/.test(candidate)) break;
            if (/^[\p{L} .'-]+$/u.test(candidate) && candidate.split(/\s+/).length >= 2 && candidate.length <= 200) { names.add(candidate); break; }
          }
        }
      }
      const period = line.text.match(/per[ií]odo\s*:\s*(\d{2}\/\d{2}\/\d{4})\s*(?:at[eé]|a|-)\s*(\d{2}\/\d{2}\/\d{4})/i);
      if (period) periods.push({ inicio: dateISO(period[1]), fim: dateISO(period[2]) });
      if (/JUSTIFICATIVAS\s+DE\s+ALTERA[ÇC][ÃA]O\s+E\s+INCLUS[ÃA]O\s+DE\s+PONTO/i.test(line.text)) { section = 'justificativas'; continue; }
      const detectedColumns = headerColumns(line);
      if (detectedColumns) { columns = detectedColumns; columnPage = line.page; section = 'principal'; continue; }
      const detectedSchedule = headerColumns(line, 'jornada');
      if (detectedSchedule) { scheduleColumns = detectedSchedule; schedulePage = line.page; continue; }
      if (section === 'principal' && scheduleColumns && schedulePage === line.page && !/^\s*\d{2}\//.test(line.text) && /\d{2}:\d{2}/.test(line.text)) {
        const dayCell = (line.cells || []).find(c => c.x < scheduleColumns[0].x && /^(Dom(?:ingo)?|Seg(?:unda)?(?:-feira)?|Ter(?:ca|ça)?(?:-feira)?|Qua(?:rta)?(?:-feira)?|Qui(?:nta)?(?:-feira)?|Sex(?:ta)?(?:-feira)?|S[aá]b(?:ado)?)$/i.test(c.text.trim()));
        if (dayCell) { const result = positionedFields({ ...line, cells: line.cells.filter(c => c.x >= dayCell.x) }, scheduleColumns); documentSchedules.push({ dia_documento: dayCell.text, dia_semana: ['dom','seg','ter','qua','qui','sex','sab'].indexOf(normalizeName(dayCell.text).slice(0, 3)), campos_documento: result.fields, segura: result.segura, pagina: line.page }); continue; }
      }
      if (section === 'justificativas') {
        // A repeated section title/page header does not reset the inherited date.
        const dateMatch = line.text.match(/^\s*(\d{2}\/\d{2}(?:\/\d{4})?)(?=\s|$)/);
        let rest = line.text;
        if (dateMatch) { justificationDate = resolveDate(dateMatch[1]); rest = rest.slice(dateMatch[0].length); }
        const entry = rest.match(/^\s*(\d{2}:\d{2})\s*[-–]\s*([^\s–-]+)\s*[-–]\s*(.+?)\s*$/);
        if (entry) {
          const item = { data: justificationDate, hora: entry[1], codigo_ocorrencia: entry[2], descricao: entry[3], pagina: line.page };
          if (!item.data || minutes(item.hora) === null || (start && (item.data < start || item.data > end))) unparsed.push({ pagina: line.page, motivo: UNCERTAIN });
          else justifications.push(item);
        } else if (/^\s*\d{2}:\d{2}|^\s*\d{2}\/\d{2}/.test(rest) || (dateMatch && !justificationDate)) unparsed.push({ pagina: line.page, motivo: UNCERTAIN });
        continue;
      }
      if (/^\s*TOTAIS\b/i.test(line.text) && columns && columnPage === line.page) { const result = positionedFields(line, columns); if (result.segura) totalsFound.push(result.fields); continue; }
      const m = line.text.match(/^\s*(\d{2}\/\d{2}(?:\/\d{4})?)(?=\s|$)/);
      if (!m) continue;
      const date = resolveDate(m[1]);
      const rest = line.text.slice(m[0].length);
      const tokens = rest.match(/[+-]?\d{1,3}:\d{2}(?:\*|\^|[mM])?|--:--/g) || [];
      const low = normalizeName(rest);
      const tipo_dia = /feriado/.test(low) ? 'feriado' : /folga|dsr|descanso/.test(low) ? 'folga' : /ferias|afastamento|abono|atestado|pre.assinal|compensa/.test(low) ? 'justificativa' : 'trabalho';
      const positioned = columns && columnPage === line.page ? positionedFields(line, columns) : null;
      const weekday = rest.match(/^\s*-?\s*(Dom|Seg|Ter|Qua|Qui|Sex|S[aá]b|Fer)(?=\s|$)/i);
      const markers = [...new Set(tokens.map(t => t.match(/[*^mM]$/)?.[0]).filter(Boolean))];
      rows.push({ data: date, data_documento: m[1], dia_semana_documento: weekday?.[1] || null, pagina: line.page, tokens, campos_documento: positioned?.fields || null, colunas_seguras: positioned?.segura || false, tipo_dia, marcacao_manual: /manual/.test(low) || markers.some(marker => legends.some(l => l.marcador === marker && /manual/i.test(l.descricao))), marcadores: markers, pre_assinalado: markers.some(marker => legends.some(l => l.marcador === marker && /pr[eé].?assinal/i.test(l.descricao))), ambigua: !date || (!!start && (date < start || date > end)) });
    }
    const counts = new Map();
    rows.forEach(r => counts.set(r.data, (counts.get(r.data) || 0) + 1));
    rows.forEach(r => { if (r.data && counts.get(r.data) > 1) r.ambigua = true; });
    const uniqueJustifications = [...new Map(justifications.map(j => [JSON.stringify([j.data, j.hora, j.codigo_ocorrencia, j.descricao]), j])).values()];
    rows.forEach(r => { r.justificativas = uniqueJustifications.filter(j => j.data === r.data).map(j => ({ ...j, batidas_relacionadas: Object.keys(r.campos_documento || {}).filter(k => /^(entrada|saida)_\d+$/.test(k) && r.campos_documento[k]?.replace(/[*^mM]$/, '') === j.hora) })); });
    const orphan = uniqueJustifications.filter(j => !rows.some(r => r.data === j.data));
    if (orphan.length) warnings.push('Há justificativas sem registro diário correspondente. Confira antes de salvar.');
    if (unparsed.length) warnings.push('Há justificativas que não puderam ser interpretadas com segurança.');
    const documentPeriods = [...new Map(periods.map(p => [JSON.stringify(p), p])).values()];
    const uniqueTotals = [...new Map(totalsFound.map(t => [JSON.stringify(t), t])).values()];
    const totals = uniqueTotals.length === 1 ? uniqueTotals[0] : null;
    if (uniqueTotals.length > 1) warnings.push('Há totais diferentes entre páginas. O saldo final não foi assumido.');
    if (!rows.length || rows.some(r => !r.colunas_seguras)) warnings.push(UNCERTAIN_CARD);
    if (rows.some(r => r.ambigua)) warnings.push('Há datas inválidas, repetidas ou fora do período. Confira o documento antes de salvar.');
    const linkedJustifications = rows.flatMap(r => r.justificativas).concat(orphan);
    // A schedule's weekday and its times can have different text baselines.
    // Pair cells geometrically within the schedule region, bounded by headers.
    for (const [index, header] of lines.entries()) {
      const schedule = headerColumns(header, 'jornada');
      if (!schedule) continue;
      const region = [];
      for (const candidate of lines.slice(index + 1)) {
        if (candidate.page !== header.page || headerColumns(candidate) || headerColumns(candidate, 'jornada') || /JUSTIFICATIVAS/i.test(candidate.text)) break;
        region.push(...(candidate.cells || []).map(c => ({ ...c, y: c.y ?? candidate.baseline })));
      }
      const weekdays = region.filter(c => c.x < schedule[0].x && /^(DOMINGO|SEGUNDA(?:-FEIRA)?|TER[CÇ]A(?:-FEIRA)?|QUARTA(?:-FEIRA)?|QUINTA(?:-FEIRA)?|SEXTA(?:-FEIRA)?|S[AÁ]BADO|DOM|SEG|TER|QUA|QUI|SEX|SAB)$/i.test(c.text.trim()) && Number.isFinite(c.y));
      if (weekdays.length < 2) continue;
      const distances = weekdays.flatMap((a, i) => weekdays.slice(i + 1).map(b => Math.abs(a.y - b.y))).filter(d => d > 0);
      const limit = Math.min(...distances) / 2;
      const candidates = region.filter(c => c.x >= schedule[0].x - (schedule[1].x - schedule[0].x) / 2 && /^[0-2]\d:[0-5]\d[*^mM]?$/.test(c.text.trim()) && Number.isFinite(c.y));
      const schedules = weekdays.map(day => {
        const cells = candidates.filter(c => {
          const closest = [...weekdays].sort((a, b) => Math.abs(a.y - c.y) - Math.abs(b.y - c.y))[0];
          return closest === day && Math.abs(day.y - c.y) < limit;
        });
        const result = positionedFields({ cells }, schedule);
        return { dia_documento: day.text, dia_semana: ['dom','seg','ter','qua','qui','sex','sab'].indexOf(normalizeName(day.text).slice(0, 3)), campos_documento: result.fields, segura: result.segura, pagina: header.page };
      });
      documentSchedules.splice(0, documentSchedules.length, ...schedules);
    }
    return { rows, warnings, nome: names.size === 1 ? [...names][0] : '', nomes_ambiguos: names.size > 1, justificativas: linkedJustifications, justificativas_nao_interpretadas: unparsed, justificativas_sem_registro: orphan, periodos_documento: documentPeriods, jornadas_documento: documentSchedules, legendas_documento: legends, totais_documento: totals, paginas_processadas: new Set(lines.map(l => l.page)).size };
  }
  // A mapping is explicitly confirmed by the leader; source values are never edited.
  function interpret(row, mapping, confirmed) {
    if (row.campos_documento) {
      const fields = row.campos_documento;
      const clean = v => /^[0-2]\d:[0-5]\d[*^mM]?$/.test(v || '') ? v.replace(/[*^mM]$/, '') : null;
      const punches = TABLE_KEYS.slice(0, 4).map(k => clean(fields[k]));
      const additional = Object.keys(fields).filter(k => /^(entrada|saida)_\d+$/.test(k) && +k.split('_')[1] > 2).map(k => clean(fields[k]));
      return { data: row.data, batidas: punches, batidas_adicionais: additional, totais: Object.fromEntries(TABLE_KEYS.slice(6).map(k => [k, fields[k] ?? null])), tipo_dia: row.tipo_dia, marcacao_manual: row.marcacao_manual, pre_assinalado: row.pre_assinalado, justificativas: row.justificativas || [], segura: !!confirmed && !row.ambigua && row.colunas_seguras && TABLE_KEYS.slice(0, 4).every(k => Object.hasOwn(fields, k)) && !additional.some(Boolean), ausente_explicita: punches.some(v => v === null), motivo_incerteza: UNCERTAIN };
    }
    const take = key => {
      const index = mapping[key];
      return Number.isInteger(index) && index >= 0 ? row.tokens[index] ?? null : null;
    };
    const punches = ['entrada_1', 'saida_1', 'entrada_2', 'saida_2'].map(take);
    const totalKeys = ['horas_normais', 'debito', 'credito', 'saldo'];
    const used = Object.values(mapping).filter(v => Number.isInteger(v) && v >= 0);
    const missing = punches.some(p => p === null) || used.some(i => i >= row.tokens.length);
    const unknownTokens = row.tokens.some((_, i) => !used.includes(i));
    return { data: row.data, batidas: punches.map(p => p === '--:--' ? null : p?.replace(/[mM*^]$/, '') ?? null), totais: Object.fromEntries(totalKeys.map(k => [k, take(k)])), tipo_dia: row.tipo_dia, marcacao_manual: row.marcacao_manual, pre_assinalado: row.pre_assinalado, justificativas: row.justificativas || [],
      segura: !!confirmed && !row.ambigua && (!missing || (row.tokens.length === 0 && ['folga', 'feriado', 'justificativa'].includes(row.tipo_dia))) && !unknownTokens && new Set(used).size === used.length,
      ausente_explicita: punches.includes('--:--'), motivo_incerteza: UNCERTAIN };
  }
  function analyze(record, schedule, rules = DEFAULT_RULES) {
    const occurrences = [];
    const add = (type, classification, description) => occurrences.push({ tipo: type, classificacao_automatica: classification, descricao: description });
    const action = (type, rule, description) => { if (rule !== 'ignorar') add(type, rule === 'inconsistencia' ? 'INCONSISTÊNCIA' : rule === 'conferir' ? 'CONFERIR' : 'REGULAR', description); };
    let worked = null, expected = schedule?.minutos_esperados ?? null;
    if (!record.segura || !record.data) add('extracao', 'CONFERIR', UNCERTAIN);
    else if (!schedule) add('jornada', 'CONFERIR', 'Não há jornada cadastrada para este dia.');
    else {
      const punches = record.batidas, short = schedule.sem_intervalo === true, unexpected = short && punches.slice(2).some(p => minutes(p) !== null), values = punches.slice(0, short ? 2 : 4).map(p => minutes(p));
      const hasPunches = values.some(v => v !== null);
      if (record.marcacao_manual) action('manual', rules.regra_batida_manual, 'O documento indica marcação manual.');
      if (record.tipo_dia === 'justificativa') add('justificativa', 'CONFERIR', 'O cartão indica justificativa, compensação ou registro pré-assinalado.');
      else if (!schedule.trabalha || ['folga', 'feriado'].includes(record.tipo_dia)) {
        if (hasPunches) action('folga', rules.regra_folga, 'Trabalho em folga ou feriado.');
      } else if (unexpected) add('jornada', 'CONFERIR', 'Há batidas adicionais para a jornada excepcional sem intervalo.');
      else if (values.some(v => v === null)) {
        if (record.ausente_explicita) action('ausente', rules.regra_batida_ausente, 'O cartão indica batida ausente.');
        else add('extracao', 'CONFERIR', UNCERTAIN);
      } else if (values.some((v, i) => i > 0 && v <= values[i - 1])) {
        add('sequencia', 'CONFERIR', 'Batidas fora de sequência; verificar possível jornada noturna ou inversão.');
      } else if (!Number.isInteger(expected) || expected <= 0) add('jornada', 'CONFERIR', 'Jornada diária não definida.');
      else {
        worked = values[1] - values[0] + (short ? 0 : values[3] - values[2]);
        const planned = ['entrada_1', 'saida_1', 'entrada_2', 'saida_2'].slice(0, short ? 2 : 4).map(k => minutes(schedule[k]));
        if (planned.some(v => v === null) || planned.some((v, i) => i > 0 && v <= planned[i - 1])) add('jornada', 'CONFERIR', 'Horários cadastrados incompletos ou jornada noturna; conferir a jornada.');
        else {
          const deviations = values.map((v, i) => Math.max(0, i % 2 ? planned[i] - v : v - planned[i]));
          const sum = deviations.reduce((a, b) => a + b, 0);
          const exceeds = deviations.some(d => d > rules.tolerancia_batida) || sum > rules.tolerancia_diaria;
          const debit = minutes(record.totais?.debito, true), credit = minutes(record.totais?.credito, true);
          const hasCompensation = credit !== null && credit > 0;
          const deficit = expected - worked;
          const documentConflict = (debit === 0 && deficit > rules.tolerancia_diaria) || (debit !== null && debit > rules.tolerancia_diaria && worked >= expected);
          if (hasCompensation || documentConflict) add('compensacao', 'CONFERIR', 'Crédito ou totais do cartão exigem conferência da compensação.');
          else if (deficit > rules.tolerancia_diaria) action('debito', rules.regra_debito, `Jornada ${deficit} minutos inferior à esperada.`);
          if (exceeds) add('horario', (deficit > rules.tolerancia_diaria && !hasCompensation && !documentConflict) ? 'INCONSISTÊNCIA' : 'CONFERIR', 'Diferença de horário acima da tolerância; verificar compensação ou autorização.');
          if (worked - expected > rules.tolerancia_diaria) action('extra', rules.regra_hora_extra, `${worked - expected} minutos além da jornada esperada.`);
        }
      }
    }
    const classification = occurrences.some(o => o.classificacao_automatica === 'INCONSISTÊNCIA') ? 'INCONSISTÊNCIA' : occurrences.some(o => o.classificacao_automatica === 'CONFERIR') ? 'CONFERIR' : 'REGULAR';
    return { versao: VERSION, classificacao: classification, minutos_trabalhados: worked, minutos_esperados: expected, saldo_calculado: worked !== null && expected !== null ? worked - expected : null, ocorrencias: occurrences };
  }
  const api = { VERSION, UNCERTAIN, UNCERTAIN_CARD, DEFAULT_RULES, TABLE_KEYS, minutes, dateISO, normalizeName, identify, pageLines, extract, interpret, analyze };
  root.PontoEngine = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
