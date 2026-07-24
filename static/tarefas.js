// tarefas.js — Agenda / Tarefas

let inlineEditingId = null;

function hoje() {
  return new Date().toISOString().slice(0, 10);
}

function updateTarefasBadge() {
  const badge = document.getElementById('tarefasBadge');
  if (!badge) return;
  try {
    const saved = JSON.parse(localStorage.getItem('sistema_tarefas_v1') || '[]');
    const today = hoje();
    const count = saved.filter(t => t.data === today && t.status !== 'concluida' && t.status !== 'cancelada').length;
    if (count > 0) {
      badge.textContent = count;
      badge.classList.add('visible');
    } else {
      badge.textContent = '';
      badge.classList.remove('visible');
    }
  } catch (e) {
    badge.textContent = '';
    badge.classList.remove('visible');
  }
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
  const filtroStatus = sessionStorage.getItem('tarefas_filtro_status') || 'todas';

  let html = '';

  // ── Formulário (sempre nova tarefa) ──
  html += '<div class="card" style="margin-bottom:var(--s-5)">';
  html += '<div style="margin-bottom:var(--s-4)">';
  html += '<h3 style="font-size:15px;font-weight:600;margin-bottom:4px">📅 Nova Tarefa</h3>';
  html += '<p style="font-size:13px;color:var(--text-secondary)">Cadastre atividades e compromissos.</p>';
  html += '</div>';

  html += '<div class="grid-2col" style="margin-bottom:var(--s-3)">';
  html += '<div class="field"><span>Título</span>';
  html += '<input type="text" id="tarefaTituloInput" placeholder="Ex: Reunião de alinhamento" value="">';
  html += '</div>';
  html += '<div class="grid-2col">';
  html += '<div class="field"><span>Data</span>';
  html += `<input type="date" id="tarefaDataInput" value="${hoje()}">`;
  html += '</div>';
  html += '<div class="field"><span>Prioridade</span>';
  html += `<select id="tarefaPrioridadeInput">`;
  for (const [val, label] of Object.entries(PRIORIDADE_LABEL)) {
    html += `<option value="${val}"${val === 'media' ? ' selected' : ''}>${label}</option>`;
  }
  html += '</select></div></div></div>';

  html += '<div class="field" style="margin-bottom:var(--s-3)">';
  html += '<span>Descrição</span>';
  html += '<textarea id="tarefaDescricaoInput" style="width:100%;min-height:80px;font-size:13px;line-height:1.6" placeholder="Detalhes da tarefa..."></textarea>';
  html += '</div>';

  html += '<div style="display:flex;gap:var(--s-3)">';
  html += '<button class="btn-primary" id="tarefaSalvarBtn" type="button">💾 Salvar</button>';
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
      html += `<div style="display:flex;align-items:center;gap:var(--s-3);padding:var(--s-3) var(--s-4);border:1px solid var(--border);border-radius:var(--r-md);${concluida ? 'opacity:.6' : ''}" data-tarefa-id="${t.id}">`;
      if (inlineEditingId === t.id) {
        html += '<div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:var(--s-2)">';
        html += `<input type="text" id="inlineEditTitulo" value="${escapeHtml(t.titulo)}" style="font-size:14px;font-weight:600;padding:4px 8px;border:1px solid var(--border);border-radius:var(--r-sm);background:var(--bg-card);color:var(--text)">`;
        html += `<textarea id="inlineEditDescricao" style="font-size:13px;padding:4px 8px;border:1px solid var(--border);border-radius:var(--r-sm);background:var(--bg-card);color:var(--text);min-height:50px">${escapeHtml(t.descricao || '')}</textarea>`;
        html += '<div style="display:flex;gap:var(--s-2)">';
        html += `<input type="date" id="inlineEditData" value="${t.data}" style="font-size:12px;padding:4px 8px;border:1px solid var(--border);border-radius:var(--r-sm);background:var(--bg-card);color:var(--text)">`;
        html += `<select id="inlineEditPrioridade" style="font-size:12px;padding:4px 8px;border:1px solid var(--border);border-radius:var(--r-sm);background:var(--bg-card);color:var(--text)">`;
        for (const [val, label] of Object.entries(PRIORIDADE_LABEL)) {
          html += `<option value="${val}"${val === t.prioridade ? ' selected' : ''}>${label}</option>`;
        }
        html += '</select>';
        html += '</div>';
        html += '<div style="display:flex;gap:var(--s-2)">';
        html += `<button class="btn-small tarefa-inline-salvar" data-id="${t.id}" type="button" style="background:var(--success);color:var(--text-on-success);border:none">💾 Salvar</button>`;
        html += `<button class="btn-small tarefa-inline-cancelar" type="button">Cancelar</button>`;
        html += '</div></div>';
      } else {
      html += `<select class="tarefa-status-select" data-id="${t.id}" style="font-size:11px;padding:2px 4px;border:1px solid var(--border);border-radius:var(--r-sm);background:var(--bg-card);color:var(--text);cursor:pointer">`;
      for (const [val, label] of Object.entries(STATUS_LABEL)) {
        html += `<option value="${val}"${val === t.status ? ' selected' : ''}>${label}</option>`;
      }
      html += '</select>';
      html += `<div style="flex:1;min-width:0">`;
      html += `<div style="display:flex;align-items:center;gap:var(--s-2)">`;
      html += `<strong style="font-size:14px;${concluida ? 'text-decoration:line-through' : ''}">${escapeHtml(t.titulo)}</strong>`;
      const priorBg = t.prioridade === 'alta' ? 'var(--danger)' : t.prioridade === 'media' ? 'var(--warning)' : 'var(--success)';
const priorColor = t.prioridade === 'alta' ? 'var(--text-on-danger)' : t.prioridade === 'media' ? 'var(--text-on-warning)' : 'var(--text-on-success)';
html += `<span style="font-size:11px;padding:1px 6px;border-radius:var(--r-sm);background:${priorBg};color:${priorColor}">${PRIORIDADE_LABEL[t.prioridade] || t.prioridade}</span>`;
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
      html += '</div>';
    }
    html += '</div>';
  }
  html += '</div>';
  }

  container.innerHTML = html;
  bindTarefaEvents(saved);
  updateTarefasBadge();
}

