/* Session, scoped cache and resource events. No application business rules. */
(function (root) {
  'use strict';
  const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
  function create({ storage, notify = () => {} }) {
    let owner = null, role = null, epoch = 0, suspended = false;
    const resources = new Map(), listeners = new Set();
    const publicKeys = new Set(['theme', 'dashboard_privacy_screen_on']);
    function emit(resource, reason) {
      const event = Object.freeze({ resource, reason, owner, epoch });
      for (const listener of listeners) { try { listener(event); } catch (_) {} }
      notify(event);
    }
    function key(name) {
      if (publicKeys.has(name)) return name;
      if (!owner || suspended) return null;
      // Keep already scoped PDI/review storage compatible; never permit another owner.
      for (const prefix of ['sistema_perfil_pdi_v1_', 'sistema_diagnosticos_revisoes_v1:']) {
        if (name.startsWith(prefix)) return name === prefix + owner ? name : null;
      }
      return 'app:user:v1:' + encodeURIComponent(owner) + ':' + name;
    }
    const cache = {
      getItem(name) { const target = key(String(name)); return target ? storage.getItem(target) : null; },
      setItem(name, value) { const target = key(String(name)); if (!target) throw new Error('Armazenamento privado sem sessão ativa.'); storage.setItem(target, String(value)); },
      removeItem(name) { const target = key(String(name)); if (target) storage.removeItem(target); }
    };
    const session = {
      bind(user) {
        if (!user?.id || suspended || (owner && owner !== user.id)) throw new Error('Reabra a aplicação para iniciar outra sessão.');
        role = user.app_metadata?.role || role;
        if (!owner) { owner = user.id; epoch++; emit('session', 'bound'); }
        return session.token();
      },
      token: () => ({ owner, epoch }),
      current: token => Boolean(owner) && !suspended && token?.owner === owner && token.epoch === epoch,
      owner: () => suspended ? null : owner,
      role: () => suspended ? null : role,
      invalidated: () => suspended,
      invalidate() { suspended = true; owner = null; epoch++; resources.clear(); emit('session', 'invalidated'); },
      cache,
      state: {
        get: resource => clone(resources.get(resource) || null),
        publish(resource, value, token = session.token(), reason = 'changed') {
          if (!session.current(token)) return false;
          resources.set(resource, clone(value)); emit(resource, reason); return true;
        },
        subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); }
      }
    };
    return session;
  }
  root.DataRuntime = { create };
  if (typeof module !== 'undefined') module.exports = { create };
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    root.AppDataSession = create({ storage: localStorage, notify: detail => window.dispatchEvent(new CustomEvent('app-data-changed', { detail })) });
    root.AppState = root.AppDataSession.state;
    root.appStorage = root.AppDataSession.cache;
  }
})(typeof window !== 'undefined' ? window : globalThis);
