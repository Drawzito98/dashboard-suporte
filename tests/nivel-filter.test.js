const fs = require('fs');
const path = require('path');
const vm = require('vm');

function createApp(info = {}, records = []) {
  const storage = new Map([['sistema_colaboradores_info_v1', JSON.stringify(info)]]);
  const listeners = {};
  const level = {
    value: 'all', innerHTML: '',
    get options() { return [...this.innerHTML.matchAll(/value="([^"]+)"/g)].map(match => ({ value: match[1] })); },
    addEventListener(type, callback) { listeners[type] = callback; }
  };
  const container = { innerHTML: '', querySelectorAll: () => [] };
  const context = {
    setTimeout, clearTimeout,
    console, rawRecords: records,
    localStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) },
    document: {
      body: { dataset: { activeTab: 'colaboradores' } },
      readyState: 'loading', addEventListener() {}, querySelectorAll: () => [],
      getElementById: id => id === 'gfNivel' ? level : id === 'colaboradoresContent' ? container : null
    },
    isColabActive: () => true, isAggregateName: () => false,
    escapeHtml: value => String(value),
  };
  vm.createContext(context);
  for (const file of ['globalFilters.js', 'colaboradores.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../static', file), 'utf8'), context);
  }
  context.filters = vm.runInContext('globalFilters', context);
  return { context, level, listeners, container, storage };
}

