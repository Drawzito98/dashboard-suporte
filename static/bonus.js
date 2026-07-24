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

  // ── Header ──
  html += '<div style="margin-bottom:var(--s-4)">';
  html += '<h3 style="font-size:16px;font-weight:600;margin-bottom:2px">🌟 Bônus & Penalidades</h3>';
  html += '<p style="font-size:13px;color:var(--text-secondary)">Pontos extras por auxílio, projetos, ou descontos manuais.</p>';
  html += '</div>';

  // ── Formulário ──
  html += '<div style="background:var(--bg-subtle);border-radius:var(--r-md);padding:var(--s-4);margin-bottom:var(--s-4)">';
  const formTitle = editing?.id ? '✏️ Editar' : '➕ Novo';
  html += `<div style="font-size:13px;font-weight:600;margin-bottom:var(--s-3)">${formTitle}</div>`;
  html += '<div class="grid-2col" style="margin-bottom:var(--s-3)">;
  html += '<div class="field"><span>Colaborador</span>';
  html += `<select id="bonusColaboradorInput">`;
  html += `<option value="">Selecione...</option>`;
  for (const c of colabs) {
    const sel = editing?.colaborador === c ? ' selected' : '';
    html += `<option value="${escapeHtml(c)}"${sel}>${escapeHtml(c)}</option>`;
  }
  html += '</select></div>';
  html += '<div class="field"><span>Pontos</span>';
  html += `<input type="number" id="bonusPontosInput" step="0.5" min="0.5" max="999" placeholder="Ex: 3" value="${editing ? Math.abs(parseFloat(editing.pontos) || 1) : 1}">`;
  html += '</div></div>';
  html += '<div class="field" style="margin-bottom:var(--s-3)"><span>Descrição</span>';
  html += `<textarea id="bonusDescricaoInput" style="width:100%;min-height:50px;font-size:13px;line-height:1.6" placeholder="Ex: Auxiliou a equipe no projeto X...">${editing ? escapeHtml(editing.descricao || '') : ''}</textarea>`;
  html += '</div>';
  html += '<div class="field" style="margin-bottom:var(--s-3)"><span>Mês de referência (opcional)</span>';
  html += '<select id="bonusMesInput">';
  html += '<option value="">-- Sem mês --</option>';
  const _availMeses = [...new Set((rawRecords || []).filter(r => r && r['Mês']).map(r => r['Mês']))].sort();
  const _editingMes = editing?.mes || '';
  for (const m of _availMeses) {
    const sel = _editingMes === m ? ' selected' : '';
    html += `<option value="${escapeHtml(m)}"${sel}>${escapeHtml(m)}</option>`;
  }
  html += '</select></div>';
  if (editing && editing.id) {
    html += '<div style="display:flex;gap:var(--s-2)">';
    html += `<button class="btn-primary" id="bonusSalvarBtn" type="button" style="flex:1">💾 Atualizar</button>`;
    html += `<button class="btn-small" id="bonusCancelarBtn" type="button">Cancelar</button>`;
    html += '</div>';
  } else {
    html += '<div style="display:flex;gap:var(--s-2)">';
    html += `<button class="btn-primary" id="bonusAdicionarBtn" type="button" style="flex:1;background:var(--success)">➕ Adicionar</button>`;
    html += `<button class="btn-primary" id="bonusRemoverBtn" type="button" style="flex:1;background:var(--danger)">➖ Remover</button>`;
    html += '</div>';
  }
  html += '</div>';

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
    html += '<div style="display:flex;flex-direction:column;gap:var(--s-2);max-height:320px;overflow-y:auto">';
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
      const mesInfo = b.mes ? `📅 ${escapeHtml(b.mes)}` : '';
      html += `<div style="font-size:11px;color:var(--text-muted);margin-top:1px">${mesInfo}${mesInfo ? ' · ' : ''}${b.createdAt ? new Date(b.createdAt).toLocaleString('pt-BR') : ''}</div>`;
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

  async function salvarBonus(sinal) {
    const colaborador = document.getElementById('bonusColaboradorInput').value;
    const absPts = parseFloat(document.getElementById('bonusPontosInput').value) || 0;
    const descricao = document.getElementById('bonusDescricaoInput').value;
    if (!colaborador) {
      showToast('Selecione um colaborador.', 'error', 'Bônus');
      return;
    }
    if (absPts <= 0) {
      showToast('A quantidade de pontos deve ser positiva.', 'error', 'Bônus');
      return;
    }
    const editingRaw = localStorage.getItem(BONUS_EDITING_KEY);
    const editing = editingRaw ? JSON.parse(editingRaw) : null;
    const mes = document.getElementById('bonusMesInput').value || '';
    const bonus = {
      id: editing?.id || Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6),
      colaborador: colaborador,
      mes: mes,
      descricao: descricao.trim(),
      pontos: absPts * sinal,
      createdAt: editing?.createdAt || new Date().toISOString()
    };
    await dbPontosExtrasSave(bonus);
    localStorage.removeItem(BONUS_EDITING_KEY);
    const label = sinal > 0 ? 'Adicionado' : 'Removido';
    showToast(`${label} ${absPts.toFixed(1)} pts ${sinal > 0 ? 'para' : 'de'} ${colaborador}!`, 'success', 'Bônus');
    renderBonus();
    if (typeof renderGamification === 'function') renderGamification();
  }

  const addBtn = document.getElementById('bonusAdicionarBtn');
  if (addBtn) addBtn.addEventListener('click', () => { if (!requireAdmin()) return; salvarBonus(1); });

  const remBtn = document.getElementById('bonusRemoverBtn');
  if (remBtn) remBtn.addEventListener('click', () => { if (!requireAdmin()) return; salvarBonus(-1); });

  // Editing mode
  const salvarBtn = document.getElementById('bonusSalvarBtn');
  if (salvarBtn) {
    salvarBtn.addEventListener('click', async () => {
      if (!requireAdmin()) return;
      const colaborador = document.getElementById('bonusColaboradorInput').value;
      const absPts = parseFloat(document.getElementById('bonusPontosInput').value) || 0;
      const descricao = document.getElementById('bonusDescricaoInput').value;
      if (!colaborador) {
        showToast('Selecione um colaborador.', 'error', 'Bônus');
        return;
      }
      if (absPts <= 0) {
        showToast('A quantidade de pontos deve ser positiva.', 'error', 'Bônus');
        return;
      }
      const editingRaw = localStorage.getItem(BONUS_EDITING_KEY);
      const editing = editingRaw ? JSON.parse(editingRaw) : null;
      if (!editing) return;
      const originalSinal = (parseFloat(editing.pontos) || 0) >= 0 ? 1 : -1;
      const mes = document.getElementById('bonusMesInput').value || '';
      const bonus = {
        ...editing,
        mes: mes,
        descricao: descricao.trim(),
        pontos: absPts * originalSinal
      };
      await dbPontosExtrasSave(bonus);
      localStorage.removeItem(BONUS_EDITING_KEY);
      showToast(`Bônus atualizado!`, 'success', 'Bônus');
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
      if (!requireAdmin()) return;
      const b = saved.find(x => x.id === btn.dataset.id);
      if (!b || !confirm(`Excluir bônus de ${parseFloat(b.pontos).toFixed(1)} pts para ${b.colaborador}?`)) return;
      await dbPontosExtrasDelete(b.id);
      renderBonus();
      if (typeof renderGamification === 'function') renderGamification();
    });
  });
}

function toggleBonusPanel() {
  const overlay = document.getElementById('bonusOverlay');
  if (!overlay) return;
  const isOpen = overlay.style.display !== 'none';
  if (isOpen) {
    overlay.style.display = 'none';
    localStorage.removeItem(BONUS_EDITING_KEY);
  } else {
    overlay.style.display = 'flex';
    renderBonus();
  }
}

// Close button wiring
const _bonusCloseBtn = document.getElementById('bonusOverlayClose');
if (_bonusCloseBtn) {
  _bonusCloseBtn.addEventListener('click', () => {
    document.getElementById('bonusOverlay').style.display = 'none';
    localStorage.removeItem(BONUS_EDITING_KEY);
  });
}
