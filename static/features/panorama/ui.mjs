import { readZip } from './zip.mjs';
import { analyzeWeekly } from './weekly.mjs?v=2';
import { renderAnalysis } from './analysis.mjs';

const labels = {
  total: 'Atendimentos no recorte', assumidos: 'Assumidos', finalizados: 'Finalizados',
  clientes: 'Clientes atendidos', tme: 'TME', tmi: 'TMI', tmr: 'TMR',
  nota: 'Nota média do cliente', avaliados: 'Avaliados', inatividade: 'Encerrados por inatividade',
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
  panel.innerHTML = '<h3>Panorama semanal</h3>' +
    '<form class="panorama-upload-row"><label class="panorama-upload"><span>' +
    '<strong>ZIP do Looker/Opa!</strong><small>Confira os indicadores e as validações da semana.</small>' +
    '<input type="file" accept=".zip,application/zip" required></span></label>' +
    '<button class="btn-primary panorama-generate" type="submit">Validar ZIP</button></form>' +
    '<p role="status" aria-live="polite"></p><div></div>';
  root.querySelector('#panoramaForm').before(panel);
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
      status.textContent = (report.valid ? 'Prévia validada' : 'Prévia com erros') + ' · ' +
        report.files.validated + ' de ' + report.files.expected + ' CSVs reconhecidos e validados.';
      if (report.period) {
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
        const value = document.createElement('strong');
        value.textContent = format(key, report.kpis[key]);
        card.append(title, value);
        metrics.append(card);
      }
      output.append(metrics);
      renderAnalysis(output, report);
      if (report.issues.length) {
        const heading = document.createElement('h4');
        heading.textContent = 'Conferência dos números';
        output.append(heading);
        const list = document.createElement('ul');
        for (const { severity, file: name, message } of report.issues) {
          const item = document.createElement('li');
          item.textContent = (severity === 'error' ? 'Erro' : 'Aviso') + ' · ' + name + ' · ' + message;
          list.append(item);
        }
        output.append(list);
      }
    } catch (error) {
      if (current === revision) status.textContent = 'Não foi possível ler o ZIP. ' + error.message;
    } finally {
      if (current === revision) button.disabled = false;
    }
  });
}
