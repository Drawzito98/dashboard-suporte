// reportes.js — Aba de Reportes (mensagens de usuários externos)
let reportesUnsub = null;
let reportesPollInterval = null;

function getReportesContainer() {
  return document.getElementById('reportesContent');
}

function getUserEmail() {
  return document.getElementById('currentUserDisplay')?.textContent?.trim() || '';
}

function formatReporteDate(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  return d.toLocaleString('pt-BR');
}

function formatReporteShortDate(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR');
}

function reporteStatusBadge(r) {
  if (r.respondida) return '<span class="role-badge" style="background:var(--success-bg,#d1fae5);color:var(--success-text,#065f46)">Respondido</span>';
  if (r.user_id && !r.lida) return '<span class="role-badge" style="background:var(--warning-bg,#fef3c7);color:var(--warning-text,#92400e)">Pendente</span>';
  if (r.lida) return '<span class="role-badge" style="background:var(--bg-subtle,#f3f4f6);color:var(--text-muted,#9ca3af)">Lido</span>';
  return '<span class="role-badge" style="background:var(--danger-bg,#fee2e2);color:var(--danger-text,#991b1b)">Não lido</span>';
}

function reporteCategoriaBadge(r) {
  if (!r.categoria) return '';
  const cores = { suporte: { bg: '#dbeafe', text: '#1e40af' }, feedback: { bg: '#d1fae5', text: '#065f46' }, bug: { bg: '#fee2e2', text: '#991b1b' }, outro: { bg: '#f3f4f6', text: '#6b7280' } };
  const c = cores[r.categoria] || cores.outro;
  return `<span class="role-badge" style="background:${c.bg};color:${c.text}">${r.categoria}</span>`;
}

function reportePrioridadeBadge(r) {
  const cores = { alta: { bg: '#fee2e2', text: '#991b1b' }, media: { bg: '#fef3c7', text: '#92400e' }, baixa: { bg: '#f3f4f6', text: '#6b7280' } };
  const c = cores[r.prioridade] || cores.media;
  return `<span class="role-badge" style="background:${c.bg};color:${c.text}">${r.prioridade || 'media'}</span>`;
}

function renderReportes() {
  const container = getReportesContainer();
  if (!container) return;
  const isAdminUser = isAdmin();

  container.innerHTML = `
    <div class="card-header" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:var(--s-2);margin-bottom:var(--s-4)">
      <div>
        <h2 style="margin:0;display:flex;align-items:center;gap:8px">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1.2em" height="1.2em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
          Reportes
        </h2>
        <p style="margin:2px 0 0;font-size:13px;color:var(--text-secondary)">
          Mensagens enviadas por usuários externos
        </p>
      </div>
      <div style="display:flex;gap:var(--s-2);align-items:center">
        <button class="btn-small" id="exportarCsvBtn" type="button" title="Exportar CSV">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          CSV
        </button>
        <button class="btn-small" id="refreshReportesBtn" type="button" title="Atualizar lista">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
          Atualizar
        </button>
        ${isAdminUser ? `
        <button class="btn-small" id="verFormBtn" type="button" title="Visualizar o formulário público">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
          Ver formulário
        </button>
        <button class="btn-small" id="gerarLinkReporteBtn" type="button" title="Gerar link público para compartilhar">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
          Gerar link
        </button>
        ` : ''}
      </div>
    </div>
    <div class="reportes-filters" style="display:flex;gap:var(--s-2);flex-wrap:wrap;margin-bottom:var(--s-3);align-items:center">
      <input id="reportesSearchInput" type="text" placeholder="Buscar por assunto, nome, email..." style="flex:1;min-width:180px;padding:6px 10px;font-size:13px;border:1px solid var(--border);border-radius:var(--r-sm);background:var(--bg-input);color:var(--text)">
      <select id="reportesFilterCategoria" style="padding:6px 10px;font-size:13px;border:1px solid var(--border);border-radius:var(--r-sm);background:var(--bg-input);color:var(--text)">
        <option value="">Todas categorias</option>
        <option value="suporte">Suporte</option>
        <option value="feedback">Feedback</option>
        <option value="bug">Bug</option>
        <option value="outro">Outro</option>
      </select>
      <select id="reportesFilterPrioridade" style="padding:6px 10px;font-size:13px;border:1px solid var(--border);border-radius:var(--r-sm);background:var(--bg-input);color:var(--text)">
        <option value="">Todas prioridades</option>
        <option value="alta">Alta</option>
        <option value="media">Média</option>
        <option value="baixa">Baixa</option>
      </select>
    </div>
    <div id="reportesLista"></div>
  `;

  document.getElementById('refreshReportesBtn')?.addEventListener('click', carregarReportes);
  document.getElementById('exportarCsvBtn')?.addEventListener('click', exportarReportesCsv);

  document.getElementById('reportesSearchInput')?.addEventListener('input', carregarReportes);
  document.getElementById('reportesFilterCategoria')?.addEventListener('change', carregarReportes);
  document.getElementById('reportesFilterPrioridade')?.addEventListener('change', carregarReportes);

  if (isAdminUser) {
    document.getElementById('gerarLinkReporteBtn')?.addEventListener('click', mostrarModalLink);
  }

  document.getElementById('verFormBtn')?.addEventListener('click', mostrarPreviewForm);

  carregarReportes();
}

