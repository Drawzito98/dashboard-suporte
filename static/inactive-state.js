// ─── Colaboradores Inativos ────────────────────────────────
const INACTIVE_COLABS_KEY = 'sistema_inactive_colabs_v1';
const DEFAULT_INACTIVE = ['Caio', 'Carina', 'Diogo', 'Gabriel', 'Jessé', 'Joyce', 'Maxsuel', 'Victor'];

function getInactiveColabs() {
  if (!window.__inactiveColabs) {
    try {
      const raw = localStorage.getItem(INACTIVE_COLABS_KEY);
      if (raw) {
        window.__inactiveColabs = new Set(JSON.parse(raw));
      } else {
        window.__inactiveColabs = new Set(DEFAULT_INACTIVE);
        localStorage.setItem(INACTIVE_COLABS_KEY, JSON.stringify(DEFAULT_INACTIVE));
      }
    } catch (e) {
      window.__inactiveColabs = new Set(DEFAULT_INACTIVE);
    }
  }
  return window.__inactiveColabs;
}

function saveInactiveColabs() {
  try {
    localStorage.setItem(INACTIVE_COLABS_KEY, JSON.stringify([...getInactiveColabs()]));
  } catch (e) {}
  if (typeof dbInativosSave === 'function') {
    dbInativosSave(getInactiveColabs());
  }
}

function setColabActive(name, active) {
  if (!requireAdmin()) return;
  const set = getInactiveColabs();
  if (active) set.delete(name);
  else set.add(name);
  saveInactiveColabs();
}

function isColabActive(name) {
  return !getInactiveColabs().has(name);
}

// ─── Setores Inativos ──────────────────────────────────────
const INACTIVE_SETORES_KEY = 'sistema_inactive_setores_v1';

function getInactiveSetores() {
  if (!window.__inactiveSetores) {
    try {
      const raw = localStorage.getItem(INACTIVE_SETORES_KEY);
      if (raw) {
        window.__inactiveSetores = new Set(JSON.parse(raw));
      } else {
        window.__inactiveSetores = new Set();
        localStorage.setItem(INACTIVE_SETORES_KEY, JSON.stringify([]));
      }
    } catch (e) {
      window.__inactiveSetores = new Set();
    }
  }
  return window.__inactiveSetores;
}

function saveInactiveSetores() {
  try {
    localStorage.setItem(INACTIVE_SETORES_KEY, JSON.stringify([...getInactiveSetores()]));
  } catch (e) {}
  if (typeof dbSetorInativosSave === 'function') {
    dbSetorInativosSave(getInactiveSetores());
  }
}

function setSetorActive(name, active) {
  if (!requireAdmin()) return;
  const set = getInactiveSetores();
  if (active) set.delete(name);
  else set.add(name);
  saveInactiveSetores();
}

function isSetorActive(name) {
  return !getInactiveSetores().has(name);
}
