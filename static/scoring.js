// Scoring rules engine — configurável e persistente
const SCORING_STORAGE_KEY = 'sistema_scoring_rules_v1';
const DEFAULT_SCORING_RULES = [
  { id: 'finalizado', name: 'Finalizado', desc: 'Por cada chamado finalizado', icon: '✅', defaultValue: 1, key: 'Finalizados' },
  { id: 'score_alto', name: 'Score alto (>= 4.70)', desc: 'Score >= 4.70 pontos', icon: '⭐', defaultValue: 2, key: 'SCORE', threshold: 4.70 },
  { id: 'meta_atingida', name: 'Meta atingida', desc: 'Objetivo do mês cumprido', icon: '🎯', defaultValue: 5, key: 'Objetivo' },
  { id: 'nota_baixa', name: 'Nota baixa', desc: 'Score abaixo de 4.70', icon: '⚠️', defaultValue: -3, key: 'SCORE', threshold: 4.70, negative: true },
  { id: 'assumido', name: 'Chamado assumido', desc: 'Por cada chamado assumido', icon: '📞', defaultValue: 0.5, key: 'Assumidos' },
  { id: 'transferido', name: 'Transferido', desc: 'Por cada chamado transferido (neutro)', icon: '🔄', defaultValue: 0, key: 'Transferidos' },
  { id: 'pontos_extras', name: 'Bônus manual', desc: 'Pontos extras atribuídos manualmente (auxílio, projetos, etc)', icon: '🌟', defaultValue: 1, key: 'Bonus' },
];

let scoringRules = [];

function loadScoringRules() {
  try {
    const raw = localStorage.getItem(SCORING_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) {
        // Merge saved rules with defaults to refresh labels/descriptions
        const defaultMap = {};
        DEFAULT_SCORING_RULES.forEach(d => { defaultMap[d.id] = d; });
        scoringRules = parsed.map(r => {
          if (defaultMap[r.id]) {
            const merged = { ...defaultMap[r.id], defaultValue: r.defaultValue };
            if (r.id === 'transferido') merged.defaultValue = 0;
            return merged;
          }
          return r;
        });
        saveScoringRules();
        return;
      }
    }
  } catch (e) { console.error('[Scoring] Erro:', e); }
  scoringRules = JSON.parse(JSON.stringify(DEFAULT_SCORING_RULES));
}

function saveScoringRules() {
  try {
    localStorage.setItem(SCORING_STORAGE_KEY, JSON.stringify(scoringRules));
  } catch (e) { console.error('[Scoring] Erro:', e); }
  if (typeof dbScoringSave === 'function') {
    dbScoringSave(scoringRules);
  }
}

function resetScoringRules() {
  scoringRules = JSON.parse(JSON.stringify(DEFAULT_SCORING_RULES));
  saveScoringRules();
  renderScoringRules();
}

function computeScoreForCollaborator(name, records) {
  const rows = (records || []).filter(r => r && String(r['Atendente']) === name);
  let totalScore = 0;
  const breakdown = {};

  scoringRules.forEach(rule => {
    let points = 0;
    if (rule.id === 'finalizado') {
      points = rows.reduce((s, r) => s + (parseInt(r['Finalizados']) || 0), 0) * (rule.defaultValue || 0);
    } else if (rule.id === 'assumido') {
      points = rows.reduce((s, r) => s + (parseInt(r['Assumidos']) || 0), 0) * (rule.defaultValue || 0);
    } else if (rule.id === 'transferido') {
      points = rows.reduce((s, r) => s + (parseInt(r['Transferidos']) || 0), 0) * (rule.defaultValue || 0);
    } else if (rule.id === 'score_alto') {
      const threshold = rule.threshold || 4.5;
      const count = rows.filter(r => {
        const sc = r['SCORE'];
        return sc !== null && sc !== undefined && Number(sc) >= threshold;
      }).length;
      points = count * (rule.defaultValue || 0);
    } else if (rule.id === 'nota_baixa') {
      const threshold = rule.threshold || 4.5;
      const count = rows.filter(r => {
        const sc = r['SCORE'];
        return sc !== null && sc !== undefined && Number(sc) < threshold;
      }).length;
      points = count * (rule.defaultValue || 0);
    } else if (rule.id === 'meta_atingida') {
      points = rows.reduce((s, r) => {
        const obj = parseInt(r['Objetivo']) || 0;
        const fin = parseInt(r['Finalizados']) || 0;
        return s + (obj > 0 && fin >= obj ? (rule.defaultValue || 0) : 0);
      }, 0);
    } else if (rule.id === 'pontos_extras') {
      try {
        const bonusList = JSON.parse(localStorage.getItem('sistema_pontos_extras_v1') || '[]');
        const meses = [...new Set(rows.filter(r => r && r['Mês']).map(r => r['Mês']))];
        let filteredBonus = bonusList.filter(b => String(b.colaborador) === name);
        if (meses.length > 0) {
          filteredBonus = filteredBonus.filter(b => b.mes && meses.includes(b.mes));
        }
        const sum = filteredBonus.reduce((s, b) => s + (parseFloat(b.pontos) || 0), 0);
        points = sum * (rule.defaultValue || 0);
      } catch { points = 0; }
    }
    breakdown[rule.id] = points;
    totalScore += points;
  });

  return { total: Math.round(totalScore * 100) / 100, breakdown };
}

function getOverallRanking(records) {
  const names = [...new Set((records || []).filter(r => r && r['Atendente']).map(r => r['Atendente']))].filter(n => isColabActive(n));
  const scores = names.map(name => ({
    name,
    score: computeScoreForCollaborator(name, records)
  }));
  scores.sort((a, b) => b.score.total - a.score.total);
  return scores;
}

function renderScoringRules() {
  const container = document.getElementById('scoringRulesContainer');
  if (!container) return;
  if (!scoringRules.length) loadScoringRules();

  container.innerHTML = scoringRules.map(rule => `
    <div class="config-rule">
      <div class="config-rule-icon">${rule.icon}</div>
      <div class="config-rule-info">
        <div class="config-rule-name">${escapeHtml(rule.name)}</div>
        <div class="config-rule-desc">${escapeHtml(rule.desc)}</div>
      </div>
      <input type="number" class="config-rule-input" data-rule-id="${escapeHtml(rule.id)}" value="${rule.defaultValue}" step="0.5"/>
    </div>
  `).join('');

  container.querySelectorAll('.config-rule-input').forEach(input => {
    input.addEventListener('change', (e) => {
      if (!requireAdmin()) return;
      const id = e.target.getAttribute('data-rule-id');
      const val = parseFloat(e.target.value) || 0;
      const rule = scoringRules.find(r => r.id === id);
      if (rule) {
        rule.defaultValue = val;
        saveScoringRules();
        // Refresh gamification if visible
        if (typeof renderGamification === 'function') renderGamification();
      }
    });
  });
}

// Initialize on load
loadScoringRules();
