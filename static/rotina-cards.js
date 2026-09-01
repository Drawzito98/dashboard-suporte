// rotina-cards.js — visualizações em cards para tarefas e anotações

const ROTINA_STATUS = [
  { id: 'pendente', label: 'Pendente', icon: '⏳' },
  { id: 'andamento', label: 'Em andamento', icon: '▶️' },
  { id: 'concluida', label: 'Concluída', icon: '✅' },
  { id: 'cancelada', label: 'Cancelada', icon: '❌' }
];
let rotinaEditId = null;

function _rotinaSaved() {
  try { return JSON.parse(localStorage.getItem('sistema_tarefas_v1') || '[]'); } catch (_) { return []; }
}
function _rotinaPriority(t) {
  const labels = { alta: 'Alta', media: 'Média', baixa: 'Baixa' };
  return `<span class="rotina-prioridade prioridade-${t.prioridade || 'media'}">${labels[t.prioridade] || 'Média'}</span>`;
}
function _rotinaStatusOptions(status) {
  return ROTINA_STATUS.map(s => `<option value="${s.id}"${s.id === status ? ' selected' : ''}>${s.icon} ${s.label}</option>`).join('');
}
function _rotinaCard(t, compact) {
  const done = t.status === 'concluida';
  const overdue = !done && t.status !== 'cancelada' && t.data < hoje();
  return `<article class="rotina-card${done ? ' is-done' : ''}" data-tarefa-id="${t.id}" draggable="true">
    <div class="rotina-card-top">${_rotinaPriority(t)}<div><button class="regra-icon-btn tarefa-card-editar" data-id="${t.id}" title="Editar">✏️</button><button class="regra-icon-btn tarefa-card-excluir" data-id="${t.id}" title="Excluir">🗑️</button></div></div>
    <h4>${escapeHtml(t.titulo)}</h4>
    ${!compact && t.descricao ? `<p>${escapeHtml(t.descricao)}</p>` : ''}
    <div class="rotina-card-meta"><span class="${overdue ? 'is-overdue' : ''}">📅 ${formatarData(t.data)}${overdue ? ' · atrasada' : ''}</span>${t.rotinaAtiva ? '<span>🔁 Recorrente</span>' : ''}</div>
    <select class="tarefa-card-status" data-id="${t.id}" aria-label="Alterar status">${_rotinaStatusOptions(t.status)}</select>
  </article>`;
}

function renderTarefas() {
  const host = document.getElementById('tarefasContent');
  if (!host) return;
  const saved = _rotinaSaved();
  verificarLembretesRotina(saved);
  const view = localStorage.getItem('sistema_tarefas_view_v1') || 'kanban';
  const editing = saved.find(t => t.id === rotinaEditId);
  const formOpen = rotinaEditId !== null;
  host.innerHTML = `
    <section class="card rotina-overview"><div><span class="page-eyebrow">Organização pessoal</span><h2>Rotina</h2><p>Acompanhe o fluxo das tarefas ou consulte a agenda em lista.</p></div><div class="rotina-header-actions"><button class="btn-small" id="rotinaAnotacoesBtn">📝 Anotações</button><button class="btn-primary" id="tarefaNovaBtn">+ Nova tarefa</button></div></section>
    ${formOpen ? `<section class="card rotina-form-card"><div class="card-header"><div><h3>${editing ? 'Editar tarefa' : 'Nova tarefa'}</h3><p>Cadastre a atividade e defina prazo e prioridade.</p></div></div>
      <div class="grid-2col"><label class="field"><span>Título</span><input id="tarefaTituloInput" value="${escapeHtml(editing?.titulo || '')}" maxlength="120"></label><div class="grid-2col"><label class="field"><span>Data</span><input type="date" id="tarefaDataInput" value="${editing?.data || hoje()}"></label><label class="field"><span>Prioridade</span><select id="tarefaPrioridadeInput"><option value="baixa"${editing?.prioridade === 'baixa' ? ' selected' : ''}>🟢 Baixa</option><option value="media"${!editing || editing.prioridade === 'media' ? ' selected' : ''}>🟡 Média</option><option value="alta"${editing?.prioridade === 'alta' ? ' selected' : ''}>🔴 Alta</option></select></label></div></div>
      <label class="field"><span>Descrição</span><textarea id="tarefaDescricaoInput" rows="4">${escapeHtml(editing?.descricao || '')}</textarea></label>
      <div class="rotina-repeat"><label><input type="checkbox" id="tarefaRotinaAtiva"${editing?.rotinaAtiva ? ' checked' : ''}> Repetir verificação</label><label>a cada <input type="number" min="1" id="tarefaRotinaIntervalo" value="${editing?.rotinaIntervalo || 15}"> <select id="tarefaRotinaUnidade"><option value="dias">dias</option><option value="semanas"${editing?.rotinaUnidade === 'semanas' ? ' selected' : ''}>semanas</option><option value="meses"${editing?.rotinaUnidade === 'meses' ? ' selected' : ''}>meses</option></select></label><label>avisar <select id="tarefaRotinaLembrete"><option value="0">no dia</option><option value="1"${editing?.rotinaLembreteDias === 1 ? ' selected' : ''}>1 dia antes</option><option value="3"${editing?.rotinaLembreteDias === 3 ? ' selected' : ''}>3 dias antes</option><option value="7"${editing?.rotinaLembreteDias === 7 ? ' selected' : ''}>7 dias antes</option></select></label></div>
      <div class="regra-form-actions"><button class="btn-primary" id="tarefaSalvarBtn">Salvar tarefa</button><button class="btn-small" id="tarefaCancelarBtn">Cancelar</button></div>
    </section>` : ''}
    <section class="card rotina-board-card"><div class="card-header"><div><h3>Minhas tarefas</h3><p>${saved.length} tarefa(s)</p></div><div class="view-switch"><button class="btn-small${view === 'kanban' ? ' active' : ''}" data-task-view="kanban">▦ Kanban</button><button class="btn-small${view === 'lista' ? ' active' : ''}" data-task-view="lista">☷ Lista</button><button class="btn-small" id="tarefaRefreshBtn" title="Atualizar">🔄</button></div></div>
      ${view === 'kanban' ? `<div class="rotina-kanban">${ROTINA_STATUS.map(s => { const cards = saved.filter(t => (t.status || 'pendente') === s.id); return `<section class="rotina-column"><header><h3>${s.icon} ${s.label}</h3><span>${cards.length}</span></header><div class="rotina-dropzone" data-task-status="${s.id}">${cards.length ? cards.map(t => _rotinaCard(t, false)).join('') : '<div class="regra-empty">Nenhuma tarefa</div>'}</div></section>`; }).join('')}</div>` : `<div class="rotina-lista">${saved.length ? saved.slice().sort((a,b) => String(a.data).localeCompare(String(b.data))).map(t => _rotinaCard(t, true)).join('') : '<div class="empty-state"><div class="empty-title">Nenhuma tarefa</div></div>'}</div>`}
    </section>`;
  _bindRotinaCards(saved);
  updateTarefasBadge();
}

