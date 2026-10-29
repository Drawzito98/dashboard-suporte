// tarefas.js — Agenda / Tarefas

function hoje() {
  return typeof hojeShared === 'function' ? hojeShared() : new Date().toISOString().slice(0, 10);
}

function updateTarefasBadge() {
  const badge = document.getElementById('tarefasBadge');
  if (!badge) return;
  try {
    const saved = AppState.get('tarefas') || JSON.parse(appStorage.getItem('sistema_tarefas_v1') || '[]');
    const today = hoje();
    const count = saved.filter(t => t.data === today && t.status !== 'concluida' && t.status !== 'cancelada').length;
    if (count > 0) {
      badge.textContent = count;
      badge.classList.add('visible');
    } else {
      badge.textContent = '';
      badge.classList.remove('visible');
    }
  } catch (e) {
    badge.textContent = '';
    badge.classList.remove('visible');
  }
}

function formatarData(dataStr) {
  if (typeof formatarDataShared === 'function') return formatarDataShared(dataStr);
  if (!dataStr) return '';
  const [ano, mes, dia] = dataStr.split('-');
  return `${dia}/${mes}/${ano}`;
}

function verificarLembretesRotina(tarefas) {
  const hojeKey = hoje();
  const avisados = JSON.parse(appStorage.getItem('sistema_rotina_lembretes_v1') || '{}');
  tarefas.filter(function(t) { return t.rotinaAtiva && t.status === 'pendente' && t.rotinaProximaData; }).forEach(function(t) {
    const alvo = new Date(t.rotinaProximaData + 'T12:00:00');
    const agora = new Date(hojeKey + 'T12:00:00');
    const dias = Math.round((alvo - agora) / 86400000);
    const antecedencia = Number(t.rotinaLembreteDias || 0);
    if (dias <= antecedencia && dias >= 0 && avisados[t.id] !== hojeKey) {
      const texto = dias === 0 ? 'Hoje: ' + t.titulo : 'Em ' + dias + ' dia' + (dias === 1 ? '' : 's') + ': ' + t.titulo;
      if (typeof showToast === 'function') showToast(texto, 'info', 'Lembrete de rotina');
      if ('Notification' in window && Notification.permission === 'granted') new Notification('Lembrete de rotina', { body: texto });
      avisados[t.id] = hojeKey;
    }
  });
  try { appStorage.setItem('sistema_rotina_lembretes_v1', JSON.stringify(avisados)); } catch (_) { /* Lembrete não invalida tarefa confirmada. */ }
}
function proximaRotina(data, intervalo, unidade) {
  const d = new Date(`${data || hoje()}T12:00:00`);
  if (unidade === 'semanas') d.setDate(d.getDate() + intervalo * 7);
  else if (unidade === 'meses') d.setMonth(d.getMonth() + intervalo);
  else d.setDate(d.getDate() + intervalo);
  return d.toISOString().slice(0, 10);
}
