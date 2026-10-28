// Ferramentas administrativas e atalhos; IDs e funções públicas preservados.
async function cleanDuplicates() {
  const seen = new Map();
  const toRemove = [];
  let kept = 0;

  for (let i = rawRecords.length - 1; i >= 0; i--) {
    const r = rawRecords[i];
    if (!r || !r['Atendente'] || !r['Mês']) continue;
    const key = `${r['Atendente']}|${r['Mês']}|${r['Finalizados']}|${r['Assumidos']}|${r['Transferidos']}|${r['SCORE']}`;
    if (seen.has(key)) {
      toRemove.push({ idx: i, id: r.id });
    } else {
      seen.set(key, true);
      kept++;
    }
  }

  if (!toRemove.length) {
    showToast('Nenhuma duplicata encontrada.', 'ok');
    return;
  }

  setLoading(true, `Removendo ${toRemove.length} duplicatas…`);
  try {
    let removed = 0;
    for (const item of toRemove) {
      if (item.id != null && sbClient) {
        if (!await dbDeleteRecord(item.id)) continue;
      }
      rawRecords.splice(item.idx, 1);
      removed++;
    }
    if (typeof invalidateGamificationCache === 'function') invalidateGamificationCache();
    populateFilters(rawRecords);
    updateFilterOptions();
    updateView();
    showToast(`${removed} duplicata(s) removida(s). ${kept} registro(s) mantido(s).`, 'success', 'Limpeza');
  } catch (e) {
    console.error('Erro ao limpar duplicatas:', e);
    showToast('Erro ao limpar duplicatas.', 'error');
  } finally {
    setLoading(false);
  }
}

const HISTORICO_KEY = 'sistema_historico_v1';

function logHistorico(action, rec, extra = {}) {
  try {
    const raw = appStorage.getItem(HISTORICO_KEY);
    const log = raw ? JSON.parse(raw) : [];
    const user = (window.__sbUser && window.__sbUser.email) ? window.__sbUser.email : 'desconhecido';
    const entry = {
      ts: new Date().toISOString(),
      user,
      action,
      colaborador: rec ? rec['Atendente'] || '' : '',
      mes: rec ? rec['Mês'] || '' : '',
      ...extra
    };
    log.push(entry);
    // Keep last 500 entries
    if (log.length > 500) log.splice(0, log.length - 500);
    appStorage.setItem(HISTORICO_KEY, JSON.stringify(log));
    if (typeof dbHistoricoAdd === 'function') {
      dbHistoricoAdd(entry);
    }
  } catch (e) { console.warn('[Historico] Erro ao salvar:', e); }
}

// Migrate old Google Drive URLs to direct format
function migrateColabFotos() {
  try {
    const raw = appStorage.getItem(COLAB_FOTOS_KEY);
    if (!raw) return;
    const map = JSON.parse(raw);
    let changed = false;
    for (const name in map) {
      const normalized = normalizeFotoUrl(map[name]);
      if (normalized !== map[name]) {
        map[name] = normalized;
        changed = true;
      }
    }
    if (changed) {
      appStorage.setItem(COLAB_FOTOS_KEY, JSON.stringify(map));
    }
  } catch (e) {
    console.warn('[Fotos] Erro na migração:', e);
  }
}
migrateColabFotos();

function getColabFotoDebug(name) {
  return getColabFoto(name);
}

function openManageColabs() {
  const overlay = document.getElementById('manageColabsOverlay');
  if (!overlay) return;
  overlay.classList.add('open');
  renderManageColabs();
}

function closeManageColabs() {
  const overlay = document.getElementById('manageColabsOverlay');
  if (overlay) overlay.classList.remove('open');
}

