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
      const csat = number(get('media avaliacao'), `${label}, CSAT`);
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
    const ranking = rows.map(r => ({ ...r, name: options.hide ? r.alias : r.name })).sort((a, b) => b[key] - a[key]);
    const metrics = [ ['Total de Finalizados no Setor', fmt(sum('finalizados'))], ['Média de Finalizados por Atendente', fmt(sum('finalizados') / rows.length, 2)], ['Clientes Atendidos (soma por atendente)', fmt(sum('clientes'))], ['Média de Satisfação (CSAT)', `${fmt(sum('csat') / rows.length, 2)} / 5,00`], ['TMA Médio do Setor', time(sum('tma') / rows.length)], ['TMR Médio do Setor', time(sum('tmr') / rows.length)] ];
    const best = [...ranking].sort((a, b) => b.finalizados - a.finalizados)[0];
    const slow = [...ranking].sort((a, b) => b.tmr - a.tmr || b.tma - a.tma)[0];
    const highlight = `${best.name} liderou o volume com ${fmt(best.finalizados)} finalizados e CSAT ${fmt(best.csat, 2)}.`;
    const attention = `${slow.name} apresentou o maior TMR (${time(slow.tmr)}); revisar o contexto dos atendimentos antes de definir ações.`;
    const date = value => value.split('-').reverse().join('/');
    const title = `📊 Panorama Parcial de Suporte - Setor ${options.sector.trim()}`;
    const subtitle = `Período: ${date(options.start)} a ${date(options.end)} | Visualização: ${options.hide ? 'Exibição Pública / Anonimizada' : 'Exibição Interna'}`;
    const headers = ['Posição', 'Atendente', 'Finalizados', 'Clientes Atendidos', 'CSAT (Média)', 'TMA', 'TMR'];
    if (key === 'score') headers.push('SCORE');
    const cells = ranking.map((r, i) => [position(i), r.name, fmt(r.finalizados), fmt(r.clientes), fmt(r.csat, 2), time(r.tma), time(r.tmr), ...(key === 'score' ? [fmt(r.score, 2)] : [])]);
    const markdown = `# ${md(title)}\n**${md(subtitle)}**\n\n---\n\n## 📈 CARDS DE DESEMPENHO DO SETOR\n${metrics.map(([k, v]) => `- 🔹 ${k}: ${v}`).join('\n')}\n\nClientes atendidos é a soma por pessoa; um cliente pode aparecer em mais de um atendente.\n\n---\n\n## 🏆 RANKING DE PERFORMANCE\n*Ordenado por: ${options.order}*\n\n| ${headers.join(' | ')} |\n| ${headers.map(() => ':---:').join(' | ')} |\n${cells.map(row => `| ${row.map(md).join(' | ')} |`).join('\n')}\n\n---\n\n## 💡 ANÁLISE RÁPIDA DA GESTÃO\n- **Destaque do Período:** ${md(highlight)}\n- **Ponto de Atenção:** ${md(attention)}\n`;
    const html = `<h2>${escape(title)}</h2><p>${escape(subtitle)}</p><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px">${metrics.map(([label, value]) => `<div class="card"><div>${escape(label)}</div><strong style="font-size:1.5rem">${escape(value)}</strong></div>`).join('')}</div><p class="muted">Clientes atendidos é a soma por pessoa; um cliente pode aparecer em mais de um atendente.</p><h3>🏆 Ranking de performance</h3><p>Ordenado por: ${options.order}</p><div style="overflow-x:auto"><table style="width:100%"><thead><tr>${headers.map(h => `<th>${escape(h)}</th>`).join('')}</tr></thead><tbody>${cells.map(row => `<tr>${row.map(cell => `<td>${escape(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div><h3>💡 Análise rápida da gestão</h3><p><strong>Destaque do Período:</strong> ${escape(highlight)}</p><p><strong>Ponto de Atenção:</strong> ${escape(attention)}</p>`;
    return { markdown, html, ranking, metrics };
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { process, report, time };
  if (typeof document === 'undefined') return;
  document.addEventListener('DOMContentLoaded', () => {
    const root = document.getElementById('panoramaSuporteRoot');
    if (!root) return;
    root.innerHTML = `<h2>📊 Panorama parcial de suporte</h2><p>Importe o CSV de Performance por colaborador de um único setor, consolidado no período informado. O arquivo será usado apenas neste relatório.</p><form id="panoramaForm"><div style="display:flex;flex-wrap:wrap;gap:12px;align-items:end"><label>Setor<br><input name="sector" required maxlength="150"></label><label>Data início<br><input name="start" type="date" required></label><label>Data fim<br><input name="end" type="date" required></label><label>Visualização<br><select name="privacy"><option value="hide">Ocultar nomes</option><option value="show">Exibir nomes</option></select></label><label>Ordenar por<br><select name="order"><option>FINALIZADOS</option><option>CSAT</option><option>SCORE</option></select></label><label>Arquivo CSV<br><input name="file" type="file" accept=".csv,text/csv" required></label><button class="btn-primary" type="submit">Gerar panorama</button></div><p>SCORE requer uma coluna SCORE adicional. Colunas Assumidos, Transferidos e TMF 80% são ignoradas. Datas identificam o período já consolidado no arquivo.</p></form><p id="panoramaStatus" role="status" aria-live="polite"></p><button id="panoramaDownload" class="btn-small" type="button" hidden>Baixar Markdown</button><div id="panoramaOutput"></div>`;
    const form = root.querySelector('form');
    const output = root.querySelector('#panoramaOutput');
    const status = root.querySelector('#panoramaStatus');
    const download = root.querySelector('#panoramaDownload');
    let current = null;
    let version = 0;
    function clear() { version++; current = null; output.innerHTML = ''; download.hidden = true; status.textContent = ''; }
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
        status.textContent = `Relatório gerado com ${current.ranking.length} atendentes.`;
      } catch (error) { status.textContent = error.message; }
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
