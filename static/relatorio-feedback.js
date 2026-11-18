// relatorio-feedback.js — Relatório de Feedback por colaborador (com PDF)
// Monta um relatório completo (resultados + observações + protocolos + avaliações)
// e exporta para PDF entregável ao colaborador.

const RF_CONFIG_KEY = 'sistema_relatorio_feedback_config_v1';

// ─── Métricas disponíveis ────────────────────────────────────────

const RF_METRICAS = [
  { key: 'Finalizados', label: 'Finalizados', tipo: 'soma' },
  { key: 'Assumidos', label: 'Assumidos', tipo: 'soma' },
  { key: 'Transferidos', label: 'Transferidos', tipo: 'soma' },
  { key: 'SCORE', label: 'Score', tipo: 'media', decimal: 2 },
  { key: 'Objetivo', label: 'Objetivo', tipo: 'soma' },
  { key: 'Nota1', label: 'Nota 1', tipo: 'media', decimal: 2 },
  { key: 'Nota2', label: 'Nota 2', tipo: 'media', decimal: 2 },
  { key: 'Nota3', label: 'Nota 3', tipo: 'media', decimal: 2 },
  { key: 'TMA', label: 'TMA', tipo: 'texto' },
  { key: 'TMR', label: 'TMR', tipo: 'texto' }
];

const RF_DEFAULT_METRICAS = ['Finalizados', 'Assumidos', 'Transferidos', 'SCORE'];

function rfResolveMetricas(keys) {
  return (Array.isArray(keys) ? keys : []).map(k => RF_METRICAS.find(m => m.key === k)).filter(Boolean);
}

// ─── Persistência da configuração ────────────────────────────────

function rfGetConfig() {
  try { return JSON.parse(appStorage.getItem(RF_CONFIG_KEY)) || {}; } catch { return {}; }
}
function rfSaveConfig(cfg) {
  try { appStorage.setItem(RF_CONFIG_KEY, JSON.stringify(cfg)); } catch {}
}

// ─── Dados brutos (ignora filtros globais; relatório tem seleção própria) ──

function rfRaw() {
  return (typeof rawRecords !== 'undefined' && Array.isArray(rawRecords)) ? rawRecords : [];
}

