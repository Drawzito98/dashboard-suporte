// Metas — sistema de objetivos semanais, mensais, por colaborador e setor
const METAS_STORAGE_KEY = 'sistema_metas_v1';
let goals = [];

function loadMetas() {
  const token = typeof AppDataSession !== 'undefined' ? AppDataSession.token() : null;
  try {
    const raw = appStorage.getItem(METAS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) { goals = parsed; return; }
    }
  } catch (e) { console.warn('[Metas] Erro ao ler metas:', e); }
  goals = [];
  if (typeof dbMetasLoad === 'function') {
    dbMetasLoad().then(loaded => {
      if ((!token || AppDataSession.current(token)) && loaded && Array.isArray(loaded)) {
        goals = loaded;
        // dbMetasLoad already refreshed the cache; reads must never rewrite server goals.
        if (document.querySelector('#tab-metas.active, #tab-gamificacao.active')) renderMetas();
      }
    }).catch(() => {});
  }
}

let metasSaving = false;
async function removeMeta(id) {
  const token = AppDataSession.token();
  const result = await dbMetasDelete(id);
  if (!AppDataSession.current(token)) throw new Error('Sessão alterada.');
  if (result?.status !== 'confirmed') throw new Error('Exclusão da meta não confirmada.');
  goals = goals.filter(g => g.id !== id);
  renderMetas();
}

function getMetaProgress(meta) {
  if (!rawRecords || !rawRecords.length) return 0;
  let filtered = _gfData().filter(r => r && !isAggregateName(r['Atendente']));

  if (meta.setor && meta.setor !== 'all') {
    filtered = filtered.filter(r => String(r['Setor']) === meta.setor);
  }
  if (meta.collaborator) {
    filtered = filtered.filter(r => String(r['Atendente']) === meta.collaborator);
  }
  if (meta.period && meta.period !== 'all') {
    filtered = filtered.filter(r => String(r['Mês']) === meta.period);
  } else if (meta.type === 'weekly') {
    // For weekly, use most recent month's data
    const months = [...new Set(filtered.map(r => r['Mês']))].sort();
    if (months.length) {
      const latest = months[months.length - 1];
      filtered = filtered.filter(r => String(r['Mês']) === latest);
    }
  }

  const totalFinalizados = filtered.reduce((s, r) => s + (parseInt(r['Finalizados']) || 0), 0);
  const totalScore = filtered.reduce((s, r) => {
    const sc = r['SCORE'];
    return s + (sc !== null && sc !== undefined && !isNaN(Number(sc)) ? Number(sc) : 0);
  }, 0);
  const scoreCount = filtered.filter(r => r['SCORE'] !== null && r['SCORE'] !== undefined && !isNaN(Number(r['SCORE']))).length;
  const avgScore = scoreCount > 0 ? totalScore / scoreCount : 0;

  if (meta.metric === 'finalizados') {
    const target = parseFloat(meta.target) || 1;
    return Math.min(100, Math.round((totalFinalizados / target) * 100));
  }
  if (meta.metric === 'score') {
    const target = parseFloat(meta.target) || 1;
    return Math.min(100, Math.round((avgScore / target) * 100));
  }
  if (meta.metric === 'produtividade') {
    const totalAssumidos = filtered.reduce((s, r) => s + (parseInt(r['Assumidos']) || 0), 0);
    const prod = totalAssumidos > 0 ? (totalFinalizados / totalAssumidos) : 0;
    const target = parseFloat(meta.target) || 0.01;
    return Math.min(100, Math.round((prod / target) * 100));
  }
  return 0;
}

