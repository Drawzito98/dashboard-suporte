(function (root) {
  const WIDTH = 10;
  const HEIGHT = 7;
  const CABLE_COST = 40;
  const INSTALL_COST = 80;
  const REPAIR_COST = 60;
  const POP = { x: 0, y: 3 };
  const HOUSES = [
    { id: 'h1', x: 3, y: 1, name: 'Casa Oliveira' },
    { id: 'h2', x: 5, y: 5, name: 'Mercado Central' },
    { id: 'h3', x: 7, y: 2, name: 'Casa Lima' },
    { id: 'h4', x: 9, y: 5, name: 'Escola do Bairro' }
  ];
  const BLOCKED = new Set(['2,2', '2,3', '4,3', '6,4', '8,3']);
  const key = (x, y) => `${x},${y}`;
  const inBounds = (x, y) => x >= 0 && y >= 0 && x < WIDTH && y < HEIGHT;
  const neighbors = (x, y) => [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]].filter(([nx, ny]) => inBounds(nx, ny));

  function initialState() {
    return { day: 1, budget: 1200, revenue: 0, cables: [], connected: [], outages: [], actions: 0, message: 'Leve a fibra do POP até os quatro clientes.' };
  }

  function isNetworkCell(state, x, y) {
    return (x === POP.x && y === POP.y) || state.cables.includes(key(x, y));
  }

  function adjacentToNetwork(state, x, y) {
    return neighbors(x, y).some(([nx, ny]) => isNetworkCell(state, nx, ny));
  }

  function placeCable(state, x, y) {
    if (!inBounds(x, y) || BLOCKED.has(key(x, y)) || HOUSES.some(h => h.x === x && h.y === y) || isNetworkCell(state, x, y)) return { ...state, message: 'Não é possível instalar cabo nesse ponto.' };
    if (!adjacentToNetwork(state, x, y)) return { ...state, message: 'Continue a fibra a partir da rede existente.' };
    if (state.budget < CABLE_COST) return { ...state, message: 'Orçamento insuficiente para passar o cabo.' };
    return { ...state, budget: state.budget - CABLE_COST, cables: [...state.cables, key(x, y)], actions: state.actions + 1, message: 'Trecho de fibra instalado.' };
  }

  function connectHouse(state, houseId) {
    const house = HOUSES.find(item => item.id === houseId);
    if (!house || state.connected.includes(houseId)) return state;
    if (!adjacentToNetwork(state, house.x, house.y)) return { ...state, message: 'A fibra ainda não chegou perto deste cliente.' };
    if (state.budget < INSTALL_COST) return { ...state, message: 'Orçamento insuficiente para instalar o cliente.' };
    return { ...state, budget: state.budget - INSTALL_COST, connected: [...state.connected, houseId], actions: state.actions + 1, message: `${house.name} conectado com sucesso.` };
  }

  function repairHouse(state, houseId) {
    if (!state.outages.includes(houseId)) return state;
    if (state.budget < REPAIR_COST) return { ...state, message: 'Orçamento insuficiente para o reparo.' };
    const house = HOUSES.find(item => item.id === houseId);
    return { ...state, budget: state.budget - REPAIR_COST, outages: state.outages.filter(id => id !== houseId), actions: state.actions + 1, message: `Sinal de ${house.name} restabelecido.` };
  }

  function advanceDay(state, randomValue = Math.random()) {
    const active = state.connected.filter(id => !state.outages.includes(id));
    const dailyRevenue = active.length * 35;
    let outages = [...state.outages];
    let message = dailyRevenue ? `Receita do dia: R$ ${dailyRevenue}.` : 'Nenhum cliente ativo gerou receita hoje.';
    if (state.connected.length && !outages.length && randomValue < .3) {
      const index = Math.min(state.connected.length - 1, Math.floor((randomValue / .3) * state.connected.length));
      outages.push(state.connected[index]);
      message += ' Um chamado de rompimento foi aberto.';
    }
    return { ...state, day: state.day + 1, budget: state.budget + dailyRevenue, revenue: state.revenue + dailyRevenue, outages, message };
  }

  function satisfaction(state) {
    if (!state.connected.length) return 100;
    return Math.max(0, Math.round(((state.connected.length - state.outages.length) / state.connected.length) * 100));
  }

  const api = { WIDTH, HEIGHT, CABLE_COST, INSTALL_COST, REPAIR_COST, POP, HOUSES, BLOCKED, key, initialState, placeCable, connectHouse, repairHouse, advanceDay, satisfaction, adjacentToNetwork };
  root.FibraGameEngine = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
