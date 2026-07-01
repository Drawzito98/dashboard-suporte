function clearReportTextOnly() {
  const ok = confirm('Apagar apenas o texto do relatório gerado?');
  if (!ok) return;
  const ta = document.getElementById('reportText');
  if (ta) ta.value = '';
  window.__lastReportText = '';
  saveState();
}
function _rsAvgScoreBySetor(rows) {
  const bySetor = {};
  rows.forEach(r => {
    const s = String(r['Setor'] || '').trim();
    if (!s) return;
    const sc = r['SCORE'];
    if (sc == null || isNaN(Number(sc))) return;
    if (!bySetor[s]) bySetor[s] = [];
    bySetor[s].push(Number(sc));
  });
  const avgs = Object.values(bySetor).filter(a => a.length > 0).map(a => a.reduce((x, y) => x + y, 0) / a.length);
  return avgs.length ? avgs.reduce((x, y) => x + y, 0) / avgs.length : 0;
}
function generateAndShowReport() {
  // Gera o relatório e garante feedback visual (sem depender do botão "Atualizar")
  try {
    setLoading(true, 'Gerando relatório…');
    const ta = document.getElementById('reportText');

    const text = buildReportText();
    window.__lastReportText = text;

    if (ta) {
      ta.value = text;
      ta.focus({ preventScroll: true });
    }

    // Switch to Relatório Setorial tab
    const tabBtn = document.querySelector('.tab-btn[data-tab="relatorio-setorial"]');
    if (tabBtn) tabBtn.click();

    // rola até o textarea
    if (ta && ta.scrollIntoView) {
      setTimeout(() => ta.scrollIntoView({ behavior: 'smooth', block: 'center' }), 200);
    }

    showToast('Relatório gerado com sucesso.', 'success', 'Relatório');
    saveState();
  } catch (e) {
    console.error('generateAndShowReport failed', e);
    showToast('Erro ao gerar relatório. Veja o Console (F12).', 'error', 'Relatório');
  } finally {
    setLoading(false);
  }
}

async function copyReportToClipboard() {
  const ta = document.getElementById('reportText');
  const text = ta ? ta.value : (window.__lastReportText || '');
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
  } catch (e) {
    // fallback
    const temp = document.createElement('textarea');
    temp.value = text;
    document.body.appendChild(temp);
    temp.select();
    document.execCommand('copy');
    temp.remove();
  }
}
function exportReportToPDF() {
  const ta = document.getElementById('reportText');
  const text = (ta && ta.value) ? ta.value.trim() : '';
  if (!text) {
    showToast('Nada para exportar. Gere o relatório primeiro.', 'warn');
    return;
  }
  const html = buildReportHTML(text);
  const w = window.open('', '_blank');
  if (!w) {
    showToast('Não consegui abrir a janela de impressão. Verifique bloqueador de pop-ups.', 'error');
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
  showToast('Abrindo exportação para PDF…', 'ok');
}

async function exportPDFcomGrafico() {
  setLoading(true, 'Gerando PDF…');
  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageW = 190;
    let y = 15;

    // Título
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Relatório Executivo - IXC CG · Painel de Suporte', pageW / 2, y, { align: 'center' });
    y += 10;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, pageW / 2, y, { align: 'center' });
    y += 12;

    // Captura o texto do relatório
    const ta = document.getElementById('reportText');
    const text = (ta && ta.value) ? ta.value.trim() : '';
    if (text) {
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('Indicadores', pageW / 2, y, { align: 'center' });
      y += 7;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      const lines = doc.splitTextToSize(text, pageW);
      for (const line of lines) {
        if (y > 275) { doc.addPage(); y = 15; }
        doc.text(line, 10, y);
        y += 5;
      }
      y += 8;
    }

    // Captura o gráfico
    const canvas = document.getElementById('mainChart');
    const chartCard = document.getElementById('chartCard');
    if (canvas && chartCard && chartCard.style.display !== 'none') {
      if (y > 240) { doc.addPage(); y = 15; }
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Gráfico de Desempenho', pageW / 2, y, { align: 'center' });
      y += 5;
      const chartImg = canvas.toDataURL('image/png');
      const imgW = 180;
      const imgH = (canvas.height / canvas.width) * imgW;
      doc.addImage(chartImg, 'PNG', 10, y, imgW, Math.min(imgH, 120));
      y += Math.min(imgH, 120) + 10;
    }

    // Captura os cards de resumo (KPIs)
    const summaryCard = document.getElementById('summaryCard');
    if (summaryCard && summaryCard.style.display !== 'none') {
      if (y > 250) { doc.addPage(); y = 15; }
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Resumo', pageW / 2, y, { align: 'center' });
      y += 5;
      try {
        const summaryCanvas = await html2canvas(summaryCard, { scale: 2, useCORS: true });
        const imgData = summaryCanvas.toDataURL('image/png');
        const imgW2 = 180;
        const imgH2 = (summaryCanvas.height / summaryCanvas.width) * imgW2;
        doc.addImage(imgData, 'PNG', 10, y, imgW2, Math.min(imgH2, 80));
        y += Math.min(imgH2, 80) + 5;
      } catch (e) {}
    }

    // Abre em nova aba para preview (não baixa automaticamente)
    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    showToast('PDF aberto em nova aba. Use o botão de download do visualizador.', 'success', 'PDF');
  } catch (e) {
    console.error('Erro ao gerar PDF:', e);
    showToast('Erro ao gerar PDF: ' + e.message, 'error');
  } finally {
    setLoading(false);
  }
}

