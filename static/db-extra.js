// db-extra.js — Persistência no Supabase (com fallback para localStorage)
// Tabelas: metas, comentarios, historico, scoring_config, alertas_config, colaborador_fotos, colab_inativos

// ─── Helpers internos ────────────────────────────────────────────
function _uid() {
  try { return sbClient?.auth?.getUser()?.then?.(r => r.data?.user?.id) ?? null; }
  catch { return null; }
}

function _email() {
  try { return sbClient?.auth?.getUser()?.then?.(r => r.data?.user?.email) ?? null; }
  catch { return null; }
}

async function _getUserId() {
  try {
    const { data } = await sbClient.auth.getUser();
    return data?.user?.id || null;
  } catch { return null; }
}

async function _getUserEmail() {
  try {
    const { data } = await sbClient.auth.getUser();
    return data?.user?.email || '';
  } catch { return ''; }
}

// ─── METAS ───────────────────────────────────────────────────────

const METAS_LOCAL_KEY = 'sistema_metas_v1';

async function dbMetasLoad() {
  if (!sbClient) return _fallbackLoad(METAS_LOCAL_KEY, []);
  try {
    const uid = await _getUserId();
    if (!uid) return _fallbackLoad(METAS_LOCAL_KEY, []);
    const { data } = await sbClient.from('metas').select('*').eq('user_id', uid);
    if (data && Array.isArray(data) && data.length > 0) {
      const goals = data.map(r => ({
        id: r.id,
        title: r.title,
        type: r.type,
        metric: r.metric,
        target: r.target,
        setor: r.setor,
        collaborator: r.collaborator,
        period: r.period,
        createdAt: r.created_at
      }));
      localStorage.setItem(METAS_LOCAL_KEY, JSON.stringify(goals));
      return goals;
    }
    return _fallbackLoad(METAS_LOCAL_KEY, []);
  } catch {
    return _fallbackLoad(METAS_LOCAL_KEY, []);
  }
}

async function dbMetasSave(goals) {
  localStorage.setItem(METAS_LOCAL_KEY, JSON.stringify(goals));
  if (!sbClient) return;
  try {
    const uid = await _getUserId();
    if (!uid) return;
    const { error: delError } = await sbClient.from('metas').delete().eq('user_id', uid);
    if (delError) return;
    if (goals.length === 0) return;
    const rows = goals.filter(g => g && (g.id || g.title)).map(g => ({
      user_id: uid,
      title: g.title || 'Meta',
      type: g.type || 'monthly',
      metric: g.metric || 'finalizados',
      target: parseFloat(g.target) || 0,
      setor: g.setor || 'all',
      collaborator: g.collaborator || '',
      period: g.period || 'all'
    }));
    await sbClient.from('metas').insert(rows);
  } catch {}
}

// ─── COMENTÁRIOS ─────────────────────────────────────────────────

const COMENTARIOS_LOCAL_KEY = 'sistema_comentarios_v1';

async function dbComentariosLoad() {
  if (!sbClient) return _fallbackLoad(COMENTARIOS_LOCAL_KEY, {});
  try {
    const { data } = await sbClient.from('comentarios').select('*').order('created_at', { ascending: true });
    if (data && Array.isArray(data) && data.length > 0) {
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
      localStorage.setItem(COMENTARIOS_LOCAL_KEY, JSON.stringify(map));
      return map;
    }
    return _fallbackLoad(COMENTARIOS_LOCAL_KEY, {});
  } catch {
    return _fallbackLoad(COMENTARIOS_LOCAL_KEY, {});
  }
}

async function dbComentarioAdd(mes, texto) {
  const map = JSON.parse(localStorage.getItem(COMENTARIOS_LOCAL_KEY) || '{}');
  const email = await _getUserEmail();
  const entry = {
    id: Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    texto: texto.trim(),
    user: email || 'desconhecido',
    ts: new Date().toISOString()
  };
  if (!map[mes]) map[mes] = [];
  map[mes].push(entry);
  localStorage.setItem(COMENTARIOS_LOCAL_KEY, JSON.stringify(map));
  if (sbClient) {
    try {
      await sbClient.from('comentarios').insert({
        mes,
        texto: texto.trim(),
        user_email: email || ''
      });
    } catch {}
  }
  return entry;
}

