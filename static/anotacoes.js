// anotacoes.js — Anotações diárias

const ANOTACOES_EDITING_KEY = 'sistema_anotacao_editando_v1';

function hoje() {
  return new Date().toISOString().slice(0, 10);
}

function formatarData(dataStr) {
  if (!dataStr) return '';
  const [ano, mes, dia] = dataStr.split('-');
  return `${dia}/${mes}/${ano}`;
}

function renderAnotacoes() {
  const container = document.getElementById('anotacoesContent');
  if (!container) return;

  const saved = JSON.parse(localStorage.getItem(ANOTACOES_LOCAL_KEY) || '[]');
  const editingRaw = localStorage.getItem(ANOTACOES_EDITING_KEY);
  const editing = editingRaw ? JSON.parse(editingRaw) : null;

  let html = '';

  // ── Formulário ──
  html += '<div class="card" style="margin-bottom:var(--s-5)">';
  html += '<div style="margin-bottom:var(--s-4)">';
  html += '<h3 style="font-size:15px;font-weight:600;margin-bottom:4px">📝 Nova Anotação</h3>';
  html += '<p style="font-size:13px;color:var(--text-secondary)">Registre suas observações do dia.</p>';
  html += '</div>';

  html += '<label class="field" style="margin-bottom:var(--s-3);max-width:200px">';
  html += '<span>Data</span>';
  const dataVal = editing ? (editing.data || hoje()) : hoje();
  html += `<input type="date" id="anotacaoDataInput" value="${dataVal}">`;
  html += '</label>';

  html += '<div class="field" style="margin-bottom:var(--s-3)">';
  html += '<span>O que fez hoje?</span>';
  html += `<textarea id="anotacaoTextoInput" style="width:100%;min-height:150px;font-size:13px;line-height:1.6" placeholder="Descreva suas atividades, pendências, observações...">${editing ? escapeHtml(editing.conteudo || '') : ''}</textarea>`;
  html += '</div>';

  html += '<div style="display:flex;gap:var(--s-3)">';
  if (editing && editing.id) {
    html += `<button class="btn-primary" id="anotacaoSalvarBtn" type="button">💾 Atualizar</button>`;
    html += `<button class="btn-small" id="anotacaoCancelarBtn" type="button">Cancelar</button>`;
  } else {
    html += `<button class="btn-primary" id="anotacaoSalvarBtn" type="button">💾 Salvar</button>`;
  }
  html += '</div></div>';

  // ── Lista ──
  html += '<div class="card">';
  html += '<div class="card-header">';
  html += '<div><h3 style="font-size:15px;font-weight:600">📋 Histórico de Anotações</h3>';
  html += `<p style="font-size:13px;color:var(--text-secondary)">${saved.length} anotação(ões)</p></div>`;
  if (saved.length > 0) {
    html += '<button class="btn-small" id="anotacaoRefreshBtn" type="button">🔄 Atualizar</button>';
  }
  html += '</div>';

  if (!saved.length) {
    html += '<div class="empty-state" style="padding:var(--s-5)"><div class="empty-title">Nenhuma anotação</div><div class="empty-sub">Registre sua primeira anotação acima.</div></div>';
  } else {
    html += '<div style="display:flex;flex-direction:column;gap:var(--s-3)">';
    for (const a of saved) {
      const preview = (a.conteudo || '').split('\n').slice(0, 3).join('\n');
      const dateStr = formatarData(a.data);
      html += '<div style="border:1px solid var(--border);border-radius:var(--r-md);padding:var(--s-4)">';
      html += `<div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:var(--s-2)">`;
      html += `<strong>📅 ${dateStr}</strong>`;
      html += '<div style="display:flex;gap:var(--s-2)">';
      html += `<button class="btn-small anotacao-ver-btn" data-id="${a.id}" type="button">👁️ Ver</button>`;
      html += `<button class="btn-small anotacao-editar-btn" data-id="${a.id}" type="button">✏️</button>`;
      html += `<button class="btn-small btn-delete anotacao-excluir-btn" data-id="${a.id}" type="button">🗑️</button>`;
      html += '</div></div>';
      html += `<pre style="font-size:12px;color:var(--text-secondary);white-space:pre-wrap;margin:0;max-height:80px;overflow-y:auto">${escapeHtml(preview)}</pre>`;
      html += '</div>';
    }
    html += '</div>';
  }
  html += '</div>';

  container.innerHTML = html;
  bindAnotacaoEvents(saved);
}

