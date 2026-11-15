import { readZip } from './zip.mjs';
import { analyzeWeekly } from './weekly.mjs?v=19';
import { renderAnalysis, renderScoreSources, reportDetails, TIME_LABELS } from './analysis.mjs?v=19';

import { mountTeamContext } from './team-context.mjs?v=2';
import { createPanoramaHistoryStore } from './history.mjs?v=1';
import { mountPanoramaHistory } from './history-ui.mjs?v=1';

const labels = {
  total: 'Atendimentos no recorte', assumidos: 'Assumidos no Looker',
  clientes: 'Clientes atendidos', tme: 'TME', tmi: 'TMI', tmr: 'TMR',
  avaliados: 'Avaliados', inatividade: 'Encerrados por inatividade',
  recorrencia: 'Recorrência', sla: 'SLA do plantão (2h)', fila: 'Atendimentos com tempo de fila'
};
const formatNumber = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });
const formatDate = date => date.split('-').reverse().join('/');

function format(key, value) {
  if (value == null) return 'Sem informação';
  if (['tme', 'tmi', 'tmr'].includes(key)) {
    return [Math.floor(value / 3600), Math.floor(value / 60) % 60, value % 60]
      .map(unit => String(unit).padStart(2, '0')).join(':');
  }
  return formatNumber.format(value) + (['recorrencia', 'sla'].includes(key) ? '%' : '');
}

function showWeeklyReport(output, report) {
  if (report.period && !report.valid) {
    const period = document.createElement('p');
    period.textContent = formatDate(report.period.start) + ' a ' + formatDate(report.period.end);
    output.append(period);
  }
  const metrics = document.createElement('div');
  metrics.className = 'panorama-metrics';
  for (const [key, label] of Object.entries(labels)) {
    const card = document.createElement('article');
    card.className = 'panorama-metric';
    const title = document.createElement('span');
    title.className = 'panorama-metric-label';
    title.textContent = label;
    if (TIME_LABELS[label]) {
      title.title = TIME_LABELS[label];
      title.setAttribute('aria-label', label + ' — ' + TIME_LABELS[label]);
    }
    const value = document.createElement('strong');
    value.textContent = format(key, report.kpis[key]);
    card.append(title, value);
    metrics.append(card);
  }
  let registry = {};
  try { registry = JSON.parse(localStorage.getItem('sistema_colaboradores_info_v1') || '{}'); } catch {}
  const indicators = reportDetails('Indicadores complementares e tempos');
  const glossary = document.createElement('ul');
  for (const [label, definition] of Object.entries(TIME_LABELS)) {
    const term = document.createElement('li');
    term.textContent = label + ' — ' + definition;
    glossary.append(term);
  }
  indicators.append(metrics, glossary);
  let audit;
  if (report.issues.length || report.analysis?.checks.length) {
    audit = document.createElement('section');
    audit.className = 'panorama-view';
    const heading = document.createElement('h3');
    heading.textContent = report.valid ? 'Conferência dos dados' : 'Erros na validação do ZIP';
    audit.append(heading);
    const list = document.createElement('ul');
    list.className = 'panorama-audit-list';
    const addCheck = (label, message) => {
      const item = document.createElement('li');
      const badge = document.createElement('strong');
      badge.className = 'panorama-audit-badge';
      badge.dataset.kind = label === 'Confere' ? 'ok' : label === 'Erro' ? 'error' : 'warning';
      badge.textContent = label;
      const detail = document.createElement('span');
      detail.textContent = message;
      item.append(badge, detail);
      list.append(item);
    };
    for (const { severity, file: name, message } of report.issues) {
      addCheck(severity === 'error' ? 'Erro' : 'Verificar', name + ' · ' + message);
    }
    const coverage = report.analysis?.findings.find(line => line.startsWith('Cobertura do tempo de fila: '));
    for (const message of [coverage, ...(report.analysis?.checks ?? [])].filter(Boolean)) {
      const verified = /^([\d.]+ (finalizados|assumidos):|As avaliações e os encerramentos)/.test(message);
      addCheck(verified ? 'Confere' : 'Verificar', message);
    }
    if (report.analysis) renderScoreSources(audit, report.analysis.score);
    audit.append(list);
  }
  const teamContext = typeof isAdmin === 'function' && isAdmin() && typeof sbClient !== 'undefined' && sbClient
    ? (period, resolveNames) => mountTeamContext({
      client: sbClient, period, resolveNames, userId: _getUserId,
      currentUserId: () => getCurrentUser()?.id, isAdmin,
      openAbsences: openAusenciasOverlay, formatAttendance: formatarOcorrenciaAusencia
    }) : undefined;
  if (report.analysis) renderAnalysis(output, report, { registry, indicators, audit, teamContext });
  else if (audit) output.append(audit);
}

