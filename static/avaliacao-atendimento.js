// avaliacao-atendimento.js — Avaliação de Atendimentos (sidebar overlay)
// Campos: protocolo, colaborador (atendente), data do atendimento,
// nota do cliente (1-5, opcional), avaliação justa, orientação do caso,
// resumo e print do atendimento.

const AVAL_ATEND_FILTRO_COLAB_KEY = 'sistema_avaliacao_atend_filtro_colab_v1';
const AVAL_ATEND_FILTRO_NOTA_KEY = 'sistema_avaliacao_atend_filtro_nota_v1';

function todayISO() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function formatDataAtend(iso) {
  if (!iso) return '—';
  if (/^\d{4}-\d{2}-\d{2}/.test(iso)) {
    const [y, m, d] = iso.slice(0, 10).split('-');
    return `${d}/${m}/${y}`;
  }
  const dt = new Date(iso);
  if (isNaN(dt)) return iso;
  return dt.toLocaleDateString('pt-BR');
}

function notaBadgeHtml(a) {
  if (!a.teve_nota || a.nota == null) {
    return '<span style="font-size:11px;padding:1px 7px;border-radius:var(--r-sm);background:rgba(148,163,184,0.15);color:var(--text-secondary)">Sem nota</span>';
  }
  const cor = a.nota >= 4 ? '#10b981' : a.nota >= 3 ? '#f59e0b' : '#ef4444';
  return `<span style="font-size:11px;padding:1px 7px;border-radius:var(--r-sm);background:${cor}1f;color:${cor}">Nota: ${a.nota}</span>`;
}

function normalizeAvalAtend(a) {
  const notaNum = parseFloat(a.nota);
  const teve_nota = a.teve_nota != null ? a.teve_nota : (a.nota != null && a.nota !== '' && !isNaN(notaNum));
  return {
    id: a.id,
    protocolo: a.protocolo || '',
    colaborador: a.colaborador || '',
    data_atendimento: a.data_atendimento || '',
    teve_nota,
    nota: teve_nota && !isNaN(notaNum) ? notaNum : null,
    justa: a.justa !== false,
    resumo: a.resumo || '',
    orientacao: a.orientacao || '',
    imagem: a.imagem || '',
    createdAt: a.createdAt,
    updatedAt: a.updatedAt
  };
}

function getAvalAtendSaved() {
  try {
    return JSON.parse(localStorage.getItem(AVALIACAO_ATEND_LOCAL_KEY) || '[]').map(normalizeAvalAtend);
  } catch { return []; }
}

