const catalog = {
  departments: ['performance_por_departamento.csv', [0, 1, 2, 6, 7, 8, 9, 4]],
  team: ['performance_por_colaborador.csv', [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]],
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
  for (const [key, column] of [['departments', 2], ['team', 1], ['reasons', 1]]) {
    tables[key]?.rows.sort((a, b) => quantity(b[column]) - quantity(a[column]));
  }
  if (tables.reasons) tables.reasons.rows = tables.reasons.rows.slice(0, 12);

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
  const departmentScores = tables.departments?.rows.map(row => ({ mean: parseScore(row[4]), count: quantity(row[5]) })) ?? [];
  const departmentCount = departmentScores.reduce((total, row) => total + row.count, 0);
  const departmentMean = departmentCount > 0 && departmentCount === kpis.avaliados &&
    departmentScores.every(row => Number.isSafeInteger(row.count) && row.count >= 0 && (!row.count || row.mean !== null))
    ? Math.round(departmentScores.reduce((total, row) => total + (row.mean ?? 0) * row.count, 0) / departmentCount * 100) / 100
    : null;
  const corroborated = distributionMean !== null && departmentMean !== null &&
    Math.abs(Math.round(distributionMean * 100) - Math.round(departmentMean * 100)) <= 1;
  const reported = kpis.nota ?? null;
  const score = { target, reported, distributionMean, ratingCount, departmentMean,
    confirmedMean: corroborated ? distributionMean : null,
    divergent: reported !== null && distributionMean !== null && reported !== distributionMean };
  const checks = [];
  if (score.divergent) {
    checks.push('Nota média: o cartão do Looker e a distribuição de estrelas divergem. O cartão usa uma média cuja fórmula e filtros não estão no ZIP. A avaliação da meta usa as estrelas quando a nota é confirmada pelos departamentos.');
  }

  const findings = [];
  const summarize = (label, text) => findings.push(label + ': ' + text);
  const peak = peakBy(days, day => day.finalizados);
  if (peak?.finalizados && kpis.finalizados > 0) {
    const tiedDays = days.filter(day => day.finalizados === peak.finalizados).map(day => date(day.date));
    summarize('Maior volume diário', tiedDays.join(' e ') + ' · ' + format.format(peak.finalizados) +
      ' de ' + format.format(kpis.finalizados) + ' finalizados no período (' + percent(peak.finalizados, kpis.finalizados) +
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
    tables.team.headers.push('% dos finalizados do período');
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
  checks.push(format.format(kpis.finalizados) + ' finalizados: cartão do Looker, soma diária, soma por pessoa e soma por departamento coincidem. A conferência compara relatórios do mesmo ZIP.');
  checks.push(format.format(kpis.assumidos) + ' assumidos: as quatro fontes do ZIP coincidem entre si. O total segue o critério do Looker.');
  checks.push('As avaliações e os encerramentos por inatividade também passaram pelas conferências cruzadas.');
  return { tables, findings, score, checks };
}

function parseScore(value) {
  const raw = String(value ?? '').trim().replace(',', '.');
  const number = Number(raw);
  return /^\d(?:\.\d+)?$/.test(raw) && number >= 1 && number <= 5 ? number : null;
}

export const TIME_LABELS = Object.freeze({
  TME: 'Tempo médio de espera até o atendimento. O indicador considera os casos com espera registrada.',
  TMA: 'Tempo médio de atendimento informado pelo Looker. É distinto do tempo de interação e do tempo até o encerramento.',
  TMI: 'Tempo médio de interação informado pelo Looker, calculado no relatório de turnos de conversa.',
  TMR: 'Tempo médio até a resolução ou encerramento. Inclui fechamentos por inatividade quando fazem parte do recorte.'
});

export function filterDepartmentRows(rows, department) {
  return department === '' ? rows : rows.filter(row => row[0] === department);
}

function choose(labelText, choices) {
  const label = node('label', labelText);
  const select = node('select');
  for (const [value, text] of choices) {
    const option = node('option', text);
    option.value = value;
    select.append(option);
  }
  label.append(select);
  return { label, select };
}

function projectTable(table, labels) {
  const columns = labels.map(label => table.headers.indexOf(label));
  return { headers: labels, rows: table.rows.map(row => columns.map(index => row[index])) };
}

function nameKey(value) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/\s+/g, ' ').trim().replace(/\s*[-(]?\s*multi[\s-]?setor\)?\s*$/i, '').trim();
}

