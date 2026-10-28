/* Integração aditiva às telas existentes; mantém seus componentes e gráficos. */
(function () {
  'use strict';
  const E = window.DiagnosticoEngine;
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (v, digits = 2) => v == null ? 'Sem informação' : v.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const read = (key, fallback) => { try { return JSON.parse(appStorage.getItem(key)) || fallback; } catch (_) { return fallback; } };
  const states = new Map();
  const source = () => (typeof rawRecords !== 'undefined' ? rawRecords : []).filter(r =>
    (typeof isColabActive !== 'function' || isColabActive(r?.Atendente)) &&
    (typeof isSetorActive !== 'function' || isSetorActive(r?.Setor)));
  const filters = () => typeof globalFilters !== 'undefined' ? globalFilters : {};
  function monthsFor(rows, gf) {
    if (gf.periodo === '__range__' && gf.mesInicio && gf.mesFim) return E.range(gf.mesInicio, gf.mesFim);
    if (gf.periodo === '__multi__' && gf.mesesSelecionados?.length) return [...gf.mesesSelecionados].sort();
    if (gf.periodo && !['all', '__range__', '__multi__'].includes(gf.periodo)) return [gf.periodo];
    const months = [...new Set(rows.map(r => r['Mês']).filter(m => E.shift(m, 0)))].sort();
    return [months.at(-1) || new Date().toISOString().slice(0, 7)];
  }
  const store = () => typeof sbClient !== 'undefined' && sbClient ? DiagnosticoStore.create({ client: sbClient, storage: appStorage, engine: E }) : null;
  async function fingerprint(snapshot) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(snapshot)));
    return [...new Uint8Array(digest)].map(v => v.toString(16).padStart(2, '0')).join('');
  }
  function groupHTML(group, index, entries, result) {
    const findings = group.findings.map(finding => {
      const id = entries.length;
      entries.push({ group, finding, snapshot: { version: 1, current: result.current, previous: result.previous, type: group.type, name: group.name, sector: group.sector, level: group.level, currentMetrics: group.current, previousMetrics: group.previous, notices: group.notices, finding } });
      return `<article class="diag-finding" data-kind="${finding.kind}"><h4>${esc(finding.indicator)}</h4><dl>${[
        ['Indicador', finding.indicator], ['Evidência', finding.evidence], ['Interpretação', finding.interpretation], ['Hipótese', finding.hypothesis], ['Ação recomendada', finding.action]
      ].map(([label, value]) => `<dt>${label}</dt><dd>${esc(value)}</dd>`).join('')}</dl><div class="diag-review" data-entry="${id}"><label>Revisão da liderança<select aria-label="Revisão do diagnóstico"><option value="">Sugestão pendente de revisão</option><option value="validado">Validar diagnóstico</option><option value="ajustado">Ajustar diagnóstico</option><option value="descartado">Descartar diagnóstico</option></select></label><label>Justificativa ou ajuste<textarea rows="2" maxlength="4000" placeholder="Registre a interpretação validada ou o motivo do descarte"></textarea></label><button type="button" class="btn-small">Salvar revisão</button><p class="diag-status" role="status" aria-live="polite"></p></div></article>`;
    }).join('');
    return `<details class="diag-group" ${group.type === 'sector' || index === 0 ? 'open' : ''}><summary>${esc(group.name)} · ${esc(group.sector)} · ${esc(group.level)} · Score ${fmt(group.current.score)}${group.recurring ? ' · Quedas recorrentes' : ''}</summary><p class="diag-note">${group.notices.map(esc).join(' ')}</p><div class="diag-grid"><div class="diag-card">Score médio individual<strong>${fmt(group.current.score)}</strong>Média simples por pessoa; meta 4,70</div><div class="diag-card">Score consolidado ponderado<strong>${fmt(group.current.weightedScore)}</strong>${group.current.evaluations === null ? 'Quantidade de avaliações não informada; não estimada por volume.' : `${group.current.evaluations} avaliações explicitamente informadas.`}</div><div class="diag-card">Finalizados<strong>${fmt(group.current.finished, 0)}</strong>Volume descritivo, sem ranking entre níveis</div></div>${group.goalResults.length ? `<h4>Outras metas cadastradas</h4><ul>${group.goalResults.map(g => `<li>${esc(g.title)}: ${fmt(g.value)} / ${fmt(g.target)}${g.metric === 'produtividade' ? ' (razão finalizados/assumidos)' : ''} · ${!g.comparable ? 'período parcial; cumprimento não classificado' : g.met === null ? 'dados insuficientes' : g.met ? 'atingida ou superada' : 'abaixo da meta'}</li>`).join('')}</ul>` : ''}${findings}<details><summary>Histórico de desempenho disponível</summary><div class="diag-scroll"><table class="ranking-table"><thead><tr><th>Mês</th><th>Score médio individual</th><th>Finalizados</th><th>TMA (min)</th><th>TMR (min)</th></tr></thead><tbody>${group.history.map(m => `<tr><td>${esc(m.month)}</td><td>${fmt(m.score)}</td><td>${fmt(m.finished, 0)}</td><td>${fmt(m.tma === null ? null : m.tma / 60, 1)}</td><td>${fmt(m.tmr === null ? null : m.tmr / 60, 1)}</td></tr>`).join('')}</tbody></table></div></details></details>`;
  }
  function mount(container, kind, person) {
    if (!container || !['admin', 'viewer'].includes(document.body.dataset.role)) return;
    const oldHost = container.querySelector('.diag-section');
    oldHost?._chart?.destroy();
    oldHost?.remove();
    const host = document.createElement('section'); host.className = 'diag-section';
    container.prepend(host);
    const stateKey = `${kind}:${person || ''}`;
    const state = states.get(stateKey) || { mode: 'global' }; states.set(stateKey, state);
    const registry = read('sistema_colaboradores_info_v1', {}), gf = filters();
    const scopeFilters = { setor: gf.setor, nivel: gf.nivel, colaborador: person || gf.colaborador, pesquisa: gf.pesquisa };
    const records = source();
    const context = E.context(records, scopeFilters, registry);
    const globalMonths = monthsFor(context, gf);
    const previousDefaults = E.previousFor(globalMonths);
    const defaults = { cs: globalMonths[0], ce: globalMonths.at(-1), ps: previousDefaults[0], pe: previousDefaults.at(-1) };
    function render() {
      if (!host.isConnected) return;
      host._chart?.destroy();
      const values = { ...defaults, ...state };
      host.innerHTML = `<h3>${person ? 'Diagnóstico e Evolução' : kind === 'leader' ? 'Diagnóstico gerencial consolidado' : 'Diagnóstico Operacional'}</h3><p class="diag-intro">Análise sugerida para investigação. Meta oficial de Score: 4,70. Níveis são separados e vêm do cadastro atual; mudanças históricas de nível não estão registradas. CADU não entra no diagnóstico das pessoas. Os indicadores existentes continuam disponíveis abaixo.</p><div class="diag-controls"><label>Comparação<select data-field="mode"><option value="global">Período dos filtros globais × período anterior</option><option value="now">Mês atual × mês anterior</option><option value="custom">Períodos personalizados (mensais)</option></select></label>${[['cs', 'Atual · início'], ['ce', 'Atual · fim'], ['ps', 'Base · início'], ['pe', 'Base · fim']].map(([field, label]) => `<label ${state.mode === 'custom' ? '' : 'hidden'}>${label}<input type="month" data-field="${field}" value="${esc(values[field])}"></label>`).join('')}</div><p class="diag-status diag-message" role="status" aria-live="polite"></p><div class="diag-results"></div>`;
      host.querySelector('[data-field=mode]').value = state.mode;
      host.querySelectorAll('[data-field]').forEach(input => input.addEventListener('change', () => { state[input.dataset.field] = input.value; render(); }));
      const area = host.querySelector('.diag-results');
      const message = host.querySelector('.diag-message');
      let result;
      try {
        const current = state.mode === 'now' ? [new Date().toISOString().slice(0, 7)] : state.mode === 'custom' ? E.range(values.cs, values.ce) : globalMonths;
        const previous = state.mode === 'custom' ? E.range(values.ps, values.pe) : E.previousFor(current);
        result = E.analyze(records, { current, previous, registry, filters: scopeFilters, goals: read('sistema_metas_v1', []) });
        message.textContent = `${current.join(', ')} comparado com ${previous.join(', ')}. Setor, nível, colaborador e busca seguem os filtros globais.${result.excludedAI ? ' CADU está separado desta análise.' : ''}`;
      } catch (error) { message.textContent = error.message; return; }
      if (!result.groups.length) { area.innerHTML = '<p class="diag-warning">Não há dados no período e recorte selecionados. Não é possível gerar diagnóstico.</p>'; return; }
      const people = result.groups.filter(g => g.type === 'person');
      const positive = people.filter(g => g.findings.some(f => f.code === 'score-change' && f.kind === 'positive'));
      const recurring = people.filter(g => g.recurring);
      const attention = people.filter(g => g.current.score !== null && g.current.score < E.TARGET);
      const display = name => typeof getDisplayName === 'function' && typeof buildAliasMap === 'function' ? getDisplayName(name, buildAliasMap(people.map(g => g.name))) : name;
      const list = groups => groups.length ? groups.map(g => `${display(g.name)} (${g.level}, ${g.sector})`).join('; ') : 'Nenhum caso identificado com os dados disponíveis.';
      if (!person) area.innerHTML = `<div class="diag-grid"><div class="diag-card">Evolução positiva de Score<strong>${positive.length}</strong>${esc(list(positive))}</div><div class="diag-card">Quedas recorrentes de Score<strong>${recurring.length}</strong>${esc(list(recurring))}</div><div class="diag-card">Score abaixo de 4,70<strong>${attention.length}</strong>${esc(list(attention))}</div></div><p class="diag-note">As contagens representam vínculos pessoa/setor/nível. Uma pessoa pode aparecer em mais de um setor; não há ranking de produtividade entre N1 e N2.</p>`;
      if (!person) {
        const sectors = result.groups.filter(g => g.type === 'sector' && g.current.score !== null && g.current.score < E.TARGET);
        const levels = [...new Set(sectors.map(g => g.level))].sort();
        area.insertAdjacentHTML('beforeend', `<h4>Setores com maiores desvios de Score por nível</h4>${levels.length ? levels.map(level => `<p><strong>${esc(level)}</strong></p><ul class="diag-summary-list">${sectors.filter(g => g.level === level).sort((a, b) => a.current.score - b.current.score).map(g => `<li>${esc(g.sector)}: média simples ${fmt(g.current.score)}; ${fmt(E.TARGET - g.current.score)} ponto(s) abaixo de 4,70. Investigar motivos das notas e cobertura das avaliações.</li>`).join('')}</ul>`).join('') : '<p class="diag-note">Nenhum desvio abaixo de 4,70 identificado nos setores com Score disponível. A ausência de dados não é classificação de desempenho saudável.</p>'}`);
      }
      if (person) {
        const info = E.infoFor(person, registry);
        const feedbacks = read('sistema_feedbacks_v1', []).filter(f => E.key(f.colaborador) === E.key(person));
        const evaluations = read('sistema_avaliacoes_v1', []).filter(f => E.key(f.colaborador) === E.key(person));
        area.innerHTML = `<h4>Observações registradas pela liderança</h4><p class="diag-notes">${esc(info.observacoes || 'Nenhuma observação geral registrada.')}</p><p class="diag-note">${feedbacks.length} feedback(s) e ${evaluations.length} avaliação(ões) de competências já cadastrados. Esses registros não são avaliações de satisfação e não ponderam o Score. Consulte as áreas existentes para o conteúdo completo.</p><div style="height:240px"><canvas class="diag-chart" aria-label="Evolução do Score individual" role="img"></canvas></div>`;
        const notes = [
          ...context.filter(r => r['Observações'] && r['Mês'] <= result.current.at(-1)).map(r => ({ source: `Registro mensal · ${r['Mês']}`, text: r['Observações'] })),
          ...feedbacks.filter(f => f.anotacoes).map(f => ({ source: `Feedback · ${f.mes || 'período não informado'}`, text: f.anotacoes })),
          ...evaluations.filter(a => a.observacoes_gerais).map(a => ({ source: `Avaliação de competências · ${a.ciclo || ''}`, text: a.observacoes_gerais }))
        ];
        if (notes.length) area.insertAdjacentHTML('beforeend', `<details><summary>Observações nas fontes existentes</summary>${notes.map(note => `<p><strong>${esc(note.source)}</strong></p><p class="diag-notes">${esc(note.text)}</p>`).join('')}</details>`);
      }
      const entries = [];
      const shown = result.groups.filter(g => person ? g.type === 'person' : true).sort((a, b) => a.type.localeCompare(b.type) || a.level.localeCompare(b.level) || (a.current.score ?? 6) - (b.current.score ?? 6));
      // Mantém os nomes protegidos pelo modo reunião também no diagnóstico.
      area.insertAdjacentHTML('beforeend', shown.map((g, i) => groupHTML({ ...g, name: person ? display(g.name) : g.type === 'person' ? display(g.name) : g.name }, i, entries, result)).join(''));
      if (person && typeof Chart !== 'undefined') {
        const history = [...new Set(shown.flatMap(g => g.history.map(m => m.month)))].sort();
        const canvas = area.querySelector('canvas');
        host._chart = new Chart(canvas, { type: 'line', data: { labels: history, datasets: [...shown.map(g => ({ label: `${g.sector} · ${g.level}`, data: history.map(m => g.history.find(x => x.month === m)?.score ?? null), borderColor: typeof ChartTheme !== 'undefined' ? ChartTheme.indigo() : '#6366f1', spanGaps: false })), { label: 'Meta oficial 4,70', data: history.map(() => 4.7), borderDash: [5, 5], borderColor: typeof ChartTheme !== 'undefined' ? ChartTheme.green() : '#168650', pointRadius: 0 }] }, options: { responsive: true, maintainAspectRatio: false, scales: { y: { min: 0, max: 5 } } } });
      }
      const revisionStore = store();
      const revisionEpoch = Symbol(); host._revisionEpoch = revisionEpoch;
      async function bindReviews() {
        let saved = [];
        const admin = document.body.dataset.role === 'admin';
        if (revisionStore && admin) { try { saved = await revisionStore.load(); } catch (_) { /* sessão não permite revisão */ } }
        for (const element of area.querySelectorAll('[data-entry]')) {
          if (!host.isConnected || host._revisionEpoch !== revisionEpoch) return;
          const entry = entries[Number(element.dataset.entry)];
          // A identidade persistida usa o nome real, independente da exibição por apelido.
          const original = result.groups.find(g => g.type === entry.group.type && g.sector === entry.group.sector && g.level === entry.group.level && g.findings.some(f => f === entry.finding));
          if (original) entry.snapshot.name = original.name;
          const hash = await fingerprint(entry.snapshot);
          if (!host.isConnected || host._revisionEpoch !== revisionEpoch) return;
          const savedReview = saved.find(r => r.fingerprint === hash);
          const select = element.querySelector('select'), note = element.querySelector('textarea'), button = element.querySelector('button'), status = element.querySelector('[role=status]');
          if (savedReview) { select.value = savedReview.status; note.value = savedReview.note; status.textContent = `${savedReview.status} · ${new Date(savedReview.created_at).toLocaleString('pt-BR')}${savedReview.pending ? ' · salvo neste navegador; sincronização pendente' : ''}`; }
          if (!admin || !revisionStore) { select.disabled = true; note.disabled = true; button.disabled = true; status.textContent = admin ? 'Entre com uma sessão válida para salvar revisões.' : 'Revisão disponível apenas para administradores.'; continue; }
          element.dataset.bound = 'true';
          button.addEventListener('click', async () => {
            button.disabled = true;
            try {
              const review = await revisionStore.save({ fingerprint: hash, snapshot: entry.snapshot, status: select.value, note: note.value });
              status.textContent = review.pending ? 'Revisão salva somente neste navegador. Sincronização pendente: aplicar a migração v49 e conferir conexão/permissões.' : 'Revisão salva no banco. A sugestão original e os indicadores históricos foram preservados.';
            } catch (error) { status.textContent = error.message; }
            finally { button.disabled = false; }
          });
        }
      }
      bindReviews().catch(() => { if (host.isConnected) message.textContent += ' Não foi possível carregar as revisões.'; });
    }
    render();
  }
  function extend(name, containerId, kind, personArgument) {
    const base = window[name];
    if (typeof base !== 'function') return;
    window[name] = function (...args) {
      const oldSection = document.getElementById(containerId)?.querySelector('.diag-section');
      oldSection?._chart?.destroy();
      if (oldSection) oldSection._chart = null;
      const result = base.apply(this, args);
      mount(document.getElementById(containerId), kind, personArgument ? args[0] : null);
      return result;
    };
  }
  extend('renderInsights', 'insightsContent', 'insights');
  // O hook antigo fecha sobre sua função interna; esta chamada preserva alertas e adiciona a seção.
  const insightsHook = window.onInsightsTabActivated;
  window.onInsightsTabActivated = function () { insightsHook?.(); mount(document.getElementById('insightsContent'), 'insights'); };
  extend('renderPainelLider', 'painelLiderContent', 'leader');
  extend('renderColabDetail', 'colabDetailContent', 'profile', true);
  extend('openColabDetailOverlay', 'colabDetailContent', 'profile', true);
  window.DiagnosticoUI = { mount, monthsFor };
})();