function escapeHtml(str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function generateIntelReport() {
  try {
    const rows = getCurrentFilteredRows();
    if (!rows.length) {
      showToast('Sem dados no escopo atual para gerar análise.', 'warn', 'Relatório Inteligente');
      return;
    }

    const totalAss = rows.reduce((s, r) => s + (parseInt(r['Assumidos']) || 0), 0);
    const totalFin = rows.reduce((s, r) => s + (parseInt(r['Finalizados']) || 0), 0);
    const totalTrans = rows.reduce((s, r) => s + (parseInt(r['Transferidos']) || 0), 0);
    const avgScore = _rsAvgScoreBySetor(rows);
    const prod = totalAss > 0 ? (totalFin / totalAss) : 0;
    const taxaTrans = totalAss > 0 ? (totalTrans / totalAss) : 0;

    // By collaborator
    const byColab = {};
    rows.forEach(r => {
      const a = String(r['Atendente'] || '').trim();
      if (!a) return;
      if (!byColab[a]) byColab[a] = { assumidos: 0, finalizados: 0, transferidos: 0, scores: [] };
      byColab[a].assumidos += parseInt(r['Assumidos']) || 0;
      byColab[a].finalizados += parseInt(r['Finalizados']) || 0;
      byColab[a].transferidos += parseInt(r['Transferidos']) || 0;
      const sc = r['SCORE'];
      if (sc !== null && sc !== undefined && !isNaN(Number(sc))) byColab[a].scores.push(Number(sc));
    });

    const entries = Object.entries(byColab).map(([name, v]) => ({
      name,
      ...v,
      avgScore: v.scores.length ? v.scores.reduce((a, b) => a + b, 0) / v.scores.length : 0
    }));

    const sortedByFin = [...entries].sort((a, b) => b.finalizados - a.finalizados);
    const sortedByScore = [...entries].filter(e => e.avgScore > 0).sort((a, b) => b.avgScore - a.avgScore);

    const leader = sortedByFin[0];
    const bestScore = sortedByScore[0];
    const worstScore = [...sortedByScore].reverse()[0];

    // Calculate growth vs previous period
    const meses = [...new Set(rows.map(r => r['Mês']))].sort();
    let growthText = '';
    if (meses.length >= 2) {
      const currentMes = meses[meses.length - 1];
      const prevMes = meses[meses.length - 2];
      const currentRows = rows.filter(r => String(r['Mês']) === currentMes);
      const prevRows = rows.filter(r => String(r['Mês']) === prevMes);
      const currFin = currentRows.reduce((s, r) => s + (parseInt(r['Finalizados']) || 0), 0);
      const prevFin = prevRows.reduce((s, r) => s + (parseInt(r['Finalizados']) || 0), 0);
      if (prevFin > 0) {
        const growth = ((currFin - prevFin) / prevFin) * 100;
        growthText = `A equipe apresentou ${growth >= 0 ? 'crescimento' : 'queda'} de ${Math.abs(growth).toFixed(1)}% em relação ao período anterior.`;
      }
    }

    // Build report
    const lines = [];
    lines.push(`📊 Análise Inteligente do Período`);
    lines.push('');
    if (leader) {
      lines.push(`🏆 Destaque: ${leader.name} liderou com ${leader.finalizados} finalizações ${leader.avgScore > 0 ? `e score médio de ${leader.avgScore.toFixed(2)}` : ''}.`);
    }
    if (growthText) lines.push(growthText);
    lines.push('');
    lines.push(`📈 Resumo: ${totalFin} finalizações, ${totalAss} assumidos, ${totalTrans} transferidos. Score médio: ${avgScore.toFixed(2)}. Produtividade: ${(prod * 100).toFixed(1)}%.`);
    if (avgScore < 4.0) lines.push(`⚠️ Score médio baixo (${avgScore.toFixed(2)}) — abaixo do ideal de 4.5.`);
    if (taxaTrans > 0.25) lines.push(`⚠️ Taxa de transferências elevada (${(taxaTrans * 100).toFixed(1)}%) — acima de 25%.`);
    if (prod < 0.7) lines.push(`⚠️ Produtividade baixa (${(prod * 100).toFixed(1)}%) — abaixo de 70%.`);

    // Strengths
    lines.push('');
    lines.push('✅ Pontos Fortes');
    if (bestScore && bestScore.avgScore >= 4.5) {
      lines.push(`  • Score de qualidade: ${bestScore.name} com média ${bestScore.avgScore.toFixed(2)}`);
    }
    if (prod >= 0.8) lines.push(`  • Produtividade elevada (${(prod * 100).toFixed(1)}%)`);
    const top3 = sortedByFin.slice(0, 3);
    if (top3.length) {
      lines.push(`  • Top finalizações: ${top3.map((e, i) => `${i+1}º ${e.name} (${e.finalizados})`).join(', ')}`);
    }

    // Opportunities
    lines.push('');
    lines.push('🔶 Oportunidades de Melhoria');
    if (worstScore && worstScore.avgScore < 4.0) {
      lines.push(`  • Score mais baixo: ${worstScore.name} (${worstScore.avgScore.toFixed(2)})`);
    }
    if (taxaTrans > 0.2) lines.push(`  • Reduzir taxa de transferências (${(taxaTrans * 100).toFixed(1)}%)`);
    const lowProd = entries.filter(e => e.assumidos > 0 && (e.finalizados / e.assumidos) < 0.6);
    if (lowProd.length) {
      lines.push(`  • Produtividade abaixo de 60%: ${lowProd.map(e => e.name).join(', ')}`);
    }

    // Alerts
    lines.push('');
    lines.push('🚨 Alertas');
    const alerts = [];
    if (avgScore < 3.5) alerts.push('Score crítico — abaixo de 3.5');
    if (taxaTrans > 0.35) alerts.push('Transferências muito elevadas');
    if (prod < 0.5) alerts.push('Produtividade crítica');
    if (entries.some(e => e.scores.length > 0 && e.avgScore < 3.0)) {
      const lowScorers = entries.filter(e => e.scores.length > 0 && e.avgScore < 3.0);
      alerts.push(`${lowScorers.length} colaborador(es) com score abaixo de 3.0`);
    }
    if (!alerts.length) alerts.push('Nenhum alerta crítico identificado.');
    alerts.forEach(a => lines.push(`  • ${a}`));

    // Recommendations
    lines.push('');
    lines.push('💡 Recomendações');
    if (avgScore < 4.0) lines.push('  • Implementar programa de capacitação em qualidade');
    if (taxaTrans > 0.2) lines.push('  • Revisar processo de triagem para reduzir transferências');
    if (prod < 0.75) lines.push('  • Otimizar roteamento de chamados para aumentar produtividade');
    if (entries.some(e => e.scores.length > 0 && e.avgScore >= 4.8)) {
      const topQual = entries.filter(e => e.scores.length > 0 && e.avgScore >= 4.8);
      lines.push(`  • Reconhecer e replicar práticas de ${topQual[0].name} como referência de qualidade`);
    }
    lines.push('  • Acompanhar evolução semanal dos indicadores para ação preventiva');

    const reportText = lines.join('\n');

    // Display the report
    const container = document.getElementById('intelReportContainer');
    if (container) {
      container.style.display = 'block';
      container.innerHTML = `
        <div class="intel-report-header">
          <h3>🤖 Relatório Inteligente</h3>
          <div style="display:flex;gap:8px">
            <button class="btn-small" id="copyIntelReportBtn" type="button">📋 Copiar</button>
            <button class="btn-small" id="closeIntelReportBtn" type="button">✕</button>
          </div>
        </div>
        <div class="intel-report-content">${escapeHtml(reportText)}</div>
      `;

      const copyBtn = document.getElementById('copyIntelReportBtn');
      if (copyBtn) {
        copyBtn.addEventListener('click', () => {
          navigator.clipboard.writeText(reportText).catch(() => {});
          showToast('Relatório copiado!', 'success');
        });
      }

      const closeBtn = document.getElementById('closeIntelReportBtn');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => {
          container.style.display = 'none';
        });
      }
    }

    showToast('Relatório inteligente gerado!', 'success', '🤖 IA');
  } catch (err) {
    console.error(err);
    showToast('Erro ao gerar relatório inteligente.', 'error');
  }
}