export function joinTeamLevels(rows, registry) {
  const byName = new Map();
  for (const [name, profile] of Object.entries(registry ?? {})) {
    const key = nameKey(name);
    const label = String(profile?.nivel ?? '').trim().toUpperCase();
    const level = /^(?:N|NÍVEL\s+|NIVEL\s+)?[12]$/.test(label) ? 'N' + label.at(-1) : '';
    if (!byName.has(key)) byName.set(key, new Set());
    byName.get(key).add(level);
  }
  return rows.map(row => {
    const key = nameKey(row[0]);
    const exact = byName.get(key);
    if (exact) return exact.size === 1 ? [...exact][0] || '—' : '—';

    const words = key.split(' ');
    if (words.length < 2) return '—';
    const matches = [...byName].filter(([name]) => {
      const full = name.split(' ');
      if (full.length <= words.length || full[0] !== words[0]) return false;
      let next = 1;
      for (const word of full.slice(1)) {
        if (word === words[next]) next++;
      }
      return next === words.length;
    });
    const levels = matches.length === 1 ? matches[0][1] : undefined;
    return levels?.size === 1 ? [...levels][0] || '—' : '—';
  });
}

function node(tag, text) {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  return element;
}

function scoreDelta(value, target) {
  const delta = Math.round((value - target) * 100);
  if (delta === 0) return 'Na meta';
  return scoreFormat.format(Math.abs(delta) / 100) + (delta > 0 ? ' acima da meta' : ' abaixo da meta');
}

function showHeadline(section, score, kpis) {
  const summary = node('div');
  summary.className = 'panorama-headline';
  const volume = node('article');
  volume.className = 'panorama-metric';
  volume.append(node('h4', 'Finalizados'), node('strong', format.format(kpis.finalizados)),
    node('p', 'Total conferido entre os relatórios do ZIP.'));
  const quality = node('article');
  quality.className = 'panorama-metric';
  const mean = score.confirmedMean;
  const value = node('strong', mean === null ? 'Em conferência' : scoreFormat.format(mean) + ' / 5');
  if (mean !== null) value.className = mean < score.target ? 'panorama-score-low' : 'panorama-score-high';
  quality.append(node('h4', 'Nota geral do cliente'), value);
  const target = 'Meta ' + scoreFormat.format(score.target);
  const details = node('ul');
  details.className = 'panorama-headline-meta';
  const values = mean === null ? [target, 'Resultado pendente'] :
    [target, scoreDelta(mean, score.target), format.format(score.ratingCount) + ' avaliações'];
  for (const item of values) details.append(node('li', item));
  quality.append(details);
  summary.append(volume, quality);
  section.append(summary);
}

