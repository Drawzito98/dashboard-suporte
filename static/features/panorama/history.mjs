const HISTORY_TABLE = 'panorama_importacoes';
const SUMMARY_COLUMNS = 'id,periodo_inicio,periodo_fim,updated_at,dias:relatorio->days,finalizados:relatorio->kpis->finalizados,nota:relatorio->analysis->score->confirmedMean';
const TABLES = ['departments', 'team', 'reasons', 'stars', 'shifts', 'outcomes', 'heatmap'];

export function buildHistorySnapshot(report) {
  if (report?.schemaVersion !== 1 || !report.valid || !report.period || !report.analysis || !report.days?.length) {
    throw new Error('Valide o ZIP antes de salvar os dados.');
  }
  const { period, kpis, analysis, files, issues } = report;
  const tables = Object.fromEntries(TABLES.filter(key => analysis.tables[key]).map(key => [key, analysis.tables[key]]));
  return {
    schemaVersion: 1, valid: true, period, kpis, files,
    days: report.days.map(({ date, assumidos, finalizados }) => ({ date, assumidos, finalizados })),
    analysis: { tables, score: analysis.score, findings: analysis.findings, checks: analysis.checks },
    issues: issues.map(({ severity, code, file, message }) => ({
      severity, code, file: code === 'unknown-file' ? 'Arquivo fora do catálogo' : file, message
    }))
  };
}

export function historyMonths(records) {
  return [...new Set(records.flatMap(record => record.dias.map(day => day.date.slice(0, 7))))].sort().reverse();
}

export function summarizeHistoryMonth(records, month) {
  const available = new Map();
  const duplicates = new Set();
  const newestFirst = [...records].sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at) || a.id.localeCompare(b.id));
  for (const record of newestFirst) {
    for (const day of record.dias) {
      if (day.date.slice(0, 7) !== month) continue;
      if (available.has(day.date)) duplicates.add(day.date);
      else available.set(day.date, day.finalizados);
    }
  }
  const start = new Date(month + '-01T00:00:00Z');
  const weeks = [];
  let total = 0;
  for (const day = new Date(start); day.toISOString().slice(0, 7) === month; day.setUTCDate(day.getUTCDate() + 1)) {
    const key = day.toISOString().slice(0, 10);
    if (!weeks.length || day.getUTCDay() === 1) weeks.push({ start: key, end: key, days: 0, volume: 0, cumulative: total });
    const week = weeks.at(-1);
    week.end = key;
    if (!available.has(key)) continue;
    week.days++;
    week.volume += available.get(key);
    total += available.get(key);
    week.cumulative = total;
  }
  return { total, days: available.size, overlapping: duplicates.size, weeks };
}

function readResult({ data, error }, fallback) {
  if (error) {
    if (error.code === '23505') throw new Error('Esse período já foi salvo. Atualize o histórico e tente novamente.');
    throw new Error(fallback, { cause: error });
  }
  return data;
}

export function createPanoramaHistoryStore({ client, getUserId, currentUserId, isAdmin }) {
  const owner = currentUserId();
  async function session() {
    const uid = await getUserId();
    if (!owner || uid !== owner || currentUserId() !== owner || !isAdmin()) {
      throw new Error('Entre novamente para acessar o histórico privado.');
    }
    return uid;
  }
  const table = () => client.from(HISTORY_TABLE);
  return {
    isCurrent: () => owner && currentUserId() === owner && isAdmin(),
    async list() {
      const uid = await session();
      const records = [];
      const limit = 200;
      for (let offset = 0; ; offset += limit) {
        const page = readResult(await table().select(SUMMARY_COLUMNS).eq('user_id', uid)
          .order('periodo_inicio', { ascending: false }).order('id').range(offset, offset + limit - 1),
        'Não foi possível consultar o histórico.');
        records.push(...page);
        if (page.length < limit) return records;
      }
    },
    async find(period) {
      const uid = await session();
      return readResult(await table().select('id,updated_at').eq('user_id', uid)
        .eq('periodo_inicio', period.start).eq('periodo_fim', period.end).maybeSingle(),
      'Não foi possível verificar se este período já foi salvo.');
    },
    async open(id) {
      const uid = await session();
      const row = readResult(await table().select('relatorio').eq('user_id', uid).eq('id', id).maybeSingle(),
        'Não foi possível abrir o registro salvo.');
      if (!row) throw new Error('Esse registro não está mais no histórico.');
      return buildHistorySnapshot(row.relatorio);
    },
    async save(report, previous) {
      const snapshot = buildHistorySnapshot(report);
      const uid = await session();
      const fields = { periodo_inicio: snapshot.period.start, periodo_fim: snapshot.period.end, relatorio: snapshot };
      const query = previous
        ? table().update(fields).eq('user_id', uid).eq('id', previous.id).eq('updated_at', previous.updated_at)
        : table().insert({ ...fields, user_id: uid });
      const saved = readResult(await query.select('id').maybeSingle(), 'Não foi possível salvar o Panorama.');
      if (!saved) throw new Error('O registro foi alterado. Atualize o histórico antes de substituir.');
      return saved.id;
    },
    async delete(record) {
      const uid = await session();
      const removed = readResult(await table().delete().eq('user_id', uid).eq('id', record.id)
        .eq('updated_at', record.updated_at).select('id').maybeSingle(), 'Não foi possível excluir o registro.');
      if (!removed) throw new Error('O histórico mudou. Atualize a lista e confira o registro.');
    }
  };
}