async function carregarReportes() {
  const lista = document.getElementById('reportesLista');
  if (!lista) return;
  lista.innerHTML = '<p style="text-align:center;padding:var(--s-4);color:var(--text-muted)">Carregando...</p>';

  const isAdminUser = isAdmin();
  const reportes = await dbReportesListar();
  const currentUserId = (await sbClient.auth.getUser())?.data?.user?.id;

  if (!reportes.length) {
    lista.innerHTML = `
      <div class="empty-state" style="margin-top:var(--s-4)">
        <div class="empty-title">Nenhum reporte recebido</div>
        <div class="empty-sub">
          ${isAdminUser
            ? 'Compartilhe o link público para começar a receber mensagens.'
            : 'Nenhuma mensagem atribuída a você ainda.'}
        </div>
      </div>`;
    return;
  }

  // Atualiza badge de não lidas
  const naoLidas = reportes.filter(r => !r.lida && (!r.user_id || r.user_id === currentUserId)).length;
  atualizarBadgeReportes(naoLidas);

  // Divergência: colaborador só vê os seus
  const visiveis = isAdminUser ? reportes : reportes.filter(r => r.user_id === currentUserId);

  if (!visiveis.length) {
    lista.innerHTML = `
      <div class="empty-state" style="margin-top:var(--s-4)">
        <div class="empty-title">Nenhum reporte para você</div>
        <div class="empty-sub">Aguarde até que um administrador atribua mensagens a você.</div>
      </div>`;
    return;
  }

  // Aplicar filtros antes de ordenar
  let filtrados = visiveis;
  const termo = document.getElementById('reportesSearchInput')?.value?.toLowerCase() || '';
  const catFiltro = document.getElementById('reportesFilterCategoria')?.value || '';
  const priFiltro = document.getElementById('reportesFilterPrioridade')?.value || '';
  if (termo) filtrados = filtrados.filter(r =>
    (r.assunto || '').toLowerCase().includes(termo) ||
    (r.nome || '').toLowerCase().includes(termo) ||
    (r.email || '').toLowerCase().includes(termo) ||
    (r.mensagem || '').toLowerCase().includes(termo)
  );
  if (catFiltro) filtrados = filtrados.filter(r => r.categoria === catFiltro);
  if (priFiltro) filtrados = filtrados.filter(r => (r.prioridade || 'media') === priFiltro);

  if (!filtrados.length) {
    lista.innerHTML = `<div class="empty-state" style="margin-top:var(--s-4)"><div class="empty-title">Nenhum resultado</div><div class="empty-sub">Tente ajustar os filtros.</div></div>`;
    return;
  }

  // Ordena: não lidos primeiro, depois por data
  const ordenados = [...filtrados].sort((a, b) => {
    if (a.lida !== b.lida) return a.lida ? 1 : -1;
    return new Date(b.created_at) - new Date(a.created_at);
  });

  let html = `<div class="reportes-list">`;
  for (const r of ordenados) {
    html += `
      <div class="reporte-card ${!r.lida ? 'reporte-card-unread' : ''}" data-id="${r.id}">
        <div class="reporte-card-header">
          <div class="reporte-card-info">
            <div style="display:flex;gap:var(--s-1);flex-wrap:wrap;margin-bottom:2px">
              ${reporteCategoriaBadge(r)}
              ${reportePrioridadeBadge(r)}
            </div>
            <strong class="reporte-assunto">${escHtml(r.assunto)}</strong>
            <span class="reporte-meta">
              ${escHtml(r.nome)} &lt;${escHtml(r.email)}&gt;
              ${r.data ? `&middot; ${r.data}` : ''}
              &middot; ${formatReporteShortDate(r.created_at)}
            </span>
          </div>
          <div class="reporte-card-actions">
            ${reporteStatusBadge(r)}
            <button class="btn-small reporte-expand-btn" type="button" title="Ver detalhes">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
          </div>
        </div>
        <div class="reporte-card-body" style="display:none">
          ${r.data ? `<div style="font-size:12px;color:var(--text-secondary);margin-bottom:var(--s-2)">Data: <strong>${r.data}</strong></div>` : ''}
          <div class="reporte-mensagem">
            <p>${escHtml(r.mensagem)}</p>
          </div>
          ${r.imagem_url ? `<div style="margin-bottom:var(--s-3)"><img src="${escHtml(r.imagem_url)}" style="max-width:100%;max-height:300px;border-radius:var(--r-sm);border:1px solid var(--border);cursor:pointer" onclick="window.open(this.src)" title="Clique para ampliar"/></div>` : ''}
          ${r.resposta ? `
          <div class="reporte-resposta">
            <strong style="font-size:12px;color:var(--text-secondary)">Sua resposta:</strong>
            <p>${escHtml(r.resposta)}</p>
          </div>
          ` : ''}
          <div class="reporte-card-footer">
            <span style="font-size:11px;color:var(--text-muted)">${formatReporteDate(r.created_at)}</span>
            <div style="display:flex;gap:var(--s-2);flex-wrap:wrap;align-items:center">
              ${`<button class="btn-small reporte-toggle-lida" data-id="${r.id}" data-lida="${r.lida}" type="button" style="font-size:11px">${r.lida ? 'Marcar como não lida' : 'Marcar como lida'}</button>`}
              ${!r.respondida ? `<button class="btn-small reporte-responder-btn" data-id="${r.id}" type="button" style="font-size:11px">Responder</button>` : ''}
              ${isAdminUser ? `
                <select class="reporte-categoria-select" data-id="${r.id}" style="font-size:11px;padding:2px 4px">
                  <option value="">Sem cat.</option>
                  <option value="suporte" ${r.categoria === 'suporte' ? 'selected' : ''}>Suporte</option>
                  <option value="feedback" ${r.categoria === 'feedback' ? 'selected' : ''}>Feedback</option>
                  <option value="bug" ${r.categoria === 'bug' ? 'selected' : ''}>Bug</option>
                  <option value="outro" ${r.categoria === 'outro' ? 'selected' : ''}>Outro</option>
                </select>
                <select class="reporte-prioridade-select" data-id="${r.id}" style="font-size:11px;padding:2px 4px">
                  <option value="baixa" ${(r.prioridade||'media') === 'baixa' ? 'selected' : ''}>Baixa</option>
                  <option value="media" ${(r.prioridade||'media') === 'media' ? 'selected' : ''}>Média</option>
                  <option value="alta" ${(r.prioridade||'media') === 'alta' ? 'selected' : ''}>Alta</option>
                </select>
                <select class="reporte-assign-select" data-id="${r.id}" style="font-size:11px;padding:2px 4px;max-width:150px">
                  <option value="">Atribuir para...</option>
                </select>
                <button class="btn-small reporte-deletar-btn" data-id="${r.id}" type="button" style="font-size:11px;color:var(--danger-text,#991b1b)" title="Excluir mensagem">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                  Excluir
                </button>
              ` : ''}
            </div>
          </div>
        </div>
      </div>`;
  }
  html += `</div>`;
  lista.innerHTML = html;

  // Bind dos eventos
  lista.querySelectorAll('.reporte-expand-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const card = btn.closest('.reporte-card');
      const body = card.querySelector('.reporte-card-body');
      const isOpen = body.style.display !== 'none';
      body.style.display = isOpen ? 'none' : 'block';
      btn.querySelector('polyline')?.setAttribute('points', isOpen ? '6 9 12 15 18 9' : '6 15 12 9 18 15');
    });
  });

  lista.querySelectorAll('.reporte-toggle-lida').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const lida = btn.dataset.lida === 'true';
      await dbReportesAtualizar(id, { lida: !lida });
      carregarReportes();
    });
  });

  lista.querySelectorAll('.reporte-responder-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const card = btn.closest('.reporte-card');
      const assunto = card?.querySelector('.reporte-assunto')?.textContent || '';
      mostrarModalResposta(id, assunto);
    });
  });

  // Preencher selects de atribuição com os colaboradores
  if (isAdminUser) {
    const selects = lista.querySelectorAll('.reporte-assign-select');
    if (selects.length) {
      let colaboradores = [];
      try {
        const { data: { session } } = await sbClient.auth.getSession();
        const token = session?.access_token;
        if (token) {
          const res = await fetch('/api/users', {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) {
            const data = await res.json();
            const users = Array.isArray(data) ? data : (data.users || []);
            colaboradores = users
              .filter(u => u.user_metadata?.role === 'colaborador')
              .map(u => ({ id: u.id, email: u.email }));
          }
        }
      } catch (e) {
        console.warn('[reportes] Erro ao carregar colaboradores:', e);
      }
      selects.forEach(sel => {
        const currentId = visiveis.find(r => String(r.id) === sel.dataset.id)?.user_id || '';
        colaboradores.forEach(c => {
          const opt = document.createElement('option');
          opt.value = c.id;
          opt.textContent = c.email;
          if (c.id === currentId) opt.selected = true;
          sel.appendChild(opt);
        });
        sel.addEventListener('change', async () => {
          if (!sel.value) return;
          await dbReportesAtribuir(sel.dataset.id, sel.value);
          showToast('Reporte atribuído com sucesso!', 'success');
        });
      });
    }

    // Categoria select
    lista.querySelectorAll('.reporte-categoria-select').forEach(sel => {
      sel.addEventListener('change', async () => {
        await dbReportesAtualizar(sel.dataset.id, { categoria: sel.value || null });
        showToast('Categoria atualizada!', 'success');
        carregarReportes();
      });
    });

    // Prioridade select
    lista.querySelectorAll('.reporte-prioridade-select').forEach(sel => {
      sel.addEventListener('change', async () => {
        await dbReportesAtualizar(sel.dataset.id, { prioridade: sel.value });
        showToast('Prioridade atualizada!', 'success');
        carregarReportes();
      });
    });

    // Deletar
    lista.querySelectorAll('.reporte-deletar-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const card = btn.closest('.reporte-card');
        const assunto = card?.querySelector('.reporte-assunto')?.textContent || 'esta mensagem';
        if (!confirm(`Tem certeza que deseja excluir "${assunto}"? Esta ação não pode ser desfeita.`)) return;
        const ok = await dbReportesDeletar(id);
        if (ok) {
          showToast('Mensagem excluída!', 'success');
          carregarReportes();
        } else {
          showToast('Erro ao excluir mensagem.', 'error');
        }
      });
    });
  }
}

