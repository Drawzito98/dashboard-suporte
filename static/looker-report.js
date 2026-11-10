(function () {
  'use strict';

  const clean = value => String(value ?? '').trim().replace(/\s+/g, ' ');
  const key = value => clean(value).toLocaleLowerCase('pt-BR');
  const nameKey = value => key(value).normalize('NFD').replace(/\p{Diacritic}/gu, '');
  const times = ['TMA', 'TMI', 'TMR'];
  const missingSector = 'Sem setor definido';
  const sum = rows => rows.reduce((total, row) => total + row.finished, 0);
  const columns = ['Atendente', 'Finalizados', 'Média aval.'];

  function registryLookup(entries, records = []) {
    const names = new Map(), firstNames = new Map(), historicalSectors = new Map();
    function remember(full) {
      const first = full.split(' ')[0];
      if (!firstNames.has(first)) firstNames.set(first, new Set());
      firstNames.get(first).add(full);
    }
    for (const [name, details] of entries) {
      const full = nameKey(name);
      if (!full) continue;
      names.set(full, names.has(full) ? null : details);
      remember(full);
    }
    for (const row of records) {
      const full = nameKey(row?.Atendente);
      const sector = clean(row?.Setor);
      if (!full) continue;
      remember(full);
      if (!sector) continue;
      if (!historicalSectors.has(full)) historicalSectors.set(full, new Map());
      historicalSectors.get(full).set(key(sector), sector);
    }
    return name => {
      const full = nameKey(name);
      const candidates = firstNames.get(full.split(' ')[0]);
      const exact = candidates?.has(full);
      const match = exact ? full : candidates?.size === 1 ? [...candidates][0] : null;
      if (!match || (names.has(match) && !names.get(match))) return null;
      const profile = names.get(match);
      const sectors = historicalSectors.get(match);
      return {
        setor_atual: clean(profile?.setor_atual) || (sectors?.size === 1 ? [...sectors.values()][0] : ''),
        nivel: profile?.nivel
      };
    };
  }

  function readRows(result, lookup, isAggregate, parseDuration) {
    if (!columns.every(column => result.meta.fields?.includes(column))) {
      throw Error('Selecione um CSV com as colunas Atendente, Finalizados e Média aval.');
    }
    if (result.errors.length) throw Error('O CSV tem linhas com formato inválido. Baixe novamente o arquivo no Looker.');
    const seen = new Set();
    const rows = [];
    result.data.forEach((row, index) => {
      const name = clean(row.Atendente);
      if (isAggregate(name)) return;
      const count = clean(row.Finalizados);
      const finished = Number(count.replace(/\./g, ''));
      const grade = clean(row['Média aval.']).replace(',', '.');
      const score = /^(?:|[-–—]+|n\/?a|n\/?d)$/i.test(grade) ? null : Number(grade);
      if (!name || !/^(?:\d+|\d{1,3}(?:\.\d{3})+)$/.test(count) || !Number.isSafeInteger(finished) ||
          (score !== null && (!/^\d+(?:\.\d+)?$/.test(grade) || score > 5))) {
        throw Error('Confira o atendente, o volume ou a nota no registro ' + (index + 1) + ' do CSV.');
      }
      if (seen.has(key(name))) throw Error('Há atendentes repetidos. Exporte uma linha por atendente no Looker.');
      seen.add(key(name));
      const profile = lookup(name);
      const durations = times.map(metric => {
        const value = clean(row[metric]);
        if (!/^(?:\d+:[0-5]\d(?::(?:[0-5]\d|60))?|(?=\d)(?:\d+\s*d\s*)?(?:\d+\s*h\s*)?(?:\d+\s*m\s*)?(?:\d+\s*s)?)$/i.test(value)) return null;
        const seconds = parseDuration(value);
        return Number.isFinite(seconds) ? seconds : null;
      });
      rows.push({ name, finished, score, sector: clean(profile?.setor_atual), level: clean(profile?.nivel), durations });
    });
    if (!rows.length) throw Error('O CSV não tem registros de atendentes.');
    return rows;
  }

  function summarize(rows, minimum, sectorFilter = '') {
    const eligible = rows.filter(row => row.finished >= minimum);
    const people = eligible.filter(row => !sectorFilter || (row.sector || missingSector) === sectorFilter)
      .sort((a, b) => b.finished - a.finished || a.name.localeCompare(b.name, 'pt-BR'));
    const groups = new Map();
    for (const row of people) {
      const sector = row.sector || missingSector;
      if (!groups.has(sector)) groups.set(sector, []);
      groups.get(sector).push(row);
    }
    function metrics(members) {
      const averageOf = values => {
        const known = values.filter(value => value !== null);
        return known.length ? known.reduce((total, value) => total + value, 0) / known.length : null;
      };
      const scores = members.map(row => row.score);
      const finished = sum(members);
      return {
        people: members.length, finished, average: members.length ? finished / members.length : null,
        score: averageOf(scores), rated: scores.filter(score => score !== null).length,
        durations: times.map((_, index) => averageOf(members.map(row => row.durations[index])))
      };
    }
    const sectors = [...groups].map(([sector, members]) => ({ sector, ...metrics(members) }))
      .sort((a, b) => b.finished - a.finished || a.sector.localeCompare(b.sector, 'pt-BR'));
    const overall = { sector: 'Total geral', ...metrics(people) };
    const sectorPeople = sectorFilter ? rows.filter(row => (row.sector || missingSector) === sectorFilter) : rows;
    return { people, sectors, overall, sourceTotal: sum(rows), belowMinimum: sectorPeople.filter(row => row.finished < minimum).length };
  }

  if (typeof module !== 'undefined') module.exports = { readRows, summarize, registryLookup };
  if (typeof document === 'undefined') return;

  const sectorStorageKey = 'looker_setores_confirmados_v1';
  const get = id => document.getElementById('looker' + id);
  const dialog = get('Dialog');
  const fileInput = get('File');
  const minimum = get('Minimum');
  const sectorFilter = get('Sector');
  const exportButton = get('Export');
  const number = new Intl.NumberFormat('pt-BR');
  const decimal = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const showDecimal = value => value === null ? '—' : decimal.format(value);
  const showDuration = value => {
    if (value === null) return '—';
    const seconds = Math.round(value);
    return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60]
      .map(part => String(part).padStart(2, '0')).join(':');
  };
  let rows = [];
  let availableSectors = [];
  let revision = 0;

  function record(values) {
    const tr = document.createElement('tr');
    for (const value of values) {
      const td = tr.insertCell();
      if (value instanceof Node) td.append(value);
      else td.textContent = value;
    }
    return tr;
  }

  function refreshSectorOptions() {
    const selected = sectorFilter.value;
    const sectors = [...new Set(rows.map(row => row.sector || missingSector))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    sectorFilter.replaceChildren(new Option('Todos os setores', ''), ...sectors.map(sector => new Option(sector, sector)));
    sectorFilter.value = sectors.includes(selected) ? selected : '';
    const choices = [...new Set([...availableSectors, ...sectors.filter(sector => sector !== missingSector)])];
    get('SectorChoices').replaceChildren(...choices.map(sector => new Option(sector, sector)));
  }

  function savedSectors() {
    try {
      return new Map(JSON.parse(appStorage.getItem(sectorStorageKey) || '[]'));
    } catch {
      return new Map();
    }
  }

  function saveSector(row) {
    const corrections = savedSectors();
    const name = nameKey(row.name);
    if (!row.sector || row.sector === row.suggestedSector) corrections.delete(name);
    else corrections.set(name, row.sector);
    try {
      appStorage.setItem(sectorStorageKey, JSON.stringify([...corrections]));
      return true;
    } catch {
      return false;
    }
  }

  function selectSector(row) {
    const input = document.createElement('input');
    input.setAttribute('aria-label', 'Setor de ' + row.name);
    input.setAttribute('list', 'lookerSectorChoices');
    input.placeholder = missingSector;
    input.value = row.sector;
    input.addEventListener('change', () => {
      const value = clean(input.value);
      row.sector = [...availableSectors, ...rows.map(item => item.sector)].find(sector => key(sector) === key(value)) ?? value;
      input.value = row.sector;
      const saved = saveSector(row);
      const wasFiltered = Boolean(sectorFilter.value);
      refreshSectorOptions();
      render({ keepPeople: !wasFiltered });
      if (!saved) get('Status').textContent += ' O setor foi ajustado nesta importação. O navegador não conseguiu guardar a correção.';
    });
    return input;
  }

  function currentReport() {
    return summarize(rows, minimum.valueAsNumber || 0, sectorFilter.value);
  }

  function renderSummary(report) {
    const { people, sectors, overall, sourceTotal, belowMinimum } = report;
    const metrics = [
      ['Finalizados no arquivo', sourceTotal], ['Finalizados após os filtros', overall.finished],
      ['Atendentes na lista', people.length], ['Atendentes abaixo do mínimo', belowMinimum]
    ];
    get('Totals').replaceChildren(...metrics.map(([label, value]) => {
      const card = document.createElement('div');
      const amount = document.createElement('strong');
      amount.textContent = number.format(value);
      card.append(amount, label);
      return card;
    }));
    const sectorRow = (row, label) => record([
      label, number.format(row.people), number.format(row.finished),
      showDecimal(row.average), showDecimal(row.score), ...row.durations.map(showDuration), number.format(row.rated)
    ]);
    get('Sectors').replaceChildren(...sectors.map(row => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn-small';
      button.textContent = row.sector;
      button.setAttribute('aria-label', 'Ver atendentes do setor ' + row.sector);
      button.addEventListener('click', () => {
        sectorFilter.value = row.sector;
        render();
        get('PeopleTitle').focus();
        get('PeopleTitle').scrollIntoView({ block: 'nearest' });
      });
      return sectorRow(row, button);
    }));
    get('Overall').replaceChildren(sectorRow(overall, overall.sector));
  }

  function render({ keepPeople = false } = {}) {
    const valid = minimum.value !== '' && minimum.validity.valid;
    get('Report').hidden = !rows.length || !valid;
    exportButton.disabled = !rows.length || !valid;
    if (get('Report').hidden) return;
    const report = currentReport();
    renderSummary(report);
    get('PeopleTitle').textContent = sectorFilter.value
      ? 'Atendentes no cálculo · ' + sectorFilter.value
      : 'Atendentes no cálculo';
    get('ClearSector').hidden = !sectorFilter.value;
    if (!keepPeople) get('People').replaceChildren(...report.people.map(row => record([
      row.name, selectSector(row), row.level || '—', number.format(row.finished), showDecimal(row.score), ...row.durations.map(showDuration)
    ])));
    get('Status').textContent = report.people.length
      ? rows.length + ' atendentes importados. ' + report.people.filter(row => !row.sector).length + ' sem setor na lista.'
      : 'Nenhum atendente corresponde aos filtros.';
  }

  window.openLookerReport = () => {
    if (document.body.dataset.role === 'colaborador') return;
    document.getElementById('toolsDialog').close();
    if (!dialog.open) dialog.showModal();
  };

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    if (!file) return;
    const request = ++revision;
    rows = [];
    availableSectors = [];
    refreshSectorOptions();
    render();
    get('Status').textContent = 'Lendo o CSV…';
    try {
      const source = await file.text();
      if (request !== revision) return;
      if (typeof Papa === 'undefined') throw Error('O leitor de CSV está indisponível. Recarregue o painel.');
      const info = Object.entries(getColabInfoLocal() || {});
      rows = readRows(Papa.parse(source, { header: true, skipEmptyLines: 'greedy', transformHeader: clean }),
        registryLookup(info, rawRecords.filter(row => row && !isAggregateName(row.Atendente))),
        isAggregateName, parseDurationToSeconds);
      const corrections = savedSectors();
      for (const row of rows) {
        row.suggestedSector = row.sector;
        const saved = corrections.get(nameKey(row.name));
        if (typeof saved === 'string' && saved) row.sector = saved;
      }
      availableSectors = [...new Set([
        ...rawRecords.map(row => clean(row?.Setor)),
        ...info.map(([, details]) => clean(details?.setor_atual)),
        ...rows.map(row => row.sector)
      ].filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
      refreshSectorOptions();
      render();
    } catch (error) {
      get('Status').textContent = error.message;
    } finally {
      if (request === revision) fileInput.value = '';
    }
  });

  minimum.addEventListener('input', () => {
    if (rows.length && (minimum.value === '' || !minimum.validity.valid)) {
      get('Status').textContent = 'Informe um mínimo inteiro a partir de zero.';
    }
    render();
  });

  sectorFilter.addEventListener('change', () => render());
  get('ClearSector').addEventListener('click', () => {
    sectorFilter.value = '';
    render();
    sectorFilter.focus();
  });

  exportButton.addEventListener('click', async () => {
    const request = revision;
    if (!(await ExportTools.ready('excel')) || request !== revision || exportButton.disabled || !dialog.open) return;
    const { people, sectors, overall, sourceTotal, belowMinimum } = currentReport();
    const workbook = XLSX.utils.book_new();
    function append(name, values, widths, durationStart, durationRow) {
      const sheet = XLSX.utils.aoa_to_sheet(values);
      sheet['!cols'] = widths.map(wch => ({ wch }));
      for (let row = durationRow; row < values.length; row++) {
        times.forEach((_, offset) => {
          const cell = sheet[XLSX.utils.encode_cell({ r: row, c: durationStart + offset })];
          if (cell?.t === 'n') cell.z = '[h]:mm:ss';
        });
      }
      XLSX.utils.book_append_sheet(workbook, sheet, name);
    }
    const rounded = value => value === null ? null : Number(value.toFixed(2));
    const excelDurations = durations => durations.map(value => value === null ? null : Math.round(value) / 86400);
    const metadata = [
      ['Relatório semanal do Looker'], ['Período', clean(get('Period').value) || 'Não informado'],
      ['Mínimo de finalizados', minimum.valueAsNumber], ['Setor selecionado', sectorFilter.value || 'Todos'],
      ['Finalizados no arquivo', sourceTotal], ['Finalizados após os filtros', overall.finished],
      ['Atendentes na lista', people.length], ['Atendentes abaixo do mínimo', belowMinimum],
      ['CSAT e tempos: média simples dos valores disponíveis por pessoa.'], []
    ];
    append('Resumo por setor', [
      ...metadata,
      ['Setor', 'Atendentes', 'Total finalizados', 'Média por pessoa', 'CSAT médio', ...times, 'Atendentes com nota'],
      ...[...sectors, overall].map(row => [
        row.sector, row.people, row.finished, rounded(row.average), rounded(row.score),
        ...excelDurations(row.durations), row.rated
      ])
    ], [61, 25, 18, 19, 14, 13, 13, 13, 23], 5, metadata.length + 1);
    append('Atendentes', [['Atendente', 'Setor', 'Nível', 'Finalizados', 'CSAT', ...times],
      ...people.map(row => [row.name, row.sector || missingSector, row.level || null, row.finished,
        row.score, ...excelDurations(row.durations)])], [44, 30, 10, 16, 12, 13, 13, 13], 5, 1);
    try {
      XLSX.writeFile(workbook, 'relatorio-semanal-looker.xlsx');
    } catch {
      get('Status').textContent = 'Não foi possível baixar o Excel. Tente novamente.';
    }
  });

  window.addEventListener('app-session-invalidated', () => {
    revision++;
    rows = [];
    availableSectors = [];
    refreshSectorOptions();
    fileInput.value = get('Period').value = get('Status').textContent = '';
    minimum.value = '0';
    get('People').replaceChildren();
    get('Sectors').replaceChildren();
    get('Overall').replaceChildren();
    get('Totals').replaceChildren();
    render();
    if (dialog.open) dialog.close();
  });
})();
