const E = require('../static/ponto-engine.js');
module.exports = ({ describe, it, assert }) => {
  const columns = ['ENTRADA 1', 'SAÍDA 1', 'ENTRADA 2', 'SAÍDA 2', 'ENTRADA 3', 'SAÍDA 3', 'NORMAIS', 'BDEB.', 'BCRED.', 'BSALDO'];
  const header = (offset = 0, labels = columns, page = 1) => ({ page, text: 'DATA ' + labels.join(' '), cells: [{ text: 'DATA', x: offset, width: 40 }, ...labels.map((text, i) => ({ text, x: offset + 100 + i * 80, width: 40 }))] });
  const row = (date, values, offset = 0, page = 1) => ({ page, text: date + ' Seg ' + values.filter(v => v !== null).join(' '), cells: [{ text: date, x: offset, width: 40 }, ...values.flatMap((text, i) => text === null ? [] : [{ text, x: offset + 100 + i * 80, width: 40 }])] });
  const text = (value, page = 1) => ({ text: value, page, cells: [] });
  describe('Ponto — importação multipágina e dinâmica', () => {
    it('identifica as colunas pelo cabeçalho mesmo com deslocamento e lacunas', () => {
      for (const offset of [0, 130, 300]) {
        const e = E.extract([header(offset), row('01/09/2026', ['08:00', '12:00^', '13:00^', '17:36', null, null, '08:36', null, null, '-00:09'], offset)]);
        assert.equal(e.rows[0].campos_documento.entrada_1, '08:00'); assert.equal(e.rows[0].campos_documento.debito, null); assert.equal(e.rows[0].campos_documento.saldo, '-00:09');
        assert.ok(e.rows[0].colunas_seguras);
      }
    });
    it('aceita variação de cabeçalhos e quantidade de colunas', () => {
      const labels = ['ENTRADA 1', 'SAÍDA 1', 'ENTRADA 2', 'SAÍDA 2', 'HORAS NORMAIS', 'DÉBITO', 'CRÉDITO', 'SALDO'];
      const e = E.extract([header(25, labels), row('01/09/2026', ['09:00', '12:30', '13:30', '18:00', '08:00', null, null, '00:00'], 25)]);
      assert.equal(e.rows[0].campos_documento.saida_2, '18:00'); assert.equal(e.rows[0].campos_documento.horas_normais, '08:00'); assert.ok(E.interpret(e.rows[0], {}, true).segura);
    });
    it('extrai a tabela principal de mais de uma página antes da associação', () => {
      const e = E.extract([header(), row('01/09/2026', ['08:00', '12:00', '13:00', '17:36']), header(50, columns, 2), row('02/09/2026', ['08:00', '12:00', '13:00', '17:36'], 50, 2)]);
      assert.equal(e.rows.length, 2); assert.equal(e.paginas_processadas, 2); assert.equal(e.rows[1].pagina, 2);
    });
    it('separa justificativas e carrega a data para a continuação em outra página', () => {
      const e = E.extract([header(), row('01/09/2026', ['08:01', '12:00', '13:00', '18:04']), text('JUSTIFICATIVAS DE ALTERAÇÃO E INCLUSÃO DE PONTO'), text('01/09/2026 08:01 - O - Registro via Aplicativo'), text('JUSTIFICATIVAS DE ALTERAÇÃO E INCLUSÃO DE PONTO', 2), text('18:04 - O - Registro via Aplicativo', 2)]);
      assert.equal(e.rows.length, 1); assert.equal(e.justificativas.length, 2); assert.equal(e.justificativas[1].data, '2026-09-01'); assert.equal(e.justificativas[1].pagina, 2);
      assert.deepEqual(e.justificativas[1].batidas_relacionadas, ['saida_2']);
    });
    it('mantém alterações separadas sem atribuir significado aos códigos', () => {
      const e = E.extract([header(), row('04/09/2026', ['08:15', '12:20', '13:39*', '18:23']), text('JUSTIFICATIVAS DE ALTERAÇÃO E INCLUSÃO DE PONTO'), text('04/09/2026 13:38 - D - saida diferente'), text('13:39 - I - saida diferente')]);
      assert.equal(e.rows[0].campos_documento.entrada_2, '13:39*'); assert.equal(e.justificativas[0].codigo_ocorrencia, 'D'); assert.equal(e.justificativas[1].codigo_ocorrencia, 'I');
      assert.deepEqual(e.justificativas[0].batidas_relacionadas, []); assert.deepEqual(e.justificativas[1].batidas_relacionadas, ['entrada_2']);
    });
    it('não duplica justificativas repetidas', () => {
      const e = E.extract([header(), row('01/09/2026', ['08:00','12:00','13:00','17:36']), text('JUSTIFICATIVAS DE ALTERAÇÃO E INCLUSÃO DE PONTO'), text('01/09/2026 08:00 - X - Texto original'), text('01/09/2026 08:00 - X - Texto original',2)]);
      assert.equal(e.justificativas.length, 1); assert.equal(e.justificativas[0].codigo_ocorrencia, 'X');
    });
    it('não inventa uma data para justificativa sem contexto', () => {
      const e = E.extract([header(), row('01/09/2026', ['08:00','12:00','13:00','17:36']), text('JUSTIFICATIVAS DE ALTERAÇÃO E INCLUSÃO DE PONTO'), text('08:00 - O - Registro via Aplicativo')]);
      assert.equal(e.justificativas.length,0); assert.equal(e.justificativas_nao_interpretadas.length,1);
    });
    it('ausência de justificativas e dias sem batidas não causam falha', () => {
      const e = E.extract([header(), row('06/09/2026', [null,null,null,null,null,null,null,null,null,'-00:09'])]);
      assert.equal(e.rows.length,1); assert.equal(e.justificativas.length,0); assert.equal(e.rows[0].campos_documento.entrada_1,null); assert.equal(e.rows[0].campos_documento.saldo,'-00:09');
    });
    it('preserva terceira batida e sinaliza limitação do cálculo sem ignorá-la', () => {
      const e=E.extract([header(),row('02/10/2026',['08:03','12:00^','13:00^','13:23','17:56',null,'04:20'])]);
      assert.equal(e.rows[0].campos_documento.entrada_3,'17:56'); assert.equal(E.interpret(e.rows[0],{},true).segura,false);
    });
    it('não transforma cabeçalhos sem intervalo em batidas ausentes inventadas', () => {
      const e=E.extract([header(0,['ENTRADA 1','SAÍDA 1']),row('01/09/2026',['08:00','12:00'])]);
      assert.equal(E.interpret(e.rows[0],{},true).segura,false);
    });
    it('identifica dinamicamente nome e período, sem consultar o nome de arquivo', () => {
      const e=E.extract([text('Nome: LEANDRO LIMA DOS SANTOS'),text('Período: 01/09/2026 até 03/10/2026.'),header(),row('01/09',['08:00','12:00','13:00','17:36'])]);
      assert.equal(E.identify(e.nome,[{id:'outro',nome:'Leandro Lima dos Santos'}]),'outro');assert.equal(e.rows[0].data,'2026-09-01');
    });
    it('formato desconhecido mostra a mensagem de segurança sem criar registros', () => {
      const e=E.extract([text('Conteúdo sem estrutura reconhecível')]);assert.equal(e.rows.length,0);assert.ok(e.warnings.includes(E.UNCERTAIN_CARD));
    });
    it('preserva marcações e usa apenas as definições impressas no documento', () => {
      const e=E.extract([header(),row('01/09/2026',['08:00*','12:00^','13:00^','17:36']),text('(*) - Batida lançada manualmente'),text('(^) - Pré-Assinalado')]);
      assert.ok(e.rows[0].marcacao_manual);assert.ok(e.rows[0].pre_assinalado);assert.equal(e.rows[0].campos_documento.saida_1,'12:00^');
    });
  });
};
