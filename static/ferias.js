// ferias.js — Registro de Férias (sidebar overlay)

function formatarDataBr(d) {
  if (!d) return '';
  const [ano, mes, dia] = d.split('-');
  return `${dia}/${mes}/${ano}`;
}

function temFeriasSobrepostas(colaborador, inicio, fim, ignoreId) {
  const saved = JSON.parse(localStorage.getItem(FERIAS_LOCAL_KEY) || '[]');
  return saved.some(f => {
    if (ignoreId && String(f.id) === String(ignoreId)) return false;
    if (f.colaborador !== colaborador) return false;
    return inicio <= f.data_fim && fim >= f.data_inicio;
  });
}

function feriasConfirmModal(colaborador, inicio, fim) {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'mt-modal-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.5);backdrop-filter:blur(4px);z-index:200;display:none;align-items:center;justify-content:center;padding:20px';
    overlay.innerHTML = `
      <div style="width:100%;max-width:400px;background:var(--bg-surface,#fff);border:1px solid var(--border,#e2e8f0);border-radius:var(--r-xl,12px);box-shadow:var(--shadow-lg,0 12px 40px rgba(0,0,0,0.12));padding:24px;position:relative">
        <h3 style="font-size:18px;font-weight:600;color:var(--text-strong);margin:0 0 12px">Excluir Férias</h3>
        <p style="color:var(--text-secondary);font-size:14px;line-height:1.5;margin:0 0 20px">Tem certeza que deseja excluir as férias de <strong>${escapeHtml(colaborador)}</strong> (${inicio} → ${fim})?</p>
        <div style="display:flex;justify-content:flex-end;gap:8px">
          <button class="btn-small" id="fCancelBtn" type="button">Cancelar</button>
          <button class="btn-primary" id="fConfirmBtn" type="button" style="background:var(--danger);border-color:var(--danger)">Excluir</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.style.display = 'flex');

    const close = (result) => { overlay.remove(); resolve(result); };
    overlay.querySelector('#fCancelBtn').onclick = () => close(false);
    overlay.querySelector('#fConfirmBtn').onclick = () => close(true);
    overlay.onclick = (e) => { if (e.target === overlay) close(false); };
  });
}

function statusFerias(data_inicio, data_fim) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const inicio = new Date(data_inicio + 'T00:00:00');
  const fim = new Date(data_fim + 'T00:00:00');
  if (hoje > fim) return { label: 'Completas', color: 'var(--text-muted)', bg: 'transparent', border: 'var(--border)' };
  if (hoje >= inicio && hoje <= fim) return { label: 'Ativa', color: '#fff', bg: '#22c55e', border: '#22c55e' };
  return { label: 'Agendada', color: '#fff', bg: '#3b82f6', border: '#3b82f6' };
}

let filtroStatus = 'todas';

function statusLabel(data_inicio, data_fim) {
  return statusFerias(data_inicio, data_fim).label;
}

function acharIdsDuplicados(lista) {
  const duplicados = new Set();
  for (let i = 0; i < lista.length; i++) {
    for (let j = i + 1; j < lista.length; j++) {
      const a = lista[i], b = lista[j];
      if (a.colaborador !== b.colaborador) continue;
      if (a.data_inicio <= b.data_fim && a.data_fim >= b.data_inicio) {
        duplicados.add(String(a.id));
        duplicados.add(String(b.id));
      }
    }
  }
  return duplicados;
}

async function resolverDuplicatas() {
  const saved = JSON.parse(localStorage.getItem(FERIAS_LOCAL_KEY) || '[]');
  const idsDuplicados = acharIdsDuplicados(saved);
  if (!idsDuplicados.size) return;

  const dups = saved.filter(f => idsDuplicados.has(String(f.id)));
  const ok = await feriasConfirmModalGeral(`Deletar duplicatas`, `Serão excluídos ${idsDuplicados.size} registro(s) sobrepostos, mantendo apenas o período mais longo de cada colaborador. Deseja continuar?`);
  if (!ok) return;

  const grupos = [];
  const visitados = new Set();
  for (const f of saved) {
    if (!idsDuplicados.has(String(f.id)) || visitados.has(String(f.id))) continue;
    const grupo = [f];
    visitados.add(String(f.id));
    for (const g of saved) {
      if (String(g.id) === String(f.id) || !idsDuplicados.has(String(g.id)) || visitados.has(String(g.id))) continue;
      if (g.colaborador !== f.colaborador) continue;
      if (g.data_inicio <= f.data_fim && g.data_fim >= f.data_inicio) {
        grupo.push(g);
        visitados.add(String(g.id));
      }
    }
    grupos.push(grupo);
  }

  let deletados = 0;
  for (const grupo of grupos) {
    grupo.sort((a, b) => {
      const diasA = (new Date(a.data_fim) - new Date(a.data_inicio));
      const diasB = (new Date(b.data_fim) - new Date(b.data_inicio));
      return diasB - diasA;
    });
    const manter = grupo[0];
    for (const item of grupo) {
      if (String(item.id) === String(manter.id)) continue;
      await dbFeriasDelete(item.id);
      deletados++;
    }
  }

  showToast(`${deletados} duplicata(s) removida(s)!`, 'success', 'Férias');
  renderFerias('feriasOverlayContent');
}

function feriasConfirmModalGeral(titulo, msg) {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'mt-modal-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.5);backdrop-filter:blur(4px);z-index:200;display:none;align-items:center;justify-content:center;padding:20px';
    overlay.innerHTML = `
      <div style="width:100%;max-width:420px;background:var(--bg-surface,#fff);border:1px solid var(--border,#e2e8f0);border-radius:var(--r-xl,12px);box-shadow:var(--shadow-lg,0 12px 40px rgba(0,0,0,0.12));padding:24px;position:relative">
        <h3 style="font-size:18px;font-weight:600;color:var(--text-strong);margin:0 0 12px">${escapeHtml(titulo)}</h3>
        <p style="color:var(--text-secondary);font-size:14px;line-height:1.5;margin:0 0 20px">${escapeHtml(msg)}</p>
        <div style="display:flex;justify-content:flex-end;gap:8px">
          <button class="btn-small" id="fGenCancel" type="button">Cancelar</button>
          <button class="btn-primary" id="fGenConfirm" type="button" style="background:var(--danger);border-color:var(--danger)">Confirmar</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.style.display = 'flex');
    const close = (r) => { overlay.remove(); resolve(r); };
    overlay.querySelector('#fGenCancel').onclick = () => close(false);
    overlay.querySelector('#fGenConfirm').onclick = () => close(true);
    overlay.onclick = (e) => { if (e.target === overlay) close(false); };
  });
}

