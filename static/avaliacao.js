// avaliacao.js — Avaliação de Desempenho (14 competências, escala 1-4, ciclos de 4 meses)
// Gestor avalia colaboradores. Persistência: localStorage + Supabase.

const AVALIACAO_KEY = 'sistema_avaliacoes_v1';

const COMPETENCIAS = [
  { id: 1, nome: 'Atenção aos detalhes', oqObservar: 'Entregas bem estruturadas, sem erros ou inconsistências. Validação das informações antes da entrega final. Cuidado com clareza e padronização dos materiais. Preocupação com o impacto de pequenos detalhes no resultado final.', altoDesempenho: 'Garante entregas confiáveis e consistentes, reduzindo retrabalho.' },
  { id: 2, nome: 'Agilidade', oqObservar: 'Cumprimento de prazos acordados. Capacidade de priorizar atividades com maior impacto. Rapidez na resposta a solicitações e mudanças de contexto. Adaptação a diferentes ritmos e demandas.', altoDesempenho: 'Mantém ritmo constante e entrega resultados dentro dos prazos definidos.' },
  { id: 3, nome: 'Disciplina', oqObservar: 'Cumprimento de rotinas e compromissos. Organização pessoal e constância nas entregas. Respeito a prazos, reuniões e alinhamentos. Responsabilidade com o próprio trabalho e impacto coletivo.', altoDesempenho: 'Transmite confiança por sua previsibilidade e comprometimento.' },
  { id: 4, nome: 'Capacidade de aprendizagem', oqObservar: 'Rapidez para compreender novos temas ou processos. Aplicação prática de feedbacks e aprendizados. Curiosidade intelectual e busca por entender causas e efeitos. Evolução perceptível de conhecimento e performance ao longo do tempo.', altoDesempenho: 'Transforma aprendizado em melhoria contínua das entregas.' },
  { id: 5, nome: 'Organização e planejamento', oqObservar: 'Clareza na definição e comunicação das prioridades. Planejamento de tarefas com base em metas e prazos. Boa gestão de tempo e acompanhamento de progresso. Capacidade de antecipar riscos e gargalos.', altoDesempenho: 'Assegura previsibilidade e fluxo de trabalho eficiente.' },
  { id: 6, nome: 'Conhecimento do processo', oqObservar: 'Entendimento do processo de ponta a ponta. Clareza sobre as dependências entre áreas e responsabilidades. Consciência de como o trabalho individual impacta o resultado coletivo. Capacidade de contextualizar decisões dentro do todo.', altoDesempenho: 'Atua com visão sistêmica e integrada.' },
  { id: 7, nome: 'Resolução de problemas', oqObservar: 'Capacidade analítica para identificar causas e efeitos. Agilidade em propor e implementar soluções. Colaboração com as pessoas certas para resolver impasses. Foco em evitar recorrência dos mesmos problemas.', altoDesempenho: 'Demonstra autonomia e pensamento lógico diante de obstáculos.' },
  { id: 8, nome: 'Foco em resultado', oqObservar: 'Clareza sobre metas e indicadores de sucesso. Priorização de atividades que geram maior valor. Entregas consistentes dentro dos prazos e padrões esperados. Postura orientada a impacto e eficiência.', altoDesempenho: 'Atua com propósito e direcionamento claro para resultados.' },
  { id: 9, nome: 'Controle emocional', oqObservar: 'Reações equilibradas sob pressão ou conflito. Recebimento de feedbacks de forma madura. Capacidade de manter foco mesmo em contextos adversos. Autocontrole diante de prazos ou mudanças de prioridade.', altoDesempenho: 'Transmite confiança e segurança mesmo em cenários desafiadores.' },
  { id: 10, nome: 'Melhoria contínua', oqObservar: 'Interesse em otimizar processos e rotinas. Iniciativa para implementar aprendizados e feedbacks. Busca por referências, benchmarks e boas práticas. Evolução percebida entre ciclos de avaliação.', altoDesempenho: 'Transforma experiências em aprendizados e avanços concretos.' },
  { id: 11, nome: 'Interesse e iniciativa', oqObservar: 'Identificação espontânea de oportunidades de melhoria. Ações proativas para resolver ou aprimorar processos. Curiosidade sobre o negócio e o produto. Engajamento acima das atribuições básicas.', altoDesempenho: 'Atua com senso de dono e protagonismo.' },
  { id: 12, nome: 'Comunicação', oqObservar: 'Clareza e estrutura na comunicação verbal e escrita. Adaptação da linguagem conforme o interlocutor. Transparência na troca de informações e alinhamentos. Capacidade de ouvir e validar o entendimento do outro.', altoDesempenho: 'Garante entendimento e favorece decisões assertivas.' },
  { id: 13, nome: 'Trabalho em equipe', oqObservar: 'Postura colaborativa e disposição em ajudar. Compartilhamento de informações e aprendizados. Respeito às opiniões e contribuições dos colegas. Participação equilibrada em discussões e decisões.', altoDesempenho: 'Eleva o desempenho coletivo por meio da cooperação.' },
  { id: 14, nome: 'Relacionamento interpessoal', oqObservar: 'Cordialidade e respeito nas interações. Capacidade de lidar com diferentes perfis e situações. Influência positiva no ambiente de trabalho. Disposição para ouvir e entender perspectivas diversas.', altoDesempenho: 'Contribui para um ambiente saudável e de confiança mútua.' }
];

