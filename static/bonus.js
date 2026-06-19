// bonus.js — Bônus manuais (pontos extras por auxílio, projetos, etc)

const BONUS_EDITING_KEY = 'sistema_bonus_editando_v1';

function renderBonus() {
  const container = document.getElementById('bonusContent');
  if (!container) return;

  const saved = JSON.parse(localStorage.getItem('sistema_pontos_extras_v1') || '[]');
  const editingRaw = localStorage.getItem(BONUS_EDITING_KEY);
  const editing = editingRaw ? JSON.parse(editingRaw) : null;

  // Lista de colaboradores ativos dos dados importados
  const colabs = [...new Set((rawRecords || [])
    .filter(r => r && r['Atendente'] && !isAggregateName(r['Atendente']) && isColabActive(r['Atendente']))
    .map(r => r['Atendente']))].sort();

  let html = '';

  // ── Formulário ──
  html += '<div class="card" style="margin-bottom:var(--s-5)">';
  html += '<div style="margin-bottom:var(--s-4)">';
  const formTitle = editing?.id ? '✏️ Editar Bônus' : '🌟 Novo Bônus';
  html += `<h3 style="font-size:15px;font-weight:600;margin-bottom:4px">${formTitle}</h3>`;
  html += '<p style="font-size:13px;color:var(--text-secondary)">Atribua pontos extras para reconhecer auxílio à equipe, projetos especiais, etc.</p>';
  html += '</div>';

  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--s-3);margin-bottom:var(--s-3)">';
  html += '<div class="field"><span>Colaborador</span>';
  html += `<select id="bonusColaboradorInput">`;
  html += `<option value="">Selecione...</option>`;
  for (const c of colabs) {
    const sel = editing?.colaborador === c ? ' selected' : '';
    html += `<option value="${escapeHtml(c)}"${sel}>${escapeHtml(c)}</option>`;
  }
  html += '</select></div>';
  html += '<div class="field"><span>Pontos</span>';
  html += `<input type="number" id="bonusPontosInput" step="0.5" min="0.5" max="999" placeholder="Ex: 3" value="${editing ? editing.pontos : 1}">`;
  html += '</div></div>';

  html += '<div class="field" style="margin-bottom:var(--s-3)">';
  html += '<span>Descrição</span>';
  html += `<textarea id="bonusDescricaoInput" style="width:100%;min-height:60px;font-size:13px;line-height:1.6" placeholder="Ex: Auxiliou a equipe no projeto X, cobriu plantão...">${editing ? escapeHtml(editing.descricao || '') : ''}</textarea>`;
  html += '</div>';

  html += '<div style="display:flex;gap:var(--s-3)">';
  if (editing && editing.id) {
    html += `<button class="btn-primary" id="bonusSalvarBtn" type="button">💾 Atualizar</button>`;
    html += `<button class="btn-small" id="bonusCancelarBtn" type="button">Cancelar</button>`;
  } else {
    html += `<button class="btn-primary" id="bonusSalvarBtn" type="button">💾 Conceder Bônus</button>`;
  }
  html += '</div></div>';

  // ── Resumo acumulado ──
  const acumulo = {};
  for (const b of saved) {
    if (!acumulo[b.colaborador]) acumulo[b.colaborador] = 0;
    acumulo[b.colaborador] += parseFloat(b.pontos) || 0;
  }
  const topColabs = Object.entries(acumulo).sort((a, b) => b[1] - a[1]).slice(0, 3);

  // ── Lista ──
  html += '<div class="card">';
  html += '<div class="card-header">';
  html += '<div><h3 style="font-size:15px;font-weight:600">📋 Bônus Concedidos</h3>';
  html += `<p style="font-size:13px;color:var(--text-secondary)">${saved.length} bônus · ${Object.keys(acumulo).length} colaborador(es) bonificados</p></div>`;
  if (topColabs.length) {
    html += `<div style="font-size:12px;color:var(--text-secondary)">🥇 ${topColabs.map(([n, p]) => `${escapeHtml(n)} (${p.toFixed(1)} pts)`).join(' · ')}</div>`;
  }
  html += '</div>';

  if (!saved.length) {
    html += '<div class="empty-state" style="padding:var(--s-5)"><div class="empty-title">Nenhum bônus ainda</div><div class="empty-sub">Conceda o primeiro bônus acima.</div></div>';
  } else {
    html += '<div style="display:flex;flex-direction:column;gap:var(--s-2)">';
    for (const b of saved) {
      html += `<div style="display:flex;align-items:center;gap:var(--s-3);padding:var(--s-3) var(--s-4);border:1px solid var(--border);border-radius:var(--r-md)">`;
      html += `<div style="font-size:20px;font-weight:700;color:var(--success);min-width:48px;text-align:center">+${parseFloat(b.pontos).toFixed(1)}</div>`;
      html += `<div style="flex:1;min-width:0">`;
      html += `<div style="font-size:14px;font-weight:600">${escapeHtml(b.colaborador)}</div>`;
      if (b.descricao) {
        html += `<div style="font-size:12px;color:var(--text-secondary);margin-top:2px">${escapeHtml(b.descricao)}</div>`;
      }
      html += `<div style="font-size:11px;color:var(--text-muted);margin-top:2px">${b.createdAt ? new Date(b.createdAt).toLocaleString('pt-BR') : ''}</div>`;
      html += '</div>';
      html += '<div style="display:flex;gap:var(--s-1)">';
      html += `<button class="btn-small bonus-editar-btn" data-id="${b.id}" type="button">✏️</button>`;
      html += `<button class="btn-small btn-delete bonus-excluir-btn" data-id="${b.id}" type="button">🗑️</button>`;
      html += '</div></div>';
    }
    html += '</div>';
  }
  html += '</div>';

  container.innerHTML = html;
  bindBonusEvents(saved);
}