function renderManageColabs() {
  const container = document.getElementById('manageColabsContent');
  if (!container) return;
  const allNames = [...new Set((rawRecords || []).filter(r => r && r['Atendente'] && !isAggregateName(r['Atendente'])).map(r => r['Atendente']))].sort();

  let html = `
    <div style="padding:var(--s-5)">
      <h2 style="font-size:18px;font-weight:700;margin-bottom:var(--s-1)">👥 Gerenciar Colaboradores</h2>
      <p style="font-size:13px;color:var(--text-secondary);margin-bottom:var(--s-4)">Marque como inativos colaboradores que não fazem mais parte da equipe. Eles serão ocultados dos filtros, ranking e projeções.</p>
      <div style="overflow-x:auto;max-height:55vh;overflow-y:auto;border:1px solid var(--border);border-radius:var(--r-md)">
        <table class="ranking-table">
          <thead><tr><th>Colaborador</th><th style="text-align:center">Ativo</th></tr></thead>
          <tbody>
            ${allNames.map(n => {
              const ativo = isColabActive(n);
              return `<tr>
                <td style="font-weight:500">${escapeHtml(n)}</td>
                <td style="text-align:center">
                  <label style="display:inline-flex;align-items:center;gap:6px;cursor:pointer">
                    <input type="checkbox" class="colab-active-toggle" data-name="${escapeHtml(n)}" ${ativo ? 'checked' : ''} style="width:18px;height:18px"/>
                    <span style="font-size:12px;color:${ativo ? 'var(--success)' : 'var(--text-muted)'}">${ativo ? 'Ativo' : 'Inativo'}</span>
                  </label>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
      <div style="display:flex;gap:var(--s-3);margin-top:var(--s-4);justify-content:flex-end">
        <button class="btn-primary" id="manageColabsDoneBtn" type="button">✅ Concluído</button>
      </div>
    </div>
  `;

  container.innerHTML = html;

  document.getElementById('manageColabsClose').addEventListener('click', closeManageColabs);
  document.getElementById('manageColabsDoneBtn').addEventListener('click', closeManageColabs);

  container.querySelectorAll('.colab-active-toggle').forEach(cb => {
    cb.addEventListener('change', () => {
      const name = cb.dataset.name;
      const active = cb.checked;
      setColabActive(name, active);
      const label = cb.nextElementSibling;
      if (label) {
        label.textContent = active ? 'Ativo' : 'Inativo';
        label.style.color = active ? 'var(--success)' : 'var(--text-muted)';
      }
    });
  });
}

// ─── GERENCIAR SETORES INATIVOS ────────────────────────────────

function openManageSetores() {
  const overlay = document.getElementById('manageSetoresOverlay');
  if (!overlay) return;
  overlay.classList.add('open');
  renderManageSetores();
}

function closeManageSetores() {
  const overlay = document.getElementById('manageSetoresOverlay');
  if (overlay) overlay.classList.remove('open');
}

function renderManageSetores() {
  const container = document.getElementById('manageSetoresContent');
  if (!container) return;
  const inactive = getInactiveSetores();
  const allSetores = [...new Set((rawRecords || []).filter(r => r && r['Setor']).map(r => r['Setor']))].sort();

  let html = `
    <div style="padding:var(--s-5)">
      <h2 style="font-size:18px;font-weight:700;margin-bottom:var(--s-1)">🏢 Gerenciar Setores</h2>
      <p style="font-size:13px;color:var(--text-secondary);margin-bottom:var(--s-4)">Marque como inativos setores que não são mais relevantes. Eles serão ocultados dos filtros, relatórios e análises.</p>
      <div style="overflow-x:auto;max-height:55vh;overflow-y:auto;border:1px solid var(--border);border-radius:var(--r-md)">
        <table class="ranking-table">
          <thead><tr><th>Setor</th><th style="text-align:center">Ativo</th></tr></thead>
          <tbody>
            ${allSetores.map(s => {
              const ativo = !inactive.has(s);
              return `<tr>
                <td style="font-weight:500">${escapeHtml(s)}</td>
                <td style="text-align:center">
                  <label style="display:inline-flex;align-items:center;gap:6px;cursor:pointer">
                    <input type="checkbox" class="setor-active-toggle" data-name="${escapeHtml(s)}" ${ativo ? 'checked' : ''} style="width:18px;height:18px"/>
                    <span style="font-size:12px;color:${ativo ? 'var(--success)' : 'var(--text-muted)'}">${ativo ? 'Ativo' : 'Inativo'}</span>
                  </label>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
      <div style="display:flex;gap:var(--s-3);margin-top:var(--s-4);justify-content:flex-end">
        <button class="btn-primary" id="manageSetoresDoneBtn" type="button">✅ Concluído</button>
      </div>
    </div>
  `;

  container.innerHTML = html;

  document.getElementById('manageSetoresClose').addEventListener('click', closeManageSetores);
  document.getElementById('manageSetoresDoneBtn').addEventListener('click', closeManageSetores);

  container.querySelectorAll('.setor-active-toggle').forEach(cb => {
    cb.addEventListener('change', () => {
      const name = cb.dataset.name;
      const active = cb.checked;
      setSetorActive(name, active);
      const label = cb.nextElementSibling;
      if (label) {
        label.textContent = active ? 'Ativo' : 'Inativo';
        label.style.color = active ? 'var(--success)' : 'var(--text-muted)';
      }
    });
  });
}

// Close on backdrop click
document.addEventListener('click', (e) => {
  const overlay = document.getElementById('manageColabsOverlay');
  if (overlay && overlay.classList.contains('open') && e.target === overlay) {
    closeManageColabs();
  }
  const overlaySetores = document.getElementById('manageSetoresOverlay');
  if (overlaySetores && overlaySetores.classList.contains('open') && e.target === overlaySetores) {
    closeManageSetores();
  }
});

document.addEventListener('keydown', (e) => {
  // Ignore when typing in inputs
  const tag = e.target.tagName;
  const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target.isContentEditable;

  if (e.key === 'Escape') {
    closeManageColabs(); closeManageSetores();
    if (typeof closeHistorico === 'function') closeHistorico();
    if (typeof closeComentarios === 'function') closeComentarios();
    if (typeof closeProjecao === 'function') closeProjecao();
    const bonusOverlay = document.getElementById('bonusOverlay');
    if (bonusOverlay) bonusOverlay.style.display = 'none';
    const panel = document.getElementById('notifPanel');
    if (panel) panel.style.display = 'none';
    const colabOverlay = document.getElementById('colabDetailOverlay');
    if (colabOverlay) { colabOverlay.classList.remove('open'); colabOverlay.style.removeProperty('display'); colabOverlay.setAttribute('aria-hidden', 'true'); }
    const reportOverlay = document.getElementById('colabReportOverlay');
    if (reportOverlay) reportOverlay.style.display = 'none';
    // Close any open modal
    document.querySelectorAll('.modal-overlay').forEach(m => { m.style.display = 'none'; });
  }

  // Keyboard shortcuts (only when not in input)
  if (!isInput && !e.ctrlKey && !e.metaKey && !e.altKey) {
    const tabOrder = ['home','dashboard','relatorio-setorial','saude-operacional','tarefas','regras','colaboradores','lider','insights','avaliacao'];
    const num = parseInt(e.key);
    if (num >= 1 && num <= tabOrder.length) {
      e.preventDefault();
      const tabBtn = document.querySelector(`.tab-btn[data-tab="${tabOrder[num - 1]}"]`);
      if (tabBtn) tabBtn.click();
      return;
    }
    // ? opens help
    if (e.key === '?' || (e.shiftKey && e.key === '/')) {
      e.preventDefault();
      if (typeof showShortcutsHelp === 'function') showShortcutsHelp();
      return;
    }
  }

  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    const avaliacaoForm = document.getElementById('avaliacaoForm');
    if (avaliacaoForm) { avaliacaoForm.requestSubmit(); showToast('Avaliação salva!', 'success'); return; }
    const fbSalvarBtn = document.getElementById('fbSalvarBtn');
    if (fbSalvarBtn && !fbSalvarBtn.disabled) { fbSalvarBtn.click(); showToast('Feedback salvo!', 'success'); return; }
    showToast('Nenhum formulário ativo para salvar.', 'info');
  }
});