function rfMesKey(mes) {
  const s = String(mes || '');
  let m = s.match(/(\d{4})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}`;
  m = s.match(/(\d{2})[\/\-](\d{4})/);
  if (m) return `${m[2]}-${m[1]}`;
  return '';
}

function rfCalcVal(records, met) {
  if (!records.length) return null;
  if (met.tipo === 'soma') {
    return records.reduce((s, r) => s + (parseFloat(r[met.key]) || 0), 0);
  }
  if (met.tipo === 'media') {
    const vals = records.map(r => parseFloat(r[met.key])).filter(v => v !== null && v !== undefined && !isNaN(v));
    if (!vals.length) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }
  // texto: último valor não vazio
  const last = [...records].reverse().find(r => String(r[met.key] || '').trim() !== '');
  return last ? String(last[met.key]) : null;
}

function rfFmtVal(v, met) {
  if (v == null || v === '') return '—';
  if (met.tipo === 'media') return (typeof v === 'number' ? v.toFixed(met.decimal) : String(v));
  return String(v);
}

// ─── Comparação com período anterior ────────────────────────────

const RF_DELTA_INVERTIDAS = ['Transferidos', 'TMA', 'TMR'];

function rfDeltaPct(cur, prev) {
  if (cur == null || prev == null || prev === 0) return null;
  return ((cur - prev) / Math.abs(prev)) * 100;
}

function rfDeltaColor(d, key) {
  if (d === 0) return '#64748b';
  const subirEhMelhor = !RF_DELTA_INVERTIDAS.includes(key);
  const melhorou = subirEhMelhor ? d > 0 : d < 0;
  return melhorou ? '#059669' : '#dc2626';
}

function rfArrow(d) {
  return d > 0 ? '▲' : (d < 0 ? '▼' : '→');
}

function rfPrevPeriodo(colaborador, mes) {
  if (!mes || mes === 'all') return null;
  const meses = _uniqueMonths(rfRaw().filter(r => r['Atendente'] === colaborador));
  const idx = meses.indexOf(mes);
  if (idx <= 0) return null;
  const prevMes = meses[idx - 1];
  return { mes: prevMes, records: rfRaw().filter(r => r['Atendente'] === colaborador && r['Mês'] === prevMes) };
}

// ─── Coleta de dados por colaborador/período ─────────────────────

function rfRecordsColab(colaborador, mes) {
  let recs = rfRaw().filter(r => r && r['Atendente'] === colaborador);
  if (mes && mes !== 'all') recs = recs.filter(r => r['Mês'] === mes);
  return recs;
}

function rfProtocolos(colaborador, mes) {
  const all = (typeof getAvalAtendSaved === 'function') ? getAvalAtendSaved() : [];
  const mesKey = rfMesKey(mes);
  return all.filter(p => {
    if (p.colaborador !== colaborador) return false;
    if (mesKey && p.data_atendimento) {
      const pk = rfMesKey(p.data_atendimento);
      if (pk && pk !== mesKey) return false;
    }
    return true;
  });
}

function rfComentariosPeriodo(mes) {
  const map = (typeof getComentarios === 'function') ? getComentarios() : {};
  if (mes && mes !== 'all') return map[mes] || [];
  const out = [];
  Object.keys(map).forEach(m => { (map[m] || []).forEach(c => out.push({ mes: m, ...c })); });
  out.sort((a, b) => String(a.ts).localeCompare(String(b.ts)));
  return out;
}

// ─── Montagem das seções do relatório ────────────────────────────

function rfSectionHeader(colaborador, mes, opts) {
  const now = new Date();
  const periodLabel = mes && mes !== 'all' ? mes : 'Todo o período';
  const setor = opts.setor || '';
  const setorHtml = setor ? `<div class="rf-paper-sector">${escapeHtml(setor)}</div>` : '';
  return `
    <div class="rf-paper-header">
      <div class="rf-paper-eyebrow">Relatório de Feedback</div>
      <div class="rf-paper-title">${escapeHtml(colaborador)}</div>
      ${setorHtml}
      <div class="rf-paper-header-meta">Período: <strong class="rf-paper-header-value">${escapeHtml(periodLabel)}</strong></div>
      <div class="rf-paper-meta">Gerado em ${now.toLocaleString('pt-BR')}</div>
    </div>`;
}

function rfSectionKPIs(colaborador, mes, metricas, records) {
  const prev = rfPrevPeriodo(colaborador, mes);
  const cards = metricas.map(met => {
    const val = rfCalcVal(records, met);
    let cmp = '';
    if (prev && met.tipo !== 'texto') {
      const d = rfDeltaPct(val, rfCalcVal(prev.records, met));
      if (d != null) {
        cmp = `<div style="font-size:11px;font-weight:700;color:${rfDeltaColor(d, met.key)};margin-top:3px">${rfArrow(d)} ${Math.abs(d).toFixed(1).replace('.', ',')}% <span class="rf-paper-total">vs ${escapeHtml(prev.mes)}</span></div>`;
      }
    }
    return `
      <div class="rf-paper-metric">
        <div class="rf-paper-metric-label">${escapeHtml(met.label)}</div>
        <div class="rf-paper-metric-value">${rfFmtVal(val, met)}</div>
        ${cmp}
      </div>`;
  }).join('');

  return `
    <div class="rf-paper-section">
      <div class="rf-paper-section-title">📊 Resultados do período</div>
      <div class="rf-paper-metrics">${cards}</div>
    </div>`;
}

function rfSectionObservacoes(observacoes, comentarios) {
  let html = `<div class="rf-paper-section-title">📝 Observações e análises</div>`;

  if (observacoes && observacoes.trim()) {
    html += `<div class="rf-paper-warning">${escapeHtml(observacoes)}</div>`;
  }

  if (comentarios && comentarios.length) {
    html += `<div class="rf-paper-paragraph"><strong class="rf-paper-copy">Comentários do período:</strong></div>`;
    html += comentarios.map(c => `
      <div class="rf-paper-note">
        <div class="rf-paper-note-copy">${escapeHtml(c.texto)}</div>
        <div class="rf-paper-note-meta">${c.mes ? escapeHtml(c.mes) + ' · ' : ''}${escapeHtml(c.user || '')}${c.ts ? ' · ' + new Date(c.ts).toLocaleDateString('pt-BR') : ''}</div>
      </div>`).join('');
  }

  if ((!observacoes || !observacoes.trim()) && (!comentarios || !comentarios.length)) {
    html += `<div class="rf-paper-empty">Nenhuma observação registrada para o período.</div>`;
  }

  return `<div class="rf-paper-section">${html}</div>`;
}

function rfSectionProtocolos(protocolos) {
  if (!protocolos || !protocolos.length) return '';
  const rows = protocolos.map((p, i) => {
    const rowBg = i % 2 === 1 ? '#f8fafc' : '#ffffff';
    const notaBadge = (!p.teve_nota || p.nota == null)
      ? '<span class="rf-paper-caption">Sem nota</span>'
      : `<span style="font-size:12px;font-weight:700;color:${p.nota >= 4 ? '#059669' : p.nota >= 3 ? '#d97706' : '#dc2626'}">${p.nota}</span>`;
    return `
      <tr>
        <td style="background:${rowBg};padding:8px 10px;border-bottom:1px solid #e2e8f0;font-size:12px;font-weight:600;color:#0f172a">${escapeHtml(p.protocolo)}</td>
        <td style="background:${rowBg};padding:8px 10px;border-bottom:1px solid #e2e8f0;font-size:12px;color:#64748b">${escapeHtml(formatDataAtend(p.data_atendimento))}</td>
        <td style="background:${rowBg};padding:8px 10px;border-bottom:1px solid #e2e8f0;font-size:12px;color:#334155;text-align:center">${notaBadge}</td>
        <td style="background:${rowBg};padding:8px 10px;border-bottom:1px solid #e2e8f0;font-size:12px;color:#334155">${escapeHtml(p.resumo || '')}</td>
        <td style="background:${rowBg};padding:8px 10px;border-bottom:1px solid #e2e8f0;font-size:12px;color:#334155">${escapeHtml(p.orientacao || '')}</td>
      </tr>`;
  }).join('');

  return `
    <div class="rf-paper-section">
      <div class="rf-paper-section-title">🎧 Protocolos de atendimento (${protocolos.length})</div>
      <div class="rf-paper-table-wrap">
        <table class="rf-paper-table">
          <thead><tr>
            <th class="rf-paper-table-heading">Protocolo</th>
            <th class="rf-paper-table-heading">Data</th>
            <th class="rf-paper-number-heading">Nota</th>
            <th class="rf-paper-table-heading">Resumo</th>
            <th class="rf-paper-table-heading">Orientação</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
}

