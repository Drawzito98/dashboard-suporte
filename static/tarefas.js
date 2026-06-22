// tarefas.js — Agenda / Tarefas

const TAREFAS_EDITING_KEY = 'sistema_tarefa_editando_v1';

function hoje() {
  return new Date().toISOString().slice(0, 10);
}

function formatarData(dataStr) {
  if (!dataStr) return '';
  const [ano, mes, dia] = dataStr.split('-');
  return `${dia}/${mes}/${ano}`;
}

const PRIORIDADE_LABEL = { baixa: '🟢 Baixa', media: '🟡 Média', alta: '🔴 Alta' };
const STATUS_LABEL = { pendente: '⏳ Pendente', concluida: '✅ Concluída', cancelada: '❌ Cancelada' };

function renderTarefas() {
  const container = document.getElementById('tarefasContent');
  if (!container) return;

  const saved = JSON.parse(localStorage.getItem(TAREFAS_LOCAL_KEY) || '[]');
  const editingRaw = localStorage.getItem(TAREFAS_EDITING_KEY);
  const editing = editingRaw ? JSON.parse(editingRaw) : null;
  const filtroStatus = sessionStorage.getItem('tarefas_filtro_status') || 'todas';

  let html = '';

  // ── Formulário ──
  html += '<div class="card" style="margin-bottom:var(--s-5)">';
  html += '<div style="margin-bottom:var(--s-4)">';
  const formTitle = editing?.id ? '✏️ Editar Tarefa' : '📅 Nova Tarefa';
  html += `<h3 style="font-size:15px;font-weight:600;margin-bottom:4px">${formTitle}</h3>`;
  html += '<p style="font-size:13px;color:var(--text-secondary)">Cadastre atividades e compromissos.</p>';
  html += '</div>';

  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--s-3);margin-bottom:var(--s-3)">';
  html += '<div class="field"><span>Título</span>';
  html += `<input type="text" id="tarefaTituloInput" placeholder="Ex: Reunião de alinhamento" value="${editing ? escapeHtml(editing.titulo || '') : ''}">`;
  html += '</div>';
  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--s-3)">';
  html += '<div class="field"><span>Data</span>';
  html += `<input type="date" id="tarefaDataInput" value="${editing ? (editing.data || hoje()) : hoje()}">`;
  html += '</div>';
  html += '<div class="field"><span>Prioridade</span>';
  const prio = editing ? (editing.prioridade || 'media') : 'media';
  html += `<select id="tarefaPrioridadeInput">`;
  for (const [val, label] of Object.entries(PRIORIDADE_LABEL)) {
    html += `<option value="${val}"${val === prio ? ' selected' : ''}>${label}</option>`;
  }
  html += '</select></div></div></div>';

  html += '<div class="field" style="margin-bottom:var(--s-3)">';
  html += '<span>Descrição</span>';
  html += `<textarea id="tarefaDescricaoInput" style="width:100%;min-height:80px;font-size:13px;line-height:1.6" placeholder="Detalhes da tarefa...">${editing ? escapeHtml(editing.descricao || '') : ''}</textarea>`;
  html += '</div>';

  html += '<div style="display:flex;gap:var(--s-3)">';
  if (editing && editing.id) {
    html += `<button class="btn-primary" id="tarefaSalvarBtn" type="button">💾 Atualizar</button>`;
    html += `<button class="btn-small" id="tarefaCancelarBtn" type="button">Cancelar</button>`;
  } else {
    html += `<button class="btn-primary" id="tarefaSalvarBtn" type="button">💾 Salvar</button>`;
  }
  html += '</div></div>';

  // ── Filtros + Lista ──
  html += '<div class="card">';
  html += '<div class="card-header">';
  html += '<div><h3 style="font-size:15px;font-weight:600">📋 Minhas Tarefas</h3>';
  html += `<p style="font-size:13px;color:var(--text-secondary)">${saved.length} tarefa(s)</p></div>`;
  html += '<div style="display:flex;gap:var(--s-2);align-items:center">';
  html += `<select id="tarefaFiltroStatus" style="font-size:12px;padding:4px 8px;border:1px solid var(--border);border-radius:var(--r-sm);background:var(--bg-card);color:var(--text)">`;
  html += `<option value="todas"${filtroStatus === 'todas' ? ' selected' : ''}>Todas</option>`;
  html += `<option value="pendente"${filtroStatus === 'pendente' ? ' selected' : ''}>⏳ Pendentes</option>`;
  html += `<option value="concluida"${filtroStatus === 'concluida' ? ' selected' : ''}>✅ Concluídas</option>`;
  html += `<option value="cancelada"${filtroStatus === 'cancelada' ? ' selected' : ''}>❌ Canceladas</option>`;
  html += '</select>';
  html += '<button class="btn-small" id="tarefaRefreshBtn" type="button">🔄</button>';
  html += '</div></div>';

  const filtered = filtroStatus === 'todas' ? saved : saved.filter(t => t.status === filtroStatus);

  if (!filtered.length) {
    html += '<div class="empty-state" style="padding:var(--s-5)"><div class="empty-title">Nenhuma tarefa</div><div class="empty-sub">Crie sua primeira tarefa acima.</div></div>';
  } else {
    html += '<div style="display:flex;flex-direction:column;gap:var(--s-2)">';
    for (const t of filtered) {
      const concluida = t.status === 'concluida';
      html += `<div style="display:flex;align-items:center;gap:var(--s-3);padding:var(--s-3) var(--s-4);border:1px solid var(--border);border-radius:var(--r-md);${concluida ? 'opacity:.6' : ''}">`;
      html += `<button class="tarefa-toggle-btn" data-id="${t.id}" style="background:none;border:none;cursor:pointer;font-size:18px;padding:0" title="${concluida ? 'Reabrir' : 'Concluir'}">${concluida ? '✅' : '⬜'}</button>`;
      html += `<div style="flex:1;min-width:0">`;
      html += `<div style="display:flex;align-items:center;gap:var(--s-2)">`;
      html += `<strong style="font-size:14px;${concluida ? 'text-decoration:line-through' : ''}">${escapeHtml(t.titulo)}</strong>`;
      html += `<span style="font-size:11px;padding:1px 6px;border-radius:var(--r-sm);background:${t.prioridade === 'alta' ? 'var(--danger)' : t.prioridade === 'media' ? 'var(--warning)' : 'var(--success)'};color:#fff">${PRIORIDADE_LABEL[t.prioridade] || t.prioridade}</span>`;
      html += `</div>`;
      html += `<div style="font-size:12px;color:var(--text-secondary);margin-top:2px">📅 ${formatarData(t.data)} ${STATUS_LABEL[t.status] || t.status}</div>`;
      if (t.descricao) {
        const preview = t.descricao.slice(0, 80) + (t.descricao.length > 80 ? '…' : '');
        html += `<div style="font-size:12px;color:var(--text-secondary);margin-top:2px">${escapeHtml(preview)}</div>`;
      }
      html += '</div>';
      html += '<div style="display:flex;gap:var(--s-1)">';
      html += `<button class="btn-small tarefa-editar-btn" data-id="${t.id}" type="button">✏️</button>`;
      html += `<button class="btn-small btn-delete tarefa-excluir-btn" data-id="${t.id}" type="button">🗑️</button>`;
      html += '</div></div>';
    }
    html += '</div>';
  }
  html += '</div>';

  container.innerHTML = html;
  bindTarefaEvents(saved);
}