function exportFeriasCSV(saved) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const linhas = [['Colaborador', 'Data Início', 'Data Fim', 'Dias', 'Status']];
  for (const f of saved) {
    const inicio = new Date(f.data_inicio + 'T00:00:00');
    const fim = new Date(f.data_fim + 'T00:00:00');
    const dias = Math.round((fim - inicio) / (1000 * 60 * 60 * 24)) + 1;
    const st = statusFerias(f.data_inicio, f.data_fim);
    linhas.push([f.colaborador, f.data_inicio, f.data_fim, String(dias), st.label]);
  }
  const csv = linhas.map(l => l.map(c => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ferias_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function renderFerias(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const saved = JSON.parse(localStorage.getItem(FERIAS_LOCAL_KEY) || '[]');
  const colabs = [...new Set((rawRecords || [])
    .filter(r => r && r['Atendente'] && !isAggregateName(r['Atendente']) && isColabActive(r['Atendente']))
    .map(r => r['Atendente']))].sort();

  let html = '';

  html += '<div class="card" style="margin-bottom:var(--s-4)">';
  html += '<div class="card-header">';
  html += '<div><h3 style="font-size:16px;font-weight:600">Registrar Férias</h3>';
  html += '<p style="font-size:13px;color:var(--text-secondary)">Registre o período de férias de um colaborador</p></div>';
  html += '</div>';

  html += '<div class="ausencias-form">';
  html += '<div class="ausencias-field">';
  html += '<label>Colaborador</label>';
  html += `<select id="feriasColabInput" style="width:100%"><option value="">Selecione...</option>`;
  for (const c of colabs) {
    html += `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`;
  }
  html += '</select>';
  html += '</div>';

  html += '<div class="ausencias-field">';
  html += '<label>Data de início</label>';
  html += `<input type="date" id="feriasInicioInput" style="width:100%">`;
  html += '</div>';

  html += '<div class="ausencias-field">';
  html += '<label>Data de fim</label>';
  html += `<input type="date" id="feriasFimInput" style="width:100%">`;
  html += '</div>';

  html += '<div class="ausencias-actions">';
  html += '<button class="btn-primary" id="feriasSalvarBtn" type="button" style="justify-content:center">Registrar Férias</button>';
  html += '</div>';
  html += '</div>';
  html += '</div>';

  html += '<div class="card">';
  html += '<div class="card-header">';
  html += '<div><h3 style="font-size:16px;font-weight:600">Férias Registradas</h3>';
  html += `<p style="font-size:13px;color:var(--text-secondary)">${saved.length} registro(s)</p></div>`;
  html += '<div style="display:flex;gap:var(--s-2)">';
  if (saved.length > 0) {
    html += '<button class="btn-small" id="feriasExportBtn" type="button">Exportar CSV</button>';
    html += '<button class="btn-small" id="feriasRefreshBtn" type="button">Atualizar</button>';
  }
  html += '</div>';
  html += '</div>';

  const idsDuplicados = acharIdsDuplicados(saved);

  const filtrados = filtroStatus === 'todas'
    ? saved
    : saved.filter(f => statusLabel(f.data_inicio, f.data_fim) === filtroStatus);

  if (!saved.length) {
    html += '<div class="empty-state" style="padding:var(--s-5)"><div class="empty-title">Nenhum registro</div><div class="empty-sub">Registre as primeiras férias acima.</div></div>';
  } else {
    html += '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:var(--s-3)">';
    const statusOpts = [
      { key: 'todas', label: `Todas (${saved.length})` },
      { key: 'Ativa', label: `Ativa` },
      { key: 'Agendada', label: `Agendada` },
      { key: 'Completas', label: `Completas` },
    ];
    const statusCores = { Ativa: 'var(--success)', Agendada: 'var(--info)', Completas: 'var(--text-muted)' };
    statusOpts.forEach(({ key, label }) => {
      const ativo = filtroStatus === key;
      const cor = statusCores[key] || 'var(--text-secondary)';
      html += `<button class="ferias-status-btn" data-status="${key}" style="display:inline-flex;align-items:center;gap:4px;padding:5px 12px;font-size:12px;font-weight:600;border:1.5px solid ${ativo ? cor : 'var(--border)'};border-radius:16px;background:${ativo ? 'var(--bg-subtle)' : 'var(--bg-surface)'};color:${ativo ? cor : 'var(--text-secondary)'};cursor:pointer;transition:all 0.15s">${label}</button>`;
    });
    html += '</div>';

    if (idsDuplicados.size > 0) {
      html += `<div style="padding:10px 14px;margin-bottom:var(--s-3);background:var(--danger-soft,#fee2e2);border:1px solid var(--danger,#b91c1c);border-radius:var(--r-md,8px);color:var(--danger,#b91c1c);font-size:13px;font-weight:600;display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap"><span style="display:flex;align-items:center;gap:8px"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> ${idsDuplicados.size} registro(s) sobrepostos</span><button class="btn-small" id="feriasResolveDupBtn" type="button" style="border-color:var(--danger);color:var(--danger);font-weight:600"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg> Deletar duplicatas</button></div>`;
    }
    html += '<div class="ausencias-list">';
    for (const f of filtrados) {
      const inicio = new Date(f.data_inicio + 'T00:00:00');
      const fim = new Date(f.data_fim + 'T00:00:00');
      const dias = Math.round((fim - inicio) / (1000 * 60 * 60 * 24)) + 1;
      const st = statusFerias(f.data_inicio, f.data_fim);
      const isDup = idsDuplicados.has(String(f.id));
      html += `<div class="ausencias-item" style="${isDup ? 'border-left:3px solid var(--danger,#b91c1c);background:var(--danger-soft,#fee2e2)' : ''}">`;
      html += '<div class="ausencias-item-info">';
      html += '<div style="display:flex;align-items:center;gap:var(--s-2);flex-wrap:wrap">';
      html += `<strong style="font-size:14px">${escapeHtml(f.colaborador)}</strong>`;
      if (isDup) {
        html += `<span style="display:inline-flex;align-items:center;gap:3px;font-size:10px;font-weight:700;padding:2px 7px;border-radius:999px;color:#fff;background:var(--danger,#b91c1c)"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> SOBREPOSTO</span>`;
      }
      html += `<span style="display:inline-block;font-size:11px;font-weight:600;padding:2px 8px;border-radius:999px;color:${st.color};background:${st.bg};border:1px solid ${st.border}">${st.label}</span>`;
      html += '</div>';
      html += `<span style="font-size:12px;color:var(--text-muted)">${formatarDataBr(f.data_inicio)} → ${formatarDataBr(f.data_fim)} · ${dias} dia(s)</span>`;
      html += '</div>';
      html += '<div class="ausencias-item-actions">';
      html += `<button class="btn-small ferias-del-btn" data-id="${escapeHtml(f.id)}" type="button" style="color:var(--danger)">Excluir</button>`;
      html += '</div></div>';
    }
    html += '</div>';
  }
  html += '</div>';

  container.innerHTML = html;
  bindFeriasEvents(containerId, saved);
}

function bindFeriasEvents(containerId, saved) {
  document.getElementById('feriasSalvarBtn')?.addEventListener('click', async () => {
    if (!requireAdmin()) return;
    const colaborador = document.getElementById('feriasColabInput').value;
    const data_inicio = document.getElementById('feriasInicioInput').value;
    const data_fim = document.getElementById('feriasFimInput').value;
    if (!colaborador || !data_inicio || !data_fim) {
      showToast('Preencha colaborador, data de início e fim.', 'error', 'Férias');
      return;
    }
    if (data_fim < data_inicio) {
      showToast('Data de fim não pode ser anterior à data de início.', 'error', 'Férias');
      return;
    }
    if (temFeriasSobrepostas(colaborador, data_inicio, data_fim)) {
      showToast(`${colaborador} já possui férias neste período!`, 'error', 'Férias');
      return;
    }
    const item = {
      id: Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6),
      colaborador,
      data_inicio,
      data_fim
    };
    await dbFeriasSave(item);
    document.getElementById('feriasInicioInput').value = '';
    document.getElementById('feriasFimInput').value = '';
    showToast(`Férias registradas para ${colaborador}!`, 'success', 'Férias');
    renderFerias(containerId);
  });

  document.getElementById('feriasExportBtn')?.addEventListener('click', () => {
    exportFeriasCSV(saved);
  });

  document.getElementById('feriasResolveDupBtn')?.addEventListener('click', resolverDuplicatas);

  const fContainer = document.getElementById(containerId);
  if (fContainer) {
    fContainer.querySelectorAll('.ferias-status-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        filtroStatus = btn.dataset.status;
        renderFerias(containerId);
      });
    });
    fContainer.querySelectorAll('.ferias-del-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!requireAdmin()) return;
        const id = btn.dataset.id;
        const f = saved.find(x => String(x.id) === id);
        if (!f) return;
        const ok = await feriasConfirmModal(f.colaborador, formatarDataBr(f.data_inicio), formatarDataBr(f.data_fim));
        if (!ok) return;
        await dbFeriasDelete(id);
        renderFerias(containerId);
      });
    });
  }
}

function openFeriasOverlay() {
  const overlay = document.getElementById('feriasOverlay');
  if (!overlay) return;
  const content = document.getElementById('feriasOverlayContent');
  if (!content) return;
  content.innerHTML = '<div class="card" style="padding:var(--s-5)"><div class="skeleton skeleton-title"></div><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line"></div></div>';
  overlay.classList.add('open');
  setTimeout(() => renderFerias('feriasOverlayContent'), 50);
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('feriasBtn')?.addEventListener('click', openFeriasOverlay);
  document.getElementById('feriasOverlayClose')?.addEventListener('click', () => {
    document.getElementById('feriasOverlay')?.classList.remove('open');
  });
  const overlay = document.getElementById('feriasOverlay');
  overlay?.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.classList.remove('open');
  });
});