async function dbComentarioDel(mes, id) {
  const map = JSON.parse(localStorage.getItem(COMENTARIOS_LOCAL_KEY) || '{}');
  if (map[mes]) {
    map[mes] = map[mes].filter(c => c.id !== id);
    if (!map[mes].length) delete map[mes];
    localStorage.setItem(COMENTARIOS_LOCAL_KEY, JSON.stringify(map));
  }
  if (sbClient) {
    try {
      await sbClient.from('comentarios').delete().eq('id', id);
    } catch {
      try {
        await sbClient.from('comentarios').delete().filter('id', 'eq', id);
      } catch {}
    }
  }
}

// ─── HISTÓRICO ───────────────────────────────────────────────────

const HISTORICO_LOCAL_KEY = 'sistema_historico_v1';

async function dbHistoricoLoad() {
  if (!sbClient) return _fallbackLoad(HISTORICO_LOCAL_KEY, []);
  try {
    const { data } = await sbClient.from('historico').select('*').order('created_at', { ascending: false }).limit(500);
    if (data && Array.isArray(data) && data.length > 0) {
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
      localStorage.setItem(HISTORICO_LOCAL_KEY, JSON.stringify(log));
      return log;
    }
    return _fallbackLoad(HISTORICO_LOCAL_KEY, []);
  } catch {
    return _fallbackLoad(HISTORICO_LOCAL_KEY, []);
  }
}

async function dbHistoricoAdd(entry) {
  const log = JSON.parse(localStorage.getItem(HISTORICO_LOCAL_KEY) || '[]');
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
  localStorage.setItem(HISTORICO_LOCAL_KEY, JSON.stringify(log));
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
    } catch {}
  }
}

// ─── SCORING RULES ───────────────────────────────────────────────

const SCORING_LOCAL_KEY = 'sistema_scoring_rules_v1';

async function dbScoringLoad() {
  if (!sbClient) return null;
  try {
    const uid = await _getUserId();
    if (!uid) return null;
    const { data } = await sbClient.from('scoring_config').select('rules').eq('user_id', uid).maybeSingle();
    if (data?.rules && Array.isArray(data.rules)) {
      localStorage.setItem(SCORING_LOCAL_KEY, JSON.stringify(data.rules));
      return data.rules;
    }
    return null;
  } catch { return null; }
}

async function dbScoringSave(rules) {
  localStorage.setItem(SCORING_LOCAL_KEY, JSON.stringify(rules));
  if (!sbClient) return;
  try {
    const uid = await _getUserId();
    if (!uid) return;
    const existing = await sbClient.from('scoring_config').select('id').eq('user_id', uid).maybeSingle();
    if (existing?.data?.id) {
      await sbClient.from('scoring_config').update({ rules, updated_at: new Date().toISOString() }).eq('user_id', uid);
    } else {
      await sbClient.from('scoring_config').insert({ user_id: uid, rules });
    }
  } catch {}
}

// ─── ALERTAS CONFIG ──────────────────────────────────────────────

const ALERTAS_LOCAL_KEY = 'sistema_alertas_config_v1';

async function dbAlertasLoad() {
  if (!sbClient) return null;
  try {
    const uid = await _getUserId();
    if (!uid) return null;
    const { data } = await sbClient.from('alertas_config').select('config').eq('user_id', uid).maybeSingle();
    if (data?.config && Array.isArray(data.config)) {
      localStorage.setItem(ALERTAS_LOCAL_KEY, JSON.stringify(data.config));
      return data.config;
    }
    return null;
  } catch { return null; }
}

async function dbAlertasSave(config) {
  localStorage.setItem(ALERTAS_LOCAL_KEY, JSON.stringify(config));
  if (!sbClient) return;
  try {
    const uid = await _getUserId();
    if (!uid) return;
    const existing = await sbClient.from('alertas_config').select('id').eq('user_id', uid).maybeSingle();
    if (existing?.data?.id) {
      await sbClient.from('alertas_config').update({ config, updated_at: new Date().toISOString() }).eq('user_id', uid);
    } else {
      await sbClient.from('alertas_config').insert({ user_id: uid, config });
    }
  } catch {}
}

