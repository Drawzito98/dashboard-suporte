// Validação de férias pelo período analisado, independente da data de hoje.
function getFeriasPeriodo(colaborador, meses, lista) {
  const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toLowerCase();
  if (!normalize(colaborador)) return { periodos: [], dias: 0 };
  if (!Array.isArray(lista)) {
    try { lista = JSON.parse(localStorage.getItem('sistema_ferias_v1') || '[]'); } catch { lista = []; }
  }
  if (!Array.isArray(lista)) lista = [];
  const selected = [...new Set(meses || [])].filter(m => /^\d{4}-(0[1-9]|1[0-2])$/.test(String(m)));
  const validDate = value => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return false;
    const date = new Date(value + 'T00:00:00Z');
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  };
  const periodos = [], days = new Set();
  lista.forEach(item => {
    if (!item || normalize(item.colaborador) !== normalize(colaborador) || !validDate(item.data_inicio) || !validDate(item.data_fim) || item.data_inicio > item.data_fim) return;
    let overlaps = false;
    selected.forEach(mes => {
      const first = mes + '-01';
      const last = new Date(Date.UTC(Number(mes.slice(0, 4)), Number(mes.slice(5)), 0)).toISOString().slice(0, 10);
      const start = item.data_inicio > first ? item.data_inicio : first;
      const end = item.data_fim < last ? item.data_fim : last;
      if (start > end) return;
      overlaps = true;
      for (let day = Date.parse(start + 'T00:00:00Z'); day <= Date.parse(end + 'T00:00:00Z'); day += 86400000) days.add(day);
    });
    if (overlaps && !periodos.some(p => p.inicio === item.data_inicio && p.fim === item.data_fim)) periodos.push({ inicio: item.data_inicio, fim: item.data_fim });
  });
  periodos.sort((a, b) => a.inicio.localeCompare(b.inicio));
  return { periodos, dias: days.size };
}

function getFeriasResultado(colaborador, rows) {
  const result = getFeriasPeriodo(colaborador, (rows || []).map(row => row['Mês']));
  const observacao = (rows || []).some(row => /\bferias?\b/.test(String(row['Observações'] || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()));
  const br = date => date.split('-').reverse().join('/');
  const detalhes = result.periodos.length ? `${result.periodos.map(p => `${br(p.inicio)} a ${br(p.fim)}`).join('; ')} · ${result.dias} dia(s) no período analisado` : observacao ? 'Férias informadas nas observações; sem datas cadastradas para este período.' : '';
  return { ...result, esteve: result.dias > 0 || observacao, detalhes };
}

if (typeof module !== 'undefined') module.exports = { getFeriasPeriodo, getFeriasResultado };
