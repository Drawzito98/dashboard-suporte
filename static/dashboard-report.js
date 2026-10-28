// Geração textual do Dashboard; fórmulas e escopo existentes preservados.
(function (root) {
function buildReportText() {
  const now = new Date();
  const setorVal = setorSelect.value;
  const mesVal = getActiveMonths();
  const arquivoVal = arquivoSelect ? arquivoSelect.value : 'all';

  const rows = getCurrentFilteredRows();
  if (!rows.length) return 'Sem dados no escopo atual.';

  const sum = (key) => rows.reduce((s, r) => s + (parseInt(r[key]) || 0), 0);
  const totalAss = sum('Assumidos');
  const totalFin = sum('Finalizados');
  const totalTrans = sum('Transferidos');

  const avgScore = avgScoreBySetor(rows);

  const produtividade = totalAss > 0 ? (totalFin / totalAss) : null;
  const taxaTrans = totalAss > 0 ? (totalTrans / totalAss) : null;

  const scope = [];
  if (arquivoVal !== 'all') scope.push(`Arquivo: ${arquivoVal}`);
  if (setorVal !== 'all') scope.push(`Setor: ${setorVal}`);
  if (mesVal.length) scope.push(`Período: ${getMonthScopeLabel()}`);
  if (presentationMode) scope.push('Modo apresentação ativo');
  const q = (searchAtendenteInput?.value || '').trim();
  if (q) scope.push(`Busca: ${q}`);

  const byAtt = {};
  rows.forEach(r => {
    const a = String(r['Atendente'] || '').trim();
    if (!a) return;
    if (!byAtt[a]) byAtt[a] = { Assumidos:0, Finalizados:0, Transferidos:0, scores:[] };
    byAtt[a].Assumidos += parseInt(r['Assumidos']) || 0;
    byAtt[a].Finalizados += parseInt(r['Finalizados']) || 0;
    byAtt[a].Transferidos += parseInt(r['Transferidos']) || 0;
    const sc = r['SCORE'];
    if (sc !== null && sc !== undefined && !Number.isNaN(Number(sc))) byAtt[a].scores.push(Number(sc));
  });

  const aliasMap = buildAliasMap(Object.keys(byAtt));
  const ranking = Object.entries(byAtt).map(([name, v]) => {
    const sc = v.scores.length ? (v.scores.reduce((a,b)=>a+b,0)/v.scores.length) : null;
    const prod = v.Assumidos>0 ? (v.Finalizados/v.Assumidos) : null;
    return { name, displayName: getDisplayName(name, aliasMap), ...v, avgScore: sc, prod };
  });

  const topFin = ranking.slice().sort((a,b)=>b.Finalizados-a.Finalizados);
  const topScore = ranking.filter(x=>x.avgScore!==null).sort((a,b)=>b.avgScore-a.avgScore);
  const lowScore = ranking.filter(x=>x.avgScore!==null).sort((a,b)=>a.avgScore-b.avgScore);

  function fmtInt(n){ return (Number(n)||0).toLocaleString('pt-BR'); }
  function fmtScore(n){ return (n===null||n===undefined||Number.isNaN(n)) ? '—' : n.toFixed(2); }
  function fmtPct(n){ return (n===null||n===undefined||Number.isNaN(n)) ? '—' : (n*100).toFixed(1)+'%'; }

  const SEP = '────────────────────────────────────────────';
  const L = [];
  L.push('📊 RELATÓRIO EXECUTIVO');
  L.push(now.toLocaleString('pt-BR', { hour12:false }));
  L.push(scope.length ? `Escopo: ${scope.join(' · ')}` : 'Escopo: todos os dados importados');
  L.push('');

  // ── RESUMO ──
  L.push(SEP);
  L.push('  RESUMO DO PERÍODO');
  L.push(SEP);
  L.push('');
  L.push(`  Finalizados . . . . . . . . . ${fmtInt(totalFin)}`);
  L.push(`  Assumidos  . . . . . . . . . . ${fmtInt(totalAss)}`);
  L.push(`  Transferidos  . . . . . . . . ${fmtInt(totalTrans)}${taxaTrans===null?'':`  (taxa ${fmtPct(taxaTrans)})`}`);
  L.push(`  Score médio . . . . . . . . . ${fmtScore(avgScore)}`);
  L.push(`  Produtividade (Fin./Ass.) . . ${fmtPct(produtividade)}`);
  L.push(`  Colaboradores . . . . . . . . ${fmtInt(ranking.length)}`);

  // ── SETORES ──
  const bySetor = {};
  rows.forEach(r => {
    const s = String(r['Setor'] || '').trim() || '(sem setor)';
    if (!bySetor[s]) bySetor[s] = { Assumidos:0, Finalizados:0, Transferidos:0, scores:[], atendentes:new Set() };
    bySetor[s].Assumidos += parseInt(r['Assumidos']) || 0;
    bySetor[s].Finalizados += parseInt(r['Finalizados']) || 0;
    bySetor[s].Transferidos += parseInt(r['Transferidos']) || 0;
    const sc0 = r['SCORE'];
    if (sc0 !== null && sc0 !== undefined && !Number.isNaN(Number(sc0))) bySetor[s].scores.push(Number(sc0));
    const a0 = String(r['Atendente'] || '').trim();
    if (a0) bySetor[s].atendentes.add(a0);
  });
  const setoresOrd = Object.entries(bySetor).sort((a,b)=>b[1].Finalizados-a[1].Finalizados);
  if (setoresOrd.length > 0 || setorVal === 'all') {
    L.push('');
    L.push(SEP);
    L.push('  DADOS POR SETOR');
    L.push(SEP);
    setoresOrd.forEach(([nome, v]) => {
      const sc2 = v.scores.length ? (v.scores.reduce((a,b)=>a+b,0)/v.scores.length) : null;
      const prod2 = v.Assumidos>0 ? (v.Finalizados/v.Assumidos) : null;
      const taxT = v.Assumidos>0 ? (v.Transferidos/v.Assumidos) : null;
      L.push('');
      L.push(`  ▸ ${nome}   ·   ${v.atendentes.size} atendente${v.atendentes.size===1?'':'s'}`);
      L.push(`      Finalizados . . . . . ${fmtInt(v.Finalizados)}`);
      L.push(`      Assumidos  . . . . . . ${fmtInt(v.Assumidos)}`);
      L.push(`      Transferidos  . . . . ${fmtInt(v.Transferidos)}${taxT===null?'':`  (taxa ${fmtPct(taxT)})`}`);
      L.push(`      Score médio . . . . . ${fmtScore(sc2)}`);
      L.push(`      Produtividade . . . . ${fmtPct(prod2)}`);
    });
  }

  // ── DESTAQUES ✅ ──
  L.push('');
  L.push(SEP);
  L.push('  ✅ DESTAQUES');
  L.push(SEP);
  const destaques = [];
  if (topFin.length && topFin[0].Finalizados > 0) {
    destaques.push(`  ✅ ${topFin[0].displayName} liderou em finalizações com ${fmtInt(topFin[0].Finalizados)}.`);
  }
  if (topScore.length && topScore[0].avgScore >= 4.5) {
    destaques.push(`  ✅ ${topScore[0].displayName} teve o maior score (${fmtScore(topScore[0].avgScore)}).`);
  }
  const highProd = ranking.filter(x => x.prod !== null && x.prod >= 0.85 && x.Assumidos >= 5);
  if (highProd.length) {
    const nomes = highProd.slice(0, 3).map(x => x.displayName).join(', ');
    destaques.push(`  ✅ Produtividade alta (≥85%): ${nomes}.`);
  }
  if (ranking.filter(x => x.avgScore !== null && x.avgScore >= 4.70).length >= 3) {
    destaques.push(`  ✅ ${ranking.filter(x => x.avgScore >= 4.70).length} colaboradores com score ≥ 4,70 — qualidade consistente.`);
  }
  if (avgScore !== null && avgScore >= 4.2) {
    destaques.push(`  ✅ Score médio da equipe em ${fmtScore(avgScore)} — acima do ideal.`);
  }
  if (taxaTrans !== null && taxaTrans < 0.15) {
    destaques.push(`  ✅ Baixa taxa de transferências (${fmtPct(taxaTrans)}).`);
  }
  if (produtividade !== null && produtividade >= 0.85) {
    destaques.push(`  ✅ Produtividade da equipe em ${fmtPct(produtividade)}.`);
  }
  if (!destaques.length) destaques.push('  ℹ️  Nenhum destaque relevante neste período.');
  L.push('');
  destaques.forEach(d => L.push(d));
  L.push('');

  // ── PONTOS DE ATENÇÃO ⚠️ ──
  L.push(SEP);
  L.push('  ⚠️ PONTOS DE ATENÇÃO');
  L.push(SEP);
  const atencoes = [];
  if (avgScore !== null && avgScore < 4.2) {
    atencoes.push(`  ⚠️  Score médio abaixo de 4,20 (${fmtScore(avgScore)}).`);
  }
  if (taxaTrans !== null && taxaTrans > 0.25) {
    atencoes.push(`  ⚠️  Taxa de transferências acima de 25% (${fmtPct(taxaTrans)}).`);
  }
  if (produtividade !== null && produtividade < 0.75) {
    atencoes.push(`  ⚠️  Produtividade abaixo de 75% (${fmtPct(produtividade)}).`);
  }
  const lowProdList = ranking.filter(x => x.prod !== null && x.prod < 0.6 && x.Assumidos >= 3);
  if (lowProdList.length) {
    atencoes.push(`  ⚠️  Produtividade baixa: ${lowProdList.slice(0, 3).map(x => x.displayName).join(', ')}${lowProdList.length > 3 ? ` e mais ${lowProdList.length - 3}` : ''}.`);
  }
  if (lowScore.length) {
    const abaixo70 = lowScore.filter(x => x.avgScore < 4.70);
    if (abaixo70.length) {
      atencoes.push(`  ⚠️  Score abaixo da meta (4,70): ${abaixo70.slice(0, 3).map(x => `${x.displayName} (${fmtScore(x.avgScore)})`).join(', ')}${abaixo70.length > 3 ? ` e mais ${abaixo70.length - 3}` : ''}.`);
    }
  }
  if (!atencoes.length) atencoes.push('  ✅  Nenhum ponto crítico identificado neste período.');
  L.push('');
  atencoes.forEach(a => L.push(a));
  L.push('');

  // ── TOP — FINALIZADOS ──
  const top5fin = topFin.slice(0, 5);
  L.push(SEP);
  L.push('  TOP 5 — FINALIZADOS');
  L.push(SEP);
  L.push('');
  top5fin.forEach((x, i) => {
    L.push(`  ${i+1}.  ${x.displayName}  —  ${fmtInt(x.Finalizados)}   (Score: ${fmtScore(x.avgScore)} · Prod.: ${fmtPct(x.prod)})`);
  });

  // ── TOP — SCORE ──
  L.push('');
  L.push(SEP);
  L.push('  TOP 5 — SCORE');
  L.push(SEP);
  L.push('');
  const top5score = topScore.slice(0, 5);
  if (top5score.length) {
    top5score.forEach((x, i) => {
      L.push(`  ${i+1}.  ${x.displayName}  —  ${fmtScore(x.avgScore)}   (Final.: ${fmtInt(x.Finalizados)} · Transf.: ${fmtInt(x.Transferidos)})`);
    });
  } else {
    L.push('  ℹ️  Sem score no escopo.');
  }

  // ── PONTOS DE ATENÇÃO — MENORES SCORES ──
  L.push('');
  L.push(SEP);
  L.push('  PONTOS DE ATENÇÃO — MENORES SCORES');
  L.push(SEP);
  L.push('');
  const bottom5 = lowScore.slice(0, 5);
  if (bottom5.length) {
    bottom5.forEach((x, i) => {
      L.push(`  ${i+1}.  ${x.displayName}  —  ${fmtScore(x.avgScore)}   (Transf.: ${fmtInt(x.Transferidos)} · Prod.: ${fmtPct(x.prod)})`);
    });
  } else {
    L.push('  ℹ️  Sem score no escopo.');
  }

  // ── RESUMO POR COLABORADOR ──
  L.push('');
  L.push(SEP);
  L.push('  RESUMO POR COLABORADOR');
  L.push(SEP);
  L.push('');
  ranking.sort((a,b) => b.Finalizados - a.Finalizados).forEach(x => {
    const varScore = x.avgScore !== null && avgScore !== null && avgScore > 0
      ? ((x.avgScore - avgScore) / avgScore * 100).toFixed(1) : null;
    const sinal = varScore !== null ? (Number(varScore) >= 0 ? '+' : '') : '';
    L.push(`  ${x.displayName.padEnd(20)} Fin: ${fmtInt(x.Finalizados).padStart(5)} | Score: ${fmtScore(x.avgScore).padStart(5)}${varScore !== null ? ` (${sinal}${varScore}% vs time)` : ''} | Prod.: ${fmtPct(x.prod).padStart(5)}`);
  });

  return L.join('\n');
}



root.DashboardReport = { build: buildReportText };
})(window);
