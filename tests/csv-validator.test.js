/**
 * Tests for csv-validator.js pure functions.
 */
module.exports = function ({ describe, it, assert }) {

  // Inline the pure functions for testing (they're in an IIFE in the browser)
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

  function normalizeHeader(h) {
    return (h || '').normalize('NFKD').replace(/[\s\u00A0]+/g, '').replace(/[^a-zA-ZÀ-ú]/gi, '').toLowerCase();
  }

  function matchHeader(raw, targets) {
    const norm = normalizeHeader(raw);
    return targets.some(t => norm.includes(normalizeHeader(t)));
  }

  describe('normalizeNumber', () => {
    it('handles plain integers', () => {
      assert.equal(normalizeNumber('123'), '123');
    });

    it('handles Brazilian format (1.234,56)', () => {
      assert.equal(normalizeNumber('1.234,56'), '1234.56');
    });

    it('handles US format (1,234.56)', () => {
      assert.equal(normalizeNumber('1,234.56'), '1234.56');
    });

    it('handles non-breaking spaces', () => {
      assert.equal(normalizeNumber('1\u00A0000'), '1000');
    });

    it('handles empty/null', () => {
      assert.equal(normalizeNumber(''), '');
      assert.equal(normalizeNumber(null), '');
      assert.equal(normalizeNumber(undefined), '');
    });

    it('strips non-numeric chars', () => {
      assert.equal(normalizeNumber('R$ 1.234,56'), '1234.56');
    });

    it('handles negative numbers', () => {
      assert.equal(normalizeNumber('-1.234,56'), '-1234.56');
    });
  });

  describe('parseMonth', () => {
    it('parses DD/MM/YYYY', () => {
      assert.equal(parseMonth('15/03/2025'), '2025-03');
    });

    it('parses DD-MM-YYYY', () => {
      assert.equal(parseMonth('15-03-2025'), '2025-03');
    });

    it('parses YYYY-MM', () => {
      assert.equal(parseMonth('2025-03'), '2025-03');
    });

    it('returns raw if no match', () => {
      assert.equal(parseMonth('Março 2025'), 'Março 2025');
    });

    it('handles empty/null', () => {
      assert.equal(parseMonth(''), '');
      assert.equal(parseMonth(null), '');
    });
  });

  describe('isAggregateName', () => {
    it('detects MÉDIA', () => {
      assert.ok(isAggregateName('MÉDIA'));
    });

    it('detects MÉDIA SETOR', () => {
      assert.ok(isAggregateName('MÉDIA SETOR'));
    });

    it('detects TOTAL', () => {
      assert.ok(isAggregateName('TOTAL'));
    });

    it('rejects normal names', () => {
      assert.ok(!isAggregateName('João Silva'));
    });

    it('handles null/empty', () => {
      assert.ok(!isAggregateName(null));
      assert.ok(!isAggregateName(''));
    });
  });

  describe('normalizeHeader', () => {
    it('normalizes headers', () => {
      assert.equal(normalizeHeader('Setor 🖥️'), 'setor');
      assert.equal(normalizeHeader('Atendente 🙋'), 'atendente');
      assert.equal(normalizeHeader('Mês'), 'mes');
    });
  });

  describe('matchHeader', () => {
    it('matches Setor variants', () => {
      assert.ok(matchHeader('Setor 🖥️', ['Setor']));
      assert.ok(matchHeader('Setor', ['Setor']));
      assert.ok(matchHeader('setor ', ['Setor']));
    });

    it('matches Mês variants', () => {
      assert.ok(matchHeader('Mês', ['Mês', 'Mes']));
      assert.ok(matchHeader('Mes', ['Mês', 'Mes']));
    });

    it('does not false-match', () => {
      assert.ok(!matchHeader('Nome', ['Setor']));
    });
  });

  describe('validate', () => {
    const validate = (rows, fields) => {
      const warnings = [];
      const errors = [];
      const stats = { totalRows: rows.length, validRows: 0, emptyRows: 0, aggregateRows: 0,
        uniqueSetores: new Set(), uniqueAtendentes: new Set(), uniqueMeses: new Set(),
        finalizadosSum: {}, scoreCount: 0, scoreMissing: 0, scoreSum: 0,
        detectedHeaders: fields, missingRequired: [], missingRecommended: [] };

      const REQUIRED = ['Setor', 'Mês', 'Atendente'];
      for (const req of REQUIRED) {
        if (!fields.some(f => matchHeader(f, [req]))) {
          errors.push(`Coluna obrigatória não encontrada: "${req}"`);
          stats.missingRequired.push(req);
        }
      }

      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const vals = Object.values(r);
        if (vals.every(v => !v || String(v).trim() === '')) { stats.emptyRows++; continue; }
        const setorKey = fields.find(f => matchHeader(f, ['Setor']));
        const mesKey = fields.find(f => matchHeader(f, ['Mês', 'Mes']));
        const atendKey = fields.find(f => matchHeader(f, ['Atendente']));
        const setor = r[setorKey] || '';
        const mes = r[mesKey] || '';
        const atend = r[atendKey] || '';
        if (!setor || !mes || !atend) continue;
        if (isAggregateName(atend) || isAggregateName(setor)) { stats.aggregateRows++; continue; }
        stats.validRows++;
        stats.uniqueSetores.add(setor.trim());
        stats.uniqueMeses.add(parseMonth(mes));
        stats.uniqueAtendentes.add(atend.trim());
      }

      return { valid: errors.length === 0, warnings, errors, stats };
    };

    it('rejects missing required columns', () => {
      const result = validate([{ a: '1' }], ['a']);
      assert.ok(!result.valid);
      assert.ok(result.errors.length > 0);
    });

    it('accepts valid data', () => {
      const rows = [
        { 'Setor': 'Suporte', 'Mês': '03/2025', 'Atendente': 'João', 'Finalizados': '10' },
        { 'Setor': 'Suporte', 'Mês': '03/2025', 'Atendente': 'Maria', 'Finalizados': '20' },
      ];
      const result = validate(rows, ['Setor', 'Mês', 'Atendente', 'Finalizados']);
      assert.ok(result.valid);
      assert.equal(result.stats.validRows, 2);
      assert.equal(result.stats.uniqueAtendentes, 2);
    });

    it('skips empty rows', () => {
      const rows = [
        { 'Setor': 'Suporte', 'Mês': '03/2025', 'Atendente': 'João' },
        { 'Setor': '', 'Mês': '', 'Atendente': '' },
      ];
      const result = validate(rows, ['Setor', 'Mês', 'Atendente']);
      assert.equal(result.stats.validRows, 1);
      assert.equal(result.stats.emptyRows, 1);
    });

    it('skips aggregate rows', () => {
      const rows = [
        { 'Setor': 'Suporte', 'Mês': '03/2025', 'Atendente': 'João' },
        { 'Setor': 'Suporte', 'Mês': '03/2025', 'Atendente': 'MÉDIA' },
      ];
      const result = validate(rows, ['Setor', 'Mês', 'Atendente']);
      assert.equal(result.stats.validRows, 1);
      assert.equal(result.stats.aggregateRows, 1);
    });
  });
};