function renderAvaliacaoAtendimento(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const saved = getAvalAtendSaved();
  const colabs = [...new Set((rawRecords || [])
    .filter(r => r && r['Atendente'] && !isAggregateName(r['Atendente']) && isColabActive(r['Atendente']))
    .map(r => r['Atendente']))].sort();
  const filtroColab = localStorage.getItem(AVAL_ATEND_FILTRO_COLAB_KEY) || '';
  const filtroNota = localStorage.getItem(AVAL_ATEND_FILTRO_NOTA_KEY) || '';

  let html = '';

  html += '<div class="card" style="margin-bottom:var(--s-4)">';
  html += '<div class="card-header">';
  html += '<div><h3 style="font-size:16px;font-weight:600">Avaliação de Atendimentos</h3>';
  html += '<p style="font-size:13px;color:var(--text-secondary)">Registre a avaliação de um atendimento realizado</p></div>';
  html += '</div>';

  html += '<div class="ausencias-form">';
  html += '<div class="ausencias-field">';
  html += '<label>Protocolo / Ticket</label>';
  html += '<input type="text" id="avalProtocoloInput" placeholder="Ex: #12345" style="width:100%">';
  html += '</div>';

  html += '<div class="ausencias-field">';
  html += '<label>Colaborador (atendente)</label>';
  html += '<select id="avalColaboradorInput" style="width:100%"><option value="">Selecione...</option>';
  for (const c of colabs) {
    html += `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`;
  }
  html += '</select>';
  html += '</div>';

  html += '<div class="ausencias-field">';
  html += '<label>Data do atendimento</label>';
  html += `<input type="date" id="avalDataInput" value="${todayISO()}" style="width:100%">`;
  html += '</div>';

  html += '<div class="ausencias-field">';
  html += '<label>Nota do cliente (1 a 5)</label>';
  html += '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">';
  html += '<label class="checkbox-label" style="margin:0"><input type="checkbox" id="avalTeveNotaInput" checked> Cliente avaliou o atendimento</label>';
  html += '<input type="number" id="avalNotaInput" min="1" max="5" step="1" value="" placeholder="1 a 5" style="width:80px">';
  html += '</div>';
  html += '</div>';

  html += '<div class="ausencias-field">';
  html += '<label class="checkbox-label">';
  html += '<input type="checkbox" id="avalJustaInput" checked> Avaliação justa';
  html += '</label>';
  html += '</div>';

  html += '<div class="ausencias-field">';
  html += '<label>Orientação referente ao caso</label>';
  html += '<textarea id="avalOrientacaoInput" rows="2" placeholder="Ex: orientar o cliente a reenviar o documento anexo e validar o prazo de retorno..." style="width:100%;resize:vertical"></textarea>';
  html += '</div>';

  html += '<div class="ausencias-field">';
  html += '<label>Resumo do atendimento</label>';
  html += '<textarea id="avalResumoInput" rows="3" placeholder="Descreva resumidamente o atendimento..." style="width:100%;resize:vertical"></textarea>';
  html += '</div>';

  html += '<div class="ausencias-field">';
  html += '<label>Imagem / Print do atendimento</label>';
  html += '<input type="file" id="avalImagemInput" accept="image/*" style="width:100%">';
  html += '<div id="avalImagemPreview" style="margin-top:8px;max-width:100%;border-radius:var(--r-md);overflow:hidden;display:none">';
  html += '<img id="avalImagemPreviewImg" style="max-width:100%;max-height:200px;display:block;border-radius:var(--r-md)">';
  html += '<button class="btn-small" id="avalImagemRemoveBtn" type="button" style="margin-top:4px">Remover imagem</button>';
  html += '</div>';
  html += '</div>';

  html += '<div class="ausencias-actions">';
  html += '<button class="btn-primary" id="avalSalvarBtn" type="button" style="justify-content:center">Registrar Avaliação</button>';
  html += '</div>';
  html += '</div>';
  html += '</div>';

  html += '<div class="card">';
  html += '<div class="card-header">';
  html += '<div><h3 style="font-size:16px;font-weight:600">Avaliações Registradas</h3>';
  html += `<p style="font-size:13px;color:var(--text-secondary)"><span id="avalAtendCount">${saved.length}</span> registro(s)</p></div>`;
  html += '<button class="btn-small" id="avalRefreshBtn" type="button">Atualizar</button>';
  html += '</div>';

  html += '<div class="ausencias-form" style="grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:var(--s-3)">';
  html += '<div class="ausencias-field">';
  html += '<label>Filtrar atendente</label>';
  html += '<select id="avalFiltroColabInput" style="width:100%"><option value="">Todos</option>';
  for (const c of colabs) {
    html += `<option value="${escapeHtml(c)}" ${c === filtroColab ? 'selected' : ''}>${escapeHtml(c)}</option>`;
  }
  html += '</select>';
  html += '</div>';
  html += '<div class="ausencias-field">';
  html += '<label>Nota</label>';
  html += '<select id="avalFiltroNotaInput" style="width:100%">';
  html += `<option value="">Todas</option>`;
  html += `<option value="com" ${filtroNota === 'com' ? 'selected' : ''}>Com nota do cliente</option>`;
  html += `<option value="sem" ${filtroNota === 'sem' ? 'selected' : ''}>Sem nota do cliente</option>`;
  html += '</select>';
  html += '</div>';
  html += '</div>';

  html += '<div id="avalAtendLista"></div>';
  html += '</div>';

  container.innerHTML = html;
  renderAvalAtendLista(containerId);
  bindAvaliacaoAtendEvents(containerId);
}

function renderAvalAtendLista(containerId) {
  const lista = document.getElementById('avalAtendLista');
  if (!lista) return;
  const container = document.getElementById(containerId);
  const all = getAvalAtendSaved();
  const filtroColab = localStorage.getItem(AVAL_ATEND_FILTRO_COLAB_KEY) || '';
  const filtroNota = localStorage.getItem(AVAL_ATEND_FILTRO_NOTA_KEY) || '';

  let saved = all;
  if (filtroColab) saved = saved.filter(a => a.colaborador === filtroColab);
  if (filtroNota === 'com') saved = saved.filter(a => a.teve_nota);
  if (filtroNota === 'sem') saved = saved.filter(a => !a.teve_nota);
  saved.sort((a, b) => (b.data_atendimento || b.createdAt || '').localeCompare(a.data_atendimento || a.createdAt || ''));

  const countEl = document.getElementById('avalAtendCount');
  if (countEl) countEl.textContent = all.length;

  if (!saved.length) {
    lista.innerHTML = '<div class="empty-state" style="padding:var(--s-5)"><div class="empty-title">Nenhuma avaliação</div><div class="empty-sub">Registre a primeira avaliação acima ou ajuste os filtros.</div></div>';
    return;
  }

  let html = '<div class="ausencias-list">';
  for (const a of saved) {
    html += '<div class="ausencias-item" style="align-items:flex-start">';
    html += '<div class="ausencias-item-info">';
    html += `<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">`;
    html += `<strong style="font-size:14px">${escapeHtml(a.protocolo)}</strong>`;
    html += `<span style="font-size:12px;color:var(--text-muted)">${escapeHtml(a.colaborador)}</span>`;
    html += `<span style="font-size:12px;color:var(--text-muted)">${formatDataAtend(a.data_atendimento)}</span>`;
    html += notaBadgeHtml(a);
    html += `<span style="font-size:11px;color:var(--text-muted)">${a.justa ? 'Justa' : 'Injusta'}</span>`;
    html += '</div>';
    if (a.orientacao) {
      html += `<div style="font-size:12.5px;color:var(--text-secondary);margin-top:5px"><strong style="color:var(--text-strong)">Orientação:</strong> ${escapeHtml(a.orientacao)}</div>`;
    }
    if (a.resumo) {
      html += `<div style="font-size:12.5px;color:var(--text-secondary);margin-top:2px">${escapeHtml(a.resumo)}</div>`;
    }
    if (a.imagem) {
      html += `<div style="margin-top:6px"><img src="${a.imagem}" style="max-width:180px;max-height:120px;border-radius:var(--r-sm);cursor:pointer" onclick="window.open('${a.imagem}','_blank')" title="Clique para ampliar"></div>`;
    }
    html += '</div>';
    html += '<div class="ausencias-item-actions">';
    html += `<button class="btn-small aval-del-btn" data-id="${a.id}" type="button" style="color:var(--danger)">Excluir</button>`;
    html += '</div></div>';
  }
  html += '</div>';

  lista.innerHTML = html;

  if (container) {
    container.querySelectorAll('.aval-del-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!requireAdmin()) return;
        const a = all.find(x => String(x.id) === String(btn.dataset.id));
        if (!a || !confirm(`Excluir avaliação do protocolo ${a.protocolo}?`)) return;
        await dbAvaliacaoAtendDelete(a.id);
        renderAvalAtendLista(containerId);
      });
    });
  }
}

