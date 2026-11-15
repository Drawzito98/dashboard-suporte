const catalog = {
  departments: ['performance_por_departamento.csv', [0, 1, 2, 6, 7, 8, 9]],
  team: ['performance_por_colaborador.csv', [0, 1, 2, 4, 5, 9]],
  quality: ['avaliação_por_colaborador__ia_×_cliente.csv', [0, 1, 3]],
  reasons: ['motivos_de_atendimento.csv', [0, 1, 2, 3]],
  stars: ['distribuição_de_notas_por_estrela.csv', [0, 1, 2, 3]],
  shifts: ['plantão__diurno_×_noturno.csv', [0, 1]],
  outcomes: ['plantão__resolvidos_×_repassados.csv', [0, 1]]
};
const heatmapFile = 'assumidos_por_dia_×_hora.csv';
const subtotal = /^(?:total(?: geral)?|totais)$/i;
const quantity = value => Number(String(value).trim().replace(/\./g, ''));
const format = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });
const percent = (part, whole) => format.format(part / whole * 100) + '%';
const scoreFormat = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });
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
    .map(row => [row[0], ...row.slice(1).map(quantity)]) ?? [];
  if (heatmap.length) tables.heatmap = { headers: ['Faixa', ...headers.get(heatmapFile).slice(1)], rows: heatmap };

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
    const score = kpis.nota == null ? '' : ' Nota média de ' + scoreFormat.format(kpis.nota) + '/5.';
    const low = kpis.avaliados > 0 && Number.isFinite(lowRatings)
      ? ' ' + format.format(lowRatings) + ' de ' + format.format(kpis.avaliados) + ' avaliações deram 1 ou 2 estrelas (' +
        percent(lowRatings, kpis.avaliados) + ').' : '';
    summarize('Avaliação do cliente', format.format(kpis.avaliados) + ' de ' + format.format(kpis.total) +
      ' atendimentos avaliados (' + percent(kpis.avaliados, kpis.total) + ').' + score + low);
  }
  if (kpis.total > 0 && kpis.inatividade !== undefined) {
    summarize('Encerrados por inatividade', format.format(kpis.inatividade) + ' de ' + format.format(kpis.total) +
      ' atendimentos no recorte (' + percent(kpis.inatividade, kpis.total) + ').');
  }
  if (kpis.fila !== undefined) {
    summarize('Cobertura do tempo de fila', format.format(kpis.fila) +
      ' atendimentos aparecem nas faixas do relatório de fila. O TME é lido do indicador exportado.');
  }
  return { tables, findings };
}

function node(tag, text) {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  return element;
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
      const cell = node(column ? 'td' : 'th', value);
      if (!column) cell.scope = 'row';
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
  if (analysis.findings.length) {
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
  showTable(section, 'Assumidos e finalizados por dia', {
    headers: ['Data', 'Assumidos', 'Finalizados'],
    rows: days.map(day => [date(day.date), day.assumidos, day.finalizados])
  });
  showTable(section, 'Quando os atendimentos são assumidos', tables.heatmap, { heatmap: true });
  showTable(section, 'Departamentos', tables.departments);
  showTable(section, 'Equipe', tables.team, { toggleNames: true });
  showTable(section, 'Principais motivos', tables.reasons);
  showTable(section, 'Notas dadas pelos clientes', tables.stars);
  showTable(section, 'Plantão por turno', tables.shifts);
  showTable(section, 'Desfecho do plantão', tables.outcomes);
  output.append(section);
}
