// avaliacao.js — Avaliação de Desempenho (11 competências C1, escala 1-4, ciclos de 4 meses)
// Gestor avalia colaboradores. Persistência: localStorage + Supabase.

const AVALIACAO_KEY = 'sistema_avaliacoes_v1';

const COMPETENCIAS = [
  { id: 'evidencias', type: 'guidance', nome: 'Avaliando com evidências', descricao: 'Baseia sua avaliação em fatos, comportamentos observáveis e resultados concretos, evitando percepções subjetivas.' },
  { id: 1, type: 'competency', nome: 'Empatia e Prestatividade (C1)', descricao: 'Demonstra empatia, respeito e disponibilidade para apoiar colegas e clientes.' },
  { id: 2, type: 'competency', nome: 'Espírito de Equipe (C1)', descricao: 'Colabora com colegas e compartilha conhecimentos para contribuir com os objetivos da equipe.' },
  { id: 3, type: 'competency', nome: 'Orientação para Resultados (C1)', descricao: 'Demonstra comprometimento com o alcance das metas e objetivos relacionados às suas atividades.' },
  { id: 4, type: 'competency', nome: 'Responsabilidade e Maturidade Profissional (C1)', descricao: 'Assume responsabilidade por suas ações, decisões e entregas, atuando com comprometimento e autonomia.' },
  { id: 5, type: 'competency', nome: 'Transparência e Confiança (C1)', descricao: 'Atua com transparência, honestidade e respeito em suas relações profissionais.' },
  { id: 6, type: 'competency', nome: 'Aprendizagem e Desenvolvimento (C1)', descricao: 'Busca continuamente desenvolver conhecimentos e habilidades para aprimorar seu desempenho.' },
  { id: 7, type: 'competency', nome: 'Entregas e Resultados (C1)', descricao: 'Cumpre as entregas e responsabilidades sob sua atuação, atingindo os resultados esperados com qualidade, eficiência e dentro dos prazos estabelecidos.' },
  { id: 8, type: 'competency', nome: 'Gestão da Informação (C1)', descricao: 'Registra, organiza e compartilha informações de forma clara, confiável e acessível para apoiar as atividades da equipe.' },
  { id: 9, type: 'competency', nome: 'Gestão de Processos Integrados (C1)', descricao: 'Executa suas atividades considerando os impactos de suas ações nos processos e áreas envolvidas.' },
  { id: 10, type: 'competency', nome: 'Organização e Autogestão (C1)', descricao: 'Organiza suas atividades e prioridades de forma eficiente, garantindo o cumprimento dos prazos e responsabilidades.' },
  { id: 11, type: 'competency', nome: 'Orientação para Soluções (C1)', descricao: 'Identifica necessidades e propõe soluções que agreguem valor aos clientes internos e externos.' },
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
        comentarios_ia: r.comentarios_ia || [],
        comentarios_finais: r.comentarios_finais || [],
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
        comentarios_ia: avaliacao.comentarios_ia || [],
        comentarios_finais: avaliacao.comentarios_finais || [],
        updated_at: new Date().toISOString()
      }).eq('id', avaliacao.id);
    } else {
      await sbClient.from('avaliacoes').insert({
        user_id: uid,
        colaborador: avaliacao.colaborador,
        ciclo: avaliacao.ciclo,
        scores: avaliacao.scores,
        observacoes_gerais: avaliacao.observacoes_gerais || '',
        observacoes_competencias: avaliacao.observacoes_competencias || {},
        comentarios_ia: avaliacao.comentarios_ia || [],
        comentarios_finais: avaliacao.comentarios_finais || []
      }).then(result => {
        if (result.data && result.data[0]) {
          avaliacao.id = result.data[0].id;
        }
      });
    }
    if (typeof criarNotificacao === 'function') {
      criarNotificacao('avaliacao', `Nova avaliação para ${avaliacao.colaborador || 'colaborador'} (${avaliacao.ciclo || 'sem ciclo'})`, 'avaliacao');
    }
  } catch (e) { console.error('[avaliacao] dbAvaliacaoSave:', e); }
}

