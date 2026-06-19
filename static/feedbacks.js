// feedbacks.js — Geração e registro de feedbacks por colaborador

// ─── Helpers ────────────────────────────────────────────────────

function _fbData() {
  return typeof globalFilters !== 'undefined' && globalFilters
    ? globalFilters.aplicar(rawRecords)
    : (rawRecords || []);
}

function _uniqueMonths(data) {
  return [...new Set(data.filter(r => r && r['Mês']).map(r => r['Mês']))].sort();
}

function _uniqueColabs(data) {
  const all = [...new Set(data.filter(r => r && r['Atendente'] && !isAggregateName(r['Atendente']) && isColabActive(r['Atendente'])).map(r => r['Atendente']))].sort();
  return all;
}

function _sum(arr, key) {
  return arr.reduce((s, r) => s + (parseFloat(r[key]) || 0), 0);
}

function _avg(arr, key) {
  if (!arr.length) return 0;
  return _sum(arr, key) / arr.length;
}

function _median(arr, key) {
  if (!arr.length) return 0;
  const vals = arr.map(r => parseFloat(r[key]) || 0).sort((a, b) => a - b);
  const mid = Math.floor(vals.length / 2);
  return vals.length % 2 ? vals[mid] : (vals[mid - 1] + vals[mid]) / 2;
}

function _pct(val, total) {
  if (!total) return '0%';
  return (val / total * 100).toFixed(1) + '%';
}

function _trend(records, colaborador, key, months) {
  const sorted = [...months].sort();
  if (sorted.length < 2) return 'estavel';
  const vals = sorted.map(m => {
    const r = records.filter(r => r['Atendente'] === colaborador && r['Mês'] === m);
    return _avg(r, key);
  }).filter(v => v > 0);
  if (vals.length < 2) return 'estavel';
  const first = vals[0];
  const last = vals[vals.length - 1];
  const change = last - first;
  if (change > first * 0.1) return 'crescendo';
  if (change < -first * 0.1) return 'caindo';
  return 'estavel';
}

function _rating(valor, type) {
  if (type === 'finalizados' || type === 'assumidos') {
    if (valor >= 150) return { stars: 3, label: 'Excelente' };
    if (valor >= 100) return { stars: 2, label: 'Bom' };
    if (valor >= 50) return { stars: 1, label: 'Regular' };
    return { stars: 0, label: 'Atenção' };
  }
  if (type === 'score') {
    if (valor >= 4.0) return { stars: 3, label: 'Excelente' };
    if (valor >= 3.5) return { stars: 2, label: 'Bom' };
    if (valor >= 2.5) return { stars: 1, label: 'Regular' };
    return { stars: 0, label: 'Atenção' };
  }
  if (type === 'transferidos') {
    if (valor <= 5) return { stars: 3, label: 'Baixo (bom)' };
    if (valor <= 15) return { stars: 2, label: 'Moderado' };
    if (valor <= 30) return { stars: 1, label: 'Elevado' };
    return { stars: 0, label: 'Muito elevado' };
  }
  return { stars: 1, label: '' };
}

function _starsHtml(n) {
  let s = '';
  for (let i = 0; i < 3; i++) s += i < n ? '⭐' : '☆';
  return s;
}

// ─── Geração de sugestão ────────────────────────────────────────