function mostrarModalResposta(id, assunto) {
  const overlay = document.getElementById('reporteRespostaOverlay') || criarOverlayResposta();
  overlay.classList.remove('hidden');
  overlay.querySelector('#reporteRespostaId').value = id;
  overlay.querySelector('#reporteRespostaAssunto').textContent = assunto || 'Reporte';
  overlay.querySelector('#reporteRespostaTexto').value = '';
  overlay.querySelector('#reporteRespostaError')?.classList.add('hidden');
  overlay.querySelector('#reporteRespostaSuccess')?.classList.add('hidden');
  const oldCopy = overlay.querySelector('.reporte-copy-btn');
  if (oldCopy) oldCopy.remove();
}

function criarOverlayResposta() {
  const div = document.createElement('div');
  div.id = 'reporteRespostaOverlay';
  div.className = 'hidden';
  div.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center';
  div.innerHTML = `
    <div style="background:var(--bg-surface);border-radius:var(--r-lg);padding:var(--s-6);max-width:500px;width:90%;box-shadow:var(--shadow-lg)">
      <h3 style="margin:0 0 var(--s-2)">Responder reporte</h3>
      <p style="font-size:0.875rem;color:var(--text-secondary);margin:0 0 var(--s-4)">
        Assunto: <strong id="reporteRespostaAssunto"></strong>
      </p>
      <input type="hidden" id="reporteRespostaId" />
      <label class="field">
        <span>Sua resposta</span>
        <textarea id="reporteRespostaTexto" rows="5" placeholder="Digite sua resposta..." style="width:100%;resize:vertical"></textarea>
      </label>
      <div style="display:flex;gap:var(--s-2);margin-top:var(--s-3)">
        <button class="btn-primary" id="reporteRespostaEnviarBtn" type="button" style="flex:1;justify-content:center">Enviar resposta</button>
        <button class="btn-small" id="reporteRespostaCancelarBtn" type="button" style="flex:1;justify-content:center">Cancelar</button>
      </div>
      <div id="reporteRespostaError" class="auth-error hidden"></div>
      <div id="reporteRespostaSuccess" class="auth-success hidden"></div>
    </div>
  `;
  document.body.appendChild(div);

  document.getElementById('reporteRespostaEnviarBtn').addEventListener('click', async () => {
    const id = document.getElementById('reporteRespostaId').value;
    const texto = document.getElementById('reporteRespostaTexto').value.trim();
    const errEl = document.getElementById('reporteRespostaError');
    const okEl = document.getElementById('reporteRespostaSuccess');
    errEl.classList.add('hidden');
    okEl.classList.add('hidden');
    if (!texto) { errEl.textContent = 'Digite uma resposta.'; errEl.classList.remove('hidden'); return; }
    const userId = (await sbClient.auth.getUser())?.data?.user?.id;
    const ok = await dbReportesResponder(id, texto, userId);
    if (ok) {
      okEl.textContent = 'Resposta salva!';
      okEl.classList.remove('hidden');
      const copyBtn = document.createElement('button');
      copyBtn.className = 'btn-small';
      copyBtn.textContent = '📋 Copiar resposta';
      copyBtn.style.cssText = 'margin-top:8px;width:100%;justify-content:center';
      copyBtn.onclick = () => {
        navigator.clipboard.writeText(texto).then(() => {
          copyBtn.textContent = '✅ Copiado!';
          setTimeout(() => { copyBtn.textContent = '📋 Copiar resposta'; }, 2000);
        });
      };
      okEl.parentNode.appendChild(copyBtn);
      setTimeout(() => {
        div.classList.add('hidden');
        copyBtn.remove();
        carregarReportes();
      }, 4000);
    } else {
      errEl.textContent = 'Erro ao enviar resposta.';
      errEl.classList.remove('hidden');
    }
  });

  document.getElementById('reporteRespostaCancelarBtn').addEventListener('click', () => {
    div.classList.add('hidden');
  });

  return div;
}

