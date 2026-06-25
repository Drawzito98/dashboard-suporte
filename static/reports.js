function clearReportTextOnly() {
  const ok = confirm('Apagar apenas o texto do relatório gerado?');
  if (!ok) return;
  const ta = document.getElementById('reportText');
  if (ta) ta.value = '';
  window.__lastReportText = '';
  // Mantém o painel e os dados; apenas remove o texto salvo do relatório
  saveState();
}
function generateAndShowReport() {
  // Gera o relatório e garante feedback visual (sem depender do botão "Atualizar")
  try {
    setLoading(true, 'Gerando relatório…');
    const card = document.getElementById('summaryCard');
    const ta = document.getElementById('reportText');

    const text = buildReportText();
    window.__lastReportText = text;

    if (card) card.style.display = 'block';
    if (ta) {
      ta.value = text;
      ta.focus({ preventScroll: true });
    }

    // rola até a seção do relatório para ficar óbvio que gerou
    const target = document.getElementById('summaryCard') || document.getElementById('summarySection') || ta;
    if (target && target.scrollIntoView) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
    const scores = rows.map(r => r['SCORE']).filter(v => v !== null && v !== undefined && !isNaN(Number(v)));
    const avgScore = scores.length ? scores.reduce((a, b) => a + Number(b), 0) / scores.length : 0;
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

