// colaboradores.js — Meus Colaboradores (cadastro com dados pessoais)

function renderColaboradores() {
  const container = document.getElementById('colaboradoresContent');
  if (!container) return;

  const colabInfo = JSON.parse(localStorage.getItem('sistema_colaboradores_info_v1') || '{}');
  const colabs = [...new Set((rawRecords || [])
    .filter(r => r && r['Atendente'] && !isAggregateName(r['Atendente']) && isColabActive(r['Atendente']))
    .map(r => r['Atendente']))].sort();

  // Mapa setor por colaborador
  const setorMap = {};
  (rawRecords || []).forEach(r => {
    if (r && r['Atendente'] && r['Setor']) {
      const nome = r['Atendente'];
      if (!setorMap[nome]) setorMap[nome] = new Set();
      setorMap[nome].add(String(r['Setor']).trim());
    }
  });

  let html = '';

  html += '<div style="margin-bottom:var(--s-4)">';
  html += '<h3 style="font-size:16px;font-weight:600;margin-bottom:2px">👥 Meus Colaboradores</h3>';
  html += `<p style="font-size:13px;color:var(--text-secondary)">${colabs.length} colaborador(es) ativos · ${Object.keys(colabInfo).length} com cadastro</p>`;
  html += '</div>';

  if (!colabs.length) {
    html += '<div class="empty-state" style="padding:var(--s-5)"><div class="empty-title">Nenhum colaborador</div><div class="empty-sub">Importe um CSV com dados para ver a lista.</div></div>';
    container.innerHTML = html;
    return;
  }

  html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:var(--s-3)">';
  for (const nome of colabs) {
    const info = colabInfo[nome] || {};
    const hasData = info.data_aniversario || info.data_admissao || info.email;
    const conduta = info.conduta_negativa === 'true' || info.conduta_negativa === true;
    html += `<div class="card colab-card ${conduta ? 'colab-card-conduta' : ''}" data-nome="${escapeHtml(nome)}" style="cursor:pointer;padding:var(--s-4);transition:box-shadow .15s" title="Clique para ver/editar">`;
    html += '<div style="display:flex;align-items:center;gap:var(--s-3)">';
    html += `<div style="font-size:28px">${typeof colabAvatarHtml === 'function' ? colabAvatarHtml(nome, 36) : '👤'}</div>`;
    html += '<div style="flex:1;min-width:0">';
    html += `<div style="font-weight:600;font-size:14px;display:flex;align-items:center;gap:var(--s-2)">${escapeHtml(nome)}${conduta ? '<span class="conduta-badge" title="Conduta negativa">🚩</span>' : ''}</div>`;
    const setores = setorMap[nome];
    if (setores && setores.size) {
      html += `<div style="font-size:12px;color:var(--text-muted);margin-top:1px">🏢 ${escapeHtml([...setores].join(', '))}</div>`;
    }
    if (info.data_aniversario) {
      const [a,m,d] = info.data_aniversario.split('-');
      html += `<div style="font-size:12px;color:var(--text-secondary);margin-top:2px">🎂 ${d}/${m}</div>`;
    }
    if (info.data_admissao) {
      const [a,m,d] = info.data_admissao.split('-');
      html += `<div style="font-size:12px;color:var(--text-secondary)">📅 Admissão: ${d}/${m}/${a}</div>`;
    }
    if (info.email) {
      html += `<div style="font-size:12px;color:var(--text-secondary)">✉️ ${escapeHtml(info.email)}</div>`;
    }
    if (!hasData) {
      html += `<div style="font-size:12px;color:var(--text-muted);margin-top:2px">Clique para cadastrar</div>`;
    }
    html += '</div>';
    html += `<div style="font-size:18px;color:var(--text-muted)">${hasData ? '✅' : '➕'}</div>`;
    html += '</div></div>';
  }
  html += '</div>';

  container.innerHTML = html;

  // Click to open overlay
  container.querySelectorAll('.colab-card').forEach(card => {
    card.addEventListener('click', () => {
      const nome = card.dataset.nome;
      openColabDetailOverlay(nome);
    });
  });
}

