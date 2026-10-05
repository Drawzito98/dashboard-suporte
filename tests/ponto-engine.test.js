const E = require('../static/ponto-engine.js');
module.exports = ({ describe, it, assert }) => {
  const journey = { trabalha: true, entrada_1: '08:00', saida_1: '12:00', entrada_2: '13:00', saida_2: '17:36', minutos_esperados: 516 };
  const record = (punches, extra = {}) => ({ data: '2026-09-14', segura: true, batidas: punches, totais: {}, tipo_dia: 'trabalho', marcacao_manual: false, ...extra });
  const mapping = { entrada_1: 0, saida_1: 1, entrada_2: 2, saida_2: 3 };
  describe('Auditoria de ponto — limites individuais e acumulados', () => {
    it('5 minutos por marcação e exatamente 10 no dia são aceitos', () => {
      const result = E.analyze(record(['08:05','12:00','13:05','17:36']),journey);
      assert.equal(result.classificacao,'REGULAR'); assert.equal(result.tolerancia.acumulado_minutos,10);
    });
    it('6 minutos na entrada ultrapassam a regra individual mesmo abaixo de 10 no dia', () => {
      const result=E.analyze(record(['08:06','12:00','13:00','17:36']),journey);
      assert.equal(result.classificacao,'INCONSISTÊNCIA'); assert.deepEqual(result.tolerancia.marcacoes_excedidas,[0]); assert.equal(result.tolerancia.excedeu_diario,false);
    });
    it('11 minutos distribuídos ultrapassam o limite diário sem exceder uma marcação', () => {
      const result=E.analyze(record(['08:03','11:57','13:03','17:34']),journey);
      assert.equal(result.classificacao,'INCONSISTÊNCIA'); assert.deepEqual(result.tolerancia.marcacoes_excedidas,[]); assert.equal(result.tolerancia.acumulado_minutos,11);
    });
    it('contabiliza antecipações e atrasos sem cancelar variações compensadas', () => {
      const result=E.analyze(record(['07:57','12:03','13:03','17:33']),journey);
      assert.equal(result.tolerancia.acumulado_minutos,12); assert.equal(result.saldo_calculado,0); assert.equal(result.classificacao,'CONFERIR');
    });
    it('crédito do cartão não aumenta a tolerância nem altera o saldo original', () => {
      const r=record(['08:06','12:00','13:00','17:36'],{totais:{credito:'00:06',saldo:'-00:09'}}); const original=JSON.stringify(r);
      const result=E.analyze(r,journey); assert.equal(result.classificacao,'CONFERIR'); assert.equal(result.tolerancia.dentro_tolerancia,false); assert.equal(result.saldo_calculado,-6); assert.equal(JSON.stringify(r),original);
    });
    it('configuração personalizada e limite zero são respeitados', () => {
      assert.equal(E.analyze(record(['08:06','12:00','13:00','17:36']),journey,{...E.DEFAULT_RULES,tolerancia_batida:6}).classificacao,'REGULAR');
      assert.equal(E.analyze(record(['08:01','12:00','13:00','17:36']),journey,{...E.DEFAULT_RULES,tolerancia_batida:0,tolerancia_diaria:0}).classificacao,'INCONSISTÊNCIA');
    });
    it('sem intervalo soma somente as duas marcações e não usa saldo do cartão', () => {
      const result=E.analyze(record(['09:05','13:05',null,null],{totais:{saldo:'-12:00'}}),{trabalha:true,sem_intervalo:true,entrada_1:'09:00',saida_1:'13:00',minutos_esperados:240});
      assert.equal(result.classificacao,'REGULAR'); assert.equal(result.tolerancia.acumulado_minutos,10); assert.equal(result.saldo_calculado,0);
    });
  });
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
    it('hora extra informa e variação acima da tolerância vai para conferência', () => {
      const result = E.analyze(record(['08:00', '12:00', '13:00', '18:00']), journey);
      assert.equal(result.classificacao, 'CONFERIR'); assert.ok(result.ocorrencias.some(o => o.tipo === 'extra' && o.classificacao_automatica === 'REGULAR')); assert.ok(result.ocorrencias.some(o => o.tipo === 'horario'));
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
