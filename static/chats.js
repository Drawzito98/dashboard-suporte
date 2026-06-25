let chatsIntervalId = null;
let chatsAutoRefresh = true;
const CHATS_DEFAULT_DEPT = '6595602255960f38e6f6b9b1';
const CHATS_PROXY = location.hostname === 'localhost' || location.hostname === '127.0.0.1'
  ? '/proxy' : '/api/chat-proxy';

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

function getSessionCookie() {
  try { return localStorage.getItem('lider_session_cookie') || ''; } catch { return ''; }
}

function setSessionCookie(val) {
  try { localStorage.setItem('lider_session_cookie', val); } catch {}
}

async function fetchProxy(path, cookie) {
  const r = await fetch(CHATS_PROXY + '?path=' + encodeURIComponent(path), {
    headers: { 'X-Session-Cookie': cookie }
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(r.status + ': ' + t.slice(0, 150));
  }
  return r.json();
}

function getBrazilDate() {
  const br = Date.now() - 3 * 3600 * 1000;
  return new Date(br).toISOString().slice(0, 10);
}

function computeAgentMetrics(chats, agentId) {
  const today = getBrazilDate();
  let assumiu = 0, transferiu = 0, finalizou = 0;
  for (const c of chats) {
    const status = c.status || '';
    const history = c.history || [];
    const allAtts = history.filter(h => h.type === 'in_attendance');
    const humanAtts = allAtts.filter(h => h.isHumanAgent === true);
    const agentAtts = humanAtts.filter(h => h.agentId === agentId);
    if (!agentAtts.length) continue;
    const aDate = new Date((agentAtts[0].start || 0)).toISOString().slice(0, 10);
    if (aDate !== today) continue;
    if (!humanAtts.length || humanAtts[0].agentId !== agentId) continue;
    if (allAtts.some(h => h.isHumanAgent === false)) continue;
    assumiu++;
    const last = agentAtts[agentAtts.length - 1];
    const later = humanAtts.filter(h => (h.start || 0) > (last.start || 0));
    if (later.length) {
      transferiu++;
    } else if (status === 'F') {
      finalizou++;
    }
  }
  return { assumiu, transferiu, finalizou };
}

function renderChatsPanel() {
  const c = document.getElementById('chatsContent');
  if (!c) return;
  const savedCookie = getSessionCookie();
  c.innerHTML = `
<div class="card" style="padding:var(--s-5)">
  <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:var(--s-3);margin-bottom:var(--s-4)">
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

  <div style="margin-bottom:var(--s-4);padding:var(--s-3);background:var(--bg-subtle);border-radius:var(--r-md)">
    <div style="display:flex;align-items:center;gap:var(--s-3);flex-wrap:wrap">
      <span style="font-size:13px;font-weight:600;color:var(--text-strong);white-space:nowrap">🔑 Sessão</span>
      <input id="chatsCookieInput" type="text" style="flex:1;min-width:200px;font-size:12px;padding:6px 10px;border-radius:var(--r-sm);border:1px solid var(--border);background:var(--bg-surface);color:var(--text-primary);font-family:monospace" placeholder="Cole o cookie connect.sid aqui..." value="${savedCookie}">
      <button class="btn-small" id="chatsConnectBtn" type="button">Conectar</button>
    </div>
    <div style="font-size:11px;color:var(--text-muted);margin-top:6px">
      Como obter: <code style="background:var(--bg-surface);padding:1px 6px;border-radius:3px">F12 → Application → Cookies → lider.opasuite.com.br → connect.sid</code>
    </div>
  </div>

  <div id="chatsAlert" class="hidden" style="padding:var(--s-3);border-radius:var(--r-md);margin-bottom:var(--s-4);font-size:13px"></div>

  <div style="margin-bottom:var(--s-4);padding:var(--s-3);background:var(--bg-subtle);border-radius:var(--r-md)">
    <div style="font-size:13px;font-weight:600;color:var(--text-strong);margin-bottom:var(--s-2)">📋 Departamento: ¡HOLA! - Telefonía</div>
    <div id="chatsDeptGrid" style="font-size:13px;color:var(--text-secondary)"></div>
  </div>

  <div style="overflow-x:auto">
    <table class="ranking-table" style="min-width:500px">
      <thead>
        <tr>
          <th>#</th>
          <th>Colaborador</th>
          <th>Assumiu</th>
          <th>Transferiu</th>
          <th>Finalizou</th>
        </tr>
      </thead>
      <tbody id="chatsAgentsBody"></tbody>
    </table>
  </div>
</div>`;
  document.getElementById('chatsRefreshBtn').onclick = loadChatsData;
  document.getElementById('chatsAutoCb').onchange = function () {
    chatsAutoRefresh = this.checked;
    if (this.checked) startChatsRefresh(); else stopChatsRefresh();
  };
  document.getElementById('chatsConnectBtn').onclick = function () {
    const val = document.getElementById('chatsCookieInput').value.trim();
    if (!val) return;
    setSessionCookie(val);
    loadChatsData();
  };
  if (savedCookie) loadChatsData();
}

async function loadChatsData() {
  const cookie = getSessionCookie();
  const alertEl = document.getElementById('chatsAlert');
  const deptGrid = document.getElementById('chatsDeptGrid');
  const tbody = document.getElementById('chatsAgentsBody');
  if (!deptGrid || !alertEl || !tbody) return;
  alertEl.classList.add('hidden');
  if (!cookie) {
    deptGrid.innerHTML = 'Cole o cookie da sessão acima e clique em Conectar.';
    return;
  }
  deptGrid.innerHTML = 'Carregando...';
  tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:var(--s-4);color:var(--text-muted);font-size:13px">Carregando...</td></tr>';
  try {
    const deptData = await fetchProxy(
      `api/chats/department/${CHATS_DEFAULT_DEPT}?start=2026-01-01T10:00:00.000Z&end=2026-12-31T22:00:00.000Z`,
      cookie
    );
    const agents = (deptData.agents || []).map(a => ({ id: a.id, name: a.name }));
    deptGrid.innerHTML = `Agentes encontrados: <strong>${agents.length}</strong>`;

    const brNow = Date.now() - 3 * 3600 * 1000;
    const today = new Date(brNow).toISOString().slice(0, 10);
    const tomorrow = new Date(brNow + 86400000).toISOString().slice(0, 10);

    const rows = [];
    for (const a of agents) {
      try {
        const data = await fetchProxy(
          `api/chats/agent/${a.id}?start=${today}T03:00:00.000Z&end=${tomorrow}T03:00:00.000Z`,
          cookie
        );
        const metrics = computeAgentMetrics(data.chats || [], a.id);
        rows.push({ name: a.name, ...metrics });
      } catch {
        rows.push({ name: a.name, assumiu: 0, transferiu: 0, finalizou: 0 });
      }
    }

    rows.sort((a, b) => b.assumiu - a.assumiu || b.finalizou - a.finalizou || a.name.localeCompare(b.name));

    tbody.innerHTML = rows.map((r, i) => `
      <tr>
        <td>${i + 1}</td>
        <td><strong>${r.name}</strong></td>
        <td style="color:var(--text-strong)">${r.assumiu}</td>
        <td style="color:#f59e0b">${r.transferiu}</td>
        <td style="color:#22c55e">${r.finalizou}</td>
      </tr>
    `).join('');

    document.getElementById('chatsTs').textContent = '⏰ ' + new Date().toLocaleTimeString('pt-BR');
  } catch (err) {
    alertEl.className = '';
    alertEl.style.cssText = 'padding:var(--s-3);border-radius:var(--r-md);margin-bottom:var(--s-4);font-size:13px;background:rgba(239,68,68,0.1);color:var(--danger)';
    alertEl.textContent = 'Erro: ' + err.message;
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:var(--s-4);color:var(--text-muted);font-size:13px">Falha ao conectar.</td></tr>';
  }
}
