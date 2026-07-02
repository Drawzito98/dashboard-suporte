// avaliacao-atendimento.js — Avaliação de Atendimentos (sidebar overlay)

function renderAvaliacaoAtendimento(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const saved = JSON.parse(localStorage.getItem(AVALIACAO_ATEND_LOCAL_KEY) || '[]');
  const colabs = [...new Set((rawRecords || [])
    .filter(r => r && r['Atendente'] && !isAggregateName(r['Atendente']) && isColabActive(r['Atendente']))
    .map(r => r['Atendente']))].sort();

  let html = '';

  html += '<div class="card" style="margin-bottom:var(--s-4)">';
  html += '<div class="card-header">';
  html += '<div><h3 style="font-size:16px;font-weight:600">Avaliar Atendimento</h3>';
  html += '<p style="font-size:13px;color:var(--text-secondary)">Registre a avaliação de um atendimento realizado</p></div>';
  html += '</div>';

  html += '<div class="ausencias-form">';
  html += '<div class="ausencias-field">';
  html += '<label>Protocolo / Ticket</label>';
  html += '<input type="text" id="avalProtocoloInput" placeholder="Ex: #12345" style="width:100%">';
  html += '</div>';

  html += '<div class="ausencias-field">';
  html += '<label>Colaborador</label>';
  html += `<select id="avalColaboradorInput" style="width:100%"><option value="">Selecione...</option>`;
  for (const c of colabs) {
    html += `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`;
  }
  html += '</select>';
  html += '</div>';

  html += '<div class="ausencias-field">';
  html += '<label>Nota (1 a 10)</label>';
  html += '<input type="number" id="avalNotaInput" min="1" max="10" step="0.5" value="5" style="width:100%">';
  html += '</div>';

  html += '<div class="ausencias-field">';
  html += '<label class="checkbox-label">';
  html += '<input type="checkbox" id="avalJustaInput" checked> Avaliação justa';
  html += '</label>';
  html += '</div>';

  html += '<div class="ausencias-field">';
  html += '<label>Resumo do atendimento</label>';
  html += '<textarea id="avalResumoInput" rows="3" placeholder="Descreva resumidamente o atendimento..." style="width:100%;resize:vertical"></textarea>';
  html += '</div>';

  html += '<div class="ausencias-actions">';
  html += '<button class="btn-primary" id="avalSalvarBtn" type="button" style="justify-content:center">Registrar Avaliação</button>';
  html += '</div>';
  html += '</div>';
  html += '</div>';

  html += '<div class="card">';
  html += '<div class="card-header">';
  html += '<div><h3 style="font-size:16px;font-weight:600">Avaliações Registradas</h3>';
  html += `<p style="font-size:13px;color:var(--text-secondary)">${saved.length} registro(s)</p></div>`;
  if (saved.length > 0) {
    html += '<button class="btn-small" id="avalRefreshBtn" type="button">Atualizar</button>';
  }
  html += '</div>';

  if (!saved.length) {
    html += '<div class="empty-state" style="padding:var(--s-5)"><div class="empty-title">Nenhuma avaliação</div><div class="empty-sub">Registre a primeira avaliação acima.</div></div>';
  } else {
    html += '<div class="ausencias-list">';
    for (const a of saved) {
      html += '<div class="ausencias-item">';
      html += '<div class="ausencias-item-info">';
      html += `<strong style="font-size:14px">${escapeHtml(a.protocolo)}</strong>`;
      html += `<span style="font-size:12px;color:var(--text-muted)">${escapeHtml(a.colaborador)} · Nota: ${a.nota} · ${a.justa ? 'Justa' : 'Injusta'}${a.resumo ? ' · ' + escapeHtml(a.resumo) : ''}</span>`;
      html += '</div>';
      html += '<div class="ausencias-item-actions">';
      html += `<button class="btn-small aval-del-btn" data-id="${a.id}" type="button" style="color:var(--danger)">Excluir</button>`;
      html += '</div></div>';
    }
    html += '</div>';
  }
  html += '</div>';

  container.innerHTML = html;
  bindAvaliacaoAtendEvents(containerId, saved);
}

function bindAvaliacaoAtendEvents(containerId, saved) {
  document.getElementById('avalSalvarBtn')?.addEventListener('click', async () => {
    if (!requireAdmin()) return;
    const protocolo = document.getElementById('avalProtocoloInput').value.trim();
    const colaborador = document.getElementById('avalColaboradorInput').value;
    const nota = parseFloat(document.getElementById('avalNotaInput').value);
    const justa = document.getElementById('avalJustaInput').checked;
    const resumo = document.getElementById('avalResumoInput').value.trim();
    if (!protocolo || !colaborador || isNaN(nota)) {
      showToast('Preencha protocolo, colaborador e nota.', 'error', 'Avaliação');
      return;
    }
    const item = {
      id: Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6),
      protocolo,
      colaborador,
      nota,
      justa,
      resumo
    };
    await dbAvaliacaoAtendSave(item);
    document.getElementById('avalProtocoloInput').value = '';
    document.getElementById('avalResumoInput').value = '';
    showToast(`Avaliação registrada para ${colaborador}!`, 'success', 'Avaliação');
    renderAvaliacaoAtendimento(containerId);
  });

  const container = document.getElementById(containerId);
  if (!container) return;
  container.querySelectorAll('.aval-del-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!requireAdmin()) return;
      const a = saved.find(x => x.id === btn.dataset.id);
      if (!a || !confirm(`Excluir avaliação do protocolo ${a.protocolo}?`)) return;
      await dbAvaliacaoAtendDelete(a.id);
      renderAvaliacaoAtendimento(containerId);
    });
  });
}

function openAvaliacaoAtendimentoOverlay() {
  const overlay = document.getElementById('avaliarAtendimentoOverlay');
  if (!overlay) return;
  const content = document.getElementById('avaliarAtendimentoOverlayContent');
  if (!content) return;
  content.innerHTML = '<div class="card" style="padding:var(--s-5)"><div class="skeleton skeleton-title"></div><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line"></div></div>';
  overlay.classList.add('open');
  setTimeout(() => renderAvaliacaoAtendimento('avaliarAtendimentoOverlayContent'), 50);
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('avaliarAtendimentoBtn')?.addEventListener('click', openAvaliacaoAtendimentoOverlay);
  document.getElementById('avaliarAtendimentoOverlayClose')?.addEventListener('click', () => {
    document.getElementById('avaliarAtendimentoOverlay')?.classList.remove('open');
  });
  const overlay = document.getElementById('avaliarAtendimentoOverlay');
  overlay?.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.classList.remove('open');
  });
});
