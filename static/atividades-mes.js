// Atividades são anotações privadas estruturadas, identificadas por um prefixo
// versionado. Reutiliza a RLS de anotacoes_diarias; não altera notas existentes.
const AtividadesMes = (() => {
  const prefix = 'atividade-colaborador:v1:';
  let items = [];
  let owner = null;
  let selectedMonth = '';
  let selectedPerson = '';
  let editing = null;
  let busy = false;
  const esc = value => escapeHtml(String(value ?? ''));
  function monthKey(value) {
    const text = String(value || '').trim();
    let match = text.match(/^(\d{4})-(\d{2})(?:-\d{2})?$/);
    if (match && +match[2] >= 1 && +match[2] <= 12) return `${match[1]}-${match[2]}`;
    match = text.match(/^(?:\d{2}[/-])?(\d{2})[/-](\d{4})$/);
    return match && +match[1] >= 1 && +match[1] <= 12 ? `${match[2]}-${match[1]}` : '';
  }
  function decode(row) {
    if (!row.conteudo?.startsWith(prefix)) return null;
    try {
      const value = JSON.parse(row.conteudo.slice(prefix.length));
      if (!value.colaborador || !value.descricao || !['positivo', 'atencao'].includes(value.tipo)) return null;
      const mes = monthKey(row.data);
      return mes ? { id: row.id, mes, colaborador: value.colaborador, descricao: value.descricao, tipo: value.tipo } : null;
    } catch { return null; }
  }
  function textFor(list, person, month) {
    const normalize = value => String(value).trim().toLocaleLowerCase('pt-BR');
    const filtered = list.filter(item => normalize(item.colaborador) === normalize(person) && (!month || month === 'all' || item.mes === monthKey(month)));
    if (!filtered.length) return '';
    return 'Atividades e situações registradas pelo gestor:\n' + filtered.map(item => `${item.tipo === 'positivo' ? '🟢 Positivo' : '🔴 Ponto de atenção'} (${item.mes}): ${item.descricao}`).join('\n');
  }
  async function user() {
    if (typeof isAdmin !== 'function' || !isAdmin()) throw new Error('Acesso restrito ao administrador.');
    const uid = await _getUserId();
    if (!uid) throw new Error('Entre novamente para acessar as atividades.');
    if (owner !== uid) { items = []; owner = uid; }
    return uid;
  }
  async function load() {
    items = [];
    const uid = await user();
    const result = [];
    // Paginação evita perder registros acima do limite padrão do Supabase.
    for (let start = 0; ; start += 500) {
      const { data, error } = await sbClient.from('anotacoes_diarias').select('id,data,conteudo').eq('user_id', uid).like('conteudo', prefix + '%').order('data', { ascending: false }).order('id').range(start, start + 499);
      if (error) throw error;
      result.push(...(data || []).map(decode).filter(Boolean));
      if (!data || data.length < 500) break;
    }
    items = result;
    return items;
  }
  function people() {
    let registered = {};
    try { registered = JSON.parse(localStorage.getItem('sistema_colaboradores_info_v1') || '{}'); } catch {}
    return [...new Set([...(typeof rawRecords !== 'undefined' ? rawRecords : []).map(row => row?.Atendente), ...Object.entries(registered || {}).map(([key, value]) => value?.nome || key), ...items.map(item => item.colaborador)])].filter(name => name && !isAggregateName(name) && isColabActive(name)).sort((a,b) => a.localeCompare(b, 'pt-BR'));
  }
  function close() {
    if (busy) return;
    const draft = document.getElementById('atividadeDescricao')?.value.trim();
    if (draft && draft !== (editing?.descricao || '') && !confirm('Descartar o registro não salvo?')) return;
    document.getElementById('atividadesMesOverlay')?.classList.remove('open');
    document.getElementById('atividadesMesBtn')?.focus();
  }
  function render() {
    const container = document.getElementById('atividadesMesContent');
    const names = people();
    if (selectedPerson && !names.includes(selectedPerson)) names.push(selectedPerson);
    const filtered = items.filter(item => item.mes === selectedMonth && (!selectedPerson || item.colaborador === selectedPerson));
    container.innerHTML = `<h2>Atividades do mês</h2><p>Registre situações positivas e pontos de atenção para o feedback individual. Os registros ficam privados na sua conta.</p>
      <div class="atividades-filters"><label class="field"><span>Mês</span><input id="atividadeMes" type="month" required value="${esc(selectedMonth)}"></label>
      <label class="field"><span>Colaborador</span><select id="atividadePessoa"><option value="">Selecionar...</option>${names.map(name => `<option ${name === selectedPerson ? 'selected' : ''} value="${esc(name)}">${esc(name)}</option>`).join('')}</select></label></div>
      <form id="atividadeForm"><h3>${editing ? 'Editar registro' : 'Novo registro'}</h3><label class="field"><span>Classificação</span><select id="atividadeTipo"><option value="positivo">🟢 Positivo</option><option value="atencao" ${editing?.tipo === 'atencao' ? 'selected' : ''}>🔴 Ponto de atenção</option></select></label>
      <label class="field"><span>O que aconteceu?</span><textarea id="atividadeDescricao" required maxlength="5000" rows="4" placeholder="Descreva a atividade ou situação observada.">${esc(editing?.descricao || '')}</textarea></label>
      <div class="btn-row"><button class="btn-primary" type="submit">${editing ? 'Atualizar registro' : 'Salvar registro'}</button>${editing ? '<button class="btn-small" id="atividadeCancelar" type="button">Cancelar edição</button>' : ''}</div><p id="atividadeErro" role="alert"></p></form>
      <h3>Histórico do mês</h3><p>${filtered.filter(item => item.tipo === 'positivo').length} positivos · ${filtered.filter(item => item.tipo === 'atencao').length} pontos de atenção</p>
      <div class="atividades-history">${filtered.length ? filtered.map(item => `<article class="atividade-item atividade-${item.tipo}"><strong>${esc(item.colaborador)}</strong><span>${item.tipo === 'positivo' ? '🟢 Positivo' : '🔴 Ponto de atenção'}</span><p>${esc(item.descricao)}</p><div class="btn-row"><button type="button" class="btn-small" data-edit="${esc(item.id)}">Editar</button><button type="button" class="btn-small" data-delete="${esc(item.id)}">Excluir</button></div></article>`).join('') : '<p>Nenhum registro para esta seleção.</p>'}</div>`;
    const month = container.querySelector('#atividadeMes');
    const person = container.querySelector('#atividadePessoa');
    const change = () => {
      if (container.querySelector('#atividadeDescricao').value.trim() && !confirm('Descartar a edição atual para mudar a seleção?')) { month.value = selectedMonth; person.value = selectedPerson; return; }
      selectedMonth = month.value; selectedPerson = person.value; editing = null; render();
    };
    month.addEventListener('change', change); person.addEventListener('change', change);
    container.querySelector('#atividadeCancelar')?.addEventListener('click', () => { editing = null; render(); });
    async function mutate(action) {
      if (busy) return;
      busy = true;
      container.querySelectorAll('button,input,select,textarea').forEach(el => el.disabled = true);
      try { await action(); editing = null; render(); showToast('Registro atualizado.', 'success'); }
      catch (error) { container.querySelector('#atividadeErro').textContent = 'Não foi possível salvar a alteração. Verifique a conexão e tente novamente.'; }
      finally { busy = false; container.querySelectorAll('button,input,select,textarea').forEach(el => el.disabled = false); }
    }
    container.querySelector('form').addEventListener('submit', event => {
      event.preventDefault();
      const descricao = container.querySelector('#atividadeDescricao').value.trim();
      const tipo = container.querySelector('#atividadeTipo').value;
      if (!monthKey(selectedMonth) || !selectedPerson || !descricao) { container.querySelector('#atividadeErro').textContent = 'Selecione mês, colaborador e preencha a descrição.'; return; }
      const item = { id: editing?.id || crypto.randomUUID(), mes: selectedMonth, colaborador: selectedPerson, tipo, descricao };
      mutate(async () => {
        const uid = await user();
        const row = { data: item.mes + '-01', conteudo: prefix + JSON.stringify({ colaborador: item.colaborador, tipo, descricao }), updated_at: new Date().toISOString() };
        const query = editing ? sbClient.from('anotacoes_diarias').update(row).eq('id', item.id).eq('user_id', uid).like('conteudo', prefix + '%') : sbClient.from('anotacoes_diarias').insert({ ...row, id: item.id, user_id: uid });
        const { data, error } = await query.select('id').single();
        if (error || !data) throw error || new Error('Registro não salvo');
        items = [item, ...items.filter(value => value.id !== item.id)];
      });
    });
    container.querySelectorAll('[data-edit]').forEach(button => button.addEventListener('click', () => {
      if (container.querySelector('#atividadeDescricao').value.trim() && !confirm('Descartar a edição atual?')) return;
      editing = items.find(item => item.id === button.dataset.edit); selectedMonth = editing.mes; selectedPerson = editing.colaborador; render(); container.querySelector('#atividadeDescricao').focus();
    }));
    container.querySelectorAll('[data-delete]').forEach(button => button.addEventListener('click', () => {
      if (!confirm('Excluir este registro de atividade?')) return;
      mutate(async () => {
        const uid = await user();
        const { data, error } = await sbClient.from('anotacoes_diarias').delete().eq('id', button.dataset.delete).eq('user_id', uid).like('conteudo', prefix + '%').select('id').single();
        if (error || !data) throw error || new Error('Registro não excluído');
        items = items.filter(item => item.id !== button.dataset.delete);
      });
    }));
  }
  async function open() {
    if (!isAdmin()) return;
    let overlay = document.getElementById('atividadesMesOverlay');
    if (!overlay) {
      overlay = document.createElement('div'); overlay.id = 'atividadesMesOverlay'; overlay.className = 'colab-detail-overlay'; overlay.setAttribute('role', 'dialog'); overlay.setAttribute('aria-modal', 'true'); overlay.setAttribute('aria-label', 'Atividades do mês');
      overlay.innerHTML = '<div class="colab-detail-panel"><button class="colab-detail-close" type="button" aria-label="Fechar">✕</button><div id="atividadesMesContent" style="padding:24px"></div></div>';
      document.body.appendChild(overlay);
      overlay.querySelector('button').addEventListener('click', close);
      overlay.addEventListener('keydown', event => { if (event.key === 'Escape') close(); });
    }
    const now = new Date(); selectedMonth = selectedMonth || `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`; editing = null;
    overlay.classList.add('open'); overlay.querySelector('button').focus();
    document.getElementById('atividadesMesContent').textContent = 'Carregando registros…';
    try { await load(); render(); }
    catch { document.getElementById('atividadesMesContent').textContent = 'Não foi possível carregar os registros. Feche e tente novamente.'; }
  }
  if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', () => document.getElementById('atividadesMesBtn')?.addEventListener('click', open));
  return { load, people, months: () => [...new Set(items.map(item => item.mes))].sort(), feedback: (person, month) => textFor(items, person, month), monthKey, decode, textFor };
})();
if (typeof module !== 'undefined') module.exports = AtividadesMes;