const NOTAS = [
  { valor: 1, label: '1 — Não alcança o esperado' },
  { valor: 2, label: '2 — Alcança parcialmente o esperado' },
  { valor: 3, label: '3 — Alcança plenamente o esperado' },
  { valor: 4, label: '4 — Supera o esperado' }
];

function sugerirCiclo() {
  const agora = new Date();
  const mes = agora.getMonth() + 1;
  const ano = agora.getFullYear();
  if (mes >= 1 && mes <= 4) return `Jan-Abr ${ano}`;
  if (mes >= 5 && mes <= 8) return `Mai-Ago ${ano}`;
  return `Set-Dez ${ano}`;
}

function getAvaliacoesLocal() {
  try {
    return JSON.parse(localStorage.getItem(AVALIACAO_KEY) || '[]');
  } catch { return []; }
}

function saveAvaliacoesLocal(list) {
  localStorage.setItem(AVALIACAO_KEY, JSON.stringify(list));
}

async function dbAvaliacoesLoad() {
  if (!sbClient) return getAvaliacoesLocal();
  try {
    const uid = await _getUserId();
    if (!uid) return getAvaliacoesLocal();
    const { data } = await sbClient.from('avaliacoes').select('*').eq('user_id', uid).order('created_at', { ascending: false });
    if (data && Array.isArray(data) && data.length > 0) {
      const list = data.map(r => ({
        id: r.id,
        colaborador: r.colaborador,
        ciclo: r.ciclo,
        scores: r.scores,
        observacoes_gerais: r.observacoes_gerais || '',
        observacoes_competencias: r.observacoes_competencias || {},
        createdAt: r.created_at,
        updatedAt: r.updated_at
      }));
      saveAvaliacoesLocal(list);
      return list;
    }
    return getAvaliacoesLocal();
  } catch {
    return getAvaliacoesLocal();
  }
}