export function mountWeekly(root) {
  const panel = document.createElement('section');
  panel.className = 'panorama-weekly';
  panel.innerHTML = '<form class="panorama-upload-row panorama-weekly-upload"><label class="panorama-upload"><span>' +
    '<strong>ZIP do Looker/Opa!</strong>' +
    '<input type="file" accept=".zip,application/zip" required></span></label>' +
    '<button class="btn-primary panorama-generate" type="submit">Analisar ZIP</button></form>' +
    '<div class="panorama-save-bar"><p class="panorama-weekly-status" role="status" aria-live="polite"></p>' +
    '<button class="btn-primary" type="button" data-save-report hidden>Salvar dados</button></div>' +
    '<div class="panorama-weekly-output"></div>';
  root.replaceChildren(panel);
  const form = panel.querySelector('form');
  const input = form.querySelector('input');
  const button = form.querySelector('button');
  const status = panel.querySelector('.panorama-weekly-status');
  const save = panel.querySelector('[data-save-report]');
  const output = panel.lastElementChild;
  let revision = 0;
  let currentReport = null;
  let savedId = null;
  let store;
  let history;
  let saving = false;

  function updateSave() {
    save.hidden = !store?.isCurrent() || !currentReport?.valid || !!savedId;
    save.disabled = saving;
  }

  function clearReport() {
    currentReport = null;
    savedId = null;
    output.replaceChildren();
    updateSave();
  }

  function syncHistory() {
    if (store?.isCurrent()) return;
    if (store) {
      revision++;
      input.value = '';
      button.disabled = false;
      status.textContent = '';
      clearReport();
    }
    history?.element.remove();
    history = undefined;
    store = undefined;
    if (typeof isAdmin === 'function' && isAdmin() && typeof sbClient !== 'undefined' && sbClient && getCurrentUser()?.id) {
      store = createPanoramaHistoryStore({ client: sbClient, getUserId: _getUserId, currentUserId: () => getCurrentUser()?.id, isAdmin });
      history = mountPanoramaHistory({
        store,
        onOpen(report, id) {
          revision++;
          input.value = '';
          button.disabled = false;
          clearReport();
          currentReport = report;
          savedId = id;
          status.textContent = 'Período salvo · ' + formatDate(report.period.start) + ' a ' + formatDate(report.period.end);
          showWeeklyReport(output, report);
        },
        onDelete(id) {
          if (savedId !== id) return;
          revision++;
          clearReport();
          status.textContent = 'Período removido do histórico.';
        }
      });
      output.before(history.element);
    }
    updateSave();
  }

  const roleObserver = new MutationObserver(syncHistory);
  roleObserver.observe(document.body, { attributes: true, attributeFilter: ['data-role'] });
  syncHistory();

  input.addEventListener('change', () => {
    revision++;
    clearReport();
    status.textContent = '';
    button.disabled = false;
  });

  save.addEventListener('click', async () => {
    if (saving || !currentReport?.valid || savedId || !store?.isCurrent()) return;
    const active = currentReport;
    const repository = store;
    const { start, end } = active.period;
    saving = true;
    updateSave();
    try {
      const existing = await repository.find(active.period);
      if (currentReport !== active || !repository.isCurrent()) return;
      if (existing && !window.confirm('Já há dados de ' + formatDate(start) + ' a ' + formatDate(end) + '. Substituir esse período?')) return;
      status.textContent = 'Salvando dados…';
      const id = await repository.save(active, existing);
      if (currentReport === active && repository.isCurrent()) {
        savedId = id;
        status.textContent = 'Dados salvos. Consulte o Histórico mensal do Panorama.';
      }
      if (repository.isCurrent()) history?.refresh(start.slice(0, 7));
    } catch (error) {
      if (currentReport === active) status.textContent = error.message;
    } finally {
      saving = false;
      updateSave();
    }
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const file = input.files[0];
    if (!file) return;
    const current = ++revision;
    button.disabled = true;
    status.textContent = 'Lendo e validando o ZIP…';
    clearReport();
    try {
      const report = await analyzeWeekly(readZip(file));
      if (current !== revision) return;
      status.textContent = (report.valid ? 'ZIP validado' : 'ZIP com erros') + ' · ' +
        report.files.validated + ' de ' + report.files.expected + ' CSVs reconhecidos e validados.';
      showWeeklyReport(output, report);
      currentReport = report;
      syncHistory();
      updateSave();
    } catch (error) {
      if (current === revision) status.textContent = 'Não foi possível ler o ZIP. ' + error.message;
    } finally {
      if (current === revision) button.disabled = false;
    }
  });
}
