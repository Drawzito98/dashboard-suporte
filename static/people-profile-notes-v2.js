// Perfil organizado e menções nas anotações. Compatível com o formato de dados existente.
(function () {
  'use strict';
  const esc = v => typeof escapeHtmlShared === 'function' ? escapeHtmlShared(String(v ?? '')) : escapeHtml(String(v ?? ''));
  const n = v => Number.isFinite(Number(v)) ? Number(v) : 0;
  const labelMonth = v => typeof formatMesLabel === 'function' ? formatMesLabel(v) : v;
  const pct = v => `${n(v).toFixed(1).replace('.', ',')}%`;
  const names = () => [...new Set((Array.isArray(window.rawRecords) ? rawRecords : []).map(r => r && r.Atendente).filter(v => v && !(typeof isAggregateName === 'function' && isAggregateName(v))))].sort((a,b)=>a.localeCompare(b,'pt-BR'));

  function allPersonRows(name) {
    return (Array.isArray(window.rawRecords) ? rawRecords : []).filter(r => r && String(r.Atendente) === String(name) && !(typeof isAggregateName === 'function' && isAggregateName(r.Atendente)));
  }
  function score(rows) { const a=rows.map(r=>Number(r.SCORE)).filter(Number.isFinite); return a.length?a.reduce((x,y)=>x+y,0)/a.length:0; }
  function duration(rows,key) { if(typeof parseDurationToSeconds!=='function')return null; const a=rows.map(r=>parseDurationToSeconds(r[key])).filter(Number.isFinite); return a.length?a.reduce((x,y)=>x+y,0)/a.length:null; }
  function fmtDuration(v) { if(!Number.isFinite(v))return '—'; const d=Math.floor(v/86400),h=Math.floor(v%86400/3600),m=Math.floor(v%3600/60); return [d?`${d}d`:'',h?`${h}h`:'',`${m}min`].filter(Boolean).join(' '); }

  window.renderColabDetail = function (name) {
    const host=document.getElementById('colabDetailContent'); if(!host)return;
    const records=allPersonRows(name).sort((a,b)=>String(a['Mês']).localeCompare(String(b['Mês'])));
    if(!records.length){host.innerHTML='<div class="empty-state"><div class="empty-title">Colaborador não encontrado</div></div>';return;}
    const months=[...new Set(records.map(r=>r['Mês']).filter(Boolean))].sort();
    const monthly=months.map(m=>{const rows=records.filter(r=>String(r['Mês'])===String(m)),ass=rows.reduce((s,r)=>s+n(r.Assumidos),0),fin=rows.reduce((s,r)=>s+n(r.Finalizados),0),tra=rows.reduce((s,r)=>s+n(r.Transferidos),0);return{mes:m,assumidos:ass,finalizados:fin,transferidos:tra,score:score(rows),prod:ass?fin/ass*100:0,tx:ass?tra/ass*100:0,tma:duration(rows,'TMA'),tmr:duration(rows,'TMR'),setor:[...new Set(rows.map(r=>r.Setor).filter(Boolean))].join(', ')}});
    const ass=monthly.reduce((s,x)=>s+x.assumidos,0),fin=monthly.reduce((s,x)=>s+x.finalizados,0),tra=monthly.reduce((s,x)=>s+x.transferidos,0),avg=score(records),prod=ass?fin/ass*100:0,tx=ass?tra/ass*100:0;
    const latest=monthly.at(-1),previous=monthly.at(-2),alias=typeof buildAliasMap==='function'?buildAliasMap([name]):{},display=typeof getDisplayName==='function'?getDisplayName(name,alias):name;
    const initials=String(display).split(' ').map(x=>x[0]).join('').slice(0,2).toUpperCase(), perfil=typeof getPerfilDocsLink==='function'?getPerfilDocsLink(name):null;
    const trend=(current,old,inverse=false)=>{if(!old)return'<span class="pp-neutral">Sem comparação</span>';const d=current-old,good=inverse?d<=0:d>=0;return`<span class="${good?'pp-up':'pp-down'}">${d>=0?'+':''}${d.toFixed(1).replace('.',',')}</span>`;};
    host.innerHTML=`<div class="pp-header">${typeof colabAvatarHtml==='function'?colabAvatarHtml(name,64):`<div class="colab-detail-avatar">${esc(initials)}</div>`}<div><span>PERFIL DO ATENDENTE</span><h2>${esc(display)}</h2><p>${esc([...new Set(records.map(r=>r.Setor).filter(Boolean))].join(' • '))}</p></div><div class="pp-header-actions"><span>${months.length} período${months.length===1?'':'s'} no histórico</span>${perfil?'<button class="btn-small" id="colabPerfilBtn" type="button">Abrir perfil</button>':''}</div></div>
    <nav class="pp-nav"><a href="#pp-summary">Resumo</a><a href="#pp-evolution">Evolução</a><a href="#pp-history">Histórico completo</a><a href="#pp-360">Visão 360°</a></nav>
    <section id="pp-summary"><div class="pp-section-title"><div><span>Resumo consolidado</span><small>Todo o histórico disponível, sem limitar ao período do filtro global</small></div></div><div class="pp-kpis"><article><span>Finalizados</span><strong>${fin.toLocaleString('pt-BR')}</strong><small>${pct(prod)} de produtividade</small></article><article><span>Score médio</span><strong>${avg?avg.toFixed(2):'—'}</strong><small>${latest?`Atual ${latest.score.toFixed(2)}`:'—'}</small></article><article><span>Transferências</span><strong>${pct(tx)}</strong><small>${tra.toLocaleString('pt-BR')} no total</small></article><article><span>Média mensal</span><strong>${(fin/months.length).toFixed(1).replace('.',',')}</strong><small>finalizações por período</small></article></div>
    ${previous?`<div class="pp-current"><div><span>Último período</span><strong>${esc(labelMonth(latest.mes))}</strong></div><div><span>Finalizados</span><strong>${latest.finalizados}</strong>${trend(latest.finalizados,previous.finalizados)}</div><div><span>Produtividade</span><strong>${pct(latest.prod)}</strong>${trend(latest.prod,previous.prod)}</div><div><span>Score</span><strong>${latest.score.toFixed(2)}</strong>${trend(latest.score,previous.score)}</div><div><span>Tx. transferência</span><strong>${pct(latest.tx)}</strong>${trend(latest.tx,previous.tx,true)}</div></div>`:''}</section>
    <section id="pp-evolution" class="pp-section"><div class="pp-section-title"><div><span>Evolução</span><small>Volume e qualidade ao longo do tempo</small></div></div>${months.length>=2?'<div class="chart-area"><div class="chart-scroll"><div class="chart-inner" style="height:280px"><canvas id="colabDetailChart"></canvas></div></div></div>':'<div class="empty-state"><div class="empty-sub">São necessários dois períodos para exibir o gráfico.</div></div>'}</section>
    <section id="pp-history" class="pp-section"><div class="pp-section-title"><div><span>Histórico completo</span><small>${months.length} período${months.length===1?'':'s'} encontrado${months.length===1?'':'s'}</small></div></div><div class="pp-table"><table class="ranking-table"><thead><tr><th>Período</th><th>Setor</th><th>Assumidos</th><th>Finalizados</th><th>Prod.</th><th>Transferidos</th><th>Tx. transf.</th><th>Score</th><th>TMA</th><th>TMR</th></tr></thead><tbody>${monthly.slice().reverse().map(x=>`<tr><td><strong>${esc(labelMonth(x.mes))}</strong></td><td>${esc(x.setor||'—')}</td><td>${x.assumidos.toLocaleString('pt-BR')}</td><td>${x.finalizados.toLocaleString('pt-BR')}</td><td>${pct(x.prod)}</td><td>${x.transferidos.toLocaleString('pt-BR')}</td><td>${pct(x.tx)}</td><td class="score-cell ${x.score?getClasseScore(x.score):'score-neutro'}">${x.score?x.score.toFixed(2):'—'}</td><td>${fmtDuration(x.tma)}</td><td>${fmtDuration(x.tmr)}</td></tr>`).join('')}</tbody></table></div></section><div id="pp-360"></div>`;
    if(perfil)document.getElementById('colabPerfilBtn')?.addEventListener('click',()=>window.open(perfil,'_blank','noopener,noreferrer'));
    if(document.getElementById('colabDetailChart')&&typeof renderColabDetailChart==='function')renderColabDetailChart(monthly);
    if(typeof renderColab360Extras==='function')renderColab360Extras(name,document.getElementById('pp-360'));
  };

  const baseRender=window.renderAnotacoes;
  function mentions(text){return [...String(text||'').matchAll(/@\[([^\]]+)\]/g)].map(m=>m[1]);}
  function enhanceNotes(){
    const root=document.getElementById('anotacoesOverlayContent'),text=document.getElementById('anotacaoTextoInput'); if(!root||!text)return;
    const options=names(), editing=JSON.parse(localStorage.getItem('sistema_anotacao_editando_v1')||'null');
    const mention=document.createElement('div'); mention.className='note-mention-field'; mention.innerHTML=`<label class="field"><span>Mencionar pessoa <small>(opcional)</small></span><select id="noteMentionSelect"><option value="">Selecione para inserir…</option>${options.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('')}</select></label><small>A menção será inserida na anotação e ficará disponível nos filtros.</small>`;
    text.closest('.field')?.insertAdjacentElement('beforebegin',mention);
    document.getElementById('noteMentionSelect')?.addEventListener('change',e=>{if(!e.target.value)return;const token=`@[${e.target.value}]`;if(!text.value.includes(token))text.value=`${text.value}${text.value?'\n':''}${token} `;text.dispatchEvent(new Event('input',{bubbles:true}));text.focus();e.target.value='';});
    const saved=JSON.parse(localStorage.getItem(ANOTACOES_LOCAL_KEY)||'[]'), used=[...new Set(saved.flatMap(a=>mentions(a.conteudo)))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
    const history=root.querySelectorAll('.card')[1]; if(!history||!saved.length)return;
    const bar=document.createElement('div');bar.className='note-filter-bar';bar.innerHTML=`<label class="field"><span>Filtrar por pessoa mencionada</span><select id="noteMentionFilter"><option value="">Todas as pessoas</option>${used.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('')}</select></label>`;
    history.querySelector('.card-header')?.insertAdjacentElement('afterend',bar);
    const cards=[...history.querySelectorAll('.anotacao-ver-btn')].map(btn=>btn.closest('div[style*="border:1px"]'));
    saved.forEach((a,i)=>{if(!cards[i])return;const ms=mentions(a.conteudo);cards[i].dataset.mentions=ms.join('|');if(ms.length){const chips=document.createElement('div');chips.className='note-mention-chips';chips.innerHTML=ms.map(x=>`<span>@ ${esc(x)}</span>`).join('');cards[i].appendChild(chips);}});
    document.getElementById('noteMentionFilter')?.addEventListener('change',e=>cards.forEach(card=>card.style.display=!e.target.value||card.dataset.mentions.split('|').includes(e.target.value)?'':'none'));
  }
  if(typeof baseRender==='function')window.renderAnotacoes=function(){baseRender();enhanceNotes();};
})();
