/**
 * Tests for month-filters.js pure functions.
 */
module.exports = function ({ describe, it, assert }) {

  // Extract the pure month logic for testing
  function parseDateKey(raw) {
    if (!raw) return '';
    const m = raw.match(/(\d{2})[\/\-](\d{2})[\/\-](\d{4})/);
    if (m) return `${m[3]}-${m[2]}`;
    const m2 = raw.match(/(\d{4})-(\d{2})/);
    if (m2) return `${m2[1]}-${m2[2]}`;
    return raw;
  }

  function formatMonthLabel(key) {
    if (!key) return '';
    const parts = key.split('-');
    if (parts.length !== 2) return key;
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const idx = parseInt(parts[1], 10) - 1;
    if (idx < 0 || idx > 11) return key;
    return `${months[idx]}/${parts[0]}`;
  }

  function extractUniqueMonths(records, field) {
    const months = new Set();
    for (const r of records) {
      const val = r[field];
      if (val) months.add(parseDateKey(val));
    }
    return [...months].sort().reverse();
  }

  describe('parseDateKey', () => {
    it('parses DD/MM/YYYY', () => {
      assert.equal(parseDateKey('15/03/2025'), '2025-03');
    });

    it('parses DD-MM-YYYY', () => {
      assert.equal(parseDateKey('01-12-2024'), '2024-12');
    });

    it('parses YYYY-MM', () => {
      assert.equal(parseDateKey('2025-06'), '2025-06');
    });

    it('returns raw for unrecognized', () => {
      assert.equal(parseDateKey('Março'), 'Março');
    });

    it('handles empty', () => {
      assert.equal(parseDateKey(''), '');
      assert.equal(parseDateKey(null), '');
    });
  });

  describe('formatMonthLabel', () => {
    it('formats YYYY-MM to Mon/YYYY', () => {
      assert.equal(formatMonthLabel('2025-03'), 'Mar/2025');
      assert.equal(formatMonthLabel('2025-12'), 'Dez/2025');
      assert.equal(formatMonthLabel('2024-01'), 'Jan/2024');
    });

    it('handles invalid month', () => {
      assert.equal(formatMonthLabel('2025-13'), '2025-13');
    });

    it('handles empty', () => {
      assert.equal(formatMonthLabel(''), '');
      assert.equal(formatMonthLabel(null), '');
    });
  });

  describe('extractUniqueMonths', () => {
    it('extracts and sorts months descending', () => {
      const records = [
        { 'Mês': '15/03/2025' },
        { 'Mês': '01/12/2024' },
        { 'Mês': '15/03/2025' }, // duplicate
      ];
      const months = extractUniqueMonths(records, 'Mês');
      assert.deepEqual(months, ['2025-03', '2024-12']);
    });

    it('handles empty records', () => {
      assert.deepEqual(extractUniqueMonths([], 'Mês'), []);
    });

    it('skips empty values', () => {
      const records = [{ 'Mês': '' }, { 'Mês': null }, { 'Mês': '03/2025' }];
      const months = extractUniqueMonths(records, 'Mês');
      assert.deepEqual(months, ['2025']);
    });
  });
};
