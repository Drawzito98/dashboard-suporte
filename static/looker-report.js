(function () {
  'use strict';

  const clean = value => String(value ?? '').trim().replace(/\s+/g, ' ');
  const key = value => clean(value).toLocaleLowerCase('pt-BR');
  const missingSector = 'Sem setor definido';
  const sum = rows => rows.reduce((total, row) => total + row.finished, 0);
  const columns = ['Atendente', 'Finalizados', 'Média aval.'];

  function readRows(result, sectorByName, isAggregate) {
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
      rows.push({ name, finished, score, sector: clean(row.Setor) || sectorByName.get(key(name)) || '' });
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
    const sectors = [...groups].map(([sector, members]) => {
      const scores = members.flatMap(row => row.score === null ? [] : [row.score]);
      const finished = sum(members);
      return {
        sector, people: members.length, finished, average: finished / members.length,
        score: scores.length ? scores.reduce((total, score) => total + score, 0) / scores.length : null,
        rated: scores.length
      };
    }).sort((a, b) => b.finished - a.finished || a.sector.localeCompare(b.sector, 'pt-BR'));
    return { people, sectors, total: sum(people), sourceTotal: sum(rows), belowMinimum: rows.length - eligible.length };
  }

  if (typeof module !== 'undefined') module.exports = { readRows, summarize };
  if (typeof document === 'undefined') return;

  const get = id => document.getElementById('looker' + id);
  const dialog = get('Dialog');
  const fileInput = get('File');
  const minimum = get('Minimum');
  const sectorFilter = get('Sector');
  const exportButton = get('Export');
  const number = new Intl.NumberFormat('pt-BR');
  const decimal = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const showDecimal = value => value === null ? '—' : decimal.format(value);
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
      const wasFiltered = Boolean(sectorFilter.value);
      refreshSectorOptions();
      if (wasFiltered) render();
      else renderSummary(currentReport());
    });
    return input;
  }

  function currentReport() {
    return summarize(rows, minimum.valueAsNumber || 0, sectorFilter.value);
  }

  function renderSummary(report) {
    const { people, sectors, total, sourceTotal, belowMinimum } = report;
    const metrics = [
      ['Finalizados no CSV', sourceTotal], ['Finalizados no recorte', total],
      ['Atendentes no recorte', people.length], ['Abaixo do mínimo', belowMinimum]
    ];
    get('Totals').replaceChildren(...metrics.map(([label, value]) => {
      const card = document.createElement('div');
      const amount = document.createElement('strong');
      amount.textContent = number.format(value);
      card.append(amount, label);
      return card;
    }));
    get('Sectors').replaceChildren(...sectors.map(row => record([
      row.sector, number.format(row.people), number.format(row.finished),
      showDecimal(row.average), showDecimal(row.score), number.format(row.rated)
    ])));
  }

  function render() {
    const valid = minimum.value !== '' && minimum.validity.valid;
    get('Report').hidden = !rows.length || !valid;
    exportButton.disabled = !rows.length || !valid;
    if (get('Report').hidden) return;
    const report = currentReport();
    renderSummary(report);
    get('People').replaceChildren(...report.people.map(row => record([
      row.name, selectSector(row), number.format(row.finished), showDecimal(row.score)
    ])));
    get('Status').textContent = report.people.length
      ? rows.length + ' atendentes importados. ' + report.people.filter(row => !row.sector).length + ' sem setor no recorte.'
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
      const sectorByName = new Map();
      for (const [name, details] of info) {
        const nameKey = key(name);
        const sector = clean(details?.setor_atual);
        if (sectorByName.has(nameKey) && sectorByName.get(nameKey) !== sector) sectorByName.set(nameKey, '');
        else sectorByName.set(nameKey, sector);
      }
      rows = readRows(Papa.parse(source, { header: true, skipEmptyLines: 'greedy', transformHeader: clean }),
        sectorByName, isAggregateName);
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

  sectorFilter.addEventListener('change', render);

  exportButton.addEventListener('click', async () => {
    const request = revision;
    if (!(await ExportTools.ready('excel')) || request !== revision || exportButton.disabled || !dialog.open) return;
    const { people, sectors, total, sourceTotal, belowMinimum } = currentReport();
    const workbook = XLSX.utils.book_new();
    function append(name, values, widths) {
      const sheet = XLSX.utils.aoa_to_sheet(values);
      sheet['!cols'] = widths.map(wch => ({ wch }));
      XLSX.utils.book_append_sheet(workbook, sheet, name);
    }
    const rounded = value => value === null ? null : Number(value.toFixed(2));
    append('Resumo por setor', [
      ['Relatório semanal do Looker'], ['Período', clean(get('Period').value) || 'Não informado'],
      ['Mínimo de finalizados', minimum.valueAsNumber], ['Setor selecionado', sectorFilter.value || 'Todos'],
      ['Finalizados no CSV', sourceTotal],
      ['Finalizados no recorte', total], ['Atendentes no recorte', people.length],
      ['Abaixo do mínimo', belowMinimum],
      ['Nota média simples dos atendentes com nota'], [],
      ['Setor', 'Atendentes', 'Total finalizados', 'Média finalizados', 'Nota média', 'Com nota'],
      ...sectors.map(row => [row.sector, row.people, row.finished, rounded(row.average), rounded(row.score), row.rated])
    ], [49, 25, 21, 22, 15, 13]);
    append('Atendentes', [['Atendente', 'Setor', 'Finalizados', 'Nota'],
      ...people.map(row => [row.name, row.sector || missingSector, row.finished, row.score])], [44, 30, 16, 12]);
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
    get('Totals').replaceChildren();
    render();
    if (dialog.open) dialog.close();
  });
})();