function gerarSugestaoFeedback(colaborador, mes) {
  const data = _fbData();
  let records = data.filter(r => r && r['Atendente'] === colaborador);
  if (mes && mes !== 'all') records = records.filter(r => r['Mês'] === mes);

  if (!records.length) {
    return 'Nenhum dado encontrado para o colaborador no período selecionado.';
  }

  const totalFin = _sum(records, 'Finalizados');
  const totalAss = _sum(records, 'Assumidos');
  const totalTrans = _sum(records, 'Transferidos');
  const scores = records.map(r => parseFloat(r['SCORE'])).filter(s => s != null && !isNaN(s));
  const avgScore = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

  const teamRecords = mes && mes !== 'all' ? data.filter(r => r['Mês'] === mes) : data;
  const teamFin = _avg(teamRecords, 'Finalizados');
  const teamAss = _avg(teamRecords, 'Assumidos');
  const teamTrans = _avg(teamRecords, 'Transferidos');
  const teamScores = teamRecords.map(r => parseFloat(r['SCORE'])).filter(s => s != null && !isNaN(s));
  const teamAvgScore = teamScores.length ? teamScores.reduce((a, b) => a + b, 0) / teamScores.length : 0;

  const months = _uniqueMonths(data);
  const trendFin = _trend(data, colaborador, 'Finalizados', months);
  const trendScore = _trend(data, colaborador, 'SCORE', months);

  const ratingFin = _rating(totalFin, 'finalizados');
  const ratingScore = _rating(avgScore, 'score');
  const ratingTrans = _rating(totalTrans, 'transferidos');

  let lines = [];
  lines.push('**📋 SUGESTÃO DE FEEDBACK**\n');

  const periodLabel = mes && mes !== 'all' ? mes : 'todo período';
  lines.push(`Colaborador: **${colaborador}**`);
  lines.push(`Período: ${periodLabel}`);
  lines.push('');

  lines.push('**📊 DESEMPENHO QUANTITATIVO**');
  lines.push(`Finalizações: **${totalFin}** ${_starsHtml(ratingFin.stars)} (${ratingFin.label})`);
  lines.push(`Assumidos: **${totalAss}**`);
  lines.push(`Transferidos: **${totalTrans}** ${_starsHtml(ratingTrans.stars)} (${ratingTrans.label})`);
  if (scores.length) {
    lines.push(`Score médio: **${avgScore.toFixed(2)}** ${_starsHtml(ratingScore.stars)} (${ratingScore.label})`);
  }
  lines.push('');

  lines.push('**📈 COMPARATIVO COM A EQUIPE**');
  lines.push(`Finalizações: ${totalFin} vs média da equipe ${teamFin.toFixed(1)} (${totalFin >= teamFin ? '✅ Acima' : '📈 Abaixo'})`);
  lines.push(`Score: ${avgScore.toFixed(2)} vs média ${teamAvgScore.toFixed(2)} (${avgScore >= teamAvgScore ? '✅ Acima' : '📈 Abaixo'})`);
  lines.push(`Transferidos: ${totalTrans} vs média ${teamTrans.toFixed(1)} (${totalTrans <= teamTrans ? '✅ Menor' : '⚠️ Maior'})`);
  lines.push('');

  lines.push('**📉 TENDÊNCIA**');
  lines.push(`Finalizações: ${trendFin === 'crescendo' ? '📈 Crescendo' : trendFin === 'caindo' ? '📉 Caindo' : '➡️ Estável'}`);
  lines.push(`Score: ${trendScore === 'crescendo' ? '📈 Crescendo' : trendScore === 'caindo' ? '📉 Caindo' : '➡️ Estável'}`);
  lines.push('');

  lines.push('**💡 PONTOS FORTES**');
  const fortes = [];
  if (ratingFin.stars >= 2) fortes.push('✅ Bom volume de finalizações');
  if (ratingScore.stars >= 2) fortes.push('✅ Score acima da média');
  if (ratingTrans.stars >= 2) fortes.push('✅ Baixo índice de transferências');
  if (trendFin === 'crescendo') fortes.push('✅ Evolução positiva nas finalizações');
  if (trendScore === 'crescendo') fortes.push('✅ Evolução positiva no score');
  lines.push(fortes.length ? fortes.join('\n') : '—');
  lines.push('');

  lines.push('**🔧 OPORTUNIDADES DE MELHORIA**');
  const oportunidades = [];
  if (ratingFin.stars < 2) oportunidades.push('📌 Buscar aumentar o volume de finalizações');
  if (ratingScore.stars < 2) oportunidades.push('📌 Focar na qualidade do atendimento para elevar o score');
  if (ratingTrans.stars < 2) oportunidades.push('📌 Reduzir a taxa de transferência de chamados');
  if (trendFin === 'caindo') oportunidades.push('📌 Reverter a tendência de queda nas finalizações');
  if (trendScore === 'caindo') oportunidades.push('📌 Reverter a tendência de queda no score');
  lines.push(oportunidades.length ? oportunidades.join('\n') : '✅ Mantenha o bom trabalho!');
  lines.push('');

  if (avgScore >= 4.5) {
    lines.push('🏆 Destaque: Score excelente! Continue sendo referência para a equipe.');
  }
  if (totalFin >= 200) {
    lines.push('🏆 Destaque: Volume de finalizações excepcional!');
  }

  return lines.join('\n');
}

// ─── Render ──────────────────────────────────────────────────────

const FB_EDITING_KEY = 'sistema_feedback_editando_v1';

