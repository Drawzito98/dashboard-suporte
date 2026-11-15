const catalog = {
  departments: ['performance_por_departamento.csv', [0, 1, 2, 6, 7, 8, 9]],
  team: ['performance_por_colaborador.csv', [0, 1, 2, 4, 5, 9]],
  quality: ['avaliação_por_colaborador__ia_×_cliente.csv', [0, 1, 3]],
  reasons: ['motivos_de_atendimento.csv', [0, 1, 2, 3]],
  stars: ['distribuição_de_notas_por_estrela.csv', [0, 1, 2, 3]],
  shifts: ['plantão__diurno_×_noturno.csv', [0, 1]],
  outcomes: ['plantão__resolvidos_×_repassados.csv', [0, 1]]
};
const TARGET_SCORE = 4.70;
const heatmapFile = 'assumidos_por_dia_×_hora.csv';
const subtotal = /^(?:total(?: geral)?|totais)$/i;
const quantity = value => Number(String(value).trim().replace(/\./g, ''));
const format = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });
const percent = (part, whole) => format.format(part / whole * 100) + '%';
const scoreFormat = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const date = value => value.split('-').reverse().join('/');
const peakBy = (rows, value) => rows.reduce((best, row) =>
  (!best || value(row) > value(best)) ? row : best, null);

