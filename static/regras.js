// regras.js — quadro Kanban de regras atuais

const REGRAS_STORAGE_KEY = 'sistema_regras_v1';
const REGRAS_COLUNAS = [
  { id: 'vigente', titulo: 'Vigentes', ajuda: 'Regras em uso atualmente' },
  { id: 'revisao', titulo: 'Em revisão', ajuda: 'Regras sendo avaliadas' },
  { id: 'arquivada', titulo: 'Arquivadas', ajuda: 'Histórico fora de uso' }
];
let regraEditandoId = null;

function _regrasLista() {
  try { return JSON.parse(localStorage.getItem(REGRAS_STORAGE_KEY) || '[]'); }
  catch (_) { return []; }
}

function _regraData(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('pt-BR');
}

function renderRegras() {
  const host = document.getElementById('regrasContent');
  if (!host) return;
  const regras = _regrasLista().sort((a, b) => (a.posicao || 0) - (b.posicao || 0));
  const editando = regras.find(r => r.id === regraEditandoId);
  const isAdmin = document.body.dataset.role === 'admin';

  host.innerHTML = `
    <section class="card regras-header">
      <div><span class="page-eyebrow">Base de conhecimento</span><h2>Regras atuais</h2><p>Registre normas, orientações e decisões da operação em um quadro visual.</p></div>
      ${isAdmin ? '<button class="btn-primary" id="regraNovaBtn" type="button">+ Nova regra</button>' : ''}
    </section>
    ${isAdmin && regraEditandoId !== null ? `<section class="card regra-form-card">
      <div class="card-header"><div><h3>${editando ? 'Editar regra' : 'Nova regra'}</h3><p>Use um título curto e detalhe a orientação no texto.</p></div></div>
      <div class="grid-2col">
        <label class="field"><span>Título</span><input id="regraTitulo" maxlength="120" value="${escapeHtml(editando?.titulo || '')}" placeholder="Ex: Transferência de atendimentos"></label>
        <label class="field"><span>Categoria</span><input id="regraCategoria" maxlength="40" value="${escapeHtml(editando?.categoria || 'Geral')}" placeholder="Ex: Atendimento"></label>
      </div>
      <label class="field"><span>Descrição</span><textarea id="regraDescricao" rows="5" maxlength="2000" placeholder="Descreva a regra de forma objetiva...">${escapeHtml(editando?.descricao || '')}</textarea></label>
      <label class="field regra-status-field"><span>Coluna</span><select id="regraStatus">${REGRAS_COLUNAS.map(c => `<option value="${c.id}"${(editando?.status || 'vigente') === c.id ? ' selected' : ''}>${c.titulo}</option>`).join('')}</select></label>
      <div class="regra-form-actions"><button class="btn-primary" id="regraSalvarBtn" type="button">Salvar regra</button><button class="btn-small" id="regraCancelarBtn" type="button">Cancelar</button></div>
    </section>` : ''}
    <div class="regras-board" aria-label="Quadro de regras">
      ${REGRAS_COLUNAS.map(coluna => {
        const cards = regras.filter(r => r.status === coluna.id);
        return `<section class="regras-column" data-status="${coluna.id}">
          <header><div><h3>${coluna.titulo}</h3><p>${coluna.ajuda}</p></div><span>${cards.length}</span></header>
          <div class="regras-cards" data-drop-status="${coluna.id}">${cards.length ? cards.map(r => `<article class="regra-card" draggable="${isAdmin}" data-regra-id="${r.id}">
            <div class="regra-card-top"><span class="regra-tag">${escapeHtml(r.categoria || 'Geral')}</span>${isAdmin ? `<div><button class="regra-icon-btn regra-editar" data-id="${r.id}" title="Editar" type="button">✏️</button><button class="regra-icon-btn regra-excluir" data-id="${r.id}" title="Excluir" type="button">🗑️</button></div>` : ''}</div>
            <h4>${escapeHtml(r.titulo)}</h4>
            ${r.descricao ? `<p>${escapeHtml(r.descricao)}</p>` : ''}
            <footer><span>Atualizada em ${_regraData(r.updatedAt || r.createdAt)}</span>${isAdmin ? `<select class="regra-mover" data-id="${r.id}" aria-label="Mover ${escapeHtml(r.titulo)}">${REGRAS_COLUNAS.map(c => `<option value="${c.id}"${r.status === c.id ? ' selected' : ''}>${c.titulo}</option>`).join('')}</select>` : ''}</footer>
          </article>`).join('') : '<div class="regra-empty">Nenhuma regra nesta coluna</div>'}</div>
        </section>`;
      }).join('')}
    </div>`;
  _bindRegras(regras);
}

