/* Diagnósticos determinísticos, sem escrita ou dependência de DOM. */
(function (root) {
  'use strict';
  const TARGET = 4.70;
  const key = v => String(v ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').trim().toLowerCase().replace(/\s+/g, ' ');
  const numeric = v => {
    if (v == null || typeof v === 'boolean' || String(v).trim() === '') return null;
    const n = Number(String(v).trim().replace(',', '.'));
    return Number.isFinite(n) && n >= 0 ? n : null;
  };
  const mean = xs => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
  const sum = (rows, field) => {
    const values = rows.map(r => numeric(r[field]));
    return values.length && values.every(v => v !== null) ? values.reduce((a, b) => a + b, 0) : null;
  };
  function shift(month, offset) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month || '')) return '';
    const date = new Date(`${month}-01T00:00:00Z`); date.setUTCMonth(date.getUTCMonth() + offset);
    return date.toISOString().slice(0, 7);
  }
  function range(start, end) {
    if (!shift(start, 0) || !shift(end, 0) || start > end) throw new Error('Informe um intervalo mensal válido.');
    const result = [];
    for (let month = start; month <= end; month = shift(month, 1)) {
      if (result.length >= 120) throw new Error('Selecione até 120 meses por período.');
      result.push(month);
    }
    return result;
  }
  function previousFor(months) {
    const first = [...months].sort()[0];
    return months.map((_, index) => shift(first, index - months.length));
  }
  const isAI = name => /^cadu(?:\s|$|[-(])/i.test(key(name));
  const aggregateName = name => /^(total|totais|media)(\s|$)/.test(key(name));
  function infoFor(name, registry) {
    const entries = Object.entries(registry || {});
    const exact = entries.find(([n]) => key(n) === key(name));
    if (exact) return exact[1];
    const first = key(name).split(' ')[0];
    const matches = entries.filter(([n]) => key(n).split(' ')[0] === first);
    return matches.length === 1 ? matches[0][1] : {};
  }
  function context(records, filters = {}, registry = {}) {
    return (records || []).filter(r => r && r.Atendente && !aggregateName(r.Atendente) && !isAI(r.Atendente) && shift(r['Mês'], 0))
      .filter(r => (!filters.setor || filters.setor === 'all' || key(r.Setor) === key(filters.setor)) &&
        (!filters.colaborador || filters.colaborador === 'all' || key(r.Atendente) === key(filters.colaborador)) &&
        (!filters.nivel || filters.nivel === 'all' || key(infoFor(r.Atendente, registry).nivel) === key(filters.nivel)) &&
        (!filters.pesquisa || ['Atendente', 'Setor', 'Mês', 'Arquivo'].some(f => key(r[f]).includes(key(filters.pesquisa)))));
  }
  function duration(value) {
    const match = String(value ?? '').trim().match(/^(\d+):([0-5]\d):(60|[0-5]\d)$/);
    return match ? +match[1] * 3600 + +match[2] * 60 + +match[3] : null;
  }
  function metrics(rows) {
    const byPerson = new Map();
    rows.forEach(r => {
      const score = numeric(r.SCORE);
      if (score === null || score > 5) return;
      const name = key(r.Atendente);
      if (!byPerson.has(name)) byPerson.set(name, []);
      byPerson.get(name).push(score);
    });
    const score = mean([...byPerson.values()].map(mean));
    // Apenas contagens explicitamente identificadas. Total/Finalizados não são avaliações.
    const rated = rows.filter(r => numeric(r.SCORE) !== null && numeric(r.SCORE) <= 5);
    const weights = rated.map(r => numeric(r['Quantidade avaliações']));
    const weightedAvailable = rated.length > 0 && rated.length === rows.length && weights.every(v => v !== null && Number.isInteger(v));
    const evaluations = weightedAvailable ? weights.reduce((a, b) => a + b, 0) : null;
    const finished = sum(rows, 'Finalizados'), assumed = sum(rows, 'Assumidos');
    const avgDuration = field => mean(rows.map(r => duration(r[field])).filter(v => v !== null));
    return { records: rows.length, people: new Set(rows.map(r => key(r.Atendente))).size,
      score, scoredPeople: byPerson.size, weightedScore: evaluations > 0 ? rated.reduce((s, r, i) => s + numeric(r.SCORE) * weights[i], 0) / evaluations : null,
      evaluations, finished, assumed, transferred: sum(rows, 'Transferidos'),
      completion: finished !== null && assumed > 0 ? finished / assumed : null,
      tma: avgDuration('TMA'), tmr: avgDuration('TMR') };
  }
  const fmt = (v, digits = 2) => v === null ? 'Sem informação' : v.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  function analyze(records, options = {}) {
    const registry = options.registry || {}, now = options.today || new Date().toISOString().slice(0, 10);
    const selected = context(records, options.filters, registry);
    const available = [...new Set(selected.map(r => r['Mês']))].sort();
    const current = options.current || (available.length ? [available.at(-1)] : [now.slice(0, 7)]);
    const previous = options.previous || previousFor(current);
    if (!current.length || !previous.length || [...current, ...previous].some(m => !shift(m, 0))) throw new Error('Períodos inválidos.');
    if (current.some(m => previous.includes(m))) throw new Error('Os períodos de comparação não podem se sobrepor.');
    const end = [...current].sort().at(-1);
    const all = selected.filter(r => r['Mês'] <= end);
    const inPeriod = (rows, months) => rows.filter(r => months.includes(r['Mês']));
    const groups = new Map();
    all.forEach(row => {
      const level = String(infoFor(row.Atendente, registry).nivel || 'Sem nível').trim().toUpperCase();
      const sector = String(row.Setor || 'Sem setor');
      const entities = [{ type: 'sector', name: sector }, { type: 'person', name: row.Atendente }];
      entities.forEach(entity => {
        const id = JSON.stringify([entity.type, key(entity.name), key(sector), level]);
        if (!groups.has(id)) groups.set(id, { ...entity, sector, level, rows: [] });
        groups.get(id).rows.push(row);
      });
    });
    const results = [];
    groups.forEach(group => {
      const curRows = inPeriod(group.rows, current), prevRows = inPeriod(group.rows, previous);
      if (!curRows.length) return;
      const cur = metrics(curRows), prev = metrics(prevRows);
      const history = [...new Set(group.rows.map(r => r['Mês']))].sort().map(month => ({ month, ...metrics(group.rows.filter(r => r['Mês'] === month)) }));
      const notices = [];
      const missingMonths = (months, rows) => months.filter(m => !rows.some(r => r['Mês'] === m));
      if (missingMonths(current, curRows).length || missingMonths(previous, prevRows).length) notices.push('Há meses sem dados em um dos períodos; ausência não significa zero.');
      const partial = [...current, ...previous].some(m => m >= now.slice(0, 7)) || [...curRows, ...prevRows].some(r => r.periodo_completo === false);
      if (partial) notices.push('Mês em andamento, futuro ou parcial: volumes não são comparáveis a meses completos.');
      if (current.length !== previous.length) notices.push('Os períodos têm durações diferentes; volumes não são comparáveis.');
      notices.push('A cobertura integral dos meses históricos não é comprovada pelo CSV. Confirme o intervalo exportado.');
      const curPeople = [...new Set(curRows.map(r => key(r.Atendente)))].sort().join('|');
      const prevPeople = [...new Set(prevRows.map(r => key(r.Atendente)))].sort().join('|');
      const samePeople = curPeople === prevPeople;
      if (prevRows.length && !samePeople) notices.push('A composição da equipe mudou; a comparação coletiva pode refletir essa mudança.');
      const findings = [];
      const add = (code, indicator, evidence, interpretation, hypothesis, action, kind = 'attention') => findings.push({ code, indicator, evidence, interpretation, hypothesis, action, kind });
      if (cur.score !== null) {
        add('score-target', 'Score médio individual · meta 4,70', `${fmt(cur.score)}; meta oficial ${fmt(TARGET)}; ${cur.scoredPeople} pessoa(s) com Score em ${cur.people}.`, cur.score >= TARGET ? 'Média simples na meta ou acima dela; ponto forte no recorte.' : 'Média simples abaixo da meta oficial; oportunidade de melhoria.', 'O resultado pode variar conforme os casos atendidos e a cobertura de avaliações. Essa hipótese não comprova causa.', cur.score >= TARGET ? 'Revisar amostras de atendimento e registrar práticas que possam ser compartilhadas no mesmo nível.' : 'Revisar atendimentos avaliados, motivos das notas e contexto antes de definir orientações.', cur.score >= TARGET ? 'positive' : 'attention');
      } else add('score-missing', 'Score', 'Não há Score válido no período atual.', 'Dados insuficientes para avaliar qualidade ou cumprimento da meta.', 'A exportação pode não conter avaliações; é necessário verificar.', 'Conferir o relatório de origem e a disponibilidade de notas.', 'insufficient');
      if (cur.score !== null && prev.score !== null) {
        const delta = cur.score - prev.score;
        add('score-change', 'Evolução do Score médio individual', `${previous.join(', ')}: ${fmt(prev.score)} → ${current.join(', ')}: ${fmt(cur.score)}; variação ${fmt(delta)} ponto(s).`, delta > 0 ? 'Evolução positiva na média observada.' : delta < 0 ? 'Queda na média observada.' : 'Média observada estável.', 'Mudanças na composição dos casos ou das avaliações podem explicar a variação; precisam ser investigadas.', 'Comparar amostras equivalentes do próprio histórico, no mesmo setor e nível. Confirmar cobertura e tamanho da amostra.', delta > 0 ? 'positive' : delta < 0 ? 'attention' : 'neutral');
      } else add('comparison-missing', 'Comparação entre períodos', `${previous.join(', ')}: ${prev.records} registro(s); ${current.join(', ')}: ${cur.records} registro(s).`, 'Base insuficiente para comparar Score entre os dois períodos.', 'Pode haver lacuna no histórico ou notas ausentes.', 'Conferir os meses importados antes de interpretar uma tendência.', 'insufficient');
      const safeVolume = !partial && current.length === previous.length && !missingMonths(current, curRows).length && !missingMonths(previous, prevRows).length && samePeople;
      if (cur.finished !== null && prev.finished !== null && prev.finished > 0) {
        add('volume', 'Volume de finalizados', `${previous.join(', ')}: ${fmt(prev.finished, 0)} → ${current.join(', ')}: ${fmt(cur.finished, 0)}.`, safeVolume ? `Variação observada de ${fmt((cur.finished / prev.finished - 1) * 100, 1)}%. Cobertura dos meses precisa de confirmação; volume não mede produtividade isoladamente.` : 'Comparação descritiva; não classifica ganho ou queda de produtividade por falta de equivalência.', 'Demanda, dias trabalhados e complexidade dos casos podem variar. Não há evidência suficiente para atribuir responsabilidade.', 'Conferir cobertura, férias, escala e perfil dos casos antes de comparar entregas.', 'neutral');
      }
      for (const field of ['tma', 'tmr']) {
        if (cur[field] !== null && prev[field] !== null && prev[field] > 0 && cur[field] > prev[field] * 1.15) add(field, field.toUpperCase(), `${fmt(prev[field] / 60, 1)} → ${fmt(cur[field] / 60, 1)} minutos; médias simples dos tempos informados.`, 'Aumento observado superior a 15%; possível gargalo a investigar, sem causa comprovada.', 'Complexidade, capacidade da fila ou etapas do processo podem ter mudado.', 'Examinar horários, fila e casos de maior duração; separar fatores de processo e de atendimento.');
      }
      if (cur.transferred !== null && cur.assumed > 0) add('transfers', 'Transferências · contexto', `${fmt(cur.transferred, 0)} transferências / ${fmt(cur.assumed, 0)} assumidos (${fmt(cur.transferred / cur.assumed * 100, 1)}%).`, 'Transferência é um evento de fluxo; não representa falha automaticamente.', 'O encaminhamento pode ser necessário ao nível ou à especialidade do atendimento.', 'Conferir destinos, motivos e roteamento antes de avaliar necessidade de intervenção.', 'neutral');
      const recent = history.slice(-3);
      const consecutive = recent.length === 3 && shift(recent[0].month, 1) === recent[1].month && shift(recent[1].month, 1) === recent[2].month;
      const recurring = consecutive && recent.every(m => m.score !== null) && recent[0].score > recent[1].score && recent[1].score > recent[2].score;
      if (recurring) add('recurring-drop', 'Quedas recorrentes de Score', recent.map(m => `${m.month}: ${fmt(m.score)}`).join(' → '), 'Duas quedas consecutivas em três meses com dados; sinal para acompanhamento.', 'Mudanças de demanda ou padrões recorrentes nos atendimentos podem estar relacionados, sem causa demonstrada.', 'Revisar amostras dos três meses e confrontar os motivos das notas com as observações da liderança.');
      if (consecutive && recent.every(m => m.score !== null && m.score < TARGET)) add('recurring-target', 'Meta de Score · recorrência', recent.map(m => `${m.month}: ${fmt(m.score)}`).join('; '), 'Média abaixo de 4,70 por três meses consecutivos.', 'Pode haver um padrão persistente; a quantidade de avaliações e o contexto ainda precisam ser verificados.', 'Investigar temas repetidos nas notas e acompanhar a próxima medição sem assumir causa.');
      const baseline = history.filter(m => m.month < [...current].sort()[0] && m.score !== null);
      const ownBaseline = mean(baseline.map(m => m.score));
      if (ownBaseline !== null && cur.score !== null) add('own-history', 'Comparação com o próprio histórico', `Média simples de ${baseline.length} meses anteriores: ${fmt(ownBaseline)}; atual: ${fmt(cur.score)}.`, cur.score >= ownBaseline ? 'Resultado atual igual ou acima do próprio histórico disponível.' : 'Resultado atual abaixo do próprio histórico disponível.', 'Alterações no contexto podem tornar os meses menos equivalentes.', 'Investigar o que mudou no período; priorizar comparações com casos e condições semelhantes.', cur.score >= ownBaseline ? 'positive' : 'attention');
      const goalResults = (options.goals || []).filter(g => g.metric !== 'score' && g.type !== 'weekly' && (!g.collaborator || key(g.collaborator) === key(group.name)) && (!g.setor || g.setor === 'all' || key(g.setor) === key(group.sector)) && (g.period && g.period !== 'all' ? current.includes(g.period) && current.length === 1 : current.length === 1) && (group.type === 'person' ? !!g.collaborator : !g.collaborator)).map(g => {
        const value = g.metric === 'finalizados' ? cur.finished : g.metric === 'produtividade' ? cur.completion : null;
        const target = numeric(g.target);
        return { title: g.title || g.metric, metric: g.metric, value, target, comparable: g.metric !== 'finalizados' || !partial, met: value !== null && target !== null ? value >= target : null };
      });
      const objective = sum(curRows, 'Objetivo');
      if (objective > 0 && group.type === 'person') goalResults.push({ title: 'Objetivo registrado no histórico', metric: 'finalizados', value: cur.finished, target: objective, comparable: !partial, met: cur.finished === null ? null : cur.finished >= objective });
      results.push({ ...group, rows: undefined, current: cur, previous: prev, history, notices, findings, recurring, goalResults });
    });
    return { current, previous, groups: results, excludedAI: (records || []).filter(r => isAI(r?.Atendente) && current.includes(r?.['Mês'])).length, target: TARGET };
  }
  const canReview = user => user?.app_metadata?.role === 'admin' && !!user?.id;
  const api = { TARGET, key, numeric, metrics, duration, shift, range, previousFor, context, analyze, canReview, infoFor };
  root.DiagnosticoEngine = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