async function dbAvaliacaoSave(avaliacao) {
  if (!requireAdmin()) return;
  const list = getAvaliacoesLocal();
  const idx = list.findIndex(a => a.id === avaliacao.id);
  if (idx >= 0) list[idx] = avaliacao;
  else list.unshift(avaliacao);
  saveAvaliacoesLocal(list);
  if (!sbClient) return;
  try {
    const uid = await _getUserId();
    if (!uid) return;
    const existing = await sbClient.from('avaliacoes').select('id').eq('id', avaliacao.id).maybeSingle();
    if (existing?.data?.id) {
      await sbClient.from('avaliacoes').update({
        colaborador: avaliacao.colaborador,
        ciclo: avaliacao.ciclo,
        scores: avaliacao.scores,
        observacoes_gerais: avaliacao.observacoes_gerais || '',
        observacoes_competencias: avaliacao.observacoes_competencias || {},
        updated_at: new Date().toISOString()
      }).eq('id', avaliacao.id);
    } else {
      await sbClient.from('avaliacoes').insert({
        user_id: uid,
        colaborador: avaliacao.colaborador,
        ciclo: avaliacao.ciclo,
        scores: avaliacao.scores,
        observacoes_gerais: avaliacao.observacoes_gerais || '',
        observacoes_competencias: avaliacao.observacoes_competencias || {}
      }).then(result => {
        if (result.data && result.data[0]) {
          avaliacao.id = result.data[0].id;
        }
      });
    }
  } catch {}
}

async function dbAvaliacaoDelete(id) {
  if (!requireAdmin()) return;
  const list = getAvaliacoesLocal();
  const filtered = list.filter(a => a.id !== id);
  saveAvaliacoesLocal(filtered);
  if (!sbClient) return;
  try {
    await sbClient.from('avaliacoes').delete().eq('id', id);
  } catch {}
}

function renderAvaliacao() {
  const container = document.getElementById('avaliacaoContent');
  if (!container) return;

  const avaliacoes = getAvaliacoesLocal();
  const colabs = [...new Set((rawRecords || []).filter(r => r && r['Atendente'] && !isAggregateName(r['Atendente']) && isColabActive(r['Atendente'])).map(r => r['Atendente']))].sort();
  const ciclosExistentes = [...new Set(avaliacoes.map(a => a.ciclo).filter(Boolean))].sort();

  let html = `
    <div class="avaliacao-layout">
      <div class="avaliacao-form-card">
        <div class="card-header">
          <div>
            <h2>📋 Avaliação de Desempenho</h2>
            <p>Avalie um colaborador nas 14 competências</p>
          </div>
        </div>
        <div class="avaliacao-form-controls">
          <label class="field">
            <span>Colaborador</span>
            <select id="avaliacaoColabSelect">
              <option value="">Selecione...</option>
              ${colabs.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('')}
            </select>
          </label>
          <label class="field">
            <span>Ciclo</span>
            <input type="text" id="avaliacaoCicloInput" value="${escapeHtml(sugerirCiclo())}" placeholder="Ex: Jul-Out 2026" list="avaliacaoCiclosSugeridos"/>
            <datalist id="avaliacaoCiclosSugeridos">
              ${ciclosExistentes.map(c => `<option value="${escapeHtml(c)}">`).join('')}
            </datalist>
          </label>
          <div style="display:flex;gap:var(--s-2);margin-top:var(--s-2)">
            <button class="btn-primary" id="avaliacaoCarregarBtn" type="button" disabled>📋 Carregar avaliação</button>
            <button class="btn-small" id="avaliacaoNovaBtn" type="button">➕ Nova avaliação</button>
          </div>
        </div>
      </div>

      <div id="avaliacaoFormContainer"></div>

      <div class="avaliacao-historico-card">
        <div class="card-header">
          <div>
            <h2>📊 Histórico de Avaliações</h2>
            <p>Visualize avaliações salvas por colaborador e ciclo</p>
          </div>
        </div>
        <div class="avaliacao-historico-controls">
          <label class="field">
            <span>Filtrar por colaborador</span>
            <select id="avaliacaoHistSelect">
              <option value="">Todos</option>
              ${colabs.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('')}
            </select>
          </label>
        </div>
        <div id="avaliacaoHistoricoLista"></div>
      </div>
    </div>
  `;

  container.innerHTML = html;

  document.getElementById('avaliacaoColabSelect').addEventListener('change', () => {
    document.getElementById('avaliacaoCarregarBtn').disabled = !document.getElementById('avaliacaoColabSelect').value;
  });

  document.getElementById('avaliacaoNovaBtn').addEventListener('click', () => {
    const colab = document.getElementById('avaliacaoColabSelect').value;
    const ciclo = document.getElementById('avaliacaoCicloInput').value.trim();
    if (!colab) { showToast('Selecione um colaborador.', 'error'); return; }
    if (!ciclo) { showToast('Informe o ciclo.', 'error'); return; }
    renderAvaliacaoForm(colab, ciclo, null);
  });

  document.getElementById('avaliacaoCarregarBtn').addEventListener('click', () => {
    const colab = document.getElementById('avaliacaoColabSelect').value;
    const ciclo = document.getElementById('avaliacaoCicloInput').value.trim();
    if (!colab) { showToast('Selecione um colaborador.', 'error'); return; }
    if (!ciclo) { showToast('Informe o ciclo.', 'error'); return; }
    const existing = avaliacoes.find(a => a.colaborador === colab && a.ciclo === ciclo);
    if (existing) {
      renderAvaliacaoForm(colab, ciclo, existing);
    } else {
      showToast('Nenhuma avaliação encontrada para este colaborador no ciclo selecionado.', 'info');
      renderAvaliacaoForm(colab, ciclo, null);
    }
  });

  document.getElementById('avaliacaoHistSelect').addEventListener('change', () => {
    renderHistoricoAvaliacoes();
  });

  renderHistoricoAvaliacoes();
}

