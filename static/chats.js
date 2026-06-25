let chatsIntervalId = null;
let chatsAutoRefresh = true;
let chatsDept = '';
let chatsCache = { depts: [], agents: [], chats: {} };

function onChatsTabActivated() {
  renderChatsPanel();
  startChatsRefresh();
}

function startChatsRefresh() {
  stopChatsRefresh();
  chatsIntervalId = setInterval(() => {
    if (chatsAutoRefresh) loadChatsData();
  }, 30000);
}

function stopChatsRefresh() {
  if (chatsIntervalId) { clearInterval(chatsIntervalId); chatsIntervalId = null; }
}

function _arr(data) {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') {
    for (const k of ['departments', 'agents', 'chats', 'data', 'items', 'list', 'results']) {
      if (Array.isArray(data[k])) return data[k];
    }
  }
  return [];
}

function _id(item) {
  if (!item) return '';
  return String(item.id || item._id || item.codigo || item.cod || item.ID || '');
}

function _name(item) {
  if (!item) return '';
  return String(item.nome || item.name || item.Nome || item.nm || item.descricao || item.label || item.title || '');
}

function _status(chat) {
  if (!chat) return '';
  return String(chat.status || chat.Status || chat.situacao || chat.state || '');
}

function _protocolo(chat) {
  if (!chat) return '';
  return String(chat.protocolo || chat.Protocolo || chat.id || chat.ID || chat.numero || chat.num || chat.protocol || '');
}

function _ai(chat) {
  return !!(chat.aiAssisted || chat.ai_assisted || chat.ai || chat.AI || chat.iaAssistida);
}

function _agents(chat) {
  const a = chat.agents || chat.agentes || chat.Agents || chat.Agentes || chat.agent || [];
  return Array.isArray(a) ? a : (a ? [a] : []);
}

function _time(chat) {
  return chat.createdAt || chat.created_at || chat.createdAt || chat.data || chat.Data || chat.dataHora || chat.inicio || chat.start || '';
}

function renderChatsPanel() {
  const c = document.getElementById('chatsContent');
  if (!c) return;
  c.innerHTML = `
<div class="card" style="padding:var(--s-5)">
  <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:var(--s-3);margin-bottom:var(--s-5)">
    <h2 style="margin:0;font-size:18px;font-weight:700;color:var(--text-strong)">💬 Chat Online</h2>
    <div style="display:flex;align-items:center;gap:var(--s-3);flex-wrap:wrap">
      <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:13px;color:var(--text-secondary)">
        <input type="checkbox" id="chatsAutoCb" checked>
        Auto <span style="color:var(--text-muted);font-size:11px">30s</span>
      </label>
      <button class="btn-small" id="chatsRefreshBtn" type="button">🔄 Atualizar</button>
      <span id="chatsTs" style="font-size:11px;color:var(--text-muted)"></span>
    </div>
  </div>
  <div id="chatsAlert" class="hidden" style="padding:var(--s-3);border-radius:var(--r-md);margin-bottom:var(--s-4);font-size:13px"></div>
  <div id="chatsDeptGrid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:var(--s-3);margin-bottom:var(--s-5)"></div>
  <div style="margin-bottom:var(--s-5)">
    <h3 style="font-size:14px;font-weight:600;margin:0 0 var(--s-3);color:var(--text-strong)">👤 Agentes</h3>
    <div id="chatsAgentsTbl" style="overflow-x:auto"></div>
  </div>
  <div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--s-3);flex-wrap:wrap;gap:var(--s-2)">
      <h3 style="font-size:14px;font-weight:600;margin:0;color:var(--text-strong)">💬 Chats</h3>
      <select id="chatsDeptFilter" style="font-size:12px;padding:4px 10px;border-radius:var(--r-sm);border:1px solid var(--border);background:var(--bg-surface);color:var(--text-primary);max-width:200px">
        <option value="">Todos os departamentos</option>
      </select>
    </div>
    <div id="chatsList" style="overflow-x:auto"></div>
  </div>
</div>`;
  document.getElementById('chatsRefreshBtn').onclick = loadChatsData;
  document.getElementById('chatsAutoCb').onchange = function () {
    chatsAutoRefresh = this.checked;
    if (this.checked) startChatsRefresh();
    else stopChatsRefresh();
  };
  const filterSel = document.getElementById('chatsDeptFilter');
  if (filterSel) filterSel.onchange = function () {
    chatsDept = this.value;
    chatsCache.chats = {};
    fetchChats();
  };
  loadChatsData();
}