function mostrarModalLink() {
  const overlay = document.getElementById('reporteLinkOverlay') || criarOverlayLink();
  overlay.classList.remove('hidden');
  const link = `${window.location.origin}/reportlider`;
  overlay.querySelector('#reporteLinkUrl').value = link;
  const embedInput = overlay.querySelector('#reporteLinkEmbed');
  if (embedInput) {
    embedInput.value = `<iframe src="${link}" width="100%" height="520px" style="border:none"></iframe>`;
  }
}

function criarOverlayLink() {
  const div = document.createElement('div');
  div.id = 'reporteLinkOverlay';
  div.className = 'hidden';
  div.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center';
  div.innerHTML = `
    <div style="background:var(--bg-surface);border-radius:var(--r-lg);padding:var(--s-6);max-width:520px;width:90%;box-shadow:var(--shadow-lg)">
      <h3 style="margin:0 0 var(--s-2)">Link público para reportes</h3>
      <p style="font-size:0.875rem;color:var(--text-secondary);margin:0 0 var(--s-4)">
        Compartilhe este link para que usuários externos enviem mensagens diretamente para o seu dashboard.
      </p>
      <label class="field">
        <span>URL pública</span>
        <div style="display:flex;gap:var(--s-2)">
          <input id="reporteLinkUrl" type="text" readonly style="flex:1;font-size:13px" />
          <button class="btn-small" id="reporteLinkCopiarBtn" type="button">Copiar</button>
        </div>
      </label>
      <label class="field" style="margin-top:var(--s-3)">
        <span>Embed iframe (para colar no seu site)</span>
        <div style="display:flex;gap:var(--s-2)">
          <input id="reporteLinkEmbed" type="text" readonly style="flex:1;font-size:12px" />
          <button class="btn-small" id="reporteLinkEmbedCopiarBtn" type="button">Copiar</button>
        </div>
      </label>
      <div style="display:flex;gap:var(--s-2);margin-top:var(--s-3)">
        <button class="btn-primary" id="reporteLinkFecharBtn" type="button" style="flex:1;justify-content:center">Fechar</button>
      </div>
      <div id="reporteLinkCopiado" class="auth-success hidden" style="margin-top:var(--s-2);font-size:13px">Link copiado!</div>
    </div>
  `;
  document.body.appendChild(div);

  document.getElementById('reporteLinkCopiarBtn').addEventListener('click', () => {
    const input = document.getElementById('reporteLinkUrl');
    input.select();
    try {
      navigator.clipboard?.writeText(input.value);
    } catch {}
    document.getElementById('reporteLinkCopiado').classList.remove('hidden');
    setTimeout(() => document.getElementById('reporteLinkCopiado').classList.add('hidden'), 2000);
  });

  document.getElementById('reporteLinkEmbedCopiarBtn')?.addEventListener('click', () => {
    const input = document.getElementById('reporteLinkEmbed');
    if (input) { input.select(); try { navigator.clipboard?.writeText(input.value); } catch {} }
    showToast('Embed code copiado!', 'success');
  });

  document.getElementById('reporteLinkFecharBtn').addEventListener('click', () => {
    div.classList.add('hidden');
  });

  return div;
}

