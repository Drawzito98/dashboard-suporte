import { joinTeamLevels, joinTeamNames, n1FinalizedGap, n1PeriodTarget, parseScore } from './analysis.mjs?v=20';
import { newestHistoryFirst } from './history.mjs?v=2';

function memberRows(team) {
  if (!team?.headers || !team?.rows) return [];
  const columns = ['Atendente', 'Finalizados', 'Média aval.'].map(label => team.headers.indexOf(label));
  if (columns.some(index => index === -1)) return [];
  return team.rows.map(row => columns.map(index => row[index])).filter(([name]) => name);
}

function monthlyEligibility(records, month) {
  const accepted = [];
  return new Map([...records].sort(newestHistoryFirst).map(record => {
    const { id, periodo_inicio: start, periodo_fim: end } = record;
    if (start.slice(0, 7) !== month || end.slice(0, 7) !== month) return [id, 'cross-month'];
    if (accepted.some(other => start <= other.periodo_fim && other.periodo_inicio <= end)) return [id, 'overlap'];
    accepted.push(record);
    return [id, 'included'];
  }));
}

export function buildHistoryPeople(records, month, registry) {
  const inMonth = records.filter(record => record.periodo_inicio.slice(0, 7) <= month &&
    record.periodo_fim.slice(0, 7) >= month);
  const eligibility = monthlyEligibility(inMonth, month);
  const people = new Map();
  const periods = inMonth.map(record => {
    const rows = memberRows(record.equipe);
    const names = joinTeamNames(rows, registry);
    const levels = joinTeamLevels(rows, registry);
    const { periodo_inicio: start, periodo_fim: end } = record;
    const { target } = n1PeriodTarget({ start, end });
    const members = new Map();
    rows.forEach(([sourceName, volume, score], index) => {
      const name = names[index] || sourceName;
      const id = (names[index] ? 'cadastro:' : 'zip:') + name;
      if (!people.has(id)) people.set(id, { id, name, level: levels[index] });
      const rawVolume = String(volume ?? '').trim();
      const total = /^(?:\d+|\d{1,3}(?:\.\d{3})+)$/.test(rawVolume) ? Number(rawVolume.replaceAll('.', '')) : NaN;
      const finalized = Number.isSafeInteger(total) ? total : null;
      const duplicate = members.has(id);
      members.set(id, duplicate ? { ambiguous: true } : {
        finalized,
        score: parseScore(score),
        balance: finalized === null ? null : n1FinalizedGap(levels[index], rawVolume, target)
      });
    });
    return { id: record.id, start, end, target, members, eligibility: eligibility.get(record.id) };
  }).sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end));
  return { people: [...people.values()].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')), periods };
}

export function summarizeHistoryPerson(periods, personId) {
  let total = 0;
  let included = 0;
  const rows = periods.map(({ members, eligibility, ...period }) => {
    const member = members.get(personId);
    let status = eligibility;
    if (member?.ambiguous) status = 'ambiguous';
    else if (!member || member.finalized === null) status = 'missing';
    if (status === 'included') {
      total += member.finalized;
      included++;
    }
    return { ...period, ...member, status };
  });
  return { total: included ? total : null, included, rows };
}