export function buildAnalysis(reports, headers, days, kpis) {
  const tables = {};
  for (const [key, [file, columns]] of Object.entries(catalog)) {
    const rows = reports.get(file)?.filter(row => !subtotal.test(row[0].trim()));
    if (!rows?.length) continue;
    tables[key] = {
      headers: columns.map(column => headers.get(file)[column]),
      rows: rows.map(row => columns.map(column => row[column].trim()))
    };
  }
  for (const [key, column] of [['departments', 2], ['team', 2], ['reasons', 1]]) {
    tables[key]?.rows.sort((a, b) => quantity(b[column]) - quantity(a[column]));
  }
  if (tables.reasons) tables.reasons.rows = tables.reasons.rows.slice(0, 12);
  if (tables.team && tables.quality) {
    const keyFor = name => name.normalize('NFC').trim().toLocaleLowerCase('pt-BR');
    const averages = new Map(tables.quality.rows.map(row => [keyFor(row[0]), row.slice(1)]));
    tables.team.headers.push('Média IA', 'Média cliente');
    for (const row of tables.team.rows) row.push(...(averages.get(keyFor(row[0])) ?? ['—', '—']));
  }
  delete tables.quality;

  const heatmap = reports.get(heatmapFile)?.filter(row => /^[0-9]/.test(row[0].trim()))
    .map(row => [row[0], ...row.slice(1).map(value => value.trim() ? quantity(value) : null)]) ?? [];
  if (heatmap.length) tables.heatmap = { headers: ['Faixa', ...headers.get(heatmapFile).slice(1)], rows: heatmap };

  const target = TARGET_SCORE;
  const ratings = tables.stars?.rows.map(row => ({
    stars: Number(row[0].match(/\(([1-5])\)\s*$/)?.[1]),
    count: row.slice(1).reduce((total, value) => total + quantity(value), 0)
  }));
  const validRatings = ratings?.length === 5 && new Set(ratings.map(row => row.stars)).size === 5 &&
    ratings.every(row => row.stars >= 1 && row.stars <= 5 && Number.isSafeInteger(row.count));
  const ratingCount = validRatings ? ratings.reduce((total, row) => total + row.count, 0) : 0;
  const distributionMean = ratingCount > 0 && ratingCount === kpis.avaliados
    ? Math.round(ratings.reduce((total, row) => total + row.stars * row.count, 0) / ratingCount * 100) / 100
    : null;
  const reported = kpis.nota ?? null;
  const score = { target, reported, distributionMean, ratingCount,
    divergent: reported !== null && distributionMean !== null && reported !== distributionMean };
  const checks = [];
  if (score.divergent) {
    checks.push('Nota média: o cartão do Looker e a distribuição de estrelas divergem. Confira se os dois relatórios usam o mesmo filtro e a mesma população antes de concluir se a meta foi atingida.');
  }

  const findings = [];
  const summarize = (label, text) => findings.push(label + ': ' + text);
  const peak = peakBy(days, day => day.finalizados);
  if (peak?.finalizados && kpis.finalizados > 0) {
    const tiedDays = days.filter(day => day.finalizados === peak.finalizados).map(day => date(day.date));
    summarize('Maior volume diário', tiedDays.join(' e ') + ' · ' + format.format(peak.finalizados) +
      ' de ' + format.format(kpis.finalizados) + ' finalizados na semana (' + percent(peak.finalizados, kpis.finalizados) +
      (tiedDays.length > 1 ? ' em cada dia).' : ').'));
  }
  for (const day of days.filter(day => day.finalizados && !day.assumidos)) {
    summarize('Volume diário', date(day.date) + ' teve ' + format.format(day.finalizados) + ' finalizados e nenhum assumido.');
  }
  for (const [key, column, label] of [['departments', 2, 'Departamento com maior volume'], ['reasons', 1, 'Motivo com maior volume']]) {
    const row = tables[key]?.rows[0];
    const value = row && quantity(row[column]);
    if (value > 0 && kpis.finalizados > 0) {
      summarize(label, row[0] + ' · ' + format.format(value) + ' de ' + format.format(kpis.finalizados) +
        ' finalizados (' + percent(value, kpis.finalizados) + ').');
    }
  }
  if (tables.team && kpis.finalizados > 0) {
    tables.team.headers.push('% dos finalizados da semana');
    for (const row of tables.team.rows) {
      row.push(percent(quantity(row[2]), kpis.finalizados));
    }
  }
  const peakSlots = heatmap.flatMap(([range, ...volumes]) =>
    volumes.map((volume, index) => ({ range, day: tables.heatmap.headers[index + 1], volume })));
  const slot = peakBy(peakSlots.filter(item => Number.isFinite(item.volume)), item => item.volume);
  if (slot?.volume > 0) {
    const tied = peakSlots.filter(item => item.volume === slot.volume);
    summarize('Pico de assumidos', tied.map(item => item.day + ', ' + item.range).join(' · ') +
      ' · ' + format.format(slot.volume) + ' assumidos' + (tied.length > 1 ? ' em cada faixa.' : '.'));
  }
  if (kpis.total > 0 && kpis.avaliados !== undefined) {
    const lowRatings = tables.stars?.rows.reduce((sum, row) => sum + quantity(row[3]), 0);
    const low = kpis.avaliados > 0 && Number.isFinite(lowRatings)
      ? ' ' + format.format(lowRatings) + ' de ' + format.format(kpis.avaliados) + ' avaliações deram 1 ou 2 estrelas (' +
        percent(lowRatings, kpis.avaliados) + ').' : '';
    summarize('Avaliação do cliente', format.format(kpis.avaliados) + ' de ' + format.format(kpis.total) +
      ' atendimentos avaliados (' + percent(kpis.avaliados, kpis.total) + ').' + low);
  }
  if (kpis.total > 0 && kpis.inatividade !== undefined) {
    summarize('Encerrados por inatividade', format.format(kpis.inatividade) + ' de ' + format.format(kpis.total) +
      ' atendimentos no recorte (' + percent(kpis.inatividade, kpis.total) + ').');
  }
  if (kpis.fila !== undefined) {
    summarize('Cobertura do tempo de fila', format.format(kpis.fila) +
      (kpis.total > 0 ? ' de ' + format.format(kpis.total) + ' atendimentos (' + percent(kpis.fila, kpis.total) + ')' : ' atendimentos') +
      ' aparecem nas faixas de fila. Essa cobertura limita a interpretação do TME.');
  }
  if (kpis.inatividade > 0 && kpis.tmr !== null && kpis.tmr !== undefined) {
    checks.push('O TMR mede o intervalo até o encerramento. A presença de fechamentos por inatividade limita seu uso como medida de tempo até a solução.');
  }
  checks.push('Volume diário, equipe e departamentos foram conciliados com os totais de assumidos e finalizados. As avaliações e inatividade também passaram pelas conferências cruzadas.');
  return { tables, findings, score, checks };
}

function node(tag, text) {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  return element;
}

function showScore(section, score) {
  const card = node('article');
  card.className = 'card';
  const label = score.divergent ? 'Conferir resultado da meta' :
    score.reported === null ? 'Média do Looker indisponível' :
      score.reported >= score.target ? 'Meta atingida no cartão do Looker' : 'Abaixo da meta no cartão do Looker';
  card.append(node('h4', 'Meta de nota média do cliente · ' + scoreFormat.format(score.target)), node('strong', label));
  for (const [name, value] of [['Cartão do Looker', score.reported], ['Média pelas ' + format.format(score.ratingCount) + ' notas por estrela', score.distributionMean]]) {
    if (value === null) continue;
    const gap = Math.round((value - score.target) * 100) / 100;
    const delta = gap === 0 ? 'na meta' : scoreFormat.format(Math.abs(gap)) + (gap > 0 ? ' acima da meta' : ' abaixo da meta');
    const row = node('p');
    const result = node('strong', scoreFormat.format(value) + '/5');
    result.className = gap < 0 ? 'panorama-score-low' : 'panorama-score-high';
    row.append(name + ' · ', result, ' · ' + delta);
    card.append(row);
  }
  section.append(card);
}

