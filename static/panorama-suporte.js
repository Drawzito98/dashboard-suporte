/* Panorama de um CSV consolidado por atendente. Dados mantidos apenas em memória. */
(function () {
  'use strict';
  const normalize = value => String(value).replace(/^\uFEFF/, '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase().replace(/\s+/g, ' ');
  const number = (value, label, integer = false) => {
    let raw = String(value ?? '').trim().replace(/\s/g, '');
    if (raw.includes(',')) raw = raw.replace(/\./g, '').replace(',', '.');
    else if (integer && /^\d{1,3}(\.\d{3})+$/.test(raw)) raw = raw.replace(/\./g, '');
    const n = Number(raw);
    if (!raw || !Number.isFinite(n) || n < 0 || (integer && !Number.isInteger(n))) throw new Error(`${label}: valor inválido.`);
    return n;
  };
  const seconds = (value, label) => {
    const match = String(value ?? '').trim().match(/^(\d+):([0-5]\d):([0-5]\d)$/);
    if (!match) throw new Error(`${label}: use HH:MM:SS.`);
    return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
  };
  const time = value => {
    const n = Math.round(value);
    return [Math.floor(n / 3600), Math.floor(n / 60) % 60, n % 60].map(v => String(v).padStart(2, '0')).join(':');
  };
  const fmt = (n, digits = 0) => n.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const md = value => String(value).replace(/[\r\n]+/g, ' ').replace(/([\\`*_{}\[\]<>#|])/g, '\\$1');
  const position = i => `${['🥇 ', '🥈 ', '🥉 '][i] || ''}${i + 1}º`;

  function process(data, fields) {
    const map = Object.fromEntries(fields.map(f => [normalize(f), f]));
    const required = ['atendente', 'finalizados', 'clientes atendidos', 'media avaliacao', 'tma', 'tmr'];
    const missing = required.filter(key => !map[key]);
    if (missing.length) throw new Error(`Colunas ausentes: ${missing.join(', ')}.`);
    const seen = new Set();
    const rows = [];
    data.forEach((raw, index) => {
      const get = key => raw[map[key]];
      const name = String(get('atendente') ?? '').trim();
      if (/^(total|totais|m[eé]dia(?: do setor| setor)?|total geral)$/i.test(name)) return;
      const label = `Linha ${index + 2}`;
      if (!name) throw new Error(`${label}: atendente vazio.`);
      if (seen.has(normalize(name))) throw new Error(`${label}: atendente repetido. Use um CSV consolidado com uma linha por pessoa.`);
      seen.add(normalize(name));
      const rawCsat = String(get('media avaliacao') ?? '').trim();
      const missingCsat = /^(?:|[-–—]+|n\/?a|n\/?d|sem avalia[cç][aã]o|n[aã]o avaliado)$/i.test(rawCsat);
      const csat = missingCsat ? null : number(rawCsat, `${label}, CSAT (esperado: nota de 0 a 5 ou vazio quando não avaliado)`);
      if (csat > 5) throw new Error(`${label}: CSAT deve estar entre 0 e 5.`);
      rows.push({ name, alias: `Atendente ${String(rows.length + 1).padStart(2, '0')}`, finalizados: number(get('finalizados'), `${label}, Finalizados`, true), clientes: number(get('clientes atendidos'), `${label}, Clientes atendidos`, true), csat, tma: seconds(get('tma'), `${label}, TMA`), tmr: seconds(get('tmr'), `${label}, TMR`), score: map.score ? number(get('score'), `${label}, SCORE`) : null });
    });
    if (!rows.length) throw new Error('O CSV não contém atendentes válidos.');
    return rows;
  }

  function report(rows, options) {
    const isAI = row => /^cadu(?:\s*[-–(]?\s*(?:ia|inteligencia artificial)\)?)?$/.test(normalize(row.name));
    const ai = rows.filter(isAI);
    if (options.separateAI && ai.length) {
      const humans = rows.filter(row => !isAI(row)).map((row, index) => ({ ...row, alias: `Atendente ${String(index + 1).padStart(2, '0')}` }));
      if (!humans.length) throw new Error('O arquivo contém apenas o CADU. Selecione incluir CADU nos indicadores para gerar o panorama da IA.');
      const result = report(humans, { ...options, separateAI: false });
      const note = 'CADU é uma IA e está separado da equipe humana: seus resultados não entram nos cards, médias ou ranking acima.';
      const details = ai.map(row => `<article class="panorama-ai"><span class="panorama-eyebrow">CADU · INTELIGÊNCIA ARTIFICIAL</span><h3>Atendimento por IA</h3><p>${escape(note)}</p><div class="panorama-ai-values"><span><small>Finalizados</small><strong>${fmt(row.finalizados)}</strong></span><span><small>Clientes atendidos</small><strong>${fmt(row.clientes)}</strong></span><span><small>CSAT</small><strong>${row.csat === null ? 'Sem avaliação' : fmt(row.csat, 2)}</strong></span><span><small>TMA</small><strong>${time(row.tma)}</strong></span><span><small>TMR</small><strong>${time(row.tmr)}</strong></span></div></article>`).join('');
      result.html += details;
      result.markdown += `\n## 🤖 CADU — Inteligência artificial\n${note}\n` + ai.map(row => `- Finalizados: ${fmt(row.finalizados)} | Clientes: ${fmt(row.clientes)} | CSAT: ${row.csat === null ? 'Sem avaliação' : fmt(row.csat, 2)} | TMA: ${time(row.tma)} | TMR: ${time(row.tmr)}`).join('\n') + '\n';
      result.aiCount = ai.length;
      return result;
    }

    if (!options.sector.trim() || !options.start || !options.end || options.start > options.end) throw new Error('Informe o setor e um intervalo de datas válido.');
    const key = { FINALIZADOS: 'finalizados', CSAT: 'csat', SCORE: 'score' }[options.order];
    if (!key) throw new Error('Critério de ordenação inválido.');
    if (key === 'score' && rows.some(r => r.score === null)) throw new Error('Para ordenar por SCORE, inclua uma coluna SCORE numérica no CSV.');
    const sum = field => rows.reduce((total, row) => total + row[field], 0);
    const ranking = rows.map(r => ({ ...r, name: isAI(r) ? 'CADU (IA)' : options.hide ? r.alias : r.name })).sort((a, b) => a[key] === null ? (b[key] === null ? 0 : 1) : b[key] === null ? -1 : b[key] - a[key]);
    const evaluated = rows.filter(r => r.csat !== null);
    const csatText = value => value === null ? 'Sem avaliação' : fmt(value, 2);
    const csatNote = evaluated.length < rows.length ? `CSAT calculado pela média simples de ${evaluated.length} dos ${rows.length} atendentes com nota disponível. Valores ausentes não são tratados como zero e ficam no fim do ranking por CSAT.` : '';
    const metrics = [ ['Total de Finalizados no Setor', fmt(sum('finalizados'))], ['Média de Finalizados por Atendente', fmt(sum('finalizados') / rows.length, 2)], ['Clientes Atendidos (soma por atendente)', fmt(sum('clientes'))], ['Média de Satisfação (CSAT)', evaluated.length ? `${fmt(sum('csat') / evaluated.length, 2)} / 5,00` : 'Sem avaliação'], ['TMA Médio do Setor', time(sum('tma') / rows.length)], ['TMR Médio do Setor', time(sum('tmr') / rows.length)] ];
    const best = [...ranking].sort((a, b) => b.finalizados - a.finalizados)[0];
    const slow = [...ranking].sort((a, b) => b.tmr - a.tmr || b.tma - a.tma)[0];
    const highlight = `${best.name} liderou o volume com ${fmt(best.finalizados)} finalizados; CSAT: ${csatText(best.csat)}.`;
    const attention = `${slow.name} apresentou o maior TMR (${time(slow.tmr)}); revisar o contexto dos atendimentos antes de definir ações.`;
    const date = value => value.split('-').reverse().join('/');
    const title = `📊 Panorama Parcial de Suporte - Setor ${options.sector.trim()}`;
    const subtitle = `Período: ${date(options.start)} a ${date(options.end)} | Visualização: ${options.hide ? 'Exibição Pública / Anonimizada' : 'Exibição Interna'}`;
    const headers = ['Posição', 'Atendente', 'Finalizados', 'Clientes Atendidos', 'CSAT (Média)', 'TMA', 'TMR'];
    if (key === 'score') headers.push('SCORE');
    const cells = ranking.map((r, i) => [key === 'csat' && r.csat === null ? 'Sem classificação' : position(i), r.name, fmt(r.finalizados), fmt(r.clientes), csatText(r.csat), time(r.tma), time(r.tmr), ...(key === 'score' ? [fmt(r.score, 2)] : [])]);
    const markdown = `# ${md(title)}\n**${md(subtitle)}**\n\n---\n\n## 📈 CARDS DE DESEMPENHO DO SETOR\n${metrics.map(([k, v]) => `- 🔹 ${k}: ${v}`).join('\n')}\n\nClientes atendidos é a soma por pessoa; um cliente pode aparecer em mais de um atendente.\n\n---\n\n## 🏆 RANKING DE PERFORMANCE\n*Ordenado por: ${options.order}*\n\n| ${headers.join(' | ')} |\n| ${headers.map(() => ':---:').join(' | ')} |\n${cells.map(row => `| ${row.map(md).join(' | ')} |`).join('\n')}\n\n---\n\n## 💡 ANÁLISE RÁPIDA DA GESTÃO\n- **Destaque do Período:** ${md(highlight)}\n- **Ponto de Atenção:** ${md(attention)}\n`;
    const icons = ['✓', '↗', '♧', '★', '◷', '↩'];
    const labels = ['Finalizados', 'Finalizados por atendente', 'Clientes atendidos', 'Satisfação · CSAT', 'Tempo médio de atendimento', 'Tempo médio de resposta'];
    let html = `<div class="panorama-report-head"><div><span class="panorama-eyebrow">PANORAMA DO SETOR</span><h2>${escape(options.sector.trim())}</h2><p>${date(options.start)} a ${date(options.end)} · ${rows.length} atendentes</p></div><span class="panorama-pill">${options.hide ? '🔒 Nomes ocultos' : 'Exibição interna'}</span></div><div class="panorama-metrics">${metrics.map(([, value], i) => `<article class="panorama-metric"><span class="panorama-metric-icon" aria-hidden="true">${icons[i]}</span><span class="panorama-metric-label">${labels[i]}</span><strong>${escape(value)}</strong><small>${i === 2 ? 'Soma por atendente' : i === 3 ? `${evaluated.length} atendentes com avaliação` : i === 1 || i > 3 ? 'Média simples do time' : 'Total do período'}</small></article>`).join('')}</div><div class="panorama-section-head"><div><h3>Ranking de performance</h3><p>Resultados individuais do período</p></div><span class="panorama-pill">Ordenado por ${options.order}</span></div><div class="panorama-table-wrap" tabindex="0" role="region" aria-label="Ranking de performance"><table class="panorama-table"><thead><tr>${headers.map(h => `<th scope="col">${escape(h)}</th>`).join('')}</tr></thead><tbody>${cells.map((row, i) => `<tr class="${i < 3 && !(key === 'csat' && ranking[i].csat === null) ? 'panorama-top' : ''}">${row.map((cell, col) => `<td class="${col === 1 ? 'panorama-name' : ''}">${col === 0 ? `<span class="panorama-position">${escape(cell)}</span>` : escape(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div><p class="panorama-footnote">Clientes atendidos é a soma por pessoa e pode incluir clientes presentes em mais de um atendente.</p><div class="panorama-analysis"><article><span class="panorama-eyebrow">✦ DESTAQUE DO PERÍODO</span><p>${escape(highlight)}</p></article><article><span class="panorama-eyebrow">◷ PONTO DE ATENÇÃO</span><p>${escape(attention)}</p></article></div>`;
    if (ai.length) html += '<p class="panorama-footnote">CADU é uma IA. Nesta visualização, seus resultados estão incluídos nos indicadores e no ranking.</p>';
    const aiNote = ai.length ? '\nCADU é uma IA; seus resultados estão incluídos nos indicadores e no ranking.\n' : '';
    return { markdown: csatNote ? `${markdown}\n${csatNote}\n${aiNote}` : markdown + aiNote, html: csatNote ? `${html}<p>${escape(csatNote)}</p>` : html, ranking, metrics };
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { process, report, time };
  if (typeof document === 'undefined') return;
  document.addEventListener('DOMContentLoaded', () => {
    const root = document.getElementById('panoramaSuporteRoot');
    if (!root) return;
    root.classList.add('panorama');
    root.innerHTML = `<div class="panorama-intro"><div><span class="panorama-eyebrow">RELATÓRIO DE PERFORMANCE</span><h2>Panorama parcial de suporte</h2><p>Transforme o CSV do seu setor em uma visão clara do desempenho do time.</p></div><div class="panorama-source-actions"><a class="panorama-source-link" href="https://ixcsoft.cloud.looker.com/embed/dashboards/67?Per%C3%ADodo=this+month&amp;Atendimento+Humano=Yes&amp;Motivo+de+atendimento=&amp;Etiqueta=&amp;Status=&amp;Departamento=&amp;Atendente=&amp;Avalia%C3%A7%C3%A3o=&amp;Canal+de+atendimento=&amp;Atendimentos+com+Cart%C3%A3o+Vinculado=&amp;Protocolo=&amp;Ultimo+Atendente=&amp;Unidade+de+Neg%C3%B3cio=&amp;Filial=" target="_blank" rel="noopener noreferrer">Abrir Looker de origem <span aria-hidden="true">↗</span></a><span class="panorama-pill">🔒 Privacidade configurável</span></div></div><form id="panoramaForm"><div class="panorama-fields"><label>Setor<input name="sector" placeholder="Ex.: Suporte ERP" required maxlength="150"></label><label>Data início<input name="start" type="date" required></label><label>Data fim<input name="end" type="date" required></label><label>Visualização<select name="privacy"><option value="hide">Ocultar nomes</option><option value="show">Exibir nomes</option></select></label><label>Ordenar ranking por<select name="order"><option value="FINALIZADOS">Finalizados</option><option value="CSAT">Satisfação (CSAT)</option><option value="SCORE">Score do CSV</option></select></label><label>CADU · Inteligência artificial<select name="aiMode"><option value="separate">Separar da equipe humana</option><option value="include">Incluir nos indicadores (IA)</option></select></label></div><div class="panorama-upload-row"><label class="panorama-upload"><span class="panorama-upload-icon" aria-hidden="true">↑</span><span><strong>CSV de Performance por colaborador</strong><small>Um setor, uma linha por pessoa, período consolidado.</small><input name="file" type="file" accept=".csv,text/csv" required></span></label><button class="btn-primary panorama-generate" type="submit">Gerar panorama <span aria-hidden="true">→</span></button></div><details class="panorama-help"><summary>Como preparar o arquivo</summary><p>Inclua Atendente, Finalizados, Clientes atendidos, Média avaliação, TMA e TMR. Os tempos devem estar em HH:MM:SS. Para ordenar por Score, inclua a coluna SCORE. Assumidos, Transferidos e TMF 80% são ignorados. As datas identificam o período consolidado no CSV. O link de origem abre o mês atual com Atendimento Humano = Yes; confira o período, o setor e esse filtro antes de exportar, principalmente para incluir o CADU.</p></details></form><div class="panorama-toolbar"><p id="panoramaStatus" role="status" aria-live="polite"></p><div class="panorama-export-actions" id="panoramaExports" hidden><button id="panoramaPng" class="btn-small" type="button">↓ PNG</button><button id="panoramaPdf" class="btn-small" type="button">↓ PDF</button><button id="panoramaDownload" class="btn-small" type="button" >↓ Markdown</button></div></div><div id="panoramaOutput"></div><div id="panoramaEmpty" class="panorama-empty"><span aria-hidden="true">▥</span><h3>Seu time em uma só visão</h3><p>Selecione o arquivo e gere o panorama para visualizar os indicadores e o ranking.</p></div>`;
    const form = root.querySelector('form');
    const output = root.querySelector('#panoramaOutput');
    const status = root.querySelector('#panoramaStatus');
    const download = root.querySelector('#panoramaDownload');
    const empty = root.querySelector('#panoramaEmpty');
    const exports = root.querySelector('#panoramaExports');
    const exportButtons = [...exports.querySelectorAll('button')];
    let current = null;
    let version = 0;
    function clear() { version++; current = null; output.innerHTML = ''; download.hidden = true; exports.hidden = true; empty.hidden = false; status.textContent = ''; status.removeAttribute('data-state'); }
    form.addEventListener('input', clear);
    form.addEventListener('change', clear);
    form.addEventListener('submit', async event => {
      event.preventDefault();
      clear();
      const requestVersion = version;
      const values = new FormData(form);
      status.textContent = 'Processando CSV…';
      try {
        const parsed = await parseCsvFile(values.get('file'));
        if (requestVersion !== version) return;
        if (parsed.errors?.length) throw new Error('CSV inválido. Verifique delimitadores e quantidade de colunas.');
        current = report(process(parsed.data, parsed.meta.fields), { sector: values.get('sector'), start: values.get('start'), end: values.get('end'), hide: values.get('privacy') === 'hide', order: values.get('order'), separateAI: values.get('aiMode') === 'separate' });
        output.innerHTML = current.html;
        download.hidden = false;
        exports.hidden = false;
        empty.hidden = true;
        status.dataset.state = 'success';
        status.textContent = `Relatório gerado com ${current.ranking.length} atendentes${current.aiCount ? ' e CADU separado como IA' : ''}.`;
      } catch (error) { if (requestVersion !== version) return; status.dataset.state = 'error'; status.textContent = error.message; }
    });
    async function exportVisual(format) {
      if (!current) return;
      const exportVersion = version;
      let clone;
      exportButtons.forEach(button => button.disabled = true);
      status.textContent = `Preparando ${format.toUpperCase()}…`;
      try {
        if (typeof window.html2canvas !== 'function' || (format === 'pdf' && !window.jspdf?.jsPDF)) throw new Error('A ferramenta de exportação não carregou. Atualize a página e tente novamente.');
        clone = document.createElement('section');
        clone.className = 'panorama panorama-export';
        clone.innerHTML = current.html;
        clone.style.cssText = 'position:absolute;left:-100000px;top:0;width:1120px;padding:32px;box-sizing:border-box;background:var(--bg-surface);';
        document.body.appendChild(clone);
        await document.fonts.ready;
        const bounds = clone.getBoundingClientRect();
        const breaks = [...clone.querySelectorAll('.panorama-report-head,.panorama-metrics,.panorama-section-head,tr,.panorama-footnote,.panorama-analysis,.panorama-ai,p')].map(el => Math.round(el.getBoundingClientRect().bottom - bounds.top + 4)).sort((a, b) => a - b);
        const canvas = await window.html2canvas(clone, { scale: 2, backgroundColor: getComputedStyle(clone).backgroundColor, logging: false });
        if (exportVersion !== version) return;
        if (format === 'png') {
          const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
          if (!blob) throw new Error('Não foi possível criar o PNG.');
          if (exportVersion !== version) return;
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url; link.download = 'panorama-suporte.png'; link.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        } else {
          const doc = new window.jspdf.jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
          const width = doc.internal.pageSize.getWidth() - 20;
          const maxHeight = Math.floor((doc.internal.pageSize.getHeight() - 26) * canvas.width / width);
          let offset = 0;
          let page = 0;
          while (offset < canvas.height) {
            let end = Math.min(offset + maxHeight, canvas.height);
            if (end < canvas.height) {
              const candidates = breaks.map(v => v * 2).filter(v => v > offset + maxHeight * 0.35 && v <= end);
              if (candidates.length) end = candidates[candidates.length - 1];
            }
            const slice = document.createElement('canvas');
            slice.width = canvas.width; slice.height = end - offset;
            slice.getContext('2d').drawImage(canvas, 0, offset, canvas.width, slice.height, 0, 0, canvas.width, slice.height);
            if (page++) doc.addPage();
            doc.addImage(slice.toDataURL('image/jpeg', 0.92), 'JPEG', 10, 10, width, slice.height * width / canvas.width);
            doc.setFontSize(8); doc.setTextColor(100);
            doc.text(`Panorama de suporte | Página ${page}`, 10, doc.internal.pageSize.getHeight() - 6);
            offset = end;
          }
          doc.save('panorama-suporte.pdf');
        }
        status.dataset.state = 'success';
        status.textContent = `${format.toUpperCase()} exportado com os cards, ranking e análise da gestão.`;
      } catch (error) {
        if (exportVersion === version) { status.dataset.state = 'error'; status.textContent = error.message; }
      } finally {
        clone?.remove();
        exportButtons.forEach(button => button.disabled = false);
      }
    }
    root.querySelector('#panoramaPng').addEventListener('click', () => exportVisual('png'));
    root.querySelector('#panoramaPdf').addEventListener('click', () => exportVisual('pdf'));
    download.addEventListener('click', () => {
      if (!current) return;
      const url = URL.createObjectURL(new Blob([current.markdown], { type: 'text/markdown;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url; link.download = 'panorama-suporte.md'; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  });
})();
