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
    console, rawRecords: records,
    localStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) },
    document: {
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
      assert.ok(app.container.innerHTML.includes('Nenhum colaborador neste nível'));
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
  });
};
