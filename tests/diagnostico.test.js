const E = require('../static/diagnostico-engine.js');
module.exports = ({ describe, it, assert }) => {
  const row = (month, score, extra = {}) => ({ Atendente: 'Alice', Setor: 'ERP', 'Mês': month, SCORE: score, Finalizados: 100, Assumidos: 120, Transferidos: 10, ...extra });
  const registry = { Alice: { nivel: 'N1', setor_atual: 'ERP' }, Bruno: { nivel: 'N2', setor_atual: 'ERP' } };
  const opts = { registry, current: ['2026-09'], previous: ['2026-08'], today: '2026-10-22' };
  const person = result => result.groups.find(g => g.type === 'person');
  describe('Diagnóstico — métricas e evidências', () => {
    it('preserva ausência, zero e vírgula decimal', () => {
      for (const value of ['', ' ', null, undefined, false, 'texto']) assert.equal(E.numeric(value), null);
      assert.equal(E.numeric(0), 0); assert.equal(E.numeric('4,70'), 4.7);
      assert.equal(E.metrics([row('2026-09', null)]).score, null);
      assert.equal(E.metrics([row('2026-09', 0)]).score, 0);
    });
    it('meta oficial é 4,70, inclusive igualdade e Score ausente', () => {
      assert.equal(E.TARGET, 4.7);
      assert.equal(person(E.analyze([row('2026-09', 4.7)], opts)).findings[0].kind, 'positive');
      assert.equal(person(E.analyze([row('2026-09', 4.69)], opts)).findings[0].kind, 'attention');
      assert.equal(person(E.analyze([row('2026-09', null)], opts)).findings[0].kind, 'insufficient');
    });
    it('não pondera Score por finalizados, Total ou competências', () => {
      const m = E.metrics([row('2026-09', 4, { Total: 500, Finalizados: 500 }), row('2026-09', 5, { Atendente: 'Bruno', Total: 1 })]);
      assert.equal(m.score, 4.5); assert.equal(m.weightedScore, null); assert.equal(m.evaluations, null);
    });
    it('pondera somente com quantidade explicitamente informada em todas as linhas', () => {
      const rows = [row('2026-09', 4, { 'Quantidade avaliações': 9 }), row('2026-09', 5, { Atendente: 'Bruno', 'Quantidade avaliações': 1 })];
      assert.equal(E.metrics(rows).weightedScore, 4.1); assert.equal(E.metrics(rows).evaluations, 10);
      delete rows[1]['Quantidade avaliações']; assert.equal(E.metrics(rows).weightedScore, null);
    });
    it('média coletiva dá peso igual às pessoas e não ao número de registros', () => {
      assert.equal(E.metrics([row('2026-09', 4), row('2026-08', 4), row('2026-09', 5, { Atendente: 'Bruno' })]).score, 4.5);
    });
    it('não transforma campo de volume ausente em zero nem divide por zero', () => {
      assert.equal(E.metrics([row('2026-09', 4, { Finalizados: null })]).finished, null);
      assert.equal(E.metrics([row('2026-09', 4, { Assumidos: 0 })]).completion, null);
    });
    it('cada diagnóstico traz indicador, evidência, interpretação, hipótese e ação', () => {
      const g = person(E.analyze([row('2026-08', 4.9), row('2026-09', 4.3, { TMR: '02:00:00' })], opts));
      g.findings.forEach(f => ['indicator', 'evidence', 'interpretation', 'hypothesis', 'action'].forEach(k => assert.ok(typeof f[k] === 'string' && f[k].length)));
    });
    it('transferências geram contexto neutro, nunca penalidade', () => {
      const f = person(E.analyze([row('2026-09', 4.8)], opts)).findings.find(f => f.code === 'transfers');
      assert.equal(f.kind, 'neutral'); assert.ok(f.interpretation.includes('não representa falha'));
    });
    it('detecta gargalos apenas quando há tempos nos dois períodos', () => {
      const rows = [row('2026-08', 4.8, { TMR: '00:10:00' }), row('2026-09', 4.8, { TMR: '00:20:00' })];
      assert.ok(person(E.analyze(rows, opts)).findings.some(f => f.code === 'tmr'));
      rows[0].TMR = '::'; assert.ok(!person(E.analyze(rows, opts)).findings.some(f => f.code === 'tmr'));
    });
  });
  describe('Diagnóstico — períodos e histórico', () => {
    it('desloca meses em anos diferentes e valida limites', () => {
      assert.equal(E.shift('2026-01', -1), '2025-12'); assert.equal(E.shift('2026-13', 1), '');
      assert.deepEqual(E.range('2025-12', '2026-02'), ['2025-12', '2026-01', '2026-02']);
      assert.throws(() => E.range('2026-09', '2026-01'));
      assert.throws(() => E.range('2000-01', '2026-01'));
    });
    it('meses múltiplos descontínuos usam base anterior sem sobreposição', () => {
      assert.deepEqual(E.previousFor(['2026-08', '2026-10']), ['2026-06', '2026-07']);
      assert.deepEqual(E.previousFor(['2026-01']), ['2025-12']);
      const r = E.analyze([row('2026-08', 4.8), row('2026-10', 4.9)], { ...opts, current: ['2026-08', '2026-10'], previous: undefined });
      assert.deepEqual(r.previous, ['2026-06', '2026-07']);
    });
    it('usa mês anterior do calendário, sem pular lacunas', () => {
      const g = person(E.analyze([row('2026-07', 4.8), row('2026-09', 4.9)], { registry, today: '2026-10-22' }));
      assert.equal(g.previous.records, 0); assert.ok(g.findings.some(f => f.code === 'comparison-missing'));
    });
    it('não conclui queda de produtividade com mês em andamento', () => {
      const g = person(E.analyze([row('2026-08', 4.8), row('2026-09', 4.9, { Finalizados: 20 })], { ...opts, today: '2026-09-15' }));
      assert.ok(g.notices.some(n => n.includes('Mês em andamento')));
      assert.ok(g.findings.find(f => f.code === 'volume').interpretation.includes('não classifica'));
    });
    it('sinaliza períodos personalizados de durações diferentes e lacunas', () => {
      const g = person(E.analyze([row('2026-06', 4.8), row('2026-08', 4.8), row('2026-09', 4.9)], { ...opts, previous: ['2026-06'], current: ['2026-08', '2026-09'] }));
      assert.ok(g.notices.some(n => n.includes('durações diferentes')));
      assert.throws(() => E.analyze([], { ...opts, previous: ['2026-09'] }));
    });
    it('não preenche mês ausente e não gera recorrência com meses descontínuos', () => {
      const g = person(E.analyze([row('2026-05', 4.9), row('2026-07', 4.7), row('2026-09', 4.5)], opts));
      assert.equal(g.history.length, 3); assert.equal(g.recurring, false);
    });
    it('exige três meses consecutivos com notas para quedas recorrentes', () => {
      const rows = [row('2026-07', 4.9), row('2026-08', 4.7), row('2026-09', 4.5)];
      assert.equal(person(E.analyze(rows, opts)).recurring, true);
      rows[1].SCORE = null; assert.equal(person(E.analyze(rows, opts)).recurring, false);
    });
    it('exibe recorrência de meta abaixo de 4,70 e próprio histórico', () => {
      const g = person(E.analyze([row('2026-07', 4.4), row('2026-08', 4.5), row('2026-09', 4.6)], opts));
      assert.ok(g.findings.some(f => f.code === 'recurring-target'));
      assert.ok(g.findings.some(f => f.code === 'own-history' && f.evidence.includes('2 meses')));
    });
    it('não usa meses futuros no histórico de uma análise passada', () => {
      const g = person(E.analyze([row('2026-09', 4.8), row('2026-10', 1)], opts));
      assert.equal(g.history.length, 1); assert.equal(g.current.score, 4.8);
    });
    it('não altera registros históricos nem configurações fornecidas', () => {
      const rows = [row('2026-08', 4.8), row('2026-09', 4.9)]; const before = JSON.stringify(rows);
      E.analyze(rows, opts); assert.equal(JSON.stringify(rows), before);
    });
  });
  describe('Diagnóstico — setores, níveis e metas', () => {
    it('separa N1 de N2 dentro do mesmo setor', () => {
      const report = E.analyze([row('2026-09', 4.8), row('2026-09', 4.9, { Atendente: 'Bruno' })], opts);
      assert.equal(report.groups.filter(g => g.type === 'sector').length, 2);
      assert.ok(report.groups.every(g => g.current.people === 1));
    });
    it('aplica setor, nível, colaborador e pesquisa sem retirar histórico', () => {
      const rows = [row('2026-08', 4.8), row('2026-09', 4.9), row('2026-09', 2, { Atendente: 'Bruno' })];
      const report = E.analyze(rows, { ...opts, filters: { setor: 'ERP', nivel: 'N1', colaborador: 'Alice', pesquisa: 'alice' } });
      assert.equal(person(report).previous.records, 1); assert.equal(person(report).current.score, 4.9);
    });
    it('não inclui Cadu, totais e nível desconhecido em N1/N2', () => {
      const rows = [row('2026-09', 1, { Atendente: 'CADU (IA)' }), row('2026-09', 1, { Atendente: 'TOTAL' }), row('2026-09', 4.8, { Atendente: 'Sem nível' })];
      assert.equal(E.analyze(rows, { ...opts, filters: { nivel: 'N1' } }).groups.length, 0);
      assert.equal(E.analyze(rows, opts).excludedAI, 1);
      assert.equal(person(E.analyze(rows, opts)).level, 'SEM NÍVEL');
    });
    it('sinaliza mudanças de equipe e não interpreta volume como produtividade', () => {
      const rows = [row('2026-08', 4.8), row('2026-09', 4.9), row('2026-09', 4.8, { Atendente: 'Carla' })];
      const report = E.analyze(rows, { ...opts, registry: { ...registry, Carla: { nivel: 'N1' } } });
      const sector = report.groups.find(g => g.type === 'sector');
      assert.ok(sector.notices.some(n => n.includes('composição')));
      assert.ok(sector.findings.find(f => f.code === 'volume').interpretation.includes('não classifica'));
    });
    it('reutiliza metas compatíveis e ignora meta de Score divergente da oficial', () => {
      const goals = [{ collaborator: 'Alice', metric: 'finalizados', target: 90, period: '2026-09', type: 'monthly' }, { collaborator: 'Alice', metric: 'score', target: 4.5 }];
      const g = person(E.analyze([row('2026-09', 4.6)], { ...opts, goals }));
      assert.equal(g.goalResults.length, 1); assert.equal(g.goalResults[0].met, true); assert.equal(E.TARGET, 4.7);
    });
    it('não gera diagnóstico com recorte vazio', () => assert.equal(E.analyze([], opts).groups.length, 0));
    it('reutiliza objetivo do registro e sinaliza cumprimento parcial', () => {
      const g = person(E.analyze([row('2026-09', 4.8, { Objetivo: 80 })], opts));
      assert.equal(g.goalResults[0].target, 80); assert.equal(g.goalResults[0].met, true);
      const partial = person(E.analyze([row('2026-09', 4.8, { Objetivo: 80 })], { ...opts, today: '2026-09-15' }));
      assert.equal(partial.goalResults[0].comparable, false);
    });
    it('reutiliza cadastro por primeiro nome único para nível sem resolver ambiguidades', () => {
      assert.equal(E.infoFor('Renata Alves', { Renata: { nivel: 'N1' } }).nivel, 'N1');
      assert.deepEqual(E.infoFor('Ana Silva', { 'Ana Maria': { nivel: 'N1' }, 'Ana Paula': { nivel: 'N2' } }), {});
    });
  });
  describe('Diagnóstico — autorização', () => {
    it('permite revisão apenas ao administrador autenticado de app_metadata', () => {
      assert.equal(E.canReview({ id: '1', app_metadata: { role: 'admin' } }), true);
      for (const user of [null, { id: '1', user_metadata: { role: 'admin' } }, { id: '1', app_metadata: { role: 'viewer' } }, { app_metadata: { role: 'admin' } }]) assert.equal(E.canReview(user), false);
    });
  });
};
