// Notificações — audit trail para ações de não-admins
let _notificacoesCache = null;
let _notificacoesListeners = [];

function onNotificacoesChange(fn) {
  _notificacoesListeners.push(fn);
}

function _emitNotificacoesChange() {
  _notificacoesListeners.forEach(fn => fn(_notificacoesCache));
}

function getNotificacoesNaoLidas() {
  return (_notificacoesCache || []).filter(n => !n.lida);
}

async function criarNotificacao(tipo, descricao, link) {
  if (!sbClient) return;
  const user = getCurrentUser();
  if (!user || isAdmin()) return;
  try {
    const { error } = await sbClient.from('notificacoes').insert({
      tipo,
      descricao,
      link: link || '',
      actor_id: user.id,
      actor_email: user.email || ''
    });
    if (error) throw error;
  } catch (e) {
    console.error('Erro ao criar notificação:', e);
  }
}

async function dbNotificacoesLoad() {
  if (!sbClient || !isAdmin()) return [];
  try {
    const { data, error } = await sbClient
      .from('notificacoes')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    _notificacoesCache = data || [];
    _emitNotificacoesChange();
    return _notificacoesCache;
  } catch (e) {
    console.error('Erro ao carregar notificações:', e);
    return [];
  }
}

async function marcarNotificacaoLida(id) {
  if (!sbClient || !isAdmin()) return;
  try {
    await sbClient.from('notificacoes').update({ lida: true }).eq('id', id);
    if (_notificacoesCache) {
      const item = _notificacoesCache.find(n => n.id === id);
      if (item) item.lida = true;
      _emitNotificacoesChange();
    }
  } catch (e) {
    console.error('Erro ao marcar notificação como lida:', e);
  }
}

async function marcarTodasNotificacoesLidas() {
  if (!sbClient || !isAdmin()) return;
  const ids = (_notificacoesCache || []).filter(n => !n.lida).map(n => n.id);
  if (!ids.length) return;
  try {
    await sbClient.from('notificacoes').update({ lida: true }).in('id', ids);
    if (_notificacoesCache) {
      _notificacoesCache.forEach(n => { n.lida = true; });
      _emitNotificacoesChange();
    }
  } catch (e) {
    console.error('Erro ao marcar todas como lidas:', e);
  }
}

