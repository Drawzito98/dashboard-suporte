import { historyMonths, summarizeHistoryMonth } from './history.mjs?v=2';
import { buildHistoryPeople, summarizeHistoryPerson } from './history-person.mjs?v=1';
import { n1GapLabel, scoreBand } from './analysis.mjs?v=20';

const count = new Intl.NumberFormat('pt-BR');
const rating = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const monthName = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const day = value => value.slice(5).split('-').reverse().join('/');
const periodLabel = (start, end) => day(start) + ' a ' + day(end) + '/' + end.slice(0, 4);

function node(tag, text) {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  return element;
}

function table(title, headings, rows) {
  const region = node('div');
  region.className = 'panorama-table-wrap';
  region.setAttribute('role', 'region');
  region.setAttribute('aria-label', title);
  region.tabIndex = 0;
  const grid = node('table');
  grid.className = 'panorama-table';
  const header = grid.createTHead().insertRow();
  for (const label of headings) {
    const cell = node('th', label);
    cell.scope = 'col';
    header.append(cell);
  }
  const body = grid.createTBody();
  for (const row of rows) {
    const line = body.insertRow();
    for (const value of row) {
      const cell = line.insertCell();
      cell.append(value);
    }
  }
  region.append(grid);
  return region;
}

function action(label, handle) {
  const button = node('button', label);
  button.className = 'btn-small';
  button.type = 'button';
  button.addEventListener('click', handle);
  return button;
}

const eligibilityLabels = {
  included: 'Incluído',
  overlap: 'Sobreposição',
  'cross-month': 'Cruza meses',
  missing: 'Sem resultado no ZIP',
  ambiguous: 'Mais de uma linha no ZIP'
};

function renderPersonPeriods(target, periods, personId) {
  target.replaceChildren();
  if (!personId) {
    target.append(node('p', 'Selecione uma pessoa para ver a evolução no mês.'));
    return;
  }
  const { total, included, rows } = summarizeHistoryPerson(periods, personId);
  const summary = node('p');
  if (total === null) {
    summary.append(node('strong', 'Sem volume disponível para o acumulado.'));
  } else {
    const title = included < rows.length ? ' finalizados no acumulado parcial' : ' finalizados no acumulado';
    summary.append(node('strong', count.format(total) + title),
      ' · ' + count.format(included) + (included === 1 ? ' período incluído' : ' períodos incluídos'));
  }
  target.append(summary);
  const resultRows = rows.map(row => {
    const score = node('span', row.score != null ? rating.format(row.score) : '—');
    if (row.score != null) score.className = scoreBand(row.score).className;
    const balance = node('span', n1GapLabel(row.balance ?? null));
    if (row.balance != null) {
      balance.classList.add('panorama-n1-gap', row.balance < 0 ? 'panorama-score-low' : 'panorama-score-high');
      balance.title = 'Meta do recorte · ' + count.format(row.target) + ' finalizados';
    }
    return [
      periodLabel(row.start, row.end),
      row.finalized == null ? '—' : count.format(row.finalized),
      score,
      row.balance == null ? '—' : count.format(row.target),
      balance,
      eligibilityLabels[row.status]
    ];
  });
  target.append(table('Histórico por pessoa',
    ['Período do ZIP', 'Finalizados', 'Nota', 'Meta N1', 'Saldo N1', 'No acumulado'], resultRows));
}

