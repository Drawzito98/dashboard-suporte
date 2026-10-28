/* Análise e rascunhos privados por usuário; primeira versão com exportação local. */
(function () {
  'use strict';
  const E = window.PerfilPDIEngine;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const get = id => document.getElementById(id);
  let nome = '', owner = '', state = {}, draft = null, dirty = false, draftDirty = false;
  function userId() {
    const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
    return user && typeof getTrustedUserRole === 'function' && getTrustedUserRole(user) === 'admin' ? user.id : '';
  }
  function allowed() { return Boolean(userId()) && document.body.dataset.role === 'admin'; }
  function read(key, fallback) { try { return JSON.parse(appStorage.getItem(key)) || fallback; } catch { return fallback; } }
  const storageKey = () => `sistema_perfil_pdi_v1_${owner}`;
  const person = () => state[nome] || { complemento: {}, planos: [] };
  function notice(message, error = false) { const el = get('pdiNotice'); if (el) { el.textContent = message; el.classList.toggle('error', error); } }
  function persist(data) {
    if (!allowed() || owner !== userId()) throw new Error('A sessão mudou. Abra novamente a análise de perfil.');
    const next = { ...state, [nome]: data };
    appStorage.setItem(storageKey(), JSON.stringify(next));
    state = next;
  }
  function registros() { return typeof rawRecords !== 'undefined' && Array.isArray(rawRecords) ? rawRecords : []; }
  function names() {
    const info = read('sistema_colaboradores_info_v1', {});
    return [...new Set([...Object.keys(info), ...registros().map(r => r?.Atendente).filter(Boolean)])]
      .filter(n => !(typeof isAggregateName === 'function' && isAggregateName(n)) && (typeof isColabActive !== 'function' || isColabActive(n)))
      .sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }
  function analysis() {
    return E.analisar({ nome, info: read('sistema_colaboradores_info_v1', {})[nome] || {}, registros: registros(),
      avaliacoes: typeof getAvaliacoesLocal === 'function' ? getAvaliacoesLocal() : [], competencias: typeof COMPETENCIAS !== 'undefined' ? COMPETENCIAS : [], complemento: person().complemento || {} });
  }
  function mappingEntries() { return typeof getMapeamentoTimeData === 'function' ? getMapeamentoTimeData() : []; }
  function field(label, id, value, options = {}) {
    return `<label class="field"><span>${esc(label)}</span>${options.type ? `<input id="${id}" type="${options.type}" value="${esc(value)}"${options.required ? ' required' : ''}>` : `<textarea id="${id}" rows="${options.rows || 2}"${options.required ? ' required' : ''}>${esc(value)}</textarea>`}</label>`;
  }
  function dateLabel(value) { return value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleDateString('pt-BR') : 'Sem data'; }
  function render() {
    const host = get('perfilPdiContent');
    if (!host) return;
    if (!allowed()) { host.innerHTML = '<div class="empty-state">Análise de perfil disponível para líderes administradores autenticados.</div>'; return; }
    const uid = userId();
    if (uid !== owner) { owner = uid; state = read(storageKey(), {}); nome = ''; draft = null; dirty = false; draftDirty = false; }
    const options = names();
    if (!options.includes(nome)) { nome = options[0] || ''; draft = null; dirty = false; draftDirty = false; }
    host.innerHTML = `<div class="pdi-heading"><div><span class="pdi-eyebrow">Desenvolvimento da equipe</span><h2>Análise de perfil e PDI</h2><p>Transforme evidências e objetivos em um plano acompanhado.</p></div><span class="pdi-chip">Rascunhos para revisão do líder</span></div>
      <div class="pdi-local-note">Nesta primeira versão, complementos e planos são salvos neste navegador para seu usuário. Exporte o plano para guardar uma cópia. As fontes usam todo o histórico disponível, independentemente dos filtros globais.</div>
      <label class="field pdi-person"><span>Colaborador</span><select id="pdiPerson"><option value="">Selecione uma pessoa</option>${options.map(n => `<option value="${esc(n)}"${n === nome ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
      <p id="pdiNotice" class="pdi-notice" role="status" aria-live="polite"></p><div id="pdiPersonContent"></div>`;
    get('pdiPerson').addEventListener('change', event => {
      if (dirty && !confirm('Existem alterações não salvas. Deseja trocar de pessoa e descartá-las?')) { event.target.value = nome; return; }
      nome = event.target.value; draft = null; dirty = false; draftDirty = false; renderPerson();
    });
    renderPerson();
  }
  function renderPerson() {
    const host = get('pdiPersonContent');
    if (!host || !nome) { if (host) host.innerHTML = '<div class="empty-state">Cadastre ou selecione uma pessoa para começar.</div>'; return; }
    const a = analysis(), data = person(), comp = data.complemento || {}, mappings = mappingEntries();
    host.innerHTML = `<div class="pdi-context"><article><span>Tempo de empresa</span><strong>${esc(getTempoEmpresa(a.info.admissao))}</strong></article><article><span>Nível / setor</span><strong>${esc([a.info.nivel, a.info.setor].filter(Boolean).join(' · ') || 'Não informado')}</strong></article><article><span>Avaliação utilizada</span><strong>${esc(a.avaliacao?.ciclo || 'Não disponível')}</strong><small>${a.avaliacao ? `${esc(dateLabel(a.avaliacao.data))} · ${esc(a.avaliacao.status)}` : 'Preencha na aba Avaliação de desempenho'}</small></article></div>
      <div class="pdi-grid"><section class="card pdi-section"><h3>Pontos fortes registrados</h3>${a.fortes.length ? `<ul>${a.fortes.map(c => `<li><strong>${esc(c.nome)} · ${c.nota}/4</strong><p>${esc(c.evidencia || 'A avaliação não contém exemplo para esta competência.')}</p></li>`).join('')}</ul>` : '<p>Sem competências avaliadas no nível esperado ou acima dele.</p>'}<p class="pdi-muted">As notas refletem a avaliação registrada, sem definir traços de personalidade.</p></section>
      <section class="card pdi-section"><h3>Competências a desenvolver</h3>${a.prioridades.length ? `<ul>${a.prioridades.map(c => `<li><strong>${esc(c.nome)} · ${c.nota}/4</strong><p>${esc(c.evidencia || 'Exemplo observável pendente de coleta.')}</p></li>`).join('')}</ul>` : '<p>Sem lacunas registradas na avaliação disponível. Objetivos de carreira também podem orientar um plano.</p>'}</section></div>
      <section class="card pdi-section"><h3>Contexto e evidências</h3><div class="pdi-grid"><div><strong>Experiência registrada</strong><p>${esc(a.info.experiencia || 'Não informada.')}</p><strong>Observações da avaliação</strong><p>${esc(a.observacoes || 'Não informadas.')}</p></div><div><strong>Indicadores do último período disponível</strong><p>${a.indicadores.mes ? `${esc(a.indicadores.mes)} · ${a.indicadores.registros} registro(s)<br>Score médio: ${a.indicadores.score == null ? 'Não informado' : a.indicadores.score.toFixed(2)}<br>Finalizados: ${a.indicadores.finalizados == null ? 'Não informado' : a.indicadores.finalizados.toLocaleString('pt-BR')}` : 'Sem registros mensais válidos.'}</p><small>Indicadores descritivos. Metas e condições de trabalho precisam ser consideradas pelo líder.</small></div></div></section>
      <section class="card pdi-section"><div class="pdi-section-heading"><h3>Informações para completar</h3><button class="btn-small" id="pdiEditCadastro" type="button">Editar cadastro</button></div>${a.pendencias.length ? `<ul>${a.pendencias.map(p => `<li>${esc(p)}</li>`).join('')}</ul>` : '<p>As informações básicas estão preenchidas. Confirme se as evidências continuam atuais.</p>'}</section>
      <form id="pdiComplementForm" class="card pdi-section"><h3>Complementar o perfil</h3><div class="pdi-grid">${field('Objetivo de desenvolvimento / carreira', 'pdiObjetivo', comp.objetivo || a.objetivo)}${field('Autoavaliação: pontos fortes e dificuldades', 'pdiAuto', comp.autoavaliacao || '')}${field('Apoio e disponibilidade para desenvolvimento', 'pdiApoio', comp.apoio || '')}<label class="field"><span>Vínculo com o Mapeamento de Time</span><select id="pdiMapping"><option value="">Sem vínculo</option>${mappings.map(m => `<option value="${esc(m.id)}"${String(comp.mapeamento?.id) === String(m.id) ? ' selected' : ''}>${esc(m.nome)} · ${esc(m.setor)}</option>`).join('')}</select><small>Confira a descrição abaixo antes de confirmar que é a mesma pessoa e que a observação está atual.</small></label></div><div id="pdiMappingPreview" class="pdi-mapping-preview"></div><label class="pdi-check"><input id="pdiMappingConfirm" type="checkbox"> Confirmo a identidade e a atualidade deste registro do Mapeamento.</label><div class="pdi-actions"><button class="btn-primary" type="submit">Salvar complementos</button><small>${comp.updatedAt ? `Última atualização: ${esc(dateLabel(comp.updatedAt))}` : 'Você pode coletar essas informações na conversa com a pessoa.'}</small></div></form>
      <section class="card pdi-section"><div class="pdi-section-heading"><div><h3>Plano de desenvolvimento individual</h3><p>Ações sugeridas a partir dos dados registrados. Revise metas, apoio e prazos antes de aprovar.</p></div><button class="btn-primary" id="pdiGenerate" type="button"${a.podeGerar ? '' : ' disabled'}>Gerar rascunho de PDI</button></div>${!a.podeGerar ? '<p>Registre um objetivo, uma lacuna na avaliação ou uma ação do Mapeamento confirmada para gerar o plano.</p>' : ''}<div id="pdiEditor"></div></section>
      <section class="card pdi-section"><h3>Planos e versões salvos</h3><div id="pdiHistory">${(data.planos || []).length ? data.planos.slice().reverse().map((p, i) => `<div class="pdi-history-row"><div><strong>Versão ${p.versao} · ${esc(p.status === 'aprovado' ? 'Aprovado' : 'Rascunho')}</strong><small>${esc(dateLabel(p.salvoEm))} · ${p.objetivos.length} objetivo(s)</small></div><button type="button" class="btn-small pdi-load" data-index="${data.planos.length - 1 - i}">Abrir versão</button></div>`).join('') : '<p>Nenhum plano salvo para esta pessoa.</p>'}</div></section>`;
    get('pdiEditCadastro').addEventListener('click', () => openColabDetailOverlay(nome));
    get('pdiComplementForm').addEventListener('input', () => { dirty = true; });
    const previewMapping = () => {
      const m = mappings.find(m => String(m.id) === get('pdiMapping').value);
      const saved = comp.mapeamento;
      get('pdiMappingPreview').innerHTML = m ? `<strong>${esc(m.nome)}</strong><p>${esc(m.perfil)}</p><p>Ação registrada: ${esc(m.acao || 'Não informada.')}</p>` : '<p>Nenhum registro associado. Nomes parecidos não são vinculados automaticamente.</p>';
      get('pdiMappingConfirm').checked = Boolean(m && saved?.cadastro === nome && saved?.confirmadoEm && String(saved.id) === String(m.id) && saved.perfil === m.perfil && saved.acao === m.acao);
      get('pdiMappingConfirm').disabled = !m;
    };
    get('pdiMapping').addEventListener('change', previewMapping); previewMapping();
    get('pdiComplementForm').addEventListener('submit', event => {
      event.preventDefault();
      try {
        const m = mappings.find(m => String(m.id) === get('pdiMapping').value);
        if (m && !get('pdiMappingConfirm').checked) throw new Error('Confirme a identidade e a atualidade do registro selecionado, ou escolha Sem vínculo.');
        const complemento = { objetivo: get('pdiObjetivo').value.trim(), autoavaliacao: get('pdiAuto').value.trim(), apoio: get('pdiApoio').value.trim(), updatedAt: new Date().toISOString(),
          mapeamento: m ? { id: m.id, nome: m.nome, setor: m.setor, perfil: m.perfil, acao: m.acao, cadastro: nome, confirmadoEm: new Date().toISOString() } : null };
        persist({ ...person(), complemento }); dirty = draftDirty; renderPerson(); notice('Complementos salvos neste navegador. Os planos existentes preservam suas fontes originais.');
      } catch (error) { notice(error.message || 'Não foi possível salvar.', true); }
    });
    get('pdiGenerate').addEventListener('click', () => {
      try {
        if (dirty && !confirm('Há alterações não salvas. Gerar usando apenas os dados já salvos?')) return;
        if (draft && !confirm('Gerar um novo rascunho e substituir o plano aberto? As versões já salvas serão preservadas.')) return;
        draft = E.gerar(analysis()); dirty = true; draftDirty = true; renderEditor(); notice('Rascunho gerado. Complete os indicadores e confirme as evidências com a pessoa.');
      } catch (error) { notice(error.message, true); }
    });
    host.querySelectorAll('.pdi-load').forEach(button => button.addEventListener('click', () => {
      if (dirty && !confirm('Descartar alterações não salvas e abrir esta versão?')) return;
      draft = JSON.parse(JSON.stringify(person().planos[Number(button.dataset.index)])); dirty = false; draftDirty = false; renderEditor();
    }));
    renderEditor();
  }
  function renderEditor() {
    const host = get('pdiEditor'); if (!host) return;
    if (!draft) { host.innerHTML = '<p class="pdi-muted">Gere um rascunho ou abra uma versão salva para editar.</p>'; return; }
    const approved = draft.status === 'aprovado';
    host.innerHTML = `<form id="pdiPlanForm"><p class="pdi-chip">${approved ? 'Versão aprovada · salvar alterações cria um novo rascunho' : 'Rascunho para revisão'}</p><p class="pdi-muted">Gerado em ${esc(dateLabel(draft.geradoEm))}. As ações e o prazo inicial de 90 dias são sugestões editáveis.</p><details><summary>Fontes preservadas deste plano</summary><pre class="pdi-source">${esc([`Colaborador: ${draft.snapshot.nome}`, `Nível: ${draft.snapshot.info?.nivel || "Não informado"}`, `Setor: ${draft.snapshot.info?.setor || "Não informado"}`, `Objetivo declarado: ${draft.snapshot.objetivo || "Não informado"}`, `Autoavaliação: ${draft.snapshot.autoavaliacao || "Não informada"}`, `Avaliação: ${draft.snapshot.avaliacao?.ciclo || "Não disponível"} · ${dateLabel(draft.snapshot.avaliacao?.data)}`, ...(draft.snapshot.notas || []).map(c => `${c.nome}: ${c.nota}/4 — ${c.evidencia || "Sem exemplo registrado"}`), `Mapeamento confirmado: ${draft.snapshot.mapeamento ? draft.snapshot.mapeamento.nome + " — " + draft.snapshot.mapeamento.perfil : "Sem vínculo"}`, `Pendências na geração: ${(draft.snapshot.pendencias || []).join(" ") || "Nenhuma"}`].join("\n\n"))}</pre></details>${draft.objetivos.map((o, i) => `<fieldset class="pdi-objective"><legend>Objetivo ${i + 1} · ${esc(o.competencia)}</legend><div class="pdi-grid">${field('Objetivo', `pdi-${i}-objetivo`, o.objetivo, { required: true })}${field('Evidência de partida', `pdi-${i}-evidencia`, o.evidencia)}${field('Ação prática', `pdi-${i}-acao`, o.acao)}${field('Indicador / critério de sucesso', `pdi-${i}-indicador`, o.indicador)}${field('Responsável', `pdi-${i}-responsavel`, o.responsavel, { type: 'text' })}${field('Prazo', `pdi-${i}-prazo`, o.prazo, { type: 'date' })}${field('Apoio necessário', `pdi-${i}-apoio`, o.apoio)}${field('Progresso e evidências da revisão', `pdi-${i}-progresso`, o.progresso)}</div></fieldset>`).join('')}${field('Acompanhamento e revisões', 'pdiRevisoes', draft.revisoes)}<label class="pdi-check"><input type="checkbox" id="pdiAlinhado"> Revisei as evidências e alinhei objetivos, ações e critérios com a pessoa.</label><div class="pdi-actions"><button class="btn-primary" type="submit">Salvar nova versão de rascunho</button><button class="btn-small" id="pdiApprove" type="button">Aprovar plano</button><button class="btn-small" id="pdiExport" type="button">Exportar plano (.txt)</button></div></form>`;
    get('pdiPlanForm').addEventListener('input', () => { dirty = true; draftDirty = true; draft = capture(); draft.status = 'rascunho'; });
    function capture() {
      return { ...draft, alinhado: get('pdiAlinhado').checked, revisoes: get('pdiRevisoes').value.trim(), objetivos: draft.objetivos.map((o, i) => Object.fromEntries(Object.entries(o).map(([key, value]) => [key, get(`pdi-${i}-${key}`) ? get(`pdi-${i}-${key}`).value.trim() : value]))) };
    }
    function save(aprovar) {
      if (!get('pdiPlanForm').reportValidity()) return;
      try {
        const plano = capture(), error = E.validarPlano(plano, aprovar);
        if (error) throw new Error(error);
        const data = person(), planos = data.planos || [];
        const version = { ...plano, status: aprovar ? 'aprovado' : 'rascunho', versao: planos.length + 1, salvoEm: new Date().toISOString() };
        persist({ ...data, planos: [...planos, version] }); draft = version; dirty = false; draftDirty = false; renderPerson(); notice(`${aprovar ? 'Plano aprovado' : 'Rascunho salvo'} neste navegador. Exporte para guardar uma cópia.`);
      } catch (error) { notice(error.message || 'O navegador não conseguiu salvar o plano. Exporte uma cópia.', true); }
    }
    get('pdiPlanForm').addEventListener('submit', event => { event.preventDefault(); save(false); });
    get('pdiApprove').addEventListener('click', () => save(true));
    get('pdiExport').addEventListener('click', () => {
      if (!allowed() || owner !== userId()) return;
      const plano = capture();
      const status = dirty || plano.status !== 'aprovado' ? 'Rascunho' : 'Aprovado';
      const text = [`PDI — ${nome}`, `Status: ${status}`, `Gerado: ${dateLabel(plano.geradoEm)}`, '', ...plano.objetivos.flatMap((o, i) => [`OBJETIVO ${i + 1}: ${o.objetivo}`, `Competência: ${o.competencia}`, `Evidência: ${o.evidencia}`, `Ação: ${o.acao}`, `Indicador: ${o.indicador}`, `Responsável: ${o.responsavel}`, `Prazo: ${o.prazo}`, `Apoio: ${o.apoio}`, `Progresso: ${o.progresso || 'Sem registro'}`, '']), `Revisões: ${plano.revisoes}`, '', 'FONTES DO PLANO', JSON.stringify(plano.snapshot, null, 2)].join('\n');
      const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
      const link = document.createElement('a'); link.href = url; link.download = `pdi-${E.normalizar(nome).replace(/[^a-z0-9]+/g, '-')}.txt`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      notice('Plano exportado. A exportação não salva uma nova versão no navegador.');
    });
  }
  window.onPerfilPdiTabActivated = render;
  window.openPerfilPdi = function (personName) {
    if (!allowed()) return;
    if (dirty && !confirm('Descartar alterações não salvas e abrir outra pessoa?')) return;
    if (owner !== userId()) { owner = userId(); state = read(storageKey(), {}); }
    nome = personName; draft = null; dirty = false; draftDirty = false;
    document.querySelector('.tab-btn[data-tab="perfil-pdi"]')?.click();
  };
  document.addEventListener('DOMContentLoaded', () => {
    if (typeof sbClient !== 'undefined' && sbClient) sbClient.auth.onAuthStateChange((event, session) => {
      const nextOwner = session?.user && getTrustedUserRole(session.user) === 'admin' ? session.user.id : '';
      if (owner && owner !== nextOwner) { nome = ''; owner = ''; state = {}; draft = null; dirty = false; draftDirty = false; const host = get('perfilPdiContent'); if (host) host.replaceChildren(); }
    });
    document.getElementById('tabBar')?.addEventListener('click', event => {
      const button = event.target.closest('.tab-btn');
      if (!button || !dirty) return;
      if (button.dataset.tab === 'perfil-pdi') { event.preventDefault(); event.stopImmediatePropagation(); return; }
      if (!confirm('Há alterações não salvas na análise ou no PDI. Deseja sair e descartá-las?')) { event.preventDefault(); event.stopImmediatePropagation(); return; }
      draft = null; dirty = false; draftDirty = false;
    }, true);
    window.addEventListener('beforeunload', event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } });
  });
})();