function _bindRegras(regras) {
  document.getElementById('regraNovaBtn')?.addEventListener('click', () => { regraEditandoId = ''; renderRegras(); document.getElementById('regraTitulo')?.focus(); });
  document.getElementById('regraCancelarBtn')?.addEventListener('click', () => { regraEditandoId = null; renderRegras(); });
  document.getElementById('regraSalvarBtn')?.addEventListener('click', async () => {
    if (!requireAdmin()) return;
    const titulo = document.getElementById('regraTitulo')?.value.trim();
    if (!titulo) { showToast('Informe o título da regra.', 'error', 'Regras'); return; }
    const atual = regras.find(r => r.id === regraEditandoId);
    const regra = {
      id: atual?.id || crypto.randomUUID(), titulo,
      descricao: document.getElementById('regraDescricao')?.value.trim() || '',
      categoria: document.getElementById('regraCategoria')?.value.trim() || 'Geral',
      status: document.getElementById('regraStatus')?.value || 'vigente',
      posicao: atual?.posicao ?? Date.now(), createdAt: atual?.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString()
    };
    await dbRegrasSave(regra); regraEditandoId = null; renderRegras(); showToast('Regra salva!', 'success', 'Regras');
  });
  document.querySelectorAll('.regra-editar').forEach(btn => btn.addEventListener('click', () => { regraEditandoId = btn.dataset.id; renderRegras(); document.getElementById('regraTitulo')?.focus(); }));
  document.querySelectorAll('.regra-excluir').forEach(btn => btn.addEventListener('click', async () => {
    if (!requireAdmin()) return;
    const regra = regras.find(r => r.id === btn.dataset.id);
    if (!regra || !confirm(`Excluir a regra “${regra.titulo}”?`)) return;
    await dbRegrasDelete(regra.id); renderRegras(); showToast('Regra excluída.', 'success', 'Regras');
  }));
  document.querySelectorAll('.regra-mover').forEach(select => select.addEventListener('change', async () => {
    if (!requireAdmin()) return;
    const regra = regras.find(r => r.id === select.dataset.id);
    if (!regra) return;
    regra.status = select.value; regra.posicao = Date.now(); regra.updatedAt = new Date().toISOString();
    await dbRegrasSave(regra); renderRegras();
  }));
  document.querySelectorAll('.regra-card[draggable="true"]').forEach(card => card.addEventListener('dragstart', event => { event.dataTransfer.setData('text/plain', card.dataset.regraId); card.classList.add('dragging'); }));
  document.querySelectorAll('.regras-cards').forEach(column => {
    column.addEventListener('dragover', event => { event.preventDefault(); column.classList.add('drag-over'); });
    column.addEventListener('dragleave', () => column.classList.remove('drag-over'));
    column.addEventListener('drop', async event => {
      event.preventDefault(); column.classList.remove('drag-over');
      const regra = regras.find(r => r.id === event.dataTransfer.getData('text/plain'));
      if (!regra || regra.status === column.dataset.dropStatus) return;
      regra.status = column.dataset.dropStatus; regra.posicao = Date.now(); regra.updatedAt = new Date().toISOString();
      await dbRegrasSave(regra); renderRegras();
    });
  });
}

function onRegrasTabActivated() {
  regraEditandoId = null;
  renderRegras();
  if (typeof dbRegrasLoad === 'function') dbRegrasLoad().then(renderRegras).catch(() => {});
}
