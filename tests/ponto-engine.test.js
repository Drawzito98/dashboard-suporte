const E = require('../static/ponto-engine.js');
module.exports = ({ describe, it, assert }) => {
  const journey = { trabalha: true, entrada_1: '08:00', saida_1: '12:00', entrada_2: '13:00', saida_2: '17:36', minutos_esperados: 516 };
  const record = (punches, extra = {}) => ({ data: '2026-09-14', segura: true, batidas: punches, totais: {}, tipo_dia: 'trabalho', marcacao_manual: false, ...extra });
  const mapping = { entrada_1: 0, saida_1: 1, entrada_2: 2, saida_2: 3 };
  describe('Auditoria de ponto — jornada excepcional sem intervalo', () => {
    const saturday = { trabalha: true, sem_intervalo: true, entrada_1: '09:00', saida_1: '13:00', minutos_esperados: 240 };
    it('aceita horário combinado com duas batidas e preserva as folgas', () => {
      const r = record(['09:00', '13:00', null, null]);
      assert.equal(E.analyze(r, saturday).classificacao, 'REGULAR');
      assert.equal(E.analyze(r, saturday).minutos_trabalhados, 240);
      assert.equal(E.analyze(r, { trabalha: false, minutos_esperados: 0 }).classificacao, 'CONFERIR');
    });
    it('identifica déficit e não ignora batidas adicionais', () => {
      assert.equal(E.analyze(record(['09:30', '13:00', null, null]), saturday).classificacao, 'INCONSISTÊNCIA');
      assert.equal(E.analyze(record(['09:00', '13:00', '14:00', '15:00']), saturday).classificacao, 'CONFERIR');
    });
  });
  describe('Auditoria de ponto — extração conservadora', () => {
    it('valida datas sem normalizar silenciosamente dias impossíveis', () => {
      assert.equal(E.dateISO('31/09/2026'), null); assert.equal(E.dateISO('29/02/2024'), '2024-02-29'); assert.equal(E.dateISO('29/02/2026'), null);
    });
    it('associa apenas um nome completo exato, tolerando acentos e espaços', () => {
      const people = [{ id: '1', nome: 'Dayane Alves Gouveia' }];
      assert.equal(E.identify('DAYANE ALVES GOUVEIA', people), '1'); assert.equal(E.identify('Dayane Gouveia', people), null);
      assert.equal(E.identify('Dayane Alves Gouveia', people.concat(people)), null);
    });
    it('preserva os valores originais do documento separadamente', () => {
      const source = '14/09/2026 Seg 08:51 12:19 13:24 17:53';
      const row = E.extract([{ text: source, page: 1, cells: [] }], '2026-09-01', '2026-10-03').rows[0];
      const before = JSON.stringify(row); const interpreted = E.interpret(row, mapping, true); E.analyze(interpreted, journey);
      assert.equal(JSON.stringify(row), before); assert.deepEqual(row.tokens, ['08:51', '12:19', '13:24', '17:53']);
    });
    it('não interpreta colunas sem confirmação do líder', () => {
      const row = E.extract([{ text: '14/09/2026 08:00 12:00 13:00 17:36', page: 1 }]).rows[0];
      assert.equal(E.analyze(E.interpret(row, mapping, false), journey).classificacao, 'CONFERIR');
    });
    it('totais não mapeados e linhas com batidas incompletas ficam para conferência', () => {
      for (const text of ['14/09/2026 08:00 12:00 13:00 17:36 08:36', '14/09/2026 08:00 12:00 17:36']) {
        const row = E.extract([{ text, page: 1 }]).rows[0];
        assert.equal(E.analyze(E.interpret(row, mapping, true), journey).classificacao, 'CONFERIR');
      }
    });
    it('coluna total faltante não permite deslocar valores silenciosamente', () => {
      const row = E.extract([{ text: '14/09/2026 08:00 12:00 17:36 08:36', page: 1 }]).rows[0];
      const interpreted = E.interpret(row, { ...mapping, horas_normais: 4 }, true);
      assert.equal(E.analyze(interpreted, journey).classificacao, 'CONFERIR');
    });
    it('usa ano somente quando o período informado resolve a data sem ambiguidade', () => {
      assert.equal(E.extract([{ text: '14/09 08:00 12:00 13:00 17:36', page: 1 }]).rows[0].data, null);
      assert.equal(E.extract([{ text: '14/09 08:00 12:00 13:00 17:36', page: 1 }], '2026-09-01', '2026-10-03').rows[0].data, '2026-09-14');
    });
    it('datas duplicadas não recebem classificação objetiva', () => {
      const rows = E.extract([{ text: '14/09/2026 08:00 12:00 13:00 17:36', page: 1 }, { text: '14/09/2026 08:00 12:00 13:00 17:36', page: 2 }]).rows;
      assert.ok(rows.every(r => r.ambigua));
    });
    it('folga expressa sem batidas é regular e não inventa horários', () => {
      const row = E.extract([{ text: '13/09/2026 DSR Folga', page: 1 }]).rows[0];
      const interpreted = E.interpret(row, mapping, true);
      assert.equal(E.analyze(interpreted, { trabalha: false, minutos_esperados: 0 }).classificacao, 'REGULAR');
      assert.deepEqual(interpreted.batidas, [null, null, null, null]);
    });
  });
  describe('Auditoria de ponto — regras determinísticas', () => {
    it('não sinaliza diferenças pequenas como erro', () => assert.equal(E.analyze(record(['08:01', '12:00', '13:00', '17:38']), journey).classificacao, 'REGULAR'));
    it('respeita a tolerância por batida e o limite acumulado', () => {
      const r = record(['08:04', '11:56', '13:04', '17:32']);
      assert.equal(E.analyze(r, journey).classificacao, 'INCONSISTÊNCIA');
      assert.equal(E.analyze(r, journey, { ...E.DEFAULT_RULES, tolerancia_diaria: 20 }).classificacao, 'REGULAR');
    });
    it('atraso compensado pela saída fica para conferir', () => assert.equal(E.analyze(record(['08:20', '12:00', '13:00', '17:56']), journey).classificacao, 'CONFERIR'));
    it('débito objetivo de jornada é inconsistência', () => assert.equal(E.analyze(record(['08:00', '12:00', '13:00', '17:00']), journey).classificacao, 'INCONSISTÊNCIA'));
    it('crédito do cartão evita decisão objetiva de débito', () => assert.equal(E.analyze(record(['08:00', '12:00', '13:00', '17:00'], { totais: { credito: '00:36' } }), journey).classificacao, 'CONFERIR'));
    it('divergência entre totais do cartão e cálculo exige conferência', () => assert.equal(E.analyze(record(['08:00', '12:00', '13:00', '17:00'], { totais: { debito: '00:00' } }), journey).classificacao, 'CONFERIR'));
    it('marcação manual permanece visível e para conferir por padrão', () => assert.equal(E.analyze(record(['08:00', '12:00', '13:00', '17:36'], { marcacao_manual: true }), journey).classificacao, 'CONFERIR'));
    it('hora extra informa sem classificar como inconsistência', () => {
      const result = E.analyze(record(['08:00', '12:00', '13:00', '18:00']), journey);
      assert.equal(result.classificacao, 'REGULAR'); assert.ok(result.ocorrencias.some(o => o.tipo === 'extra'));
    });
    it('trabalho em feriado e folga exige conferência', () => {
      assert.equal(E.analyze(record(['08:00', '12:00', '13:00', '17:36'], { tipo_dia: 'feriado' }), journey).classificacao, 'CONFERIR');
      assert.equal(E.analyze(record(['08:00', '12:00', '13:00', '17:36']), { trabalha: false, minutos_esperados: 0 }).classificacao, 'CONFERIR');
    });
    it('batida ausente expressa difere de extração incompleta', () => {
      const r = record(['08:00', null, '13:00', '17:36'], { ausente_explicita: true });
      assert.equal(E.analyze(r, journey).classificacao, 'INCONSISTÊNCIA');
      assert.equal(E.analyze({ ...r, segura: false }, journey).classificacao, 'CONFERIR');
    });
    it('sequência invertida ou possível jornada noturna exige conferência', () => assert.equal(E.analyze(record(['22:00', '23:00', '00:00', '06:00']), journey).classificacao, 'CONFERIR'));
    it('justificativa e pré-assinalação não viram débito automaticamente', () => assert.equal(E.analyze(record(['08:00', '12:00', '13:00', '16:00'], { tipo_dia: 'justificativa' }), journey).classificacao, 'CONFERIR'));
    it('sem jornada cadastrada não inventa jornada', () => assert.equal(E.analyze(record(['08:00', '12:00', '13:00', '17:36']), null).classificacao, 'CONFERIR'));
  });
};