function renderFeedbacks() {
  const container = document.getElementById('feedbacksContent');
  if (!container) return;

  const data = _fbData();
  if (!data || !data.length) {
    container.innerHTML = '<div class="empty-state"><div class="empty-title">Nenhum dado disponível</div><div class="empty-sub">Importe um CSV para começar.</div></div>';
    return;
  }

  const colabs = _uniqueColabs(data);
  const meses = _uniqueMonths(data);
  const saved = JSON.parse(localStorage.getItem(FEEDBACKS_LOCAL_KEY) || '[]');

  const editingRaw = localStorage.getItem(FB_EDITING_KEY);
  const editing = editingRaw ? JSON.parse(editingRaw) : null;

  let html = '';

  // ── Formulário ──
  html += '<div class="card" style="margin-bottom:var(--s-5)">';
  html += '<div style="margin-bottom:var(--s-4)">';
  html += '<h3 style="font-size:15px;font-weight:600;margin-bottom:4px">✏️ Novo Feedback</h3>';
  html += '<p style="font-size:13px;color:var(--text-secondary)">Selecione colaborador e período, gere uma sugestão e personalize.</p>';
  html += '</div>';

  html += '<div style="display:flex;gap:var(--s-3);flex-wrap:wrap;margin-bottom:var(--s-4)">';
  html += '<label class="field" style="flex:1;min-width:180px">';
  html += '<span>Colaborador</span>';
  html += `<select id="fbColabSelect"><option value="">Selecionar...</option>`;
  html += colabs.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
  html += '</select></label>';

  html += '<label class="field" style="flex:1;min-width:160px">';
  html += '<span>Período</span>';
  html += `<select id="fbMesSelect"><option value="all">Todos os meses</option>`;
  html += meses.map(m => `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`).join('');
  html += '</select></label>';

  html += '<div style="display:flex;align-items:flex-end">';
  html += '<button class="btn-primary" id="fbGerarBtn" type="button" disabled>✨ Gerar Sugestão</button>';
  html += '</div></div>';

  // Sugestão gerada
  html += '<div id="fbSugestaoArea" style="margin-bottom:var(--s-3)">';
  if (editing && editing.sugestao_automatica) {
    html += '<div class="field"><span>Sugestão Automática</span>';
    html += `<textarea id="fbSugestaoTexto" style="width:100%;min-height:180px;font-size:13px;line-height:1.6;white-space:pre-wrap">${escapeHtml(editing.sugestao_automatica)}</textarea></div>`;
  } else {
    html += '<div class="empty-state" style="padding:var(--s-4);font-size:13px">Selecione um colaborador e clique em "Gerar Sugestão".</div>';
  }
  html += '</div>';

  // Anotações
  html += '<div class="field" style="margin-bottom:var(--s-3)">';
  html += '<span>Suas Anotações</span>';
  html += `<textarea id="fbAnotacoesTexto" style="width:100%;min-height:100px;font-size:13px;line-height:1.6" placeholder="Adicione suas observações, pontos discutidos, plano de ação...">${editing ? escapeHtml(editing.anotacoes || '') : ''}</textarea>`;
  html += '</div>';

  // Feedback final
  html += '<div class="field" style="margin-bottom:var(--s-3)">';
  html += '<span>Feedback Final (editável)</span>';
  html += `<textarea id="fbFinalTexto" style="width:100%;min-height:120px;font-size:13px;line-height:1.6" placeholder="O feedback final que será registrado. Edite a sugestão automática ou escreva do zero.">${editing ? escapeHtml(editing.feedback_final || editing.sugestao_automatica || '') : ''}</textarea>`;
  html += '</div>';

  html += '<div style="display:flex;gap:var(--s-3)">';
  if (editing && editing.id) {
    html += `<button class="btn-primary" id="fbSalvarBtn" type="button">💾 Atualizar Feedback</button>`;
    html += `<button class="btn-small" id="fbCancelarBtn" type="button">Cancelar</button>`;
  } else {
    html += `<button class="btn-primary" id="fbSalvarBtn" type="button" disabled>💾 Salvar Feedback</button>`;
  }
  html += '</div>';
  html += '</div>';

  // ── Feedbacks Salvos ──
  html += '<div class="card">';
  html += '<div class="card-header">';
  html += '<div><h3 style="font-size:15px;font-weight:600">📋 Feedbacks Registrados</h3>';
  html += `<p style="font-size:13px;color:var(--text-secondary)">${saved.length} feedback(s) salvo(s)</p></div>`;
  if (saved.length > 0) {
    html += '<button class="btn-small" id="fbRefreshBtn" type="button">🔄 Atualizar</button>';
  }
  html += '</div>';

  if (!saved.length) {
    html += '<div class="empty-state" style="padding:var(--s-5)"><div class="empty-title">Nenhum feedback registrado</div><div class="empty-sub">Crie e salve seu primeiro feedback acima.</div></div>';
  } else {
    html += '<div style="display:flex;flex-direction:column;gap:var(--s-3)">';
    for (const fb of saved) {
      const preview = (fb.feedback_final || fb.sugestao_automatica || '').split('\n').slice(0, 4).join('\n');
      const dateStr = fb.createdAt ? new Date(fb.createdAt).toLocaleDateString('pt-BR') : '';
      html += '<div style="border:1px solid var(--border);border-radius:var(--r-md);padding:var(--s-4)">';
      html += `<div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:var(--s-2)">`;
      html += `<div><strong>${escapeHtml(fb.colaborador)}</strong> <span style="color:var(--text-muted)">· ${escapeHtml(fb.mes)}</span></div>`;
      html += `<span style="font-size:12px;color:var(--text-muted)">${dateStr}</span>`;
      html += '</div>';
      html += `<pre style="font-size:12px;color:var(--text-secondary);white-space:pre-wrap;margin:var(--s-2) 0;max-height:100px;overflow-y:auto">${escapeHtml(preview)}</pre>`;
      html += '<div style="display:flex;gap:var(--s-2);margin-top:var(--s-2)">';
      html += `<button class="btn-small fb-ver-btn" data-id="${fb.id}" type="button">👁️ Ver</button>`;
      html += `<button class="btn-small fb-editar-btn" data-id="${fb.id}" type="button">✏️ Editar</button>`;
      html += `<button class="btn-small btn-delete fb-excluir-btn" data-id="${fb.id}" type="button">🗑️ Excluir</button>`;
      html += '</div></div>';
    }
    html += '</div>';
  }
  html += '</div>';

  container.innerHTML = html;
  bindFbEvents(colabs, meses, saved);
}