async function loadChatsData() {
  const alertEl = document.getElementById('chatsAlert');
  const deptGrid = document.getElementById('chatsDeptGrid');
  if (!deptGrid || !alertEl) return;
  alertEl.classList.add('hidden');
  deptGrid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:var(--s-5);color:var(--text-muted);font-size:13px">Carregando...</div>';
  try {
    const [d, a] = await Promise.all([fetchProxy('departments'), fetchProxy('agents')]);
    chatsCache.depts = _arr(d);
    chatsCache.agents = _arr(a);
    renderDeptGrid();
    renderAgents();
    updateDeptFilter();
    await fetchChats();
    document.getElementById('chatsTs').textContent = '⏰ ' + new Date().toLocaleTimeString('pt-BR');
  } catch (err) {
    alertEl.className = '';
    alertEl.style.cssText = 'padding:var(--s-3);border-radius:var(--r-md);margin-bottom:var(--s-4);font-size:13px;background:rgba(239,68,68,0.1);color:var(--danger)';
    alertEl.textContent = 'Erro: ' + err.message;
    deptGrid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:var(--s-5);color:var(--text-muted);font-size:13px">Falha ao carregar. Verifique se o proxy está implantado e as env vars configuradas.</div>';
  }
}

async function fetchProxy(path) {
  const r = await fetch('/api/chat-proxy?path=' + encodeURIComponent(path));
  if (!r.ok) {
    const t = await r.text();
    throw new Error(r.status + ': ' + t.slice(0, 150));
  }
  return r.json();
}

function renderDeptGrid() {
  const g = document.getElementById('chatsDeptGrid');
  if (!g) return;
  const depts = chatsCache.depts;
  if (!depts.length) {
    g.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:var(--s-4);color:var(--text-muted);font-size:13px">Nenhum departamento encontrado.</div>';
    return;
  }
  g.innerHTML = depts.map(d => {
    const id = _id(d);
    const nm = _name(d);
    const active = chatsDept && chatsDept === id;
    return `<div class="card" data-dept-id="${id}" style="padding:var(--s-3);cursor:pointer;text-align:center;${active ? 'border-color:var(--primary);box-shadow:0 0 0 2px var(--primary-alpha, rgba(99,102,241,0.3))' : ''}">
      <div style="font-weight:600;font-size:14px;color:var(--text-strong)">${nm || id}</div>
      <div style="font-size:12px;color:var(--text-muted);margin-top:4px">${id ? 'ID: ' + id : ''}</div>
    </div>`;
  }).join('');
  g.querySelectorAll('.card').forEach(el => {
    el.onclick = () => {
      const id = el.dataset.deptId;
      chatsDept = id;
      const filter = document.getElementById('chatsDeptFilter');
      if (filter) filter.value = id;
      chatsCache.chats = {};
      fetchChats();
      renderDeptGrid();
    };
  });
}

function renderAgents() {
  const t = document.getElementById('chatsAgentsTbl');
  if (!t) return;
  const agents = chatsCache.agents;
  if (!agents.length) {
    t.innerHTML = '<div style="padding:var(--s-3);color:var(--text-muted);font-size:13px">Nenhum agente encontrado.</div>';
    return;
  }
  let html = '<table class="ranking-table" style="min-width:400px"><thead><tr><th>Nome</th><th>Departamento</th></tr></thead><tbody>';
  agents.forEach(a => {
    const nm = _name(a);
    const deptNm = _name(a.department || a.departamento || a.setor || a.Departamento || '');
    html += `<tr><td><strong>${nm || _id(a)}</strong></td><td>${deptNm || '-'}</td></tr>`;
  });
  html += '</tbody></table>';
  t.innerHTML = html;
}

