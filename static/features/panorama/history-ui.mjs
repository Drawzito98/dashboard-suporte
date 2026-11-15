import { historyMonths, summarizeHistoryMonth } from './history.mjs?v=1';

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

export function mountPanoramaHistory({ store, onOpen, onDelete }) {
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
  toolbar.append(monthFilter, action('Atualizar histórico', () => refresh()));
  let records = [];
  let revision = 0;
  let busy = false;

  function draw() {
    content.replaceChildren();
    if (!store.isCurrent()) return;
    const month = monthSelect.value;
    if (!month) {
      content.append(node('p', 'Nenhuma importação salva. Analise um ZIP e clique em Salvar dados.'));
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
      node('p', 'Os volumes abaixo são de cada ZIP completo. Se quiser ver pessoas e departamentos, abra o período.'),
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
    else revision++;
  });
  return { element, refresh };
}