// ─── Event Bindings ─────────────────────────────────────────────

function bindFbEvents(colabs, meses, saved) {
  const colabSel = document.getElementById('fbColabSelect');
  const mesSel = document.getElementById('fbMesSelect');
  const gerarBtn = document.getElementById('fbGerarBtn');
  const salvarBtn = document.getElementById('fbSalvarBtn');
  const sugerirTexto = document.getElementById('fbSugestaoTexto');
  const anotacoesTexto = document.getElementById('fbAnotacoesTexto');
  const finalTexto = document.getElementById('fbFinalTexto');

  const editingRaw = localStorage.getItem(FB_EDITING_KEY);
  const editing = editingRaw ? JSON.parse(editingRaw) : null;

  if (colabSel && mesSel && gerarBtn) {
    function updateGerarBtn() {
      gerarBtn.disabled = !colabSel.value;
    }
    colabSel.addEventListener('change', updateGerarBtn);
    mesSel.addEventListener('change', updateGerarBtn);

    gerarBtn.addEventListener('click', () => {
      const colab = colabSel.value;
      const mes = mesSel.value;
      if (!colab) return;
      const sugestao = gerarSugestaoFeedback(colab, mes);
      const fbArea = document.getElementById('fbSugestaoArea');
      if (fbArea) {
        fbArea.innerHTML = '<div class="field"><span>Sugestão Automática</span>';
        fbArea.innerHTML += `<textarea id="fbSugestaoTexto" style="width:100%;min-height:180px;font-size:13px;line-height:1.6;white-space:pre-wrap">${escapeHtml(sugestao)}</textarea></div>`;
      }
      localStorage.setItem(FB_EDITING_KEY, JSON.stringify({
        id: null,
        colaborador: colab,
        mes: mes,
        sugestao_automatica: sugestao,
        anotacoes: '',
        feedback_final: sugestao
      }));
      document.getElementById('fbFinalTexto').value = sugestao;
      document.getElementById('fbAnotacoesTexto').value = '';
      salvarBtn.disabled = false;
    });
  }

  if (anotacoesTexto) {
    anotacoesTexto.addEventListener('input', () => {
      const cur = JSON.parse(localStorage.getItem(FB_EDITING_KEY) || '{}');
      cur.anotacoes = anotacoesTexto.value;
      localStorage.setItem(FB_EDITING_KEY, JSON.stringify(cur));
    });
  }

  if (finalTexto) {
    finalTexto.addEventListener('input', () => {
      const cur = JSON.parse(localStorage.getItem(FB_EDITING_KEY) || '{}');
      cur.feedback_final = finalTexto.value;
      localStorage.setItem(FB_EDITING_KEY, JSON.stringify(cur));
    });
  }

  if (sugerirTexto) {
    sugerirTexto.addEventListener('input', () => {
      const cur = JSON.parse(localStorage.getItem(FB_EDITING_KEY) || '{}');
      cur.sugestao_automatica = sugerirTexto.value;
      localStorage.setItem(FB_EDITING_KEY, JSON.stringify(cur));
    });
  }

  if (salvarBtn) {
    salvarBtn.addEventListener('click', async () => {
      const cur = JSON.parse(localStorage.getItem(FB_EDITING_KEY) || '{}');
      if (!cur.colaborador) return;
      const final = document.getElementById('fbFinalTexto').value;
      const anotacoes = document.getElementById('fbAnotacoesTexto').value;
      const sugestao = (document.getElementById('fbSugestaoTexto') || {}).value || cur.sugestao_automatica || '';
      const fb = {
        id: cur.id || Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6),
        colaborador: cur.colaborador,
        mes: cur.mes || 'all',
        sugestao_automatica: sugestao,
        anotacoes: anotacoes,
        feedback_final: final,
        createdAt: cur.createdAt || new Date().toISOString()
      };
      await dbFeedbacksSave(fb);
      localStorage.removeItem(FB_EDITING_KEY);
      showToast('Feedback salvo com sucesso!', 'success', 'Feedbacks');
      renderFeedbacks();
    });
  }

  const cancelarBtn = document.getElementById('fbCancelarBtn');
  if (cancelarBtn) {
    cancelarBtn.addEventListener('click', () => {
      localStorage.removeItem(FB_EDITING_KEY);
      renderFeedbacks();
    });
  }

  // Saved feedbacks actions
  container.querySelectorAll('.fb-ver-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const fb = saved.find(f => f.id === id);
      if (!fb) return;
      verFeedback(fb);
    });
  });

  container.querySelectorAll('.fb-editar-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const fb = saved.find(f => f.id === id);
      if (!fb) return;
      localStorage.setItem(FB_EDITING_KEY, JSON.stringify({ ...fb, id: fb.id }));
      renderFeedbacks();
    });
  });

  container.querySelectorAll('.fb-excluir-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const fb = saved.find(f => f.id === id);
      if (!fb || !confirm(`Excluir feedback de ${fb.colaborador} (${fb.mes})?`)) return;
      await dbFeedbacksDelete(id);
      renderFeedbacks();
    });
  });

  const refreshBtn = document.getElementById('fbRefreshBtn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      if (typeof dbFeedbacksLoad === 'function') {
        dbFeedbacksLoad().then(() => renderFeedbacks());
      } else {
        renderFeedbacks();
      }
    });
  }
}

