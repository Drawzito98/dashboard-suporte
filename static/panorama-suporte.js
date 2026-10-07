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
    if (!options.sector.trim() || !options.start || !options.end || options.start > options.end) throw new Error('Informe o setor e um intervalo de datas válido.');
    const key = { FINALIZADOS: 'finalizados', CSAT: 'csat', SCORE: 'score' }[options.order];
    if (!key) throw new Error('Critério de ordenação inválido.');
    if (key === 'score' && rows.some(r => r.score === null)) throw new Error('Para ordenar por SCORE, inclua uma coluna SCORE numérica no CSV.');
    const sum = field => rows.reduce((total, row) => total + row[field], 0);
    const ranking = rows.map(r => ({ ...r, name: options.hide ? r.alias : r.name })).sort((a, b) => a[key] === null ? (b[key] === null ? 0 : 1) : b[key] === null ? -1 : b[key] - a[key]);
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
    const html = `<div class="panorama-report-head"><div><span class="panorama-eyebrow">PANORAMA DO SETOR</span><h2>${escape(options.sector.trim())}</h2><p>${date(options.start)} a ${date(options.end)} · ${rows.length} atendentes</p></div><span class="panorama-pill">${options.hide ? '🔒 Nomes ocultos' : 'Exibição interna'}</span></div><div class="panorama-metrics">${metrics.map(([, value], i) => `<article class="panorama-metric"><span class="panorama-metric-icon" aria-hidden="true">${icons[i]}</span><span class="panorama-metric-label">${labels[i]}</span><strong>${escape(value)}</strong><small>${i === 2 ? 'Soma por atendente' : i === 3 ? `${evaluated.length} atendentes com avaliação` : i === 1 || i > 3 ? 'Média simples do time' : 'Total do período'}</small></article>`).join('')}</div><div class="panorama-section-head"><div><h3>Ranking de performance</h3><p>Resultados individuais do período</p></div><span class="panorama-pill">Ordenado por ${options.order}</span></div><div class="panorama-table-wrap" tabindex="0" role="region" aria-label="Ranking de performance"><table class="panorama-table"><thead><tr>${headers.map(h => `<th scope="col">${escape(h)}</th>`).join('')}</tr></thead><tbody>${cells.map((row, i) => `<tr class="${i < 3 && !(key === 'csat' && ranking[i].csat === null) ? 'panorama-top' : ''}">${row.map((cell, col) => `<td class="${col === 1 ? 'panorama-name' : ''}">${col === 0 ? `<span class="panorama-position">${escape(cell)}</span>` : escape(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div><p class="panorama-footnote">Clientes atendidos é a soma por pessoa e pode incluir clientes presentes em mais de um atendente.</p><div class="panorama-analysis"><article><span class="panorama-eyebrow">✦ DESTAQUE DO PERÍODO</span><p>${escape(highlight)}</p></article><article><span class="panorama-eyebrow">◷ PONTO DE ATENÇÃO</span><p>${escape(attention)}</p></article></div>`;
    return { markdown: csatNote ? `${markdown}\n${csatNote}\n` : markdown, html: csatNote ? `${html}<p>${escape(csatNote)}</p>` : html, ranking, metrics };
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { process, report, time };
  if (typeof document === 'undefined') return;
  document.addEventListener('DOMContentLoaded', () => {
    const root = document.getElementById('panoramaSuporteRoot');
    if (!root) return;
    root.classList.add('panorama');
    root.innerHTML = `<div class="panorama-intro"><div><span class="panorama-eyebrow">RELATÓRIO DE PERFORMANCE</span><h2>Panorama parcial de suporte</h2><p>Transforme o CSV do seu setor em uma visão clara do desempenho do time.</p></div><span class="panorama-pill">🔒 Privacidade configurável</span></div><form id="panoramaForm"><div class="panorama-fields"><label>Setor<input name="sector" placeholder="Ex.: Suporte ERP" required maxlength="150"></label><label>Data início<input name="start" type="date" required></label><label>Data fim<input name="end" type="date" required></label><label>Visualização<select name="privacy"><option value="hide">Ocultar nomes</option><option value="show">Exibir nomes</option></select></label><label>Ordenar ranking por<select name="order"><option value="FINALIZADOS">Finalizados</option><option value="CSAT">Satisfação (CSAT)</option><option value="SCORE">Score do CSV</option></select></label></div><div class="panorama-upload-row"><label class="panorama-upload"><span class="panorama-upload-icon" aria-hidden="true">↑</span><span><strong>CSV de Performance por colaborador</strong><small>Um setor, uma linha por pessoa, período consolidado.</small><input name="file" type="file" accept=".csv,text/csv" required></span></label><button class="btn-primary panorama-generate" type="submit">Gerar panorama <span aria-hidden="true">→</span></button></div><details class="panorama-help"><summary>Como preparar o arquivo</summary><p>Inclua Atendente, Finalizados, Clientes atendidos, Média avaliação, TMA e TMR. Os tempos devem estar em HH:MM:SS. Para ordenar por Score, inclua a coluna SCORE. Assumidos, Transferidos e TMF 80% são ignorados. As datas identificam o período consolidado no CSV.</p></details></form><div class="panorama-toolbar"><p id="panoramaStatus" role="status" aria-live="polite"></p><button id="panoramaDownload" class="btn-small" type="button" hidden>↓ Baixar Markdown</button></div><div id="panoramaOutput"></div><div id="panoramaEmpty" class="panorama-empty"><span aria-hidden="true">▥</span><h3>Seu time em uma só visão</h3><p>Selecione o arquivo e gere o panorama para visualizar os indicadores e o ranking.</p></div>`;
    const form = root.querySelector('form');
    const output = root.querySelector('#panoramaOutput');
    const status = root.querySelector('#panoramaStatus');
    const download = root.querySelector('#panoramaDownload');
    const empty = root.querySelector('#panoramaEmpty');
    let current = null;
    let version = 0;
    function clear() { version++; current = null; output.innerHTML = ''; download.hidden = true; empty.hidden = false; status.textContent = ''; status.removeAttribute('data-state'); }
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
        current = report(process(parsed.data, parsed.meta.fields), { sector: values.get('sector'), start: values.get('start'), end: values.get('end'), hide: values.get('privacy') === 'hide', order: values.get('order') });
        output.innerHTML = current.html;
        download.hidden = false;
        empty.hidden = true;
        status.dataset.state = 'success';
        status.textContent = `Relatório gerado com ${current.ranking.length} atendentes.`;
      } catch (error) { if (requestVersion !== version) return; status.dataset.state = 'error'; status.textContent = error.message; }
    });
    download.addEventListener('click', () => {
      if (!current) return;
      const url = URL.createObjectURL(new Blob([current.markdown], { type: 'text/markdown;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url; link.download = 'panorama-suporte.md'; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  });
})();