function renderAvaliacaoForm(colaborador, ciclo, existing) {
  const container = document.getElementById('avaliacaoFormContainer');
  if (!container) return;

  const scores = existing ? existing.scores : {};
  const obsGerais = existing ? (existing.observacoes_gerais || '') : '';
  const obsComp = existing ? (existing.observacoes_competencias || {}) : {};
  const isEdit = !!existing;

  let html = `
    <div class="card avaliacao-form-card avaliacao-form-expanded">
      <div class="card-header">
        <div>
          <h2>${isEdit ? '✏️' : '➕'} ${isEdit ? 'Editar' : 'Nova'} Avaliação</h2>
          <p><strong>${escapeHtml(colaborador)}</strong> — Ciclo <strong>${escapeHtml(ciclo)}</strong></p>
        </div>
        ${isEdit ? `<div style="font-size:12px;color:var(--text-muted)">Última atualização: ${existing.updatedAt ? new Date(existing.updatedAt).toLocaleString('pt-BR') : '—'}</div>` : ''}
      </div>
      <form id="avaliacaoForm" class="avaliacao-form" data-colaborador="${escapeHtml(colaborador)}" data-ciclo="${escapeHtml(ciclo)}" data-id="${isEdit ? existing.id : ''}">
        ${COMPETENCIAS.map(comp => {
          const val = scores[comp.id] || '';
          const obs = obsComp[comp.id] || '';
          return `
            <div class="avaliacao-questao" data-comp-id="${comp.id}">
              <div class="avaliacao-questao-header">
                <span class="avaliacao-questao-num">${comp.id}.</span>
                <div>
                  <strong>${escapeHtml(comp.nome)}</strong>
                  <div class="avaliacao-questao-dica" title="${escapeHtml(comp.oqObservar)}">
                    <span class="avaliacao-oq-info">ⓘ <span class="avaliacao-oq-text">${escapeHtml(comp.oqObservar)}</span></span>
                    <span class="avaliacao-alto-info">★ ${escapeHtml(comp.altoDesempenho)}</span>
                  </div>
                </div>
              </div>
              <div class="avaliacao-questao-inputs">
                <div class="avaliacao-notas">
                  ${NOTAS.map(n => `
                    <label class="avaliacao-nota-label ${Number(val) === n.valor ? 'selected' : ''}">
                      <input type="radio" name="score_${comp.id}" value="${n.valor}" ${Number(val) === n.valor ? 'checked' : ''} class="avaliacao-nota-radio"/>
                      <span>${n.valor}</span>
                    </label>
                  `).join('')}
                </div>
                <div class="avaliacao-obs-competencia">
                  <input type="text" class="avaliacao-obs-input" name="obs_${comp.id}" value="${escapeHtml(obs)}" placeholder="Observação específica (opcional)" maxlength="200"/>
                </div>
              </div>
            </div>
          `;
        }).join('')}

        <div class="avaliacao-geral">
          <label class="field">
            <span>Observações gerais</span>
            <textarea id="avaliacaoObsGerais" rows="4" placeholder="Resumo geral, pontos fortes, pontos de melhoria...">${escapeHtml(obsGerais)}</textarea>
          </label>
        </div>

        <div class="avaliacao-form-actions">
          <button class="btn-primary" type="submit">💾 Salvar avaliação</button>
          <button class="btn-small" type="button" id="avaliacaoCancelarBtn">Cancelar</button>
        </div>
      </form>
    </div>
  `;

  container.innerHTML = html;

  document.getElementById('avaliacaoForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!requireAdmin()) return;
    const form = e.target;
    const colab = form.dataset.colaborador;
    const cicloForm = form.dataset.ciclo;
    const existingId = form.dataset.id;

    const scores = {};
    const observacoes_competencias = {};
    let hasScore = false;

    COMPETENCIAS.forEach(comp => {
      const radio = form.querySelector(`input[name="score_${comp.id}"]:checked`);
      if (radio) {
        scores[comp.id] = parseInt(radio.value);
        hasScore = true;
      } else {
        scores[comp.id] = null;
      }
      const obsInput = form.querySelector(`input[name="obs_${comp.id}"]`);
      if (obsInput && obsInput.value.trim()) {
        observacoes_competencias[comp.id] = obsInput.value.trim();
      }
    });

    if (!hasScore) {
      showToast('Selecione pelo menos uma nota.', 'error');
      return;
    }

    const observacoes_gerais = document.getElementById('avaliacaoObsGerais').value.trim();

    const avaliacaoData = {
      id: existingId || 'new_' + Date.now(),
      colaborador: colab,
      ciclo: cicloForm,
      scores,
      observacoes_gerais,
      observacoes_competencias,
      updatedAt: new Date().toISOString()
    };

    if (!existingId) {
      avaliacaoData.createdAt = new Date().toISOString();
    }

    await dbAvaliacaoSave(avaliacaoData);
    showToast(`Avaliação de ${escapeHtml(colab)} salva com sucesso!`, 'success', 'Avaliação');
    renderAvaliacao();
  });

  document.getElementById('avaliacaoCancelarBtn').addEventListener('click', () => {
    container.innerHTML = '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  container.querySelectorAll('.avaliacao-nota-radio').forEach(radio => {
    radio.addEventListener('change', () => {
      const questao = radio.closest('.avaliacao-questao');
      questao.querySelectorAll('.avaliacao-nota-label').forEach(l => l.classList.remove('selected'));
      radio.closest('.avaliacao-nota-label').classList.add('selected');
    });
  });
}

