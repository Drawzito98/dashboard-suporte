(function () {
  const engine = window.FibraGameEngine;
  const STORAGE_KEY = 'fibraville_progress_v2';
  const board = document.getElementById('gameBoard');
  let tool = 'select';
  let state = loadState();

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (saved?.version === engine.STATE_VERSION && Array.isArray(saved.buildings) && Array.isArray(saved.cables)) return saved;
    } catch (_) {}
    return engine.initialState();
  }

  function saveState() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) {} }
  function money(value) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value); }
  function buildingAt(x, y) { return engine.buildingAt(state, x, y); }

  function setTool(nextTool) {
    tool = nextTool;
    document.querySelectorAll('[data-tool]').forEach(button => button.classList.toggle('active', button.dataset.tool === tool));
    const labels = { select: 'selecionar', fiber: 'passar fibra', connect: 'instalar cliente', repair: 'reparar chamado', pop: 'construir POP', house: 'construir casa', pharmacy: 'construir farmácia', hospital: 'construir hospital', pole: 'instalar poste', cto: 'instalar CTO' };
    document.getElementById('selectedToolText').textContent = `Ferramenta: ${labels[tool] || tool}`;
    renderBoard();
  }

  function cableDirections(x, y) {
    const networkAt = (nx, ny) => state.cables.includes(engine.key(nx, ny)) || buildingAt(nx, ny)?.type === 'pop';
    const horizontal = networkAt(x - 1, y) || networkAt(x + 1, y);
    const vertical = networkAt(x, y - 1) || networkAt(x, y + 1);
    return horizontal && vertical ? 'cable-cross' : vertical ? 'cable-v' : 'cable-h';
  }

  function isTarget(x, y, building) {
    if (tool === 'fiber') return engine.isRoad(x, y) && !state.cables.includes(engine.key(x, y));
    if (tool === 'connect') return building && engine.BUILDINGS[building.type].demand > 0 && !state.connected.includes(building.id);
    if (tool === 'repair') return building && state.outages.includes(building.id);
    const config = engine.BUILDINGS[tool];
    return !!config && !building && ((config.placement === 'road') === engine.isRoad(x, y));
  }

  function describeCell(x, y, building) {
    if (!building) return engine.isRoad(x, y) ? 'Rua disponível para infraestrutura' : 'Terreno disponível para construção';
    const config = engine.BUILDINGS[building.type];
    const connected = state.connected.includes(building.id);
    const outage = state.outages.includes(building.id);
    return `${config.name}${outage ? ' com chamado aberto' : connected ? ' conectado à rede' : config.demand ? ' aguardando conexão' : ''}`;
  }

  function handleCell(x, y) {
    const building = buildingAt(x, y);
    if (engine.BUILDINGS[tool]) state = engine.build(state, tool, x, y);
    else if (tool === 'fiber') state = engine.layFiber(state, x, y);
    else if (tool === 'connect') state = engine.connectBuilding(state, building?.id);
    else if (tool === 'repair') state = engine.repairBuilding(state, building?.id);
    else state = { ...state, message: describeCell(x, y, building) };
    saveState();
    render();
  }

  function renderBoard() {
    const fragment = document.createDocumentFragment();
    for (let y = 0; y < engine.HEIGHT; y += 1) {
      for (let x = 0; x < engine.WIDTH; x += 1) {
        const road = engine.isRoad(x, y);
        const horizontalRoad = y === 2 || y === 5;
        const verticalRoad = x === 4 || x === 9;
        const building = buildingAt(x, y);
        const cable = state.cables.includes(engine.key(x, y));
        const cell = document.createElement('button');
        cell.type = 'button';
        let classes = `city-cell ${road ? `road ${horizontalRoad && verticalRoad ? 'road-cross' : horizontalRoad ? 'road-horizontal' : 'road-vertical'}` : 'lot'}`;
        if (cable) classes += ` cable ${cableDirections(x, y)}`;
        if (building) {
          classes += ` building building-${building.type}`;
          if (state.connected.includes(building.id)) classes += ' connected';
          if (state.outages.includes(building.id)) classes += ' outage';
          cell.dataset.icon = engine.BUILDINGS[building.type].icon;
        }
        if (isTarget(x, y, building)) classes += ' tool-target';
        cell.className = classes;
        cell.setAttribute('role', 'gridcell');
        cell.setAttribute('aria-label', `${describeCell(x, y, building)}. Coluna ${x + 1}, linha ${y + 1}`);
        cell.title = describeCell(x, y, building);
        cell.addEventListener('click', () => handleCell(x, y));
        fragment.appendChild(cell);
      }
    }
    board.replaceChildren(fragment);
  }

  function objective() {
    if (!state.popLevel) return 'Construa seu primeiro POP';
    if (!state.buildings.some(item => engine.BUILDINGS[item.type].demand)) return 'Construa casas para formar o bairro';
    if (!state.connected.length) return 'Passe fibra pelas ruas e conecte uma casa';
    if (engine.cityLevel(state) === 1) return 'Conecte 2 imóveis para liberar a farmácia';
    if (engine.cityLevel(state) === 2) return 'Expanda o POP e conecte 5 imóveis';
    return 'Cidade conectada — amplie a operação e cuide dos chamados';
  }

  function render() {
    renderBoard();
    const level = engine.cityLevel(state);
    document.getElementById('cityLevelValue').textContent = level;
    document.getElementById('moneyValue').textContent = money(state.money);
    document.getElementById('fiberValue').textContent = `${state.fiber} m`;
    document.getElementById('onuValue').textContent = state.onus;
    document.getElementById('capacityValue').textContent = `${engine.usedCapacity(state)}/${engine.popCapacity(state)}`;
    document.getElementById('satisfactionValue').textContent = `${engine.satisfaction(state)}%`;
    document.getElementById('monthValue').textContent = state.month;
    document.getElementById('objectiveText').textContent = objective();
    document.getElementById('gameMessage').textContent = state.message;
    document.getElementById('upgradeCost').textContent = state.popLevel ? (state.popLevel >= 3 ? 'Máximo' : money(state.popLevel * 700)) : 'Construa o POP';
    document.querySelectorAll('[data-unlock]').forEach(button => {
      const locked = Number(button.dataset.unlock) > level;
      button.classList.toggle('locked', locked);
      button.disabled = locked;
    });
  }

  document.querySelectorAll('[data-tool]').forEach(button => button.addEventListener('click', () => setTool(button.dataset.tool)));
  document.getElementById('buyOnuBtn').addEventListener('click', () => { state = engine.buyOnu(state); saveState(); render(); });
  document.getElementById('buyFiberBtn').addEventListener('click', () => { state = engine.buyFiber(state); saveState(); render(); });
  document.getElementById('upgradePopBtn').addEventListener('click', () => { state = engine.upgradePop(state); saveState(); render(); });
  document.getElementById('nextMonthBtn').addEventListener('click', () => { state = engine.advanceMonth(state); saveState(); render(); });
  document.getElementById('resetGameBtn').addEventListener('click', () => {
    if (!confirm('Recomeçar a cidade e apagar o progresso atual?')) return;
    state = engine.initialState();
    saveState();
    setTool('select');
    render();
  });

  setTool('select');
  render();
})();
