/* Keep public entry points while their implementations load on first use. */
(function () {
  'use strict';
  const tickets = new Map();
  function notice(feature, label, retry) {
    let host = document.getElementById('feature-notice-' + feature);
    if (!host) { host = document.createElement('div'); host.id = 'feature-notice-' + feature;host.className = 'feature-load-notice';host.setAttribute('role','status');document.body.appendChild(host); }
    host.replaceChildren(Object.assign(document.createElement('span'), { textContent: retry ? 'Não foi possível abrir ' + label + '.' : 'Carregando ' + label + '…' }));
    if (retry) { const button=document.createElement('button');button.type='button';button.className='btn-small';button.textContent='Tentar novamente';button.onclick=retry;host.appendChild(button); }
    return host;
  }
  function bind(feature, symbol, label, { tab, fallback } = {}) {
    const stub = function (...args) {
      if (fallback && document.body.dataset.role !== 'admin') return fallback(...args);
      const ticket = (tickets.get(feature) || 0) + 1;tickets.set(feature,ticket);
      const token = typeof AppDataSession !== 'undefined' ? AppDataSession.token() : null;
      const element = symbol === 'renderPontoProfile' ? args[1] : null;
      if (element) element.textContent='Carregando jornada…';
      const host = element ? null : notice(feature,label);
      return FeatureLoader.ensure(feature).then(() => {
        if (ticket !== tickets.get(feature) || (token?.owner && !AppDataSession.current(token))) return false;
        if (tab && document.body.dataset.activeTab !== tab) return false;
        if (element && !element.isConnected) return false;
        const fn = window[symbol];
        if (typeof fn !== 'function' || fn === stub) throw new Error('A área não foi inicializada.');
        return fn(...args);
      }).catch(() => {
        if (ticket !== tickets.get(feature) || (token?.owner && !AppDataSession.current(token))) return false;
        if (element) { element.textContent='Não foi possível carregar a jornada. Abra a auditoria para tentar novamente.'; }
        else notice(feature,label,()=>stub(...args));
        return false;
      }).finally(() => { if (ticket === tickets.get(feature)) { const current = document.getElementById('feature-notice-' + feature); if (current && !current.querySelector('button')) current.remove(); } });
    };
    stub.__featureStub = true;
    window[symbol] = stub;
  }
  bind('ponto','onPontoTabActivated','Auditoria de Ponto',{tab:'ponto'});
  bind('ponto','renderPontoProfile','jornada');
  bind('ponto','openPontoEmployee','jornada');
  bind('ponto','openPontoAnalysis','análise de ponto');
  bind('pdi','onPerfilPdiTabActivated','Perfil e PDI',{tab:'perfil-pdi'});
  bind('pdi','openPerfilPdi','Perfil e PDI');
  bind('panorama','onRelatorioSetorialTabActivated','Relatório Setorial e Panorama',{tab:'relatorio-setorial'});
  bind('equipe360','openEquipe360','Equipe 360º');
  bind('equipe360','openColabDetail','Equipe 360º',{fallback:window.openColabDetail});
})();