function renderHistoricoAvaliacoes() {
  const container = document.getElementById('avaliacaoHistoricoLista');
  if (!container) return;

  const filtroColab = document.getElementById('avaliacaoHistSelect')?.value || '';
  const avaliacoes = getAvaliacoesLocal();
  let filtered = avaliacoes;
  if (filtroColab) filtered = filtered.filter(a => a.colaborador === filtroColab);

  if (!filtered.length) {
    container.innerHTML = '<div class="empty-state" style="border:none"><div class="empty-title">Nenhuma avaliação encontrada</div><div class="empty-sub">As avaliações salvas aparecerão aqui.</div></div>';
    return;
  }

  let html = '<div class="avaliacao-historico-grid">';
  filtered.forEach(av => {
    const scoresArray = COMPETENCIAS.map(c => av.scores[c.id]).filter(v => v !== null && v !== undefined);
    const media = scoresArray.length ? (scoresArray.reduce((a, b) => a + b, 0) / scoresArray.length).toFixed(2) : '—';
    const total = scoresArray.reduce((a, b) => a + b, 0);
    const corMedia = media !== '—' ? (media >= 3 ? 'var(--success)' : media >= 2 ? 'var(--warning)' : 'var(--danger)') : 'var(--text-muted)';

    html += `
      <div class="avaliacao-historico-item">
        <div class="avaliacao-historico-header">
          <strong>${escapeHtml(av.colaborador)}</strong>
          <span class="avaliacao-historico-ciclo">${escapeHtml(av.ciclo)}</span>
        </div>
        <div class="avaliacao-historico-stats">
          <span>Notas: <strong>${scoresArray.length}/${COMPETENCIAS.length}</strong></span>
          <span>Total: <strong>${total}</strong></span>
          <span>Média: <strong style="color:${corMedia}">${media}</strong></span>
        </div>
        <div class="avaliacao-historico-mini-radar" data-colab="${escapeHtml(av.colaborador)}" data-ciclo="${escapeHtml(av.ciclo)}"></div>
        <div class="avaliacao-historico-actions">
          <button class="btn-small avaliacao-ver-btn" data-colab="${escapeHtml(av.colaborador)}" data-ciclo="${escapeHtml(av.ciclo)}" type="button">👁️ Ver</button>
          <button class="btn-small avaliacao-editar-btn" data-colab="${escapeHtml(av.colaborador)}" data-ciclo="${escapeHtml(av.ciclo)}" type="button">✏️ Editar</button>
          <button class="btn-small avaliacao-excluir-btn" data-id="${av.id}" type="button" style="color:var(--danger)">🗑️</button>
        </div>
      </div>
    `;
  });
  html += '</div>';
  container.innerHTML = html;

  container.querySelectorAll('.avaliacao-ver-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const colab = btn.dataset.colab;
      const ciclo = btn.dataset.ciclo;
      mostrarDetalheAvaliacao(colab, ciclo);
    });
  });

  container.querySelectorAll('.avaliacao-editar-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const colab = btn.dataset.colab;
      const ciclo = btn.dataset.ciclo;
      const existing = getAvaliacoesLocal().find(a => a.colaborador === colab && a.ciclo === ciclo);
      if (existing) renderAvaliacaoForm(colab, ciclo, existing);
    });
  });

  container.querySelectorAll('.avaliacao-excluir-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!requireAdmin()) return;
      if (!confirm('Tem certeza que deseja excluir esta avaliação?')) return;
      await dbAvaliacaoDelete(btn.dataset.id);
      showToast('Avaliação excluída.', 'success');
      renderAvaliacao();
    });
  });

  renderMiniRadars(filtered);
}

