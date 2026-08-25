(function () {
  const engine = window.FibraGameEngine;
  const STORAGE_KEY = 'fibraville_progress_v1';
  const board = document.getElementById('gameBoard');
  let state = loadState();

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (saved && Array.isArray(saved.cables) && Array.isArray(saved.connected) && Array.isArray(saved.outages)) return saved;
    } catch (_) {}
    return engine.initialState();
  }

  function saveState() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) {}
  }

  function money(value) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);
  }

  function cellType(x, y) {
    if (x === engine.POP.x && y === engine.POP.y) return { type: 'pop', label: 'POP da rede' };
    const house = engine.HOUSES.find(item => item.x === x && item.y === y);
    if (house) {
      const connected = state.connected.includes(house.id);
      const outage = state.outages.includes(house.id);
      return { type: `house${connected ? ' connected' : ''}${outage ? ' outage' : ''}`, label: `${house.name}${outage ? ', com chamado aberto' : connected ? ', conectado' : ', aguardando instalação'}`, house };
    }
    if (engine.BLOCKED.has(engine.key(x, y))) return { type: 'blocked', label: 'Obstáculo' };
    if (state.cables.includes(engine.key(x, y))) return { type: 'cable', label: 'Trecho de fibra instalado' };
    return { type: `terrain${engine.adjacentToNetwork(state, x, y) ? ' reachable' : ''}`, label: 'Terreno livre' };
  }

  function handleCell(x, y) {
    const house = engine.HOUSES.find(item => item.x === x && item.y === y);
    if (house) state = state.outages.includes(house.id) ? engine.repairHouse(state, house.id) : engine.connectHouse(state, house.id);
    else state = engine.placeCable(state, x, y);
    saveState();
    render();
  }

  function renderBoard() {
    const fragment = document.createDocumentFragment();
    for (let y = 0; y < engine.HEIGHT; y += 1) {
      for (let x = 0; x < engine.WIDTH; x += 1) {
        const info = cellType(x, y);
        const cell = document.createElement('button');
        cell.type = 'button';
        cell.className = `cell ${info.type}`;
        cell.setAttribute('role', 'gridcell');
        cell.setAttribute('aria-label', `${info.label}. Coluna ${x + 1}, linha ${y + 1}`);
        cell.addEventListener('click', () => handleCell(x, y));
        fragment.appendChild(cell);
      }
    }
    board.replaceChildren(fragment);
  }

  function render() {
    renderBoard();
    document.getElementById('dayValue').textContent = state.day;
    document.getElementById('budgetValue').textContent = money(state.budget);
    document.getElementById('clientsValue').textContent = state.connected.length;
    document.getElementById('satisfactionValue').textContent = `${engine.satisfaction(state)}%`;
    document.getElementById('missionProgress').textContent = `${state.connected.length}/${engine.HOUSES.length}`;
    document.getElementById('missionText').textContent = state.connected.length === engine.HOUSES.length ? 'Bairro conectado — mantenha a rede saudável' : 'Conecte os quatro clientes do bairro';
    document.getElementById('gameMessage').textContent = state.message;
  }

  document.getElementById('nextDayBtn').addEventListener('click', () => { state = engine.advanceDay(state); saveState(); render(); });
  document.getElementById('resetGameBtn').addEventListener('click', () => {
    if (!confirm('Recomeçar o bairro e apagar o progresso atual?')) return;
    state = engine.initialState();
    saveState();
    render();
  });

  render();
})();
