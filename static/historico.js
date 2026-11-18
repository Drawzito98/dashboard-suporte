// Histórico: projeção confirmada e envios privados pendentes, sem reenvio automático.
function loadHistoricoFromStorage(){
  const rows=AppState.get('historico');
  if(Array.isArray(rows))return rows;
  try{const cache=JSON.parse(appStorage.getItem('sistema_historico_confirmado_v1')||'[]');return Array.isArray(cache)?cache:[];}catch(_){return[];}
}
function loadHistoricoPending(){
  try{const rows=JSON.parse(appStorage.getItem('sistema_historico_pendente_v1')||'[]');return Array.isArray(rows)?rows:[];}catch(_){return[];}
}
function openHistorico(){const overlay=document.getElementById('historicoOverlay');if(overlay){overlay.classList.add('open');renderHistorico();}}
function closeHistorico(){document.getElementById('historicoOverlay')?.classList.remove('open');}
function renderHistorico(){
  const container=document.getElementById('historicoContent');if(!container)return;
  const log=loadHistoricoFromStorage(),pending=loadHistoricoPending(),esc=v=>escapeHtml(String(v??''));
  const labels={edit:'Edição',add:'Adição',delete:'Exclusão'};
  container.innerHTML=`<div style="padding:var(--s-5)">
    <h2>Histórico de alterações</h2>
    <p>Até 500 registros confirmados disponíveis nesta sessão ou no cache da conta. Atualizar consulta o servidor; se a consulta falhar, a lista anterior é mantida.</p>
    ${AppState.get('historicoStatus')==='error'?'<p role="status">Consulta indisponível. A lista anterior foi mantida.</p>':''}
    <p>Esta trilha é independente do salvamento dos indicadores e não substitui a auditoria do servidor.</p>
    <button type="button" class="btn-small" id="historicoRefresh">Atualizar histórico</button>
    <section aria-label="Envios de histórico pendentes"><h3>Envios não confirmados (${pending.length})</h3>
      <p>Não são reenviados automaticamente. Consultar o histórico pode reconhecer um envio já recebido. Tentar novamente consulta o mesmo identificador antes de enviar.</p>
      ${pending.map((e,i)=>`<div class="cockpit-item"><p>${esc(labels[e.action]||e.action)} · ${esc(e.colaborador)} · ${esc(e.mes)}</p><button type="button" class="btn-small" data-history-retry="${i}">Consultar e tentar novamente</button></div>`).join('')}
    </section>
    <h3>Registros confirmados (${log.length})</h3>
    ${log.length?`<div class="table-wrap" tabindex="0" aria-label="Histórico confirmado"><table class="ranking-table"><caption>Últimas confirmações disponíveis · mais recentes primeiro</caption><thead><tr><th>Data/Hora</th><th>Usuário</th><th>Ação</th><th>Colaborador</th><th>Mês</th><th>Detalhes</th></tr></thead><tbody>
      ${log.slice().reverse().map(e=>`<tr><td>${esc(new Date(e.ts).toLocaleString('pt-BR'))}</td><td>${esc(e.user)}</td><td>${esc(labels[e.action]||e.action)}</td><td>${esc(e.colaborador||'—')}</td><td>${esc(e.mes||'—')}</td><td>${e.action==='edit'&&e.campo?`${esc(e.campo)}: ${esc(e.before??'—')} → ${esc(e.after??'—')}`:esc(e.detalhes||'—')}</td></tr>`).join('')}
    </tbody></table></div>`:'<p>Nenhum registro confirmado disponível. Atualize para consultar o servidor.</p>'}
  </div>`;
  async function run(button,action){
    const token=AppDataSession.token();button.disabled=true;
    try{await action();}
    catch(error){if(AppDataSession.current(token))showToast(error.message||'Histórico não confirmado.','error');}
    finally{if(AppDataSession.current(token))renderHistorico();}
  }
  container.querySelector('#historicoRefresh').addEventListener('click',e=>run(e.currentTarget,()=>dbHistoricoLoad()));
  container.querySelectorAll('[data-history-retry]').forEach(button=>button.addEventListener('click',()=>run(button,()=>dbHistoricoAdd(pending[Number(button.dataset.historyRetry)]))));
}
document.addEventListener('click',e=>{if(e.target.closest('#historicoBtn')){openHistorico();return;}if(e.target===document.getElementById('historicoOverlay')||e.target.closest('#historicoClose'))closeHistorico();});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeHistorico();});
