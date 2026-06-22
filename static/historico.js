// Histórico de Alterações
function openHistorico() {
  const overlay = document.getElementById('historicoOverlay');
  if (!overlay) return;
  overlay.classList.add('open');
  renderHistorico();
}

function closeHistorico() {
  const overlay = document.getElementById('historicoOverlay');
  if (overlay) overlay.classList.remove('open');
}

function loadHistoricoFromStorage() {
  try {
    const raw = localStorage.getItem('sistema_historico_v1');
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function renderHistorico() {
  const container = document.getElementById('historicoContent');
  if (!container) return;
  try {
    const log = loadHistoricoFromStorage();

    if (!log.length) {
      container.innerHTML = `<div style="padding:var(--s-5);text-align:center;color:var(--text-muted)">
        <div style="font-size:40px;margin-bottom:var(--s-3)">📝</div>
        <h3 style="font-weight:600;margin-bottom:var(--s-2)">Nenhuma alteração registrada</h3>
        <p style="font-size:13px">Edite dados na tabela para gerar o histórico.</p>
      </div>`;
      return;
    }

    const reversed = [...log].reverse();
    const actionIcons = { edit: '✏️', add: '➕', delete: '🗑️' };
    const actionLabels = { edit: 'Edição', add: 'Adição', delete: 'Exclusão' };

    let html = `
      <div style="padding:var(--s-5)">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--s-4)">
          <div>
            <h2 style="font-size:18px;font-weight:700">📝 Histórico de Alterações</h2>
            <p style="font-size:13px;color:var(--text-secondary)">${log.length} registro(s) — últimas 500</p>
          </div>
          <button class="btn-small" id="clearHistoricoBtn" type="button" style="color:var(--danger)">🗑️ Limpar</button>
        </div>
        <div style="overflow-x:auto;max-height:60vh;overflow-y:auto;border:1px solid var(--border);border-radius:var(--r-md)">
          <table class="ranking-table" style="min-width:600px">
            <thead>
              <tr>
                <th style="position:sticky;top:0;background:var(--bg-elevated);z-index:1">Data/Hora</th>
                <th style="position:sticky;top:0;background:var(--bg-elevated);z-index:1">Usuário</th>
                <th style="position:sticky;top:0;background:var(--bg-elevated);z-index:1">Ação</th>
                <th style="position:sticky;top:0;background:var(--bg-elevated);z-index:1">Colaborador</th>
                <th style="position:sticky;top:0;background:var(--bg-elevated);z-index:1">Mês</th>
                <th style="position:sticky;top:0;background:var(--bg-elevated);z-index:1">Detalhes</th>
              </tr>
            </thead>
            <tbody>
              ${reversed.map(e => {
                const icone = actionIcons[e.action] || '❓';
                const label = actionLabels[e.action] || e.action;
                let detalhes = '';
                if (e.action === 'edit' && e.campo) {
                  detalhes = \`<span style="font-size:12px"><code>\${escapeHtml(e.campo)}</code>: \${escapeHtml(e.before || '—')} → \${escapeHtml(e.after || '—')}</span>\`;
                } else if (e.detalhes) {
                  detalhes = escapeHtml(e.detalhes);
                }
                const ts = new Date(e.ts);
                const dataStr = ts.toLocaleString('pt-BR');
                return \`<tr>
                  <td style="font-size:11px;white-space:nowrap">\${escapeHtml(dataStr)}</td>
                  <td style="font-size:12px">\${escapeHtml(e.user)}</td>
                  <td>\${icone} \${label}</td>
                  <td>\${escapeHtml(e.colaborador || '—')}</td>
                  <td>\${escapeHtml(e.mes || '—')}</td>
                  <td style="font-size:12px">\${detalhes || '—'}</td>
                </tr>\`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    container.innerHTML = html;

    document.getElementById('historicoClose').addEventListener('click', closeHistorico);
    const clearBtn = document.getElementById('clearHistoricoBtn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        if (!requireAdmin()) return;
        if (confirm('Tem certeza? Isso vai apagar todo o histórico.')) {
          localStorage.removeItem('sistema_historico_v1');
          renderHistorico();
        }
      });
    }
  } catch (e) {
    container.innerHTML = '<div style="padding:20px;color:var(--danger)">Erro ao carregar histórico.</div>';
  }
}

// Close on backdrop
document.addEventListener('click', (e) => {
  const overlay = document.getElementById('historicoOverlay');
  if (overlay && overlay.classList.contains('open') && e.target === overlay) closeHistorico();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeHistorico();
});