function renderMiniRadars(avaliacoes) {
  avaliacoes.forEach(av => {
    const container = document.querySelector(`.avaliacao-historico-mini-radar[data-colab="${CSS.escape(av.colaborador)}"][data-ciclo="${CSS.escape(av.ciclo)}"]`);
    if (!container) return;
    const scores = COMPETENCIAS.map(c => {
      const v = av.scores[c.id];
      return (v !== null && v !== undefined) ? v : null;
    });
    const hasData = scores.some(s => s !== null);
    if (!hasData) { container.innerHTML = '<span style="font-size:11px;color:var(--text-muted)">Sem dados</span>'; return; }

    const w = 80, h = 80, cx = w / 2, cy = h / 2, r = 30;
    const angleStep = (2 * Math.PI) / COMPETENCIAS.length;
    const offset = -Math.PI / 2;

    let points = '';
    let gridLines = '';
    for (let i = 0; i < COMPETENCIAS.length; i++) {
      const v = scores[i];
      const val = (v !== null && v !== undefined) ? v / 4 : 0;
      const angle = offset + i * angleStep;
      const x = cx + r * val * Math.cos(angle);
      const y = cy + r * val * Math.sin(angle);
      points += `${x.toFixed(1)},${y.toFixed(1)} `;

      const gx = cx + r * Math.cos(angle);
      const gy = cy + r * Math.sin(angle);
      gridLines += `<line x1="${cx}" y1="${cy}" x2="${gx.toFixed(1)}" y2="${gy.toFixed(1)}" stroke="var(--border)" stroke-width="0.5"/>`;
    }

    container.innerHTML = `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--border)" stroke-width="0.5"/>
      <circle cx="${cx}" cy="${cy}" r="${r * 0.5}" fill="none" stroke="var(--border)" stroke-width="0.5" stroke-dasharray="2,2"/>
      ${gridLines}
      <polygon fill="rgba(37,99,235,0.15)" stroke="var(--accent)" stroke-width="1.2" points="${points.trim()}"/>
    </svg>`;
  });
}