function bindBonusEvents(saved) {
  const container = document.getElementById('bonusContent');
  if (!container) return;

  // Salvar
  const salvarBtn = document.getElementById('bonusSalvarBtn');
  if (salvarBtn) {
    salvarBtn.addEventListener('click', async () => {
      const colaborador = document.getElementById('bonusColaboradorInput').value;
      const pontos = parseFloat(document.getElementById('bonusPontosInput').value) || 0;
      const descricao = document.getElementById('bonusDescricaoInput').value;
      if (!colaborador) {
        showToast('Selecione um colaborador.', 'error', 'Bônus');
        return;
      }
      if (pontos <= 0) {
        showToast('A quantidade de pontos deve ser positiva.', 'error', 'Bônus');
        return;
      }
      const editingRaw = localStorage.getItem(BONUS_EDITING_KEY);
      const editing = editingRaw ? JSON.parse(editingRaw) : null;
      const bonus = {
        id: editing?.id || Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6),
        colaborador: colaborador,
        descricao: descricao.trim(),
        pontos: pontos,
        createdAt: editing?.createdAt || new Date().toISOString()
      };
      await dbPontosExtrasSave(bonus);
      localStorage.removeItem(BONUS_EDITING_KEY);
      showToast(`Bônus de ${pontos.toFixed(1)} pts para ${colaborador}!`, 'success', 'Bônus');
      renderBonus();
      if (typeof renderGamification === 'function') renderGamification();
    });
  }

  // Cancelar edição
  const cancelarBtn = document.getElementById('bonusCancelarBtn');
  if (cancelarBtn) {
    cancelarBtn.addEventListener('click', () => {
      localStorage.removeItem(BONUS_EDITING_KEY);
      renderBonus();
    });
  }

  // Editar
  container.querySelectorAll('.bonus-editar-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const b = saved.find(x => x.id === btn.dataset.id);
      if (!b) return;
      localStorage.setItem(BONUS_EDITING_KEY, JSON.stringify({ ...b }));
      renderBonus();
    });
  });

  // Excluir
  container.querySelectorAll('.bonus-excluir-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const b = saved.find(x => x.id === btn.dataset.id);
      if (!b || !confirm(`Excluir bônus de ${parseFloat(b.pontos).toFixed(1)} pts para ${b.colaborador}?`)) return;
      await dbPontosExtrasDelete(b.id);
      renderBonus();
      if (typeof renderGamification === 'function') renderGamification();
    });
  });
}

function onBonusTabActivated() {
  const container = document.getElementById('bonusContent');
  if (!container) return;
  container.innerHTML = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--s-4)"><div class="card" style="padding:var(--s-5)"><div class="skeleton skeleton-title"></div><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line"></div></div><div class="card" style="padding:var(--s-5)"><div class="skeleton skeleton-title" style="width:30%"></div><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line short"></div></div></div>';
  setTimeout(() => renderBonus(), 50);
}
