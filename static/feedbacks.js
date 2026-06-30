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

// ─── Geração de sugestão ────────────────────────────────────────

function gerarSugestaoFeedback(colaborador, mes, anotacoesTexto) {
  const data = _fbData();
  let records = data.filter(r => r && r['Atendente'] === colaborador);
  if (mes && mes !== 'all') records = records.filter(r => r['Mês'] === mes);

  if (!records.length) {
    return `Não encontrei seus dados no período selecionado. Pode ser que você não tenha registros ou o período esteja vazio.`;
  }

  const totalFin = _sum(records, 'Finalizados');
  const totalAss = _sum(records, 'Assumidos');
  const totalTrans = _sum(records, 'Transferidos');
  const scores = records.map(r => parseFloat(r['SCORE'])).filter(s => s != null && !isNaN(s));
  const avgScore = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

  const teamRecords = mes && mes !== 'all' ? data.filter(r => r['Mês'] === mes) : data;
  const teamFin = _avg(teamRecords, 'Finalizados');
  const teamScores = teamRecords.map(r => parseFloat(r['SCORE'])).filter(s => s != null && !isNaN(s));
  const teamAvgScore = teamScores.length ? teamScores.reduce((a, b) => a + b, 0) / teamScores.length : 0;

  const months = _uniqueMonths(data);
  const trendFin = _trend(data, colaborador, 'Finalizados', months);
  const trendScore = _trend(data, colaborador, 'SCORE', months);

  const periodLabel = mes && mes !== 'all' ? mes : 'todo período';

  let partes = [];

  // Abertura
  if (anotacoesTexto && anotacoesTexto.trim()) {
    const frases = anotacoesTexto.trim().split(/[.\n]+/).filter(Boolean);
    const notaDestaque = frases[0].trim().toLowerCase();
    partes.push(`Oi ${colaborador}, tudo bem?\n`);

    if (notaDestaque.length > 10) {
      partes.push(`Primeiro, quero reforçar o que observei: ${notaDestaque}.\n`);
    }
  } else {
    partes.push(`Oi ${colaborador}, tudo bem?\n`);
  }

  partes.push(`Vou deixar um resumo do seu desempenho no ${periodLabel}.\n`);

  // Visão geral
  let overview = `Você teve ${totalFin} finalizações e ${totalAss} atendimentos assumidos`;
  if (totalTrans > 0) overview += `, com ${totalTrans} transferências`;
  if (scores.length) overview += `. Sua média de score ficou em ${avgScore.toFixed(2)}`;
  overview += '.';
  partes.push(overview);

  // Comparação com o time
  let comparacao = '';
  const finDiff = totalFin - teamFin;
  const scoreDiff = avgScore - teamAvgScore;

  if (Math.abs(finDiff) > 0 || Math.abs(scoreDiff) > 0) {
    comparacao += 'Comparando com a média da equipe: ';
    const finComp = finDiff >= 0 ? `você ficou acima em finalizações (${totalFin} vs ${teamFin.toFixed(1)} da equipe)` : `você ficou abaixo em finalizações (${totalFin} vs ${teamFin.toFixed(1)} da equipe)`;
    const scoreComp = scoreDiff >= 0 ? `e seu score está acima da média do time (${avgScore.toFixed(2)} vs ${teamAvgScore.toFixed(2)})` : `e seu score está abaixo da média do time (${avgScore.toFixed(2)} vs ${teamAvgScore.toFixed(2)})`;
    comparacao += finComp + ', ' + scoreComp + '.';
  }
  if (comparacao) partes.push(comparacao);

  // Tendência
  let tendencia = '';
  if (trendFin || trendScore) {
    const finText = trendFin === 'crescendo' ? 'suas finalizações estão crescendo' : trendFin === 'caindo' ? 'suas finalizações estão caindo' : 'suas finalizações se mantiveram estáveis';
    const scoreText = trendScore === 'crescendo' ? 'e seu score tem evoluído positivamente' : trendScore === 'caindo' ? 'e seu score tem apresentado queda' : 'e seu score se manteve estável';
    tendencia += `Olhando a tendência, ${finText} ${scoreText}.`;
  }
  if (tendencia) partes.push(tendencia);

  partes.push('');

  // Anotações do gestor no meio do feedback
  if (anotacoesTexto && anotacoesTexto.trim()) {
    const linhas = anotacoesTexto.trim().split('\n').map(l => l.trim()).filter(Boolean);
    if (linhas.length > 1) {
      partes.push('Sobre o que acompanhamos ao longo do período:');
      linhas.slice(1).forEach(l => partes.push(`- ${l.replace(/^[-•*]\s*/, '')}`));
      partes.push('');
    }
  }

  // Pontos fortes
  const fortes = [];
  if (totalFin >= teamFin * 1.1) fortes.push('seu volume de finalizações ficou acima da média, mostrando disposição e ritmo de trabalho');
  else if (totalFin >= 100) fortes.push('seu volume de finalizações foi bom');
  if (avgScore >= teamAvgScore * 1.05 && scores.length) fortes.push('seu score ficou acima da média do time, indicando qualidade consistente nos atendimentos');
  else if (avgScore >= 4.0 && scores.length) fortes.push('seu score foi elevado, demonstrando qualidade no atendimento');
  if (trendFin === 'crescendo') fortes.push('você vem evoluindo positivamente nas finalizações ao longo do tempo');
  if (trendScore === 'crescendo') fortes.push('você tem melhorado continuamente seu score, mostrando amadurecimento profissional');
  if (totalTrans === 0) fortes.push('você não fez nenhuma transferência, o que indica autonomia e segurança nos atendimentos');
  else if (totalTrans <= 3) fortes.push('você teve um baixo índice de transferências, sinal de segurança');
  if (totalAss > 0 && totalFin / totalAss >= 0.8) fortes.push('você teve uma boa taxa de conclusão dos atendimentos que assumiu');

  if (fortes.length) {
    partes.push('Pontos fortes do período:');
    fortes.forEach(f => partes.push(`- ${f}`));
    partes.push('');
  }

  // Oportunidades de melhoria
  const oport = [];
  if (totalFin < teamFin * 0.8) oport.push('seu volume de finalizações ficou abaixo da média — vale observarmos se há gargalos ou se você precisa de mais suporte');
  else if (totalFin < 50) oport.push('tente aumentar seu volume de finalizações, se possível');
  if (avgScore < teamAvgScore * 0.95 && scores.length) oport.push('seu score ficou abaixo da média do time — vale revisar a qualidade dos atendimentos para identificar pontos de melhoria');
  else if (avgScore < 3.5 && scores.length) oport.push('foque na qualidade do atendimento para elevar seu score');
  else if (avgScore < 4.0 && scores.length) oport.push('continue atento à qualidade para seguir evoluindo seu score');
  if (trendFin === 'caindo') oport.push('a queda nas finalizações merece atenção — pode ser um sinal de desaceleração que vale investigarmos juntos');
  if (trendScore === 'caindo') oport.push('a queda no score é um ponto de alerta — vamos entender o que mudou e agir preventivamente');
  if (totalTrans > 10) oport.push('o número de transferências está alto — vale reforçar o conhecimento em alguns processos');
  else if (totalTrans > 5) oport.push('as transferências podem ser reduzidas com um pouco mais de segurança em processos específicos');

  if (oport.length) {
    partes.push('Para seguir evoluindo:');
    oport.forEach(o => partes.push(`- ${o}`));
    partes.push('');
  }

  // Fechamento
  let fechamento = '';
  if (fortes.length >= 3 && oport.length <= 1) {
    fechamento = 'No geral, seu desempenho está bem positivo. É manter o que vem dando certo e seguir ajustando os detalhes.';
  } else if (fortes.length >= 2) {
    fechamento = 'Resumo: você tem pontos fortes claros e algumas oportunidades pontuais de melhoria. Com os ajustes certos, a tendência é evoluir ainda mais.';
  } else if (oport.length >= 3) {
    fechamento = 'O momento pede atenção a algumas áreas. Com foco e suporte, tenho certeza que dá para reverter o cenário e voltar a crescer.';
  } else {
    fechamento = 'Segue o trabalho que estou aqui junto com você!';
  }

  if (avgScore >= 4.5) {
    fechamento += ' Destaque especial para seu score excelente — você é um exemplo para a equipe!';
  }
  if (totalFin >= 200) {
    fechamento += ' E seu volume de finalizações foi realmente excepcional, parabéns!';
  }

  partes.push(fechamento);

  return partes.join('\n');
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

  // ── Split layout: form (left) + saved list (right) ──
  const filtroColab = sessionStorage.getItem('fb_filtro_colab') || '';
  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--s-5);align-items:start">';

  // ── LEFT: Formulário ──
  html += '<div class="card">';
  html += '<div style="margin-bottom:var(--s-4)">';
  html += '<h3 style="font-size:15px;font-weight:600;margin-bottom:4px">✏️ Feedback</h3>';
  html += '<p style="font-size:13px;color:var(--text-secondary)">Selecione colaborador e período, gere uma sugestão e personalize.</p>';
  html += '</div>';

  html += '<div style="display:flex;gap:var(--s-3);flex-wrap:wrap;margin-bottom:var(--s-4)">';
  html += '<label class="field" style="flex:1;min-width:140px">';
  html += '<span>Colaborador</span>';
  html += `<select id="fbColabSelect"><option value="">Selecionar...</option>`;
  html += colabs.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
  html += '</select></label>';

  html += '<label class="field" style="flex:1;min-width:130px">';
  html += '<span>Período</span>';
  html += `<select id="fbMesSelect"><option value="all">Todos</option>`;
  html += meses.map(m => `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`).join('');
  html += '</select></label>';

  html += '<div style="display:flex;align-items:flex-end">';
  html += '<button class="btn-primary" id="fbGerarBtn" type="button" disabled>✨ Gerar</button>';
  html += '</div></div>';

  // Sugestão gerada
  html += '<div id="fbSugestaoArea" style="margin-bottom:var(--s-3)">';
  if (editing && editing.sugestao_automatica) {
    html += '<div class="field"><span>Sugestão</span>';
    html += `<textarea id="fbSugestaoTexto" style="width:100%;min-height:160px;font-size:12px;line-height:1.5;white-space:pre-wrap">${escapeHtml(editing.sugestao_automatica)}</textarea></div>`;
  } else {
    html += '<div class="empty-state" style="padding:var(--s-3);font-size:12px">Selecione um colaborador e gere a sugestão.</div>';
  }
  html += '</div>';

  // Anotações
  html += '<div class="field" style="margin-bottom:var(--s-2)">';
  html += '<span>Anotações</span>';
  html += `<textarea id="fbAnotacoesTexto" style="width:100%;min-height:70px;font-size:12px;line-height:1.5" placeholder="Observações, pontos discutidos...">${editing ? escapeHtml(editing.anotacoes || '') : ''}</textarea>`;
  html += '</div>';

  // Feedback final
  html += '<div class="field" style="margin-bottom:var(--s-3)">';
  html += '<span>Feedback Final</span>';
  html += `<textarea id="fbFinalTexto" style="width:100%;min-height:100px;font-size:12px;line-height:1.5" placeholder="Feedback final registrado.">${editing ? escapeHtml(editing.feedback_final || editing.sugestao_automatica || '') : ''}</textarea>`;
  html += '</div>';

  html += '<div style="display:flex;gap:var(--s-3)">';
  if (editing && editing.id) {
    html += `<button class="btn-primary" id="fbSalvarBtn" type="button">💾 Atualizar</button>`;
    html += `<button class="btn-small" id="fbCancelarBtn" type="button">Cancelar</button>`;
  } else {
    html += `<button class="btn-primary" id="fbSalvarBtn" type="button" disabled>💾 Salvar</button>`;
  }
  html += '</div>';
  html += '</div>';

  // ── RIGHT: Feedbacks Salvos ──
  html += '<div class="card">';
  html += '<div class="card-header">';
  html += '<div><h3 style="font-size:15px;font-weight:600">📋 Feedbacks Salvos</h3>';
  html += `<p style="font-size:13px;color:var(--text-secondary)">${saved.length} registro(s)</p></div>`;
  html += '<div style="display:flex;gap:var(--s-2);align-items:center">';
  html += `<input type="text" id="fbFiltroColab" placeholder="Filtrar por colaborador..." value="${escapeHtml(filtroColab)}" style="font-size:12px;padding:4px 8px;border:1px solid var(--border);border-radius:var(--r-sm);background:var(--bg-card);color:var(--text);width:140px">`;
  html += '<button class="btn-small" id="fbRefreshBtn" type="button">🔄</button>';
  html += '</div></div>';

  const filtered = filtroColab ? saved.filter(fb => fb.colaborador.toLowerCase().includes(filtroColab.toLowerCase())) : saved;

  if (!filtered.length) {
    html += '<div class="empty-state" style="padding:var(--s-4)"><div class="empty-title">Nenhum feedback</div><div class="empty-sub">Crie e salve ao lado.</div></div>';
  } else {
    html += '<div style="display:flex;flex-direction:column;gap:var(--s-2);max-height:65vh;overflow-y:auto">';
    for (const fb of filtered) {
      const preview = (fb.feedback_final || fb.sugestao_automatica || '').split('\n').slice(0, 3).join('\n');
      const dateStr = fb.createdAt ? new Date(fb.createdAt).toLocaleDateString('pt-BR') : '';
      html += '<div style="border:1px solid var(--border);border-radius:var(--r-md);padding:var(--s-3)">';
      html += `<div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:var(--s-1)">`;
      html += `<div style="font-size:13px"><strong>${escapeHtml(fb.colaborador)}</strong> <span style="color:var(--text-muted)">· ${escapeHtml(fb.mes)}</span></div>`;
      html += `<span style="font-size:11px;color:var(--text-muted)">${dateStr}</span>`;
      html += '</div>';
      html += `<pre style="font-size:11px;color:var(--text-secondary);white-space:pre-wrap;margin:var(--s-1) 0;max-height:60px;overflow-y:auto">${escapeHtml(preview)}</pre>`;
      html += '<div style="display:flex;gap:var(--s-1);margin-top:var(--s-1)">';
      html += `<button class="btn-small fb-ver-btn" data-id="${fb.id}" type="button">👁️</button>`;
      html += `<button class="btn-small fb-editar-btn" data-id="${fb.id}" type="button">✏️</button>`;
      html += `<button class="btn-small btn-delete fb-excluir-btn" data-id="${fb.id}" type="button">🗑️</button>`;
      html += '</div></div>';
    }
    html += '</div>';
  }
  html += '</div>';

  html += '</div>'; // fecha grid

  container.innerHTML = html;
  bindFbEvents(colabs, meses, saved);
}