function updateDeptFilter() {
  const sel = document.getElementById('chatsDeptFilter');
  if (!sel) return;
  const cur = sel.value;
  sel.innerHTML = '<option value="">Todos os departamentos</option>' +
    chatsCache.depts.map(d => `<option value="${_id(d)}">${_name(d) || _id(d)}</option>`).join('');
  if (cur) sel.value = cur;
}

async function fetchChats() {
  const listEl = document.getElementById('chatsList');
  if (!listEl) return;
  listEl.innerHTML = '<div style="text-align:center;padding:var(--s-4);color:var(--text-muted);font-size:13px">Carregando chats...</div>';
  try {
    const today = new Date().toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    let allChats = [];
    if (chatsDept) {
      const data = await fetchProxy(`department/${chatsDept}?start=${today}&end=${tomorrow}`);
      allChats = _arr(data);
    } else {
      const depts = chatsCache.depts;
      if (!depts.length) {
        listEl.innerHTML = '<div style="text-align:center;padding:var(--s-4);color:var(--text-muted);font-size:13px">Nenhum departamento disponível.</div>';
        return;
      }
      const results = await Promise.allSettled(depts.slice(0, 10).map(d =>
        fetchProxy(`department/${_id(d)}?start=${today}&end=${tomorrow}`)
      ));
      results.forEach(r => {
        if (r.status === 'fulfilled') allChats = allChats.concat(_arr(r.value));
      });
    }
    renderChatsList(allChats);
  } catch (err) {
    listEl.innerHTML = `<div style="text-align:center;padding:var(--s-4);color:var(--danger);font-size:13px">Erro ao carregar chats: ${err.message}</div>`;
  }
}

function renderChatsList(chats) {
  const listEl = document.getElementById('chatsList');
  if (!listEl) return;
  if (!chats || !chats.length) {
    listEl.innerHTML = '<div style="text-align:center;padding:var(--s-4);color:var(--text-muted);font-size:13px">Nenhum chat encontrado no período.</div>';
    return;
  }
  const sorted = [...chats].sort((a, b) => {
    const ta = String(_time(a) || '');
    const tb = String(_time(b) || '');
    return tb.localeCompare(ta);
  });
  let html = '<table class="ranking-table" style="min-width:600px"><thead><tr><th>Protocolo</th><th>Status</th><th>Agentes</th><th>IA</th><th>Início</th></tr></thead><tbody>';
  sorted.slice(0, 100).forEach(ch => {
    const prot = _protocolo(ch) || '-';
    const st = _status(ch) || '-';
    const agents = _agents(ch);
    const agentNames = agents.map(a => _name(a) || _id(a) || '').filter(Boolean).join(', ') || '-';
    const ia = _ai(ch);
    const tm = _time(ch);
    const tmStr = tm ? (typeof tm === 'string' ? tm.slice(0, 16).replace('T', ' ') : String(tm)) : '-';
    html += `<tr>
      <td><strong>${prot}</strong></td>
      <td>${st}</td>
      <td>${agentNames}</td>
      <td>${ia ? '<span style="color:var(--accent);font-weight:600">🤖 Sim</span>' : '-'}</td>
      <td style="font-size:12px;color:var(--text-secondary)">${tmStr}</td>
    </tr>`;
  });
  html += '</tbody></table>';
  if (sorted.length > 100) html += `<div style="text-align:center;padding:var(--s-2);font-size:12px;color:var(--text-muted)">Mostrando 100 de ${sorted.length} chats</div>`;
  listEl.innerHTML = html;
}
