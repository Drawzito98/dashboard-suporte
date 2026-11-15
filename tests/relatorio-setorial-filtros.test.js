const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

module.exports = ({ describe, it, assert }) => {
  describe('Relatório Setorial — recorte independente', () => {
    const records = Array.from({ length: 9 }, (_, index) => ({
      Atendente: 'Ana', Setor: 'Fiscal', Mês: '2026-0' + (index + 1)
    }));
    records.push(
      { Atendente: 'Bia', Setor: 'Financeiro', Mês: '2026-09' },
      { Atendente: 'Total', Setor: 'Fiscal', Mês: '2026-09' }
    );
    const context = vm.createContext({
      rawRecords: records,
      isAggregateName: name => name === 'Total',
      isSetorActive: () => true,
      _nivelColaborador: name => name === 'Ana' ? 'N1' : 'N2',
      getCurrentFilteredRows() { throw new Error('Filtro global consultado'); }
    });
    const code = fs.readFileSync(path.join(__dirname, '../static/relatorio-setorial.js'), 'utf8');
    vm.runInContext(code, context);
    const evaluate = expression => vm.runInContext(expression, context);

    it('combina pessoa, setor e nível a partir dos registros do relatório', () => {
      assert.equal(evaluate("_rsPopulation(_rsData(), {person:'Ana', sector:'Fiscal', level:'N1'}).length"), 9);
      assert.equal(evaluate("_rsPopulation(_rsData(), {person:'Ana', sector:'Financeiro'}).length"), 0);
      assert.equal(evaluate('_rsData().length'), 10);
    });

    it('aceita intervalo explícito com mais de seis meses', () => {
      assert.equal(evaluate("_rsPeriod(_rsPopulation(_rsData(), {person:'Ana'}), {monthStart:'2026-01', monthEnd:'2026-08'}).rows.length"), 8);
    });

    it('limita os registros exibidos aos meses recentes quando o intervalo fica em aberto', () => {
      const result = evaluate("_rsPeriod(_rsPopulation(_rsData(), {person:'Ana'}), {})");
      assert.equal(result.rows.length, 6);
      assert.equal(result.months[0], '2026-04');
      assert.equal(result.months[5], '2026-09');
    });
  });
};