async function dbAvaliacaoDelete(id) {
  const list = getAvaliacoesLocal();
  const filtered = list.filter(a => a.id !== id);
  saveAvaliacoesLocal(filtered);
  if (!sbClient) return;
  try {
    await sbClient.from('avaliacoes').delete().eq('id', id);
  } catch (e) { console.error('[avaliacao] dbAvaliacaoDelete:', e); }
}

function isGuidance(c) { return c.type === 'guidance'; }
function isCompetency(c) { return c.type === 'competency'; }
function getCompetencias() { return COMPETENCIAS.filter(isCompetency); }

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
            <p>Avalie um colaborador nas 11 competências C1</p>
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
  const comentariosIa = existing ? (existing.comentarios_ia || []) : [];
  const comentariosFinais = existing ? (existing.comentarios_finais || []) : [];
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
          if (isGuidance(comp)) {
            return `
              <div class="avaliacao-guidance">
                <div class="avaliacao-guidance-icon">📌</div>
                <div>
                  <strong>${escapeHtml(comp.nome)}</strong>
                  <p>${escapeHtml(comp.descricao)}</p>
                </div>
              </div>
            `;
          }
          const val = scores[comp.id] || '';
          const obs = obsComp[comp.id] || '';
          return `
            <div class="avaliacao-questao" data-comp-id="${comp.id}">
              <div class="avaliacao-questao-header">
                <span class="avaliacao-questao-num">${comp.id}.</span>
                <div>
                  <strong>${escapeHtml(comp.nome)}</strong>
                  <div class="avaliacao-questao-dica" title="${escapeHtml(comp.descricao)}">
                    <span class="avaliacao-oq-info">ⓘ ${escapeHtml(comp.descricao)}</span>
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
                  <input type="text" class="avaliacao-obs-input" name="obs_${comp.id}" value="${escapeHtml(obs)}" placeholder="Observação específica (opcional)" maxlength="300"/>
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

        <div class="avaliacao-comentarios-ia-section">
          <div class="avaliacao-comentarios-ia-header">
            <div>
              <h3 style="font-size:15px;font-weight:600;color:var(--text-strong)">💬 Comentários da Avaliação</h3>
              <p style="font-size:12.5px;color:var(--text-secondary)">É obrigatório registrar pelo menos um comentário antes de concluir ou publicar a avaliação.</p>
            </div>
            <div style="display:flex;gap:var(--s-2);flex-wrap:wrap">
              <button class="btn-primary" id="avaliacaoGerarIaBtn" type="button" style="font-size:12px;padding:6px 12px">🤖 Gerar Sugestões com IA</button>
            </div>
          </div>
          <div id="avaliacaoComentariosIaList" class="avaliacao-comentarios-list">
            ${renderComentariosIa(comentariosIa, comentariosFinais)}
          </div>
          <div id="avaliacaoComentariosFinaisList" class="avaliacao-comentarios-list">
            ${renderComentariosFinais(comentariosFinais)}
          </div>
          <div class="avaliacao-comentarios-add">
            <textarea id="avaliacaoNovoComentarioInput" rows="2" placeholder="Digite um comentário personalizado..." style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:var(--r-md);background:var(--bg-surface);color:var(--text-primary);font:inherit;font-size:13px;resize:vertical"></textarea>
            <button class="btn-small" id="avaliacaoAddComentarioBtn" type="button" style="margin-top:6px">➕ Adicionar comentário</button>
          </div>
        </div>

        <div class="avaliacao-form-actions">
          <button class="btn-primary" type="submit">💾 Salvar avaliação</button>
          <button class="btn-small" type="button" id="avaliacaoExportXlsxBtn">📊 Exportar para Excel</button>
          <button class="btn-small" type="button" id="avaliacaoCancelarBtn">Cancelar</button>
        </div>
      </form>
    </div>
  `;

  container.innerHTML = html;
  bindAvaliacaoFormEvents(colaborador, ciclo, existing);
}

