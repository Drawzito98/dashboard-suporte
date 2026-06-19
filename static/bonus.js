// bonus.js — Bônus manuais (pontos extras por auxílio, projetos, etc)

const BONUS_EDITING_KEY = 'sistema_bonus_editando_v1';

function renderBonus() {
  const container = document.getElementById('bonusContent');
  if (!container) return;

  const saved = JSON.parse(localStorage.getItem('sistema_pontos_extras_v1') || '[]');
  const editingRaw = localStorage.getItem(BONUS_EDITING_KEY);
  const editing = editingRaw ? JSON.parse(editingRaw) : null;

  const colabs = [...new Set((rawRecords || [])
    .filter(r => r && r['Atendente'] && !isAggregateName(r['Atendente']) && isColabActive(r['Atendente']))
    .map(r => r['Atendente']))].sort();

  let html = '';

  // ── Header do painel ──
  html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--s-4)">';
  html += '<div><h3 style="font-size:15px;font-weight:600;margin-bottom:2px">🌟 Bônus & Penalidades</h3>';
  html += '<p style="font-size:13px;color:var(--text-secondary)">Pontos extras por auxílio, projetos, ou descontos manuais.</p></div>';
  html += '<button class="btn-small" id="bonusFecharBtn" type="button">✕ Fechar</button>';
  html += '</div>';

  // ── Formulário ──
  html += '<div style="background:var(--bg-subtle);border-radius:var(--r-md);padding:var(--s-4);margin-bottom:var(--s-4)">';
  const formTitle = editing?.id ? '✏️ Editar' : '➕ Novo';
  html += `<div style="font-size:13px;font-weight:600;margin-bottom:var(--s-3)">${formTitle}</div>`;
  html += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:var(--s-3);margin-bottom:var(--s-3)">';
  html += '<div class="field"><span>Colaborador</span>';
  html += `<select id="bonusColaboradorInput">`;
  html += `<option value="">Selecione...</option>`;
  for (const c of colabs) {
    const sel = editing?.colaborador === c ? ' selected' : '';
    html += `<option value="${escapeHtml(c)}"${sel}>${escapeHtml(c)}</option>`;
  }
  html += '</select></div>';
  html += '<div class="field"><span>Pontos</span>';
  html += `<input type="number" id="bonusPontosInput" step="0.5" min="-999" max="999" placeholder="Positivo ou negativo" value="${editing ? editing.pontos : 1}">`;
  html += '</div>';
  html += '<div class="field" style="display:flex;align-items:flex-end;gap:var(--s-2)">';
  if (editing && editing.id) {
    html += `<button class="btn-primary" id="bonusSalvarBtn" type="button" style="flex:1">💾 Atualizar</button>`;
    html += `<button class="btn-small" id="bonusCancelarBtn" type="button">Cancelar</button>`;
  } else {
    html += `<button class="btn-primary" id="bonusSalvarBtn" type="button" style="flex:1">💾 Salvar</button>`;
  }
  html += '</div></div>';
  html += '<div class="field"><span>Descrição</span>';
  html += `<textarea id="bonusDescricaoInput" style="width:100%;min-height:50px;font-size:13px;line-height:1.6" placeholder="Ex: Auxiliou a equipe no projeto X...">${editing ? escapeHtml(editing.descricao || '') : ''}</textarea>`;
  html += '</div></div>';

  // ── Resumo ──
  const acumulo = {};
  for (const b of saved) {
    if (!acumulo[b.colaborador]) acumulo[b.colaborador] = 0;
    acumulo[b.colaborador] += parseFloat(b.pontos) || 0;
  }
  const topColabs = Object.entries(acumulo).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const totalPts = Object.values(acumulo).reduce((s, v) => s + v, 0);

  // ── Lista ──
  html += '<div style="font-size:13px;color:var(--text-secondary);margin-bottom:var(--s-3)">';
  html += `${saved.length} registro(s) · ${Object.keys(acumulo).length} colaborador(es) · <strong>${totalPts.toFixed(1)}</strong> pts totais`;
  if (topColabs.length) {
    html += ` · ${topColabs.map(([n, p]) => `${escapeHtml(n)} (${p > 0 ? '+' : ''}${p.toFixed(1)})`).join(', ')}`;
  }
  html += '</div>';

  if (!saved.length) {
    html += '<div class="empty-state" style="padding:var(--s-4)"><div class="empty-title">Nenhum bônus ainda</div><div class="empty-sub">Conceda o primeiro bônus acima.</div></div>';
  } else {
    html += '<div style="display:flex;flex-direction:column;gap:var(--s-2)">';
    for (const b of saved) {
      const pts = parseFloat(b.pontos) || 0;
      const isNeg = pts < 0;
      html += `<div style="display:flex;align-items:center;gap:var(--s-3);padding:var(--s-2) var(--s-3);border:1px solid var(--border);border-radius:var(--r-sm)">`;
      html += `<div style="font-size:16px;font-weight:700;${isNeg ? 'color:var(--danger);min-width:48px' : 'color:var(--success);min-width:48px'};text-align:center">${pts > 0 ? '+' : ''}${pts.toFixed(1)}</div>`;
      html += `<div style="flex:1;min-width:0">`;
      html += `<div style="font-size:13px;font-weight:600">${escapeHtml(b.colaborador)}</div>`;
      if (b.descricao) {
        html += `<div style="font-size:12px;color:var(--text-secondary);margin-top:1px">${escapeHtml(b.descricao)}</div>`;
      }
      html += `<div style="font-size:11px;color:var(--text-muted);margin-top:1px">${b.createdAt ? new Date(b.createdAt).toLocaleString('pt-BR') : ''}</div>`;
      html += '</div>';
      html += '<div style="display:flex;gap:var(--s-1)">';
      html += `<button class="btn-small bonus-editar-btn" data-id="${b.id}" type="button">✏️</button>`;
      html += `<button class="btn-small btn-delete bonus-excluir-btn" data-id="${b.id}" type="button">🗑️</button>`;
      html += '</div></div>';
    }
    html += '</div>';
  }

  container.innerHTML = html;
  bindBonusEvents(saved);
}