// ─── FOTOS ───────────────────────────────────────────────────────

const FOTOS_LOCAL_KEY = 'sistema_colab_fotos_v1';

async function dbFotosLoad() {
  if (!sbClient) return _fallbackLoad(FOTOS_LOCAL_KEY, {});
  try {
    const { data } = await sbClient.from('colaborador_fotos').select('*');
    if (data && Array.isArray(data) && data.length > 0) {
      const map = {};
      data.forEach(f => { map[f.nome] = f.foto_url || ''; });
      localStorage.setItem(FOTOS_LOCAL_KEY, JSON.stringify(map));
      return map;
    }
    return _fallbackLoad(FOTOS_LOCAL_KEY, {});
  } catch {
    return _fallbackLoad(FOTOS_LOCAL_KEY, {});
  }
}

async function dbFotoSave(nome, url) {
  const map = JSON.parse(localStorage.getItem(FOTOS_LOCAL_KEY) || '{}');
  if (url) map[nome] = url;
  else delete map[nome];
  localStorage.setItem(FOTOS_LOCAL_KEY, JSON.stringify(map));
  if (!sbClient) return;
  try {
    const existing = await sbClient.from('colaborador_fotos').select('id').eq('nome', nome).maybeSingle();
    if (existing?.data?.id) {
      if (url) {
        await sbClient.from('colaborador_fotos').update({ foto_url: url, updated_at: new Date().toISOString() }).eq('nome', nome);
      } else {
        await sbClient.from('colaborador_fotos').delete().eq('nome', nome);
      }
    } else if (url) {
      await sbClient.from('colaborador_fotos').insert({ nome, foto_url: url });
    }
  } catch {}
}

// ─── COLABORADORES INATIVOS ──────────────────────────────────────

const INATIVOS_LOCAL_KEY = 'sistema_inactive_colabs_v1';

async function dbInativosLoad() {
  if (!sbClient) return null;
  try {
    const uid = await _getUserId();
    if (!uid) return null;
    const { data } = await sbClient.from('colab_inativos').select('nome').eq('user_id', uid);
    if (data && Array.isArray(data) && data.length > 0) {
      const names = data.map(r => r.nome);
      localStorage.setItem(INATIVOS_LOCAL_KEY, JSON.stringify(names));
      if (typeof window.__inactiveColabs !== 'undefined') {
        window.__inactiveColabs = new Set(names);
      }
      return new Set(names);
    }
    return null;
  } catch { return null; }
}

async function dbInativosSave(names) {
  const arr = [...names];
  localStorage.setItem(INATIVOS_LOCAL_KEY, JSON.stringify(arr));
  if (!sbClient) return;
  try {
    const uid = await _getUserId();
    if (!uid) return;
    await sbClient.from('colab_inativos').delete().eq('user_id', uid);
    if (arr.length) {
      await sbClient.from('colab_inativos').insert(arr.map(nome => ({ user_id: uid, nome })));
    }
  } catch {}
}

// ─── FEEDBACKS ──────────────────────────────────────────────────

const FEEDBACKS_LOCAL_KEY = 'sistema_feedbacks_v1';

async function dbFeedbacksLoad() {
  if (!sbClient) return _fallbackLoad(FEEDBACKS_LOCAL_KEY, []);
  try {
    const uid = await _getUserId();
    if (!uid) return _fallbackLoad(FEEDBACKS_LOCAL_KEY, []);
    const { data } = await sbClient.from('feedbacks').select('*').eq('user_id', uid).order('created_at', { ascending: false });
    if (data && Array.isArray(data) && data.length > 0) {
      const list = data.map(r => ({
        id: r.id,
        colaborador: r.colaborador,
        mes: r.mes,
        sugestao_automatica: r.sugestao_automatica || '',
        anotacoes: r.anotacoes || '',
        feedback_final: r.feedback_final || '',
        createdAt: r.created_at,
        updatedAt: r.updated_at
      }));
      localStorage.setItem(FEEDBACKS_LOCAL_KEY, JSON.stringify(list));
      return list;
    }
    return _fallbackLoad(FEEDBACKS_LOCAL_KEY, []);
  } catch {
    return _fallbackLoad(FEEDBACKS_LOCAL_KEY, []);
  }
}

