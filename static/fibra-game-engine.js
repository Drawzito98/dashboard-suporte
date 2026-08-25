(function (root) {
  const WIDTH = 12;
  const HEIGHT = 8;
  const STATE_VERSION = 2;
  const BUILDINGS = {
    pop: { name: 'POP', icon: '📡', cost: 900, demand: 0, revenue: 0, unlock: 1, placement: 'lot' },
    house: { name: 'Casa', icon: '🏠', cost: 250, demand: 1, revenue: 45, unlock: 1, placement: 'lot' },
    pharmacy: { name: 'Farmácia', icon: '💊', cost: 650, demand: 2, revenue: 120, unlock: 2, placement: 'lot' },
    hospital: { name: 'Hospital', icon: '🏥', cost: 1400, demand: 3, revenue: 280, unlock: 3, placement: 'lot' },
    pole: { name: 'Poste', icon: '⚡', cost: 80, demand: 0, revenue: 0, unlock: 1, placement: 'road' },
    cto: { name: 'CTO', icon: '▣', cost: 180, demand: 0, revenue: 0, unlock: 1, placement: 'road' }
  };
  const FIBER_COST = 20;
  const FIBER_USE = 10;
  const ONU_COST = 120;
  const FIBER_PACK_COST = 180;
  const REPAIR_COST = 90;
  const key = (x, y) => `${x},${y}`;
  const inBounds = (x, y) => x >= 0 && y >= 0 && x < WIDTH && y < HEIGHT;
  const neighbors = (x, y) => [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]].filter(([nx, ny]) => inBounds(nx, ny));
  const isRoad = (x, y) => y === 2 || y === 5 || x === 4 || x === 9;

  function initialState() {
    return { version: STATE_VERSION, month: 1, money: 3000, fiber: 80, onus: 2, popLevel: 0, buildings: [], cables: [], connected: [], outages: [], nextId: 1, message: 'Construa seu primeiro POP ao lado de uma rua.' };
  }

  function cityLevel(state) {
    const clients = state.connected.length;
    return clients >= 5 ? 3 : clients >= 2 ? 2 : 1;
  }

  function popCapacity(state) {
    return state.popLevel * 4;
  }

  function usedCapacity(state) {
    return state.connected.reduce((total, id) => {
      const building = state.buildings.find(item => item.id === id);
      return total + (building ? BUILDINGS[building.type].demand : 0);
    }, 0);
  }

  function buildingAt(state, x, y) {
    return state.buildings.find(item => item.x === x && item.y === y);
  }

  function hasNetworkNeighbor(state, x, y) {
    return neighbors(x, y).some(([nx, ny]) => {
      if (state.cables.includes(key(nx, ny))) return true;
      const building = buildingAt(state, nx, ny);
      return building?.type === 'pop';
    });
  }

  function build(state, type, x, y) {
    const config = BUILDINGS[type];
    if (!config || !inBounds(x, y) || buildingAt(state, x, y) || (config.placement === 'lot' && state.cables.includes(key(x, y)))) return { ...state, message: 'Este espaço já está ocupado.' };
    if (config.unlock > cityLevel(state)) return { ...state, message: `${config.name} será liberado no nível ${config.unlock}.` };
    if ((config.placement === 'road') !== isRoad(x, y)) return { ...state, message: config.placement === 'road' ? 'Instale este equipamento sobre uma rua.' : 'Construa este prédio em um terreno livre.' };
    if (type === 'pop' && state.buildings.some(item => item.type === 'pop')) return { ...state, message: 'Amplie o POP atual antes de construir outro.' };
    if (type === 'pop' && !neighbors(x, y).some(([nx, ny]) => isRoad(nx, ny))) return { ...state, message: 'O POP precisa ficar ao lado de uma rua.' };
    if (state.money < config.cost) return { ...state, message: 'Caixa insuficiente para esta construção.' };
    const id = `b${state.nextId}`;
    return { ...state, money: state.money - config.cost, popLevel: type === 'pop' ? 1 : state.popLevel, buildings: [...state.buildings, { id, type, x, y }], nextId: state.nextId + 1, message: `${config.name} construído com sucesso.` };
  }

  function layFiber(state, x, y) {
    if (!isRoad(x, y)) return { ...state, message: 'A fibra deve acompanhar as ruas.' };
    if (state.cables.includes(key(x, y))) return { ...state, message: 'Este trecho já está ocupado.' };
    if (!state.buildings.some(item => item.type === 'pop')) return { ...state, message: 'Construa um POP antes de lançar fibra.' };
    if (!hasNetworkNeighbor(state, x, y)) return { ...state, message: 'Continue a fibra a partir do POP ou de outro trecho.' };
    if (state.money < FIBER_COST || state.fiber < FIBER_USE) return { ...state, message: 'Compre mais fibra ou aguarde caixa para expandir.' };
    return { ...state, money: state.money - FIBER_COST, fiber: state.fiber - FIBER_USE, cables: [...state.cables, key(x, y)], message: 'Novo trecho de fibra lançado.' };
  }

  function connectBuilding(state, buildingId) {
    const building = state.buildings.find(item => item.id === buildingId);
    if (!building || !BUILDINGS[building.type].demand || state.connected.includes(buildingId)) return { ...state, message: 'Selecione um imóvel ainda não conectado.' };
    if (!hasNetworkNeighbor(state, building.x, building.y)) return { ...state, message: 'A fibra precisa passar ao lado deste imóvel.' };
    const demand = BUILDINGS[building.type].demand;
    if (state.onus < demand) return { ...state, message: `Esta instalação precisa de ${demand} ONU${demand === 1 ? '' : 's'}.` };
    if (usedCapacity(state) + demand > popCapacity(state)) return { ...state, message: 'Capacidade do POP esgotada. Faça uma melhoria.' };
    return { ...state, onus: state.onus - demand, connected: [...state.connected, buildingId], message: `${BUILDINGS[building.type].name} conectado à rede.` };
  }

  function buyOnu(state) {
    if (state.money < ONU_COST) return { ...state, message: 'Caixa insuficiente para comprar uma ONU.' };
    return { ...state, money: state.money - ONU_COST, onus: state.onus + 1, message: 'Uma ONU foi adicionada ao estoque.' };
  }

  function buyFiber(state) {
    if (state.money < FIBER_PACK_COST) return { ...state, message: 'Caixa insuficiente para comprar fibra.' };
    return { ...state, money: state.money - FIBER_PACK_COST, fiber: state.fiber + 100, message: 'Bobina com 100 m de fibra recebida.' };
  }

  function upgradePop(state) {
    if (!state.popLevel) return { ...state, message: 'Construa um POP primeiro.' };
    if (state.popLevel >= 3) return { ...state, message: 'O POP já está no nível máximo desta versão.' };
    const cost = state.popLevel * 700;
    if (state.money < cost) return { ...state, message: `A melhoria custa R$ ${cost}.` };
    return { ...state, money: state.money - cost, popLevel: state.popLevel + 1, message: `POP ampliado para o nível ${state.popLevel + 1}.` };
  }

  function repairBuilding(state, buildingId) {
    if (!state.outages.includes(buildingId)) return state;
    if (state.money < REPAIR_COST) return { ...state, message: 'Caixa insuficiente para enviar a equipe técnica.' };
    return { ...state, money: state.money - REPAIR_COST, outages: state.outages.filter(id => id !== buildingId), message: 'Chamado resolvido e sinal restabelecido.' };
  }

  function advanceMonth(state, randomValue = Math.random()) {
    const active = state.connected.filter(id => !state.outages.includes(id));
    const revenue = active.reduce((total, id) => {
      const building = state.buildings.find(item => item.id === id);
      return total + (building ? BUILDINGS[building.type].revenue : 0);
    }, 0);
    let outages = [...state.outages];
    let message = `Receita mensal: R$ ${revenue}.`;
    if (state.connected.length && !outages.length && randomValue < .25) {
      const index = Math.min(state.connected.length - 1, Math.floor((randomValue / .25) * state.connected.length));
      outages.push(state.connected[index]);
      message += ' Um cliente abriu chamado de falta de sinal.';
    }
    return { ...state, month: state.month + 1, money: state.money + revenue, outages, message };
  }

  function satisfaction(state) {
    if (!state.connected.length) return 100;
    return Math.round(((state.connected.length - state.outages.length) / state.connected.length) * 100);
  }

  const api = { WIDTH, HEIGHT, STATE_VERSION, BUILDINGS, FIBER_COST, FIBER_USE, ONU_COST, FIBER_PACK_COST, REPAIR_COST, key, isRoad, initialState, cityLevel, popCapacity, usedCapacity, buildingAt, hasNetworkNeighbor, build, layFiber, connectBuilding, buyOnu, buyFiber, upgradePop, repairBuilding, advanceMonth, satisfaction };
  root.FibraGameEngine = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