function mostrarPreviewForm() {
  const overlay = document.getElementById('reportePreviewOverlay') || criarOverlayPreview();
  overlay.classList.remove('hidden');
}

function criarOverlayPreview() {
  const div = document.createElement('div');
  div.id = 'reportePreviewOverlay';
  div.className = 'hidden';
  div.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center';
  const formUrl = `${window.location.origin}/reportlider`;
  div.innerHTML = `
    <div style="background:var(--bg-surface);border-radius:var(--r-lg);padding:var(--s-4);max-width:600px;width:90%;max-height:90vh;overflow-y:auto;box-shadow:var(--shadow-lg)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--s-3)">
        <h3 style="margin:0">Preview do formulário</h3>
        <button class="btn-small" id="reportePreviewFechar" type="button" style="font-size:18px;line-height:1">✕</button>
      </div>
      <p style="font-size:13px;color:var(--text-secondary);margin-bottom:var(--s-3)">
        É assim que seus usuários veem o formulário. Você pode incorporar esta página no seu site com um iframe.
      </p>
      <div style="border:2px dashed var(--border);border-radius:var(--r-md);overflow:hidden;margin-bottom:var(--s-3)">
        <iframe src="${formUrl}" style="width:100%;height:520px;border:none" title="Formulário de reporte"></iframe>
      </div>
      <label class="field">
        <span>Embed code (iframe)</span>
        <div style="display:flex;gap:var(--s-2)">
          <input id="reporteEmbedCode" type="text" readonly value="&lt;iframe src=&quot;${formUrl}&quot; width=&quot;100%&quot; height=&quot;520px&quot; style=&quot;border:none&quot;&gt;&lt;/iframe&gt;" style="flex:1;font-size:12px" />
          <button class="btn-small" id="reporteEmbedCopiarBtn" type="button">Copiar</button>
        </div>
      </label>
    </div>
  `;
  document.body.appendChild(div);

  document.getElementById('reportePreviewFechar').addEventListener('click', () => div.classList.add('hidden'));
  document.getElementById('reporteEmbedCopiarBtn')?.addEventListener('click', () => {
    const input = document.getElementById('reporteEmbedCode');
    input.select();
    try { navigator.clipboard?.writeText(input.value); } catch {}
    showToast('Embed code copiado!', 'success');
  });

  div.addEventListener('click', (e) => { if (e.target === div) div.classList.add('hidden'); });
  return div;
}

