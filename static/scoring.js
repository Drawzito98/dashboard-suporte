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

function loadScoringRules(){
  const parsed=typeof getSettingsConfirmed==='function'?getSettingsConfirmed('scoring')?.value:null;
  const defaults=Object.fromEntries(DEFAULT_SCORING_RULES.map(r=>[r.id,r]));
  scoringRules=Array.isArray(parsed)&&parsed.length?parsed.map(r=>defaults[r.id]?{...defaults[r.id],defaultValue:r.id==='transferido'?0:r.defaultValue}:{...r}):JSON.parse(JSON.stringify(DEFAULT_SCORING_RULES));
}
async function saveScoringRules(value,id){return dbScoringSave(value,id);}
function resetScoringRules(){if(!requireAdmin()||SettingsDrafts.busy('scoring'))return;SettingsDrafts.store('scoring',DEFAULT_SCORING_RULES);renderScoringRules();}

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
        const bonusList = (typeof getPontosExtrasLocal==='function'?getPontosExtrasLocal():JSON.parse(appStorage.getItem('sistema_pontos_extras_v1') || '[]'));
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

function renderScoringRules(){
  const host=document.getElementById('scoringRulesContainer');if(!host||SettingsDrafts.busy('scoring'))return;
  const draft=SettingsDrafts.working('scoring',scoringRules),admin=document.body.dataset.role==='admin';
  host.innerHTML=`<p>Edite os pesos e salve para aplicar. Os indicadores usam a última configuração confirmada.</p><p id="settingsMessage-scoring" role="status" aria-live="polite"></p>`+draft.map(rule=>`<label class="config-rule"><span class="config-rule-icon">${escapeHtml(rule.icon||'')}</span><span class="config-rule-info"><span class="config-rule-name" style="display:block">${escapeHtml(rule.name)}</span><span class="config-rule-desc" style="display:block">${escapeHtml(rule.desc)}</span></span><input type="number" class="config-rule-input" aria-label="Peso de ${escapeHtml(rule.name)}" data-rule-id="${escapeHtml(rule.id)}" value="${rule.id==='transferido'?0:rule.defaultValue}" step="0.5"${!admin||rule.id==='transferido'?' disabled':''}></label>`).join('')+`<button class="btn-primary" id="scoringSave" type="button"${!admin?' disabled':''}>Salvar pontuação</button> <button class="btn-small" id="scoringDiscard" type="button">Descartar edição</button>`;
  SettingsDrafts.restore('scoring',host);
  host.querySelectorAll('input').forEach(el=>el.addEventListener('input',()=>SettingsDrafts.capture('scoring',draft,host)));
  document.getElementById('scoringDiscard')?.addEventListener('click',()=>{if(SettingsDrafts.discard('scoring'))renderScoringRules();});
  document.getElementById('scoringSave')?.addEventListener('click',()=>{
    if(!SettingsDrafts.capture('scoring',draft,host))return;
    let valid=true;host.querySelectorAll('input').forEach(el=>{const value=Number(el.value),row=draft.find(r=>r.id===el.dataset.ruleId);if(el.value===''||!Number.isFinite(value)){el.setAttribute('aria-invalid','true');valid=false;}else if(row)row.defaultValue=row.id==='transferido'?0:value;});
    if(!valid){SettingsDrafts.message('scoring','Informe pesos numéricos válidos.');return;}
    SettingsDrafts.save('scoring',draft,host,saveScoringRules,renderScoringRules);
  });
}
loadScoringRules();
