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

function logHistorico(action, rec, extra = {}) {
  const entry={...extra,id:crypto.randomUUID(),ts:new Date().toISOString(),action,
    colaborador:rec?.Atendente||'',mes:rec?.['Mês']||''};
  const token=AppDataSession.token();
  // A ação principal tem seu próprio resultado; falha da trilha não a desfaz.
  return Promise.resolve().then(()=>dbHistoricoAdd(entry)).catch(error=>{
    if(AppDataSession.current(token)){
      console.warn('[Historico] Registro não confirmado.',error);
      showToast('Histórico não confirmado. Abra o histórico para conferir os envios pendentes.','error');
    }
    return{status:'unconfirmed',id:entry.id};
  });
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
  window.ActiveManagers?.refresh('colabs');
}

function closeManageColabs() {
  if(window.ActiveManagers&&!ActiveManagers.canClose('colabs'))return;
  const overlay = document.getElementById('manageColabsOverlay');
  if (overlay) overlay.classList.remove('open');
}

function openManageSetores() {
  const overlay = document.getElementById('manageSetoresOverlay');
  if (!overlay) return;
  overlay.classList.add('open');
  renderManageSetores();
  window.ActiveManagers?.refresh('setores');
}

function closeManageSetores() {
  if(window.ActiveManagers&&!ActiveManagers.canClose('setores'))return;
  const overlay = document.getElementById('manageSetoresOverlay');
  if (overlay) overlay.classList.remove('open');
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

  // Modal Escape/focus is owned by ui-accessibility; never close underlying editors.
  if (e.defaultPrevented || document.querySelector('dialog[open], .command-palette-overlay:not([hidden])') || document.body.classList.contains('has-accessible-dialog')) return;
  if (e.key === 'Escape') {
    const panel = document.getElementById('notifPanel');
    if (panel) panel.style.display = 'none';
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