// ─── Modal de visualização ──────────────────────────────────────

function verFeedback(fb) {
  const overlay = document.getElementById('fbViewOverlay') || criarOverlay();
  const content = document.getElementById('fbViewContent');
  if (!content) return;

  const texto = fb.feedback_final || fb.sugestao_automatica || '';
  const dateStr = fb.createdAt ? new Date(fb.createdAt).toLocaleString('pt-BR') : '';

  content.innerHTML = `
    <div style="padding:var(--s-5)">
      <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:var(--s-4)">
        <div>
          <h2 style="font-size:18px;font-weight:700">💬 Feedback</h2>
          <p style="font-size:13px;color:var(--text-secondary)">${escapeHtml(fb.colaborador)} · ${escapeHtml(fb.mes)} · ${dateStr}</p>
        </div>
        <button class="btn-small" id="fbViewCloseBtn" type="button">✕ Fechar</button>
      </div>
      ${fb.anotacoes ? `<div style="margin-bottom:var(--s-3);padding:var(--s-3);background:var(--bg-subtle);border-radius:var(--r-md)"><strong style="font-size:13px">📝 Anotações:</strong><pre style="font-size:13px;white-space:pre-wrap;margin-top:var(--s-1)">${escapeHtml(fb.anotacoes)}</pre></div>` : ''}
      <pre style="font-size:13px;line-height:1.6;white-space:pre-wrap;background:var(--bg-subtle);padding:var(--s-4);border-radius:var(--r-md);max-height:60vh;overflow-y:auto">${escapeHtml(texto)}</pre>
    </div>
  `;

  overlay.classList.add('open');
  document.getElementById('fbViewCloseBtn').addEventListener('click', () => overlay.classList.remove('open'));
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.remove('open'); });
}

function criarOverlay() {
  const div = document.createElement('div');
  div.id = 'fbViewOverlay';
  div.className = 'overlay';
  div.innerHTML = '<div class="overlay-content" style="max-width:640px"><div id="fbViewContent"></div></div>';
  document.body.appendChild(div);
  return div;
}

// ─── Hook ───────────────────────────────────────────────────────

function onFeedbacksTabActivated() {
  renderFeedbacks();
}