function renderComentariosIa(comentariosIa, comentariosFinais) {
  if (!comentariosIa || !comentariosIa.length) return '<p style="font-size:13px;color:var(--text-muted);padding:var(--s-3) 0">Clique em "Gerar Sugestões com IA" para obter recomendações.</p>';
  return comentariosIa.map((c, i) => `
    <div class="avaliacao-comentario-item ia" data-index="${i}">
      <div class="avaliacao-comentario-tag">🤖 Sugestão IA</div>
      <div class="avaliacao-comentario-texto">${escapeHtml(c)}</div>
      <div class="avaliacao-comentario-actions">
        <button class="btn-small av-copiar-btn" type="button" title="Copiar" style="font-size:11px;padding:3px 8px">📋 Copiar</button>
        <button class="btn-small av-usar-btn" type="button" title="Usar como comentário final" style="font-size:11px;padding:3px 8px">➕ Usar</button>
        <button class="btn-small av-regenerar-btn" type="button" title="Regenerar" style="font-size:11px;padding:3px 8px">🔄 Regenerar</button>
      </div>
    </div>
  `).join('');
}

function renderComentariosFinais(comentariosFinais) {
  if (!comentariosFinais || !comentariosFinais.length) return '';
  return comentariosFinais.map((c, i) => `
    <div class="avaliacao-comentario-item final" data-index="${i}">
      <div class="avaliacao-comentario-tag final">📝 Comentário Final</div>
      <div class="avaliacao-comentario-texto">${escapeHtml(c)}</div>
      <div class="avaliacao-comentario-actions">
        <button class="btn-small av-editar-comentario-btn" type="button" title="Editar" style="font-size:11px;padding:3px 8px">✏️ Editar</button>
        <button class="btn-small av-copiar-btn" type="button" title="Copiar" style="font-size:11px;padding:3px 8px">📋 Copiar</button>
        <button class="btn-small av-excluir-comentario-btn" type="button" title="Excluir" style="font-size:11px;padding:3px 8px;color:var(--danger)">🗑️ Excluir</button>
      </div>
    </div>
  `).join('');
}

function getComentariosState() {
  const lista = document.getElementById('avaliacaoComentariosIaList');
  const listf = document.getElementById('avaliacaoComentariosFinaisList');
  if (!lista || !listf) return { comentarios_ia: [], comentarios_finais: [] };
  const comentarios_ia = [];
  lista.querySelectorAll('.avaliacao-comentario-item.ia .avaliacao-comentario-texto').forEach(el => comentarios_ia.push(el.textContent));
  const comentarios_finais = [];
  listf.querySelectorAll('.avaliacao-comentario-item.final .avaliacao-comentario-texto').forEach(el => comentarios_finais.push(el.textContent));
  return { comentarios_ia, comentarios_finais };
}

