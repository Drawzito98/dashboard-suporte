const P = require('../static/opa-semanal-parse.js');

// Fixtures 100% sintéticas (o repositório é público: nunca colocar dados reais aqui).
function pacoteBase(over = {}) {
  const f = {
    'pasta/atendimentos_assumidos.csv': 'Support Volume Assumidos,Var\n30,"4,3%"\n',
    'pasta/atendimentos_finalizados.csv': 'Finalizados,Var\n30,"6,7%"\n',
    'pasta/clientes_atendidos.csv': 'Clientes,Var\n25,"1,0%"\n',
    'pasta/tme_#U00b7_tempo_m#U00e9dio_de_espera.csv': 'TME,Var\n14m1s,"49,0%"\n',
    'pasta/tmi_·_tempo_médio_de_interação.csv': 'TMI,Var\n12m35s,"3,0%"\n',
    'pasta/tmr_#U00b7_tempo_m#U00e9dio_de_resolu#U00e7#U00e3o.csv': 'TMR,Var\n23h24m40s,"9,7%"\n',
    'pasta/score_médio_(cliente).csv': 'Score,Dif\n"4,71","-0,12"\n',
    'pasta/encerrados_por_inatividade.csv': 'Qtd,Pct\n20,67%\n',
    'pasta/taxa_de_recorrência.csv': 'T,V\n"12,03%","-4,1%"\n',
    'pasta/sla_do_plantão_(2h).csv': 'S,D\n"65,2%","1,4%"\n',
    'pasta/atendimentos_por_dia.csv': 'Evento,Assumidos,Finalizados\nData,Atendimentos,Atendimentos\n2026-11-03,20,10\n2026-11-04,10,20\n',
    'pasta/assumidos_por_dia_×_hora.csv': 'Dia,Ter,Qua\nHora,Assumidos,Assumidos\n08–10h,12,5\n10–12h,8,\n',
    'pasta/performance_por_colaborador.csv':
      'Atendente,Assumidos,Finalizados,Transferidos,Clientes,Média aval.,TMA,TMA I.A.,TMI,TMR\n' +
      '"Ana Lívia Pinheiro",20,18,5,15,"4,50",9:16:27,,10m3s,23:04:60\n' +
      'Pedro  Melo,10,12,2,10,,6:10:58,,11m60s,7:26:23\n',
    'pasta/avaliação_por_colaborador__ia_×_cliente.csv': 'Atendente,Média IA,Notas baixas IA,Média cliente\nAna Lívia Pinheiro,"3,71",4,"4,50"\n',
    'pasta/performance_por_departamento.csv':
      'Departamento,Assumidos,Finalizados,Transferidos,TMA,TMA I.A.,TMR,Score,Avaliados,Enc. inatividade,% Enc.\n' +
      'SUP - Financeiro,30,30,7,11:49:50,,13:11:32,"4,52",10,20,67%\n',
    'pasta/motivos_de_atendimento.csv': 'Motivo,Finalizados,TME,TMR\nDúvida > NFCom,19,,8:09:23\n',
    'pasta/distribuição_de_notas_por_estrela.csv': 'E,A,B,C\n★★★★★ (5),6,0,0\n★★★★ (4),4,0,0\n',
    'pasta/avaliação_do_cliente_(estrelas).csv': 'S,A\nAtendimentos não avaliados,20\nAtendimentos avaliados pelo cliente,10\n',
    'pasta/tempo_de_fila_por_faixa.csv': 'Faixa,A,B,C\n0–5 min,10,0,0\n',
    'pasta/volume__assumidos_vs._finalizados_(12_meses).csv': 'Evento,A,F\nData,Atendimentos,Atendimentos\n2026-11,30,30\n',
    'pasta/análise_livre.csv': 'Protocolo,Data\nA,2026-11-03\n'
  };
  return { ...f, ...over };
}