function bindAvaliacaoAtendEvents(containerId) {
  let imagemData = '';

  document.getElementById('avalImagemInput')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      imagemData = ev.target.result;
      const preview = document.getElementById('avalImagemPreview');
      const img = document.getElementById('avalImagemPreviewImg');
      if (preview && img) {
        img.src = imagemData;
        preview.style.display = 'block';
      }
    };
    reader.readAsDataURL(file);
  });

  document.getElementById('avalImagemRemoveBtn')?.addEventListener('click', () => {
    imagemData = '';
    document.getElementById('avalImagemInput').value = '';
    const preview = document.getElementById('avalImagemPreview');
    if (preview) preview.style.display = 'none';
  });

  const teveNotaInput = document.getElementById('avalTeveNotaInput');
  const notaInput = document.getElementById('avalNotaInput');
  const syncNotaDisabled = () => { if (notaInput) notaInput.disabled = !teveNotaInput.checked; };
  teveNotaInput?.addEventListener('change', syncNotaDisabled);
  syncNotaDisabled();

  document.getElementById('avalSalvarBtn')?.addEventListener('click', async () => {
    if (!requireAdmin()) return;
    const protocolo = document.getElementById('avalProtocoloInput').value.trim();
    const colaborador = document.getElementById('avalColaboradorInput').value;
    const data_atendimento = document.getElementById('avalDataInput').value.trim();
    const teve_nota = document.getElementById('avalTeveNotaInput').checked;
    const nota = parseFloat(document.getElementById('avalNotaInput').value);
    const justa = document.getElementById('avalJustaInput').checked;
    const orientacao = document.getElementById('avalOrientacaoInput').value.trim();
    const resumo = document.getElementById('avalResumoInput').value.trim();

    if (!protocolo || !colaborador) {
      showToast('Preencha protocolo e colaborador.', 'error', 'Avaliação');
      return;
    }
    if (teve_nota && (isNaN(nota) || nota < 1 || nota > 5)) {
      showToast('Informe a nota do cliente (1 a 5).', 'error', 'Avaliação');
      return;
    }

    const item = {
      id: Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6),
      protocolo,
      colaborador,
      data_atendimento,
      teve_nota,
      nota: teve_nota ? nota : null,
      justa,
      orientacao,
      resumo,
      imagem: imagemData
    };
    await dbAvaliacaoAtendSave(item);
    document.getElementById('avalProtocoloInput').value = '';
    document.getElementById('avalResumoInput').value = '';
    document.getElementById('avalOrientacaoInput').value = '';
    document.getElementById('avalNotaInput').value = '';
    document.getElementById('avalImagemInput').value = '';
    imagemData = '';
    const preview = document.getElementById('avalImagemPreview');
    if (preview) preview.style.display = 'none';
    showToast(`Avaliação registrada para ${colaborador}!`, 'success', 'Avaliação');
    renderAvalAtendLista(containerId);
  });

  document.getElementById('avalRefreshBtn')?.addEventListener('click', async () => {
    await dbAvaliacaoAtendLoad();
    renderAvalAtendLista(containerId);
    showToast('Lista atualizada.', 'success', 'Avaliação');
  });

  document.getElementById('avalFiltroColabInput')?.addEventListener('change', (e) => {
    if (e.target.value) localStorage.setItem(AVAL_ATEND_FILTRO_COLAB_KEY, e.target.value);
    else localStorage.removeItem(AVAL_ATEND_FILTRO_COLAB_KEY);
    renderAvalAtendLista(containerId);
  });

  document.getElementById('avalFiltroNotaInput')?.addEventListener('change', (e) => {
    if (e.target.value) localStorage.setItem(AVAL_ATEND_FILTRO_NOTA_KEY, e.target.value);
    else localStorage.removeItem(AVAL_ATEND_FILTRO_NOTA_KEY);
    renderAvalAtendLista(containerId);
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