function renderMetas() {
  const container = document.getElementById('metasContent');
  if (!container) return;
  const data = _gfData();

  const hasData = Boolean(data?.length);
  const canManage = document.body.dataset.role === 'admin';

  const catalog = typeof rawRecords !== 'undefined' ? rawRecords : (data || []);
  const setores = [...new Set((catalog || []).filter(r => r && r['Setor']).map(r => r['Setor']))].sort();
  const cols = [...new Set((catalog || []).filter(r => r && r['Atendente']).map(r => r['Atendente']))].sort();
  const meses = [...new Set((catalog || []).filter(r => r && r['Mês']).map(r => r['Mês']))].sort();

  let html = (!hasData ? '<p class="text-muted">Sem indicadores neste recorte. As metas cadastradas continuam disponíveis; o progresso será calculado quando houver dados.</p>' : '') + '<div class="metas-header"><span style="color:var(--text-secondary);font-size:13px">' + goals.length + ' meta' + (goals.length !== 1 ? 's' : '') + ' cadastrada' + (goals.length !== 1 ? 's' : '') + '</span>' + (canManage ? '<button class="btn-small" id="newMetaBtn" type="button">Nova meta</button>' : '') + '</div>';

  if (goals.length === 0) {
    html += '<div class="empty-state"><div class="empty-title">Nenhuma meta cadastrada</div><div class="empty-sub">' + (canManage ? 'Defina um objetivo no formulário abaixo.' : 'As metas cadastradas por esta conta aparecerão aqui.') + '</div></div>';
  } else {
    goals.forEach(meta => {
      const progress = getMetaProgress(meta);
      const progClass = progress >= 100 ? 'good' : (progress >= 50 ? 'warn' : 'bad');
      const typeLabels = { weekly: 'Semanal', monthly: 'Mensal', 'per-collab': 'Por colaborador', 'per-setor': 'Por setor' };
      const typeLabel = typeLabels[meta.type] || meta.type;
      const metricLabels = { finalizados: 'Finalizados', score: 'Score médio', produtividade: 'Produtividade' };
      const metricLabel = metricLabels[meta.metric] || meta.metric;

      html += `<div class="meta-card">
        <div class="meta-card-header">
          <div class="meta-title-group">
            <div class="meta-title">${escapeHtml(meta.title || 'Meta')}</div>
            <div class="meta-subtitle">${metricLabel} · Alvo: ${escapeHtml(String(meta.target))}${meta.collaborator ? ' · ' + escapeHtml(meta.collaborator) : ''}${meta.setor && meta.setor !== 'all' ? ' · Setor: ' + escapeHtml(meta.setor) : ''}${meta.period && meta.period !== 'all' ? ' · Período: ' + escapeHtml(meta.period) : ''}</div>
          </div>
          <span class="meta-badge ${meta.type}">${typeLabel}</span>
        </div>
        ${!hasData ? '<p class="text-muted">Sem dados para calcular o progresso neste recorte.</p>' : ''}
        <div class="meta-progress" ${!hasData ? 'hidden style="display:none"' : ''}>
          <div class="meta-progress-bar">
            <div class="meta-progress-fill ${progClass}" style="width:${Math.min(100, progress)}%"></div>
          </div>
          <div class="meta-progress-text">
            <span>${progress}%</span>
            <span>${progress >= 100 ? '✅ Meta atingida!' : (progress >= 50 ? '⚠️ Em andamento' : '🔴 Abaixo do esperado')}</span>
          </div>
        </div>
        <div class="meta-actions">
          ${canManage ? `<button class="btn-small btn-delete remove-meta-btn" data-id="${escapeHtml(meta.id)}" type="button">Excluir</button>` : ''}
        </div>
      </div>`;
    });
  }

  if (!canManage) {
    container.innerHTML = html + '<p class="text-muted">A criação e exclusão de metas são realizadas por administradores.</p>';
    return;
  }

function suggestAutoMeta() {
  const data = _gfData().filter(r => r && !isAggregateName(r['Atendente']));
  if (!data.length) {
    showToast('Sem dados para análise.', 'warn');
    return;
  }

  const metric = document.getElementById('metaMetricSelect')?.value || 'finalizados';
  const setor = document.getElementById('metaSetorSelect')?.value || 'all';
  const collaborator = document.getElementById('metaColabSelect')?.value || '';

  // Filter
  let filtered = [...data];
  if (setor && setor !== 'all') filtered = filtered.filter(r => String(r['Setor']) === setor);
  if (collaborator) filtered = filtered.filter(r => String(r['Atendente']) === collaborator);

  if (!filtered.length) {
    showToast('Sem dados para os filtros selecionados.', 'warn');
    return;
  }

  // Get months sorted
  const months = [...new Set(filtered.map(r => r['Mês']))].sort();
  // Use last 3 months (or all if less)
  const recentMonths = months.slice(-3);
  const recent = filtered.filter(r => recentMonths.includes(r['Mês']));

  let suggestion = 0;
  let title = '';

  if (metric === 'finalizados') {
    const vals = recent.map(r => parseInt(r['Finalizados']) || 0);
    const total = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    // Round up to nearest 10 or 5
    suggestion = Math.ceil(total / 10) * 10;
    if (suggestion < 5) suggestion = Math.ceil(total);
    title = `Meta mensal de finalizações (~${suggestion})`;
  } else if (metric === 'score') {
    const scores = recent.map(r => r['SCORE']).filter(v => v !== null && v !== undefined && !isNaN(Number(v)));
    const avg = scores.length ? scores.reduce((a, b) => a + Number(b), 0) / scores.length : 0;
    suggestion = Math.round(avg * 10) / 10;
    title = `Meta de score médio (${suggestion.toFixed(1)})`;
  } else if (metric === 'produtividade') {
    const ratios = recent.map(r => {
      const ass = parseInt(r['Assumidos']) || 0;
      const fin = parseInt(r['Finalizados']) || 0;
      return ass > 0 ? fin / ass : 0;
    }).filter(v => v > 0);
    const avg = ratios.length ? (ratios.reduce((a, b) => a + b, 0) / ratios.length) * 100 : 0;
    suggestion = Math.round(avg);
    title = `Meta de produtividade (${suggestion}%)`;
  }

  // Fill the form
  const titleInput = document.getElementById('metaTitleInput');
  if (titleInput) titleInput.value = title;
  const targetInput = document.getElementById('metaTargetInput');
  if (targetInput) targetInput.value = suggestion;

  showToast(`Sugestão automática: ${title}`, 'ok', 'Meta Automática');
}
  html += `<div style="margin-top:var(--s-5);padding-top:var(--s-5);border-top:1px solid var(--border)">
    <h3 style="font-size:14px;font-weight:600;margin-bottom:var(--s-4);color:var(--text-strong)">Nova Meta</h3>
    <div class="meta-form-grid">
      <label class="field"><span>Título</span><input id="metaTitleInput" type="text" placeholder="Ex: Meta mensal de finalizações"/></label>
      <label class="field"><span>Tipo</span>
        <select id="metaTypeSelect">
          <option value="monthly">Mensal</option>
          <option value="weekly">Semanal</option>
          <option value="per-collab">Por colaborador</option>
          <option value="per-setor">Por setor</option>
        </select>
      </label>
      <label class="field"><span>Métrica</span>
        <select id="metaMetricSelect">
          <option value="finalizados">Finalizados</option>
          <option value="score">Score médio</option>
          <option value="produtividade">Produtividade</option>
        </select>
      </label>
      <label class="field"><span>Alvo (valor)</span><input id="metaTargetInput" type="number" step="0.1" placeholder="Ex: 100"/></label>
      <label class="field"><span>Setor (opcional)</span>
        <select id="metaSetorSelect">
          <option value="all">Todos os setores</option>
          ${setores.map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('')}
        </select>
      </label>
      <label class="field"><span>Colaborador (opcional)</span>
        <select id="metaColabSelect">
          <option value="">—</option>
          ${cols.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('')}
        </select>
      </label>
      <label class="field"><span>Período/Mês (opcional)</span>
        <select id="metaPeriodSelect">
          <option value="all">Todos</option>
          ${meses.map(m => `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`).join('')}
        </select>
      </label>
    </div>
    <div style="display:flex;gap:var(--s-3);margin-top:var(--s-3)">
      <button class="btn-primary" id="saveMetaBtn" type="button" style="flex:1">Salvar Meta</button>
      <button class="btn-small" id="suggestMetaBtn" type="button">💡 Sugerir automático</button>
    </div>
  </div>`;

  container.innerHTML = html;
  try {
    const draft = JSON.parse(appStorage.getItem('sistema_meta_rascunho_v1') || 'null');
    if (draft) for (const [field, id] of Object.entries({ title:'metaTitleInput', type:'metaTypeSelect', metric:'metaMetricSelect', target:'metaTargetInput', setor:'metaSetorSelect', collaborator:'metaColabSelect', period:'metaPeriodSelect' })) {
      const input = document.getElementById(id); if (input) input.value = draft[field] ?? '';
    }
  } catch (_) {}


  document.getElementById('newMetaBtn')?.addEventListener('click', () => {
    const input = document.getElementById('metaTitleInput');
    input?.focus(); input?.scrollIntoView({ block: 'center' });
  });

  // Trocar o recorte não deve apagar o formulário ainda não enviado.
  const fields = { title:'metaTitleInput', type:'metaTypeSelect', metric:'metaMetricSelect', target:'metaTargetInput', setor:'metaSetorSelect', collaborator:'metaColabSelect', period:'metaPeriodSelect' };
  const preserveDraft = () => {
    try {
      const prior = JSON.parse(appStorage.getItem('sistema_meta_rascunho_v1') || 'null');
      const draft = { id: prior?.id || crypto.randomUUID(), createdAt: prior?.createdAt || new Date().toISOString() };
      for (const [field, id] of Object.entries(fields)) draft[field] = document.getElementById(id)?.value || '';
      appStorage.setItem('sistema_meta_rascunho_v1', JSON.stringify(draft));
    } catch (_) {}
  };
  container.querySelectorAll('input,select').forEach(input => { input.addEventListener('input', preserveDraft); input.addEventListener('change', preserveDraft); });

  // Bind remove buttons
  container.querySelectorAll('.remove-meta-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (metasSaving || !confirm('Excluir esta meta?')) return;
      metasSaving = true; btn.disabled = true;
      try { await removeMeta(btn.getAttribute('data-id')); showToast('Meta excluída.', 'success', 'Meta'); }
      catch (error) { showToast(error.message || 'Não foi possível excluir a meta.', 'error', 'Meta'); }
      finally { metasSaving = false; btn.disabled = false; }
    });
  });

  // Bind save button
  const saveBtn = document.getElementById('saveMetaBtn');
  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      if (metasSaving) return;
      const title = document.getElementById('metaTitleInput')?.value?.trim() || 'Meta';
      const type = document.getElementById('metaTypeSelect')?.value || 'monthly';
      const metric = document.getElementById('metaMetricSelect')?.value || 'finalizados';
      const target = document.getElementById('metaTargetInput')?.value;
      const setor = document.getElementById('metaSetorSelect')?.value || 'all';
      const collaborator = document.getElementById('metaColabSelect')?.value || '';
      const period = document.getElementById('metaPeriodSelect')?.value || 'all';

      if (!target || isNaN(parseFloat(target))) {
        showToast('Defina um valor alvo válido.', 'warn', 'Meta');
        return;
      }

      const token = AppDataSession.token();
      metasSaving = true; saveBtn.disabled = true;
      try {
        // ID estável para retentativa mesmo se a resposta da inserção se perder.
        const draftKey = 'sistema_meta_rascunho_v1';
        const previous = JSON.parse(appStorage.getItem(draftKey) || 'null');
        const fields = { title, type, metric, target: parseFloat(target), setor, collaborator, period };
        const meta = { ...fields, id: previous?.id || crypto.randomUUID(), createdAt: previous?.createdAt || new Date().toISOString() };
        appStorage.setItem(draftKey, JSON.stringify(meta));
        const result = await dbMetasSave([meta]);
        if (!AppDataSession.current(token)) return;
        if (result?.status !== 'confirmed') throw new Error('Gravação da meta não confirmada.');
        goals = goals.filter(g => g.id !== meta.id).concat(result.data);
        appStorage.removeItem(draftKey);
        showToast('Meta cadastrada com sucesso!', 'success', 'Meta');
        renderMetas();
      } catch (error) {
        showToast(error.message || 'Não foi possível salvar. Os campos foram mantidos para tentar novamente.', 'error', 'Meta');
      } finally { metasSaving = false; saveBtn.disabled = false; }
    });
  }

  // Bind suggest button
  const suggestBtn = document.getElementById('suggestMetaBtn');
  if (suggestBtn) suggestBtn.addEventListener('click', () => { suggestAutoMeta(); preserveDraft(); });
}

// Tab activation hook
function onMetasTabActivated() {
  loadMetas();
  renderMetas();
}
