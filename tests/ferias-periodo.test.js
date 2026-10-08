const { getFeriasPeriodo, getFeriasResultado } = require('../static/ferias-periodo.js');
const fs = require('node:fs');
const vm = require('node:vm');

module.exports = ({ describe, it, assert }) => {
  const ferias = [{ colaborador: 'João Silva', data_inicio: '2026-08-25', data_fim: '2026-09-10' }];
  describe('Férias nos resultados', () => {
    it('cruza nomes normalizados e conta apenas os dias do mês analisado', () => {
      const result = getFeriasPeriodo(' JOAO   SILVA ', ['2026-09'], ferias);
      assert.equal(result.dias, 10);
      assert.equal(result.periodos.length, 1);
    });
    it('não marca férias em outro mês, ano ou colaborador', () => {
      assert.equal(getFeriasPeriodo('João Silva', ['2026-10'], ferias).dias, 0);
      assert.equal(getFeriasPeriodo('João Silva', ['2025-09'], ferias).dias, 0);
      assert.equal(getFeriasPeriodo('Maria', ['2026-09'], ferias).dias, 0);
    });
    it('conta datas inclusivas, ano bissexto e meses descontínuos sem duplicar sobreposições', () => {
      const rows = [{ colaborador: 'Ana', data_inicio: '2024-02-28', data_fim: '2024-04-02' }, { colaborador: 'Ana', data_inicio: '2024-04-01', data_fim: '2024-04-02' }];
      assert.equal(getFeriasPeriodo('Ana', ['2024-02', '2024-04', '2024-04'], rows).dias, 4);
    });
    it('ignora datas inválidas e intervalos invertidos', () => {
      assert.equal(getFeriasPeriodo('Ana', ['2026-09'], [{ colaborador: 'Ana', data_inicio: '2026-02-30', data_fim: '2026-09-20' }, { colaborador: 'Ana', data_inicio: '2026-09-10', data_fim: '2026-09-01' }]).dias, 0);
    });
    it('mantém indicação nas observações sem inventar datas', () => {
      const previous = global.localStorage;
      global.localStorage = { getItem: () => '[]' };
      try {
        const result = getFeriasResultado('Ana', [{ 'Mês': '2026-09', 'Observações': 'Férias' }]);
        assert.equal(result.esteve, true);
        assert.equal(result.dias, 0);
        assert.ok(result.detalhes.includes('sem datas cadastradas'));
      } finally { global.localStorage = previous; }
    });
    it('mostra datas e aviso de férias na tabela de resultados individuais', () => {
      const host = { innerHTML: '' };
      const context = {
        rawRecords: [{ Atendente: 'João Silva', Setor: 'Suporte', 'Mês': '2026-09', Assumidos: 100, Finalizados: 80, Transferidos: 5, SCORE: 4.8 }],
        localStorage: { getItem: key => key === 'sistema_ferias_v1' ? JSON.stringify(ferias) : null },
        document: { getElementById: id => id === 'saudeOperacionalContent' ? host : null },
        window: { addEventListener() {} },
        escapeHtml: value => String(value)
      };
      vm.createContext(context);
      vm.runInContext(fs.readFileSync(require.resolve('../static/ferias-periodo.js'), 'utf8'), context);
      vm.runInContext(fs.readFileSync(require.resolve('../static/saude-operacional.js'), 'utf8'), context);
      context.window.renderOperationalHealth();
      assert.ok(host.innerHTML.includes('Férias no período'));
      assert.ok(host.innerHTML.includes('Esteve de férias'));
      assert.ok(host.innerHTML.includes('25/08/2026 a 10/09/2026'));
      assert.ok(host.innerHTML.includes('10 dia(s)'));
    });
  });
};