async function dbFeedbacksSave(feedback) {
  const list = JSON.parse(localStorage.getItem(FEEDBACKS_LOCAL_KEY) || '[]');
  const idx = list.findIndex(f => f.id === feedback.id);
  if (idx >= 0) list[idx] = feedback;
  else list.unshift(feedback);
  localStorage.setItem(FEEDBACKS_LOCAL_KEY, JSON.stringify(list));
  if (!sbClient) return;
  try {
    const uid = await _getUserId();
    if (!uid) return;
    const existing = await sbClient.from('feedbacks').select('id').eq('id', feedback.id).maybeSingle();
    if (existing?.data?.id) {
      await sbClient.from('feedbacks').update({
        colaborador: feedback.colaborador,
        mes: feedback.mes,
        sugestao_automatica: feedback.sugestao_automatica || '',
        anotacoes: feedback.anotacoes || '',
        feedback_final: feedback.feedback_final || '',
        updated_at: new Date().toISOString()
      }).eq('id', feedback.id);
    } else {
      await sbClient.from('feedbacks').insert({
        user_id: uid,
        colaborador: feedback.colaborador,
        mes: feedback.mes,
        sugestao_automatica: feedback.sugestao_automatica || '',
        anotacoes: feedback.anotacoes || '',
        feedback_final: feedback.feedback_final || ''
      });
    }
  } catch {}
}

async function dbFeedbacksDelete(id) {
  const list = JSON.parse(localStorage.getItem(FEEDBACKS_LOCAL_KEY) || '[]');
  const filtered = list.filter(f => f.id !== id);
  localStorage.setItem(FEEDBACKS_LOCAL_KEY, JSON.stringify(filtered));
  if (!sbClient) return;
  try {
    await sbClient.from('feedbacks').delete().eq('id', id);
  } catch {}
}

// ─── FALLBACK ────────────────────────────────────────────────────

function _fallbackLoad(key, defaultVal) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : defaultVal;
  } catch { return defaultVal; }
}

// ─── MIGRAÇÃO ÚNICA localStorage → Supabase ──────────────────────
// Executa uma vez para migrar dados antigos que estão apenas no localStorage
const MIGRATION_FLAG_KEY = 'sistema_migrated_to_supabase_v1';

