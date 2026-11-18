import { downloadPanoramaWorkbook } from './xlsx.mjs?v=2';

const catalog = {
  departments: ['performance_por_departamento.csv', [0, 1, 2, 6, 7, 8, 9, 4]],
  team: ['performance_por_colaborador.csv', [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]],
  reasons: ['motivos_de_atendimento.csv', [0, 1, 2, 3]],
  stars: ['distribuição_de_notas_por_estrela.csv', [0, 1, 2, 3]],
  shifts: ['plantão__diurno_×_noturno.csv', [0, 1]],
  outcomes: ['plantão__resolvidos_×_repassados.csv', [0, 1]]
};
const TARGET_SCORE = 4.70;
const MONTHLY_N1_TARGET = 280;
const WORKDAYS_PER_MONTH = 24;
const N1_GAP_HEADER = 'Saldo da meta N1';
const heatmapFile = 'assumidos_por_dia_×_hora.csv';
const subtotal = /^(?:total(?: geral)?|totais)$/i;
const quantity = value => Number(String(value).trim().replace(/\./g, ''));
const format = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });
const percent = (part, whole) => format.format(part / whole * 100) + '%';
const scoreFormat = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const date = value => value.split('-').reverse().join('/');
const weekdays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
export const dayLabel = value => weekdays[new Date(value + 'T12:00:00Z').getUTCDay()] + ' ' + date(value).slice(0, 5);
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