function exportChartAsPNG() {
  try {
    const canvas = document.getElementById('mainChart');
    if (!canvas || !chart) { showToast ? showToast('Nenhum gráfico para exportar.', 'warn') : alert('Nenhum gráfico para exportar.'); return; }
    // Compose a new canvas with solid background so PNG is legible in light/dark
    const isDark = document.documentElement.classList.contains('dark') || document.body.classList.contains('dark') || (document.documentElement.getAttribute('data-theme') === 'dark');
    const bg = isDark ? '#0f172a' : '#ffffff';
    const w = canvas.width, h = canvas.height;
    const out = document.createElement('canvas');
    out.width = w; out.height = h;
    const octx = out.getContext('2d');
    octx.fillStyle = bg;
    octx.fillRect(0, 0, w, h);
    octx.drawImage(canvas, 0, 0);
    const url = out.toDataURL('image/png');
    const a = document.createElement('a');
    const ts = new Date().toISOString().replace(/[:.]/g,'-').slice(0,19);
    a.href = url;
    a.download = `grafico-resultados-${ts}.png`;
    document.body.appendChild(a); a.click(); a.remove();
  } catch (err) {
    console.error(err);
    alert('Não foi possível exportar o gráfico em PNG.');
  }
}

function backupCsv() {
  const data = (typeof rawRecords !== 'undefined' ? rawRecords : []);
  if (!data || data.length === 0) {
    showToast('Nenhum dado para exportar.', 'error');
    return;
  }
  const preferred = ['Setor','Mês','Atendente','Assumidos','Transferidos','Finalizados','SCORE','Nota1','Nota2','Nota3','Total','Objetivo'];
  const keys = Array.from(new Set([...(data[0] ? Object.keys(data[0]) : []), ...preferred]));
  const orderedKeys = preferred.concat(keys.filter(k => !preferred.includes(k)));
  const rows = [orderedKeys.join(',')];
  data.forEach(r => {
    const vals = orderedKeys.map(k => {
      let v = r[k];
      if (v === null || v === undefined) return '';
      if (k === 'SCORE') return String(typeof v === 'number' ? v.toFixed(2) : v).replace(/,/g, '.');
      if (k === 'Assumidos' || k === 'Transferidos' || k === 'Finalizados') return String(Math.round(Number(v) || 0));
      const s = String(v);
      if (s.includes(',') || s.includes('\n') || s.includes('"')) return '"' + s.replace(/"/g, '""') + '"';
      return s;
    });
    rows.push(vals.join(','));
  });
  const csv = rows.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const now = new Date().toISOString().slice(0, 10);
  a.download = `backup-completo-${now}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showToast(`Backup exportado: ${data.length} registros`, 'success');
}

function exportCsv() {
  const data = typeof getCurrentFilteredRows === 'function' ? getCurrentFilteredRows() : (rawRecords || []);
  if (!data || data.length === 0) {
    showToast('Nenhum dado no escopo atual para exportar.', 'error');
    return;
  }
  const preferred = ['Setor','Mês','Atendente','Assumidos','Transferidos','Finalizados','SCORE','Nota1','Nota2','Nota3','Total','Objetivo'];
  const keys = Array.from(new Set([...(data[0] ? Object.keys(data[0]) : []), ...preferred]));
  const orderedKeys = preferred.concat(keys.filter(k => !preferred.includes(k)));
  const rows = [orderedKeys.join(',')];
  data.forEach(r => {
    const vals = orderedKeys.map(k => {
      let v = r[k];
      if (v === null || v === undefined) return '';
      // format SCORE with dot
      if (k === 'SCORE') return String(typeof v === 'number' ? v.toFixed(2) : v).replace(/,/g, '.');
      // integers
      if (k === 'Assumidos' || k === 'Transferidos' || k === 'Finalizados') return String(Math.round(Number(v) || 0));
      const s = String(v);
      // escape if needed
      if (s.includes(',') || s.includes('\n') || s.includes('"')) return '"' + s.replace(/"/g, '""') + '"';
      return s;
    });
    rows.push(vals.join(','));
  });
  const csv = rows.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const now = new Date().toISOString().slice(0, 10);
  const scopeLabel = (typeof getActiveMonths === 'function' ? getActiveMonths().join('-') : '') || 'todos';
  a.download = `dashboard-${scopeLabel}-${now}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function exportSlides() {
  setLoading(true, 'Gerando slides…');
  try {
    const rows = typeof getCurrentFilteredRows === 'function' ? getCurrentFilteredRows() : [];
    if (!rows.length) {
      showToast('Sem dados no escopo atual para gerar slides.', 'warn');
      return;
    }

    const sum = (key) => rows.reduce((s, r) => s + (parseInt(r[key]) || 0), 0);
    const totalAss = sum('Assumidos');
    const totalFin = sum('Finalizados');
    const totalTrans = sum('Transferidos');
    const avgScore = _rsAvgScoreBySetor(rows);
    const avgScoreDisplay = avgScore ? avgScore.toFixed(2) : '—';
    const prod = totalAss > 0 ? ((totalFin/totalAss)*100).toFixed(1) : '—';
    const txTrans = totalAss > 0 ? ((totalTrans/totalAss)*100).toFixed(1) : '—';

    const byAtt = {};
    rows.forEach(r => {
      const a = String(r['Atendente'] || '').trim();
      if (!a) return;
      if (!byAtt[a]) byAtt[a] = { fin:0, ass:0, sc:[] };
      byAtt[a].fin += parseInt(r['Finalizados']) || 0;
      byAtt[a].ass += parseInt(r['Assumidos']) || 0;
      const sc = r['SCORE'];
      if (sc !== null && sc !== undefined && !Number.isNaN(Number(sc))) byAtt[a].sc.push(Number(sc));
    });
    const ranking = Object.entries(byAtt).map(([name, v]) => ({
      name, fin: v.fin, ass: v.ass,
      avgScore: v.sc.length ? (v.sc.reduce((a,b)=>a+b,0)/v.sc.length).toFixed(2) : '—'
    })).sort((a,b) => b.fin - a.fin);

    const top5 = ranking.slice(0, 5);
    const meses = [...new Set(rows.map(r => r['Mês']))].sort();
    const scopeLabel = typeof globalFilters !== 'undefined' ? `Período: ${globalFilters.periodo !== 'all' ? globalFilters.periodo : (meses[0]||'') + (meses.length>1 ? ' — '+meses[meses.length-1] : '')}` : '';

    const now = new Date().toLocaleString('pt-BR', { hour12: false });
    const dateStr = new Date().toLocaleDateString('pt-BR');

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const bg = isDark ? '#0f172a' : '#ffffff';
    const fg = isDark ? '#f1f5f9' : '#0f172a';
    const muted = isDark ? '#94a3b8' : '#475569';
    const accent = '#2563eb';

    function slideHTML(contentHTML) {
      return `<div style="width:297mm;height:210mm;background:${bg};color:${fg};font-family:Inter,-apple-system,BlinkMacSystemFont,sans-serif;display:flex;flex-direction:column;padding:32px 40px;box-sizing:border-box;overflow:hidden;position:relative">
        <div style="flex:1;display:flex;flex-direction:column">${contentHTML}</div>
        <div style="text-align:center;font-size:10px;color:${muted};padding-top:12px;border-top:1px solid ${isDark ? '#1e293b' : '#e5e9f0'};margin-top:8px">IXC CG · Painel de Suporte — ${dateStr}</div>
      </div>`;
    }

    const slidesHTML = [];

    // --- Slide 1: Cover ---
    slidesHTML.push(slideHTML(`
      <div style="flex:1;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;gap:12px">
        <div style="font-size:48px;font-weight:700;letter-spacing:-.02em;background:linear-gradient(135deg,${accent},#7c3aed);-webkit-background-clip:text;-webkit-text-fill-color:transparent">IXC CG</div>
        <div style="font-size:28px;font-weight:600;color:${fg}">Painel de Suporte</div>
        <div style="height:3px;width:80px;background:${accent};border-radius:2px;margin:8px 0"></div>
        <div style="font-size:14px;color:${muted};line-height:1.6">${scopeLabel}</div>
        <div style="font-size:12px;color:${muted}">Gerado em ${now}</div>
      </div>
    `));

    // --- Slide 2: KPIs ---
    function kpiCard(label, value, sub) {
      return `<div style="background:${isDark?'#1e293b':'#f8fafc'};border:1px solid ${isDark?'#334155':'#e5e9f0'};border-radius:16px;padding:20px 24px;text-align:center;flex:1;min-width:140px">
        <div style="font-size:12px;color:${muted};text-transform:uppercase;letter-spacing:.06em;font-weight:600;margin-bottom:8px">${label}</div>
        <div style="font-size:36px;font-weight:700;letter-spacing:-.01em">${value}</div>
        ${sub ? `<div style="font-size:11px;color:${muted};margin-top:4px">${sub}</div>` : ''}
      </div>`;
    }

    slidesHTML.push(slideHTML(`
      <div style="font-size:20px;font-weight:700;margin-bottom:24px">📊 Indicadores do Período</div>
      <div style="display:flex;flex-wrap:wrap;gap:16px">
        ${kpiCard('Finalizados', totalFin.toLocaleString('pt-BR'))}
        ${kpiCard('Assumidos', totalAss.toLocaleString('pt-BR'))}
        ${kpiCard('Transferidos', totalTrans.toLocaleString('pt-BR'))}
        ${kpiCard('Score Médio', avgScoreDisplay, 'de 0 a 5')}
        ${kpiCard('Produtividade', prod !== '—' ? prod+'%' : '—', 'FINALIZADOS ÷ ASSUMIDOS')}
        ${kpiCard('Taxa Transf.', txTrans !== '—' ? txTrans+'%' : '—', 'TRANSFERIDOS ÷ ASSUMIDOS')}
      </div>
      <div style="font-size:11px;color:${muted};margin-top:24px;line-height:1.6">
        Total de colaboradores no período: ${ranking.length} · Meses considerados: ${meses.join(', ') || 'todos'}${scopeLabel ? ' · '+scopeLabel : ''}
      </div>
    `));

    // --- Slide 3: Chart ---
    slidesHTML.push(slideHTML(`
      <div style="font-size:20px;font-weight:700;margin-bottom:16px">📈 Gráfico de Desempenho</div>
      <div style="flex:1;display:flex;align-items:center;justify-content:center;background:${isDark?'#1e293b':'#f8fafc'};border-radius:16px;border:1px solid ${isDark?'#334155':'#e5e9f0'};overflow:hidden">
        <div id="slideChartContainer" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;padding:16px">
          <canvas id="slideChartCanvas" style="max-width:100%;max-height:100%"></canvas>
        </div>
      </div>
    `));

    // --- Slide 4: Ranking ---
    const rankRows = top5.map((p, i) => `
      <div style="display:flex;align-items:center;padding:14px 0;border-bottom:1px solid ${isDark?'#1e293b':'#f1f4f9'};gap:16px">
        <div style="width:36px;height:36px;border-radius:10px;background:${i===0?accent:(isDark?'#334155':'#e5e9f0')};color:${i===0?'#fff':fg};display:flex;align-items:center;justify-content:center;font-weight:700;font-size:16px;flex-shrink:0">${i+1}</div>
        <div style="flex:1;font-weight:600;font-size:16px">${escapeHtml(p.name)}</div>
        <div style="display:flex;gap:24px;text-align:right">
          <div><div style="font-size:11px;color:${muted}">Finalizados</div><div style="font-weight:700;font-size:18px">${p.fin}</div></div>
          <div><div style="font-size:11px;color:${muted}">Score</div><div style="font-weight:700;font-size:18px">${p.avgScore}</div></div>
        </div>
      </div>
    `).join('');

    slidesHTML.push(slideHTML(`
      <div style="font-size:20px;font-weight:700;margin-bottom:24px">🏆 Top Colaboradores</div>
      <div style="flex:1;background:${isDark?'#1e293b':'#f8fafc'};border-radius:16px;border:1px solid ${isDark?'#334155':'#e5e9f0'};padding:8px 20px">${rankRows}</div>
      <div style="font-size:11px;color:${muted};margin-top:12px;text-align:center">Ranking por finalizações — Período: ${meses.join(', ') || 'todos'}</div>
    `));

    // --- Slide 5: Insights ---
    const bestScore = ranking.filter(p => p.avgScore !== '—').sort((a,b) => parseFloat(b.avgScore) - parseFloat(a.avgScore))[0];
    const pctWarning = prod !== '—' && parseFloat(prod) < 70 ? `<div style="display:flex;align-items:center;gap:8px;padding:10px 14px;background:${isDark?'#451a1a':'#fef2f2'};border:1px solid ${isDark?'#7f1d1d':'#fecaca'};border-radius:10px;font-size:13px;color:${isDark?'#fca5a5':'#991b1b'};margin-bottom:8px">⚠️ Produtividade abaixo de 70% (${prod}%)</div>` : '';
    const scoreWarning = avgScoreDisplay !== '—' && parseFloat(avgScoreDisplay) < 4.5 ? `<div style="display:flex;align-items:center;gap:8px;padding:10px 14px;background:${isDark?'#451a1a':'#fef2f2'};border:1px solid ${isDark?'#7f1d1d':'#fecaca'};border-radius:10px;font-size:13px;color:${isDark?'#fca5a5':'#991b1b'};margin-bottom:8px">⚠️ Score médio abaixo de 4.5 (${avgScoreDisplay})</div>` : '';
    const transWarning = txTrans !== '—' && parseFloat(txTrans) > 25 ? `<div style="display:flex;align-items:center;gap:8px;padding:10px 14px;background:${isDark?'#451a1a':'#fef2f2'};border:1px solid ${isDark?'#7f1d1d':'#fecaca'};border-radius:10px;font-size:13px;color:${isDark?'#fca5a5':'#991b1b'};margin-bottom:8px">⚠️ Taxa de transferências acima de 25% (${txTrans}%)</div>` : '';

    slidesHTML.push(slideHTML(`
      <div style="font-size:20px;font-weight:700;margin-bottom:24px">💡 Destaques & Alertas</div>
      <div style="display:flex;flex-direction:column;gap:12px;flex:1">
        <div style="background:${isDark?'#1e293b':'#f8fafc'};border:1px solid ${isDark?'#334155':'#e5e9f0'};border-radius:16px;padding:20px">
          <div style="font-size:14px;font-weight:600;margin-bottom:12px">✅ Pontos Fortes</div>
          ${ranking[0] ? `<div style="font-size:13px;line-height:1.6">🏆 ${ranking[0].name} lidera com ${ranking[0].fin} finalizações${ranking[0].avgScore !== '—' ? ` e score ${ranking[0].avgScore}` : ''}</div>` : ''}
          ${bestScore && bestScore.avgScore >= 4.5 ? `<div style="font-size:13px;line-height:1.6">⭐ ${bestScore.name} com melhor score (${bestScore.avgScore})</div>` : ''}
          ${prod !== '—' && parseFloat(prod) >= 80 ? `<div style="font-size:13px;line-height:1.6">📈 Produtividade elevada (${prod}%)</div>` : ''}
        </div>
        <div style="background:${isDark?'#1e293b':'#f8fafc'};border:1px solid ${isDark?'#334155':'#e5e9f0'};border-radius:16px;padding:20px">
          <div style="font-size:14px;font-weight:600;margin-bottom:12px">🔶 Oportunidades</div>
          ${pctWarning || scoreWarning || transWarning || '<div style="font-size:13px;color:'+muted+'">Nenhum alerta crítico identificado.</div>'}
        </div>
      </div>
    `));

    // Render slides in hidden container, capture with html2canvas, build PDF
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('l', 'mm', 'a4');
    const pageW = 297;
    const pageH = 210;

    const container = document.createElement('div');
    container.id = 'slidesRenderContainer';
    container.style.cssText = 'position:fixed;left:-9999px;top:0;z-index:-1';
    document.body.appendChild(container);

    for (let i = 0; i < slidesHTML.length; i++) {
      const wrapper = document.createElement('div');
      wrapper.innerHTML = slidesHTML[i];

      if (i === 2) { // Chart slide — clone chart onto canvas
        const origCanvas = document.getElementById('mainChart');
        if (origCanvas) {
          const tempCanvas = wrapper.querySelector('#slideChartCanvas');
          if (tempCanvas) {
            tempCanvas.width = origCanvas.width;
            tempCanvas.height = origCanvas.height;
            const tCtx = tempCanvas.getContext('2d');
            const isDark2 = isDark;
            tCtx.fillStyle = isDark2 ? '#1e293b' : '#f8fafc';
            tCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
            tCtx.drawImage(origCanvas, 0, 0);
          }
        }
      }

      container.appendChild(wrapper);

      const slideEl = wrapper.firstElementChild;
      await new Promise(r => setTimeout(r, 100));

      try {
        const canvas = await html2canvas(slideEl, {
          scale: 2,
          useCORS: true,
          allowTaint: false,
          backgroundColor: bg
        });
        const imgData = canvas.toDataURL('image/png');
        const imgW = pageW;
        const imgH = (canvas.height / canvas.width) * imgW;

        if (i > 0) doc.addPage();
        doc.addImage(imgData, 'PNG', 0, 0, imgW, Math.min(imgH, pageH));
      } catch (capErr) {
        console.error(`Slide ${i+1} capture failed:`, capErr);
      }

      wrapper.remove();
    }

    document.body.removeChild(container);

    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `slides-canva-${new Date().toISOString().slice(0,10)}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast('Slides gerados! Abra o PDF no Canva para editar.', 'success', 'Slides');
  } catch (err) {
    console.error('exportSlides error:', err);
    showToast('Erro ao gerar slides: ' + (err.message || err), 'error');
  } finally {
    setLoading(false);
    const c = document.getElementById('slidesRenderContainer');
    if (c) c.remove();
  }
}

function buildReportHTML(text) {
  const title = 'Relatório Executivo';
  const now = new Date();
  const dateStr = now.toLocaleString('pt-BR', { hour12:false });
  const SEP_RE = /^[─-]{5,}\s*$/;
  const rawLines = String(text).split('\n');

  const headerLines = [];
  let i = 0;
  while (i < rawLines.length && !SEP_RE.test(rawLines[i])) { headerLines.push(rawLines[i]); i++; }

  const sections = [];
  while (i < rawLines.length) {
    if (SEP_RE.test(rawLines[i])) {
      const titleLine = (rawLines[i+1] || '').trim();
      let j = i + 2;
      if (SEP_RE.test(rawLines[j] || '')) j++;
      const body = [];
      while (j < rawLines.length && !SEP_RE.test(rawLines[j])) { body.push(rawLines[j]); j++; }
      while (body.length && body[0].trim() === '') body.shift();
      while (body.length && body[body.length-1].trim() === '') body.pop();
      sections.push({ title: titleLine, body });
      i = j;
    } else { i++; }
  }

  const dotPair = (line) => {
    const m = line.match(/^\s*(.+?)\s+\.[ .]*\s+(.+?)\s*$/);
    return m ? { label: m[1].trim(), value: m[2].trim() } : null;
  };

  function renderSectionBody(body, kind) {
    if (kind === 'resumo') {
      const items = body.map(l => dotPair(l)).filter(Boolean);
      if (!items.length) return `<pre class="raw">${escapeHtml(body.join('\n'))}</pre>`;
      return `<div class="kpi-grid">${items.map(it => `
          <div class="kpi">
            <div class="kpi-label">${escapeHtml(it.label)}</div>
            <div class="kpi-value">${escapeHtml(it.value)}</div>
          </div>`).join('')}</div>`;
    }
    if (kind === 'setor') {
      const cards = [];
      let cur = null;
      body.forEach(l => {
        const m = l.match(/^\s*▸\s*(.+)$/);
        if (m) {
          if (cur) cards.push(cur);
          const parts = m[1].split('·').map(s => s.trim());
          cur = { name: parts[0] || '', meta: parts.slice(1).join(' · '), items: [] };
        } else if (cur) {
          const dp = dotPair(l);
          if (dp) cur.items.push(dp);
        }
      });
      if (cur) cards.push(cur);
      if (!cards.length) return `<pre class="raw">${escapeHtml(body.join('\n'))}</pre>`;
      return `<div class="setor-grid">${cards.map(c => `
          <div class="setor-card">
            <div class="setor-head">
              <div class="setor-name">${escapeHtml(c.name)}</div>
              ${c.meta ? `<div class="setor-meta">${escapeHtml(c.meta)}</div>` : ''}
            </div>
            <div class="setor-rows">
              ${c.items.map(it => `
                <div class="setor-row">
                  <span class="setor-row-label">${escapeHtml(it.label)}</span>
                  <span class="setor-row-value">${escapeHtml(it.value)}</span>
                </div>`).join('')}
            </div>
          </div>`).join('')}</div>`;
    }
    if (kind === 'destaques') {
      const items = body.map(l => l.trim()).filter(Boolean);
      return `<ul class="destaques">${items.map(t => {
        const isOk = t.includes('✅');
        const isWarn = t.includes('⚠');
        const cls = isOk ? 'ok' : (isWarn ? 'warn' : '');
        return `<li class="${cls}">${escapeHtml(t.replace(/^[✅⚠️\s]+/, ''))}</li>`;
      }).join('')}</ul>`;
    }
    if (kind === 'rank') {
      const rows = body.map(l => {
        const m = l.match(/^\s*(\d+)\.\s+(.+?)\s+—\s+(.+?)\s*(?:\((.+)\))?\s*$/);
        if (!m) return null;
        return { pos: m[1], name: m[2].trim(), value: m[3].trim(), extra: (m[4] || '').trim() };
      }).filter(Boolean);
      if (!rows.length) return `<pre class="raw">${escapeHtml(body.join('\n'))}</pre>`;
      return `<ol class="rank">${rows.map(r => `
          <li>
            <span class="rank-pos">${escapeHtml(r.pos)}</span>
            <div class="rank-main">
              <div class="rank-name">${escapeHtml(r.name)}</div>
              ${r.extra ? `<div class="rank-extra">${escapeHtml(r.extra)}</div>` : ''}
            </div>
            <span class="rank-value">${escapeHtml(r.value)}</span>
          </li>`).join('')}</ol>`;
    }
    return `<pre class="raw">${escapeHtml(body.join('\n'))}</pre>`;
  }

  function classify(t) {
    const u = (t || '').toUpperCase();
    if (u.includes('RESUMO')) return 'resumo';
    if (u.includes('SETOR')) return 'setor';
    if (u.includes('MENORES SCORES') || u.includes('TOP')) return 'rank';
    if (u.includes('DESTAQUES') || u.includes('ATENÇÃO') || u.includes('ATENÇÕES')) return 'destaques';
    return 'raw';
  }

  const escopoLine = headerLines.find(l => /^Escopo:/i.test(l)) || '';
  const escopo = escopoLine.replace(/^Escopo:\s*/i, '').trim();

  const sectionsHTML = sections.map(s => `
      <section class="card">
        <h2>${escapeHtml(s.title)}</h2>
        ${renderSectionBody(s.body, classify(s.title))}
      </section>`).join('');

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${title} — ${dateStr}</title>
<style>
  :root {
    color-scheme: light dark;
    --bg:#f6f7fb; --fg:#0f172a; --muted:#64748b;
    --card:#ffffff; --card-border:#e5e7eb;
    --accent:#4f46e5; --accent-soft:#eef2ff;
    --ok-bg:#ecfdf5; --ok-fg:#065f46; --ok-border:#a7f3d0;
    --warn-bg:#fff7ed; --warn-fg:#9a3412; --warn-border:#fed7aa;
    --shadow: 0 1px 2px rgba(15,23,42,.04), 0 4px 16px rgba(15,23,42,.06);
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg:#0b1020; --fg:#e6e9f2; --muted:#94a3b8;
      --card:#121a33; --card-border:#1f2a4a;
      --accent:#818cf8; --accent-soft:#1a2350;
      --ok-bg:#0f2a22; --ok-fg:#6ee7b7; --ok-border:#134e3a;
      --warn-bg:#2a1a0d; --warn-fg:#fdba74; --warn-border:#7c3a14;
      --shadow: 0 1px 2px rgba(0,0,0,.4), 0 8px 24px rgba(0,0,0,.35);
    }
  }
  html, body { background: var(--bg); color: var(--fg); }
  body { font-family: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, Arial, sans-serif; margin:0; padding:32px; -webkit-font-smoothing: antialiased; }
  .wrap { max-width:980px; margin:0 auto; }
  .topbar { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:24px; gap:16px; flex-wrap:wrap; }
  .brand { display:flex; align-items:center; gap:12px; }
  .brand .dot { width:10px; height:10px; border-radius:999px; background:var(--accent); box-shadow:0 0 0 4px var(--accent-soft); }
  .brand h1 { margin:0; font-size:22px; letter-spacing:-.01em; }
  .meta { font-size:12px; color:var(--muted); text-align:right; line-height:1.6; }
  .actions { display:flex; gap:8px; justify-content:flex-end; margin-top:8px; }
  .btn { appearance:none; border:1px solid var(--card-border); background:var(--card); color:var(--fg); padding:8px 14px; border-radius:10px; font-size:13px; cursor:pointer; box-shadow:var(--shadow); }
  .btn:hover { border-color:var(--accent); color:var(--accent); }
  .scope { display:inline-block; padding:6px 12px; border-radius:999px; background:var(--accent-soft); color:var(--accent); font-size:12px; font-weight:600; margin-bottom:24px; }
  .card { background:var(--card); border:1px solid var(--card-border); border-radius:16px; padding:22px 24px; margin-bottom:20px; box-shadow:var(--shadow); page-break-inside:avoid; break-inside:avoid; }
  .card h2 { margin:0 0 16px; font-size:13px; font-weight:700; text-transform:uppercase; letter-spacing:.08em; color:var(--muted); }
  .kpi-grid { display:grid; gap:14px; grid-template-columns:repeat(auto-fit, minmax(180px,1fr)); }
  .kpi { background:var(--bg); border:1px solid var(--card-border); border-radius:12px; padding:14px 16px; }
  .kpi-label { font-size:12px; color:var(--muted); margin-bottom:6px; }
  .kpi-value { font-size:22px; font-weight:700; letter-spacing:-.01em; font-variant-numeric:tabular-nums; }
  .setor-grid { display:grid; gap:16px; grid-template-columns:repeat(auto-fit, minmax(280px,1fr)); }
  .setor-card { border:1px solid var(--card-border); border-radius:14px; padding:16px 18px; background:var(--bg); }
  .setor-head { margin-bottom:12px; padding-bottom:10px; border-bottom:1px dashed var(--card-border); }
  .setor-name { font-size:15px; font-weight:700; }
  .setor-meta { font-size:12px; color:var(--muted); margin-top:2px; }
  .setor-rows { display:flex; flex-direction:column; gap:8px; }
  .setor-row { display:flex; justify-content:space-between; gap:12px; font-size:13px; }
  .setor-row-label { color:var(--muted); }
  .setor-row-value { font-variant-numeric:tabular-nums; font-weight:600; }
  .destaques { list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:10px; }
  .destaques li { padding:12px 14px; border-radius:10px; font-size:13.5px; line-height:1.45; border:1px solid var(--card-border); background:var(--bg); }
  .destaques li.ok { background:var(--ok-bg); color:var(--ok-fg); border-color:var(--ok-border); }
  .destaques li.warn { background:var(--warn-bg); color:var(--warn-fg); border-color:var(--warn-border); }
  .rank { list-style:none; padding:0; margin:0; }
  .rank li { display:flex; align-items:center; gap:14px; padding:12px 4px; border-bottom:1px dashed var(--card-border); }
  .rank li:last-child { border-bottom:none; }
  .rank-pos { flex:0 0 auto; width:28px; height:28px; border-radius:8px; display:inline-flex; align-items:center; justify-content:center; background:var(--accent-soft); color:var(--accent); font-weight:700; font-size:13px; }
  .rank-main { flex:1 1 auto; min-width:0; }
  .rank-name { font-size:14px; font-weight:600; }
  .rank-extra { font-size:12px; color:var(--muted); margin-top:2px; }
  .rank-value { font-variant-numeric:tabular-nums; font-weight:700; font-size:15px; }
  pre.raw { white-space:pre-wrap; word-wrap:break-word; margin:0; font-size:13px; line-height:1.6; color:var(--fg); }
  .footer-meta { color:var(--muted); font-size:11px; text-align:center; margin-top:8px; }
  @media print {
    body { padding:0; background:#fff; color:#000; }
    .actions, .btn { display:none !important; }
    .card { box-shadow:none; border-color:#ddd; background:#fff; }
    .kpi, .setor-card { background:#fafafa; }
    .scope { background:#eef; color:#224; }
    pre.raw, .kpi-value, .rank-value, .setor-row-value { color:#000 !important; }
  }
</style>
</head>
<body>
  <div class="wrap">
    <div class="topbar">
      <div class="brand"><span class="dot"></span><h1>${title}</h1></div>
      <div>
        <div class="meta">Gerado em ${escapeHtml(dateStr)}</div>
        <div class="actions"><button class="btn" onclick="window.print()">Imprimir / Salvar PDF</button></div>
      </div>
    </div>
    ${escopo ? `<div class="scope">${escapeHtml(escopo)}</div>` : ''}
    ${sectionsHTML}
    <div class="footer-meta">${escapeHtml(title)} · ${now.getFullYear()}</div>
  </div>
</body>
</html>`;
}

