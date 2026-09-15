const activities = require('../static/atividades-mes.js');
module.exports = ({ describe, it, assert }) => {
  describe('Atividades do mês', () => {
    it('normaliza meses e datas brasileiras sem misturar anos', () => {
      assert.equal(activities.monthKey('15/09/2026'), '2026-09');
      assert.equal(activities.monthKey('09/2025'), '2025-09');
      assert.equal(activities.monthKey('2026-09-01'), '2026-09');
      assert.equal(activities.monthKey('2026-13'), '');
    });
    it('separa notas comuns e rejeita registros inválidos', () => {
      assert.equal(activities.decode({ conteudo: 'Anotação pessoal' }), null);
      assert.equal(activities.decode({ conteudo: 'atividade-colaborador:v1:{' }), null);
      assert.equal(activities.decode({ conteudo: 'atividade-colaborador:v1:{"tipo":"outro"}' }), null);
    });
    it('recupera classificação, pessoa e mês de uma atividade persistida', () => {
      const record = activities.decode({ id:'123', data:'2026-09-01', conteudo:'atividade-colaborador:v1:' + JSON.stringify({ colaborador:'Ana', tipo:'positivo', descricao:'Ajudou a equipe' }) });
      assert.equal(record.mes, '2026-09'); assert.equal(record.tipo, 'positivo'); assert.equal(record.descricao, 'Ajudou a equipe');
    });
    const list = [
      { colaborador:'Ana', mes:'2026-09', tipo:'positivo', descricao:'Ajudou a equipe' },
      { colaborador:'Ana', mes:'2026-09', tipo:'atencao', descricao:'Atrasou a entrega' },
      { colaborador:'Ana', mes:'2026-08', tipo:'positivo', descricao:'Treinamento anterior' },
      { colaborador:'Bia', mes:'2026-09', tipo:'positivo', descricao:'Registro de outra pessoa' }
    ];
    it('inclui positivos e atenção apenas da pessoa e do mês selecionados', () => {
      const result = activities.textFor(list, ' ana ', '09/2026');
      assert.ok(result.includes('🟢 Positivo')); assert.ok(result.includes('🔴 Ponto de atenção'));
      assert.ok(!result.includes('Treinamento anterior')); assert.ok(!result.includes('outra pessoa'));
    });
    it('todos os meses mantém o filtro de colaborador', () => {
      const result = activities.textFor(list, 'Ana', 'all');
      assert.ok(result.includes('Treinamento anterior')); assert.ok(!result.includes('outra pessoa'));
    });
    it('não inventa registros para períodos vazios', () => {
      assert.equal(activities.textFor(list, 'Ana', '2025-09'), '');
    });
  });
};