function rfSectionFeedback(feedbackTexto) {
  if (!feedbackTexto || !feedbackTexto.trim()) return '';
  return `
    <div class="rf-paper-section">
      <div class="rf-paper-section-title">💬 Feedback</div>
      <div class="rf-paper-summary">${escapeHtml(feedbackTexto)}</div>
    </div>`;
}

function rfBuildSections(opts) {
  const metricas = rfResolveMetricas(opts.metricas);
  const sections = [];
  sections.push(rfSectionHeader(opts.colaborador, opts.mes, opts));
  sections.push(rfSectionKPIs(opts.colaborador, opts.mes, metricas, opts.records));
  sections.push(rfSectionObservacoes(opts.observacoes, opts.comentarios));
  sections.push(rfSectionProtocolos(opts.protocolos));
  sections.push(rfSectionFeedback(opts.feedback));
  return sections.filter(Boolean);
}

function rfRenderPreview(opts) {
  const container = document.getElementById('rfPreview');
  if (!container) return;
  const sections = rfBuildSections(opts);
  container.innerHTML = `<div class="rf-paper">${sections.join('\n')}</div>`;
}

// ─── Formulário ──────────────────────────────────────────────────

function rfOpenOverlay() {
  const overlay = document.getElementById('relatorioFeedbackOverlay');
  if (!overlay) return;
  const content = document.getElementById('relatorioFeedbackContent');
  if (!content) return;
  content.innerHTML = '<div class="card admin-content-padding"><div class="skeleton skeleton-card"></div><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line short"></div></div>';
  overlay.classList.add('open');
  setTimeout(() => rfRenderForm(), 50);
}

