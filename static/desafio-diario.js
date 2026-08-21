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
  let rankingRefreshTimer = null;
  let challengeCountdownTimer = null;

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

  function metricCell(display, current, previous) {
    return '<span class="metric-value">' + display + '</span>' + trendMarkup(current, previous);
  }

  function monthlyRowMarkup(item, previous) {
    const assumed = Number(item.assumed || 0);
    const completed = Number(item.completed || 0);
    const transferred = Number(item.transferred || 0);
    const score = item.averageScore == null ? '—' : Number(item.averageScore).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const productivity = item.productivity == null ? '—' : Number(item.productivity).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%';
    return '<tr data-month="' + safe(item.month) + '"><td>' + safe(formatMonth(item.month)) + '</td><td>' + safe((item.sectors || []).join(', ') || '—') + '</td>' +
      '<td>' + metricCell(assumed.toLocaleString('pt-BR'), assumed, previous?.assumed) + '</td>' +
      '<td>' + metricCell(completed.toLocaleString('pt-BR'), completed, previous?.completed) + '</td>' +
      '<td>' + metricCell(transferred.toLocaleString('pt-BR'), transferred, previous?.transferred) + '</td>' +
      '<td>' + metricCell(score, item.averageScore, previous?.averageScore) + '</td>' +
      '<td>' + metricCell(productivity, item.productivity, previous?.productivity) + '</td></tr>';
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
        ${months.map((item, index) => monthlyRowMarkup(item, months[index + 1])).join('')}
      </tbody></table></div>` : '<div class="daily-empty"><span>📊</span><strong>Nenhum resultado encontrado</strong><p>Ainda não há registros mensais associados ao seu nome.</p></div>'}
    </article>`;
  }

  function engagementSummaryMarkup(stats = {}) {
    const participations = Number(stats.participations || 0);
    const goal = Number(stats.monthlyGoal || 15);
    const progress = Math.min(100, Math.round(participations / goal * 100));
    const weeklyParticipations = Number(stats.weeklyParticipations || 0);
    const weeklyCorrect = Number(stats.weeklyCorrect || 0);
    const achievements = Array.isArray(stats.achievements) ? stats.achievements : [];
    const weekText = weeklyParticipations
      ? 'Nesta semana: ' + weeklyParticipations + (weeklyParticipations === 1 ? ' participação' : ' participações') + ' · ' + weeklyCorrect + (weeklyCorrect === 1 ? ' acerto' : ' acertos')
      : 'Sua semana começa na primeira resposta.';
    const milestone = stats.nextMilestone ? 'Próxima ofensiva: ' + Number(stats.nextMilestone) + ' dias' : 'Todos os marcos de ofensiva alcançados';
    return '<section class="engagement-summary" aria-label="Seu progresso pessoal"><div class="engagement-goal"><div><strong>Meta do mês</strong><span>' + participations + ' de ' + goal + ' participações</span></div><span>' + progress + '%</span></div>' +
      '<div class="engagement-progress" role="progressbar" aria-valuemin="0" aria-valuemax="' + goal + '" aria-valuenow="' + participations + '"><i style="width:' + progress + '%"></i></div>' +
      '<div class="engagement-details"><span>' + safe(weekText) + '</span><span>' + safe(milestone) + '</span></div>' +
      '<div class="achievement-list">' + (achievements.length ? achievements.map(item => '<span title="Conquista desbloqueada">' + safe(item.icon) + ' ' + safe(item.label) + '</span>').join('') : '<small>✨ Sua primeira conquista chega ao responder.</small>') + '</div></section>';
  }
  function liveRankingMarkup(ranking) {
    if (!ranking || ranking.locked) return '<section class="daily-card live-ranking-card" id="liveChallengeRanking"><div class="live-ranking-heading"><div><span class="daily-kicker">Ranking mensal</span><h3>Classificação da equipe</h3></div><small>Atualizando...</small></div></section>';
    const top = Array.isArray(ranking.top) ? ranking.top : [];
    const me = ranking.me;
    const medals = ['🥇', '🥈', '🥉'];
    const row = item => '<div class="live-ranking-row' + (item.isCurrentUser ? ' is-me' : '') + '"><span class="live-rank-position">' + (medals[item.position - 1] || item.position + 'º') + '</span><strong>' + safe(item.name) + (item.isCurrentUser ? ' <small>você</small>' : '') + '</strong><span>' + Number(item.points || 0) + ' pts</span><small>🔥 ' + Number(item.streak || 0) + ' · 🎯 ' + Number(item.accuracy || 0) + '%</small></div>';
    const ownOutsideTop = me && !top.some(item => item.isCurrentUser);
    const updated = ranking.updatedAt ? new Date(ranking.updatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
    return '<section class="daily-card live-ranking-card" id="liveChallengeRanking"><div class="live-ranking-heading"><div><span class="daily-kicker">Ranking mensal</span><h3>Classificação da equipe</h3></div><small>Atualizado ' + safe(updated) + '</small></div><div class="live-ranking-list">' + top.map(row).join('') + (ownOutsideTop ? '<div class="live-ranking-divider"></div>' + row(me) : '') + '</div><p>Pontos definem a posição; ofensiva e acertos resolvem empates.</p></section>';
  }
  function learningRecapMarkup(recap) {
    if (!recap) return '';
    return '<aside class="learning-recap"><span>💡 Aprendizado anterior</span><strong>' + safe(recap.pergunta) + '</strong><p>' + safe(recap.explicacao) + '</p></aside>';
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
      '<p>' + (result.acertou ? 'Você acertou e ganhou 2 pontos no total.' : 'Você ganhou 1 ponto por participar. Amanhã tem uma nova chance!') + '</p>' +
      '<div class="celebration-streak"><span>🔥</span><strong>' + streak + '</strong><small>' + (streak === 1 ? 'dia de ofensiva' : 'dias de ofensiva') + '</small></div>' +
      '<p class="celebration-message">' + (streak > 1 ? 'Você manteve sua sequência. Continue assim!' : 'Sua ofensiva começou. Volte amanhã para continuar!') + '</p>' +
      (result.explanationAvailableTomorrow ? '<div class="celebration-explanation"><strong>Explicação protegida</strong><span>Ela será liberada amanhã, depois que a equipe concluir o desafio.</span></div>' : '') +
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


  function dailyPetMarkup(data) {
    const messages = [
      "Um passo de cada vez também leva longe.",
      "Seu conhecimento cresce um pouco todos os dias.",
      "Consistência vale mais do que perfeição.",
      "Hoje é uma boa oportunidade para aprender algo novo.",
      "Seu esforço de hoje já conta.",
      "Continue curioso. Você está evoluindo.",
      "Pequenos avanços criam grandes resultados."
    ];
    const seed = String(data.date || "").split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
    const streak = Number(data.stats?.streak || 0);
    let message = messages[seed % messages.length];
    if (data.answer?.acertou) message = "Mandou bem no desafio! Seu conhecimento brilhou hoje.";
    else if (data.answer) message = "Cada tentativa ensina algo. Amanhã tem uma nova chance!";
    else if (streak >= 5) message = "Essa ofensiva está incrível. Vamos manter o ritmo!";
    const state = data.answer ? " is-celebrating" : streak >= 5 ? " is-on-fire" : "";
    return `<aside class="daily-pet${state}" aria-label="Mensagem diária do Batman"><div class="daily-pet-bubble"><strong>Batman</strong><span>${safe(message)}</span></div><div class="daily-pet-character" aria-hidden="true"><i>✨</i><span>🦇</span></div></aside>`;
  }

  function profileAvatarMarkup(data) {
    const fullName = data.personalResults?.collaborator || data.name || '';
    const initials = String(fullName).split(/\s+/).filter(Boolean).map(part => part[0]).join('').slice(0, 2).toUpperCase() || '🙂';
    const rawUrl = data.personalResults?.photoUrl || '';
    const photoUrl = rawUrl && typeof normalizeFotoUrl === 'function' ? normalizeFotoUrl(rawUrl) : rawUrl;
    return photoUrl
      ? '<img class="daily-profile-avatar" src="' + safe(photoUrl) + '" alt="Foto de ' + safe(fullName) + '">'
      : '<span class="daily-profile-avatar daily-profile-initials">' + safe(initials) + '</span>';
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
          <div class="daily-profile">${profileAvatarMarkup(data)}<div>
            <span class="daily-kicker">${safe(formatDate(data.date))}</span>
            <h1>Olá, ${safe(String(data.name || '').split(' ')[0])}!</h1>
            <p>Reserve um minuto para registrar seu dia e participar do desafio.</p>
          </div></div>
          ${dailyPetMarkup(data)}
        </div>
        <div class="daily-stats" aria-label="Seu desempenho no mês">
          <div><strong>${Number(data.stats?.points || 0)}</strong><span>Pontos no mês</span></div>
          <div><strong>${Number(data.stats?.participations || 0)}</strong><span>Participações</span></div>
          <div><strong>🔥 ${Number(data.stats?.streak || 0)}</strong><span>Ofensiva</span></div>
        </div>
        ${engagementSummaryMarkup(data.stats)}
        ${learningRecapMarkup(data.learningRecap)}
        <article class="daily-card mood-card">
          <div class="daily-card-heading"><span class="daily-step">1</span><div><h2>Como você está hoje?</h2><p>Seu registro é confidencial e ajuda a liderança a cuidar melhor do time.</p></div></div>
          <div class="mood-options" role="radiogroup" aria-label="Como você está se sentindo">
            ${moods.map(mood => `<button type="button" class="mood-option${selectedMood === mood.value ? ' selected' : ''}" data-mood="${mood.value}" aria-label="${mood.label}" aria-pressed="${selectedMood === mood.value}" ${selectedMood ? 'disabled' : ''}><span>${mood.emoji}</span><small>${mood.label}</small></button>`).join('')}
          </div>
          <p class="daily-feedback" id="moodFeedback">${selectedMood ? 'Check-in registrado. Obrigado por compartilhar!' : ''}</p>
        </article>
        <article class="daily-card challenge-card">
          <div class="daily-card-heading"><span class="daily-step">2</span><div><h2>Desafio do dia</h2><p>Uma pergunta diária para fortalecer seu conhecimento sobre o IXC Provedor.</p></div></div>
          ${answered ? challengeCompletedMarkup() : question ? `<div class="challenge-timer" id="challengeTimer" role="timer"><span>Tempo para responder</span><strong>01:00</strong></div><div class="challenge-question">${safe(question.pergunta)}</div>
            <div class="challenge-options">
              ${question.alternativas.map((option, index) => `<button type="button" class="challenge-option${answered?.alternativa === index ? ' selected' : ''}" data-answer="${index}" ${answered ? 'disabled' : ''}><span>${String.fromCharCode(65 + index)}</span>${safe(option)}</button>`).join('')}
            </div>
            <button type="button" class="btn-primary challenge-submit" id="challengeSubmit" ${answered ? 'disabled' : ''}>${answered ? 'Resposta enviada' : 'Confirmar resposta'}</button>
            <div class="challenge-result${answered ? (answered.acertou ? ' is-correct' : ' is-wrong') : ''}" id="challengeResult">${answered ? (answered.acertou ? '🎉 Resposta correta! Você ganhou 2 pontos no total.' : 'Resposta registrada! Você ganhou 1 ponto por participar.') : ''}</div>`
            : '<div class="daily-empty"><span>📚</span><strong>Sem desafio programado para hoje</strong><p>Volte mais tarde ou continue sua ofensiva no próximo dia útil.</p></div>'}
        </article>
        ${answered ? liveRankingMarkup(data.ranking) : ''}
        ${personalResultsMarkup(data.personalResults)}
        <p class="daily-privacy">Seu sentimento individual é visível apenas para a gestão. O ranking considera somente o desafio de conhecimento.</p>
      </div>`;

    if (rankingRefreshTimer) clearInterval(rankingRefreshTimer);
    if (answered) {
      rankingRefreshTimer = setInterval(async () => {
        try {
          const ranking = await api('?view=ranking');
          const current = root.querySelector('#liveChallengeRanking');
          if (current && !ranking.locked) current.outerHTML = liveRankingMarkup(ranking);
        } catch {}
      }, 30000);
    }

    if (challengeCountdownTimer) clearInterval(challengeCountdownTimer);
    if (!answered && question) {
      const timer = root.querySelector('#challengeTimer');
      const startedAt = Date.now();
      const limit = Number(question.timeLimit || 60);
      const updateTimer = () => {
        const remaining = Math.max(0, limit - Math.floor((Date.now() - startedAt) / 1000));
        if (timer) {
          timer.querySelector('strong').textContent = '00:' + String(remaining).padStart(2, '0');
          timer.classList.toggle('is-urgent', remaining <= 10);
        }
        if (remaining <= 0) {
          clearInterval(challengeCountdownTimer);
          root.querySelectorAll('.challenge-option').forEach(item => { item.disabled = true; });
          const submit = root.querySelector('#challengeSubmit');
          if (submit) { submit.disabled = true; submit.textContent = 'Tempo encerrado'; }
          const result = root.querySelector('#challengeResult');
          if (result) result.textContent = 'O tempo terminou. Um novo desafio será liberado amanhã.';
        }
      };
      updateTimer();
      challengeCountdownTimer = setInterval(updateTimer, 250);
    }

    const periodSelect = root.querySelector('#personalResultsPeriod');
    const filterPersonalRows = selectedMonth => {
      root.querySelectorAll('.personal-results-table tbody tr').forEach(row => {
        row.hidden = Boolean(selectedMonth && row.dataset.month !== selectedMonth);
      });
    };
    periodSelect?.addEventListener('change', event => filterPersonalRows(event.currentTarget.value));
    const latestMonth = data.personalResults?.months?.[0]?.month || '';
    if (periodSelect && latestMonth) {
      periodSelect.value = latestMonth;
      filterPersonalRows(latestMonth);
    }

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
        const result = await postCollaborator('answer', { alternativa: selectedAnswer, challengeToken: question.challengeToken });
        const resultEl = root.querySelector('#challengeResult');
        resultEl.className = `challenge-result ${result.acertou ? 'is-correct' : 'is-wrong'}`;
        resultEl.innerHTML = `${result.acertou ? '🎉 Resposta correta! Você ganhou 2 pontos no total.' : 'Resposta registrada! Você ganhou 1 ponto por participar.'}${result.explanationAvailableTomorrow ? '<small>A explicação será liberada amanhã para preservar o desafio da equipe.</small>' : ''}`;
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


  function resetHistoryMarkup(rows) {
    if (!Array.isArray(rows) || !rows.length) return '<p class="reset-history-empty">Nenhum reset realizado.</p>';
    return '<div class="reset-history">' + rows.map(row => {
      let snapshot = {};
      try { snapshot = JSON.parse(row.descricao || '{}'); } catch {}
      const winner = snapshot.ranking?.[0];
      return '<div><strong>' + safe(formatMonth(row.link)) + '</strong><span>' + Number(snapshot.answers || 0) + ' respostas · ' + Number(snapshot.checkins || 0) + ' check-ins</span>' +
        (winner ? '<small>Líder arquivado: ' + safe(winner.name) + ' (' + Number(winner.points || 0) + ' pts)</small>' : '<small>Sem ranking no período</small>') +
        '<small>Zerado em ' + safe(new Date(row.created_at).toLocaleString('pt-BR')) + ' por ' + safe(row.actor_email || 'administrador') + '</small></div>';
    }).join('') + '</div>';
  }

  function rankingHighlightsMarkup(ranking) {
    if (!Array.isArray(ranking) || !ranking.length) return '';
    const pointsLeader = ranking[0];
    const streakLeader = ranking.slice().sort((a, b) => b.streak - a.streak || b.points - a.points)[0];
    const accuracyLeader = ranking.filter(item => item.participations >= 5).sort((a, b) => b.accuracy - a.accuracy || b.correct - a.correct || b.points - a.points)[0];
    return '<div class="ranking-highlights"><div><span>🏆 Pontuação</span><strong>' + safe(pointsLeader.name) + '</strong><small>' + Number(pointsLeader.points || 0) + ' pts</small></div>' +
      '<div><span>🔥 Constância</span><strong>' + safe(streakLeader.name) + '</strong><small>' + Number(streakLeader.streak || 0) + ' dias</small></div>' +
      (accuracyLeader ? '<div><span>🎯 Precisão</span><strong>' + safe(accuracyLeader.name) + '</strong><small>' + Number(accuracyLeader.accuracy || 0) + '% · mín. 5</small></div>' : '') + '</div>';
  }
  function activityReportMarkup(activity) {
    const rows = Array.isArray(activity) ? activity : [];
    const names = [...new Set(rows.map(item => item.name).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    const rowMarkup = rows.map(item => {
      const mood = moods.find(option => option.value === Number(item.mood));
      const result = !item.answered ? 'no_answer' : item.correct ? 'correct' : 'wrong';
      return '<tr data-activity-name="' + safe(item.name) + '" data-activity-result="' + result + '"><td>' + safe(formatDate(item.date)) + (item.archived ? '<small class="archive-badge">Histórico</small>' : '') + '</td>' +
        '<td>' + safe(item.name) + '</td><td>' + (mood ? mood.emoji + ' ' + safe(mood.label) : '—') + '</td>' +
        '<td class="activity-question">' + safe(item.question || '—') + '</td><td>' + safe(item.selectedAnswer || '—') + '</td>' +
        '<td><span class="activity-result is-' + result + '">' + (!item.answered ? 'Sem resposta' : item.correct ? 'Acertou' : 'Errou') + '</span></td><td>' + (item.answered ? Number(item.points || 0) : '—') + '</td></tr>';
    }).join('');
    return '<section class="daily-card activity-report-card"><div class="activity-report-heading"><div><h3>Registros da equipe</h3><p>Humor, respostas e acertos do mês selecionado.</p></div><div class="activity-filters"><select id="activityUserFilter"><option value="">Todos os colaboradores</option>' +
      names.map(name => '<option value="' + safe(name) + '">' + safe(name) + '</option>').join('') +
      '</select><select id="activityResultFilter"><option value="">Todos os resultados</option><option value="correct">Acertou</option><option value="wrong">Errou</option><option value="no_answer">Sem resposta</option></select></div></div>' +
      (rows.length ? '<div class="table-wrap"><table class="activity-report-table"><thead><tr><th>Data</th><th>Colaborador</th><th>Humor</th><th>Pergunta</th><th>Resposta</th><th>Resultado</th><th>Pontos</th></tr></thead><tbody>' + rowMarkup + '</tbody></table></div><p class="activity-empty-filter" hidden>Nenhum registro corresponde aos filtros.</p>' : '<div class="daily-empty"><p>Nenhum registro neste mês.</p></div>') + '</section>';
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
        <section class="daily-card"><div class="ranking-month-heading"><h3>Ranking do mês</h3><input id="adminRankingMonth" type="month" value="${data.month}"></div>
          ${rankingHighlightsMarkup(data.ranking)}
          ${data.ranking.length ? `<div class="daily-ranking">${data.ranking.map((item, index) => `<div><span class="daily-rank-position">${index + 1}</span><strong>${safe(item.name)}</strong><span>${item.points} pts</span><small>🔥 ${item.streak}</small></div>`).join('')}</div>` : '<div class="daily-empty"><p>Nenhuma participação neste mês.</p></div>'}
        </section>
      </div>
      ${activityReportMarkup(data.activity)}
      <section class="daily-card reset-month-card"><div class="reset-month-heading"><div><h3>Zerar mês de testes</h3><p>O ranking e os check-ins são limpos, mas um resumo permanece no histórico administrativo.</p></div><div class="reset-month-actions"><input id="resetChallengeMonth" type="month" value="${data.date.slice(0, 7)}"><button id="resetChallengeMonthBtn" class="btn-small" type="button">Zerar mês</button></div></div><p class="daily-feedback" id="resetChallengeFeedback"></p>${resetHistoryMarkup(data.resetHistory)}
      </section>
      <section class="daily-card daily-questions-list"><h3>Perguntas programadas</h3>
        ${data.questions.length ? `<div class="table-wrap"><table><thead><tr><th>Data</th><th>Pergunta</th><th>Status</th><th></th></tr></thead><tbody>${data.questions.map((question, index) => `<tr><td>${safe(formatDate(question.data))}</td><td>${safe(question.pergunta)}</td><td>${question.ativo ? 'Ativa' : 'Inativa'}</td><td><button class="btn-small daily-edit-question" type="button" data-index="${index}">Editar</button></td></tr>`).join('')}</tbody></table></div>` : '<p>Nenhuma pergunta programada.</p>'}
      </section>`;
    const dateInput = root.querySelector('#dailyQuestionDate');
    if (dateInput) dateInput.value = data.date;
    const filterActivityRows = () => {
      const selectedName = root.querySelector('#activityUserFilter')?.value || '';
      const selectedResult = root.querySelector('#activityResultFilter')?.value || '';
      let visible = 0;
      root.querySelectorAll('.activity-report-table tbody tr').forEach(row => {
        const show = (!selectedName || row.dataset.activityName === selectedName) && (!selectedResult || row.dataset.activityResult === selectedResult);
        row.hidden = !show;
        if (show) visible += 1;
      });
      const empty = root.querySelector('.activity-empty-filter');
      if (empty) empty.hidden = visible > 0;
    };
    root.querySelector('#activityUserFilter')?.addEventListener('change', filterActivityRows);
    root.querySelector('#activityResultFilter')?.addEventListener('change', filterActivityRows);
    root.querySelector('#adminRankingMonth')?.addEventListener('change', async event => {
      const month = event.currentTarget.value;
      if (!month) return;
      root.innerHTML = '<div class="daily-loading"><div class="spinner"></div><p>Carregando ranking...</p></div>';
      try { renderAdmin(root, await api('?view=admin&month=' + encodeURIComponent(month))); }
      catch (error) { root.innerHTML = '<div class="daily-error"><h2>Erro ao carregar</h2><p>' + safe(error.message) + '</p></div>'; }
    });
    root.querySelector('#resetChallengeMonthBtn')?.addEventListener('click', async event => {
      const month = root.querySelector('#resetChallengeMonth')?.value;
      const feedback = root.querySelector('#resetChallengeFeedback');
      if (!month) { feedback.textContent = 'Selecione o mês.'; return; }
      if (!confirm('Zerar respostas e check-ins de ' + formatMonth(month) + '? Um resumo ficará salvo no histórico.')) return;
      event.currentTarget.disabled = true;
      feedback.textContent = 'Salvando histórico e zerando...';
      try {
        await api('', { method: 'POST', body: JSON.stringify({ action: 'reset_month', month }) });
        renderAdmin(root, await api('?view=admin'));
        const updated = root.querySelector('#resetChallengeFeedback');
        if (updated) updated.textContent = 'Mês zerado. O resumo foi preservado no histórico.';
      } catch (error) {
        feedback.textContent = error.message;
        event.currentTarget.disabled = false;
      }
    });
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
