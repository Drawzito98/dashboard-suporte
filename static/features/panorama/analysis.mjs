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
  const peak = peakBy(days, day => day.finalizados);
  if (peak?.finalizados) findings.push(date(peak.date) + ' teve o maior volume de finalizações (' + format.format(peak.finalizados) + ').');
  const spillover = days.filter(day => day.finalizados && !day.assumidos);
  for (const day of spillover) findings.push(date(day.date) + ' teve ' + format.format(day.finalizados) + ' finalizados e nenhum assumido.');
  const lead = (key, column, label) => {
    const row = tables[key]?.rows[0];
    const value = row && quantity(row[column]);
    if (value > 0) findings.push(label + row[0] + ' (' + format.format(value) + ' finalizados).');
  };
  lead('departments', 2, 'Departamento com mais finalizações: ');
  lead('reasons', 1, 'Motivo mais frequente: ');
  if (kpis.total > 0 && kpis.avaliados !== undefined) {
    findings.push(format.format(kpis.avaliados / kpis.total * 100) + '% dos atendimentos receberam avaliação do cliente.');
  }
  if (kpis.total > 0 && kpis.inatividade !== undefined) {
    findings.push(format.format(kpis.inatividade / kpis.total * 100) + '% dos atendimentos no recorte foram encerrados por inatividade.');
  }
  return { tables, findings };
}

function node(tag, text) {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  return element;
}

function showTable(target, title, data, { heatmap = false, hiddenNames = false } = {}) {
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
  if (hiddenNames) {
    const label = node('label');
    const toggle = node('input');
    toggle.type = 'checkbox';
    label.append(toggle, ' Exibir nomes da equipe');
    target.append(label);
    toggle.addEventListener('change', () => data.rows.forEach((row, i) => {
      tbody.rows[i].cells[0].textContent = toggle.checked ? row[0] : 'Atendente ' + (i + 1);
    }));
  }
  data.rows.forEach((row, i) => {
    const tr = tbody.insertRow();
    row.forEach((value, column) => {
      const cell = node(column ? 'td' : 'th', hiddenNames && !column ? 'Atendente ' + (i + 1) : value);
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
  const list = node('ul');
  for (const finding of analysis.findings) list.append(node('li', finding));
  if (list.childElementCount) section.append(list);
  const { tables } = analysis;
  showTable(section, 'Assumidos e finalizados por dia', {
    headers: ['Data', 'Assumidos', 'Finalizados'],
    rows: days.map(day => [date(day.date), day.assumidos, day.finalizados])
  });
  showTable(section, 'Quando os atendimentos são assumidos', tables.heatmap, { heatmap: true });
  showTable(section, 'Departamentos', tables.departments);
  showTable(section, 'Equipe', tables.team, { hiddenNames: true });
  showTable(section, 'Principais motivos', tables.reasons);
  showTable(section, 'Notas dadas pelos clientes', tables.stars);
  showTable(section, 'Plantão por turno', tables.shifts);
  showTable(section, 'Desfecho do plantão', tables.outcomes);
  output.append(section);
}