module.exports = ({ describe, it, assert }) => {
  describe('opa-semanal: utilidades', () => {
    it('lê números no formato brasileiro', () => {
      assert.equal(P.parseNumber('4,3%'), 4.3);
      assert.equal(P.parseNumber('1.308'), 1308);
      assert.equal(P.parseNumber("'+0,2%"), 0.2);
      assert.equal(P.parseNumber('R$ 0,00'), 0);
      assert.equal(P.parseNumber('-100,0%'), -100);
      assert.equal(P.parseNumber(''), null);
      assert.equal(P.parseNumber('—'), null);
    });
    it('lê durações nos três formatos, incluindo 60 segundos', () => {
      assert.equal(P.parseDuration('13:11:32'), 13 * 3600 + 11 * 60 + 32);
      assert.equal(P.parseDuration('23h24m40s'), 23 * 3600 + 24 * 60 + 40);
      assert.equal(P.parseDuration('14m1s'), 841);
      assert.equal(P.parseDuration('23:04:60'), 23 * 3600 + 5 * 60);
      assert.equal(P.parseDuration('11m60s'), 12 * 60);
      assert.equal(P.parseDuration(''), null);
    });
    it('normaliza nomes de arquivo com e sem escape #U', () => {
      assert.equal(P.fileKey('a/b/comparativo_de_per#U00edodo.csv'), 'comparativo_de_periodo');
      assert.equal(P.fileKey('plantão__diurno_×_noturno.csv'), 'plantao_diurno_noturno');
    });
    it('chave do primeiro nome ignora acento e espaços duplos', () => {
      assert.equal(P.firstNameKey('  Valkênia  Ravla'), 'valkenia');
      assert.equal(P.firstNameKey('Pedro  Melo'), 'pedro');
    });
    it('semana começa na segunda-feira', () => {
      assert.equal(P.semanaInicio('2026-11-03'), '2026-11-02');
      assert.equal(P.semanaInicio('2026-11-08'), '2026-11-02');
      assert.equal(P.semanaInicio('2026-11-09'), '2026-11-09');
    });
    it('parseCsv respeita aspas e vírgulas internas', () => {
      assert.deepEqual(P.parseCsv('a,b\n"x, y",2\n'), [['a', 'b'], ['x, y', '2']]);
    });
  });

  describe('opa-semanal: pacote', () => {
    it('lê o pacote e deriva período e semana', () => {
      const p = P.parsePacote(pacoteBase());
      assert.equal(p.periodoInicio, '2026-11-03');
      assert.equal(p.periodoFim, '2026-11-04');
      assert.equal(p.semanaInicio, '2026-11-02');
      assert.equal(p.kpis.assumidos, 30);
      assert.equal(p.kpis.tme, 841);
      assert.equal(p.kpis.inatividadePct, 67);
      assert.equal(p.kpis.avaliados, 10);
      assert.equal(p.kpis.naoAvaliados, 20);
    });
    it('junta nota da IA e converte tempos por atendente', () => {
      const p = P.parsePacote(pacoteBase());
      const ana = p.colabs.find(c => c.chave === 'ana');
      assert.equal(ana.mediaCliente, 4.5);
      assert.equal(ana.mediaIa, 3.71);
      assert.equal(ana.tmi, 603);
      assert.equal(p.colabs.find(c => c.chave === 'pedro').nome, 'Pedro Melo');
    });
    it('falha com mensagem clara quando falta arquivo obrigatório', () => {
      const f = pacoteBase(); delete f['pasta/atendimentos_por_dia.csv'];
      assert.throws(() => P.parsePacote(f));
      try { P.parsePacote(f); } catch (e) { assert.ok(/atendimentos_por_dia/.test(e.message)); }
    });
    it('conferência: totais batem e avisos esperados aparecem', () => {
      const c = P.parsePacote(pacoteBase()).conferencia;
      assert.ok(c.some(x => x.tipo === 'ok' && x.titulo === 'Totais batem'));
      ['Volume dos 12 meses', 'Resolução média (TMR)', 'Análise livre incompleta', 'Formatação de tempos', 'Custos em branco']
        .forEach(t => assert.ok(c.some(x => x.tipo === 'aviso' && x.titulo === t), 'faltou aviso: ' + t));
    });
    it('conferência: acusa total que não bate e comparativo divergente', () => {
      const f = pacoteBase({
        'pasta/atendimentos_finalizados.csv': 'F,V\n31,"1,0%"\n',
        'pasta/comparativo_de_período.csv': 'Indicador,Atual,Anterior,Var.\nFinalizados,"1.308","1.305","+0,2%"\n'
      });
      const c = P.parsePacote(f).conferencia;
      assert.ok(c.some(x => x.titulo === 'Totais não batem'));
      assert.ok(c.some(x => x.titulo === 'Comparativo de período'));
    });
  });

  describe('opa-semanal: ligação com o cadastro', () => {
    const colabs = [{ chave: 'ana', nome: 'Ana Lívia Pinheiro' }, { chave: 'pedro', nome: 'Pedro Melo' }, { chave: 'leo', nome: 'Leo X' }];
    it('liga pelo primeiro nome e traz o nível', () => {
      const r = P.ligarColaboradores(colabs, { 'Ana Lívia Pinheiro Santos Ataide': { nivel: 'n2' }, 'Pedro Melo': { nivel: 'N1' } });
      assert.equal(r[0].nomeApp, 'Ana Lívia Pinheiro Santos Ataide');
      assert.equal(r[0].nivel, 'N2');
      assert.equal(r[1].ligacao, 'ok');
      assert.equal(r[2].ligacao, 'sem_cadastro');
    });
    it('marca como ambíguo quando dois cadastros têm o mesmo primeiro nome', () => {
      const r = P.ligarColaboradores([colabs[1]], { 'Pedro Melo': { nivel: 'N1' }, 'Pedro Souza': { nivel: 'N2' } });
      assert.equal(r[0].ligacao, 'ambigua');
      assert.equal(r[0].nivel, '');
    });
  });
};
