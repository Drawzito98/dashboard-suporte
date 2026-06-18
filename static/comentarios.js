// Comentários por Período — anotações mensais
const COMENTARIOS_KEY = 'sistema_comentarios_v1';

function getComentarios() {
  try {
    const raw = localStorage.getItem(COMENTARIOS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) { return {}; }
}

function saveComentarios(map) {
  try { localStorage.setItem(COMENTARIOS_KEY, JSON.stringify(map)); } catch (e) {}
}

function addComentario(mes, texto) {
  const map = getComentarios();
  if (!map[mes]) map[mes] = [];
  const user = (window.__sbUser && window.__sbUser.email) ? window.__sbUser.email : 'desconhecido';
  map[mes].push({
    id: Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    texto: texto.trim(),
    user,
    ts: new Date().toISOString()
  });
  saveComentarios(map);
}

function delComentario(mes, id) {
  const map = getComentarios();
  if (map[mes]) {
    map[mes] = map[mes].filter(c => c.id !== id);
    if (!map[mes].length) delete map[mes];
    saveComentarios(map);
  }
}

function openComentarios() {
  const overlay = document.getElementById('comentariosOverlay');
  if (!overlay) return;
  overlay.classList.add('open');
  renderComentarios();
}

function closeComentarios() {
  const overlay = document.getElementById('comentariosOverlay');
  if (overlay) overlay.classList.remove('open');
}

function renderComentarios() {
  const container = document.getElementById('comentariosContent');
  if (!container) return;

  const data = typeof globalFilters !== 'undefined' && globalFilters ? globalFilters.aplicar(rawRecords) : (rawRecords || []);
  const meses = [...new Set((data || []).filter(r => r && r['Mês']).map(r => r['Mês']))].sort();
  const map = getComentarios();

  let html = `
    <div style="padding:var(--s-5)">
      <h2 style="font-size:18px;font-weight:700;margin-bottom:var(--s-1)">💬 Comentários por Período</h2>
      <p style="font-size:13px;color:var(--text-secondary);margin-bottom:var(--s-4)">Anotações e observações sobre cada mês.</p>
      <div style="overflow-x:auto;max-height:60vh;overflow-y:auto;border:1px solid var(--border);border-radius:var(--r-md)">
        <table class="ranking-table" style="min-width:500px">
          <thead>
            <tr>
              <th style="position:sticky;top:0;background:var(--bg-elevated);z-index:1">Período</th>
              <th style="position:sticky;top:0;background:var(--bg-elevated);z-index:1">Comentários</th>
              <th style="position:sticky;top:0;background:var(--bg-elevated);z-index:1;width:100px">Ações</th>
            </tr>
          </thead>
          <tbody>
            ${meses.length ? meses.map(m => {
              const comments = map[m] || [];
              return `<tr>
                <td style="font-weight:600;vertical-align:top;padding-top:14px">${escapeHtml(m)} ${comments.length ? `<span style="font-size:11px;color:var(--text-muted)">(${comments.length})</span>` : ''}</td>
                <td style="vertical-align:top;padding-top:10px">
                  <div class="comentarios-thread">
                    ${comments.length ? comments.map(c => `
                      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;padding:8px 10px;margin-bottom:6px;background:var(--bg-inset);border-radius:var(--r-sm)">
                        <div style="flex:1;font-size:13px;line-height:1.4">
                          <div>${escapeHtml(c.texto)}</div>
                          <div style="font-size:10px;color:var(--text-muted);margin-top:4px">${escapeHtml(c.user)} · ${new Date(c.ts).toLocaleString('pt-BR')}</div>
                        </div>
                        <button class="btn-small del-comentario-btn" data-mes="${escapeHtml(m)}" data-id="${escapeHtml(c.id)}" type="button" style="font-size:12px;padding:2px 6px;color:var(--danger)">✕</button>
                      </div>
                    `).join('') : `<span style="font-size:12px;color:var(--text-muted)">Nenhum comentário</span>`}
                  </div>
                </td>
                <td style="vertical-align:top;padding-top:14px">
                  <button class="btn-small add-comentario-btn" data-mes="${escapeHtml(m)}" type="button">✏️</button>
                </td>
              </tr>`;
            }).join('') : `<tr><td colspan="3" style="text-align:center;padding:30px;color:var(--text-muted)">Nenhum período encontrado.</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;

  container.innerHTML = html;

  document.getElementById('comentariosClose').addEventListener('click', closeComentarios);

  // Add comment
  container.querySelectorAll('.add-comentario-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const mes = btn.getAttribute('data-mes');
      const texto = prompt(`Comentário para ${mes}:`);
      if (texto && texto.trim()) {
        addComentario(mes, texto);
        renderComentarios();
      }
    });
  });

  // Delete comment
  container.querySelectorAll('.del-comentario-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const mes = btn.getAttribute('data-mes');
      const id = btn.getAttribute('data-id');
      if (confirm('Remover este comentário?')) {
        delComentario(mes, id);
        renderComentarios();
      }
    });
  });
}

// Close on backdrop
document.addEventListener('click', (e) => {
  const overlay = document.getElementById('comentariosOverlay');
  if (overlay && overlay.classList.contains('open') && e.target === overlay) closeComentarios();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeComentarios();
});