function _setTarefaStatus(t, status) {
  if (status === 'concluida' && t.rotinaAtiva) {
    t.rotinaUltimaConclusao = hoje(); t.data = t.rotinaProximaData || t.data;
    t.rotinaProximaData = proximaRotina(t.data, t.rotinaIntervalo || 1, t.rotinaUnidade || 'dias'); t.status = 'pendente';
    showToast('Verificação concluída. Próxima: ' + formatarData(t.rotinaProximaData), 'success', 'Rotina');
  } else t.status = status;
  return dbTarefasSave(t);
}
function _bindRotinaCards(saved) {
  document.getElementById('rotinaAnotacoesBtn')?.addEventListener('click', openAnotacoesOverlay);
  document.getElementById('tarefaNovaBtn')?.addEventListener('click', () => { rotinaEditId = ''; renderTarefas(); document.getElementById('tarefaTituloInput')?.focus(); });
  document.getElementById('tarefaCancelarBtn')?.addEventListener('click', () => { rotinaEditId = null; renderTarefas(); });
  document.querySelectorAll('[data-task-view]').forEach(b => b.addEventListener('click', () => { localStorage.setItem('sistema_tarefas_view_v1', b.dataset.taskView); renderTarefas(); }));
  document.getElementById('tarefaSalvarBtn')?.addEventListener('click', async () => {
    if (!requireAdmin()) return;
    const titulo = document.getElementById('tarefaTituloInput').value.trim(), data = document.getElementById('tarefaDataInput').value;
    if (!titulo || !data) { showToast('Preencha título e data.', 'error', 'Tarefa'); return; }
    const old = saved.find(t => t.id === rotinaEditId);
    const repeat = document.getElementById('tarefaRotinaAtiva').checked;
    const t = { ...(old || {}), id: old?.id || crypto.randomUUID(), titulo, data, descricao: document.getElementById('tarefaDescricaoInput').value.trim(), prioridade: document.getElementById('tarefaPrioridadeInput').value, status: old?.status || 'pendente', rotinaAtiva: repeat, rotinaIntervalo: Math.max(1, Number(document.getElementById('tarefaRotinaIntervalo').value || 15)), rotinaUnidade: document.getElementById('tarefaRotinaUnidade').value, rotinaLembreteDias: Number(document.getElementById('tarefaRotinaLembrete').value || 0), rotinaProximaData: repeat ? (old?.rotinaProximaData || data) : '', createdAt: old?.createdAt || new Date().toISOString() };
    await dbTarefasSave(t); rotinaEditId = null; renderTarefas(); showToast('Tarefa salva!', 'success', 'Tarefas');
  });
  document.querySelectorAll('.tarefa-card-editar').forEach(b => b.addEventListener('click', () => { rotinaEditId = b.dataset.id; renderTarefas(); document.getElementById('tarefaTituloInput')?.focus(); }));
  document.querySelectorAll('.tarefa-card-excluir').forEach(b => b.addEventListener('click', async () => { const t = saved.find(x => x.id === b.dataset.id); if (!requireAdmin() || !t || !confirm(`Excluir tarefa “${t.titulo}”?`)) return; await dbTarefasDelete(t.id); renderTarefas(); }));
  document.querySelectorAll('.tarefa-card-status').forEach(s => s.addEventListener('change', async () => { const t = saved.find(x => x.id === s.dataset.id); if (!requireAdmin() || !t) return; await _setTarefaStatus(t, s.value); renderTarefas(); }));
  document.querySelectorAll('.rotina-card').forEach(c => c.addEventListener('dragstart', e => e.dataTransfer.setData('text/plain', c.dataset.tarefaId)));
  document.querySelectorAll('.rotina-dropzone').forEach(z => { z.addEventListener('dragover', e => { e.preventDefault(); z.classList.add('drag-over'); }); z.addEventListener('dragleave', () => z.classList.remove('drag-over')); z.addEventListener('drop', async e => { e.preventDefault(); z.classList.remove('drag-over'); const t = saved.find(x => x.id === e.dataTransfer.getData('text/plain')); if (!requireAdmin() || !t || t.status === z.dataset.taskStatus) return; await _setTarefaStatus(t, z.dataset.taskStatus); renderTarefas(); }); });
  document.getElementById('tarefaRefreshBtn')?.addEventListener('click', () => dbTarefasLoad().then(renderTarefas));
}
function onTarefasTabActivated() { rotinaEditId = null; renderTarefas(); dbTarefasLoad().then(renderTarefas).catch(() => {}); }