function bindTarefaEvents(saved) {
  const container = document.getElementById('tarefasContent');
  if (!container) return;

  // Salvar nova tarefa
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
      const tarefa = {
        id: Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6),
        titulo: titulo.trim(),
        descricao: descricao.trim(),
        data: data,
        prioridade: prioridade,
        status: 'pendente',
        createdAt: new Date().toISOString()
      };
      await dbTarefasSave(tarefa);
      // Limpa formulário
      document.getElementById('tarefaTituloInput').value = '';
      document.getElementById('tarefaDescricaoInput').value = '';
      document.getElementById('tarefaDataInput').value = hoje();
      document.getElementById('tarefaPrioridadeInput').value = 'media';
      showToast('Tarefa salva!', 'success', 'Tarefas');
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

  // Status selector
  container.querySelectorAll('.tarefa-status-select').forEach(sel => {
    sel.addEventListener('change', async () => {
      if (!requireAdmin()) return;
      const t = saved.find(x => x.id === sel.dataset.id);
      if (!t) return;
      t.status = sel.value;
      await dbTarefasSave(t);
      renderTarefas();
    });
  });

  // Editar (inline)
  container.querySelectorAll('.tarefa-editar-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const t = saved.find(x => x.id === btn.dataset.id);
      if (!t) return;
      inlineEditingId = t.id;
      renderTarefas();
    });
  });

  // Inline salvar
  container.querySelectorAll('.tarefa-inline-salvar').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!requireAdmin()) return;
      const t = saved.find(x => x.id === btn.dataset.id);
      if (!t) return;
      const titulo = document.getElementById('inlineEditTitulo').value.trim();
      const descricao = document.getElementById('inlineEditDescricao').value.trim();
      const data = document.getElementById('inlineEditData').value;
      const prioridade = document.getElementById('inlineEditPrioridade').value;
      if (!titulo || !data) { showToast('Preencha título e data.', 'error', 'Tarefa'); return; }
      t.titulo = titulo;
      t.descricao = descricao;
      t.data = data;
      t.prioridade = prioridade;
      await dbTarefasSave(t);
      inlineEditingId = null;
      showToast('Tarefa atualizada!', 'success', 'Tarefas');
      renderTarefas();
    });
  });

  // Inline cancelar
  container.querySelectorAll('.tarefa-inline-cancelar').forEach(btn => {
    btn.addEventListener('click', () => {
      inlineEditingId = null;
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
  // Limpa qualquer resquício do antigo sistema de edição
  localStorage.removeItem('sistema_tarefa_editando_v1');
  inlineEditingId = null;
  container.innerHTML = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--s-4)"><div class="card" style="padding:var(--s-5)"><div class="skeleton skeleton-title"></div><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line short"></div></div><div class="card" style="padding:var(--s-5)"><div class="skeleton skeleton-title" style="width:30%"></div><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line short"></div></div></div>';
  setTimeout(() => renderTarefas(), 50);
}
