const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const context = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname, '../static/perfil-pdi-engine.js'), 'utf8'), context);
const E = context.PerfilPDIEngine;
const competencias = [{id: 1, type: 'competency', nome: 'Empatia'}, {id: 8, type: 'competency', nome: 'Gestão da Informação'}, {id: 'guide', type: 'guidance', nome: 'Guia'}];
const hoje = new Date('2026-10-13T12:00:00Z');
module.exports = ({describe, it, assert}) => {
  const base = { nome: 'Ana de Souza', competencias, hoje };
  describe('Análise de perfil e PDI', () => {
    it('não associa nomes abreviados nem gera um diagnóstico sem evidências', () => {
      const a = E.analisar({...base, avaliacoes: [{colaborador: 'Ana', scores: {1: 1}}], complemento: {mapeamento: {cadastro: 'Outra', confirmadoEm: hoje.toISOString(), acao: 'Treinar'}}});
      assert.equal(a.avaliacao, null); assert.equal(a.mapeamento, null); assert.equal(a.podeGerar, false); assert.throws(() => E.gerar(a, hoje));
    });
    it('usa a avaliação mais recente, normalizando somente o nome completo', () => {
      const a = E.analisar({...base, avaliacoes: [{colaborador:'Ana de Souza', createdAt:'2026-09-01', scores:{1:4}}, {colaborador:'Ána  de Souza', createdAt:'2026-10-01', scores:{1:2,8:3}, observacoes_competencias:{1:'Interrompeu a confirmação da necessidade.'}}]});
      assert.equal(a.prioridades.length,1); assert.equal(a.fortes.length,1); assert.equal(a.prioridades[0].nota,2); assert.ok(a.prioridades[0].evidencia.includes('confirmação'));
    });
    it('não trata notas ausentes ou inválidas como uma lacuna', () => {
      for (const nota of [null, '', 0, 5, 'x']) {
        const a = E.analisar({...base, avaliacoes:[{colaborador:base.nome, scores:{1:nota}}]});
        assert.equal(a.notas.length,0); assert.equal(a.podeGerar,false);
      }
    });
    it('tempo de empresa e salário não determinam prioridades', () => {
      const a = E.analisar({...base, info:{data_admissao:'1990-01-01',salario:10000}});
      assert.equal(a.prioridades.length,0); assert.equal(a.podeGerar,false); assert.equal(a.info.salario,undefined);
    });
    it('mostra pendências de avaliação antiga, incompleta e sem exemplos', () => {
      const a = E.analisar({...base, avaliacoes:[{colaborador:base.nome,createdAt:'2025-01-01', scores:{1:2}}]});
      assert.ok(a.pendencias.some(p=>p.includes('120 dias'))); assert.ok(a.pendencias.some(p=>p.includes('exemplos'))); assert.ok(a.pendencias.some(p=>p.includes('sem nota')));
    });
    it('indicadores usam apenas o último mês da pessoa e preservam ausência de score', () => {
      const a = E.analisar({...base, registros:[{Atendente:base.nome,'Mês':'2026-09',SCORE:5,Finalizados:10},{Atendente:base.nome,'Mês':'2026-10',SCORE:null,Finalizados:0},{Atendente:'Outro','Mês':'2026-10',SCORE:1,Finalizados:99}]});
      assert.equal(a.indicadores.mes,'2026-10'); assert.equal(a.indicadores.score,null); assert.equal(a.indicadores.finalizados,0);
    });
    it('gera rascunho com fonte, ação, prazo e objetivo declarado sem inventar indicador', () => {
      const a = E.analisar({...base, info:{objetivos_futuros:'Aprender integrações'}, complemento:{apoio:'Mentoria semanal'}});
      const p = E.gerar(a, hoje); assert.equal(p.status,'rascunho'); assert.equal(p.objetivos.length,1); assert.equal(p.objetivos[0].indicador,''); assert.equal(p.objetivos[0].prazo,'2027-01-11'); assert.equal(p.snapshot.objetivo,'Aprender integrações'); assert.equal(E.validarPlano(p), ''); assert.ok(E.validarPlano(p,true));
    });
    it('incorpora o Mapeamento somente com identidade confirmada', () => {
      const a = E.analisar({...base, complemento:{mapeamento:{cadastro:base.nome,nome:'Ana',perfil:'Observação do líder',acao:'Melhorar registros',confirmadoEm:hoje.toISOString()}}});
      assert.equal(a.podeGerar,true); assert.equal(E.gerar(a,hoje).objetivos[0].objetivo,'Melhorar registros');
    });
    it('aprovação exige plano completo, data válida e alinhamento explícito', () => {
      const p = E.gerar(E.analisar({...base,info:{objetivos_futuros:'Aprender integrações'}}),hoje);
      p.objetivos[0].apoio='Mentor'; p.objetivos[0].indicador='Entregar integração validada pelo mentor';
      assert.ok(E.validarPlano(p,true).includes('alinhado')); p.alinhado=true; assert.equal(E.validarPlano(p,true),'');
      p.objetivos[0].prazo='2026-02-30'; assert.ok(E.validarPlano(p,true).includes('válido'));
    });
  });
};
