const fs = require('node:fs');
const vm = require('node:vm');

module.exports = ({ describe, it, assert }) => {
  const context = { document: { readyState: 'loading', addEventListener() {} } };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(require.resolve('../static/globalFilters.js'), 'utf8'), context);
  describe('Rótulos dos meses', () => {
    it('exibe mês e ano por extenso sem misturar setembro e outubro', () => {
      assert.equal(context.formatFilterMonth('2026-09'), 'setembro de 2026');
      assert.equal(context.formatFilterMonth('2026-10'), 'outubro de 2026');
      assert.equal(context.formatFilterMonth('2027-01'), 'janeiro de 2027');
    });
    it('mantém opções especiais e rejeita meses inválidos sem lançar erro', () => {
      assert.equal(context.formatFilterMonth('all'), 'all');
      assert.equal(context.formatFilterMonth('2026-13'), '2026-13');
      assert.equal(context.formatFilterMonth(''), '');
    });
  });
};
