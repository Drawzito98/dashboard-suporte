/**
 * CSV Validator — client-side validation before import.
 * Ported from scripts/validate_csv.py with browser UI integration.
 */
const CSVValidator = (() => {
  const REQUIRED_HEADERS = ['Setor', 'Mês', 'Atendente'];
  const NUMERIC_HEADERS = ['Finalizados', 'Assumidos', 'Transferidos', 'Total', 'Nota1', 'Nota2', 'Nota3'];
  const SCORE_HEADERS = ['SCORE', 'Score'];
  const MONTH_HEADER = 'Mês';

  function normalizeHeader(h) {
    return (h || '').normalize('NFKD').replace(/[\s\u00A0]+/g, '').replace(/[^a-zA-ZÀ-ú]/gi, '').toLowerCase();
  }

  function matchHeader(raw, targets) {
    const norm = normalizeHeader(raw);
    return targets.some(t => norm.includes(normalizeHeader(t)));
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

  function parseMonth(raw) {
    if (!raw) return '';
    const m1 = raw.match(/(\d{2})[\/\-](\d{2})[\/\-](\d{4})/);
    if (m1) return `${m1[3]}-${m1[2]}`;
    const m2 = raw.match(/(\d{4})-(\d{2})/);
    if (m2) return `${m2[1]}-${m2[2]}`;
    return raw;
  }

  function isAggregateName(name) {
    if (!name) return false;
    const s = String(name).normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
    return /\b(media|media set|media setor|media seto|total)\b/.test(s);
  }

  /**
   * Validate parsed CSV data.
   * @param {Array<Object>} rows - parsed CSV rows
   * @param {Array<string>} fields - column headers
   * @returns {{ valid: boolean, warnings: string[], errors: string[], stats: Object }}
   */
  function validate(rows, fields) {
    const warnings = [];
    const errors = [];
    const stats = {
      totalRows: rows.length,
      validRows: 0,
      emptyRows: 0,
      aggregateRows: 0,
      uniqueSetores: new Set(),
      uniqueAtendentes: new Set(),
      uniqueMeses: new Set(),
      finalizadosSum: {},
      scoreCount: 0,
      scoreMissing: 0,
      scoreSum: 0,
      detectedHeaders: fields,
      missingRequired: [],
      missingRecommended: [],
    };

    // Check headers
    const normFields = fields.map(f => normalizeHeader(f));
    for (const req of REQUIRED_HEADERS) {
      const found = fields.some(f => matchHeader(f, [req]));
      if (!found) {
        errors.push(`Coluna obrigatória não encontrada: "${req}"`);
        stats.missingRequired.push(req);
      }
    }

    // Check recommended headers
    const recommended = ['Finalizados', 'SCORE', 'Assumidos', 'Transferidos'];
    for (const rec of recommended) {
      const found = fields.some(f => matchHeader(f, [rec]));
      if (!found) {
        warnings.push(`Coluna recomendada não encontrada: "${rec}"`);
        stats.missingRecommended.push(rec);
      }
    }

    // Process rows
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const values = Object.values(r);
      const isEmpty = values.every(v => !v || String(v).trim() === '');
      if (isEmpty) {
        stats.emptyRows++;
        continue;
      }

      // Find header-mapped values
      const setorKey = fields.find(f => matchHeader(f, ['Setor']));
      const mesKey = fields.find(f => matchHeader(f, ['Mês', 'Mes']));
      const atendKey = fields.find(f => matchHeader(f, ['Atendente']));
      const finalKey = fields.find(f => matchHeader(f, ['Finalizados', 'Finalizado']));
      const scoreKey = fields.find(f => matchHeader(f, SCORE_HEADERS));

      const setor = r[setorKey] || '';
      const mes = r[mesKey] || '';
      const atend = r[atendKey] || '';

      if (!setor || !mes || !atend) {
        if (i < 3 || (i % Math.ceil(rows.length / 10) === 0)) {
          warnings.push(`Linha ${i + 2}: campos obrigatórios vazios (Setor/Mês/Atendente)`);
        }
        continue;
      }

      if (isAggregateName(atend) || isAggregateName(setor)) {
        stats.aggregateRows++;
        continue;
      }

      stats.validRows++;
      stats.uniqueSetores.add(setor.trim());
      stats.uniqueMeses.add(parseMonth(mes));
      stats.uniqueAtendentes.add(atend.trim());

      // Finalizados
      if (finalKey) {
        const fn = normalizeNumber(r[finalKey]);
        const fnn = fn !== '' ? parseInt(fn, 10) : null;
        if (fnn != null) {
          stats.finalizadosSum[atend.trim()] = (stats.finalizadosSum[atend.trim()] || 0) + fnn;
        }
      }

      // SCORE
      if (scoreKey) {
        const sv = normalizeNumber(r[scoreKey]);
        const sf = parseFloat(sv);
        if (!isNaN(sf) && isFinite(sf)) {
          stats.scoreSum += sf;
          stats.scoreCount++;
        } else {
          stats.scoreMissing++;
        }
      }
    }

    if (stats.validRows === 0 && rows.length > 0) {
      errors.push('Nenhuma linha válida encontrada. Verifique se as colunas estão corretas.');
    }

    stats.scoreAvg = stats.scoreCount > 0 ? (stats.scoreSum / stats.scoreCount).toFixed(2) : null;

    // Top 5 by finalizados
    stats.topFinalizados = Object.entries(stats.finalizadosSum)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    // Clean up Sets for JSON
    stats.uniqueSetores = stats.uniqueSetores.size;
    stats.uniqueAtendentes = stats.uniqueAtendentes.size;
    stats.uniqueMeses = stats.uniqueMeses.size;

    return {
      valid: errors.length === 0,
      warnings,
      errors,
      stats,
    };
  }

  /**
   * Format validation result for display.
   */
  function formatReport(result) {
    const { warnings, errors, stats } = result;
    const lines = [];

    lines.push(`<strong>Linhas:</strong> ${stats.totalRows} total, ${stats.validRows} válidas, ${stats.emptyRows} vazias, ${stats.aggregateRows} agregadas`);
    lines.push(`<strong>Setores:</strong> ${stats.uniqueSetores} | <strong>Atendentes:</strong> ${stats.uniqueAtendentes} | <strong>Períodos:</strong> ${stats.uniqueMeses}`);

    if (stats.topFinalizados && stats.topFinalizados.length) {
      lines.push('<strong>Top 5 Finalizados:</strong>');
      stats.topFinalizados.forEach(([name, count], i) => {
        lines.push(`&nbsp;&nbsp;${i + 1}. ${name}: ${count}`);
      });
    }

    if (stats.scoreAvg != null) {
      lines.push(`<strong>SCORE médio:</strong> ${stats.scoreAvg} (${stats.scoreCount} registros, ${stats.scoreMissing} ausentes)`);
    }

    if (stats.missingRequired.length) {
      lines.push(`<span class="csv-val-error">Colunas obrigatórias ausentes: ${stats.missingRequired.join(', ')}</span>`);
    }
    if (stats.missingRecommended.length) {
      lines.push(`<span class="csv-val-warn">Colunas recomendadas ausentes: ${stats.missingRecommended.join(', ')}</span>`);
    }

    warnings.slice(0, 5).forEach(w => {
      lines.push(`<span class="csv-val-warn">${w}</span>`);
    });
    if (warnings.length > 5) {
      lines.push(`<span class="csv-val-warn">... e mais ${warnings.length - 5} avisos</span>`);
    }

    errors.forEach(e => {
      lines.push(`<span class="csv-val-error">${e}</span>`);
    });

    return lines.join('<br>');
  }

  return { validate, formatReport, normalizeNumber, parseMonth, isAggregateName };
})();