// ─── Event Bindings ─────────────────────────────────────────────

function bindFbEvents(colabs, meses, saved) {
  const container = document.getElementById('feedbacksContent');
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
      const anotacoesAtuais = document.getElementById('fbAnotacoesTexto')?.value || '';
      const sugestao = gerarSugestaoFeedback(colab, mes, anotacoesAtuais);
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
        anotacoes: anotacoesAtuais,
        feedback_final: sugestao
      }));
      document.getElementById('fbFinalTexto').value = sugestao;
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
      if (typeof setLoading === 'function') setLoading(true, 'Salvando feedback…');
      try {
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
      } finally {
        if (typeof setLoading === 'function') setLoading(false);
      }
    });
  }

  const cancelarBtn = document.getElementById('fbCancelarBtn');
  if (cancelarBtn) {
    cancelarBtn.addEventListener('click', () => {
      localStorage.removeItem(FB_EDITING_KEY);
      renderFeedbacks();
    });
  }

  // Filter saved feedbacks
  const filtroInput = document.getElementById('fbFiltroColab');
  if (filtroInput) {
    filtroInput.addEventListener('input', () => {
      sessionStorage.setItem('fb_filtro_colab', filtroInput.value);
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
  const container = document.getElementById('feedbacksContent');
  if (!container) return;
  container.innerHTML = '<div class="card" style="padding:var(--s-5)"><div class="skeleton skeleton-card"></div><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line short"></div></div>';
  setTimeout(() => renderFeedbacks(), 50);
}
