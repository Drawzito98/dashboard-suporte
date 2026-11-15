// opa-semanal.js — aba "Operação semanal": importa o zip do Looker, guarda por semana no Supabase
// e mostra o painel com a evolução semana a semana. Depende de opa-semanal-parse.js.
(function () {
  'use strict';
  const P = window.OpaSemanalParse;
  const esc = v => typeof escapeHtml === 'function' ? escapeHtml(String(v ?? '')) :
    String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = n => n == null ? '–' : Number(n).toLocaleString('pt-BR');
  const dec = (n, d = 2) => n == null ? '–' : Number(n).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
  const dur = P.formatDuration;
  const dBR = iso => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
  const dBRfull = iso => `${dBR(iso)}/${iso.slice(0, 4)}`;
  const toast = (msg, kind) => { if (typeof showToast === 'function') showToast(msg, kind || 'info', null, 4000); };
  const MAX_ZIP = 10 * 1024 * 1024, MAX_CSV = 5 * 1024 * 1024;

  const S = { semanas: [], colabs: [], sel: null, nivel: 'all', colabSel: '', preview: null, charts: [], erro: '', carregando: false };
  const root = () => document.getElementById('opaSemanalContent');
  const podeEscrever = () => typeof isAdmin !== 'function' || isAdmin();
  const hasDb = () => typeof sbClient !== 'undefined' && sbClient && typeof _getUserId === 'function';

  // ---------- dados ----------
  async function carregar() {
    S.erro = '';
    if (!hasDb()) { S.erro = 'Banco de dados indisponível neste momento.'; return; }
    const uid = await _getUserId();
    if (!uid) { S.erro = 'Entre na sua conta para ver os dados salvos.'; return; }
    const a = await sbClient.from('opa_semanas').select('*').eq('user_id', uid).order('semana_inicio', { ascending: true });
    if (a.error) throw a.error;
    S.semanas = a.data || [];
    S.colabs = [];
    if (S.semanas.length) {
      const b = await sbClient.from('opa_semana_colabs').select('*').eq('user_id', uid).in('semana_id', S.semanas.map(s => s.id)).limit(5000);
      if (b.error) throw b.error;
      S.colabs = b.data || [];
    }
    if (!S.semanas.some(s => s.id === S.sel)) S.sel = S.semanas.length ? S.semanas[S.semanas.length - 1].id : null;
  }

  async function salvar() {
    const p = S.preview;
    if (!p) return;
    if (!podeEscrever()) return toast('Só administradores podem salvar semanas.', 'error');
    if (!hasDb()) return toast('Banco de dados indisponível.', 'error');
    const btn = document.getElementById('opaSalvar'); if (btn) btn.disabled = true;
    try {
      const uid = await _getUserId();
      const semana = {
        user_id: uid, semana_inicio: p.semanaInicio, periodo_inicio: p.periodoInicio, periodo_fim: p.periodoFim, arquivo: p.arquivo || '',
        kpis: p.kpis, conferencia: p.conferencia, updated_at: new Date().toISOString(),
        blocos: { dias: p.dias, heat: p.heat, deptos: p.deptos, motivos: p.motivos, recorrencia: p.recorrencia, estrelas: p.estrelas, plantao: p.plantao, comparativo: p.comparativo }
      };
      const up = await sbClient.from('opa_semanas').upsert(semana, { onConflict: 'user_id,semana_inicio' }).select('id').single();
      if (up.error) throw up.error;
      const sid = up.data.id;
      const del = await sbClient.from('opa_semana_colabs').delete().eq('semana_id', sid);
      if (del.error) throw del.error;
      const linhas = p.colabsLigados.map(c => ({
        semana_id: sid, user_id: uid, chave: c.chave, nome_looker: c.nome, nome_app: c.nomeApp, nivel: c.nivel,
        assumidos: c.assumidos, finalizados: c.finalizados, transferidos: c.transferidos, clientes: c.clientes,
        media_cliente: c.mediaCliente, media_ia: c.mediaIa, tma_s: c.tma, tmi_s: c.tmi, tmr_s: c.tmr
      }));
      if (linhas.length) { const ins = await sbClient.from('opa_semana_colabs').insert(linhas); if (ins.error) throw ins.error; }
      S.preview = null; S.sel = sid;
      await carregar();
      toast('Semana salva.', 'success');
    } catch (e) {
      console.error('[opa-semanal] salvar', e);
      toast('Não consegui salvar a semana. Tente salvar de novo. ' + (e && e.message ? e.message : ''), 'error');
    }
    render();
  }

  async function excluir() {
    const s = atual(); if (!s || !podeEscrever()) return;
    if (!window.confirm(`Excluir a semana de ${dBRfull(s.periodo_inicio)} a ${dBRfull(s.periodo_fim)}? Isso não pode ser desfeito.`)) return;
    const r = await sbClient.from('opa_semanas').delete().eq('id', s.id);
    if (r.error) return toast('Não consegui excluir a semana.', 'error');
    S.sel = null; await carregar(); toast('Semana excluída.', 'success'); render();
  }

  // ---------- importação ----------
  async function lerArquivos(fileList) {
    const files = {};
    for (const f of Array.from(fileList)) {
      if (/\.zip$/i.test(f.name)) {
        if (typeof JSZip === 'undefined') throw new Error('Leitor de zip não carregou. Recarregue a página.');
        if (f.size > MAX_ZIP) throw new Error('O zip é grande demais (limite de 10 MB).');
        const z = await JSZip.loadAsync(f);
        const entradas = Object.entries(z.files).filter(([n, e]) => !e.dir && /\.csv$/i.test(n));
        if (entradas.length > 200) throw new Error('O zip tem arquivos demais.');
        for (const [n, e] of entradas) {
          const t = await e.async('string');
          if (t.length > MAX_CSV) throw new Error(`O arquivo ${n} é grande demais.`);
          files[n] = t;
        }
      } else if (/\.csv$/i.test(f.name)) {
        if (f.size > MAX_CSV) throw new Error(`O arquivo ${f.name} é grande demais.`);
        files[f.name] = await f.text();
      }
    }
    if (!Object.keys(files).length) throw new Error('Envie o zip da semana (ou os CSVs soltos).');
    return files;
  }

  async function importar(fileList) {
    S.erro = '';
    try {
      const files = await lerArquivos(fileList);
      const p = P.parsePacote(files);
      p.arquivo = Array.from(fileList).map(f => f.name).join(', ').slice(0, 300);
      const info = typeof dbColabInfoLoad === 'function' ? await dbColabInfoLoad() : {};
      p.colabsLigados = P.ligarColaboradores(p.colabs, info);
      p.jaExiste = S.semanas.find(s => s.semana_inicio === p.semanaInicio) || null;
      S.preview = p;
    } catch (e) {
      console.error('[opa-semanal] importar', e);
      S.preview = null; S.erro = e && e.message ? e.message : 'Não consegui ler o arquivo.';
    }
    render();
  }

  // ---------- cálculos ----------
  const atual = () => S.semanas.find(s => s.id === S.sel) || null;
  const anterior = s => { const i = S.semanas.findIndex(x => x.id === s.id); return i > 0 ? S.semanas[i - 1] : null; };
  const colabsDe = s => S.colabs.filter(c => c.semana_id === s.id);
  const nomeC = c => c.nome_app || c.nome_looker;

  // good: 'up' (subir é bom), 'down' (descer é bom), null (neutro). mode: 'pct' variação %, 'pp' diferença em pontos.
  function delta(cur, prev, good, mode) {
    if (cur == null || prev == null) return null;
    const d = mode === 'pp' ? cur - prev : (prev === 0 ? null : (cur - prev) / prev * 100);
    if (d == null) return null;
    const cls = !good || Math.abs(d) < 0.05 ? 'neutro' : ((d > 0) === (good === 'up') ? 'bom' : 'ruim');
    return { txt: `${d > 0 ? '▲' : d < 0 ? '▼' : '='} ${dec(Math.abs(d), 1)}${mode === 'pp' ? ' p.p.' : '%'}`, cls };
  }

  const KPIS = [
    ['Assumidos', 'assumidos', fmt, null], ['Finalizados', 'finalizados', fmt, 'up'], ['Clientes atendidos', 'clientes', fmt, null],
    ['Espera média (TME)', 'tme', dur, 'down'], ['Interação média (TMI)', 'tmi', dur, 'down'], ['Resolução média (TMR)', 'tmr', dur, 'down'],
    ['Nota média do cliente', 'score', v => dec(v, 2), 'up'], ['Encerrados por inatividade', 'inatividadePct', v => v == null ? '–' : dec(v, 0) + '%', 'down', 'pp'],
    ['Recorrência', 'recorrenciaPct', v => v == null ? '–' : dec(v, 2) + '%', 'down', 'pp'], ['SLA do plantão (2h)', 'slaPlantaoPct', v => v == null ? '–' : dec(v, 1) + '%', 'up', 'pp']
  ];

  // ---------- gráficos ----------
  const cssVar = (n, f) => (getComputedStyle(document.documentElement).getPropertyValue(n) || '').trim() || f;
  function limparGraficos() { S.charts.forEach(c => { try { c.destroy(); } catch (e) { /* já destruído */ } }); S.charts = []; }
  function grafico(id, tipo, labels, series, opts = {}) {
    const el = document.getElementById(id);
    if (!el || typeof Chart === 'undefined') return;
    const txt = cssVar('--text-secondary', '#505e60'), grade = cssVar('--border', '#dedbd0');
    const cores = [cssVar('--accent', '#17626d'), cssVar('--warning', '#b45309')];
    S.charts.push(new Chart(el, {
      type: tipo,
      data: { labels, datasets: series.map((s, i) => ({ label: s.nome, data: s.dados, backgroundColor: cores[i], borderColor: cores[i], borderWidth: 2, borderRadius: tipo === 'bar' ? 3 : 0, tension: .25, pointRadius: 3, spanGaps: true })) },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: series.length > 1, labels: { color: txt, boxWidth: 10 } }, tooltip: { callbacks: { label: c => `${c.dataset.label}: ${opts.fmt ? opts.fmt(c.parsed.y) : c.parsed.y}` } } },
        scales: { x: { ticks: { color: txt }, grid: { display: false } }, y: { beginAtZero: opts.zero !== false, ticks: { color: txt, callback: v => opts.fmt ? opts.fmt(v) : v }, grid: { color: grade } } }
      }
    }));
  }

  // ---------- telas ----------
  function htmlImport() {
    const p = S.preview;
    let h = `<div class="opa-card"><h2>Importar semana</h2>
      <p class="opa-note">Envie o zip exportado do Looker (dashboard Opa! Atendimentos). Os dados só são gravados depois que você confirmar.</p>
      <label class="opa-file"><input type="file" id="opaFile" accept=".zip,.csv" multiple ${podeEscrever() ? '' : 'disabled'}><span>Escolher arquivo da semana</span></label>`;
    if (!podeEscrever()) h += `<p class="opa-note">Só administradores podem importar.</p>`;
    if (S.erro) h += `<p class="opa-erro" role="alert">${esc(S.erro)}</p>`;
    if (p) {
      const sem = p.colabsLigados.filter(c => c.ligacao !== 'ok');
      h += `<div class="opa-prev"><h3>Prévia da importação</h3>
        <p><b>Período:</b> ${dBRfull(p.periodoInicio)} a ${dBRfull(p.periodoFim)} · <b>Semana de</b> ${dBRfull(p.semanaInicio)} · ${fmt(p.kpis.assumidos)} assumidos, ${fmt(p.kpis.finalizados)} finalizados, ${p.colabs.length} atendentes.</p>
        ${p.jaExiste ? `<p class="opa-aviso">Essa semana já foi importada. Salvar vai substituir os dados dela.</p>` : ''}
        <ul class="opa-chk">${p.conferencia.map(c => `<li><span class="opa-tag ${c.tipo}">${c.tipo === 'ok' ? 'Confere' : 'Verificar'}</span><span><b>${esc(c.titulo)}.</b> ${esc(c.texto)}</span></li>`).join('')}</ul>
        <h3>Atendentes ligados ao cadastro (primeiro nome)</h3>
        <div class="opa-tw"><table><thead><tr><th>No Looker</th><th>No cadastro do app</th><th>Nível</th><th>Situação</th></tr></thead><tbody>${p.colabsLigados.map(c =>
          `<tr><td>${esc(c.nome)}</td><td>${esc(c.nomeApp || '–')}</td><td>${esc(c.nivel || '–')}</td><td>${c.ligacao === 'ok' ? 'Ligado' : c.ligacao === 'ambigua' ? 'Mais de um cadastro com esse primeiro nome' : 'Sem cadastro'}</td></tr>`).join('')}</tbody></table></div>
        ${sem.length ? `<p class="opa-aviso">${sem.length} atendente(s) sem ligação. Eles entram nos totais, mas ficam sem nível. Confira o cadastro na aba Equipe.</p>` : ''}
        <div class="opa-acoes"><button class="btn-primary" id="opaSalvar" type="button" ${podeEscrever() ? '' : 'disabled'}>${p.jaExiste ? 'Substituir semana' : 'Salvar semana'}</button><button class="btn-small" data-act="cancelar" type="button">Cancelar</button></div></div>`;
    }
    return h + `</div>`;
  }

  function htmlPainel() {
    const s = atual();
    if (!s) return `<div class="opa-card"><h2>Nenhuma semana salva</h2><p class="opa-note">Importe o primeiro zip acima para ver o painel e começar o histórico.</p></div>`;
    const ant = anterior(s), k = s.kpis || {}, ka = ant ? (ant.kpis || {}) : {}, b = s.blocos || {};
    const lista = colabsDe(s), listaAnt = ant ? colabsDe(ant) : [];
    const niveis = [...new Set(lista.map(c => c.nivel).filter(Boolean))].sort();
    const equipe = lista.filter(c => S.nivel === 'all' || c.nivel === S.nivel).sort((a, c) => c.finalizados - a.finalizados);
    let h = `<div class="opa-card opa-head"><div><h2>Semana de ${dBRfull(s.periodo_inicio)} a ${dBRfull(s.periodo_fim)}</h2>
      <p class="opa-note">${ant ? `Comparado com a semana de ${dBRfull(ant.periodo_inicio)} a ${dBRfull(ant.periodo_fim)}.` : 'Primeira semana salva: ainda não há comparação.'}</p></div>
      <div class="opa-acoes"><label class="opa-sel">Semana <select id="opaSemanaSel">${[...S.semanas].reverse().map(x => `<option value="${esc(x.id)}" ${x.id === s.id ? 'selected' : ''}>${dBR(x.periodo_inicio)} a ${dBR(x.periodo_fim)}/${x.periodo_fim.slice(0, 4)}</option>`).join('')}</select></label>
      ${podeEscrever() ? `<button class="btn-small" data-act="excluir" type="button">Excluir semana</button>` : ''}</div></div>`;

    h += `<div class="opa-kpis">${KPIS.map(([nome, chave, f, good, modo]) => {
      const d = ant ? delta(k[chave], ka[chave], good, modo || 'pct') : null;
      return `<div class="opa-kpi"><div class="l">${nome}</div><div class="v">${f(k[chave])}</div><div class="d ${d ? d.cls : ''}">${d ? d.txt + ' vs. semana anterior' : '&nbsp;'}</div></div>`;
    }).join('')}</div>`;

    h += `<div class="opa-grid"><div class="opa-card"><h2>Assumidos e finalizados por dia</h2><div class="opa-chart"><canvas id="opaDias"></canvas></div></div>
      <div class="opa-card"><h2>Quando os atendimentos são assumidos</h2>${htmlHeat(b.heat)}</div></div>`;

    h += `<div class="opa-card"><h2>Evolução semanal</h2>${S.semanas.length < 2 ? `<p class="opa-note">O histórico aparece a partir da segunda semana importada.</p>` :
      `<div class="opa-grid3"><div><h3>Finalizados</h3><div class="opa-chart sm"><canvas id="opaEvF"></canvas></div></div><div><h3>Nota média do cliente</h3><div class="opa-chart sm"><canvas id="opaEvN"></canvas></div></div><div><h3>Espera média (min)</h3><div class="opa-chart sm"><canvas id="opaEvT"></canvas></div></div></div>`}</div>`;

    h += `<div class="opa-card"><h2>Departamentos</h2><div class="opa-tw"><table><thead><tr><th>Departamento</th><th>Assumidos</th><th>Finalizados</th><th>Transferidos</th><th>Avaliados</th><th>Nota</th><th>Encerr. inatividade</th><th>TMR</th></tr></thead><tbody>${(b.deptos || []).map(d =>
      `<tr><td>${esc(String(d.nome).replace(/^(SUP|INT) - /, '').replace(/ - IXC Provedor/, ''))}</td><td>${fmt(d.assumidos)}</td><td>${fmt(d.finalizados)}</td><td>${fmt(d.transferidos)}</td><td>${fmt(d.avaliados)}</td><td>${dec(d.score)}</td><td>${fmt(d.encInatividade)}</td><td>${dur(d.tmr)}</td></tr>`).join('')}</tbody></table></div></div>`;

    h += `<div class="opa-card"><div class="opa-head"><div><h2>Equipe</h2><p class="opa-note">Variação de finalizados em relação à semana anterior, por atendente.</p></div>
      <label class="opa-sel">Nível <select id="opaNivelSel"><option value="all">Todos</option>${niveis.map(n => `<option ${n === S.nivel ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label></div>
      <div class="opa-tw"><table><thead><tr><th>Atendente</th><th>Nível</th><th>Assumidos</th><th>Finalizados</th><th>vs. anterior</th><th>Clientes</th><th>Média cliente</th><th>Média IA</th><th>TMI</th><th>TMR</th></tr></thead><tbody>${equipe.map(c => {
        const pa = listaAnt.find(x => x.chave === c.chave), d = pa ? delta(c.finalizados, pa.finalizados, 'up', 'pct') : null;
        return `<tr><td>${esc(nomeC(c))}</td><td>${esc(c.nivel || '–')}</td><td>${fmt(c.assumidos)}</td><td>${fmt(c.finalizados)}</td><td class="${d ? d.cls : ''}">${d ? d.txt : '–'}</td><td>${fmt(c.clientes)}</td><td>${dec(c.media_cliente)}</td><td>${dec(c.media_ia)}</td><td>${dur(c.tmi_s)}</td><td>${dur(c.tmr_s)}</td></tr>`;
      }).join('')}</tbody></table></div></div>`;

    const chaves = [...new Map(S.colabs.map(c => [c.chave, nomeC(c)])).entries()].sort((a, c) => a[1].localeCompare(c[1], 'pt-BR'));
    h += `<div class="opa-card"><div class="opa-head"><div><h2>Evolução por atendente</h2><p class="opa-note">Escolha uma pessoa para ver finalizados e nota do cliente semana a semana.</p></div>
      <label class="opa-sel">Atendente <select id="opaColabSel"><option value="">Selecione</option>${chaves.map(([ch, n]) => `<option value="${esc(ch)}" ${ch === S.colabSel ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label></div>
      ${S.colabSel ? `<div class="opa-grid"><div><h3>Finalizados</h3><div class="opa-chart sm"><canvas id="opaPF"></canvas></div></div><div><h3>Média do cliente</h3><div class="opa-chart sm"><canvas id="opaPN"></canvas></div></div></div>` : ''}</div>`;

    const motivos = (b.motivos || []).slice(0, 10), mx = motivos.length ? motivos[0].finalizados : 1;
    h += `<div class="opa-grid"><div class="opa-card"><h2>Principais motivos</h2><div class="opa-bars">${motivos.map(m =>
      `<div class="opa-bar"><span>${esc(String(m.nome).replace(/ > /g, ' › '))}</span><span class="t"><b style="width:${Math.round(m.finalizados / mx * 100)}%"></b></span><em>${fmt(m.finalizados)}</em></div>`).join('')}</div></div>
      <div class="opa-card"><h2>Avaliação e plantão</h2><div class="opa-mini"><div><div class="v">${fmt(k.avaliados)}</div><div class="l">avaliados de ${fmt((k.avaliados || 0) + (k.naoAvaliados || 0))}</div></div>
      <div><div class="v">${fmt((b.plantao || {}).diurno)} / ${fmt((b.plantao || {}).noturno)}</div><div class="l">plantão diurno / noturno</div></div></div>
      <div class="opa-bars">${(b.estrelas || []).map(e => `<div class="opa-bar"><span>${e.estrelas} estrelas</span><span class="t"><b style="width:${Math.round(e.quantidade / Math.max(1, ...b.estrelas.map(x => x.quantidade)) * 100)}%"></b></span><em>${fmt(e.quantidade)}</em></div>`).join('')}</div></div></div>`;

    h += `<div class="opa-card"><h2>Conferência dos números</h2><ul class="opa-chk">${(s.conferencia || []).map(c => `<li><span class="opa-tag ${c.tipo}">${c.tipo === 'ok' ? 'Confere' : 'Verificar'}</span><span><b>${esc(c.titulo)}.</b> ${esc(c.texto)}</span></li>`).join('')}</ul></div>`;
    return h;
  }

  function htmlHeat(heat) {
    if (!heat || !heat.linhas || !heat.linhas.length) return '<p class="opa-note">Sem dados de horário.</p>';
    const vals = heat.linhas.flatMap(l => l.valores).filter(v => v != null), mx = Math.max(1, ...vals);
    return `<div class="opa-heat" style="grid-template-columns:64px repeat(${heat.dias.length},1fr)"><div></div>${heat.dias.map(d => `<div class="h">${esc(d)}</div>`).join('')}${heat.linhas.map(l =>
      `<div class="r">${esc(l.hora)}</div>${l.valores.map((v, i) => v == null ? '<div class="vazio">·</div>' :
        `<div title="${esc(heat.dias[i])} ${esc(l.hora)}: ${v}" style="background:color-mix(in srgb,var(--accent) ${Math.round(8 + v / mx * 82)}%,var(--bg-surface));color:${8 + v / mx * 82 > 52 ? '#fff' : 'inherit'}">${v}</div>`).join('')}`).join('')}</div>`;
  }

  function desenharGraficos() {
    limparGraficos();
    const s = atual(); if (!s) return;
    const b = s.blocos || {};
    grafico('opaDias', 'bar', (b.dias || []).map(d => dBR(d.data)), [{ nome: 'Assumidos', dados: (b.dias || []).map(d => d.assumidos) }, { nome: 'Finalizados', dados: (b.dias || []).map(d => d.finalizados) }]);
    if (S.semanas.length > 1) {
      const lab = S.semanas.map(x => dBR(x.periodo_inicio));
      grafico('opaEvF', 'line', lab, [{ nome: 'Finalizados', dados: S.semanas.map(x => x.kpis.finalizados) }]);
      grafico('opaEvN', 'line', lab, [{ nome: 'Nota', dados: S.semanas.map(x => x.kpis.score) }], { zero: false, fmt: v => dec(v, 2) });
      grafico('opaEvT', 'line', lab, [{ nome: 'TME (min)', dados: S.semanas.map(x => x.kpis.tme == null ? null : Math.round(x.kpis.tme / 6) / 10) }], { fmt: v => dec(v, 1) });
    }
    if (S.colabSel) {
      const pts = S.semanas.map(x => ({ x, c: S.colabs.find(c => c.semana_id === x.id && c.chave === S.colabSel) }));
      const lab = pts.map(p => dBR(p.x.periodo_inicio));
      grafico('opaPF', 'line', lab, [{ nome: 'Finalizados', dados: pts.map(p => p.c ? p.c.finalizados : null) }]);
      grafico('opaPN', 'line', lab, [{ nome: 'Média do cliente', dados: pts.map(p => p.c && p.c.media_cliente != null ? Number(p.c.media_cliente) : null) }], { zero: false, fmt: v => dec(v, 2) });
    }
  }

  function render() {
    const el = root(); if (!el) return;
    el.innerHTML = (S.carregando ? '<p class="opa-note">Carregando…</p>' : '') + htmlImport() + htmlPainel();
    desenharGraficos();
  }

  // ---------- eventos ----------
  function ligar() {
    const el = root(); if (!el || el.dataset.opaLigado) return;
    el.dataset.opaLigado = '1';
    el.addEventListener('change', e => {
      const t = e.target;
      if (t.id === 'opaFile' && t.files && t.files.length) importar(t.files);
      else if (t.id === 'opaSemanaSel') { S.sel = t.value; render(); }
      else if (t.id === 'opaNivelSel') { S.nivel = t.value; render(); }
      else if (t.id === 'opaColabSel') { S.colabSel = t.value; render(); }
    });
    el.addEventListener('click', e => {
      if (e.target.id === 'opaSalvar') return void salvar();
      const act = e.target.closest('[data-act]');
      if (!act) return;
      if (act.dataset.act === 'cancelar') { S.preview = null; S.erro = ''; render(); }
      else if (act.dataset.act === 'excluir') excluir();
    });
  }

  window.onOpaSemanalTabActivated = async function () {
    ligar();
    S.carregando = true; render();
    try { await carregar(); } catch (e) { console.error('[opa-semanal] carregar', e); S.erro = 'Não consegui carregar as semanas salvas. Se a migração v50 ainda não foi aplicada no Supabase, aplique e tente de novo.'; }
    S.carregando = false; render();
  };
})();