function bindBonusEvents(saved) {
  const container = document.getElementById('bonusContent');
  if (!container) return;

  const fecharBtn = document.getElementById('bonusFecharBtn');
  if (fecharBtn) {
    fecharBtn.addEventListener('click', () => {
      document.getElementById('bonusPanel').style.display = 'none';
      localStorage.removeItem(BONUS_EDITING_KEY);
    });
  }

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
      if (pontos === 0) {
        showToast('Defina uma quantidade de pontos (positivo ou negativo).', 'error', 'Bônus');
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
      showToast(`Bônus de ${pontos > 0 ? '+' : ''}${pontos.toFixed(1)} pts para ${colaborador}!`, 'success', 'Bônus');
      renderBonus();
      if (typeof renderGamification === 'function') renderGamification();
    });
  }

  const cancelarBtn = document.getElementById('bonusCancelarBtn');
  if (cancelarBtn) {
    cancelarBtn.addEventListener('click', () => {
      localStorage.removeItem(BONUS_EDITING_KEY);
      renderBonus();
    });
  }

  container.querySelectorAll('.bonus-editar-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const b = saved.find(x => x.id === btn.dataset.id);
      if (!b) return;
      localStorage.setItem(BONUS_EDITING_KEY, JSON.stringify({ ...b }));
      renderBonus();
    });
  });

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

function toggleBonusPanel() {
  const panel = document.getElementById('bonusPanel');
  if (!panel) return;
  const isOpen = panel.style.display !== 'none';
  if (isOpen) {
    panel.style.display = 'none';
    localStorage.removeItem(BONUS_EDITING_KEY);
  } else {
    panel.style.display = 'block';
    renderBonus();
  }
}