function mostrarDetalheAvaliacao(colaborador, ciclo) {
  const avaliacoes = getAvaliacoesLocal();
  const av = avaliacoes.find(a => a.colaborador === colaborador && a.ciclo === ciclo);
  if (!av) { showToast('Avaliação não encontrada.', 'error'); return; }

  const scores = COMPETENCIAS.map(c => ({
    ...c,
    nota: av.scores[c.id] !== null && av.scores[c.id] !== undefined ? av.scores[c.id] : null,
    obs: av.observacoes_competencias?.[c.id] || ''
  }));

  const scoresArray = scores.filter(s => s.nota !== null).map(s => s.nota);
  const media = scoresArray.length ? (scoresArray.reduce((a, b) => a + b, 0) / scoresArray.length).toFixed(2) : '—';
  const total = scoresArray.reduce((a, b) => a + b, 0);
  const obsGerais = av.observacoes_gerais || '';

  let radarChartInstance = null;

  const overlay = document.createElement('div');
  overlay.className = 'colab-detail-overlay open';
  overlay.innerHTML = `
    <div class="colab-detail-panel" style="max-width:900px">
      <button class="colab-detail-close" type="button">✕</button>
      <div style="padding:var(--s-5)">
        <h2 style="font-size:20px;font-weight:700;margin-bottom:4px">📋 Avaliação: ${escapeHtml(av.colaborador)}</h2>
        <p style="color:var(--text-secondary);font-size:14px;margin-bottom:var(--s-4)">Ciclo <strong>${escapeHtml(av.ciclo)}</strong> · Média: <strong style="color:${media !== '—' ? (parseFloat(media) >= 3 ? 'var(--success)' : parseFloat(media) >= 2 ? 'var(--warning)' : 'var(--danger)') : 'var(--text-muted)'}">${media}</strong> · Total: <strong>${total}/${COMPETENCIAS.length * 4}</strong></p>

        <div style="display:flex;gap:var(--s-6);flex-wrap:wrap;margin-bottom:var(--s-5)">
          <div style="flex:0 0 320px">
            <div style="background:var(--bg-subtle);border-radius:var(--r-md);padding:var(--s-4)">
              <div style="position:relative;width:280px;height:280px;margin:0 auto">
                <canvas id="avaliacaoRadarDetail" width="280" height="280"></canvas>
              </div>
            </div>
          </div>
          <div style="flex:1;min-width:280px">
            <h3 style="font-size:15px;font-weight:600;margin-bottom:var(--s-3)">📊 Pontuação por competência</h3>
            <div style="overflow-x:auto">
              <table class="avaliacao-detail-table">
                <thead><tr><th>Competência</th><th>Nota</th><th>Observação</th></tr></thead>
                <tbody>
                  ${scores.map(s => `
                    <tr>
                      <td><strong>${escapeHtml(s.nome)}</strong></td>
                      <td style="text-align:center;font-weight:600">${s.nota !== null ? s.nota : '—'}</td>
                      <td style="font-size:12px;color:var(--text-secondary);max-width:250px">${s.obs ? escapeHtml(s.obs) : '<span style="color:var(--text-muted)">—</span>'}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        ${obsGerais ? `
          <div style="background:var(--bg-subtle);border-radius:var(--r-md);padding:var(--s-4);margin-bottom:var(--s-4)">
            <h3 style="font-size:14px;font-weight:600;margin-bottom:var(--s-2)">📝 Observações gerais</h3>
            <p style="font-size:13px;color:var(--text-secondary);white-space:pre-wrap">${escapeHtml(obsGerais)}</p>
          </div>
        ` : ''}

        <div style="display:flex;gap:var(--s-3);justify-content:flex-end">
          <button class="btn-small" id="avaliacaoDetailEditar" type="button">✏️ Editar</button>
          <button class="btn-small" id="avaliacaoDetailExportar" type="button">📄 Exportar texto</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.querySelector('.colab-detail-close').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  overlay.querySelector('#avaliacaoDetailEditar').addEventListener('click', () => {
    overlay.remove();
    renderAvaliacaoForm(av.colaborador, av.ciclo, av);
  });

  overlay.querySelector('#avaliacaoDetailExportar').addEventListener('click', () => {
    const linhas = [`Avaliação de Desempenho — ${av.colaborador} (${av.ciclo})`, `Média: ${media} | Total: ${total}/${COMPETENCIAS.length * 4}`, ''];
    scores.forEach(s => {
      linhas.push(`${s.nome}: ${s.nota !== null ? s.nota : '—'}${s.obs ? ` — ${s.obs}` : ''}`);
    });
    if (obsGerais) {
      linhas.push('', 'Observações gerais:', obsGerais);
    }
    navigator.clipboard.writeText(linhas.join('\n')).then(() => {
      showToast('Texto copiado!', 'success');
    }).catch(() => {
      showToast('Erro ao copiar.', 'error');
    });
  });

  setTimeout(() => {
    const canvas = document.getElementById('avaliacaoRadarDetail');
    if (!canvas || typeof Chart === 'undefined') return;
    const ctx = canvas.getContext('2d');
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

    const data = {
      labels: scores.map(s => s.nome),
      datasets: [{
        label: av.colaborador,
        data: scores.map(s => s.nota),
        backgroundColor: 'rgba(37,99,235,0.2)',
        borderColor: '#2563eb',
        borderWidth: 2,
        pointBackgroundColor: '#2563eb',
        pointBorderColor: '#fff',
        pointBorderWidth: 1,
        pointRadius: 3
      }]
    };

    const config = {
      type: 'radar',
      data,
      options: {
        responsive: true,
        maintainAspectRatio: true,
        scales: {
          r: {
            min: 0,
            max: 4,
            ticks: {
              stepSize: 1,
              backdropColor: 'transparent',
              color: isDark ? '#94a3b8' : '#64748b',
              font: { size: 10 }
            },
            grid: { color: isDark ? '#334155' : '#e2e8f0' },
            angleLines: { color: isDark ? '#334155' : '#e2e8f0' },
            pointLabels: {
              color: isDark ? '#e2e8f0' : '#334155',
              font: { size: 10 }
            }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function(ctx) {
                return ctx.parsed.r !== null && ctx.parsed.r !== undefined ? `Nota: ${ctx.parsed.r}/4` : 'Sem nota';
              }
            }
          }
        }
      }
    };

    try {
      if (radarChartInstance) radarChartInstance.destroy();
      radarChartInstance = new Chart(ctx, config);
    } catch(e) {
      console.warn('[Avaliacao] Erro ao criar radar chart:', e);
    }
  }, 100);
}

function onAvaliacaoTabActivated() {
  renderAvaliacao();
}