export function parseScore(value) {
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

export function n1PeriodTarget(period) {
  const workdays = new Map();
  if (period) {
    const day = new Date(period.start + 'T00:00:00Z');
    const end = Date.parse(period.end + 'T00:00:00Z');
    for (; day.getTime() <= end; day.setUTCDate(day.getUTCDate() + 1)) {
      if (day.getUTCDay() === 0) continue;
      const month = day.getUTCFullYear() * 12 + day.getUTCMonth();
      workdays.set(month, (workdays.get(month) ?? 0) + 1);
    }
  }
  const days = [...workdays.values()].reduce((total, count) => total + Math.min(count, WORKDAYS_PER_MONTH), 0);
  return { days, target: Math.ceil(MONTHLY_N1_TARGET * days / WORKDAYS_PER_MONTH) };
}

export function n1FinalizedGap(level, finalized, target) {
  return level === 'N1' && target > 0 ? quantity(finalized) - target : null;
}

export function n1GapLabel(gap) {
  if (gap === null) return '—';
  if (gap < 0) return 'Faltam ' + format.format(-gap);
  if (gap > 0) return format.format(gap) + ' acima';
  return 'Meta atingida';
}

export function sortTeamRows(rows, order, n1Target = 0) {
  return [...rows].sort((first, second) => {
    if (order === 'n1-deficit') {
      const a = n1FinalizedGap(first[1], first[2], n1Target) ?? Infinity;
      const b = n1FinalizedGap(second[1], second[2], n1Target) ?? Infinity;
      if (a !== b) return a - b;
    }
    if (order === 'score-desc' || order === 'score-asc') {
      const a = parseScore(first[3]);
      const b = parseScore(second[3]);
      if (a === null && b !== null) return 1;
      if (a !== null && b === null) return -1;
      if (a !== null && b !== null && a !== b) return order === 'score-asc' ? a - b : b - a;
    }
    return quantity(second[2]) - quantity(first[2]) || first[0].localeCompare(second[0], 'pt-BR');
  });
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

function matchTeamProfiles(rows, registry) {
  const byName = new Map();
  for (const [name, profile] of Object.entries(registry ?? {})) {
    const key = nameKey(name);
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key).push(profile);
  }
  return rows.map(row => {
    const key = nameKey(row[0]);
    const exact = byName.get(key);
    if (exact) return exact;

    const words = key.split(' ');
    if (words.length < 2) return [];
    const matches = [...byName].filter(([name]) => {
      const full = name.split(' ');
      if (full.length <= words.length || full[0] !== words[0]) return false;
      let next = 1;
      for (const word of full.slice(1)) {
        if (word === words[next]) next++;
      }
      return next === words.length;
    });
    return matches.length === 1 ? matches[0][1] : [];
  });
}

function singleProfileValue(profiles, normalize) {
  const values = new Set(profiles.map(normalize));
  return values.size === 1 ? [...values][0] : '';
}

export function joinTeamLevels(rows, registry) {
  return matchTeamProfiles(rows, registry).map(profiles => singleProfileValue(profiles, profile => {
    const label = String(profile?.nivel ?? '').trim().toUpperCase();
    return /^(?:N|NÍVEL\s+|NIVEL\s+)?[12]$/.test(label) ? 'N' + label.at(-1) : '';
  }) || '—');
}

export function joinTeamDepartments(rows, registry) {
  return matchTeamProfiles(rows, registry).map(profiles => {
    const departments = profiles.map(profile => String(profile?.setor_atual ?? '').trim().replace(/\s+/g, ' '));
    const keys = new Set(departments.map(department => department.toLocaleLowerCase('pt-BR')));
    return keys.size === 1 ? departments[0] : '';
  });
}

export function joinTeamNames(rows, registry) {
  const names = Object.fromEntries(Object.keys(registry ?? {}).map(name => [name, name]));
  return matchTeamProfiles(rows, names).map(matches => matches.length === 1 ? matches[0] : '');
}

function node(tag, text) {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  return element;
}

export function scoreBand(value) {
  if (value < 4.60) return { className: 'panorama-score-low', label: 'Abaixo da meta' };
  if (value < TARGET_SCORE) return { className: 'panorama-score-near', label: 'Próximo da meta' };
  return { className: 'panorama-score-high', label: 'Na meta' };
}

function scoreDelta(value, target) {
  const delta = Math.round((value - target) * 100);
  if (delta === 0) return 'Na meta';
  return scoreFormat.format(Math.abs(delta) / 100) + (delta > 0 ? ' acima da meta' : ' abaixo da meta');
}

function compactTime(value) {
  if (value == null) return '—';
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor(value / 60) % 60;
  return (hours ? hours + 'h' : '') + minutes + 'm' + value % 60 + 's';
}

function showHeadline(section, score, kpis) {
  const grid = node('div');
  grid.className = 'panorama-reference-kpis';
  const note = score.confirmedMean;
  const inat = kpis.total > 0 && kpis.inatividade !== undefined ? percent(kpis.inatividade, kpis.total) : '—';
  const pct = value => value == null ? '—' : scoreFormat.format(value) + '%';
  const metrics = [
    ['Finalizados', kpis.finalizados, 'Conferidos nos relatórios do ZIP'],
    ['Nota geral do cliente', note == null ? '—' : scoreFormat.format(note), 'Meta ' + scoreFormat.format(score.target) +
      (note == null ? ' · Em conferência' : ' · ' + scoreBand(note).label + ' · ' + format.format(score.ratingCount) + ' avaliações')],
    ['Assumidos', kpis.assumidos, 'Total informado pelo Looker'],
    ['Clientes atendidos', kpis.clientes],
    ['Espera média (TME)', compactTime(kpis.tme), undefined, 'TME'],
    ['Interação média (TMI)', compactTime(kpis.tmi), undefined, 'TMI'],
    ['Resolução média (TMR)', compactTime(kpis.tmr), undefined, 'TMR'],
    ['Encerrados por inatividade', inat, kpis.inatividade === undefined ? null : format.format(kpis.inatividade) + ' de ' + format.format(kpis.total)],
    ['Recorrência', pct(kpis.recorrencia)],
    ['SLA do plantão (2h)', pct(kpis.sla)]
  ];
  for (const [label, value, caption, term] of metrics) {
    const tile = node('article');
    const title = node('span', label);
    if (term) title.title = TIME_LABELS[term];
    const main = node('strong', typeof value === 'number' ? format.format(value) : value ?? '—');
    if (label === 'Nota geral do cliente' && note !== null) main.className = scoreBand(note).className;
    tile.append(title, main);
    if (caption) tile.append(node('small', caption));
    grid.append(tile);
  }
  section.append(grid);
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

function chartPanel(title) {
  const panel = node('section');
  panel.className = 'panorama-graph-panel';
  panel.append(node('h4', title));
  return panel;
}

function showDailyChart(target, days) {
  if (!days.length) return;
  const panel = chartPanel('Assumidos e finalizados por dia');
  const legend = node('p');
  legend.className = 'panorama-chart-legend';
  for (const text of ['Assumidos', 'Finalizados']) legend.append(node('span', text));
  panel.append(legend);
  const scroll = node('div');
  scroll.className = 'panorama-chart-scroll';
  scroll.tabIndex = 0;
  scroll.setAttribute('role', 'region');
  scroll.setAttribute('aria-label', 'Volume por dia');
  const chart = node('ul');
  chart.className = 'panorama-daily-columns';
  const max = days.reduce((largest, day) => Math.max(largest, day.assumidos, day.finalizados), 1);
  for (const day of days) {
    const item = node('li');
    const columns = node('div');
    columns.className = 'panorama-column-pair';
    for (const [key, title] of [['assumidos', 'Assumidos'], ['finalizados', 'Finalizados']]) {
      const bar = node('div');
      bar.className = 'panorama-day-bar';
      bar.style.blockSize = (day[key] / max * 100) + '%';
      const number = node('span', format.format(day[key]));
      number.setAttribute('aria-label', title + ': ' + day[key]);
      bar.append(number);
      columns.append(bar);
    }
    const label = node('time', dayLabel(day.date));
    label.dateTime = day.date;
    item.append(columns, label);
    chart.append(item);
  }
  scroll.append(chart);
  panel.append(scroll);
  target.append(panel);
}

function showRanking(target, title, rows) {
  if (!rows.length) return;
  const panel = chartPanel(title);
  const bars = node('ul');
  bars.className = 'panorama-rank-bars';
  const max = rows.reduce((largest, row) => Math.max(largest, row[1]), 1);
  for (const [label, value] of rows) {
    const row = node('li');
    const track = node('span');
    track.className = 'panorama-rank-track';
    track.setAttribute('aria-hidden', 'true');
    const fill = node('span');
    fill.style.width = (value / max * 100) + '%';
    track.append(fill);
    row.append(node('span', label), track, node('strong', format.format(value)));
    bars.append(row);
  }
  panel.append(bars);
  target.append(panel);
}

function showTable(target, title, data, { heatmap = false, nameVisibility, showTitle = true } = {}) {
  if (!data?.rows.length) return;
  if (showTitle) target.append(node('h4', title));
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
  if (nameVisibility) {
    const label = node('label');
    const toggle = node('input');
    toggle.type = 'checkbox';
    toggle.checked = nameVisibility.visible;
    label.append(toggle, ' Exibir nomes da equipe');
    target.append(label);
    toggle.addEventListener('change', () => {
      nameVisibility.visible = toggle.checked;
      nameVisibility.onChange?.();
      data.rows.forEach((row, i) => {
        tbody.rows[i].cells[0].textContent = toggle.checked ? row[0] : 'Atendente ' + (i + 1);
      });
    });
  }
  data.rows.forEach((row, i) => {
    const tr = tbody.insertRow();
    row.forEach((value, column) => {
      const display = column === 0 && nameVisibility && !nameVisibility.visible ? 'Atendente ' + (i + 1) : value;
      const cell = node(column ? 'td' : 'th', display ?? '—');
      if (!column) cell.scope = 'row';
      const customerScore = ['Média aval.', 'Nota do cliente'].includes(data.headers[column]) ? parseScore(value) : null;
      if (customerScore !== null) {
        cell.textContent = scoreFormat.format(customerScore);
        const band = scoreBand(customerScore);
        cell.className = band.className;
        cell.append(node('small', band.label));
      }
      if (data.headers[column] === N1_GAP_HEADER) {
        cell.textContent = n1GapLabel(value);
        cell.className = 'panorama-n1-gap';
        if (value !== null) cell.classList.add(value < 0 ? 'panorama-score-low' : 'panorama-score-high');
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
  const summary = node('dl');
  summary.className = 'panorama-findings';
  for (const finding of findings) {
    const separator = finding.indexOf(': ');
    const row = node('div');
    row.append(node('dt', finding.slice(0, separator)), node('dd', finding.slice(separator + 2)));
    summary.append(row);
  }
  target.append(summary);
}

function view(title) {
  const panel = node('section');
  panel.className = 'panorama-view';
  panel.append(node('h3', title));
  return panel;
}

function renderViews(output, entries, exportReport) {
  const nav = node('nav');
  nav.className = 'panorama-view-nav';
  nav.setAttribute('aria-label', 'Visões do Panorama');
  const body = node('div');
  const views = entries.map(([label, panel]) => {
    const button = node('button', label);
    button.type = 'button';
    nav.append(button);
    body.append(panel);
    return { button, panel };
  });
  const activate = index => views.forEach(({ panel, button }, position) => {
    panel.hidden = position !== index;
    button.setAttribute('aria-pressed', String(position === index));
  });
  views.forEach(({ button }, index) => button.addEventListener('click', () => activate(index)));
  activate(0);
  const actions = node('div');
  actions.className = 'panorama-view-actions';
  const download = node('button', 'Exportar planilha');
  download.type = 'button';
  download.className = 'btn-small';
  download.title = 'Baixa um .xlsx para Excel ou Google Planilhas com os filtros atuais.';
  const status = node('p');
  status.className = 'panorama-export-status';
  status.setAttribute('role', 'status');
  download.addEventListener('click', () => {
    try { exportReport(); status.textContent = ''; }
    catch (error) { status.textContent = error.message; }
  });
  actions.append(nav, download);
  output.append(actions, status, body);
}

export function renderAnalysis(output, report, { registry = {}, indicators, audit, teamContext } = {}) {
  const { analysis, days, kpis, period } = report;
  if (!analysis) return;
  const n1Goal = n1PeriodTarget(period);
  let exportTeam = [];
  let exportDepartments = [];
  let teamNamesVisible = () => true;
  const section = view('Atendimentos do suporte');
  section.classList.add('panorama-summary-view');
  if (period) {
    const range = node('p', date(period.start) + ' a ' + date(period.end) + ' · Exportação do Looker/Opa! Suite');
    range.className = 'panorama-period';
    section.append(range);
  }
  showHeadline(section, analysis.score, kpis);

  const byLabel = label => analysis.findings.find(finding => finding.startsWith(label + ': '));
  const leads = leadLabels.map(byLabel).filter(Boolean);
  const overview = node('div');
  overview.className = 'panorama-overview';
  showDailyChart(overview, days);
  const { tables } = analysis;
  if (tables.heatmap) {
    const heat = chartPanel('Quando os atendimentos são assumidos');
    heat.append(node('p', 'Volume por dia e faixa de horário. — indica dado ausente.'));
    showTable(heat, 'Assumidos por faixa de horário', tables.heatmap, { heatmap: true, showTitle: false });
    overview.append(heat);
  }
  section.append(overview);
  if (leads.length) {
    const highlights = node('section');
    highlights.append(node('h4', 'Destaques do período'));
    showFindings(highlights, leads);
    highlights.className = 'panorama-summary-highlights';
    section.append(highlights);
  }

  const rankings = node('div');
  rankings.className = 'panorama-overview';
  showRanking(rankings, 'Principais motivos', (tables.reasons?.rows ?? []).map(row => [row[0], quantity(row[1])]));
  showRanking(rankings, 'Notas dadas pelos clientes', (tables.stars?.rows ?? []).map(row => [row[0], row.slice(1).reduce((total, count) => total + quantity(count), 0)]));
  if (rankings.childElementCount) section.append(rankings);
  const volume = view('Operação no período');
  const volumeHighlights = ['Pico de assumidos'].map(byLabel).filter(Boolean);
  volumeHighlights.push(...analysis.findings.filter(finding => finding.startsWith('Volume diário: ')));
  if (volumeHighlights.length) showFindings(volume, volumeHighlights);

  const team = view('Equipe');
  if (tables.team) {
    const source = projectTable(tables.team, ['Atendente', 'Finalizados', 'Média aval.', 'TMA', 'TMI', 'TMR']);
    const levels = joinTeamLevels(source.rows, registry);
    const departments = joinTeamDepartments(source.rows, registry);
    const registeredNames = joinTeamNames(source.rows, registry);
    const namesByRow = new Map(source.rows.map((row, index) => [row[0], registeredNames[index]]));
    const context = n1Goal.target && teamContext?.(period, names => joinTeamNames(names.map(name => [name]), registry));
    const knownDepartments = new Map();
    for (const name of departments.filter(Boolean)) knownDepartments.set(name.toLocaleLowerCase('pt-BR'), name);
    const department = choose('Departamento cadastrado', [
      ['', 'Todos os departamentos'],
      ...[...knownDepartments].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR')),
      ...(departments.includes('') ? [['unknown', 'Sem departamento identificado']] : [])
    ]);
    const level = choose('Nível', [['', 'Todos os níveis'], ['N1', 'Nível 1 (N1)'], ['N2', 'Nível 2 (N2)'], ['—', 'Sem nível identificado']]);
    const person = choose('Pessoa', [['', 'Todas as pessoas'], ...source.rows.map(row => [row[0], row[0]])]);
    const filters = node('div');
    filters.className = 'panorama-report-filters';
    const order = choose('Ordenar por', [
      ['volume', 'Finalizados · maior volume'],
      ['n1-deficit', 'Meta N1 · mais finalizados faltando'],
      ['score-desc', 'Nota · acima da meta primeiro'],
      ['score-asc', 'Nota · abaixo da meta primeiro']
    ]);
    let contextPeople = [];
    const nameVisibility = {
      visible: true,
      onChange: () => context?.setPeople(nameVisibility.visible ? contextPeople : [])
    };
    teamNamesVisible = () => nameVisibility.visible;
    const showTimes = node('input');
    showTimes.type = 'checkbox';
    showTimes.checked = true;
    const timesLabel = node('label', ' Exibir tempos');
    timesLabel.className = 'panorama-times-toggle';
    timesLabel.prepend(showTimes);
    filters.append(department.label, level.label, person.label, order.label, timesLabel);
    const status = node('p');
    status.setAttribute('role', 'status');
    const tableSpot = node('div');
    const goalNote = node('p');
    if (n1Goal.days) {
      goalNote.append(node('strong', 'Meta N1 no recorte: ' + format.format(n1Goal.target) + ' finalizados'),
        ' · ' + format.format(n1Goal.days) + (n1Goal.days === 1 ? ' dia considerado.' : ' dias considerados.'));
    } else {
      goalNote.append(node('strong', 'Sem meta N1 neste recorte.'), ' Nenhum dia de segunda a sábado no período.');
    }
    goalNote.append(' Base de ' + MONTHLY_N1_TARGET + ' finalizados em ' + WORKDAYS_PER_MONTH +
      ' dias por mês, de segunda a sábado, com limite mensal e arredondamento para cima. Feriados e escalas individuais não entram no cálculo.');
    team.append(filters, node('p', 'Departamento e nível vêm do cadastro. Finalizados, nota e tempos são os totais de cada pessoa no ZIP.'), goalNote, status, tableSpot);
    if (context) team.insertBefore(context.element, status);
    const draw = () => {
      const selected = source.rows.map((row, index) => ({
        values: [row[0], levels[index], ...row.slice(1)], department: departments[index].toLocaleLowerCase('pt-BR')
      })).filter(({ values, department: key }) => (!level.select.value || values[1] === level.select.value) &&
        (!person.select.value || values[0] === person.select.value) &&
        (!department.select.value || department.select.value === (key || 'unknown'))).map(entry => entry.values);
      const rows = sortTeamRows(selected, order.select.value, n1Goal.target);
      contextPeople = rows.filter(row => row[1] === 'N1').map(row => namesByRow.get(row[0])).filter(Boolean);
      nameVisibility.onChange();
      exportTeam = rows.map(row => {
        const gap = n1FinalizedGap(row[1], row[2], n1Goal.target);
        return [...row, gap === null ? null : n1Goal.target, gap];
      });
      tableSpot.replaceChildren();
      status.textContent = rows.length ? format.format(rows.length) + ' de ' + format.format(source.rows.length) + ' pessoas no ZIP.'
        : 'Nenhuma pessoa corresponde aos filtros.';
      const times = showTimes.checked ? ['TMA', 'TMI', 'TMR'] : [];
      showTable(tableSpot, 'Resultado por pessoa', {
        headers: ['Atendente', 'Nível', 'Finalizados', N1_GAP_HEADER, 'Média aval.', ...times],
        rows: exportTeam.map(row => [...row.slice(0, 3), row[8], row[3], ...row.slice(4, 4 + times.length)])
      }, { nameVisibility });
    };
    department.select.addEventListener('change', draw);
    level.select.addEventListener('change', draw);
    person.select.addEventListener('change', draw);
    showTimes.addEventListener('change', draw);
    order.select.addEventListener('change', draw);
    draw();
  }

  const departments = view('Departamentos');
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
      exportDepartments = filterDepartmentRows(source.rows, department.select.value);
      showTable(tableSpot, 'Resultado por departamento', { ...source, rows: exportDepartments });
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

  if (tables.reasons) volume.append(reasons);
  if (tables.stars || tables.shifts || tables.outcomes) volume.append(quality);
  if (indicators) volume.append(indicators);
  const views = [['Resumo', section]];
  if (tables.team) views.push(['Equipe', team]);
  if (tables.departments) views.push(['Departamentos', departments]);
  views.push(['Operação', volume]);
  if (audit) views.push(['Conferência', audit]);
  output.classList.add('panorama-compact-report');
  renderViews(output, views, () => {
    const team = exportTeam.map((row, index) => [
      teamNamesVisible() ? row[0] : 'Atendente ' + (index + 1), ...row.slice(1)
    ]);
    downloadPanoramaWorkbook(globalThis.XLSX, report, team, exportDepartments, n1Goal);
  });
}
