// Conquistas — badges automáticas por desempenho
// Módulo independente, não altera lógica existente

function _gfData() {
  return typeof globalFilters !== 'undefined' && globalFilters ? globalFilters.aplicar(rawRecords) : (rawRecords || []);
}

function renderConquistas() {
  const container = document.getElementById('conquistasContent');
  if (!container) return;
  const data = _gfData();
  if (!data || !data.length) {
    container.innerHTML = '<div class="empty-state"><div class="empty-title">Nenhum dado carregado</div><div class="empty-sub">Importe um CSV para desbloquear conquistas.</div></div>';
    return;
  }

  const rows = (data).filter(r => r && !isAggregateName(r['Atendente']));
  const cols = [...new Set(rows.map(r => r['Atendente']))].filter(Boolean);

  // Calcular dados
  const byColab = {};
  cols.forEach(name => {
    const recs = rows.filter(r => String(r['Atendente']) === name);
    const fin = recs.reduce((s, r) => s + (parseInt(r['Finalizados']) || 0), 0);
    const ass = recs.reduce((s, r) => s + (parseInt(r['Assumidos']) || 0), 0);
    const scores = recs.map(r => r['SCORE']).filter(v => v !== null && v !== undefined && !isNaN(Number(v)));
    const avgSc = scores.length ? scores.reduce((a, b) => a + Number(b), 0) / scores.length : 0;
    const mesesC = [...new Set(recs.map(r => r['Mês']))].filter(Boolean).sort();
    const prod = ass > 0 ? fin / ass : 0;
    byColab[name] = { fin, ass, avgSc, prod, meses: mesesC, qtdMeses: mesesC.length };
  });

  const ranking = Object.entries(byColab).sort((a, b) => b[1].fin - a[1].fin);
  const aliasMap = buildAliasMap(cols);

  const conquistas = [];

  // 🥇 Top Performer — top 1 em finalizações
  if (ranking.length) {
    conquistas.push({
      icone: '🥇',
      nome: 'Top Performer',
      desc: `Maior número de finalizações do período`,
      detentor: ranking[0][0],
      valor: ranking[0][1].fin,
      obter: 'Ser o colaborador com mais finalizações.'
    });
  }

  // 🔥 Constância — presente em todos os meses
  const totalMeses = [...new Set(rows.map(r => r['Mês']))].length;
  const constantes = Object.entries(byColab).filter(([, v]) => v.qtdMeses === totalMeses).map(([k]) => k);
  if (constantes.length) {
    conquistas.push({
      icone: '🔥',
      nome: 'Constância',
      desc: `Presente em todos os ${totalMeses} períodos`,
      detentor: constantes.join(', '),
      valor: totalMeses,
      obter: 'Ter registros em todos os meses do período.'
    });
  }

  // 🚀 Maior Evolução — maior delta de finalizações entre último e penúltimo mês
  const meses = [...new Set(rows.map(r => r['Mês']))].filter(Boolean).sort();
  if (meses.length >= 2) {
    const ult = meses[meses.length - 1];
    const ant = meses[meses.length - 2];
    let maiorDelta = { nome: '', delta: -Infinity };
    cols.forEach(name => {
      const recsUlt = rows.filter(r => String(r['Atendente']) === name && String(r['Mês']) === ult);
      const recsAnt = rows.filter(r => String(r['Atendente']) === name && String(r['Mês']) === ant);
      const finUlt = recsUlt.reduce((s, r) => s + (parseInt(r['Finalizados']) || 0), 0);
      const finAnt = recsAnt.reduce((s, r) => s + (parseInt(r['Finalizados']) || 0), 0);
      const delta = finUlt - finAnt;
      if (delta > maiorDelta.delta) maiorDelta = { nome: name, delta };
    });
    if (maiorDelta.delta > 0) {
      conquistas.push({
        icone: '🚀',
        nome: 'Maior Evolução',
        desc: `Maior crescimento entre períodos`,
        detentor: maiorDelta.nome,
        valor: maiorDelta.delta,
        obter: 'Ter o maior aumento de finalizações entre dois períodos consecutivos.'
      });
    }
  }

  // 🎯 Meta Atingida — quem atingiu a meta
  const acimaMeta = Object.entries(byColab).filter(([name, data]) => {
    const recs = rows.filter(r => String(r['Atendente']) === name);
    const obj = recs.reduce((s, r) => s + (parseInt(r['Objetivo']) || 0), 0);
    return obj > 0 && data.fin >= obj;
  }).map(([k]) => k);
  if (acimaMeta.length) {
    conquistas.push({
      icone: '🎯',
      nome: 'Meta Atingida',
      desc: `${acimaMeta.length} colaborador(es) atingiram o objetivo`,
      detentor: acimaMeta.join(', '),
      valor: acimaMeta.length,
      obter: 'Cumprir o objetivo mensal de finalizações.'
    });
  }

  // ⚡ Destaque do Período — melhor score médio
  const melhorScore = Object.entries(byColab).filter(([, v]) => v.avgSc > 0).sort((a, b) => b[1].avgSc - a[1].avgSc);
  if (melhorScore.length) {
    conquistas.push({
      icone: '⚡',
      nome: 'Destaque do Período',
      desc: `Melhor score médio: ${melhorScore[0][1].avgSc.toFixed(2)}`,
      detentor: melhorScore[0][0],
      valor: melhorScore[0][1].avgSc,
      obter: 'Ter o maior score médio do período.'
    });
  }

  // 🛡️ Produtividade Máxima — maior produtividade
  const melhorProd = Object.entries(byColab).filter(([, v]) => v.prod > 0 && v.ass >= 5).sort((a, b) => b[1].prod - a[1].prod);
  if (melhorProd.length) {
    conquistas.push({
      icone: '🛡️',
      nome: 'Produtividade Máxima',
      desc: `Maior produtividade: ${(melhorProd[0][1].prod * 100).toFixed(0)}%`,
      detentor: melhorProd[0][0],
      valor: melhorProd[0][1].prod,
      obter: 'Ter a maior taxa de finalizados por assumidos.'
    });
  }

  let html = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:var(--s-4)">`;

  conquistas.forEach(c => {
    const detentores = c.detentor.split(', ').map(n => escapeHtml(getDisplayName(n.trim(), aliasMap))).join(', ');
    html += `<div style="border:1px solid var(--border);border-radius:var(--r-lg);padding:var(--s-5);background:var(--bg-surface);transition:box-shadow var(--t-base);position:relative;overflow:hidden">
      <div style="position:absolute;top:0;left:0;right:0;height:4px;background:linear-gradient(90deg,var(--accent),var(--success))"></div>
      <div style="display:flex;align-items:center;gap:var(--s-3);margin-bottom:var(--s-3)">
        <span style="font-size:36px">${c.icone}</span>
        <div>
          <div style="font-weight:700;font-size:16px;color:var(--text-strong)">${c.nome}</div>
          <div style="font-size:12px;color:var(--text-muted)">${escapeHtml(c.desc)}</div>
        </div>
      </div>
      <div style="padding:var(--s-3);border-radius:var(--r-md);background:var(--accent-soft);margin-bottom:var(--s-3)">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-muted);font-weight:600">Detentor(es)</div>
        <div style="font-weight:600;font-size:14px;color:var(--text-strong);margin-top:2px">${detentores}</div>
      </div>
      <div style="font-size:12px;color:var(--text-secondary);line-height:1.5">
        <strong>Como obter:</strong> ${escapeHtml(c.obter)}
      </div>
    </div>`;
  });

  html += `</div>`;

  if (!conquistas.length) {
    html = '<div class="empty-state"><div class="empty-title">Nenhuma conquista disponível</div><div class="empty-sub">Os dados atuais não geraram conquistas.</div></div>';
  }

  container.innerHTML = html;
}

function onConquistasTabActivated() {
  renderConquistas();
}
