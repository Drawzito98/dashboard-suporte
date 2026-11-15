import { schemas } from './registry.mjs';
import { parseCsv, normalize } from './csv.mjs';
import { buildAnalysis } from './analysis.mjs?v=17';

const sources = {
  assumidos: 'atendimentos_assumidos.csv',
  finalizados: 'atendimentos_finalizados.csv',
  clientes: 'clientes_atendidos.csv',
  inatividade: 'encerrados_por_inatividade.csv',
  nota: 'score_médio_(cliente).csv',
  tme: 'tme_·_tempo_médio_de_espera.csv',
  tmi: 'tmi_·_tempo_médio_de_interação.csv',
  tmr: 'tmr_·_tempo_médio_de_resolução.csv',
  recorrencia: 'taxa_de_recorrência.csv',
  sla: 'sla_do_plantão_(2h).csv'
};
const dayFile = 'atendimentos_por_dia.csv';
const teamFile = 'performance_por_colaborador.csv';
const departmentFile = 'performance_por_departamento.csv';
const totalFile = 'total_de_atendimentos_no_recorte.csv';
const ratingFile = 'avaliação_do_cliente_(estrelas).csv';
const starsFile = 'distribuição_de_notas_por_estrela.csv';
const queueFile = 'tempo_de_fila_por_faixa.csv';
const required = new Set([...Object.values(sources), dayFile, teamFile, departmentFile, totalFile, ratingFile, starsFile, queueFile]);
const pivotFiles = new Set(['assumidos_por_dia_×_hora.csv', 'abertos_por_dia_×_hora.csv']);
const weekdays = new Set(['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom']);
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const subtotal = /^(?:total(?: geral)?|totais)$/i;

function count(value, blankIsZero = false) {
  const raw = value.trim();
  if (!raw && blankIsZero) return 0;
  if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)$/.test(raw)) throw new Error('Contagem inválida.');
  const result = Number(raw.replace(/\./g, ''));
  if (!Number.isSafeInteger(result)) throw new Error('Contagem fora dos limites.');
  return result;
}

function decimal(value, max, percent = false) {
  const raw = value.trim();
  const pattern = percent ? /^\d+(?:[.,]\d+)?%$/ : /^\d+(?:[.,]\d+)?$/;
  const result = Number(raw.replace('%', '').replace(',', '.'));
  if (!pattern.test(raw) || result > max) throw new Error('Valor decimal fora dos limites.');
  return result;
}

function duration(value) {
  const raw = value.trim();
  if (/^(?:—|–|-|::)?$/.test(raw)) return null;
  const clock = raw.match(/^(\d+):([0-5]\d):([0-5]\d|60)$/);
  const units = raw.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
  const match = clock || units;
  if (!match) throw new Error('Duração inválida.');
  const seconds = (Number(match[1] || 0) * 60 + Number(match[2] || 0)) * 60 + Number(match[3] || 0);
  if (!Number.isSafeInteger(seconds)) throw new Error('Duração fora dos limites.');
  return seconds;
}

function matchesHeader(name, actual, expected) {
  if (!actual) return false;
  const columns = actual.map(normalize);
  const headers = expected.map(normalize);
  if (pivotFiles.has(name)) {
    const days = columns.slice(1);
    return columns[0] === headers[0] && days.length > 0 && days.length <= 7 &&
      new Set(days).size === days.length && days.every(day => weekdays.has(day));
  }
  return columns.length === headers.length && columns.every((column, index) => column === headers[index]);
}