function openColabDetailOverlay(nome) {
  const overlay = document.getElementById('colabDetailOverlay');
  const content = document.getElementById('colabDetailContent');
  if (!overlay || !content) return;

  const colabInfo = JSON.parse(localStorage.getItem('sistema_colaboradores_info_v1') || '{}');
  const info = colabInfo[nome] || {};

  let html = '';
  const setores = [...new Set((rawRecords || []).filter(r => r && r['Atendente'] === nome && r['Setor']).map(r => String(r['Setor']).trim()))];
  html += `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--s-4)">`;
  html += `<div style="display:flex;align-items:center;gap:var(--s-3)"><div style="font-size:32px">${typeof colabAvatarHtml === 'function' ? colabAvatarHtml(nome, 40) : '👤'}</div><div><h3 style="font-size:18px;font-weight:600;margin:0">${escapeHtml(nome)}</h3><p style="font-size:13px;color:var(--text-secondary);margin:0">${setores.length ? '🏢 '+escapeHtml(setores.join(', ')) : 'Informações do colaborador'}</p></div></div>`;
  html += '</div>';

  html += '<form id="colabInfoForm" style="display:grid;grid-template-columns:1fr 1fr;gap:var(--s-3)">';

  html += '<div class="field"><span>Data de Aniversário</span>';
  html += `<input type="date" id="ciAniversario" value="${info.data_aniversario || ''}">`;
  html += '</div>';

  html += '<div class="field"><span>Data de Admissão</span>';
  html += `<input type="date" id="ciAdmissao" value="${info.data_admissao || ''}">`;
  html += '</div>';

  html += '<div class="field" style="grid-column:1/-1"><span>Email</span>';
  html += `<input type="email" id="ciEmail" placeholder="email@exemplo.com" value="${escapeHtml(info.email || '')}">`;
  html += '</div>';

  html += `<div class="field" style="grid-column:1/-1"><span>Tarefas que já desempenhou</span>`;
  html += `<textarea id="ciTarefas" style="width:100%;min-height:70px;font-size:13px;line-height:1.6" placeholder="Ex: Atendimento N1, Suporte Chat, Projeto Migração...">${escapeHtml(info.tarefas_desempenhadas || '')}</textarea>`;
  html += '</div>';

  html += `<div class="field" style="grid-column:1/-1"><span>Objetivos Futuros</span>`;
  html += `<textarea id="ciObjetivos" style="width:100%;min-height:70px;font-size:13px;line-height:1.6" placeholder="Ex: Assumir liderança, aprender ferramenta X...">${escapeHtml(info.objetivos_futuros || '')}</textarea>`;
  html += '</div>';

  const condutaChecked = info.conduta_negativa === 'true' || info.conduta_negativa === true;

  html += `<div class="field" style="grid-column:1/-1;display:flex;align-items:center;gap:var(--s-3);padding:var(--s-3);border:1px solid ${condutaChecked ? 'var(--danger)' : 'var(--border)'};border-radius:var(--r-md)">
    <span style="font-size:18px">🚩</span>
    <div style="flex:1">
      <div style="font-size:13px;font-weight:600;color:var(--text-strong)">Destacar por conduta negativa</div>
      <div style="font-size:11px;color:var(--text-muted)">Ex: desrespeito, faltas, reclamações recorrentes</div>
    </div>
    <label style="position:relative;display:inline-block;width:44px;height:24px;flex-shrink:0">
      <input type="checkbox" id="ciCondutaToggle" ${condutaChecked ? 'checked' : ''} style="opacity:0;width:0;height:0">
      <span style="position:absolute;cursor:pointer;inset:0;background:${condutaChecked ? 'var(--danger)' : 'var(--border)'};border-radius:12px;transition:.2s"></span>
      <span style="position:absolute;content:'';height:18px;width:18px;left:3px;bottom:3px;background:var(--bg-surface);border-radius:50%;transition:.2s;transform:${condutaChecked ? 'translateX(20px)' : 'translateX(0)'}"></span>
    </label>
  </div>`;

  html += `<div class="field" style="grid-column:1/-1" id="ciCondutaMotivoField" ${condutaChecked ? '' : 'hidden'}>
    <span>Motivo da conduta</span>
    <textarea id="ciCondutaMotivo" style="width:100%;min-height:60px;font-size:13px;line-height:1.6;border-color:var(--danger)" placeholder="Descreva o motivo do destaque...">${escapeHtml(info.conduta_motivo || '')}</textarea>
  </div>`;
  const _availMeses = [...new Set((rawRecords || []).filter(r => r && r['Mês']).map(r => r['Mês']))].sort();
  const _condutaMes = info.conduta_mes || (_availMeses.length ? _availMeses[_availMeses.length-1] : '');
  const _condutaPts = info.conduta_pontos || 15;
  html += `<div class="field" style="grid-column:1/-1" id="ciCondutaMesField" ${condutaChecked ? '' : 'hidden'}>
    <span>Mês da penalidade</span>
    <select id="ciCondutaMes"><option value="">-- Selecione --</option>`;
  for (const m of _availMeses) {
    html += `<option value="${escapeHtml(m)}"${_condutaMes === m ? ' selected' : ''}>${escapeHtml(m)}</option>`;
  }
  html += `</select></div>`;
  html += `<div class="field" style="grid-column:1/-1" id="ciCondutaPontosField" ${condutaChecked ? '' : 'hidden'}>
    <span>Pontos a deduzir</span>
    <input type="number" id="ciCondutaPontos" step="0.5" min="0.5" max="999" value="${_condutaPts}">
  </div>`;

  html += `<div class="field" style="grid-column:1/-1"><span>Observações</span>`;
  html += `<textarea id="ciObservacoes" style="width:100%;min-height:70px;font-size:13px;line-height:1.6" placeholder="Qualquer observação adicional...">${escapeHtml(info.observacoes || '')}</textarea>`;
  html += '</div>';

  html += '<div style="grid-column:1/-1;display:flex;gap:var(--s-2);padding-top:var(--s-2)">';
  html += `<button class="btn-primary" id="ciSalvarBtn" type="button" style="flex:1">💾 Salvar</button>`;
  html += `<button class="btn-small" id="ciLimparBtn" type="button">🗑️ Limpar dados</button>`;
  html += '</div>';

  html += '</form>';

  // ── Histórico de penalidades ──
  const allBonus = JSON.parse(localStorage.getItem('sistema_pontos_extras_v1') || '[]');
  const penalties = allBonus.filter(b => String(b.colaborador) === nome && (parseFloat(b.pontos) || 0) < 0);
  if (penalties.length) {
    html += '<div style="grid-column:1/-1;margin-top:var(--s-4)">';
    html += '<h4 style="font-size:14px;font-weight:600;margin:0 0 var(--s-3) 0">📋 Histórico de penalidades</h4>';
    html += '<div style="display:flex;flex-direction:column;gap:var(--s-2)">';
    for (const p of penalties) {
      const pts = Math.abs(parseFloat(p.pontos) || 0);
      html += '<div style="display:flex;align-items:flex-start;gap:var(--s-3);padding:var(--s-2) var(--s-3);border:1px solid var(--border);border-radius:var(--r-sm)">';
      html += `<div style="font-size:16px;font-weight:700;color:var(--danger);min-width:48px;text-align:center">-${pts.toFixed(1)}</div>`;
      html += '<div style="flex:1;min-width:0">';
      if (p.descricao) {
        html += `<div style="font-size:13px">${escapeHtml(p.descricao)}</div>`;
      }
      html += '<div style="font-size:11px;color:var(--text-muted);margin-top:1px">';
      const parts = [];
      if (p.mes) parts.push(`📅 ${escapeHtml(p.mes)}`);
      if (p.createdAt) parts.push(new Date(p.createdAt).toLocaleString('pt-BR'));
      html += parts.join(' · ');
      html += '</div></div></div>';
    }
    html += '</div></div>';
  }

  content.innerHTML = html;
  overlay.classList.add('open');

  document.getElementById('ciSalvarBtn').addEventListener('click', async () => {
    if (!requireAdmin()) return;
    const condutaChecked = document.getElementById('ciCondutaToggle').checked;
    const condutaMotivo = document.getElementById('ciCondutaMotivo').value.trim();
    const data = {
      data_aniversario: document.getElementById('ciAniversario').value || '',
      data_admissao: document.getElementById('ciAdmissao').value || '',
      email: document.getElementById('ciEmail').value.trim(),
      tarefas_desempenhadas: document.getElementById('ciTarefas').value.trim(),
      objetivos_futuros: document.getElementById('ciObjetivos').value.trim(),
      observacoes: document.getElementById('ciObservacoes').value.trim(),
      conduta_negativa: condutaChecked ? 'true' : '',
      conduta_motivo: condutaMotivo,
      conduta_mes: document.getElementById('ciCondutaMes').value || '',
      conduta_pontos: parseFloat(document.getElementById('ciCondutaPontos').value) || 15
    };
    if (condutaChecked) {
      const mes = data.conduta_mes;
      const pts = data.conduta_pontos;
      if (info.conduta_bonus_id) {
        await dbPontosExtrasSave({
          id: info.conduta_bonus_id,
          colaborador: nome,
          mes: mes,
          descricao: condutaMotivo || 'Conduta negativa',
          pontos: -Math.abs(pts),
          createdAt: info.conduta_bonus_createdAt || new Date().toISOString()
        });
        data.conduta_bonus_id = info.conduta_bonus_id;
      } else {
        const bonusId = Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
        await dbPontosExtrasSave({
          id: bonusId,
          colaborador: nome,
          mes: mes,
          descricao: condutaMotivo || 'Conduta negativa',
          pontos: -Math.abs(pts),
          createdAt: new Date().toISOString()
        });
        data.conduta_bonus_id = bonusId;
        data.conduta_bonus_createdAt = new Date().toISOString();
      }
    } else {
      if (info.conduta_bonus_id) {
        await dbPontosExtrasDelete(info.conduta_bonus_id);
      }
      data.conduta_bonus_id = '';
      data.conduta_bonus_createdAt = '';
    }
    await dbColabInfoSave(nome, data);
    showToast(`Dados de ${nome} salvos!`, 'success', 'Colaboradores');
    overlay.classList.remove('open');
    if (typeof renderColaboradores === 'function') renderColaboradores();
    if (typeof renderGamification === 'function') renderGamification();
    if (typeof renderBonus === 'function') renderBonus();
  });

  document.getElementById('ciCondutaToggle').addEventListener('change', () => {
    const checked = document.getElementById('ciCondutaToggle').checked;
    ['ciCondutaMotivoField','ciCondutaMesField','ciCondutaPontosField'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.hidden = !checked;
    });
  });

  document.getElementById('ciLimparBtn').addEventListener('click', async () => {
    if (!requireAdmin()) return;
    if (!confirm(`Limpar todos os dados cadastrais de ${nome}?`)) return;
    if (info.conduta_bonus_id) {
      await dbPontosExtrasDelete(info.conduta_bonus_id);
    }
    const data = {
      data_aniversario: '', data_admissao: '', email: '',
      tarefas_desempenhadas: '', objetivos_futuros: '', observacoes: '',
      conduta_negativa: '', conduta_motivo: '', conduta_bonus_id: '',
      conduta_bonus_createdAt: '', conduta_mes: '', conduta_pontos: ''
    };
    await dbColabInfoSave(nome, data);
    showToast(`Dados de ${nome} removidos!`, 'success', 'Colaboradores');
    overlay.classList.remove('open');
    if (typeof renderColaboradores === 'function') renderColaboradores();
    if (typeof renderGamification === 'function') renderGamification();
    if (typeof renderBonus === 'function') renderBonus();
  });
}

function onColaboradoresTabActivated() {
  const container = document.getElementById('colaboradoresContent');
  if (!container) return;
  container.innerHTML = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:var(--s-3);padding:var(--s-4)"><div class="card" style="padding:var(--s-5)"><div class="skeleton skeleton-title"></div><div class="skeleton skeleton-line"></div></div><div class="card" style="padding:var(--s-5)"><div class="skeleton skeleton-title"></div><div class="skeleton skeleton-line"></div></div><div class="card" style="padding:var(--s-5)"><div class="skeleton skeleton-title"></div><div class="skeleton skeleton-line"></div></div></div>';
  setTimeout(() => renderColaboradores(), 50);
}
