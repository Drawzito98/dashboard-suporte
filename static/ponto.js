/* MVP de ponto: dados privados apenas em memória e no Supabase. */
(function () {
  'use strict';
  const E = window.PontoEngine;
  const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  const keys = ['entrada_1', 'saida_1', 'entrada_2', 'saida_2', 'horas_normais', 'debito', 'credito', 'saldo'];
  const labels = ['Entrada', 'Saída intervalo', 'Retorno', 'Saída', 'Horas normais', 'Débito', 'Crédito', 'Saldo'];
  let employees = [], imports = [], preview = null, lines = [], file = null, owner = null, busy = false, generation = 0, activeTask = null;
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const root = () => document.getElementById('pontoRoot');
  const get = id => document.getElementById(id);
  const badge = v => `<span class="ponto-status ${v === 'REGULAR' ? 'regular' : v === 'INCONSISTÊNCIA' ? 'inconsistencia' : 'conferir'}">${esc(v)}</span>`;
  const fmt = v => v == null ? 'Não calculado' : `${v < 0 ? '-' : '+'}${String(Math.floor(Math.abs(v) / 60)).padStart(2, '0')}:${String(Math.abs(v) % 60).padStart(2, '0')}`;
  const documentSchedule = schedules => schedules?.length ? `<details><summary>Jornada apresentada no documento</summary>${schedules.map(j => `<p>${esc(j.dia_documento)}: ${Object.entries(j.campos_documento).filter(([k]) => /^(entrada|saida)_\d+$/.test(k)).map(([, v]) => esc(v ?? '—')).join(' | ')}</p>`).join('')}</details>` : '<p>Jornada do documento não identificada com segurança. A análise utiliza o cadastro confirmado.</p>';
  const checked = async promise => { const { data, error } = await promise; if (error) throw error; return data; };
  function notice(message, error = false) { const el = get('pontoNotice'); if (el) { el.textContent = message; el.className = 'ponto-notice' + (error ? ' error' : ''); } }
  async function guard() {
    if (!sbClient) throw new Error('Conexão com Supabase indisponível.');
    const { data, error } = await sbClient.auth.getUser();
    if (error || !data.user || getTrustedUserRole(data.user) !== 'admin') throw new Error('Auditoria disponível apenas para líderes administradores autenticados.');
    if (owner && owner !== data.user.id) { generation++; employees = []; imports = []; clearFile(); }
    owner = data.user.id;
    return data.user;
  }
  async function action(fn) {
    if (busy) return;
    busy = true;
    root()?.setAttribute('aria-busy', 'true');
    root()?.querySelectorAll('button:not(#pontoCancelImport)').forEach(b => { b.disabled = true; });
    const operationGeneration = generation;
    try { await guard(); if (operationGeneration !== generation) throw new Error('Processamento interrompido.'); await fn(); } catch (error) {
      discardSelectedFile();
      if (operationGeneration !== generation) { notice('Processamento interrompido. O arquivo foi descartado.'); return; }
      const msg = error.code === '42P01' || error.code === 'PGRST205' || error.code === 'PGRST202' ? 'O banco do módulo ainda não foi preparado. Execute as migrations v46 e v47 antes de usar.' : error.message || 'Não foi possível concluir. Tente novamente.';
      notice(msg, true);
    } finally { busy = false; root()?.removeAttribute('aria-busy'); root()?.querySelectorAll('button').forEach(b => { b.disabled = false; }); }
  }
  async function load() {
    const currentGeneration = generation;
    const loaded = await Promise.all([
      checked(sbClient.from('ponto_colaboradores').select('*,ponto_jornadas(*)').order('nome')),
      checked(sbClient.from('ponto_importacoes').select('id,colaborador_id,arquivo,periodo_inicio,periodo_fim,data_importacao,arquivo_sha256,registros_sha256,snapshot').order('data_importacao', { ascending: false }).limit(100))
    ]);
    if (generation !== currentGeneration) throw new Error('Sessão encerrada.');
    [employees, imports] = loaded;
  }
  function discardSelectedFile() { file = null; const input = get('pontoFile'); if (input) input.value = ''; }
  function clearFile() { discardSelectedFile(); lines = []; preview = null; if (activeTask) { activeTask.destroy().catch(() => {}); activeTask = null; } }
  function render() {
    root().innerHTML = `<div class="ponto-module"><header class="ponto-header"><div><h2>Auditoria de Ponto</h2><p>Cadastre a jornada, importe o cartão e confira as exceções.</p></div><span class="ponto-pill">MVP · Etapa 1</span></header>
      <div id="pontoNotice" role="status" aria-live="polite"></div>
      <nav class="ponto-nav" aria-label="Auditoria de ponto"><button type="button" class="btn-small" data-view="importar">Importar Ponto</button><button type="button" class="btn-small" data-view="colaboradores">Colaboradores e jornadas</button><button type="button" class="btn-small" data-view="resultados">Análises salvas</button></nav>
      <div id="pontoContent"></div></div>`;
    root().querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => view(b.dataset.view)));
    view('importar');
  }
  function view(name) {
    notice('');
    root().querySelectorAll('[data-view]').forEach(b => b.classList.toggle('selected', b.dataset.view === name));
    if (name === 'colaboradores') renderEmployees();
    else if (name === 'resultados') renderImports();
    else renderImport();
  }
  function renderEmployees() {
    get('pontoContent').innerHTML = `<section class="ponto-card"><h3>Colaboradores</h3><p>Cadastro exclusivo para jornadas. Os dados de desempenho da equipe são preservados.</p><button id="pontoNew" class="btn-primary" type="button">Cadastrar colaborador</button>
      <div class="ponto-table"><table><thead><tr><th>Nome</th><th>Setor</th><th>Status</th><th>Jornada</th></tr></thead><tbody>${employees.map(e => `<tr><td>${esc(e.nome)}</td><td>${esc(e.setor)}</td><td>${e.ativo ? 'Ativo' : 'Inativo'}</td><td><button class="btn-small" type="button" data-edit="${esc(e.id)}">Editar</button></td></tr>`).join('') || '<tr><td colspan="4">Nenhum colaborador cadastrado.</td></tr>'}</tbody></table></div></section><div id="pontoEditor"></div>`;
    get('pontoNew').onclick = () => editEmployee();
    root().querySelectorAll('[data-edit]').forEach(b => b.onclick = () => editEmployee(employees.find(e => e.id === b.dataset.edit)));
  }
  function editEmployee(employee) {
    const schedules = employee?.ponto_jornadas || [];
    const working = schedules.filter(j => j.trabalha);
    const base = working[0];
    const signature = j => JSON.stringify([j.minutos_esperados, ...keys.slice(0, 4).map(k => j[k]?.slice(0, 5))]);
    const varied = working.some(j => signature(j) !== signature(base));
    get('pontoEditor').innerHTML = `<form id="pontoEmployeeForm" class="ponto-card"><h3>${employee ? 'Editar' : 'Cadastrar'} colaborador</h3><div class="ponto-grid">
      <label>Nome completo<input name="nome" required maxlength="200" value="${esc(employee?.nome)}"></label><label>Setor<input name="setor" maxlength="120" value="${esc(employee?.setor)}"></label>
      <label>Status<select name="ativo"><option value="true">Ativo</option><option value="false" ${employee?.ativo === false ? 'selected' : ''}>Inativo</option></select></label><label>Observações<textarea name="observacoes" maxlength="2000">${esc(employee?.observacoes)}</textarea></label></div>
      <h4>Jornada do colaborador</h4><p>Informe o horário fixo da pessoa e marque os dias trabalhados abaixo.</p>
      <label class="ponto-check"><input type="checkbox" name="fixed" id="pontoFixedSchedule" ${varied ? '' : 'checked'}>Usar o mesmo horário em todos os dias trabalhados</label>
      ${varied ? '<p>Este cadastro possui horários diferentes. Eles serão preservados até você selecionar e salvar o horário fixo.</p>' : ''}
      <div class="ponto-grid" id="pontoFixedFields">${keys.slice(0, 4).map((k, n) => `<label>${labels[n]}<input type="time" name="fixed_${k}" value="${esc(base?.[k]?.slice(0, 5))}"></label>`).join('')}<label>Jornada diária (hh:mm)<input name="fixed_expected" placeholder="08:36" pattern="[0-9]{2}:[0-5][0-9]" value="${base ? fmt(base.minutos_esperados).slice(1) : ''}"></label></div>
      <div class="ponto-table"><table><thead><tr><th>Dia</th><th>Trabalha</th><th>Entrada</th><th>Intervalo</th><th>Retorno</th><th>Saída</th><th>Jornada (hh:mm)</th></tr></thead><tbody>${days.map((d, i) => {
        const j = schedules.find(s => s.dia_semana === i);
        return `<tr data-day="${i}"><td>${d}</td><td><input type="checkbox" name="work${i}" aria-label="Trabalha ${d}" ${j?.trabalha ? 'checked' : ''}></td>${keys.slice(0, 4).map((k, n) => `<td><input type="time" name="${k}${i}" aria-label="${labels[n]} ${d}" value="${esc(j?.[k]?.slice(0, 5))}"></td>`).join('')}<td><input name="expected${i}" placeholder="08:36" pattern="[0-9]{2}:[0-5][0-9]" aria-label="Jornada ${d}" value="${j?.trabalha ? fmt(j.minutos_esperados).slice(1) : ''}"></td></tr>`;
      }).join('')}</tbody></table></div><div class="ponto-actions"><button class="btn-primary" type="submit">Salvar colaborador e jornada</button><button id="pontoCancelEdit" class="btn-small" type="button">Cancelar</button></div></form>`;
    const toggleSchedule = () => {
      const fixed = get('pontoFixedSchedule').checked;
      get('pontoFixedFields').hidden = !fixed;
      get('pontoEmployeeForm').querySelectorAll('[data-day] input:not([type=checkbox])').forEach(input => { input.disabled = fixed; input.closest('td').hidden = fixed; });
      get('pontoEmployeeForm').querySelectorAll('thead th').forEach((th, i) => { if (i > 1) th.hidden = fixed; });
    };
    get('pontoFixedSchedule').onchange = toggleSchedule;
    toggleSchedule();
    get('pontoCancelEdit').onclick = () => { get('pontoEditor').innerHTML = ''; };
    get('pontoEmployeeForm').onsubmit = event => { event.preventDefault(); action(async () => {
      const form = new FormData(event.target);
      const journeys = days.map((_, i) => {
        const works = form.get(`work${i}`) === 'on';
        const j = { dia_semana: i, trabalha: works, minutos_esperados: works ? E.minutes(form.get(form.get('fixed') === 'on' ? 'fixed_expected' : `expected${i}`), true) : 0 };
        keys.slice(0, 4).forEach(k => { j[k] = works ? form.get(form.get('fixed') === 'on' ? 'fixed_' + k : k + i) : ''; });
        if (works && (!j.minutos_esperados || j.minutos_esperados > 1440 || keys.slice(0, 4).some(k => E.minutes(j[k]) === null))) throw new Error(`Complete os horários e a jornada de ${days[i]}.`);
        return j;
      });
      await checked(sbClient.rpc('ponto_salvar_colaborador', { p_id: employee?.id || null, p_nome: form.get('nome'), p_setor: form.get('setor'), p_ativo: form.get('ativo') === 'true', p_observacoes: form.get('observacoes'), p_jornadas: journeys }));
      await load(); renderEmployees(); notice('Colaborador e jornada salvos.');
    }); };
  }
  function renderImport() {
    get('pontoContent').innerHTML = `<section class="ponto-card"><h3>Importar um cartão PDF</h3><p>O arquivo é lido neste navegador e descartado após a extração. Confira o período, o colaborador e as colunas antes de salvar. PDFs digitalizados precisam de adaptação após a validação do modelo.</p>
      <div id="pontoDrop" class="ponto-drop"><label>Selecione ou arraste um PDF (até 20 MB)<input id="pontoFile" type="file" accept=".pdf,application/pdf"></label><span id="pontoFilename">${esc(file?.name || 'Nenhum arquivo selecionado')}</span></div>
      <form id="pontoImportForm"><div class="ponto-grid"><label>Período inicial (opcional se impresso no cartão)<input id="pontoStart" type="date"></label><label>Período final<input id="pontoEnd" type="date"></label></div>
      <div class="ponto-actions"><button class="btn-primary" type="submit">Extrair e mostrar prévia</button><button class="btn-small" id="pontoCancelImport" type="button">Cancelar importação</button></div></form></section><div id="pontoPreview"></div>`;
    get('pontoCancelImport').onclick = () => { generation++; clearFile(); renderImport(); notice('Importação cancelada. Arquivo e prévia descartados.'); };
    const select = selected => { if (busy) return; clearFile(); file = selected; get('pontoFilename').textContent = selected?.name || 'Nenhum arquivo selecionado'; get('pontoPreview').innerHTML = ''; };
    get('pontoFile').onchange = e => select(e.target.files[0]);
    get('pontoDrop').ondragover = e => { e.preventDefault(); };
    get('pontoDrop').ondrop = e => { e.preventDefault(); if (e.dataTransfer.files.length !== 1) return notice('Nesta etapa, importe um PDF por vez.', true); select(e.dataTransfer.files[0]); };
    get('pontoImportForm').onsubmit = e => { e.preventDefault(); action(async () => {
      let bytes = null;
      const originalName = file?.name;
      try {
      if (!file || !/\.pdf$/i.test(file.name) || file.size > 20 * 1024 * 1024) throw new Error('Selecione um PDF de até 20 MB.');
      let start = get('pontoStart').value, end = get('pontoEnd').value;
      if (!!start !== !!end || (start && (end < start || (new Date(end) - new Date(start)) / 86400000 > 366))) throw new Error('Informe um período válido de até um ano ou deixe ambos os campos vazios.');
      notice('Lendo PDF no navegador…');
      const currentGeneration = generation;
      bytes = new Uint8Array(await file.arrayBuffer());
      discardSelectedFile();
      if (generation !== currentGeneration) throw new Error('Processamento interrompido.');
      if (!new TextDecoder().decode(bytes.slice(0, 1024)).includes('%PDF-')) throw new Error('O arquivo não contém um PDF válido.');
      const sha = await digest(bytes);
      const existing = await checked(sbClient.from('ponto_importacoes').select('id').eq('arquivo_sha256', sha).maybeSingle());
      if (generation !== currentGeneration) throw new Error('Processamento interrompido.');
      if (existing) { await showResult(existing.id); notice('Este cartão de ponto aparentemente já foi analisado.'); return; }
      const pdfjs = await import('./vendor/pdfjs/pdf.mjs');
      if (generation !== currentGeneration) throw new Error('Processamento interrompido.');
      pdfjs.GlobalWorkerOptions.workerSrc = '/static/vendor/pdfjs/pdf.worker.mjs';
      const task = pdfjs.getDocument({ data: bytes, isEvalSupported: false });
      activeTask = task;
      let pageCount;
      try {
        const pdf = await task.promise;
        pageCount = pdf.numPages;
        if (pdf.numPages > 50) throw new Error('Limite de 50 páginas por cartão no MVP.');
        lines = [];
        for (let n = 1; n <= pdf.numPages; n++) { const page = await pdf.getPage(n); const text = await page.getTextContent(); lines.push(...E.pageLines(text.items, n)); }
      } finally { await task.destroy(); if (activeTask === task) activeTask = null; }
      if (generation !== currentGeneration) { clearFile(); throw new Error('Sessão encerrada.'); }
      const extracted = E.extract(lines, start || null, end || null);
      if (!start && !end && extracted.periodos_documento.length === 1) { start = extracted.periodos_documento[0].inicio; end = extracted.periodos_documento[0].fim; }
      if (!start || !end || end < start || (new Date(end) - new Date(start)) / 86400000 > 366) throw new Error('Não foi possível identificar um período válido. Informe o período e selecione o PDF novamente.');
      get('pontoStart').value = start; get('pontoEnd').value = end;
      if (!extracted.rows.length) throw new Error(extracted.warnings.join(' '));
      if (extracted.rows.length > 400) throw new Error('Mais de 400 registros; confira o período e o layout.');
      preview = { ...extracted, paginas_processadas: pageCount, arquivo: originalName, start, end, sha, mapping: {}, confirmed: false, employeeId: E.identify(extracted.nome, employees.filter(e => e.ativo)), records: [] };
      renderPreview(); notice('Extração concluída. Confirme as colunas e revise os registros.');
      } finally { if (bytes?.byteLength) bytes.fill(0); bytes = null; discardSelectedFile(); lines = []; }
    }); };
    if (preview) { get('pontoStart').value = preview.start; get('pontoEnd').value = preview.end; renderPreview(); }
  }
  function renderPreview() {
    const positioned = preview.rows.every(r => r.campos_documento);
    get('pontoPreview').innerHTML = `<section class="ponto-card"><h3>Prévia do documento</h3><p>${preview.paginas_processadas} páginas processadas · ${preview.rows.length} registros diários · ${preview.justificativas.length} justificativas/alterações</p><p>Saldo final informado no cartão: <strong>${esc(preview.totais_documento?.saldo ?? 'Não identificado')}</strong></p>${documentSchedule(preview.jornadas_documento)}<p>O PDF foi descartado após a extração. Somente os dados estruturados serão salvos.</p><p>${preview.employeeId ? 'Nome corresponde exatamente a um cadastro. Confirme a associação.' : 'Associação automática não confirmada. Selecione o colaborador correto.'}</p>${preview.warnings.map(w => `<p class="ponto-notice error">${esc(w)}</p>`).join('')}
      <label>Colaborador<select id="pontoEmployee"><option value="">Selecione com base no documento</option>${employees.filter(e => e.ativo).map(e => `<option value="${esc(e.id)}" ${e.id === preview.employeeId ? 'selected' : ''}>${esc(e.nome)} · ${esc(e.setor)}</option>`).join('')}</select></label>
      ${positioned ? '<p>Colunas identificadas pelo cabeçalho e pela posição no PDF. Batidas vazias e terceira entrada/saída são preservadas.</p>' : '<h4>Ordem dos valores no cartão</h4><p>Informe a posição de cada coluna entre os valores de horário da linha (1, 2, 3…). Deixe os totais em branco se não existirem. Linhas incompletas ficam para conferir.</p>'}
      <div class="ponto-grid" ${positioned ? 'hidden' : ''}>${keys.map((k, i) => `<label>${labels[i]}<input type="number" min="1" max="20" id="pontoMap_${k}" ${i < 4 && !positioned ? 'required' : ''} value="${preview.mapping[k] >= 0 ? preview.mapping[k] + 1 : ''}" placeholder="Posição"></label>`).join('')}</div>
      <div class="ponto-grid"><label>Tolerância por batida (min)<input id="pontoTolerance" type="number" min="0" max="120" value="5"></label><label>Limite diário (min)<input id="pontoDaily" type="number" min="0" max="240" value="10"></label></div>
      <label class="ponto-check"><input id="pontoConfirm" type="checkbox">Conferi no PDF o colaborador, o período e o significado das colunas.</label>
      <div class="ponto-actions"><button class="btn-primary" id="pontoAnalyze" type="button">Aplicar regras e atualizar prévia</button><button class="btn-small" id="pontoSave" type="button">Salvar análise</button></div><div id="pontoRows"></div></section>`;
    get('pontoAnalyze').onclick = () => { try { calculate(); notice('Prévia atualizada. Dados originais preservados.'); } catch (e) { notice(e.message, true); } };
    get('pontoSave').onclick = () => action(savePreview);
    renderPendingPreview();
    ['pontoEmployee', 'pontoConfirm', 'pontoTolerance', 'pontoDaily', ...keys.map(k => 'pontoMap_' + k)].forEach(id => {
      get(id).addEventListener('change', renderPendingPreview);
      get(id).addEventListener('input', renderPendingPreview);
    });
  }
  function renderPendingPreview() {
    if (!preview) return;
    preview.records = [];
    preview.confirmed = false;
    renderRows(preview.rows.map(r => ({ data: r.data, extraido: r, interpretado: {}, calculado: { classificacao: 'Não analisado', ocorrencias: [{ descricao: 'Aguardando confirmação dos dados e aplicação das regras.' }] } })), get('pontoRows'), false);
  }
  function calculate() {
    if (!preview) throw new Error('Importe um PDF primeiro.');
    const employee = employees.find(e => e.id === get('pontoEmployee').value && e.ativo);
    if (!employee || !get('pontoConfirm').checked) throw new Error('Selecione o colaborador e confirme a conferência do documento.');
    const mapping = Object.fromEntries(keys.map(k => [k, get('pontoMap_' + k).value === '' ? null : Number(get('pontoMap_' + k).value) - 1]));
    if ((!preview.rows.every(r => r.campos_documento) && keys.slice(0, 4).some(k => !Number.isInteger(mapping[k]) || mapping[k] < 0)) || Object.values(mapping).some(v => v !== null && (!Number.isInteger(v) || v < 0 || v > 19))) throw new Error('Informe posições válidas para as quatro batidas.');
    const vals = Object.values(mapping).filter(v => v !== null);
    if (new Set(vals).size !== vals.length) throw new Error('Cada coluna deve usar uma posição diferente.');
    const rules = { ...E.DEFAULT_RULES, tolerancia_batida: Number(get('pontoTolerance').value), tolerancia_diaria: Number(get('pontoDaily').value) };
    if (get('pontoTolerance').value === '' || get('pontoDaily').value === '' || !Number.isInteger(rules.tolerancia_batida) || !Number.isInteger(rules.tolerancia_diaria) || rules.tolerancia_batida < 0 || rules.tolerancia_batida > 120 || rules.tolerancia_diaria < 0 || rules.tolerancia_diaria > 240) throw new Error('Informe tolerâncias válidas.');
    preview.records = preview.rows.map(row => {
      const interpretation = E.interpret(row, mapping, true);
      const weekday = row.data ? new Date(row.data + 'T12:00:00Z').getUTCDay() : null;
      const schedule = employee.ponto_jornadas.find(j => j.dia_semana === weekday);
      // PostgreSQL time values include seconds; comparison is performed in minutes.
      const normalized = schedule ? { ...schedule, ...Object.fromEntries(keys.slice(0, 4).map(k => [k, schedule[k]?.slice(0, 5)])) } : null;
      return { data: row.data, extraido: row, interpretado: interpretation, calculado: E.analyze(interpretation, normalized, rules) };
    });
    Object.assign(preview, { mapping, rules, employeeId: employee.id, confirmed: true, scheduleSnapshot: employee.ponto_jornadas });
    renderRows(preview.records, get('pontoRows'));
  }
  function renderRows(records, target, analyzed = true) {
    const counts = ['REGULAR', 'CONFERIR', 'INCONSISTÊNCIA'].map(s => ({ s, count: records.filter(r => r.calculado.classificacao === s).length }));
    target.innerHTML = `${analyzed ? `<div class="ponto-stats">${counts.map(c => `<div>${badge(c.s)}<strong>${c.count}</strong></div>`).join('')}</div>` : '<p class="ponto-notice">Dados extraídos; análise ainda não realizada. Selecione o colaborador com jornada cadastrada, confirme os dados e clique em “Aplicar regras e atualizar prévia”.</p>'}<div class="ponto-table"><table><thead><tr><th>Data</th><th>Entrada</th><th>Intervalo</th><th>Retorno</th><th>Saída</th><th>Resultado</th><th>Motivo e documento</th><th>Justificativa/Alteração</th></tr></thead><tbody>${records.map(r => `<tr><td>${esc(r.data || r.extraido.data_documento)}<small>${r.data ? days[new Date(r.data + 'T12:00:00Z').getUTCDay()] : 'Data não interpretada'}</small></td>${[0, 1, 2, 3].map(i => `<td>${esc(r.extraido.campos_documento?.[E.TABLE_KEYS[i]] ?? r.interpretado.batidas?.[i] ?? '—')}</td>`).join('')}<td>${badge(r.calculado.classificacao)}</td><td>${r.calculado.ocorrencias.map(o => esc(o.descricao)).join('<br>') || 'Nenhuma ocorrência relevante.'}<details><summary>Valores extraídos e cálculo</summary><p>${esc(r.extraido.tokens.map((t, i) => `${i + 1}: ${t}`).join(' | ')) || 'Sem horários reconhecidos'}</p><p>Tipo: ${esc(r.extraido.tipo_dia)} · Página ${esc(r.extraido.pagina)}</p><p>Terceira batida: ${esc(r.extraido.campos_documento?.entrada_3 ?? '—')} / ${esc(r.extraido.campos_documento?.saida_3 ?? '—')}</p><p>Saldo calculado: ${fmt(r.calculado.saldo_calculado)} · Saldo informado: ${esc(r.interpretado.totais?.saldo ?? r.extraido.campos_documento?.saldo ?? 'Não identificado')}</p></details></td><td>${(r.justificativas || r.extraido.justificativas || []).map(j => `<p>${esc(j.hora)} · ${esc(j.codigo_ocorrencia)} · ${esc(j.descricao)}<small>${j.batidas_relacionadas?.length ? 'Relacionada a: ' + esc(j.batidas_relacionadas.join(', ')) : 'Contexto do dia; sem batida idêntica na tabela principal'}</small></p>`).join('') || '—'}</td></tr>`).join('')}</tbody></table></div>`;
  }
  async function digest(value) { const b = await crypto.subtle.digest('SHA-256', value); return [...new Uint8Array(b)].map(v => v.toString(16).padStart(2, '0')).join(''); }
  async function savePreview() {
    calculate();
    if (preview.records.some(r => !r.data || r.extraido.ambigua)) throw new Error('Há datas ambíguas ou repetidas. Corrija o período ou valide o layout antes de salvar.');
    if (preview.justificativas_nao_interpretadas.length || preview.justificativas_sem_registro.length) throw new Error('Há justificativas ambíguas ou sem registro diário. Valide o documento antes de salvar.');
    if (preview.periodos_documento.length > 1 || preview.periodos_documento.some(p => p.inicio !== preview.start || p.fim !== preview.end)) throw new Error('O período informado não corresponde ao documento.');
    const canonical = { registros: preview.records.map(r => ({ data: r.data, tokens: r.extraido.tokens, campos: r.extraido.campos_documento, tipo_dia: r.extraido.tipo_dia, marcacao_manual: r.extraido.marcacao_manual })).sort((a, b) => a.data.localeCompare(b.data)), justificativas: preview.justificativas.map(j => [j.data, j.hora, j.codigo_ocorrencia, j.descricao]).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))), totais: preview.totais_documento };
    const recordsHash = await digest(new TextEncoder().encode(JSON.stringify(canonical)));
    const existing = await checked(sbClient.from('ponto_importacoes').select('id').eq('colaborador_id', preview.employeeId).eq('periodo_inicio', preview.start).eq('periodo_fim', preview.end).eq('registros_sha256', recordsHash).maybeSingle());
    if (existing) { await showResult(existing.id); notice('Este cartão de ponto aparentemente já foi analisado.'); return; }
    const id = crypto.randomUUID();
    notice('Salvando somente dados estruturados…');
    const payload = { id, colaborador_id: preview.employeeId, arquivo: preview.arquivo, arquivo_sha256: preview.sha, registros_sha256: recordsHash, periodo_inicio: preview.start, periodo_fim: preview.end,
      snapshot: { versao: E.VERSION, versao_extracao: 'multipagina-2', nome_documento: preview.nome || null, paginas_processadas: preview.paginas_processadas, totais_documento: preview.totais_documento, jornadas_documento: preview.jornadas_documento, legendas_documento: preview.legendas_documento, regras: preview.rules, jornadas: preview.scheduleSnapshot, mapping: preview.mapping, colaborador: employees.find(e => e.id === preview.employeeId).nome, setor: employees.find(e => e.id === preview.employeeId).setor, confirmacao_extracao: true, confirmada_em: new Date().toISOString() } };
    try { await checked(sbClient.rpc('ponto_salvar_importacao', { p_importacao: payload, p_registros: preview.records, p_justificativas: preview.justificativas })); }
    catch (error) {
      // A network failure may occur after commit; structured history remains the source of truth.
      const committed = await sbClient.from('ponto_importacoes').select('id').eq('id', id).maybeSingle();
      if (committed.error) throw new Error('Não foi possível confirmar o salvamento. Reabra as análises salvas antes de tentar novamente.');
      if (!committed.data) {
        if (error.code === '23505') {
          const duplicate = await checked(sbClient.from('ponto_importacoes').select('id').eq('arquivo_sha256', preview.sha).maybeSingle());
          if (duplicate) { await showResult(duplicate.id); notice('Este cartão de ponto aparentemente já foi analisado.'); return; }
        }
        throw error;
      }
    }
    clearFile(); await load(); await showResult(id); notice('Análise salva com regras, jornada e dados originais preservados.');
  }
  function renderImports() {
    get('pontoContent').innerHTML = `<section class="ponto-card"><h3>Análises salvas</h3><p>As novas importações preservam as análises anteriores. Exibindo as 100 mais recentes.</p><button class="btn-small" id="pontoRefresh" type="button">Atualizar</button><div class="ponto-table"><table><thead><tr><th>Colaborador</th><th>Período</th><th>Importado em</th><th>Análise</th></tr></thead><tbody>${imports.map(i => `<tr><td>${esc(i.snapshot.colaborador)}</td><td>${esc(i.periodo_inicio)} a ${esc(i.periodo_fim)}</td><td>${esc(new Date(i.data_importacao).toLocaleString('pt-BR'))}</td><td><button type="button" class="btn-small" data-result="${i.id}">Abrir</button></td></tr>`).join('') || '<tr><td colspan="4">Nenhuma análise salva.</td></tr>'}</tbody></table></div></section>`;
    get('pontoRefresh').onclick = () => action(async () => { await load(); renderImports(); });
    root().querySelectorAll('[data-result]').forEach(b => b.onclick = () => action(() => showResult(b.dataset.result)));
  }
  async function showResult(id) {
    const currentGeneration = generation;
    const [analysis, records, justifications] = await Promise.all([checked(sbClient.from('ponto_importacoes').select('*').eq('id', id).single()), checked(sbClient.from('ponto_registros').select('*').eq('importacao_id', id).order('data')), checked(sbClient.from('ponto_justificativas').select('*').eq('importacao_id', id).order('data'))]);
    if (generation !== currentGeneration) throw new Error('Sessão encerrada.');
    get('pontoContent').innerHTML = `<section class="ponto-card"><button class="btn-small" id="pontoBack" type="button">Voltar às análises</button><h3>${esc(analysis.snapshot.colaborador)}</h3><p>${esc(analysis.periodo_inicio)} a ${esc(analysis.periodo_fim)} · Importado em ${esc(new Date(analysis.data_importacao).toLocaleString('pt-BR'))}</p><p>Tolerância aplicada: ${esc(analysis.snapshot.regras.tolerancia_batida)} min por batida / ${esc(analysis.snapshot.regras.tolerancia_diaria)} min por dia · Motor ${esc(analysis.snapshot.versao)}</p><p>Saldo final informado: <strong>${esc(analysis.snapshot.totais_documento?.saldo ?? 'Não identificado nesta análise')}</strong></p>${documentSchedule(analysis.snapshot.jornadas_documento)}<div id="pontoResultRows"></div></section>`;
    get('pontoBack').onclick = renderImports;
    records.forEach(r => { r.justificativas = justifications.filter(j => j.registro_ponto_id === r.id); });
    renderRows(records, get('pontoResultRows'));
  }
  window.onPontoTabActivated = () => {
    if (!root() || busy) return;
    root().innerHTML = '<div class="ponto-module"><div id="pontoNotice" role="status">Carregando auditoria…</div></div>';
    action(async () => { await load(); render(); });
  };
  document.addEventListener('DOMContentLoaded', () => {
    const button = document.querySelector('[data-tab="ponto"]');
    // UI visibility is secondary; RLS enforces access on every operation.
    const syncAccess = () => { const allowed = document.body.dataset.role === 'admin'; if (button) button.hidden = !allowed; if (!allowed) { generation++; employees = []; imports = []; owner = null; clearFile(); if (root()) root().innerHTML = ''; } };
    new MutationObserver(syncAccess).observe(document.body, { attributes: true, attributeFilter: ['data-role'] }); syncAccess();
    new MutationObserver(() => { if (document.body.dataset.activeTab !== 'ponto' && (file || preview || activeTask)) { generation++; clearFile(); if (root()) root().innerHTML = ''; } }).observe(document.body, { attributes: true, attributeFilter: ['data-active-tab'] });
    sbClient?.auth.onAuthStateChange(event => { if (event === 'SIGNED_OUT') { generation++; employees = []; imports = []; owner = null; clearFile(); if (root()) root().innerHTML = ''; } });
  });
})();