function rfRenderForm() {
  const content = document.getElementById('relatorioFeedbackContent');
  if (!content) return;

  const raw = rfRaw();
  const cfg = rfGetConfig();
  const colabs = _uniqueColabs(raw);
  const meses = _uniqueMonths(raw);

  const selColab = cfg.colaborador || '';
  const selMes = cfg.mes || 'all';
  const selMetricas = Array.isArray(cfg.metricas) ? cfg.metricas : RF_DEFAULT_METRICAS.slice();

  let html = `
    <div class="admin-content-padding">
      <div class="rf-editor-heading">
        <div>
          <h2 class="rf-editor-title">📄 Relatório de Feedback</h2>
          <p class="rf-editor-description">Resultados, observações, protocolos e feedback em um PDF entregável ao colaborador.</p>
        </div>
        <button class="btn-small admin-caption" id="rfCloseBtn" type="button">✕ Fechar</button>
      </div>

      <div class="grid-2col rf-editor-grid">
        <div class="card admin-card-padding">
          <h3 class="rf-editor-section-title">⚙️ Configuração</h3>

          <div class="rf-editor-fields">
            <label class="field rf-editor-person-field">
              <span>Colaborador</span>
              <select id="rfColabSelect">
                <option value="">Selecionar...</option>
                ${colabs.map(c => `<option value="${escapeHtml(c)}" ${c === selColab ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('')}
              </select>
            </label>
            <label class="field rf-editor-period-field">
              <span>Período</span>
              <select id="rfMesSelect">
                <option value="all" ${selMes === 'all' ? 'selected' : ''}>Todos</option>
                ${meses.map(m => `<option value="${escapeHtml(m)}" ${m === selMes ? 'selected' : ''}>${escapeHtml(m)}</option>`).join('')}
              </select>
            </label>
          </div>

          <div class="field admin-section-gap">
            <span>Métricas do relatório</span>
            <div class="rf-editor-options">
              ${RF_METRICAS.map(met => `
                <label class="checkbox-label rf-editor-option">
                  <input type="checkbox" class="rf-metrica-cb" value="${escapeHtml(met.key)}" ${selMetricas.includes(met.key) ? 'checked' : ''}> ${escapeHtml(met.label)}
                </label>`).join('')}
            </div>
          </div>

          <div class="field admin-section-gap">
            <span>Observações do gestor</span>
            <textarea id="rfObservacoes" placeholder="Análises, pontos discutidos, mudanças que justificam o resultado, falhas a apontar..." class="rf-editor-notes">${escapeHtml(cfg.observacoes || '')}</textarea>
          </div>

          <div class="field admin-section-gap">
            <span>Feedback (texto)</span>
            <textarea id="rfFeedbackTexto" placeholder="Feedback final que será entregue ao colaborador." class="rf-editor-summary">${escapeHtml(cfg.feedback || '')}</textarea>
          </div>

          <div class="rf-editor-tools">
            <button class="btn-small" id="rfGerarSugestaoBtn" type="button">✨ Gerar sugestão</button>
            <button class="btn-small" id="rfLimparBtn" type="button">🧹 Limpar</button>
          </div>

          <div class="admin-actions">
            <button class="btn-primary admin-grow" id="rfGerarBtn" type="button"><svg class="ui-icon" aria-hidden="true"><use href="#ui-icon-chart"></use></svg> Gerar relatório</button>
            <button class="btn-primary rf-export-action" id="rfExportBtn" type="button">📄 Exportar PDF</button>
          </div>
        </div>

        <div class="card admin-card-padding">
          <h3 class="rf-editor-section-title"><svg class="ui-icon" aria-hidden="true"><use href="#ui-icon-eye"></use></svg> Pré-visualização</h3>
          <div id="rfPreview" class="rf-preview">
            <div class="rf-preview-empty">Selecione um colaborador e clique em "Gerar relatório".</div>
          </div>
        </div>
      </div>
    </div>`;

  content.innerHTML = html;

  document.getElementById('rfCloseBtn').addEventListener('click', () => {
    document.getElementById('relatorioFeedbackOverlay').classList.remove('open');
  });

  const colabSel = document.getElementById('rfColabSelect');
  const mesSel = document.getElementById('rfMesSelect');
  const obsTa = document.getElementById('rfObservacoes');
  const fbTa = document.getElementById('rfFeedbackTexto');

  function saveCfg() {
    const cfg2 = {
      colaborador: colabSel.value,
      mes: mesSel.value,
      metricas: Array.from(document.querySelectorAll('.rf-metrica-cb:checked')).map(cb => cb.value),
      observacoes: obsTa.value,
      feedback: fbTa.value
    };
    rfSaveConfig(cfg2);
  }

  [colabSel, mesSel, obsTa, fbTa].forEach(el => el.addEventListener('input', saveCfg));
  document.querySelectorAll('.rf-metrica-cb').forEach(cb => cb.addEventListener('change', saveCfg));

  document.getElementById('rfGerarSugestaoBtn').addEventListener('click', async () => {
    if (!colabSel.value) { showToast('Selecione um colaborador primeiro.', 'warn'); return; }
    const button = document.getElementById('rfGerarSugestaoBtn');
    button.disabled = true;
    try { await AtividadesMes.load(); }
    catch { showToast('Não foi possível carregar as atividades. Tente novamente.', 'error'); return; }
    finally { button.disabled = false; }
    const sugestao = gerarSugestaoFeedback(colabSel.value, mesSel.value, obsTa.value);
    fbTa.value = sugestao;
    saveCfg();
  });

  document.getElementById('rfLimparBtn').addEventListener('click', () => {
    obsTa.value = '';
    fbTa.value = '';
    saveCfg();
    rfRenderForm();
  });

  document.getElementById('rfGerarBtn').addEventListener('click', () => {
    rfGerarPreview();
  });

  document.getElementById('rfExportBtn').addEventListener('click', () => {
    rfExportarPDF();
  });

  // pré-visualização automática se já houver configuração
  if (selColab) rfGerarPreview();
}

function rfCollectOpts() {
  const colab = document.getElementById('rfColabSelect')?.value || '';
  const mes = document.getElementById('rfMesSelect')?.value || 'all';
  const metricas = Array.from(document.querySelectorAll('.rf-metrica-cb:checked')).map(cb => cb.value);
  const observacoes = document.getElementById('rfObservacoes')?.value || '';
  const feedback = document.getElementById('rfFeedbackTexto')?.value || '';

  const records = rfRecordsColab(colab, mes);
  const setores = [...new Set(records.map(r => r['Setor']).filter(Boolean))];

  return {
    colaborador: colab,
    mes,
    metricas: metricas.length ? metricas : RF_DEFAULT_METRICAS.slice(),
    observacoes,
    feedback,
    records,
    setor: setores.length ? setores.join(', ') : '',
    protocolos: rfProtocolos(colab, mes),
    comentarios: rfComentariosPeriodo(mes)
  };
}

function rfGerarPreview() {
  const colab = document.getElementById('rfColabSelect')?.value;
  if (!colab) { showToast('Selecione um colaborador.', 'warn'); return; }
  const opts = rfCollectOpts();
  if (!opts.records.length) { showToast('Nenhum dado encontrado para o colaborador no período.', 'warn'); return; }
  rfRenderPreview(opts);
  showToast('Relatório gerado. Revise a pré-visualização e exporte o PDF.', 'success', 'Relatório');
}

// ─── Exportação PDF ──────────────────────────────────────────────

async function rfExportarPDF() {
  const colab = document.getElementById('rfColabSelect')?.value;
  if (!colab) { showToast('Gere o relatório antes de exportar.', 'warn'); return; }
  if(typeof ExportTools!=='undefined'&&!await ExportTools.ready('pdf','image'))return;
  if (typeof window.jspdf === 'undefined') { showToast('Biblioteca de PDF não carregada.', 'error'); return; }

  const opts = rfCollectOpts();
  const sections = rfBuildSections(opts);
  if (!sections.length) { showToast('Nada para exportar.', 'warn'); return; }

  setLoading(true, 'Gerando PDF…');
  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageW = 210;
    const pageH = 297;
    const margin = 10;
    const contentW = pageW - margin * 2;

    const container = document.createElement('div');
    container.className = 'rf-export-stage';
    document.body.appendChild(container);

    let first = true;

    for (const sectionHtml of sections) {
      const wrapper = document.createElement('div');
      wrapper.className = 'rf-export-sheet';
      wrapper.innerHTML = sectionHtml;
      container.appendChild(wrapper);

      await new Promise(r => setTimeout(r, 80));

      let canvas;
      try {
        canvas = await html2canvas(wrapper.firstElementChild, {
          scale: 2,
          useCORS: true,
          allowTaint: false,
          backgroundColor: '#ffffff',
          logging: false
        });
      } catch (e) {
        console.error('[Relatório] Captura da seção falhou:', e);
        wrapper.remove();
        continue;
      }

      const imgData = canvas.toDataURL('image/png');
      const imgH = (canvas.height / canvas.width) * contentW;

      if (first) {
        first = false;
      } else {
        doc.addPage();
      }

      // Se a seção ultrapassar uma página, dividir em várias
      if (imgH <= pageH - margin * 2) {
        doc.addImage(imgData, 'PNG', margin, margin, contentW, imgH);
      } else {
        const parts = Math.ceil(imgH / (pageH - margin * 2));
        const partHpx = canvas.height / parts;
        for (let i = 0; i < parts; i++) {
          if (i > 0) doc.addPage();
          const partCanvas = document.createElement('canvas');
          partCanvas.width = canvas.width;
          partCanvas.height = Math.round(partHpx);
          const ctx = partCanvas.getContext('2d');
          ctx.drawImage(canvas, 0, Math.round(i * partHpx), canvas.width, Math.round(partHpx), 0, 0, canvas.width, Math.round(partHpx));
          const partImg = partCanvas.toDataURL('image/png');
          doc.addImage(partImg, 'PNG', margin, margin, contentW, pageH - margin * 2);
        }
      }

      wrapper.remove();
    }

    document.body.removeChild(container);

    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeName = String(colab).replace(/[^a-zA-Z0-9_-]/g, '_');
    const mesLabel = opts.mes && opts.mes !== 'all' ? opts.mes : 'todos';
    a.href = url;
    a.download = `feedback-${safeName}-${mesLabel}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast('PDF gerado com sucesso!', 'success', 'Relatório');
  } catch (e) {
    console.error('rfExportarPDF:', e);
    showToast('Erro ao gerar PDF: ' + (e.message || e), 'error');
    const c = document.getElementById('relatorioFeedbackRenderContainer');
    if (c) c.remove();
  } finally {
    setLoading(false);
    const c = document.getElementById('relatorioFeedbackRenderContainer');
    if (c) c.remove();
  }
}

// ─── Abertura por botão ──────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('relatorioFeedbackBtn')?.addEventListener('click', rfOpenOverlay);
  document.getElementById('relatorioFeedbackOverlayClose')?.addEventListener('click', () => {
    document.getElementById('relatorioFeedbackOverlay')?.classList.remove('open');
  });
  const overlay = document.getElementById('relatorioFeedbackOverlay');
  overlay?.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.classList.remove('open');
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') document.getElementById('relatorioFeedbackOverlay')?.classList.remove('open');
  });
});