export function mountPanoramaHistory({ store, onOpen, onDelete, getRegistry }) {
  const element = node('details');
  element.className = 'panorama-history';
  const monthFilter = node('label', 'Mês ');
  const monthSelect = node('select');
  monthFilter.append(monthSelect);
  const toolbar = node('div');
  toolbar.className = 'panorama-report-filters panorama-history-toolbar';
  const feedback = node('p');
  feedback.setAttribute('role', 'status');
  const content = node('div');
  element.append(node('summary', 'Histórico mensal do Panorama'), toolbar, feedback, content);
  const views = node('div');
  views.className = 'panorama-history-views';
  views.setAttribute('role', 'group');
  views.setAttribute('aria-label', 'Visões do histórico mensal');
  const operation = action('Operação', () => switchView('operation'));
  const byPerson = action('Por pessoa', () => switchView('person'));
  operation.setAttribute('aria-pressed', 'true');
  byPerson.setAttribute('aria-pressed', 'false');
  views.append(operation, byPerson);
  toolbar.append(monthFilter, views, action('Atualizar histórico', () => refresh()));
  let currentView = 'operation';
  let selectedPerson = '';
  let personRevision = 0;
  let records = [];
  let revision = 0;
  let busy = false;

  function switchView(next) {
    if (currentView === next) return;
    currentView = next;
    operation.setAttribute('aria-pressed', String(next === 'operation'));
    byPerson.setAttribute('aria-pressed', String(next === 'person'));
    draw();
  }

  async function drawPeople(month, request) {
    content.append(node('p', 'Carregando histórico por pessoa…'));
    try {
      const records = await store.listTeam(month);
      if (request !== personRevision || !store.isCurrent()) return;
      const { people, periods } = buildHistoryPeople(records, month, getRegistry());
      content.replaceChildren();
      if (!people.length) {
        content.append(node('p', 'Nenhum período salvo com resultado por pessoa neste mês.'));
        return;
      }
      const filters = node('div');
      filters.className = 'panorama-report-filters';
      const label = node('label', 'Colaborador');
      const select = node('select');
      select.append(new Option('Selecione uma pessoa', ''));
      for (const { id, name, level } of people) {
        select.append(new Option(name + (level === '—' ? '' : ' · ' + level), id));
      }
      if (people.some(person => person.id === selectedPerson)) select.value = selectedPerson;
      label.append(select);
      filters.append(label);
      const results = node('div');
      content.append(filters, node('p', 'A nota é a Média aval. do ZIP. O nível e o saldo N1 usam o cadastro atual.'),
        node('p', 'O acumulado usa recortes inteiros dentro do mês. Em caso de sobreposição, o salvamento mais recente tem prioridade.'),
        results);
      select.addEventListener('change', () => {
        selectedPerson = select.value;
        renderPersonPeriods(results, periods, selectedPerson);
      });
      renderPersonPeriods(results, periods, select.value);
    } catch (error) {
      if (request !== personRevision || !store.isCurrent()) return;
      content.replaceChildren(node('p', error.message));
    }
  }

  function draw() {
    const request = ++personRevision;
    content.replaceChildren();
    if (!store.isCurrent()) return;
    const month = monthSelect.value;
    if (!month) {
      content.append(node('p', 'Nenhuma importação salva. Analise um ZIP e clique em Salvar dados.'));
      return;
    }
    if (currentView === 'person') {
      drawPeople(month, request);
      return;
    }
    const { total, days, overlapping, weeks } = summarizeHistoryMonth(records, month);
    const summary = node('p');
    summary.append(node('strong', count.format(total) + ' finalizados no mês'), ' · ' +
      count.format(days) + (days === 1 ? ' dia com dados no ZIP' : ' dias com dados nos ZIPs'));
    content.append(summary);
    if (overlapping) {
      content.append(node('p', 'Nos ' + count.format(overlapping) + ' dias com mais de um ZIP, o acumulado usa o salvamento mais recente de cada data.'));
    }
    const max = Math.max(1, ...weeks.map(week => week.volume));
    const weekRows = weeks.map(week => {
      const volume = node('div', week.days ? count.format(week.volume) : 'Sem dados');
      volume.className = 'panorama-history-volume';
      if (week.volume) {
        const bar = node('span');
        bar.setAttribute('aria-hidden', 'true');
        bar.style.setProperty('--panorama-history-bar', (week.volume / max * 100) + '%');
        volume.append(bar);
      }
      return [day(week.start) + ' a ' + day(week.end), volume, week.days ? count.format(week.cumulative) : '—'];
    });
    content.append(table('Evolução no mês', ['Semana', 'Finalizados', 'Acumulado'], weekRows));
    const monthRows = records.filter(record => record.periodo_inicio.slice(0, 7) <= month && record.periodo_fim.slice(0, 7) >= month);
    const historyRows = monthRows.map(record => {
      const period = periodLabel(record.periodo_inicio, record.periodo_fim);
      const controls = node('div');
      controls.className = 'panorama-history-actions';
      const open = action('Abrir', () => perform(async () => {
        const report = await store.open(record.id);
        if (!store.isCurrent()) return;
        onOpen(report, record.id);
        element.open = false;
      }));
      open.setAttribute('aria-label', 'Abrir período ' + period);
      const remove = action('Excluir', () => {
        if (busy || !window.confirm('Excluir do histórico o período de ' + period + '?')) return;
        perform(async () => {
          await store.delete(record);
          if (!store.isCurrent()) return;
          onDelete(record.id);
          await refresh(month, 'Período excluído.');
        });
      });
      remove.setAttribute('aria-label', 'Excluir período ' + period);
      controls.append(open, remove);
      return [
        period,
        count.format(record.finalizados),
        Number.isFinite(record.nota) ? rating.format(record.nota) : 'Sem nota confirmada',
        controls
      ];
    });
    content.append(node('h4', 'Períodos salvos'),
      node('p', 'Os volumes e notas abaixo são de cada ZIP completo. Abra um período para consultar todos os seus indicadores.'),
      table('Períodos salvos', ['Período', 'Finalizados no ZIP', 'Nota confirmada', 'Ações'], historyRows));
  }

  async function refresh(preferredMonth, success = '') {
    const request = ++revision;
    if (!element.open) return;
    feedback.textContent = 'Carregando histórico…';
    try {
      const next = await store.list();
      if (request !== revision || !store.isCurrent()) return;
      const selected = preferredMonth || monthSelect.value;
      records = next;
      const months = historyMonths(records);
      monthSelect.replaceChildren(...months.map(month => new Option(monthName.format(new Date(month + '-01T00:00:00Z')), month)));
      monthSelect.disabled = !months.length;
      if (months.includes(selected)) monthSelect.value = selected;
      draw();
      feedback.textContent = success;
    } catch (error) {
      if (request !== revision || !store.isCurrent()) return;
      personRevision++;
      records = [];
      monthSelect.replaceChildren();
      monthSelect.disabled = true;
      content.replaceChildren();
      feedback.textContent = error.message;
    }
  }

  async function perform(handle) {
    if (busy) return;
    busy = true;
    const buttons = [...content.querySelectorAll('button')];
    for (const button of buttons) button.disabled = true;
    try {
      feedback.textContent = '';
      await handle();
    } catch (error) {
      feedback.textContent = error.message;
    } finally {
      for (const button of buttons) button.disabled = false;
      busy = false;
    }
  }

  monthSelect.addEventListener('change', draw);
  element.addEventListener('toggle', () => {
    if (element.open) refresh();
    else {
      revision++;
      personRevision++;
    }
  });
  return { element, refresh };
}
