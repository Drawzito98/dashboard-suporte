// Editor visual das metas de alertas — persiste na configuração existente por usuário.
(function () {
  'use strict';
  const esc = v => typeof escapeHtmlShared === 'function' ? escapeHtmlShared(String(v ?? '')) : escapeHtml(String(v ?? ''));
  const definitions = {
    score_baixo: { label: 'Score mínimo', help: 'Dispara quando o score médio ficar abaixo deste valor.', min: 0, max: 5, step: .05, unit: 'pontos', read: c => c.valor, write: (c,v) => c.valor=v },
    queda_20: { label: 'Queda máxima de finalizações', help: 'Compara o período atual com o anterior.', min: 1, max: 100, step: 1, unit: '%', read: c => c.valor, write: (c,v) => c.valor=v },
    consecutivo_abaixo: { label: 'Score de referência', help: 'Alerta quando o score permanecer abaixo do limite.', min: 0, max: 5, step: .05, unit: 'pontos', read: c => c.valor, write: (c,v) => c.valor=v, periods: true },
    transferencia_alta: { label: 'Taxa máxima de transferência', help: 'Dispara acima deste percentual sobre assumidos.', min: 0, max: 100, step: 1, unit: '%', read: c => c.valor*100, write: (c,v) => c.valor=v/100 },
    produtividade_baixa: { label: 'Produtividade mínima', help: 'Dispara abaixo do percentual de finalizados sobre assumidos.', min: 0, max: 100, step: 1, unit: '%', read: c => c.valor*100, write: (c,v) => c.valor=v/100 }
  };
  function activeSummary(c) {
    if(c.id==='score_baixo')return `Abaixo de ${Number(c.valor).toFixed(2)} pontos`;
    if(c.id==='queda_20')return `Queda igual ou superior a ${Number(c.valor).toFixed(0)}%`;
    if(c.id==='meta_nao_atingida')return 'Usa o Objetivo importado em cada registro';
    if(c.id==='consecutivo_abaixo')return `${Number(c.periodos)||2}+ períodos abaixo de ${Number(c.valor).toFixed(2)}`;
    if(c.id==='transferencia_alta')return `Acima de ${(Number(c.valor)*100).toFixed(0)}%`;
    if(c.id==='produtividade_baixa')return `Abaixo de ${(Number(c.valor)*100).toFixed(0)}%`;
    return c.desc||'';
  }
  function renderEditor() {
    const container=document.getElementById('alertasContent'); if(!container)return;
    if(!alertasConfig.length)loadAlertasConfig();
    const fired=verificarAlertas();
    container.innerHTML=`<div class="ag-toolbar"><div><strong>Metas e limites</strong><span>Personalize quando cada alerta deve ser acionado. As alterações valem para o seu usuário.</span></div><button class="btn-primary" id="alertGoalsSave" type="button">Salvar metas</button></div>
      <div class="ag-grid">${alertasConfig.map(c=>{const d=definitions[c.id];return `<article class="ag-card ${c.ativo?'':'ag-disabled'}"><header><label class="ag-switch"><input type="checkbox" class="alerta-toggle" data-id="${esc(c.id)}" ${c.ativo?'checked':''}><span>${c.icone}</span></label><div><strong>${esc(c.name)}</strong><small>${esc(activeSummary(c))}</small></div></header>${d?`<div class="ag-fields"><label class="field"><span>${esc(d.label)}</span><div class="ag-input"><input class="alert-goal-input" data-id="${esc(c.id)}" type="number" min="${d.min}" max="${d.max}" step="${d.step}" value="${d.read(c)}"><b>${d.unit}</b></div></label>${d.periods?`<label class="field"><span>Períodos consecutivos</span><div class="ag-input"><input class="alert-period-input" data-id="${esc(c.id)}" type="number" min="1" max="12" step="1" value="${Number(c.periodos)||2}"><b>períodos</b></div></label>`:''}</div><p>${esc(d.help)}</p>`:`<div class="ag-imported"><b>Meta vinculada aos dados</b><span>Este alerta compara “Finalizados” com o campo “Objetivo” importado. Edite o objetivo na fonte dos registros.</span></div>`}</article>`}).join('')}</div>
      <div class="ag-active-title"><div><strong>Alertas ativos</strong><span>${fired.length} ocorrência${fired.length===1?'':'s'} no recorte dos filtros</span></div></div>${fired.length?`<div class="ag-fired">${fired.map(a=>`<article class="${a.gravidade==='alta'?'ag-critical':'ag-warning'}"><span>${a.config.icone}</span><div><strong>${esc(a.config.name)}</strong><p>${esc(a.mensagem)}</p></div><b>${a.gravidade==='alta'?'Crítico':'Atenção'}</b></article>`).join('')}</div>`:(window.rawRecords&&rawRecords.length?'<div class="ag-clear">✓ Nenhum alerta disparado com as metas atuais.</div>':'<div class="empty-state"><div class="empty-title">Sem dados</div><div class="empty-sub">Importe um CSV para verificar alertas.</div></div>')}`;
    container.querySelectorAll('.alerta-toggle').forEach(input=>input.addEventListener('change',e=>{if(!requireAdmin()){e.target.checked=!e.target.checked;return;}const c=alertasConfig.find(x=>x.id===e.target.dataset.id);if(c){c.ativo=e.target.checked;saveAlertasConfig();renderEditor();}}));
    document.getElementById('alertGoalsSave')?.addEventListener('click',()=>{
      if(!requireAdmin())return;
      let invalid=false;
      container.querySelectorAll('.alert-goal-input').forEach(input=>{const value=Number(input.value),d=definitions[input.dataset.id],c=alertasConfig.find(x=>x.id===input.dataset.id);if(!d||!c||!Number.isFinite(value)||value<d.min||value>d.max){input.setAttribute('aria-invalid','true');invalid=true;return;}input.removeAttribute('aria-invalid');d.write(c,value);});
      container.querySelectorAll('.alert-period-input').forEach(input=>{const value=Number(input.value),c=alertasConfig.find(x=>x.id===input.dataset.id);if(!c||!Number.isInteger(value)||value<1||value>12){input.setAttribute('aria-invalid','true');invalid=true;return;}input.removeAttribute('aria-invalid');c.periodos=value;});
      if(invalid){showToast('Revise os valores destacados antes de salvar.','error','Metas dos alertas');return;}
      saveAlertasConfig();showToast('Metas dos alertas atualizadas.','success','Alertas');renderEditor();
    });
  }
  window.renderAlertas=renderEditor;
})();
