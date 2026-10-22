/* Revisões privadas por usuário. Nenhuma escrita nos indicadores históricos. */
(function (root) {
  'use strict';
  function create({ client, storage, engine }) {
    const cacheKey = uid => `sistema_diagnosticos_revisoes_v1:${uid}`;
    async function identity() {
      const { data, error } = await client.auth.getUser();
      if (error || !engine.canReview(data?.user)) throw new Error('Somente administradores autenticados podem revisar diagnósticos.');
      return data.user;
    }
    const local = uid => {
      try { const list = JSON.parse(storage.getItem(cacheKey(uid)) || '[]'); return Array.isArray(list) ? list.filter(x => x.user_id === uid) : []; }
      catch (_) { return []; }
    };
    async function load() {
      const user = await identity();
      const cached = local(user.id);
      try {
        for (const pending of cached.filter(row => row.pending)) {
          const { pending: flag, ...row } = pending;
          const { error } = await client.from('diagnostico_revisoes').insert(row);
          if (!error || error.code === '23505') delete pending.pending;
        }
        const { data, error } = await client.from('diagnostico_revisoes').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1000);
        if (error) throw error;
        const ids = new Set((data || []).map(x => x.id));
        const merged = [...cached.filter(x => x.pending && !ids.has(x.id)), ...(data || [])].sort((a, b) => b.created_at.localeCompare(a.created_at));
        storage.setItem(cacheKey(user.id), JSON.stringify(merged));
        return merged;
      } catch (_) { return cached; }
    }
    async function save(review) {
      const user = await identity();
      if (!['validado', 'ajustado', 'descartado'].includes(review.status) || !/^[a-f0-9]{64}$/.test(review.fingerprint || '')) throw new Error('Revisão inválida.');
      if (review.status === 'ajustado' && !String(review.note || '').trim()) throw new Error('Descreva o ajuste para salvar esta revisão.');
      const row = { id: root.crypto.randomUUID(), user_id: user.id, fingerprint: review.fingerprint, status: review.status,
        note: String(review.note || '').trim().slice(0, 4000), snapshot: review.snapshot, created_at: new Date().toISOString() };
      try {
        const { error } = await client.from('diagnostico_revisoes').insert(row);
        if (error) throw error;
      } catch (_) { row.pending = true; }
      const cached = local(user.id); cached.unshift(row);
      storage.setItem(cacheKey(user.id), JSON.stringify(cached));
      return row;
    }
    return { load, save };
  }
  root.DiagnosticoStore = { create };
  if (typeof module !== 'undefined' && module.exports) module.exports = { create };
})(typeof window !== 'undefined' ? window : globalThis);
