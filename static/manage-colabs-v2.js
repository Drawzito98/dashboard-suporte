// Gestão de colaboradores v2 — inclui cadastro manual no painel de ativação.
(function(){
  'use strict';
  const esc=v=>typeof escapeHtmlShared==='function'?escapeHtmlShared(String(v??'')):escapeHtml(String(v??''));
  function recordNames(){try{return typeof rawRecords!=='undefined'&&Array.isArray(rawRecords)?rawRecords.map(r=>r&&r.Atendente).filter(Boolean):[];}catch(_){return[];}}
  function registeredNames(){try{const info=JSON.parse(localStorage.getItem('sistema_colaboradores_info_v1')||'{}');return info&&typeof info==='object'?Object.keys(info):[];}catch(_){return[];}}
  window.renderManageColabs=function(){
    const container=document.getElementById('manageColabsContent');if(!container)return;
    const allNames=[...new Set([...recordNames(),...registeredNames()].map(v=>String(v).trim()).filter(v=>v&&!(typeof isAggregateName==='function'&&isAggregateName(v))))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
    container.innerHTML=`<div class="mc-panel"><div class="mc-header"><div><span>GESTÃO DA EQUIPE</span><h2>Gerenciar colaboradores</h2><p>Cadastre pessoas e controle quem aparece nos filtros, rankings, relatórios e projeções.</p></div><button class="btn-primary" id="manageColabsAddBtn" type="button">+ Novo colaborador</button></div>
      <div class="mc-summary"><strong>${allNames.length}</strong><span>colaborador${allNames.length===1?'':'es'} cadastrado${allNames.length===1?'':'s'}</span><small>Cadastros manuais aparecem aqui mesmo antes de receberem dados de desempenho.</small></div>
      ${allNames.length?`<div class="mc-table"><table class="ranking-table"><thead><tr><th>Colaborador</th><th>Origem</th><th style="text-align:center">Situação</th></tr></thead><tbody>${allNames.map(name=>{const active=typeof isColabActive==='function'?isColabActive(name):true,manual=registeredNames().includes(name);return`<tr><td><strong>${esc(name)}</strong></td><td><span class="mc-origin">${manual?'Cadastro':'Dados importados'}</span></td><td style="text-align:center"><label class="mc-toggle"><input type="checkbox" class="colab-active-toggle" data-name="${esc(name)}" ${active?'checked':''}><span class="${active?'is-active':''}">${active?'Ativo':'Inativo'}</span></label></td></tr>`;}).join('')}</tbody></table></div>`:'<div class="empty-state"><div class="empty-title">Nenhum colaborador cadastrado</div><div class="empty-sub">Use “Novo colaborador” para criar o primeiro perfil.</div></div>'}
      <div class="mc-footer"><button class="btn-primary" id="manageColabsDoneBtn" type="button">Concluído</button></div></div>`;
    document.getElementById('manageColabsAddBtn')?.addEventListener('click',()=>{if(typeof requireAdmin==='function'&&!requireAdmin())return;if(typeof closeManageColabs==='function')closeManageColabs();if(typeof openNovoColaboradorModal==='function')openNovoColaboradorModal();});
    document.getElementById('manageColabsDoneBtn')?.addEventListener('click',()=>{if(typeof closeManageColabs==='function')closeManageColabs();});
    container.querySelectorAll('.colab-active-toggle').forEach(input=>input.addEventListener('change',()=>{if(typeof requireAdmin==='function'&&!requireAdmin()){input.checked=!input.checked;return;}if(typeof setColabActive==='function')setColabActive(input.dataset.name,input.checked);const label=input.nextElementSibling;if(label){label.textContent=input.checked?'Ativo':'Inativo';label.classList.toggle('is-active',input.checked);}if(typeof renderColaboradores==='function')renderColaboradores();}));
  };
})();