export async function analyzeWeekly(entries) {
  const reports = new Map();
  const headers = new Map();
  const seen = new Set();
  const issues = [];
  const issue = (severity, code, file, message) => issues.push({ severity, code, file, message });
  for await (const entry of entries) {
    const name = normalize(entry.name.split(/[\\/]/).pop());
    if (!Object.hasOwn(schemas, name)) {
      issue('warning', 'unknown-file', name, 'CSV fora do catálogo.');
      continue;
    }
    if (seen.has(name)) {
      issue('error', 'duplicate-file', name, 'Há duas entradas com este nome.');
      continue;
    }
    seen.add(name);
    try {
      const [header, ...rows] = parseCsv(entry.text.replace(/^\uFEFF/, ''));
      if (!matchesHeader(name, header, schemas[name]) || rows.some(row => row.length !== header.length)) {
        throw new Error('Colunas diferentes do schema esperado.');
      }
      reports.set(name, rows);
      headers.set(name, header);
    } catch (error) {
      issue(required.has(name) ? 'error' : 'warning', 'schema', name, error.message);
    }
  }
  for (const name of Object.keys(schemas)) {
    if (!seen.has(name)) issue(required.has(name) ? 'error' : 'warning', 'missing-file', name, 'CSV esperado ausente.');
  }

  const kpis = {};
  const read = (file, action, severity = 'error') => {
    if (!reports.has(file)) return undefined;
    try {
      return action(reports.get(file));
    } catch (error) {
      issue(severity, 'invalid-data', file, error.message);
      return undefined;
    }
  };
  const one = rows => {
    if (rows.length !== 1) throw new Error('Esperada uma única linha de indicador.');
    return rows[0][0];
  };
  for (const [key, file] of Object.entries(sources)) {
    const parse = key === 'nota' ? value => decimal(value, 5) :
      ['recorrencia', 'sla'].includes(key) ? value => decimal(value, 100, true) :
      ['tme', 'tmi', 'tmr'].includes(key) ? duration : count;
    kpis[key] = read(file, rows => parse(one(rows)));
  }

  const sum = (rows, column, blanks = false) =>
    rows.reduce((total, row) => total + count(row[column], blanks), 0);
  const reconcile = (file, label, actual, expected) => {
    if (actual !== undefined && expected !== undefined && actual !== expected) {
      issue('error', 'total-mismatch', file, label + ': ' + actual + ' no relatório e ' + expected + ' no indicador.');
    }
  };
  const days = read(dayFile, rows => {
    const data = rows.filter(row => row[0] !== 'Data do Evento Date');
    const dates = data.map(row => row[0]);
    if (!dates.length || dates.some(date => !datePattern.test(date) ||
        !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) ||
        new Set(dates).size !== dates.length) throw new Error('Datas ausentes, inválidas ou duplicadas.');
    return data.map(row => ({ date: row[0], assumidos: count(row[1], true), finalizados: count(row[2], true) }))
      .sort((a, b) => a.date.localeCompare(b.date));
  });
  const period = days ? { start: days[0].date, end: days.at(-1).date } : null;
  if (days) {
    for (const key of ['assumidos', 'finalizados']) {
      reconcile(dayFile, key, days.reduce((total, day) => total + day[key], 0), kpis[key]);
    }
  }
  const readPerformance = file => read(file, rows => {
    const data = rows.filter(row => !subtotal.test(row[0].trim()));
    if (!data.length) throw new Error('Relatório sem linhas de desempenho.');
    reconcile(file, 'Assumidos', sum(data, 1, true), kpis.assumidos);
    reconcile(file, 'Finalizados', sum(data, 2, true), kpis.finalizados);
    if (file === departmentFile) {
      reconcile(file, 'Encerrados por inatividade', sum(data, 9, true), kpis.inatividade);
      return sum(data, 8, true);
    }
    return undefined;
  });
  readPerformance(teamFile);
  const departmentRated = readPerformance(departmentFile);
  kpis.total = read(totalFile, rows => count(one(rows)));
  kpis.avaliados = read(ratingFile, rows => {
    const rated = rows.filter(row => normalize(row[0]) === 'atendimentos avaliados pelo cliente');
    if (rated.length > 1) throw new Error('Categoria de avaliados duplicada.');
    reconcile(ratingFile, 'Atendimentos', sum(rows, 1), kpis.total);
    return rated.length ? count(rated[0][1]) : 0;
  });
  reconcile(departmentFile, 'Avaliados', departmentRated, kpis.avaliados);
  const stars = read(starsFile, rows => sum(rows, 1, true) + sum(rows, 2, true) + sum(rows, 3, true));
  reconcile(starsFile, 'Avaliações', stars, kpis.avaliados);
  kpis.fila = read(queueFile, rows => sum(rows, 1, true) + sum(rows, 2, true) + sum(rows, 3, true));

  const compareFile = 'comparativo_de_período.csv';
  const compared = read(compareFile, rows => {
    const row = rows.find(item => normalize(item[0]) === 'finalizados');
    return row ? count(row[1]) : undefined;
  }, 'warning');
  if (compared !== undefined && kpis.finalizados !== undefined && compared !== kpis.finalizados) {
    issue('warning', 'comparison-scope', compareFile, 'O comparativo usa ' + compared + ' finalizados para ' + kpis.finalizados + ' no recorte importado.');
  }
  const monthsFile = 'volume__assumidos_vs._finalizados_(12_meses).csv';
  const months = reports.get(monthsFile)?.filter(row => /^\d{4}-\d{2}$/.test(row[0]));
  if (months && months.length < 12) {
    issue('warning', 'partial-month-history', monthsFile, 'O histórico contém ' + months.length + ' de 12 meses.');
  }
  const detailFile = 'análise_livre.csv';
  const detail = reports.get(detailFile);
  if (detail && detail.length === 200) {
    issue('warning', 'detail-limit', detailFile, 'A análise livre contém 200 linhas e pode estar limitada pelo exportador.');
  }
  return {
    schemaVersion: 1,
    period,
    kpis,
    days: days ?? [],
    analysis: issues.some(item => item.severity === 'error') ? null : buildAnalysis(reports, headers, days ?? [], kpis),
    files: { expected: Object.keys(schemas).length, validated: reports.size },
    issues,
    valid: !issues.some(item => item.severity === 'error')
  };
}