function bindAnotacaoEvents(saved) {
  const container = document.getElementById('anotacoesContent');
  if (!container) return;
  const salvarBtn = document.getElementById('anotacaoSalvarBtn');
  const textoInput = document.getElementById('anotacaoTextoInput');
  const dataInput = document.getElementById('anotacaoDataInput');

  if (textoInput && dataInput) {
    function autoSave() {
      const cur = JSON.parse(localStorage.getItem(ANOTACOES_EDITING_KEY) || '{}');
      cur.data = dataInput.value;
      cur.conteudo = textoInput.value;
      localStorage.setItem(ANOTACOES_EDITING_KEY, JSON.stringify(cur));
    }
    textoInput.addEventListener('input', autoSave);
    dataInput.addEventListener('change', autoSave);
  }

  if (salvarBtn) {
    salvarBtn.addEventListener('click', async () => {
      const data = document.getElementById('anotacaoDataInput').value;
      const conteudo = document.getElementById('anotacaoTextoInput').value;
      if (!data || !conteudo.trim()) {
        showToast('Preencha a data e o conteúdo.', 'error', 'Anotação');
        return;
      }
      const editingRaw = localStorage.getItem(ANOTACOES_EDITING_KEY);
      const editing = editingRaw ? JSON.parse(editingRaw) : null;
      const anotacao = {
        id: editing?.id || Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6),
        data: data,
        conteudo: conteudo.trim(),
        createdAt: editing?.createdAt || new Date().toISOString()
      };
      await dbAnotacoesSave(anotacao);
      localStorage.removeItem(ANOTACOES_EDITING_KEY);
      showToast('Anotação salva!', 'success', 'Anotações');
      renderAnotacoes();
    });
  }

  const cancelarBtn = document.getElementById('anotacaoCancelarBtn');
  if (cancelarBtn) {
    cancelarBtn.addEventListener('click', () => {
      localStorage.removeItem(ANOTACOES_EDITING_KEY);
      renderAnotacoes();
    });
  }

  container.querySelectorAll('.anotacao-ver-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const a = saved.find(x => x.id === btn.dataset.id);
      if (!a) return;
      const overlay = document.getElementById('anotacaoViewOverlay') || criarAnotacaoOverlay();
      const content = document.getElementById('anotacaoViewContent');
      if (!content) return;
      content.innerHTML = `
        <div style="padding:var(--s-5)">
          <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:var(--s-4)">
            <h2 style="font-size:18px;font-weight:700">📅 ${formatarData(a.data)}</h2>
            <button class="btn-small" id="anotacaoViewCloseBtn" type="button">✕ Fechar</button>
          </div>
          <pre style="font-size:13px;line-height:1.6;white-space:pre-wrap;background:var(--bg-subtle);padding:var(--s-4);border-radius:var(--r-md);max-height:60vh;overflow-y:auto">${escapeHtml(a.conteudo)}</pre>
        </div>`;
      overlay.classList.add('open');
      document.getElementById('anotacaoViewCloseBtn').addEventListener('click', () => overlay.classList.remove('open'));
      overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.remove('open'); });
    });
  });

  container.querySelectorAll('.anotacao-editar-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const a = saved.find(x => x.id === btn.dataset.id);
      if (!a) return;
      localStorage.setItem(ANOTACOES_EDITING_KEY, JSON.stringify({ ...a }));
      renderAnotacoes();
    });
  });

  container.querySelectorAll('.anotacao-excluir-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const a = saved.find(x => x.id === btn.dataset.id);
      if (!a || !confirm(`Excluir anotação de ${formatarData(a.data)}?`)) return;
      await dbAnotacoesDelete(a.id);
      renderAnotacoes();
    });
  });

  const refreshBtn = document.getElementById('anotacaoRefreshBtn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      if (typeof dbAnotacoesLoad === 'function') {
        dbAnotacoesLoad().then(() => renderAnotacoes());
      } else {
        renderAnotacoes();
      }
    });
  }
}

function criarAnotacaoOverlay() {
  const div = document.createElement('div');
  div.id = 'anotacaoViewOverlay';
  div.className = 'overlay';
  div.innerHTML = '<div class="overlay-content" style="max-width:600px"><div id="anotacaoViewContent"></div></div>';
  document.body.appendChild(div);
  return div;
}

function onAnotacoesTabActivated() {
  renderAnotacoes();
}