function bindAvaliacaoFormEvents(colaborador, ciclo, existing) {
  const isEdit = !!existing;
  const container = document.getElementById('avaliacaoFormContainer');

  document.getElementById('avaliacaoForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const colab = form.dataset.colaborador;
    const cicloForm = form.dataset.ciclo;
    const existingId = form.dataset.id;
    const { comentarios_ia, comentarios_finais } = getComentariosState();

    if (!comentarios_finais.length) {
      showToast('Adicione pelo menos um comentário antes de salvar.', 'error');
      return;
    }

    const scores = {};
    const observacoes_competencias = {};
    let hasScore = false;

    getCompetencias().forEach(comp => {
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
      comentarios_ia,
      comentarios_finais,
      updatedAt: new Date().toISOString()
    };

    if (!existingId) {
      avaliacaoData.createdAt = new Date().toISOString();
    }

    if (typeof setLoading === 'function') setLoading(true, 'Salvando avaliação…');
    try {
      await dbAvaliacaoSave(avaliacaoData);
      showToast(`Avaliação de ${escapeHtml(colab)} salva com sucesso!`, 'success', 'Avaliação');
      renderAvaliacao();
    } finally {
      if (typeof setLoading === 'function') setLoading(false);
    }
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

  document.getElementById('avaliacaoGerarIaBtn').addEventListener('click', () => gerarSugestoesIA(colaborador, ciclo, existing));

  document.getElementById('avaliacaoAddComentarioBtn').addEventListener('click', () => {
    const input = document.getElementById('avaliacaoNovoComentarioInput');
    const texto = input.value.trim();
    if (!texto) { showToast('Digite um comentário.', 'error'); return; }
    const list = document.getElementById('avaliacaoComentariosFinaisList');
    const div = document.createElement('div');
    div.className = 'avaliacao-comentario-item final';
    div.innerHTML = `
      <div class="avaliacao-comentario-tag final">📝 Comentário Final</div>
      <div class="avaliacao-comentario-texto">${escapeHtml(texto)}</div>
      <div class="avaliacao-comentario-actions">
        <button class="btn-small av-editar-comentario-btn" type="button" title="Editar" style="font-size:11px;padding:3px 8px">✏️ Editar</button>
        <button class="btn-small av-copiar-btn" type="button" title="Copiar" style="font-size:11px;padding:3px 8px">📋 Copiar</button>
        <button class="btn-small av-excluir-comentario-btn" type="button" title="Excluir" style="font-size:11px;padding:3px 8px;color:var(--danger)">🗑️ Excluir</button>
      </div>
    `;
    list.appendChild(div);
    input.value = '';
    bindComentarioActions();
  });

  document.getElementById('avaliacaoExportXlsxBtn').addEventListener('click', () => exportarAvaliacaoXLSX(colaborador, ciclo, existing));

  bindComentarioActions();
}

function bindComentarioActions() {
  document.querySelectorAll('.av-copiar-btn').forEach(btn => {
    btn.removeEventListener('click', handleCopiar);
    btn.addEventListener('click', handleCopiar);
  });
  document.querySelectorAll('.av-usar-btn').forEach(btn => {
    btn.removeEventListener('click', handleUsar);
    btn.addEventListener('click', handleUsar);
  });
  document.querySelectorAll('.av-regenerar-btn').forEach(btn => {
    btn.removeEventListener('click', handleRegenerar);
    btn.addEventListener('click', handleRegenerar);
  });
  document.querySelectorAll('.av-editar-comentario-btn').forEach(btn => {
    btn.removeEventListener('click', handleEditar);
    btn.addEventListener('click', handleEditar);
  });
  document.querySelectorAll('.av-excluir-comentario-btn').forEach(btn => {
    btn.removeEventListener('click', handleExcluir);
    btn.addEventListener('click', handleExcluir);
  });
}

function handleCopiar(e) {
  const texto = e.target.closest('.avaliacao-comentario-item').querySelector('.avaliacao-comentario-texto').textContent;
  navigator.clipboard.writeText(texto).then(() => showToast('Comentário copiado!', 'success')).catch(() => showToast('Erro ao copiar.', 'error'));
}

function handleUsar(e) {
  const item = e.target.closest('.avaliacao-comentario-item');
  const texto = item.querySelector('.avaliacao-comentario-texto').textContent;
  const list = document.getElementById('avaliacaoComentariosFinaisList');
  const div = document.createElement('div');
  div.className = 'avaliacao-comentario-item final';
  div.innerHTML = `
    <div class="avaliacao-comentario-tag final">📝 Comentário Final</div>
    <div class="avaliacao-comentario-texto">${escapeHtml(texto)}</div>
    <div class="avaliacao-comentario-actions">
      <button class="btn-small av-editar-comentario-btn" type="button" title="Editar" style="font-size:11px;padding:3px 8px">✏️ Editar</button>
      <button class="btn-small av-copiar-btn" type="button" title="Copiar" style="font-size:11px;padding:3px 8px">📋 Copiar</button>
      <button class="btn-small av-excluir-comentario-btn" type="button" title="Excluir" style="font-size:11px;padding:3px 8px;color:var(--danger)">🗑️ Excluir</button>
    </div>
  `;
  list.appendChild(div);
  bindComentarioActions();
  showToast('Comentário adicionado à lista final!', 'success');
}

function handleRegenerar(e) {
  const item = e.target.closest('.avaliacao-comentario-item');
  const idx = parseInt(item.dataset.index);
  const lista = document.getElementById('avaliacaoComentariosIaList');
  const container = lista.closest('.avaliacao-comentarios-ia-section');
  const form = document.getElementById('avaliacaoForm');
  const colab = form.dataset.colaborador;
  const ciclo = form.dataset.ciclo;
  const existingId = form.dataset.id;
  const avaliacoes = getAvaliacoesLocal();
  const existing = existingId ? avaliacoes.find(a => a.id === existingId) : null;
  gerarSugestoesIA(colab, ciclo, existing, idx);
}

function handleEditar(e) {
  const item = e.target.closest('.avaliacao-comentario-item');
  const textoEl = item.querySelector('.avaliacao-comentario-texto');
  const textoAtual = textoEl.textContent;
  const input = document.createElement('textarea');
  input.value = textoAtual;
  input.style.cssText = 'width:100%;padding:8px 10px;border:1px solid var(--accent);border-radius:var(--r-md);background:var(--bg-surface);color:var(--text-primary);font:inherit;font-size:13px;resize:vertical;min-height:60px';
  textoEl.replaceWith(input);
  input.focus();
  const actions = item.querySelector('.avaliacao-comentario-actions');
  const salvarBtn = document.createElement('button');
  salvarBtn.className = 'btn-small';
  salvarBtn.type = 'button';
  salvarBtn.style.cssText = 'font-size:11px;padding:3px 8px';
  salvarBtn.textContent = '💾 Salvar';
  salvarBtn.addEventListener('click', () => {
    const novoTexto = input.value.trim();
    if (!novoTexto) { showToast('O comentário não pode ficar vazio.', 'error'); return; }
    const div = document.createElement('div');
    div.className = 'avaliacao-comentario-texto';
    div.textContent = novoTexto;
    input.replaceWith(div);
    salvarBtn.remove();
    bindComentarioActions();
  });
  actions.prepend(salvarBtn);
}

function handleExcluir(e) {
  const item = e.target.closest('.avaliacao-comentario-item');
  item.remove();
  showToast('Comentário excluído.', 'success');
}

function gerarSugestoesIA(colaborador, ciclo, existing, replaceIndex) {
  const scores = existing ? existing.scores : {};
  const obsComp = existing ? (existing.observacoes_competencias || {}) : {};

  const ptsFortes = [];
  const ptsDesenvolvimento = [];

  getCompetencias().forEach(comp => {
    const nota = scores[comp.id];
    if (nota === null || nota === undefined) return;
    const obs = obsComp[comp.id] || '';

    if (nota >= 3) {
      let texto = `${comp.nome}: ${comp.descricao}`;
      if (nota === 4) texto += `. Desempenho destacado, superando consistentemente o esperado.`;
      else texto += `. Demonstra bom desempenho e alinhamento com o esperado.`;
      if (obs) texto += ` ${obs}`;
      ptsFortes.push(texto);
    } else if (nota <= 2) {
      let texto = `${comp.nome}: ${comp.descricao}`;
      if (nota === 1) texto += `. Necessidade de atenção prioritária — o desempenho atual está abaixo do esperado.`;
      else texto += `. Oportunidade de melhoria identificada — desempenho parcial em relação ao esperado.`;
      if (obs) texto += ` ${obs}`;
      ptsDesenvolvimento.push(texto);
    }
  });

  const comentarios = [];

  if (ptsFortes.length) {
    let sugestao = '**Pontos fortes**\n\n';
    sugestao += 'Demonstrou ';
    if (ptsFortes.length === 1) {
      sugestao += ptsFortes[0].charAt(0).toLowerCase() + ptsFortes[0].slice(1);
    } else {
      const fortesTextos = ptsFortes.map(p => {
        const idx = p.indexOf(':');
        if (idx > 0) return p.slice(idx + 1).trim().toLowerCase();
        return p.toLowerCase();
      });
      sugestao += fortesTextos.slice(0, -1).join(', ') + ' e ' + fortesTextos.slice(-1);
    }
    sugestao += ' durante todo o período avaliado.';
    comentarios.push(sugestao);
  }

  if (ptsDesenvolvimento.length) {
    let sugestao = '**Pontos de desenvolvimento**\n\n';
    sugestao += 'Recomenda-se dedicar atenção especial ';
    if (ptsDesenvolvimento.length === 1) {
      const txt = ptsDesenvolvimento[0];
      const idx = txt.indexOf(':');
      sugestao += idx > 0 ? 'à ' + txt.slice(idx + 1).trim().toLowerCase() : 'aos aspectos mencionados.';
    } else {
      sugestao += 'aos seguintes aspectos: ';
      sugestao += ptsDesenvolvimento.map(p => {
        const idx = p.indexOf(':');
        return idx > 0 ? p.slice(idx + 1).trim().toLowerCase() : p.toLowerCase();
      }).join('; ');
      sugestao += '.';
    }
    comentarios.push(sugestao);
  }

  if (!comentarios.length) {
    comentarios.push('A avaliação ainda não contém notas registradas. Atribua notas às competências para gerar sugestões personalizadas.');
  }

  const lista = document.getElementById('avaliacaoComentariosIaList');
  if (!lista) return;

  if (replaceIndex !== undefined && replaceIndex >= 0 && replaceIndex < comentarios.length) {
    const items = lista.querySelectorAll('.avaliacao-comentario-item.ia');
    if (items[replaceIndex]) {
      items[replaceIndex].querySelector('.avaliacao-comentario-texto').textContent = comentarios[replaceIndex] || comentarios[0];
    }
  } else {
    lista.innerHTML = comentarios.map((c, i) => `
      <div class="avaliacao-comentario-item ia" data-index="${i}">
        <div class="avaliacao-comentario-tag">🤖 Sugestão IA</div>
        <div class="avaliacao-comentario-texto">${escapeHtml(c)}</div>
        <div class="avaliacao-comentario-actions">
          <button class="btn-small av-copiar-btn" type="button" title="Copiar" style="font-size:11px;padding:3px 8px">📋 Copiar</button>
          <button class="btn-small av-usar-btn" type="button" title="Usar como comentário final" style="font-size:11px;padding:3px 8px">➕ Usar</button>
          <button class="btn-small av-regenerar-btn" type="button" title="Regenerar" style="font-size:11px;padding:3px 8px">🔄 Regenerar</button>
        </div>
      </div>
    `).join('');
    bindComentarioActions();
    showToast('Sugestões geradas com sucesso!', 'success');
  }
}

function exportarAvaliacaoXLSX(colaborador, ciclo, existing) {
  const scores = existing ? existing.scores : {};
  const obsComp = existing ? (existing.observacoes_competencias || {}) : {};
  const obsGerais = existing ? (existing.observacoes_gerais || '') : '';
  const comentariosIa = existing ? (existing.comentarios_ia || []) : [];
  const comentariosFinais = existing ? (existing.comentarios_finais || []) : [];

  const comps = getCompetencias();
  const scoresArray = comps.map(c => ({ nota: scores[c.id] !== null && scores[c.id] !== undefined ? scores[c.id] : null, comp: c }));
  const notasArray = scoresArray.filter(s => s.nota !== null).map(s => s.nota);
  const media = notasArray.length ? (notasArray.reduce((a, b) => a + b, 0) / notasArray.length).toFixed(2) : '—';
  const total = notasArray.reduce((a, b) => a + b, 0);

  const rows = [
    ['Colaborador', colaborador],
    ['Avaliador', document.getElementById('currentUserDisplay')?.textContent || '—'],
    ['Data', new Date().toLocaleString('pt-BR')],
    ['Ciclo', ciclo],
    [],
    ['Competência', 'Descrição', 'Nota', 'Observação', 'Sugestão IA', 'Comentário Final'],
  ];

  comps.forEach((c, i) => {
    const nota = scoresArray[i].nota;
    const obs = obsComp[c.id] || '';
    const sugestaoIa = comentariosIa.join('; ');
    const comentarioFinal = comentariosFinais.join('; ');
    rows.push([
      c.nome,
      c.descricao,
      nota !== null ? String(nota) : '—',
      obs,
      i === 0 ? sugestaoIa : '',
      i === 0 ? comentarioFinal : ''
    ]);
  });

  if (notasArray.length) {
    rows.push([], ['Média Final', media], ['Resultado Geral', total + '/' + (comps.length * 4)]);
  }

  if (obsGerais) {
    rows.push([], ['Observações Gerais', obsGerais]);
  }

  if (typeof XLSX === 'undefined') {
    showToast('Biblioteca XLSX não carregada. Tente novamente.', 'error');
    return;
  }

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);

  ws['!cols'] = [
    { wch: 45 },
    { wch: 55 },
    { wch: 8 },
    { wch: 35 },
    { wch: 50 },
    { wch: 50 }
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Avaliação');
  XLSX.writeFile(wb, `avaliacao_${colaborador}_${ciclo.replace(/\s/g, '_')}.xlsx`);
  showToast('Planilha exportada com sucesso!', 'success');
}

function renderHistoricoAvaliacoes() {
  const container = document.getElementById('avaliacaoHistoricoLista');
  if (!container) return;

  const filtroColab = document.getElementById('avaliacaoHistSelect')?.value || '';
  const avaliacoes = getAvaliacoesLocal();
  let filtered = avaliacoes;
  if (filtroColab) filtered = filtered.filter(a => a.colaborador === filtroColab);

  const comps = getCompetencias();

  if (!filtered.length) {
    container.innerHTML = '<div class="empty-state" style="border:none"><div class="empty-title">Nenhuma avaliação encontrada</div><div class="empty-sub">As avaliações salvas aparecerão aqui.</div></div>';
    return;
  }

  let html = '<div class="avaliacao-historico-grid">';
  filtered.forEach(av => {
    const scoresArray = comps.map(c => av.scores[c.id]).filter(v => v !== null && v !== undefined);
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
          <span>Notas: <strong>${scoresArray.length}/${comps.length}</strong></span>
          <span>Total: <strong>${total}</strong></span>
          <span>Média: <strong style="color:${corMedia}">${media}</strong></span>
          <span>Comentários: <strong>${(av.comentarios_finais || []).length}</strong></span>
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
      if (!confirm('Tem certeza que deseja excluir esta avaliação?')) return;
      await dbAvaliacaoDelete(btn.dataset.id);
      showToast('Avaliação excluída.', 'success');
      renderAvaliacao();
    });
  });

  renderMiniRadars(filtered);
}