module.exports = ({ describe, it, assert }) => {
  describe('Filtro por nível', () => {
    const info = { 'Janaína Francisca da Silva': { nivel: 'N1' }, 'Michele Ferreira Nóbrega': { nivel: 'N2' } };
    it('filtra registros por nível mesmo com diferenças de acentuação e multi-setor', () => {
      const app = createApp(info, [
        { Atendente: 'Janaina Francisca da Silva🔁 Multi-setor' },
        { Atendente: 'Michele Ferreira Nobrega' },
        { Atendente: 'Sem cadastro' }
      ]);
      app.context.filters.nivel = 'N1';
      assert.deepEqual(app.context.filters.aplicar(app.context.rawRecords).map(row => row.Atendente), ['Janaina Francisca da Silva🔁 Multi-setor']);
    });
    it('mostra somente os cartões do nível selecionado e restaura Todos', () => {
      const app = createApp(info);
      app.context.filters.nivel = 'N2';
      app.context.renderColaboradores();
      assert.ok(app.container.innerHTML.includes('Michele Ferreira Nóbrega'));
      assert.ok(!app.container.innerHTML.includes('Janaína Francisca da Silva'));
      app.context.filters.nivel = 'all';
      app.context.renderColaboradores();
      assert.ok(app.container.innerHTML.includes('Janaína Francisca da Silva'));
    });
    it('exibe orientação quando nenhum colaborador tem o nível escolhido', () => {
      const app = createApp(info);
      app.context.filters.nivel = 'N3';
      app.context.renderColaboradores();
      assert.ok(app.container.innerHTML.includes('Nenhum colaborador encontrado'));
      assert.ok(!app.container.innerHTML.includes('data-nome='));
    });
    it('atualiza os níveis após chegada do cadastro, mesmo sem registros importados', () => {
      const app = createApp();
      app.context.filters.popularOptions();
      assert.equal(app.level.options.length, 1);
      app.storage.set('sistema_colaboradores_info_v1', JSON.stringify(info));
      app.context.filters.popularOptions();
      assert.deepEqual(app.level.options.map(option => option.value), ['all', 'N1', 'N2']);
    });
    it('aplica a seleção de nível imediatamente e avisa as abas', () => {
      const app = createApp(info);
      let calls = 0;
      app.context.filters.onChange(() => calls++);
      app.context.filters._bindEvents();
      app.level.value = 'N2';
      app.listeners.change();
      assert.equal(app.context.filters.nivel, 'N2');
      assert.equal(calls, 1);
    });
    it('filtra os cartões pelo setor atual, mesmo com histórico em outro setor', () => {
      const app = createApp({
        'Ana': { nivel: 'N1', setor_atual: 'Suporte' },
        'Bia': { nivel: 'N1', setor_atual: 'Financeiro' }
      }, [{ Atendente: 'Ana', Setor: 'Financeiro' }]);
      app.context.filters.setor = 'Financeiro';
      app.context.renderColaboradores();
      assert.ok(app.container.innerHTML.includes('data-nome="Bia"'));
      assert.ok(!app.container.innerHTML.includes('data-nome="Ana"'));
    });
    it('combina nível e busca sem acento nos cartões', () => {
      const app = createApp(info);
      app.context.filters.nivel = 'N1';
      app.context.filters.pesquisa = 'janaina';
      app.context.renderColaboradores();
      assert.ok(app.container.innerHTML.includes('data-nome="Janaína Francisca da Silva"'));
      assert.ok(!app.container.innerHTML.includes('data-nome="Michele Ferreira Nóbrega"'));
      assert.ok(app.container.innerHTML.includes('Editar cadastro'));
    });
    it('não esconde cadastros sem registro no período selecionado', () => {
      const app = createApp(info);
      app.context.filters.periodo = '2026-09';
      app.context.renderColaboradores();
      assert.ok(app.container.innerHTML.includes('data-nome="Janaína Francisca da Silva"'));
      assert.ok(app.container.innerHTML.includes('data-nome="Michele Ferreira Nóbrega"'));
    });
    it('mantém os registros filtrados pelo período ao voltar aos indicadores', () => {
      const app = createApp(info, [
        { Atendente: 'Janaína Francisca da Silva', 'Mês': '2026-09' },
        { Atendente: 'Michele Ferreira Nóbrega', 'Mês': '2026-08' }
      ]);
      app.context.filters.periodo = '2026-09';
      assert.equal(app.context.filters.aplicar(app.context.rawRecords).length, 1);
      app.context.document.body.dataset.activeTab = 'dashboard';
      assert.equal(app.context.filters.periodo, '2026-09');
      assert.equal(app.context.filters.aplicar(app.context.rawRecords)[0].Atendente, 'Janaína Francisca da Silva');
    });
    it('seleção de meses vazia mostra nenhum resultado; limpar restaura os dados', () => {
      const app = createApp(info, [{ Atendente: 'Janaína Francisca da Silva', 'Mês': '2026-09' }]);
      app.context.filters.periodo = '__multi__';
      app.context.filters.mesesSelecionados = [];
      assert.equal(app.context.filters.aplicar(app.context.rawRecords).length, 0);
      app.context.filters.limpar();
      assert.equal(app.context.filters.aplicar(app.context.rawRecords).length, 1);
    });
    it('usa a mesma busca sem acento para os indicadores', () => {
      const app = createApp(info, [{ Atendente: 'Janaína Francisca da Silva', Setor: 'Financeiro' }]);
      app.context.filters.pesquisa = 'janaina';
      assert.equal(app.context.filters.aplicar(app.context.rawRecords).length, 1);
      app.context.filters.pesquisa = 'financeiro';
      assert.equal(app.context.filters.aplicar(app.context.rawRecords).length, 1);
    });
    it('classifica os limites de score de forma consistente', () => {
      const app = createApp();
      assert.equal(app.context.getClasseScore(4.49), 'score-critico');
      assert.equal(app.context.getClasseScore(4.5), 'score-atencao');
      assert.equal(app.context.getClasseScore(4.69), 'score-atencao');
      assert.equal(app.context.getClasseScore(4.7), 'score-excelente');
      assert.equal(app.context.getClasseScore('—'), 'score-neutro');
      assert.equal(app.context.getClasseScore(null), 'score-neutro');
    });
    it('restaura um intervalo válido depois de limpar os filtros e inverte datas fora de ordem', () => {
      const app = createApp();
      const elements = {
        gfPeriodo: { value: '__range__' },
        gfMonthStart: { value: '', options: [{ value: '2026-08' }, { value: '2026-09' }] },
        gfMonthEnd: { value: '', options: [{ value: '2026-08' }, { value: '2026-09' }] }
      };
      const original = app.context.document.getElementById;
      app.context.document.getElementById = id => elements[id] || original(id);
      app.context.filters._collectAndNotify();
      assert.equal(elements.gfMonthStart.value, '2026-08');
      assert.equal(elements.gfMonthEnd.value, '2026-09');
      elements.gfMonthStart.value = '2026-09'; elements.gfMonthEnd.value = '2026-08';
      app.context.filters._collectAndNotify();
      assert.equal(elements.gfMonthStart.value, '2026-08');
      assert.equal(elements.gfMonthEnd.value, '2026-09');
    });
    it('resolve o nome completo digitado sem acento para o nome cadastrado', () => {
      const app = createApp(info);
      app.context.filters._colabNames = ['Janaína Francisca da Silva'];
      const original = app.context.document.getElementById;
      app.context.document.getElementById = id => id === 'gfPesquisa'
        ? { value: 'janaina francisca da silva' } : original(id);
      app.context.filters._collectAndNotify();
      assert.equal(app.context.filters.colaborador, 'Janaína Francisca da Silva');
      assert.equal(app.context.filters.pesquisa, '');
    });
  });
};
