// links-importantes.js — Links salvos pelo usuário (CRUD Supabase)

const LINKS_STORAGE_KEY = 'sistema_links_importantes';

// ── Cache local como fallback rápido ──
let _linksCache = null;

function _linksFromStorage() {
  try { return JSON.parse(localStorage.getItem(LINKS_STORAGE_KEY)) || []; } catch { return []; }
}
function _linksToStorage(links) {
  try { localStorage.setItem(LINKS_STORAGE_KEY, JSON.stringify(links)); } catch {}
}

// ── CRUD Supabase ──

async function dbLinksListar() {
  if (!sbClient) return _linksFromStorage();
  try {
    const uid = (await sbClient.auth.getUser())?.data?.user?.id;
    if (!uid) return _linksFromStorage();
    const { data, error } = await sbClient
      .from('links_importantes')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) throw error;
    _linksCache = data || [];
    _linksToStorage(_linksCache);
    return _linksCache;
  } catch (e) {
    console.error('[links] Erro ao listar:', e);
    return _linksFromStorage();
  }
}

async function dbLinksInserir({ nome, url }) {
  if (!sbClient) return null;
  try {
    const uid = (await sbClient.auth.getUser())?.data?.user?.id;
    if (!uid) return null;
    const { data, error } = await sbClient
      .from('links_importantes')
      .insert({ nome, url, user_id: uid })
      .select();
    if (error) throw error;
    if (data?.[0]) {
      _linksCache = null;
      _linksToStorage([]);
    }
    return data?.[0] || null;
  } catch (e) {
    console.error('[links] Erro ao inserir:', e);
    return null;
  }
}

async function dbLinksAtualizar(id, { nome, url }) {
  if (!sbClient) return false;
  try {
    const { error } = await sbClient
      .from('links_importantes')
      .update({ nome, url, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
    _linksCache = null;
    _linksToStorage([]);
    return true;
  } catch (e) {
    console.error('[links] Erro ao atualizar:', e);
    return false;
  }
}

async function dbLinksDeletar(id) {
  if (!sbClient) return false;
  try {
    const { error } = await sbClient
      .from('links_importantes')
      .delete()
      .eq('id', id);
    if (error) throw error;
    _linksCache = null;
    _linksToStorage([]);
    return true;
  } catch (e) {
    console.error('[links] Erro ao deletar:', e);
    return false;
  }
}

// ── Render ──

let _editingId = null;

function renderLinksImportantes() {
  const container = document.getElementById('linksContent');
  if (!container) return;
  container.innerHTML = '<div style="padding:var(--s-5);text-align:center;color:var(--text-muted)">Carregando...</div>';

  dbLinksListar().then(links => {
    let html = '<div class="links-container">';

    // Formulário
    html += '<div class="links-form">';
    html += `<h3 style="font-size:14px;font-weight:600;margin:0 0 var(--s-3);color:var(--text-strong)">${_editingId ? 'Editar link' : 'Novo link'}</h3>`;
    html += '<div class="links-field">';
    html += '<label>Nome de exibição</label>';
    html += `<input type="text" id="linkNomeInput" placeholder="Ex: Dashboard Financeiro" value="${escapeHtml(_editingId ? (links.find(l => l.id === _editingId)?.nome || '') : '')}" style="width:100%"/>`;
    html += '</div>';
    html += '<div class="links-field">';
    html += '<label>URL</label>';
    html += `<input type="url" id="linkUrlInput" placeholder="https://..." value="${escapeHtml(_editingId ? (links.find(l => l.id === _editingId)?.url || '') : '')}" style="width:100%"/>`;
    html += '</div>';
    html += '<div class="links-actions">';
    html += `<button class="btn-primary" id="linkSalvarBtn" type="button" style="justify-content:center">${_editingId ? 'Salvar' : 'Adicionar'}</button>`;
    if (_editingId) {
      html += `<button class="btn-small" id="linkCancelarBtn" type="button">Cancelar</button>`;
    }
    html += '</div>';
    html += '</div>';

    // Lista
    if (links.length === 0) {
      html += '<div class="links-empty">Nenhum link salvo ainda. Adicione um acima.</div>';
    } else {
      html += '<div class="links-list">';
      for (const link of links) {
        html += '<div class="links-item">';
        html += '<div class="links-item-info">';
        html += `<a href="${escapeHtml(link.url)}" target="_blank" rel="noopener" class="links-item-name">${escapeHtml(link.nome)}</a>`;
        html += `<span class="links-item-url">${escapeHtml(link.url)}</span>`;
        html += '</div>';
        html += '<div class="links-item-actions">';
        html += `<button class="btn-small links-edit-btn" data-id="${link.id}" type="button" title="Editar">✏️</button>`;
        html += `<button class="btn-small links-del-btn" data-id="${link.id}" type="button" title="Excluir" style="color:var(--danger)">🗑️</button>`;
        html += '</div>';
        html += '</div>';
      }
      html += '</div>';
    }

    html += '</div>';
    container.innerHTML = html;

    // Bindings
    document.getElementById('linkSalvarBtn')?.addEventListener('click', () => handleSalvar(links));
    document.getElementById('linkCancelarBtn')?.addEventListener('click', () => { _editingId = null; renderLinksImportantes(); });

    container.querySelectorAll('.links-edit-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        _editingId = Number(btn.dataset.id);
        renderLinksImportantes();
      });
    });

    container.querySelectorAll('.links-del-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = Number(btn.dataset.id);
        handleDeletar(id);
      });
    });

    // Enter key
    document.getElementById('linkUrlInput')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') handleSalvar(links);
    });
  });
}

async function handleSalvar(links) {
  const nome = document.getElementById('linkNomeInput')?.value?.trim();
  const url = document.getElementById('linkUrlInput')?.value?.trim();
  if (!nome || !url) { showToast('Preencha nome e URL', 'error'); return; }

  if (_editingId) {
    const ok = await dbLinksAtualizar(_editingId, { nome, url });
    if (ok) { _editingId = null; renderLinksImportantes(); showToast('Link atualizado', 'success'); }
    else showToast('Erro ao atualizar', 'error');
  } else {
    const inserted = await dbLinksInserir({ nome, url });
    if (inserted) { renderLinksImportantes(); showToast('Link adicionado', 'success'); }
    else showToast('Erro ao adicionar', 'error');
  }
}

async function handleDeletar(id) {
  if (!confirm('Excluir este link?')) return;
  const ok = await dbLinksDeletar(id);
  if (ok) { _editingId = null; renderLinksImportantes(); showToast('Link excluído', 'success'); }
  else showToast('Erro ao excluir', 'error');
}

function onLinksTabActivated() {
  const container = document.getElementById('linksContent');
  if (!container) return;
  container.innerHTML = '<div class="card" style="padding:var(--s-5)"><div class="skeleton skeleton-title"></div><div class="skeleton skeleton-line"></div></div>';
  setTimeout(() => renderLinksImportantes(), 50);
}