// ── Anotações em cards pesquisáveis ──
function _notasSaved() { try { return JSON.parse(localStorage.getItem('sistema_anotacoes_diarias_v1') || '[]'); } catch (_) { return []; } }
function _notaTags(value) { return String(value || '').split(',').map(v => v.trim()).filter(Boolean).slice(0, 6); }
function renderAnotacoes() {
  const host = document.getElementById('anotacoesOverlayContent'); if (!host) return;
  const saved = _notasSaved(), draftRaw = localStorage.getItem(ANOTACOES_EDITING_KEY), editing = draftRaw ? JSON.parse(draftRaw) : null;
  const query = sessionStorage.getItem('anotacoes_busca') || '', onlyFav = sessionStorage.getItem('anotacoes_favoritas') === '1';
  const visible = saved.filter(n => (!onlyFav || n.favorito) && (!query || `${n.conteudo} ${n.etiquetas || ''} ${n.data}`.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR')))).sort((a,b) => Number(Boolean(b.favorito)) - Number(Boolean(a.favorito)) || String(b.data).localeCompare(String(a.data)));
  host.innerHTML = `<section class="card nota-form-card"><div class="card-header"><div><h3>${editing?.id ? 'Editar anotação' : 'Nova anotação'}</h3><p>Registre uma observação e use etiquetas para encontrá-la depois.</p></div></div><div class="grid-2col"><label class="field"><span>Data</span><input type="date" id="anotacaoDataInput" value="${editing?.data || hoje()}"></label><label class="field"><span>Etiquetas</span><input id="anotacaoTagsInput" value="${escapeHtml(editing?.etiquetas || '')}" placeholder="Ex: reunião, processo, ideia"></label></div><label class="field"><span>Anotação</span><textarea id="anotacaoTextoInput" rows="6" placeholder="Escreva sua anotação...">${escapeHtml(editing?.conteudo || '')}</textarea></label><div class="regra-form-actions"><button class="btn-primary" id="anotacaoSalvarBtn">${editing?.id ? 'Atualizar' : 'Salvar'} anotação</button>${editing?.id ? '<button class="btn-small" id="anotacaoCancelarBtn">Cancelar</button>' : ''}</div></section>
    <section class="card notas-library"><div class="card-header"><div><h3>Anotações</h3><p>${visible.length} de ${saved.length} anotação(ões)</p></div><button class="btn-small" id="anotacaoRefreshBtn">🔄</button></div><div class="notas-toolbar"><input id="anotacaoBusca" type="search" value="${escapeHtml(query)}" placeholder="Buscar nas anotações e etiquetas..."><button class="btn-small${onlyFav ? ' active' : ''}" id="anotacaoFavFilter">⭐ Favoritas</button></div>
    <div class="notas-grid">${visible.length ? visible.map(n => `<article class="nota-card${n.favorito ? ' is-favorite' : ''}" data-nota-id="${n.id}"><div class="nota-card-top"><strong>📅 ${formatarData(n.data)}</strong><button class="nota-fav-btn" data-id="${n.id}" title="${n.favorito ? 'Remover dos favoritos' : 'Favoritar'}">${n.favorito ? '★' : '☆'}</button></div><p>${escapeHtml(n.conteudo)}</p><div class="nota-tags">${_notaTags(n.etiquetas).map(t => `<span>${escapeHtml(t)}</span>`).join('')}</div><footer><button class="btn-small anotacao-ver-btn" data-id="${n.id}">Ver</button><button class="btn-small anotacao-editar-btn" data-id="${n.id}">✏️</button><button class="btn-small btn-delete anotacao-excluir-btn" data-id="${n.id}">🗑️</button></footer></article>`).join('') : '<div class="regra-empty">Nenhuma anotação encontrada</div>'}</div></section>`;
  _bindNotasCards(saved);
}
function _bindNotasCards(saved) {
  const host = document.getElementById('anotacoesOverlayContent');
  document.getElementById('anotacaoBusca')?.addEventListener('input', e => { sessionStorage.setItem('anotacoes_busca', e.target.value); renderAnotacoes(); document.getElementById('anotacaoBusca')?.focus(); });
  document.getElementById('anotacaoFavFilter')?.addEventListener('click', () => { sessionStorage.setItem('anotacoes_favoritas', sessionStorage.getItem('anotacoes_favoritas') === '1' ? '0' : '1'); renderAnotacoes(); });
  document.getElementById('anotacaoSalvarBtn')?.addEventListener('click', async () => { const data = document.getElementById('anotacaoDataInput').value, conteudo = document.getElementById('anotacaoTextoInput').value.trim(); if (!data || !conteudo) { showToast('Preencha a data e o conteúdo.', 'error', 'Anotação'); return; } const old = saved.find(n => n.id === JSON.parse(localStorage.getItem(ANOTACOES_EDITING_KEY) || '{}').id); await dbAnotacoesSave({ ...(old || {}), id: old?.id || crypto.randomUUID(), data, conteudo, etiquetas: document.getElementById('anotacaoTagsInput').value.trim(), favorito: Boolean(old?.favorito), createdAt: old?.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() }); localStorage.removeItem(ANOTACOES_EDITING_KEY); renderAnotacoes(); showToast('Anotação salva!', 'success', 'Anotações'); });
  document.getElementById('anotacaoCancelarBtn')?.addEventListener('click', () => { localStorage.removeItem(ANOTACOES_EDITING_KEY); renderAnotacoes(); });
  host.querySelectorAll('.nota-fav-btn').forEach(b => b.addEventListener('click', async () => { const n = saved.find(x => x.id === b.dataset.id); if (!n) return; n.favorito = !n.favorito; n.updatedAt = new Date().toISOString(); await dbAnotacoesSave(n); renderAnotacoes(); }));
  host.querySelectorAll('.anotacao-editar-btn').forEach(b => b.addEventListener('click', () => { const n = saved.find(x => x.id === b.dataset.id); if (!n) return; localStorage.setItem(ANOTACOES_EDITING_KEY, JSON.stringify(n)); renderAnotacoes(); document.getElementById('anotacaoTextoInput')?.focus(); }));
  host.querySelectorAll('.anotacao-excluir-btn').forEach(b => b.addEventListener('click', async () => { const n = saved.find(x => x.id === b.dataset.id); if (!n || !confirm(`Excluir anotação de ${formatarData(n.data)}?`)) return; await dbAnotacoesDelete(n.id); renderAnotacoes(); }));
  host.querySelectorAll('.anotacao-ver-btn').forEach(b => b.addEventListener('click', () => { const n = saved.find(x => x.id === b.dataset.id); if (!n) return; const overlay = document.getElementById('anotacaoViewOverlay') || criarAnotacaoOverlay(), content = document.getElementById('anotacaoViewContent'); content.innerHTML = `<div class="nota-view"><div class="card-header"><h2>📅 ${formatarData(n.data)}</h2><button class="btn-small" id="anotacaoViewCloseBtn">✕ Fechar</button></div><div class="nota-tags">${_notaTags(n.etiquetas).map(t => `<span>${escapeHtml(t)}</span>`).join('')}</div><pre>${escapeHtml(n.conteudo)}</pre></div>`; overlay.classList.add('open'); document.getElementById('anotacaoViewCloseBtn').onclick = () => overlay.classList.remove('open'); }));
  document.getElementById('anotacaoRefreshBtn')?.addEventListener('click', () => dbAnotacoesLoad().then(renderAnotacoes));
}
