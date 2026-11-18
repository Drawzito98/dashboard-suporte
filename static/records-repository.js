/* Records repository: server snapshot, account cache and durable pending edits. */
(function (root) {
  'use strict';
  const clone = value => JSON.parse(JSON.stringify(value));
  const fields = new Set(['id','Setor','Mês','Atendente','Assumidos','Transferidos','Finalizados','Score','Objetivo','Observações','Nota1','Nota2','Nota3','Total','Arquivo','TMA','TMR']);
  function clean(row) {
    const value = {};
    for (const [key, item] of Object.entries(row || {})) { const column = key === 'SCORE' ? 'Score' : key; if (fields.has(column)) value[column] = item; }
    return value;
  }
  const map = row => { const next = { ...row }; if (Object.prototype.hasOwnProperty.call(next, 'Score')) { next.SCORE = next.Score; delete next.Score; } return next; };
  function create({ client, session }) {
    let confirmed = [], source = 'none', status = 'idle', lastError = null, queue = null, loading = 0, serial = 0;
    const locks = new Map();
    function read(key, fallback) { try { return JSON.parse(session.cache.getItem(key)) || fallback; } catch (_) { return fallback; } }
    function pending() { if (!session.owner()) return []; queue = read('records_pending_v1', queue || []); return clone(Array.isArray(queue) ? queue : []); }
    function persist(next) { session.cache.setItem('records_pending_v1', JSON.stringify(next)); queue = next; publish('pending'); }
    function view() {
      if (!session.owner()) return [];
      const result = clone(confirmed);
      for (const operation of pending()) {
        const existing = operation.record.id == null ? null : result.find(row => String(row.id) === String(operation.record.id));
        if (existing) Object.assign(existing, operation.record);
        else result.push({ ...operation.record, _pendingId: operation.key });
      }
      return result;
    }
    function publish(reason) { session.state.publish('records', { confirmed, view: view(), pending: pending(), source, status, error: lastError }, session.token(), reason); }
    async function guard(expected) {
      const { data, error } = await client.auth.getUser();
      if (error || !data?.user?.id || data.user.app_metadata?.role !== 'admin') throw new Error('Sessão de administrador necessária.');
      session.bind(data.user);
      const token = expected || session.token();
      if (!session.current(token) || token.owner !== data.user.id) throw new Error('A sessão mudou.');
      return token;
    }
    function enqueue(record) {
      if (!session.owner()) throw new Error('Entre na sua conta antes de preservar pendências.');
      const list = pending(), key = record.id != null ? 'id:' + record.id : record._pendingId || ('local:' + Date.now() + ':' + (++serial));
      const old = list.find(item => item.key === key);
      const item = { key, revision: Date.now() + ':' + (++serial), record: { ...old?.record, ...record } };
      delete item.record._pendingAt; delete item.record._pendingId;
      persist([...list.filter(entry => entry.key !== key), item]);
      return item;
    }
    function acknowledge(item) { const list = pending(); persist(list.filter(entry => entry.key !== item.key || entry.revision !== item.revision)); }
    function setConfirmed(rows) { confirmed = clone(rows); source = 'server'; status = 'ready'; lastError = null; try { session.cache.setItem('records_confirmed_v1', JSON.stringify(confirmed)); } catch (_) { lastError = 'cache-unavailable'; } }
    async function load() {
      const request = ++loading, token = await guard(); status = 'loading'; publish('loading');
      try {
        const rows = [];
        for (let offset = 0; ; offset += 1000) {
          const { data, error } = await client.from('registros').select('*').order('id', { ascending: true }).range(offset, offset + 999);
          if (error || !Array.isArray(data)) throw error || new Error('Resposta inválida');
          if (!session.current(token)) throw new Error('Sessão encerrada');
          rows.push(...data.map(map));
          if (data.length < 1000) break;
        }
        await guard(token);
        if (request !== loading) return null;
        setConfirmed(rows); publish('loaded'); return view();
      } catch (_) {
        if (!session.current(token) || request !== loading) return null;
        confirmed = read('records_confirmed_v1', []); if (!Array.isArray(confirmed)) confirmed = [];
        source = 'cache'; status = 'offline'; lastError = 'server-unavailable'; publish('offline');
        return view();
      }
    }
    async function update(id, changes, operation) {
      if (id == null) return false;
      let token = session.token();
      if (!session.current(token) || session.role() !== 'admin') token = await guard();
      const item = operation || enqueue({ ...changes, id });
      const run = async () => {
        try {
          await guard(token);
          const payload = clean(item.record); delete payload.id;
          let result = await client.from('registros').update(payload).eq('id', id).select('id');
          if (result.error?.code === '42501') {
            await guard(token);
            result = await client.from('registros').update({ ...payload, user_id: token.owner }).eq('id', id).select('id');
          }
          await guard(token);
          if (result.error || !result.data?.some(row => String(row.id) === String(id))) throw result.error || new Error('Sem confirmação');
          const row = confirmed.find(row => String(row.id) === String(id));
          if (row) Object.assign(row, map(payload));
          try { session.cache.setItem('records_confirmed_v1', JSON.stringify(confirmed)); } catch (_) {}
          lastError = null; acknowledge(item); return true;
        } catch (_) { if (session.current(token)) { lastError = 'write-unconfirmed'; publish('pending'); } return false; }
      };
      const key = String(id), previous = locks.get(key) || Promise.resolve();
      const task = previous.catch(() => {}).then(run); locks.set(key, task);
      try { return await task; } finally { if (locks.get(key) === task) locks.delete(key); }
    }
    async function insert(rows) {
      const token = await guard();
      const { data, error } = await client.from('registros').insert(rows.map(clean)).select();
      await guard(token);
      if (error || !Array.isArray(data) || data.length !== rows.length) return null;
      confirmed.push(...data.map(map)); source = 'server';
      try { session.cache.setItem('records_confirmed_v1', JSON.stringify(confirmed)); } catch (_) {}
      publish('inserted'); return data.map(map);
    }
    async function remove(id) {
      const token = await guard();
      let query = client.from('registros').delete();
      query = id == null ? query.neq('id', 0) : query.eq('id', id);
      const { data, error } = await query.select('id');
      await guard(token);
      if (error || !Array.isArray(data) || (id != null && !data.some(row => String(row.id) === String(id)))) return false;
      confirmed = id == null ? [] : confirmed.filter(row => String(row.id) !== String(id));
      persist(id == null ? [] : pending().filter(item => String(item.record.id) !== String(id)));
      setConfirmed(confirmed); publish('deleted'); return true;
    }
    async function retry() {
      const token = await guard(), done = [];
      for (const item of pending()) {
        if (!session.current(token)) break;
        if (item.record.id != null) { if (await update(item.record.id, item.record, item)) done.push(item.record); }
        else {
          try { const saved = await insert([item.record]); if (saved && session.current(token)) { acknowledge(item); done.push(item.record); } } catch (_) {}
        }
      }
      if (session.current(token)) publish('retried'); return done;
    }
    return { load, update, insert, remove, retry, enqueue, pending: () => pending().map(item => ({ ...item.record, _pendingId: item.key })), clearPending: () => persist([]), view, snapshot: () => session.state.get('records') };
  }
  root.RecordsRepository = { create, clean, map };
  if (typeof module !== 'undefined') module.exports = root.RecordsRepository;
})(typeof window !== 'undefined' ? window : globalThis);