function showDailyChart(section, days) {
  if (!days.length) return;
  const chart = node('div');
  chart.className = 'panorama-analysis';
  chart.setAttribute('aria-label', 'Volume diário de atendimentos');
  const max = Math.max(1, ...days.flatMap(day => [day.assumidos, day.finalizados]));
  for (const day of days) {
    const card = node('article');
    card.append(node('strong', date(day.date)));
    for (const [label, value] of [['Assumidos', day.assumidos], ['Finalizados', day.finalizados]]) {
      const line = node('div');
      const bar = node('meter');
      bar.min = 0;
      bar.max = max;
      bar.value = value;
      bar.setAttribute('aria-label', label + ' em ' + date(day.date));
      line.append(node('span', label + ' · ' + format.format(value) + ' '), bar);
      card.append(line);
    }
    chart.append(card);
  }
  section.append(chart);
}

function showTable(target, title, data, { heatmap = false, toggleNames = false } = {}) {
  if (!data?.rows.length) return;
  target.append(node('h4', title));
  const wrap = node('div');
  wrap.className = 'panorama-table-wrap';
  wrap.tabIndex = 0;
  wrap.setAttribute('role', 'region');
  wrap.setAttribute('aria-label', title);
  const table = node('table');
  table.className = 'panorama-table';
  const header = table.createTHead().insertRow();
  for (const label of data.headers) {
    const cell = node('th', label);
    cell.scope = 'col';
    header.append(cell);
  }
  const tbody = table.createTBody();
  const max = heatmap ? Math.max(1, ...data.rows.flatMap(row => row.slice(1)).filter(Number.isFinite)) : 1;
  if (toggleNames) {
    const label = node('label');
    const toggle = node('input');
    toggle.type = 'checkbox';
    toggle.checked = true;
    label.append(toggle, ' Exibir nomes da equipe');
    target.append(label);
    toggle.addEventListener('change', () => data.rows.forEach((row, i) => {
      tbody.rows[i].cells[0].textContent = toggle.checked ? row[0] : 'Atendente ' + (i + 1);
    }));
  }
  data.rows.forEach((row, i) => {
    const tr = tbody.insertRow();
    row.forEach((value, column) => {
      const cell = node(column ? 'td' : 'th', value ?? '—');
      if (!column) cell.scope = 'row';
      if (data.headers[column] === 'Média cliente' && /^[1-5](?:[.,]\d+)?$/.test(String(value))) {
        const customerScore = Number(value.replace(',', '.'));
        cell.textContent = scoreFormat.format(customerScore);
        cell.className = customerScore < TARGET_SCORE ? 'panorama-score-low' : 'panorama-score-high';
        cell.append(' · ' + (customerScore < TARGET_SCORE ? 'Abaixo da meta' : 'Na meta ou acima'));
      }
      if (heatmap && column && Number.isFinite(value) && value > 0) {
        cell.style.backgroundColor = 'rgba(59, 130, 246, ' + (0.12 + 0.55 * value / max) + ')';
      }
      tr.append(cell);
    });
  });
  wrap.append(table);
  target.append(wrap);
}

export function renderAnalysis(output, { analysis, days }) {
  if (!analysis) return;
  const section = node('section');
  section.append(node('h3', 'Análise da semana'));
  showScore(section, analysis.score);
  if (analysis.findings.length) {
    section.append(node('h4', 'Destaques da semana'));
    const summary = node('div');
    summary.className = 'panorama-analysis';
    for (const finding of analysis.findings) {
      const separator = finding.indexOf(': ');
      const card = node('article');
      card.append(node('strong', finding.slice(0, separator)), node('p', finding.slice(separator + 2)));
      summary.append(card);
    }
    section.append(summary);
  }
  const { tables } = analysis;
  section.append(node('h4', 'Assumidos e finalizados por dia'));
  showDailyChart(section, days);
  showTable(section, 'Quando os atendimentos são assumidos', tables.heatmap, { heatmap: true });
  showTable(section, 'Departamentos', tables.departments);
  section.append(node('p', 'A meta de 4,70 é aplicada à média do cliente. A nota da IA é exibida em coluna própria.'));
  showTable(section, 'Equipe', tables.team, { toggleNames: true });
  showTable(section, 'Principais motivos', tables.reasons);
  showTable(section, 'Notas dadas pelos clientes', tables.stars);
  showTable(section, 'Plantão por turno', tables.shifts);
  showTable(section, 'Desfecho do plantão', tables.outcomes);
  const checks = node('ul');
  for (const line of analysis.checks) checks.append(node('li', line));
  section.append(node('h4', 'Como interpretar os indicadores'), checks);
  output.append(section);
}