function renderMiniRadars(avaliacoes) {
  const comps = getCompetencias();
  avaliacoes.forEach(av => {
    const container = document.querySelector(`.avaliacao-historico-mini-radar[data-colab="${CSS.escape(av.colaborador)}"][data-ciclo="${CSS.escape(av.ciclo)}"]`);
    if (!container) return;
    const scores = comps.map(c => {
      const v = av.scores[c.id];
      return (v !== null && v !== undefined) ? v : null;
    });
    const hasData = scores.some(s => s !== null);
    if (!hasData) { container.innerHTML = '<span style="font-size:11px;color:var(--text-muted)">Sem dados</span>'; return; }

    const w = 80, h = 80, cx = w / 2, cy = h / 2, r = 30;
    const angleStep = (2 * Math.PI) / comps.length;
    const offset = -Math.PI / 2;

    let points = '';
    let gridLines = '';
    for (let i = 0; i < comps.length; i++) {
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

  const comps = getCompetencias();
  const scores = comps.map(c => ({
    ...c,
    nota: av.scores[c.id] !== null && av.scores[c.id] !== undefined ? av.scores[c.id] : null,
    obs: av.observacoes_competencias?.[c.id] || ''
  }));

  const scoresArray = scores.filter(s => s.nota !== null).map(s => s.nota);
  const media = scoresArray.length ? (scoresArray.reduce((a, b) => a + b, 0) / scoresArray.length).toFixed(2) : '—';
  const total = scoresArray.reduce((a, b) => a + b, 0);
  const obsGerais = av.observacoes_gerais || '';
  const comentariosIa = av.comentarios_ia || [];
  const comentariosFinais = av.comentarios_finais || [];

  let radarChartInstance = null;

  const overlay = document.createElement('div');
  overlay.className = 'colab-detail-overlay open';
  overlay.innerHTML = `
    <div class="colab-detail-panel" style="max-width:960px">
      <button class="colab-detail-close" type="button">✕</button>
      <div style="padding:var(--s-5)">
        <h2 style="font-size:20px;font-weight:700;margin-bottom:4px">📋 Avaliação: ${escapeHtml(av.colaborador)}</h2>
        <p style="color:var(--text-secondary);font-size:14px;margin-bottom:var(--s-4)">Ciclo <strong>${escapeHtml(av.ciclo)}</strong> · Média: <strong style="color:${media !== '—' ? (parseFloat(media) >= 3 ? 'var(--success)' : parseFloat(media) >= 2 ? 'var(--warning)' : 'var(--danger)') : 'var(--text-muted)'}">${media}</strong> · Total: <strong>${total}/${comps.length * 4}</strong></p>

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

        ${comentariosFinais.length ? `
          <div style="background:var(--bg-subtle);border-radius:var(--r-md);padding:var(--s-4);margin-bottom:var(--s-4)">
            <h3 style="font-size:14px;font-weight:600;margin-bottom:var(--s-2)">💬 Comentários da Avaliação</h3>
            ${comentariosFinais.map(c => `<div style="padding:8px 0;border-bottom:1px solid var(--border);font-size:13px;color:var(--text-secondary);white-space:pre-wrap;line-height:1.5">${escapeHtml(c)}</div>`).join('')}
            ${comentariosIa.length ? `<details style="margin-top:var(--s-2)"><summary style="font-size:12px;font-weight:600;color:var(--text-muted);cursor:pointer">🤖 Ver sugestões da IA (${comentariosIa.length})</summary>${comentariosIa.map(c => `<div style="padding:6px 0;font-size:12px;color:var(--text-muted);white-space:pre-wrap">${escapeHtml(c)}</div>`).join('')}</details>` : ''}
          </div>
        ` : ''}

        <div style="display:flex;gap:var(--s-3);justify-content:flex-end;flex-wrap:wrap">
          <button class="btn-small" id="avaliacaoDetailEditar" type="button">✏️ Editar</button>
          <button class="btn-small" id="avaliacaoDetailExportarXlsx" type="button">📊 Exportar Excel</button>
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
    const linhas = [`Avaliação de Desempenho — ${av.colaborador} (${av.ciclo})`, `Média: ${media} | Total: ${total}/${comps.length * 4}`, ''];
    scores.forEach(s => {
      linhas.push(`${s.nome}: ${s.nota !== null ? s.nota : '—'}${s.obs ? ` — ${s.obs}` : ''}`);
    });
    if (obsGerais) {
      linhas.push('', 'Observações gerais:', obsGerais);
    }
    if (comentariosFinais.length) {
      linhas.push('', 'Comentários finais:');
      comentariosFinais.forEach(c => linhas.push(`- ${c}`));
    }
    navigator.clipboard.writeText(linhas.join('\n')).then(() => {
      showToast('Texto copiado!', 'success');
    }).catch(() => {
      showToast('Erro ao copiar.', 'error');
    });
  });

  overlay.querySelector('#avaliacaoDetailExportarXlsx').addEventListener('click', () => {
    exportarAvaliacaoXLSX(av.colaborador, av.ciclo, av);
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