async function migrateLocalToSupabase() {
  if (!sbClient) return;
  try {
    if (localStorage.getItem(MIGRATION_FLAG_KEY)) return;
    const uid = await _getUserId();
    if (!uid) return;

    // Metas
    const metasRaw = localStorage.getItem(METAS_LOCAL_KEY);
    if (metasRaw) {
      const metas = JSON.parse(metasRaw);
      if (Array.isArray(metas) && metas.length > 0) {
        const { data: existing } = await sbClient.from('metas').select('id').eq('user_id', uid).limit(1);
        if (!existing || existing.length === 0) {
          await dbMetasSave(metas);
        }
      }
    }

    // Comentários
    const comRaw = localStorage.getItem(COMENTARIOS_LOCAL_KEY);
    if (comRaw) {
      const com = JSON.parse(comRaw);
      if (typeof com === 'object' && Object.keys(com).length > 0) {
        const { data: existing } = await sbClient.from('comentarios').select('id').limit(1);
        if (!existing || existing.length === 0) {
          for (const mes of Object.keys(com)) {
            for (const c of com[mes]) {
              await sbClient.from('comentarios').insert({ mes, texto: c.texto, user_email: c.user || '' });
            }
          }
        }
      }
    }

    // Histórico
    const histRaw = localStorage.getItem(HISTORICO_LOCAL_KEY);
    if (histRaw) {
      const hist = JSON.parse(histRaw);
      if (Array.isArray(hist) && hist.length > 0) {
        const { data: existing } = await sbClient.from('historico').select('id').limit(1);
        if (!existing || existing.length === 0) {
          for (const h of hist) {
            await sbClient.from('historico').insert({
              action: h.action || '',
              colaborador: h.colaborador || '',
              mes: h.mes || '',
              campo: h.campo || '',
              before_value: h.before || '',
              after_value: h.after || '',
              detalhes: h.detalhes || '',
              user_email: h.user || ''
            });
          }
        }
      }
    }

    // Scoring rules
    const scoreRaw = localStorage.getItem(SCORING_LOCAL_KEY);
    if (scoreRaw) {
      const rules = JSON.parse(scoreRaw);
      if (Array.isArray(rules) && rules.length > 0) {
        const { data: existing } = await sbClient.from('scoring_config').select('id').eq('user_id', uid).limit(1);
        if (!existing || existing.length === 0) {
          await dbScoringSave(rules);
        }
      }
    }

    // Alertas config
    const alertRaw = localStorage.getItem(ALERTAS_LOCAL_KEY);
    if (alertRaw) {
      const config = JSON.parse(alertRaw);
      if (Array.isArray(config) && config.length > 0) {
        const { data: existing } = await sbClient.from('alertas_config').select('id').eq('user_id', uid).limit(1);
        if (!existing || existing.length === 0) {
          await dbAlertasSave(config);
        }
      }
    }

    // Fotos
    const fotosRaw = localStorage.getItem(FOTOS_LOCAL_KEY);
    if (fotosRaw) {
      const fotos = JSON.parse(fotosRaw);
      if (typeof fotos === 'object' && Object.keys(fotos).length > 0) {
        const { data: existing } = await sbClient.from('colaborador_fotos').select('id').limit(1);
        if (!existing || existing.length === 0) {
          for (const nome of Object.keys(fotos)) {
            if (fotos[nome]) {
              await sbClient.from('colaborador_fotos').insert({ nome, foto_url: fotos[nome] });
            }
          }
        }
      }
    }

    // Inativos
    const inatRaw = localStorage.getItem(INATIVOS_LOCAL_KEY);
    if (inatRaw) {
      const names = JSON.parse(inatRaw);
      if (Array.isArray(names) && names.length > 0) {
        const { data: existing } = await sbClient.from('colab_inativos').select('id').eq('user_id', uid).limit(1);
        if (!existing || existing.length === 0) {
          await dbInativosSave(new Set(names));
        }
      }
    }

    // Feedbacks
    const fbRaw = localStorage.getItem(FEEDBACKS_LOCAL_KEY);
    if (fbRaw) {
      const fb = JSON.parse(fbRaw);
      if (Array.isArray(fb) && fb.length > 0) {
        const { data: existing } = await sbClient.from('feedbacks').select('id').eq('user_id', uid).limit(1);
        if (!existing || existing.length === 0) {
          for (const f of fb) {
            await sbClient.from('feedbacks').insert({
              user_id: uid,
              colaborador: f.colaborador || '',
              mes: f.mes || '',
              sugestao_automatica: f.sugestao_automatica || '',
              anotacoes: f.anotacoes || '',
              feedback_final: f.feedback_final || ''
            });
          }
        }
      }
    }

    localStorage.setItem(MIGRATION_FLAG_KEY, '1');
  } catch (e) { console.warn('[db-extra] migrateLocalToSupabase error:', e); }
}

// ─── INIT ────────────────────────────────────────────────────────
// Chamado pelo app.js no DOMContentLoaded para carregar dados do Supabase
async function initDbExtra() {
  if (!sbClient) return;
  try {
    await migrateLocalToSupabase();
    await Promise.allSettled([
      dbMetasLoad(),
      dbComentariosLoad(),
      dbHistoricoLoad(),
      dbScoringLoad(),
      dbAlertasLoad(),
      dbFotosLoad(),
      dbInativosLoad(),
      dbFeedbacksLoad()
    ]);
  } catch {}
}
