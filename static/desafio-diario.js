// Check-in de clima e desafio diário — experiência do colaborador e gestão admin.
(function () {
  'use strict';

  const moods = [
    { value: 1, emoji: '😞', label: 'Muito mal' },
    { value: 2, emoji: '😕', label: 'Não muito bem' },
    { value: 3, emoji: '😐', label: 'Neutro' },
    { value: 4, emoji: '🙂', label: 'Bem' },
    { value: 5, emoji: '😄', label: 'Muito bem' }
  ];

  async function authHeaders() {
    const { data } = await sbClient.auth.getSession();
    return data?.session?.access_token ? { Authorization: `Bearer ${data.session.access_token}` } : {};
  }

  async function api(path = '', options = {}) {
    const response = await fetch(`/api/desafio${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(await authHeaders()), ...(options.headers || {}) }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Não foi possível concluir a operação.');
    return data;
  }

  function safe(value) {
    if (typeof escapeHtml === 'function') return escapeHtml(value);
    const div = document.createElement('div');
    div.textContent = value == null ? '' : String(value);
    return div.innerHTML;
  }

  function formatDate(iso) {
    if (!iso) return '';
    return new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  }

  function formatMonth(value) {
    const text = String(value || '').trim();
    const iso = text.match(/^(\d{4})-(\d{2})$/);
    const br = text.match(/^(\d{2})\/(\d{4})$/);
    if (!iso && !br) return text;
    const year = iso ? iso[1] : br[2];
    const month = iso ? iso[2] : br[1];
    return new Date(`${year}-${month}-01T12:00:00`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  }


  function trendMarkup(current, previous) {
    const currentValue = Number(current);
    const previousValue = Number(previous);
    if (!Number.isFinite(currentValue) || !Number.isFinite(previousValue) || previousValue === 0) return '';
    const variation = (currentValue - previousValue) / Math.abs(previousValue) * 100;
    if (Math.abs(variation) < 0.05) return '<small class="metric-trend is-stable">• estável</small>';
    const direction = variation > 0 ? 'up' : 'down';
    const arrow = variation > 0 ? '↑' : '↓';
    return '<small class="metric-trend is-' + direction + '">' + arrow + ' ' + Math.abs(variation).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%</small>';
  }

  function previousMonthSummaryMarkup(item, comparison) {
    if (!item) {
      return '<div class="previous-month-summary is-empty"><span>Último mês fechado</span><p>Os dados do mês anterior ainda não foram importados.</p></div>';
    }
    const score = item.averageScore == null ? '—' : Number(item.averageScore).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const productivity = item.productivity == null ? '—' : Number(item.productivity).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%';
    return '<section class="previous-month-summary"><div class="previous-month-title"><span>Último mês fechado</span><strong>' + safe(formatMonth(item.month)) + '</strong></div>' +
      '<div class="previous-month-metrics"><div><strong>' + Number(item.completed || 0).toLocaleString('pt-BR') + '</strong><span>Finalizados</span>' + trendMarkup(item.completed, comparison?.completed) + '</div>' +
      '<div><strong>' + score + '</strong><span>Score médio</span>' + trendMarkup(item.averageScore, comparison?.averageScore) + '</div>' +
      '<div><strong>' + productivity + '</strong><span>Produtividade</span>' + trendMarkup(item.productivity, comparison?.productivity) + '</div></div></section>';
  }
  function personalResultsMarkup(results) {
    if (!results?.linked) {
      return `<article class="daily-card personal-results-card">
        <div class="daily-card-heading"><span class="daily-step">3</span><div><h2>Seus resultados mensais</h2><p>Acompanhe apenas os seus próprios indicadores.</p></div></div>
        <div class="daily-empty"><span>🔗</span><strong>Cadastro ainda não vinculado</strong><p>Peça ao administrador para vincular seu usuário ao seu nome nos dados de desempenho.</p></div>
      </article>`;
    }
    if (results.error) {
      return `<article class="daily-card personal-results-card">
        <div class="daily-card-heading"><span class="daily-step">3</span><div><h2>Seus resultados mensais</h2><p>Indicadores de ${safe(results.collaborator)}.</p></div></div>
        <div class="daily-empty"><span>⏳</span><strong>Resultados temporariamente indisponíveis</strong><p>O humor e o desafio continuam disponíveis. Tente atualizar a página em alguns instantes.</p></div>
      </article>`;
    }
    const months = Array.isArray(results.months) ? results.months : [];
    return `<article class="daily-card personal-results-card">
      <div class="daily-card-heading"><span class="daily-step">3</span><div><h2>Seus resultados mensais</h2><p>Indicadores de ${safe(results.collaborator)}.</p></div></div>
      ${previousMonthSummaryMarkup(results.previousMonth, results.comparisonMonth)}
      ${months.length ? `<div class="personal-results-filter"><label for="personalResultsPeriod">Filtrar período</label><select id="personalResultsPeriod"><option value="">Todos os meses</option>${months.map(item => `<option value="${safe(item.month)}">${safe(formatMonth(item.month))}</option>`).join('')}</select></div><div class="table-wrap"><table class="personal-results-table"><thead><tr><th>Período</th><th>Setor</th><th>Assumidos</th><th>Finalizados</th><th>Transferidos</th><th>Score médio</th><th>Produtividade</th></tr></thead><tbody>
        ${months.map(item => `<tr data-month="${safe(item.month)}"><td>${safe(formatMonth(item.month))}</td><td>${safe((item.sectors || []).join(', ') || '—')}</td><td>${Number(item.assumed || 0).toLocaleString('pt-BR')}</td><td>${Number(item.completed || 0).toLocaleString('pt-BR')}</td><td>${Number(item.transferred || 0).toLocaleString('pt-BR')}</td><td>${item.averageScore == null ? '—' : Number(item.averageScore).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td><td>${item.productivity == null ? '—' : `${Number(item.productivity).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`}</td></tr>`).join('')}
      </tbody></table></div>` : '<div class="daily-empty"><span>📊</span><strong>Nenhum resultado encontrado</strong><p>Ainda não há registros mensais associados ao seu nome.</p></div>'}
    </article>`;
  }

  function challengeCompletedMarkup() {
    return '<div class="daily-empty challenge-completed"><span>✅</span><strong>Desafio do dia concluído</strong><p>Obrigado por responder! Um novo desafio será liberado amanhã.</p></div>';
  }

  function showAnswerCelebration(result, stats) {
    document.getElementById('challengeCelebration')?.remove();
    const streak = Number(stats?.streak || 0);
    const overlay = document.createElement('div');
    const confetti = Array.from({ length: 18 }, (_, index) => '<i style="--i:' + index + '"></i>').join('');
    overlay.id = 'challengeCelebration';
    overlay.className = 'challenge-celebration ' + (result.acertou ? 'is-correct' : 'is-participation');
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Desafio concluído');
    overlay.innerHTML = '<div class="celebration-confetti" aria-hidden="true">' + confetti + '</div>' +
      '<div class="celebration-card"><div class="celebration-icon">' + (result.acertou ? '🏆' : '👏') + '</div>' +
      '<span class="daily-kicker">Desafio concluído</span><h2>Obrigado por responder!</h2>' +
      '<p>' + (result.acertou ? 'Você acertou e ganhou 1 ponto.' : 'Sua participação foi registrada. Amanhã tem uma nova chance!') + '</p>' +
      '<div class="celebration-streak"><span>🔥</span><strong>' + streak + '</strong><small>' + (streak === 1 ? 'dia de ofensiva' : 'dias de ofensiva') + '</small></div>' +
      '<p class="celebration-message">' + (streak > 1 ? 'Você manteve sua sequência. Continue assim!' : 'Sua ofensiva começou. Volte amanhã para continuar!') + '</p>' +
      (result.explanation ? '<div class="celebration-explanation"><strong>Saiba mais</strong><span>' + safe(result.explanation) + '</span></div>' : '') +
      '<button type="button" class="btn-primary celebration-continue">Continuar</button></div>';
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('open'));
    const close = () => {
      overlay.classList.remove('open');
      setTimeout(() => overlay.remove(), 220);
    };
    overlay.querySelector('.celebration-continue').addEventListener('click', close);
    overlay.addEventListener('click', event => { if (event.target === overlay) close(); });
  }

  function collaboratorMarkup() {
    return `<section class="daily-experience" id="dailyExperience" aria-live="polite">
      <div class="daily-loading"><div class="spinner"></div><p>Preparando seu dia...</p></div>
    </section>`;
  }

  async function postCollaborator(action, values) {
    return api('', { method: 'POST', body: JSON.stringify({ action, ...values }) });
  }

  function renderCollaborator(root, data) {
    const selectedMood = data.checkin?.humor;
    const answered = data.answer;
    const question = data.question;
    root.innerHTML = `
      <div class="daily-shell">
        <div class="daily-welcome">
          <span class="daily-kicker">${safe(formatDate(data.date))}</span>
          <h1>Olá, ${safe(String(data.name || '').split(' ')[0])}!</h1>
          <p>Reserve um minuto para registrar seu dia e participar do desafio.</p>
        </div>
        <div class="daily-stats" aria-label="Seu desempenho no mês">
          <div><strong>${Number(data.stats?.points || 0)}</strong><span>Pontos no mês</span></div>
          <div><strong>${Number(data.stats?.participations || 0)}</strong><span>Participações</span></div>
          <div><strong>🔥 ${Number(data.stats?.streak || 0)}</strong><span>Ofensiva</span></div>
        </div>
        <article class="daily-card mood-card">
          <div class="daily-card-heading"><span class="daily-step">1</span><div><h2>Como você está hoje?</h2><p>Seu registro é confidencial e ajuda a liderança a cuidar melhor do time.</p></div></div>
          <div class="mood-options" role="radiogroup" aria-label="Como você está se sentindo">
            ${moods.map(mood => `<button type="button" class="mood-option${selectedMood === mood.value ? ' selected' : ''}" data-mood="${mood.value}" aria-label="${mood.label}" aria-pressed="${selectedMood === mood.value}" ${selectedMood ? 'disabled' : ''}><span>${mood.emoji}</span><small>${mood.label}</small></button>`).join('')}
          </div>
          <p class="daily-feedback" id="moodFeedback">${selectedMood ? 'Check-in registrado. Obrigado por compartilhar!' : ''}</p>
        </article>
        <article class="daily-card challenge-card">
          <div class="daily-card-heading"><span class="daily-step">2</span><div><h2>Desafio do dia</h2><p>Uma pergunta diária para fortalecer seu conhecimento sobre o IXC Provedor.</p></div></div>
          ${answered ? challengeCompletedMarkup() : question ? `<div class="challenge-question">${safe(question.pergunta)}</div>
            <div class="challenge-options">
              ${question.alternativas.map((option, index) => `<button type="button" class="challenge-option${answered?.alternativa === index ? ' selected' : ''}" data-answer="${index}" ${answered ? 'disabled' : ''}><span>${String.fromCharCode(65 + index)}</span>${safe(option)}</button>`).join('')}
            </div>
            <button type="button" class="btn-primary challenge-submit" id="challengeSubmit" ${answered ? 'disabled' : ''}>${answered ? 'Resposta enviada' : 'Confirmar resposta'}</button>
            <div class="challenge-result${answered ? (answered.acertou ? ' is-correct' : ' is-wrong') : ''}" id="challengeResult">${answered ? (answered.acertou ? '🎉 Resposta correta! Você ganhou 1 ponto.' : 'Resposta registrada. Amanhã tem uma nova chance!') : ''}</div>`
            : '<div class="daily-empty"><span>📚</span><strong>Sem desafio programado para hoje</strong><p>Volte mais tarde ou continue sua ofensiva no próximo dia útil.</p></div>'}
        </article>
        ${personalResultsMarkup(data.personalResults)}
        <p class="daily-privacy">Seu sentimento individual é visível apenas para a gestão. O ranking considera somente o desafio de conhecimento.</p>
      </div>`;

    root.querySelector('#personalResultsPeriod')?.addEventListener('change', event => {
      const selectedMonth = event.currentTarget.value;
      root.querySelectorAll('.personal-results-table tbody tr').forEach(row => {
        row.hidden = Boolean(selectedMonth && row.dataset.month !== selectedMonth);
      });
    });

    root.querySelectorAll('.mood-option:not([disabled])').forEach(button => button.addEventListener('click', async () => {
      const feedback = root.querySelector('#moodFeedback');
      root.querySelectorAll('.mood-option').forEach(item => { item.disabled = true; });
      try {
        await postCollaborator('checkin', { humor: Number(button.dataset.mood) });
        root.querySelectorAll('.mood-option').forEach(item => {
          const active = item === button;
          item.classList.toggle('selected', active);
          item.setAttribute('aria-pressed', active);
        });
        feedback.textContent = 'Check-in registrado. Obrigado por compartilhar!';
      } catch (error) {
        feedback.textContent = error.message;
        root.querySelectorAll('.mood-option').forEach(item => { item.disabled = false; });
      }
    }));

    let selectedAnswer = answered?.alternativa;
    root.querySelectorAll('.challenge-option:not([disabled])').forEach(button => button.addEventListener('click', () => {
      selectedAnswer = Number(button.dataset.answer);
      root.querySelectorAll('.challenge-option').forEach(item => item.classList.toggle('selected', item === button));
    }));
    root.querySelector('#challengeSubmit')?.addEventListener('click', async event => {
      if (!Number.isInteger(selectedAnswer)) {
        root.querySelector('#challengeResult').textContent = 'Escolha uma alternativa antes de confirmar.';
        return;
      }
      event.currentTarget.disabled = true;
      try {
        const result = await postCollaborator('answer', { alternativa: selectedAnswer });
        const resultEl = root.querySelector('#challengeResult');
        resultEl.className = `challenge-result ${result.acertou ? 'is-correct' : 'is-wrong'}`;
        resultEl.innerHTML = `${result.acertou ? '🎉 Resposta correta! Você ganhou 1 ponto.' : 'Resposta registrada. Amanhã tem uma nova chance!'}${result.explanation ? `<small>${safe(result.explanation)}</small>` : ''}`;
        root.querySelectorAll('.challenge-option').forEach(item => { item.disabled = true; });
        event.currentTarget.textContent = 'Resposta enviada';
        const refreshed = await api();
        renderCollaborator(root, refreshed);
        showAnswerCelebration(result, refreshed.stats);
      } catch (error) {
        event.currentTarget.disabled = false;
        root.querySelector('#challengeResult').textContent = error.message;
      }
    });
  }

  async function initCollaborator() {
    if (document.getElementById('dailyExperience')) return;
    const main = document.querySelector('#appScreen main.app');
    if (!main) return;
    document.getElementById('homeScreen').style.display = 'none';
    document.getElementById('appScreen').style.display = 'block';
    main.insertAdjacentHTML('beforeend', collaboratorMarkup());
    const root = document.getElementById('dailyExperience');
    try { renderCollaborator(root, await api()); }
    catch (error) { root.innerHTML = `<div class="daily-shell"><div class="daily-card daily-error"><h2>Não foi possível carregar seu dia</h2><p>${safe(error.message)}</p><button class="btn-primary" type="button" onclick="location.reload()">Tentar novamente</button></div></div>`; }
  }

  function adminOverlayMarkup() {
    return `<div class="colab-detail-overlay" id="dailyAdminOverlay" role="dialog" aria-modal="true" aria-label="Desafio diário">
      <div class="colab-detail-panel daily-admin-panel">
        <button class="colab-detail-close" id="dailyAdminClose" type="button" aria-label="Fechar">✕</button>
        <div id="dailyAdminContent"><div class="daily-loading"><div class="spinner"></div><p>Carregando...</p></div></div>
      </div>
    </div>`;
  }

  function renderAdmin(root, data) {
    root.innerHTML = `<div class="daily-admin-header"><span class="daily-kicker">Engajamento e aprendizado</span><h2>Desafio diário</h2><p>Acompanhe a participação do time e programe as perguntas.</p></div>
      <div class="daily-admin-summary">
        <div><strong>${data.summary.collaborators}</strong><span>Colaboradores ativos</span></div>
        <div><strong>${data.summary.checkinsToday}</strong><span>Check-ins hoje</span></div>
        <div><strong>${data.summary.averageMood == null ? '—' : data.summary.averageMood.toFixed(1)}</strong><span>Clima médio hoje</span></div>
        <div><strong>${data.summary.answersToday}</strong><span>Respostas hoje</span></div>
      </div>
      <div class="daily-admin-grid">
        <section class="daily-card"><h3>Programar pergunta</h3>
          <form id="dailyQuestionForm" class="daily-question-form">
            <label class="field"><span>Data</span><input id="dailyQuestionDate" type="date" required></label>
            <label class="field"><span>Pergunta</span><textarea id="dailyQuestionText" rows="3" required placeholder="Digite a pergunta sobre o IXC Provedor"></textarea></label>
            <div class="daily-answer-fields">
              ${[0, 1, 2, 3].map(index => `<label class="field"><span>Alternativa ${String.fromCharCode(65 + index)}</span><input class="daily-answer-input" data-index="${index}" type="text" required></label>`).join('')}
            </div>
            <label class="field"><span>Resposta correta</span><select id="dailyCorrectAnswer"><option value="0">Alternativa A</option><option value="1">Alternativa B</option><option value="2">Alternativa C</option><option value="3">Alternativa D</option></select></label>
            <label class="field"><span>Explicação após responder (opcional)</span><textarea id="dailyQuestionExplanation" rows="2"></textarea></label>
            <div class="daily-form-actions"><button class="btn-primary" type="submit">Salvar pergunta</button><button class="btn-small" id="dailyClearFormBtn" type="button">Nova pergunta</button></div><p class="daily-feedback" id="dailyAdminFeedback"></p>
          </form>
        </section>
        <section class="daily-card"><h3>Ranking do mês</h3>
          ${data.ranking.length ? `<div class="daily-ranking">${data.ranking.map((item, index) => `<div><span class="daily-rank-position">${index + 1}</span><strong>${safe(item.name)}</strong><span>${item.points} pts</span><small>🔥 ${item.streak}</small></div>`).join('')}</div>` : '<div class="daily-empty"><p>Nenhuma participação neste mês.</p></div>'}
        </section>
      </div>
      <section class="daily-card daily-questions-list"><h3>Perguntas programadas</h3>
        ${data.questions.length ? `<div class="table-wrap"><table><thead><tr><th>Data</th><th>Pergunta</th><th>Status</th><th></th></tr></thead><tbody>${data.questions.map((question, index) => `<tr><td>${safe(formatDate(question.data))}</td><td>${safe(question.pergunta)}</td><td>${question.ativo ? 'Ativa' : 'Inativa'}</td><td><button class="btn-small daily-edit-question" type="button" data-index="${index}">Editar</button></td></tr>`).join('')}</tbody></table></div>` : '<p>Nenhuma pergunta programada.</p>'}
      </section>`;
    const dateInput = root.querySelector('#dailyQuestionDate');
    if (dateInput) dateInput.value = data.date;
    root.querySelector('#dailyQuestionForm')?.addEventListener('submit', async event => {
      event.preventDefault();
      const feedback = root.querySelector('#dailyAdminFeedback');
      const button = event.currentTarget.querySelector('button[type="submit"]');
      const alternatives = Array.from(root.querySelectorAll('.daily-answer-input')).map(input => input.value.trim()).filter(Boolean);
      button.disabled = true;
      feedback.textContent = 'Salvando...';
      try {
        await api('', { method: 'POST', body: JSON.stringify({ action: 'question', data: dateInput.value, pergunta: root.querySelector('#dailyQuestionText').value, alternativas: alternatives, resposta_correta: Number(root.querySelector('#dailyCorrectAnswer').value), explicacao: root.querySelector('#dailyQuestionExplanation').value }) });
        renderAdmin(root, await api('?view=admin'));
        const updated = root.querySelector('#dailyAdminFeedback');
        if (updated) updated.textContent = 'Pergunta salva com sucesso.';
      } catch (error) { feedback.textContent = error.message; button.disabled = false; }
    });
    root.querySelectorAll('.daily-edit-question').forEach(button => button.addEventListener('click', () => {
      const question = data.questions[Number(button.dataset.index)];
      if (!question) return;
      dateInput.value = question.data;
      root.querySelector('#dailyQuestionText').value = question.pergunta;
      root.querySelectorAll('.daily-answer-input').forEach((input, index) => { input.value = question.alternativas[index] || ''; });
      root.querySelector('#dailyCorrectAnswer').value = String(question.resposta_correta);
      root.querySelector('#dailyQuestionExplanation').value = question.explicacao || '';
      root.querySelector('#dailyQuestionText').focus();
      root.querySelector('#dailyQuestionForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }));
    root.querySelector('#dailyClearFormBtn')?.addEventListener('click', () => {
      root.querySelector('#dailyQuestionForm').reset();
      dateInput.value = data.date;
      root.querySelector('#dailyQuestionText').focus();
    });
  }

  async function openAdmin() {
    const overlay = document.getElementById('dailyAdminOverlay');
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
    const root = document.getElementById('dailyAdminContent');
    root.innerHTML = '<div class="daily-loading"><div class="spinner"></div><p>Carregando...</p></div>';
    try { renderAdmin(root, await api('?view=admin')); }
    catch (error) { root.innerHTML = `<div class="daily-error"><h2>Erro ao carregar</h2><p>${safe(error.message)}</p></div>`; }
  }

  function initAdmin() {
    const row = document.querySelector('#adminContent .btn-row');
    if (!row || document.getElementById('dailyAdminBtn')) return;
    const button = document.createElement('button');
    button.className = 'btn-small';
    button.id = 'dailyAdminBtn';
    button.type = 'button';
    button.textContent = 'Desafio diário';
    row.appendChild(button);
    document.body.insertAdjacentHTML('beforeend', adminOverlayMarkup());
    button.addEventListener('click', openAdmin);
    document.getElementById('dailyAdminClose').addEventListener('click', () => {
      const overlay = document.getElementById('dailyAdminOverlay');
      overlay.classList.remove('open');
      overlay.setAttribute('aria-hidden', 'true');
    });
  }

  async function init() {
  document.addEventListener('app-role-ready', init);
    for (let attempt = 0; attempt < 100 && !document.body.dataset.role; attempt += 1) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    if (document.body.dataset.role === 'colaborador') await initCollaborator();
    else if (document.body.dataset.role === 'admin') initAdmin();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
