/* Read-only projection. No new storage, identity migration or business calculations. */
(function (root) {
  'use strict';
  const exact = (a, b) => typeof a === 'string' && a === b;
  const list = value => Array.isArray(value) ? value : [];
  const admin = user => Boolean(user?.id) && user.app_metadata?.role === 'admin';
  function readPdi(storage, owner, name) {
    try {
      const data = JSON.parse(storage.getItem('sistema_perfil_pdi_v1_' + owner) || '{}');
      if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Formato inválido');
      const person = Object.prototype.hasOwnProperty.call(data, name) ? data[name] : null;
      if (person != null && (typeof person !== 'object' || Array.isArray(person))) throw new Error('Perfil inválido');
      const planos = list(person?.planos);
      if (planos.some(plan => !plan || typeof plan !== 'object' || Array.isArray(plan))) throw new Error('Plano inválido');
      return { status: 'ok', data: person ? { ...person, planos } : { complemento: {}, planos: [] } };
    } catch (_) { return { status: 'error', data: null }; }
  }
  function timeline(sources, pdi) {
    const events = [];
    const add = (source, date, title, text) => events.push({ source, date: date || '', title: String(title || ''), text: String(text || '') });
    const rows = key => sources[key]?.status === 'ok' ? list(sources[key].data) : [];
    rows('avaliacoes').forEach(r => add('Avaliação', r.updated_at || r.created_at, r.ciclo, r.status || 'Status não informado'));
    rows('feedbacks').forEach(r => add('Feedback', r.updated_at || r.created_at, r.mes, r.feedback_final || r.anotacoes || 'Sem texto final'));
    rows('ferias').forEach(r => add('Férias', r.data_inicio, 'Férias registradas', r.data_inicio + ' a ' + r.data_fim));
    rows('ausencias').forEach(r => add('Ausência', r.data, r.periodo, r.motivo));
    rows('historico').forEach(r => add('Histórico de dados', r.created_at, r.action, r.campo ? `${r.campo}: ${r.before_value ?? '—'} → ${r.after_value ?? '—'}` : r.detalhes));
    rows('atividades').forEach(r => add('Atividade', r.data, r.tipo === 'positivo' ? 'Positivo' : 'Ponto de atenção', r.descricao));
    rows('ponto').forEach(r => add('Ponto', r.data_importacao, 'Análise preservada', r.periodo_inicio + ' a ' + r.periodo_fim));
    rows('bonus').forEach(r => add('Bônus / penalidade', r.created_at, r.mes, `${r.pontos ?? '—'} ponto(s) · ${r.descricao || 'Sem descrição'}`));
    if (pdi?.status === 'ok') list(pdi.data?.planos).forEach(r => add('PDI local', r.salvoEm || r.geradoEm, `Versão ${r.versao ?? '—'}`, r.status || 'rascunho'));
    return events.sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0));
  }
  function create({ client, storage }) {
    async function guard(expectedOwner) {
      const { data, error } = await client.auth.getUser();
      if (error || !admin(data?.user) || (expectedOwner && data.user.id !== expectedOwner)) throw new Error('Sessão inválida para consultar o perfil 360º.');
      return data.user.id;
    }
    async function pages(table, columns, filters, order = 'id') {
      const result = [];
      for (let start = 0; ; start += 500) {
        let query = client.from(table).select(columns);
        for (const [key, value] of filters) query = query.eq(key, value);
        if (table === 'anotacoes_diarias') query = query.like('conteudo', 'atividade-colaborador:v1:%');
        query = query.order(order, { ascending: true });
        if (order !== 'id') query = query.order('id', { ascending: true });
        const { data, error } = await query.range(start, start + 499);
        if (error || !Array.isArray(data)) throw error || new Error('Resposta inválida');
        result.push(...data);
        if (data.length < 500) return result;
      }
    }
    async function load(name, expectedOwner) {
      if (typeof name !== 'string' || !name.trim()) throw new Error('Selecione uma pessoa pelo nome completo.');
      const owner = await guard(expectedOwner);
      const privateFilters = [['user_id', owner], ['colaborador', name]];
      const specs = {
        cadastro: ['colaboradores_info', '*', [['user_id', owner], ['nome', name]]],
        registros: ['registros', '*', [['Atendente', name]]], // Existing RLS also permits legacy shared records.
        avaliacoes: ['avaliacoes', '*', privateFilters],
        feedbacks: ['feedbacks', '*', privateFilters],
        ferias: ['ferias', '*', privateFilters],
        ausencias: ['ausencias', '*', privateFilters],
        bonus: ['pontos_extras', '*', privateFilters],
        historico: ['historico', '*', [['colaborador', name]], 'created_at'], // Shared audit trail, under existing RLS.
        atividades: ['anotacoes_diarias', 'id,user_id,data,conteudo', [['user_id', owner]]],
        jornadas: ['ponto_colaboradores', '*,ponto_jornadas(*)', [['user_id', owner], ['nome', name]]]
      };
      const sources = {};
      await Promise.all(Object.entries(specs).map(async ([key, args]) => {
        try { sources[key] = { status: 'ok', data: await pages(...args) }; }
        catch (_) { sources[key] = { status: 'error', data: [] }; }
      }));
      // Defense in depth: never merge a name variant, another owner or a nonmatching row.
      for (const key of ['avaliacoes', 'feedbacks', 'ferias', 'ausencias', 'bonus']) sources[key].data = sources[key].data.filter(r => exact(r.colaborador, name) && r.user_id === owner);
      for (const key of ['cadastro', 'jornadas']) {
        sources[key].data = sources[key].data.filter(r => exact(r.nome, name) && r.user_id === owner);
        if (sources[key].data.length > 1) sources[key] = { status: 'ambiguous', data: [] };
      }
      sources.registros.data = sources.registros.data.filter(r => exact(r.Atendente, name)).map(r => ({ ...r, SCORE: r.Score ?? r.SCORE }));
      sources.historico.data = sources.historico.data.filter(r => exact(r.colaborador, name));
      sources.atividades.data = sources.atividades.data.flatMap(row => {
        if (row.user_id !== owner || !row.conteudo?.startsWith('atividade-colaborador:v1:')) return [];
        try { const value = JSON.parse(row.conteudo.slice('atividade-colaborador:v1:'.length));
          return exact(value.colaborador, name) && ['positivo', 'atencao'].includes(value.tipo) && value.descricao ? [{ ...row, tipo: value.tipo, descricao: value.descricao }] : [];
        } catch (_) { return []; }
      });
      const employee = sources.jornadas.data[0];
      sources.ponto = { status: sources.jornadas.status === 'ok' && !employee ? 'unlinked' : sources.jornadas.status, data: [] };
      if (employee) {
        try {
          const rows = await pages('ponto_importacoes', 'id,user_id,colaborador_id,periodo_inicio,periodo_fim,data_importacao,snapshot', [['user_id', owner], ['colaborador_id', employee.id]]);
          sources.ponto = { status: 'ok', data: rows.filter(r => r.user_id === owner && r.colaborador_id === employee.id) };
        } catch (_) { sources.ponto = { status: 'error', data: [] }; }
      }
      await guard(owner); // Discard every source if the account changed during the read.
      const pdi = readPdi(storage, owner, name);
      return { name, owner, sources, pdi, events: timeline(sources, pdi), loadedAt: new Date().toISOString() };
    }
    return { load };
  }
  const api = { create, timeline, readPdi };
  root.Equipe360Data = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