function atualizarBadgeReportes(count) {
  const badge = document.getElementById('reportesBadge');
  if (badge) {
    badge.textContent = count > 0 ? count : '';
    badge.style.display = count > 0 ? '' : 'none';
  }
}

// Notificação push via Supabase Realtime
function iniciarRealtimeReportes() {
  if (!sbClient || reportesUnsub) return;
  try {
    const channel = sbClient.channel('reportes-realtime');
    reportesUnsub = channel.on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'reportes' },
      (payload) => {
        showToast(`Nova mensagem: ${payload.new?.assunto || 'Reporte'}`, 'info');
        tocarNotificacaoSom();
        atualizarBadgeReportes(payload.new ? 1 : 0);
        carregarReportes();
      }
    ).subscribe();
  } catch (e) {
    console.warn('[reportes] Realtime indisponível, usando polling');
    iniciarPollingReportes();
  }
}

function pararRealtimeReportes() {
  if (reportesUnsub) {
    try { sbClient.removeChannel(reportesUnsub); } catch {}
    reportesUnsub = null;
  }
  if (reportesPollInterval) {
    clearInterval(reportesPollInterval);
    reportesPollInterval = null;
  }
}

function iniciarPollingReportes() {
  if (reportesPollInterval) return;
  reportesPollInterval = setInterval(() => {
    carregarReportes();
  }, 30000);
}

function tocarNotificacaoSom() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 800;
    gain.gain.value = 0.15;
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  } catch {}
}

function escHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

async function exportarReportesCsv() {
  const reportes = await dbReportesListar();
  if (!reportes.length) { showToast('Nenhum reporte para exportar.', 'error'); return; }
  const headers = ['ID', 'Nome', 'Email', 'Assunto', 'Mensagem', 'Categoria', 'Prioridade', 'Data', 'Criado em', 'Lida', 'Respondida'];
  const rows = reportes.map(r => [
    r.id, r.nome, r.email, r.assunto, (r.mensagem||'').replace(/"/g, '""'),
    r.categoria || '', r.prioridade || 'media', r.data || '',
    formatReporteDate(r.created_at), r.lida ? 'Sim' : 'Não', r.respondida ? 'Sim' : 'Não'
  ]);
  const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
  const bom = '\uFEFF';
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `reportes_${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('CSV exportado com sucesso!', 'success');
}

// Hook chamado pelo app.js quando a aba é ativada
function onReportesTabActivated() {
  renderReportes();
}

// Inicia notificações após auth (chamado pelo app.js)
function initReportesNotifications() {
  if (!reportesUnsub && !reportesPollInterval) {
    iniciarRealtimeReportes();
  }
}
