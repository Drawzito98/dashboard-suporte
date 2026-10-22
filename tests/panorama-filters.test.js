const { automaticReport } = require('../static/panorama-suporte.js');
module.exports = ({ describe, it, assert }) => {
  const row = (name, finalizados, csat) => ({ name, alias: `Pessoa ${name}`, finalizados, clientes: finalizados, csat, tma: 600, tmr: 120, score: null });
  const rows = [row('Renata Alves Henriques', 100, 4), row('João Silva', 60, 5), row('Ana Maria', 30, 4.5), row('Sem cadastro', 10, null), row('CADU', 1000, 5)];
  const registry = { Renata: { setor_atual: 'Financeiro', nivel: 'N1' }, 'João Silva': { setor_atual: 'Financeiro', nivel: 'N2' }, 'Ana Maria': { setor_atual: 'ERP', nivel: 'N1' } };
  const base = { start: '2026-10-01', end: '2026-10-22', hide: false, order: 'FINALIZADOS' };
  const run = filters => automaticReport(rows, { ...base, filters }, registry);
  describe('Panorama — filtros globais', () => {
    it('sem filtros mantém todas as pessoas, IA e setor não identificado', () => {
      const result = run({ setor: 'all', nivel: 'all', colaborador: 'all' });
      assert.equal(result.ranking.length, 5); assert.equal(result.filteredOut, 0); assert.equal(result.unidentified, 1);
    });
    it('setor recorta cards, ranking, análise e exportação', () => {
      const result = run({ setor: 'Financeiro' });
      assert.equal(result.ranking.length, 2); assert.equal(result.filteredOut, 3);
      assert.ok(result.markdown.includes('160')); assert.ok(!result.html.includes('CADU')); assert.ok(!result.markdown.includes('Ana Maria'));
    });
    it('nível usa cadastro e primeiro nome único', () => {
      const result = run({ nivel: 'N1' });
      assert.equal(result.ranking.length, 2); assert.ok(result.ranking.some(r => r.name === 'Renata Alves Henriques'));
      assert.ok(!result.ranking.some(r => r.name === 'CADU' || r.name === 'Sem cadastro'));
    });
    it('combina setor e nível e recalcula média apenas com o recorte', () => {
      const result = run({ setor: 'Financeiro', nivel: 'N2' });
      assert.equal(result.ranking.length, 1); assert.equal(result.ranking[0].name, 'João Silva'); assert.ok(result.markdown.includes('5,00 / 5,00'));
    });
    it('colaborador abreviado encontra o nome completo do CSV', () => {
      const result = run({ colaborador: 'Renata' });
      assert.equal(result.ranking.length, 1); assert.equal(result.ranking[0].name, 'Renata Alves Henriques');
    });
    it('nome completo do topo encontra nome curto no CSV', () => {
      const result = automaticReport([row('Renata', 20, 4)], { ...base, filters: { colaborador: 'Renata Alves Henriques' } }, { 'Renata Alves Henriques': { setor_atual: 'ERP', nivel: 'N1' } });
      assert.equal(result.ranking.length, 1);
    });
    it('normaliza acentos, espaços e caixa dos filtros', () => {
      assert.equal(run({ setor: ' financeiro ', nivel: 'n2', colaborador: ' JOAO   SILVA ' }).ranking.length, 1);
    });
    it('filtro sem correspondência devolve vazio e permite restaurar tudo', () => {
      const result = run({ setor: 'Financeiro', nivel: 'N1', colaborador: 'João Silva' });
      assert.equal(result.ranking.length, 0); assert.equal(result.html, ''); assert.equal(result.filteredOut, 5);
      assert.equal(run({}).ranking.length, 5);
    });
    it('busca textual usa nome, nome canônico e setor', () => {
      assert.equal(run({ pesquisa: 'renata' }).ranking.length, 1); assert.equal(run({ pesquisa: 'financeiro' }).ranking.length, 2);
    });
    it('não recorta o CSV consolidado pelo mês do topo', () => {
      assert.equal(run({ periodo: '2025-01' }).ranking.length, 5);
    });
    it('não atribui nível a pessoa com primeiro nome ambíguo', () => {
      const result = automaticReport([row('Ana', 20, 4)], { ...base, filters: { nivel: 'N1' } }, { 'Ana Maria': { setor_atual: 'ERP', nivel: 'N1' }, 'Ana Paula': { setor_atual: 'Fiscal', nivel: 'N2' } });
      assert.equal(result.ranking.length, 0);
    });
    it('não modifica as linhas de origem ao aplicar filtros', () => {
      const before = JSON.stringify(rows); run({ nivel: 'N1' }); run({ setor: 'ERP' }); assert.equal(JSON.stringify(rows), before);
    });
  });
};