function bindTarefaEvents(saved) {
  const container = document.getElementById('tarefasContent');
  if (!container) return;

  // Auto-save rascunho
  const tituloInput = document.getElementById('tarefaTituloInput');
  const dataInput = document.getElementById('tarefaDataInput');
  const prioridadeInput = document.getElementById('tarefaPrioridadeInput');
  const descricaoInput = document.getElementById('tarefaDescricaoInput');
  if (tituloInput && dataInput && prioridadeInput && descricaoInput) {
    function autoSave() {
      const cur = JSON.parse(localStorage.getItem(TAREFAS_EDITING_KEY) || '{}');
      cur.titulo = tituloInput.value;
      cur.data = dataInput.value;
      cur.prioridade = prioridadeInput.value;
      cur.descricao = descricaoInput.value;
      localStorage.setItem(TAREFAS_EDITING_KEY, JSON.stringify(cur));
    }
    tituloInput.addEventListener('input', autoSave);
    dataInput.addEventListener('change', autoSave);
    prioridadeInput.addEventListener('change', autoSave);
    descricaoInput.addEventListener('input', autoSave);
  }

  // Salvar
  const salvarBtn = document.getElementById('tarefaSalvarBtn');
  if (salvarBtn) {
    salvarBtn.addEventListener('click', async () => {
      if (!requireAdmin()) return;
      const titulo = document.getElementById('tarefaTituloInput').value;
      const data = document.getElementById('tarefaDataInput').value;
      const prioridade = document.getElementById('tarefaPrioridadeInput').value;
      const descricao = document.getElementById('tarefaDescricaoInput').value;
      if (!titulo.trim() || !data) {
        showToast('Preencha o título e a data.', 'error', 'Tarefa');
        return;
      }
      const editingRaw = localStorage.getItem(TAREFAS_EDITING_KEY);
      const editing = editingRaw ? JSON.parse(editingRaw) : null;
      const tarefa = {
        id: editing?.id || Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6),
        titulo: titulo.trim(),
        descricao: descricao.trim(),
        data: data,
        prioridade: prioridade,
        status: editing?.status || 'pendente',
        createdAt: editing?.createdAt || new Date().toISOString()
      };
      await dbTarefasSave(tarefa);
      localStorage.removeItem(TAREFAS_EDITING_KEY);
      showToast('Tarefa salva!', 'success', 'Tarefas');
      renderTarefas();
    });
  }

  // Cancelar edição
  const cancelarBtn = document.getElementById('tarefaCancelarBtn');
  if (cancelarBtn) {
    cancelarBtn.addEventListener('click', () => {
      localStorage.removeItem(TAREFAS_EDITING_KEY);
      renderTarefas();
    });
  }

  // Filtro status
  const filtroSelect = document.getElementById('tarefaFiltroStatus');
  if (filtroSelect) {
    filtroSelect.addEventListener('change', () => {
      sessionStorage.setItem('tarefas_filtro_status', filtroSelect.value);
      renderTarefas();
    });
  }

  // Toggle concluir/reabrir
  container.querySelectorAll('.tarefa-toggle-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!requireAdmin()) return;
      const t = saved.find(x => x.id === btn.dataset.id);
      if (!t) return;
      const newStatus = t.status === 'concluida' ? 'pendente' : 'concluida';
      t.status = newStatus;
      await dbTarefasSave(t);
      renderTarefas();
    });
  });

  // Editar
  container.querySelectorAll('.tarefa-editar-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const t = saved.find(x => x.id === btn.dataset.id);
      if (!t) return;
      localStorage.setItem(TAREFAS_EDITING_KEY, JSON.stringify({ ...t }));
      renderTarefas();
    });
  });

  // Excluir
  container.querySelectorAll('.tarefa-excluir-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!requireAdmin()) return;
      const t = saved.find(x => x.id === btn.dataset.id);
      if (!t || !confirm(`Excluir tarefa "${t.titulo}"?`)) return;
      await dbTarefasDelete(t.id);
      renderTarefas();
    });
  });

  // Refresh
  const refreshBtn = document.getElementById('tarefaRefreshBtn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      if (typeof dbTarefasLoad === 'function') {
        dbTarefasLoad().then(() => renderTarefas());
      } else {
        renderTarefas();
      }
    });
  }
}

function onTarefasTabActivated() {
  const container = document.getElementById('tarefasContent');
  if (!container) return;
  container.innerHTML = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--s-4)"><div class="card" style="padding:var(--s-5)"><div class="skeleton skeleton-title"></div><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line short"></div></div><div class="card" style="padding:var(--s-5)"><div class="skeleton skeleton-title" style="width:30%"></div><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line short"></div></div></div>';
  setTimeout(() => renderTarefas(), 50);
}
