// Persistência de audit; contratos preservados pelo facade db-extra.js.
(function (root) {
// ─── COMENTÁRIOS ─────────────────────────────────────────────────



async function dbComentariosLoad() {
  if (!sbClient) return _fallbackLoad(COMENTARIOS_LOCAL_KEY, {});
  try {
    const { data, error } = await sbClient.from('comentarios').select('*').order('created_at', { ascending: true });
    if (!error && Array.isArray(data)) {
      const map = {};
      data.forEach(c => {
        if (!map[c.mes]) map[c.mes] = [];
        map[c.mes].push({
          id: c.id,
          texto: c.texto,
          user: c.user_email || 'desconhecido',
          ts: c.created_at
        });
      });
      appStorage.setItem(COMENTARIOS_LOCAL_KEY, JSON.stringify(map));
      return map;
    }
    return _fallbackLoad(COMENTARIOS_LOCAL_KEY, {});
  } catch {
    return _fallbackLoad(COMENTARIOS_LOCAL_KEY, {});
  }
}

async function dbComentarioAdd(mes, texto) {
  const map = JSON.parse(appStorage.getItem(COMENTARIOS_LOCAL_KEY) || '{}');
  const email = await _getUserEmail();
  const entry = {
    id: Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    texto: texto.trim(),
    user: email || 'desconhecido',
    ts: new Date().toISOString()
  };
  if (!map[mes]) map[mes] = [];
  map[mes].push(entry);
  appStorage.setItem(COMENTARIOS_LOCAL_KEY, JSON.stringify(map));
  if (sbClient) {
    try {
      await sbClient.from('comentarios').insert({
        mes,
        texto: texto.trim(),
        user_email: email || ''
      });
    } catch (e) { console.error('[db-extra]', e); }
  }
  return entry;
}

async function dbComentarioDel(mes, id) {
  const map = JSON.parse(appStorage.getItem(COMENTARIOS_LOCAL_KEY) || '{}');
  if (map[mes]) {
    map[mes] = map[mes].filter(c => c.id !== id);
    if (!map[mes].length) delete map[mes];
    appStorage.setItem(COMENTARIOS_LOCAL_KEY, JSON.stringify(map));
  }
  if (sbClient) {
    try {
      await sbClient.from('comentarios').delete().eq('id', id);
    } catch {
      try {
        await sbClient.from('comentarios').delete().filter('id', 'eq', id);
      } catch (e) { console.error('[db-extra]', e); }
    }
  }
}


// ─── HISTÓRICO ───────────────────────────────────────────────────



async function dbHistoricoLoad() {
  if (!sbClient) return _fallbackLoad(HISTORICO_LOCAL_KEY, []);
  try {
    const { data, error } = await sbClient.from('historico').select('*').order('created_at', { ascending: false }).limit(500);
    if (!error && Array.isArray(data)) {
      const log = data.map(r => ({
        ts: r.created_at,
        user: r.user_email || '',
        action: r.action,
        colaborador: r.colaborador,
        mes: r.mes,
        campo: r.campo,
        before: r.before_value,
        after: r.after_value,
        detalhes: r.detalhes
      }));
      appStorage.setItem(HISTORICO_LOCAL_KEY, JSON.stringify(log));
      return log;
    }
    return _fallbackLoad(HISTORICO_LOCAL_KEY, []);
  } catch {
    return _fallbackLoad(HISTORICO_LOCAL_KEY, []);
  }
}

async function dbHistoricoAdd(entry) {
  const log = JSON.parse(appStorage.getItem(HISTORICO_LOCAL_KEY) || '[]');
  const email = await _getUserEmail();
  const enriched = {
    ts: entry.ts || new Date().toISOString(),
    user: entry.user || email || '',
    action: entry.action || '',
    colaborador: entry.colaborador || '',
    mes: entry.mes || '',
    campo: entry.campo || '',
    before: entry.before || '',
    after: entry.after || '',
    detalhes: entry.detalhes || ''
  };
  log.push(enriched);
  if (log.length > 500) log.splice(0, log.length - 500);
  appStorage.setItem(HISTORICO_LOCAL_KEY, JSON.stringify(log));
  if (sbClient) {
    try {
      await sbClient.from('historico').insert({
        action: enriched.action,
        colaborador: enriched.colaborador,
        mes: enriched.mes,
        campo: enriched.campo,
        before_value: enriched.before,
        after_value: enriched.after,
        detalhes: enriched.detalhes,
        user_email: email || ''
      });
    } catch (e) { console.error('[db-extra]', e); }
  }
}


  root.AppRepositories = root.AppRepositories || {};
  root.AppRepositories.audit = { dbComentariosLoad, dbComentarioAdd, dbComentarioDel, dbHistoricoLoad, dbHistoricoAdd };
})(window);
