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
  try { return JSON.parse(localStorage.getItem(RF_CONFIG_KEY)) || {}; } catch { return {}; }
}
function rfSaveConfig(cfg) {
  try { localStorage.setItem(RF_CONFIG_KEY, JSON.stringify(cfg)); } catch {}
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

function rfTeamRecords(mes) {
  let recs = rfRaw().filter(r => r && r['Atendente'] && !isAggregateName(r['Atendente']));
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

function rfAvaliacoesDesempenho(colaborador) {
  const all = (typeof getAvaliacoesLocal === 'function') ? getAvaliacoesLocal() : [];
  return all.filter(a => a.colaborador === colaborador);
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
  const setorHtml = setor ? `<div style="font-size:12px;color:#94a3b8;margin-top:2px">${escapeHtml(setor)}</div>` : '';
  return `
    <div style="background:#0f172a;color:#f8fafc;padding:24px 28px;border-radius:8px;margin-bottom:20px">
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#60a5fa;margin-bottom:6px">Relatório de Feedback</div>
      <div style="font-size:26px;font-weight:700">${escapeHtml(colaborador)}</div>
      ${setorHtml}
      <div style="font-size:13px;color:#cbd5e1;margin-top:8px">Período: <strong style="color:#f8fafc">${escapeHtml(periodLabel)}</strong></div>
      <div style="font-size:12px;color:#64748b;margin-top:2px">Gerado em ${now.toLocaleString('pt-BR')}</div>
    </div>`;
}

function rfSectionKPIs(colaborador, mes, metricas, records) {
  const teamRecs = rfTeamRecords(mes);
  const prev = rfPrevPeriodo(colaborador, mes);
  const cards = metricas.map(met => {
    const val = rfCalcVal(records, met);
    const teamVal = rfCalcVal(teamRecs, met);
    let cmp = '';
    if (prev && met.tipo !== 'texto') {
      const d = rfDeltaPct(val, rfCalcVal(prev.records, met));
      if (d != null) {
        cmp += `<div style="font-size:11px;font-weight:700;color:${rfDeltaColor(d, met.key)};margin-top:3px">${rfArrow(d)} ${Math.abs(d).toFixed(1).replace('.', ',')}% <span style="color:#94a3b8;font-weight:400">vs ${escapeHtml(prev.mes)}</span></div>`;
      }
    }
    if (val != null && teamVal != null && met.tipo !== 'texto') {
      const dif = typeof val === 'number' && typeof teamVal === 'number' ? val - teamVal : null;
      const sinal = dif != null && dif > 0 ? '+' : (dif != null && dif < 0 ? '' : '');
      cmp += `<div style="font-size:11px;color:#94a3b8;margin-top:4px">Média equipe: ${rfFmtVal(teamVal, met)}${dif != null ? ` · ${sinal}${dif.toFixed(met.decimal || 0)}` : ''}</div>`;
    }
    return `
      <div style="flex:1;min-width:120px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px 16px">
        <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.4px">${escapeHtml(met.label)}</div>
        <div style="font-size:22px;font-weight:700;color:#0f172a;margin-top:4px">${rfFmtVal(val, met)}</div>
        ${cmp}
      </div>`;
  }).join('');

  return `
    <div style="margin-bottom:20px">
      <div style="font-size:15px;font-weight:700;color:#0f172a;margin-bottom:10px">📊 Resultados do período</div>
      <div style="display:flex;flex-wrap:wrap;gap:10px">${cards}</div>
    </div>`;
}

function rfSectionEvolucao(colaborador, mes, metricas) {
  const allMeses = _uniqueMonths(rfRaw().filter(r => r['Atendente'] === colaborador));
  if (!allMeses.length) return '';
  const displayMeses = mes && mes !== 'all' ? allMeses.filter(m => m === mes) : allMeses;
  if (!displayMeses.length) return '';
  const single = displayMeses.length === 1;

  const rows = displayMeses.map((m, i) => {
    const recs = rfRaw().filter(r => r['Atendente'] === colaborador && r['Mês'] === m);
    const rowBg = i % 2 === 1 ? '#f8fafc' : '#ffffff';
    let prev = null;
    if (i > 0) {
      const pm = displayMeses[i - 1];
      prev = { mes: pm, records: rfRaw().filter(r => r['Atendente'] === colaborador && r['Mês'] === pm) };
    } else if (single) {
      prev = rfPrevPeriodo(colaborador, m);
    }
    const cells = metricas.map(met => {
      const val = rfCalcVal(recs, met);
      let delta = '';
      if (met.tipo !== 'texto' && prev) {
        const d = rfDeltaPct(val, rfCalcVal(prev.records, met));
        if (d != null) delta = `<div style="font-size:10px;font-weight:700;color:${rfDeltaColor(d, met.key)}">${rfArrow(d)} ${Math.abs(d).toFixed(1).replace('.', ',')}%</div>`;
      }
      return `<td style="background:${rowBg};padding:6px 10px;border-bottom:1px solid #e2e8f0;font-size:12px;color:#334155;text-align:right">${rfFmtVal(val, met)}${delta}</td>`;
    }).join('');
    const mesCell = single && prev
      ? `${escapeHtml(m)}<div style="font-size:10px;color:#94a3b8;font-weight:400">vs ${escapeHtml(prev.mes)}</div>`
      : escapeHtml(m);
    return `<tr><td style="background:${rowBg};padding:6px 10px;border-bottom:1px solid #e2e8f0;font-size:12px;font-weight:600;color:#0f172a">${mesCell}</td>${cells}</tr>`;
  }).join('');
  const heads = metricas.map(met => `<th style="background:#f1f5f9;position:static;backdrop-filter:none;padding:6px 10px;border-bottom:1px solid #cbd5e1;font-size:11px;text-transform:uppercase;color:#64748b;text-align:right">${escapeHtml(met.label)}</th>`).join('');

  return `
    <div style="margin-bottom:20px">
      <div style="font-size:15px;font-weight:700;color:#0f172a;margin-bottom:10px">📈 Evolução mensal ${single ? `(${escapeHtml(mes)})` : ''}</div>
      <div style="overflow:hidden;border:1px solid #e2e8f0;border-radius:8px;background:#ffffff">
        <table style="width:100%;border-collapse:collapse">
          <thead><tr><th style="background:#f1f5f9;position:static;backdrop-filter:none;padding:6px 10px;border-bottom:1px solid #cbd5e1;font-size:11px;text-transform:uppercase;color:#64748b;text-align:left">Mês</th>${heads}</tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
}

function rfSectionObservacoes(observacoes, comentarios) {
  let html = `<div style="font-size:15px;font-weight:700;color:#0f172a;margin-bottom:10px">📝 Observações e análises</div>`;

  if (observacoes && observacoes.trim()) {
    html += `<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:14px 16px;margin-bottom:12px;font-size:13px;color:#78350f;line-height:1.6;white-space:pre-wrap">${escapeHtml(observacoes)}</div>`;
  }

  if (comentarios && comentarios.length) {
    html += `<div style="margin-bottom:10px"><strong style="font-size:13px;color:#334155">Comentários do período:</strong></div>`;
    html += comentarios.map(c => `
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px 14px;margin-bottom:8px">
        <div style="font-size:12.5px;color:#334155;line-height:1.5">${escapeHtml(c.texto)}</div>
        <div style="font-size:11px;color:#94a3b8;margin-top:4px">${c.mes ? escapeHtml(c.mes) + ' · ' : ''}${escapeHtml(c.user || '')}${c.ts ? ' · ' + new Date(c.ts).toLocaleDateString('pt-BR') : ''}</div>
      </div>`).join('');
  }

  if ((!observacoes || !observacoes.trim()) && (!comentarios || !comentarios.length)) {
    html += `<div style="font-size:12px;color:#94a3b8;font-style:italic">Nenhuma observação registrada para o período.</div>`;
  }

  return `<div style="margin-bottom:20px">${html}</div>`;
}

function rfSectionProtocolos(protocolos) {
  if (!protocolos || !protocolos.length) return '';
  const rows = protocolos.map((p, i) => {
    const rowBg = i % 2 === 1 ? '#f8fafc' : '#ffffff';
    const notaBadge = (!p.teve_nota || p.nota == null)
      ? '<span style="font-size:11px;color:#94a3b8">Sem nota</span>'
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
    <div style="margin-bottom:20px">
      <div style="font-size:15px;font-weight:700;color:#0f172a;margin-bottom:10px">🎧 Protocolos de atendimento (${protocolos.length})</div>
      <div style="overflow:hidden;border:1px solid #e2e8f0;border-radius:8px;background:#ffffff">
        <table style="width:100%;border-collapse:collapse">
          <thead><tr>
            <th style="background:#f1f5f9;position:static;backdrop-filter:none;padding:8px 10px;border-bottom:1px solid #cbd5e1;font-size:11px;text-transform:uppercase;color:#64748b;text-align:left">Protocolo</th>
            <th style="background:#f1f5f9;position:static;backdrop-filter:none;padding:8px 10px;border-bottom:1px solid #cbd5e1;font-size:11px;text-transform:uppercase;color:#64748b;text-align:left">Data</th>
            <th style="background:#f1f5f9;position:static;backdrop-filter:none;padding:8px 10px;border-bottom:1px solid #cbd5e1;font-size:11px;text-transform:uppercase;color:#64748b;text-align:center">Nota</th>
            <th style="background:#f1f5f9;position:static;backdrop-filter:none;padding:8px 10px;border-bottom:1px solid #cbd5e1;font-size:11px;text-transform:uppercase;color:#64748b;text-align:left">Resumo</th>
            <th style="background:#f1f5f9;position:static;backdrop-filter:none;padding:8px 10px;border-bottom:1px solid #cbd5e1;font-size:11px;text-transform:uppercase;color:#64748b;text-align:left">Orientação</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
}

function rfSectionAvaliacao(avaliacoes) {
  if (!avaliacoes || !avaliacoes.length) return '';
  const cards = avaliacoes.map(av => {
    const comps = getCompetencias();
    const scored = comps.map(c => {
      const v = av.scores && av.scores[c.id];
      return { nome: c.nome.replace(/\s*\(C1\)\s*/, ''), val: (v !== null && v !== undefined && !isNaN(v)) ? Number(v) : null };
    });
    const valid = scored.filter(s => s.val != null);
    const avg = valid.length ? (valid.reduce((a, s) => a + s.val, 0) / valid.length) : null;
    const bars = scored.map(s => {
      if (s.val == null) return `<div style="font-size:11px;color:#94a3b8;margin-bottom:4px">${escapeHtml(s.nome)}: —</div>`;
      const pct = (s.val / 4) * 100;
      const cor = s.val >= 3 ? '#059669' : s.val >= 2 ? '#d97706' : '#dc2626';
      return `
        <div style="margin-bottom:6px">
          <div style="display:flex;justify-content:space-between;font-size:11px;color:#334155;margin-bottom:2px"><span>${escapeHtml(s.nome)}</span><span style="font-weight:700;color:${cor}">${s.val}</span></div>
          <div style="background:#e2e8f0;border-radius:4px;height:6px"><div style="background:${cor};border-radius:4px;height:6px;width:${pct}%"></div></div>
        </div>`;
    }).join('');
    return `
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px 18px;margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <strong style="font-size:13px;color:#0f172a">${escapeHtml(av.ciclo || 'Sem ciclo')}</strong>
          ${avg != null ? `<span style="font-size:12px;font-weight:700;color:#0f172a">Média: ${avg.toFixed(2)}</span>` : ''}
        </div>
        ${bars}
        ${av.avaliacao_qualitativa ? `<div style="margin-top:10px;font-size:12px;color:#334155;line-height:1.5"><strong>Observação:</strong> ${escapeHtml(av.avaliacao_qualitativa)}</div>` : ''}
      </div>`;
  }).join('');

  return `
    <div style="margin-bottom:20px">
      <div style="font-size:15px;font-weight:700;color:#0f172a;margin-bottom:10px">🏅 Avaliação de desempenho (${avaliacoes.length})</div>
      ${cards}
    </div>`;
}

function rfSectionFeedback(feedbackTexto) {
  if (!feedbackTexto || !feedbackTexto.trim()) return '';
  return `
    <div style="margin-bottom:20px">
      <div style="font-size:15px;font-weight:700;color:#0f172a;margin-bottom:10px">💬 Feedback</div>
      <div style="background:#eef2ff;border:1px solid #c7d2fe;border-radius:8px;padding:16px 18px;font-size:13px;color:#312e81;line-height:1.7;white-space:pre-wrap">${escapeHtml(feedbackTexto)}</div>
    </div>`;
}

function rfBuildSections(opts) {
  const metricas = rfResolveMetricas(opts.metricas);
  const sections = [];
  sections.push(rfSectionHeader(opts.colaborador, opts.mes, opts));
  sections.push(rfSectionKPIs(opts.colaborador, opts.mes, metricas, opts.records));
  sections.push(rfSectionEvolucao(opts.colaborador, opts.mes, metricas));
  sections.push(rfSectionObservacoes(opts.observacoes, opts.comentarios));
  sections.push(rfSectionProtocolos(opts.protocolos));
  sections.push(rfSectionAvaliacao(opts.avaliacoes));
  sections.push(rfSectionFeedback(opts.feedback));
  return sections.filter(Boolean);
}

function rfRenderPreview(opts) {
  const container = document.getElementById('rfPreview');
  if (!container) return;
  const sections = rfBuildSections(opts);
  container.innerHTML = `<div style="max-width:820px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:28px">${sections.join('\n')}</div>`;
}

// ─── Formulário ──────────────────────────────────────────────────

function rfOpenOverlay() {
  const overlay = document.getElementById('relatorioFeedbackOverlay');
  if (!overlay) return;
  const content = document.getElementById('relatorioFeedbackContent');
  if (!content) return;
  content.innerHTML = '<div class="card" style="padding:var(--s-5)"><div class="skeleton skeleton-card"></div><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line short"></div></div>';
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
    <div style="padding:var(--s-5)">
      <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:var(--s-4)">
        <div>
          <h2 style="font-size:18px;font-weight:700">📄 Relatório de Feedback</h2>
          <p style="font-size:13px;color:var(--text-secondary);margin-top:2px">Resultados, observações, protocolos e avaliações em um PDF entregável ao colaborador.</p>
        </div>
        <button class="btn-small" id="rfCloseBtn" type="button" style="font-size:12px">✕ Fechar</button>
      </div>

      <div class="grid-2col" style="gap:var(--s-5);align-items:start">
        <div class="card" style="padding:var(--s-4)">
          <h3 style="font-size:15px;font-weight:600;margin-bottom:var(--s-3)">⚙️ Configuração</h3>

          <div style="display:flex;gap:var(--s-3);flex-wrap:wrap;margin-bottom:var(--s-3)">
            <label class="field" style="flex:1;min-width:160px">
              <span>Colaborador</span>
              <select id="rfColabSelect">
                <option value="">Selecionar...</option>
                ${colabs.map(c => `<option value="${escapeHtml(c)}" ${c === selColab ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('')}
              </select>
            </label>
            <label class="field" style="flex:1;min-width:140px">
              <span>Período</span>
              <select id="rfMesSelect">
                <option value="all" ${selMes === 'all' ? 'selected' : ''}>Todos</option>
                ${meses.map(m => `<option value="${escapeHtml(m)}" ${m === selMes ? 'selected' : ''}>${escapeHtml(m)}</option>`).join('')}
              </select>
            </label>
          </div>

          <div class="field" style="margin-bottom:var(--s-3)">
            <span>Métricas do relatório</span>
            <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:4px">
              ${RF_METRICAS.map(met => `
                <label class="checkbox-label" style="margin:0;font-size:12px">
                  <input type="checkbox" class="rf-metrica-cb" value="${escapeHtml(met.key)}" ${selMetricas.includes(met.key) ? 'checked' : ''}> ${escapeHtml(met.label)}
                </label>`).join('')}
            </div>
          </div>

          <div class="field" style="margin-bottom:var(--s-3)">
            <span>Observações do gestor</span>
            <textarea id="rfObservacoes" style="width:100%;min-height:80px;font-size:12px;line-height:1.5" placeholder="Análises, pontos discutidos, mudanças que justificam o resultado, falhas a apontar...">${escapeHtml(cfg.observacoes || '')}</textarea>
          </div>

          <div class="field" style="margin-bottom:var(--s-3)">
            <span>Feedback (texto)</span>
            <textarea id="rfFeedbackTexto" style="width:100%;min-height:100px;font-size:12px;line-height:1.5;white-space:pre-wrap" placeholder="Feedback final que será entregue ao colaborador.">${escapeHtml(cfg.feedback || '')}</textarea>
          </div>

          <div style="display:flex;gap:var(--s-2);flex-wrap:wrap;margin-bottom:var(--s-3)">
            <button class="btn-small" id="rfGerarSugestaoBtn" type="button">✨ Gerar sugestão</button>
            <button class="btn-small" id="rfLimparBtn" type="button">🧹 Limpar</button>
          </div>

          <div style="display:flex;gap:var(--s-2);flex-wrap:wrap">
            <button class="btn-primary" id="rfGerarBtn" type="button" style="flex:1">📊 Gerar relatório</button>
            <button class="btn-primary" id="rfExportBtn" type="button" style="flex:1;background:var(--success, #059669)">📄 Exportar PDF</button>
          </div>
        </div>

        <div class="card" style="padding:var(--s-4)">
          <h3 style="font-size:15px;font-weight:600;margin-bottom:var(--s-3)">👁️ Pré-visualização</h3>
          <div id="rfPreview" style="max-height:70vh;overflow-y:auto">
            <div style="font-size:12px;color:var(--text-muted);text-align:center;padding:30px 10px">Selecione um colaborador e clique em "Gerar relatório".</div>
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

  document.getElementById('rfGerarSugestaoBtn').addEventListener('click', () => {
    if (!colabSel.value) { showToast('Selecione um colaborador primeiro.', 'warn'); return; }
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
    avaliacoes: rfAvaliacoesDesempenho(colab),
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
    container.style.cssText = 'position:fixed;left:-9999px;top:0;z-index:-1';
    document.body.appendChild(container);

    let first = true;

    for (const sectionHtml of sections) {
      const wrapper = document.createElement('div');
      wrapper.style.cssText = 'width:820px;background:#ffffff';
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
