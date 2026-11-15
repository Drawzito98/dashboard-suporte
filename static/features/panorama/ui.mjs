import { readZip } from './zip.mjs';
import { analyzeWeekly } from './weekly.mjs?v=18';
import { renderAnalysis, renderScoreSources, reportDetails, TIME_LABELS } from './analysis.mjs?v=18';

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

export function mountWeekly(root) {
  const panel = document.createElement('section');
  panel.className = 'panorama-weekly';
  panel.innerHTML = '<form class="panorama-upload-row panorama-weekly-upload"><label class="panorama-upload"><span>' +
    '<strong>ZIP do Looker/Opa!</strong>' +
    '<input type="file" accept=".zip,application/zip" required></span></label>' +
    '<button class="btn-primary panorama-generate" type="submit">Analisar ZIP</button></form>' +
    '<p class="panorama-weekly-status" role="status" aria-live="polite"></p><div class="panorama-weekly-output"></div>';
  root.replaceChildren(panel);
  const form = panel.querySelector('form');
  const input = panel.querySelector('input');
  const button = panel.querySelector('button');
  const status = panel.querySelector('[role="status"]');
  const output = panel.lastElementChild;
  let revision = 0;
  input.addEventListener('change', () => {
    revision++;
    output.replaceChildren();
    status.textContent = '';
    button.disabled = false;
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const file = input.files[0];
    if (!file) return;
    const current = ++revision;
    button.disabled = true;
    status.textContent = 'Lendo e validando o ZIP…';
    output.replaceChildren();
    try {
      const report = await analyzeWeekly(readZip(file));
      if (current !== revision) return;
      status.textContent = (report.valid ? 'ZIP validado' : 'ZIP com erros') + ' · ' +
        report.files.validated + ' de ' + report.files.expected + ' CSVs reconhecidos e validados.';
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
      if (report.analysis) renderAnalysis(output, report, { registry, indicators, audit });
      else if (audit) output.append(audit);
    } catch (error) {
      if (current === revision) status.textContent = 'Não foi possível ler o ZIP. ' + error.message;
    } finally {
      if (current === revision) button.disabled = false;
    }
  });
}