export function renderScoreSources(target, score) {
  const sources = node('ul');
  for (const [label, value] of [
    ['Média pelas ' + format.format(score.ratingCount) + ' avaliações por estrela', score.distributionMean],
    ['Média dos departamentos ponderada pelas avaliações', score.departmentMean],
    ['Cartão da nota no Looker', score.reported]
  ]) {
    if (value !== null) sources.append(node('li', label + ' · ' + scoreFormat.format(value) + '/5 · ' +
      scoreDelta(value, score.target)));
  }
  if (sources.childElementCount) target.append(node('h4', 'Origem da nota geral'), sources);
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
  if (heatmap) wrap.classList.add('panorama-heatmap-wrap');
  wrap.tabIndex = 0;
  wrap.setAttribute('role', 'region');
  wrap.setAttribute('aria-label', title);
  const table = node('table');
  table.className = 'panorama-table';
  const header = table.createTHead().insertRow();
  for (const label of data.headers) {
    const cell = node('th', TIME_LABELS[label] ? undefined : label);
    if (TIME_LABELS[label]) {
      const tip = node('abbr', label);
      tip.title = TIME_LABELS[label];
      tip.setAttribute('aria-label', label + ' — ' + TIME_LABELS[label]);
      tip.tabIndex = 0;
      cell.append(tip);
    }
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
      const customerScore = ['Média aval.', 'Nota do cliente'].includes(data.headers[column]) ? parseScore(value) : null;
      if (customerScore !== null) {
        cell.textContent = scoreFormat.format(customerScore);
        cell.className = customerScore < TARGET_SCORE ? 'panorama-score-low' : 'panorama-score-high';
        const gap = Math.round((customerScore - TARGET_SCORE) * 100) / 100;
        const difference = gap < 0 ? '−' : gap > 0 ? '+' : '';
        cell.append(node('small', gap === 0 ? 'Na meta' : difference + scoreFormat.format(Math.abs(gap)) + ' da meta'));
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

export function reportDetails(title) {
  const details = node('details');
  details.className = 'card panorama-weekly-details';
  details.append(node('summary', title));
  return details;
}

const leadLabels = ['Maior volume diário', 'Departamento com maior volume', 'Motivo com maior volume'];

function showFindings(target, findings) {
  const summary = node('div');
  summary.className = 'panorama-analysis';
  for (const finding of findings) {
    const separator = finding.indexOf(': ');
    const card = node('article');
    card.append(node('strong', finding.slice(0, separator)), node('p', finding.slice(separator + 2)));
    summary.append(card);
  }
  target.append(summary);
}

export function renderAnalysis(output, { analysis, days, kpis }, registry = {}) {
  if (!analysis) return;
  const section = node('section');
  section.append(node('h3', 'Resumo do período'));
  section.className = 'panorama-compact-report';
  showHeadline(section, analysis.score, kpis);

  const byLabel = label => analysis.findings.find(finding => finding.startsWith(label + ': '));
  const leads = leadLabels.map(byLabel).filter(Boolean);
  if (leads.length) {
    section.append(node('h4', 'Destaques do período'));
    showFindings(section, leads);
  }

  const { tables } = analysis;
  const volume = reportDetails('Volume diário e horários · recorte completo');
  const volumeHighlights = ['Pico de assumidos'].map(byLabel).filter(Boolean);
  volumeHighlights.push(...analysis.findings.filter(finding => finding.startsWith('Volume diário: ')));
  if (volumeHighlights.length) showFindings(volume, volumeHighlights);
  volume.append(node('h4', 'Assumidos e finalizados por dia'));
  showDailyChart(volume, days);
  showTable(volume, 'Assumidos por dia e faixa de horário', tables.heatmap, { heatmap: true });

  const team = reportDetails('Equipe · notas, nível e tempos');
  if (tables.team) {
    const source = projectTable(tables.team, ['Atendente', 'Finalizados', 'Média aval.', 'TMA', 'TMI', 'TMR']);
    const levels = joinTeamLevels(source.rows, registry);
    const level = choose('Nível', [['', 'Todos os níveis'], ['N1', 'Nível 1 (N1)'], ['N2', 'Nível 2 (N2)'], ['—', 'Sem nível identificado']]);
    const person = choose('Pessoa', [['', 'Todas as pessoas'], ...source.rows.map(row => [row[0], row[0]])]);
    const filters = node('div');
    filters.className = 'panorama-report-filters';
    filters.append(level.label, person.label);
    const status = node('p');
    status.setAttribute('role', 'status');
    const tableSpot = node('div');
    team.append(filters, status, tableSpot);
    const draw = () => {
      const rows = source.rows.map((row, index) => [row[0], levels[index], ...row.slice(1)])
        .filter(row => (!level.select.value || row[1] === level.select.value) &&
          (!person.select.value || row[0] === person.select.value));
      tableSpot.replaceChildren();
      status.textContent = rows.length ? format.format(rows.length) + ' de ' + format.format(source.rows.length) + ' pessoas no ZIP.'
        : 'Nenhuma pessoa corresponde aos filtros.';
      showTable(tableSpot, 'Resultado por pessoa', {
        headers: ['Atendente', 'Nível', ...source.headers.slice(1)], rows
      }, { toggleNames: true });
    };
    level.select.addEventListener('change', draw);
    person.select.addEventListener('change', draw);
    draw();
    team.append(node('p', 'A nota e os volumes de cada pessoa vêm do CSV Performance por colaborador. Os níveis vêm do cadastro do app.'));
  }

  const departments = reportDetails('Departamentos · finalizados, nota e tempos');
  if (tables.departments) {
    const source = projectTable(tables.departments, ['Departamento', 'Finalizados', 'Score', 'Avaliados', 'TMA', 'TMR']);
    source.headers[2] = 'Nota do cliente';
    const choices = [...new Set(source.rows.map(row => row[0]))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    const department = choose('Departamento', [['', 'Todos os departamentos'], ...choices.map(name => [name, name])]);
    const filters = node('div');
    filters.className = 'panorama-report-filters';
    filters.append(department.label);
    const tableSpot = node('div');
    departments.append(filters, tableSpot);
    const draw = () => {
      tableSpot.replaceChildren();
      showTable(tableSpot, 'Resultado por departamento', {
        ...source, rows: filterDepartmentRows(source.rows, department.select.value)
      });
    };
    department.select.addEventListener('change', draw);
    draw();
    departments.append(node('p', 'O filtro usa o relatório por departamento do ZIP. O export não cruza departamento com pessoa, faixa horária ou motivo; essas visões continuam no recorte completo.'));
  }

  const reasons = reportDetails('Principais motivos · recorte completo');
  showTable(reasons, '12 motivos com mais finalizados', tables.reasons);

  const quality = reportDetails('Avaliações e plantão');
  showTable(quality, 'Notas dadas pelos clientes', tables.stars);
  showTable(quality, 'Plantão por turno', tables.shifts);
  showTable(quality, 'Desfecho do plantão', tables.outcomes);

  if (tables.team) section.append(team);
  if (tables.departments) section.append(departments);
  section.append(volume);
  if (tables.reasons) section.append(reasons);
  if (tables.stars || tables.shifts || tables.outcomes) section.append(quality);
  output.append(section);
}
