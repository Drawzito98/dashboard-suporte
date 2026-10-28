// Persistência de people; contratos preservados pelo facade db-extra.js.
(function (root) {
// ─── FOTOS ───────────────────────────────────────────────────────



async function dbFotosLoad() {
  if (!sbClient) return _fallbackLoad(FOTOS_LOCAL_KEY, {});
  try {
    const { data, error } = await sbClient.from('colaborador_fotos').select('*');
    if (!error && Array.isArray(data)) {
      const localMap = _fallbackLoad(FOTOS_LOCAL_KEY, {});
      const map = {};
      data.forEach(f => {
        if (!f?.nome) return;
        const normalizedRemoteName = typeof normalizeColabFotoName === 'function'
          ? normalizeColabFotoName(f.nome)
          : String(f.nome).trim().toLowerCase();
        Object.keys(map).forEach(localName => {
          const normalizedLocalName = typeof normalizeColabFotoName === 'function'
            ? normalizeColabFotoName(localName)
            : String(localName).trim().toLowerCase();
          if (localName !== f.nome && normalizedLocalName === normalizedRemoteName) delete map[localName];
        });
        map[f.nome] = f.foto_url || '';
      });
      appStorage.setItem(FOTOS_LOCAL_KEY, JSON.stringify(map));
      window.dispatchEvent(new CustomEvent('colab-fotos-updated'));
      return map;
    }
    return _fallbackLoad(FOTOS_LOCAL_KEY, {});
  } catch {
    return _fallbackLoad(FOTOS_LOCAL_KEY, {});
  }
}

async function dbFotoSave(nome, url) {
  if (!requireAdmin()) return;
  const map = JSON.parse(appStorage.getItem(FOTOS_LOCAL_KEY) || '{}');
  if (url) map[nome] = url;
  else delete map[nome];
  appStorage.setItem(FOTOS_LOCAL_KEY, JSON.stringify(map));
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
  } catch (e) { console.error('[db-extra]', e); }
}


// ─── COLABORADORES INATIVOS ──────────────────────────────────────



async function dbInativosLoad() {
  if (!sbClient) return null;
  try {
    const uid = await _getUserId();
    if (!uid) return null;
    const { data, error } = await sbClient.from('colab_inativos').select('nome').eq('user_id', uid);
    if (!error && Array.isArray(data)) {
      const names = data.map(r => r.nome);
      appStorage.setItem(INATIVOS_LOCAL_KEY, JSON.stringify(names));
      if (typeof window.__inactiveColabs !== 'undefined') {
        window.__inactiveColabs = new Set(names);
      }
      window.dispatchEvent(new CustomEvent('colab-active-state-changed'));
      return new Set(names);
    }
    return null;
  } catch { return null; }
}

async function dbInativosSave(names) {
  if (!requireAdmin()) return;
  const arr = [...names];
  appStorage.setItem(INATIVOS_LOCAL_KEY, JSON.stringify(arr));
  if (!sbClient) return;
  try {
    const uid = await _getUserId();
    if (!uid) return;
    await sbClient.from('colab_inativos').delete().eq('user_id', uid);
    if (arr.length) {
      await sbClient.from('colab_inativos').insert(arr.map(nome => ({ user_id: uid, nome })));
    }
  } catch (e) { console.error('[db-extra]', e); }
}


// ─── SETORES INATIVOS ─────────────────────────────────────────



async function dbSetorInativosLoad() {
  if (!sbClient) return null;
  try {
    const uid = await _getUserId();
    if (!uid) return null;
    const { data, error } = await sbClient.from('setor_inativos').select('nome').eq('user_id', uid);
    if (!error && Array.isArray(data)) {
      const names = data.map(r => r.nome);
      appStorage.setItem(INATIVOS_SETORES_LOCAL_KEY, JSON.stringify(names));
      if (typeof window.__inactiveSetores !== 'undefined') {
        names.forEach(n => window.__inactiveSetores.add(n));
      }
      return new Set(names);
    }
    return null;
  } catch { return null; }
}

async function dbSetorInativosSave(names) {
  if (!requireAdmin()) return;
  const arr = [...names];
  appStorage.setItem(INATIVOS_SETORES_LOCAL_KEY, JSON.stringify(arr));
  if (!sbClient) return;
  try {
    const uid = await _getUserId();
    if (!uid) return;
    await sbClient.from('setor_inativos').delete().eq('user_id', uid);
    if (arr.length) {
      await sbClient.from('setor_inativos').insert(arr.map(nome => ({ user_id: uid, nome })));
    }
  } catch (e) { console.error('[db-extra]', e); }
}


// ─── COLABORADORES INFO (Cadastro) ─────────────────────────────



async function dbColabInfoLoad() {
  if (!sbClient) return _fallbackLoad(COLAB_INFO_LOCAL_KEY, {});
  try {
    const uid = await _getUserId();
    if (!uid) return _fallbackLoad(COLAB_INFO_LOCAL_KEY, {});
    const { data, error } = await sbClient.from('colaboradores_info').select('*').eq('user_id', uid);
    if (!error && Array.isArray(data)) {
      const localMap = _fallbackLoad(COLAB_INFO_LOCAL_KEY, {});
      const map = {};
      data.forEach(r => {
        const remoteInfo = {
          id: r.id,
          data_aniversario: r.data_aniversario || '',
          data_admissao: r.data_admissao || '',
          email: r.email || '',
          setor_atual: r.setor_atual || '',
          tarefas_desempenhadas: r.tarefas_desempenhadas || '',
          objetivos_futuros: r.objetivos_futuros || '',
          observacoes: r.observacoes || '',
          conduta_negativa: r.conduta_negativa || '',
          conduta_motivo: r.conduta_motivo || '',
          feito_relevante: r.feito_relevante || '',
          feito_descricao: r.feito_descricao || '',
          nivel: r.nivel || '',
          salario: Object.prototype.hasOwnProperty.call(r, 'salario')
            ? (r.salario == null ? null : Number(r.salario))
            : (localMap[r.nome]?.salario ?? null),
          updatedAt: r.updated_at
        };
        const localInfo = localMap[r.nome] || {};
        const localTime = Date.parse(localInfo.updatedAt || '') || 0;
        const remoteTime = Date.parse(r.updated_at || '') || 0;
        const achievementColumnsMissing = !Object.prototype.hasOwnProperty.call(r, 'feito_relevante') || !Object.prototype.hasOwnProperty.call(r, 'feito_descricao');
        map[r.nome] = localTime > remoteTime
          ? { ...remoteInfo, ...localInfo, id: r.id }
          : { ...remoteInfo,
              ...(achievementColumnsMissing ? {
                feito_relevante: localInfo.feito_relevante || '',
                feito_descricao: localInfo.feito_descricao || ''
              } : {}) };
      });
      appStorage.setItem(COLAB_INFO_LOCAL_KEY, JSON.stringify(map));
      return map;
    }
    return _fallbackLoad(COLAB_INFO_LOCAL_KEY, {});
  } catch {
    return _fallbackLoad(COLAB_INFO_LOCAL_KEY, {});
  }
}

async function dbColabInfoSave(nome, data) {
  if (!requireAdmin()) return false;
  const map = JSON.parse(appStorage.getItem(COLAB_INFO_LOCAL_KEY) || '{}');
  map[nome] = { ...(map[nome] || {}), ...data, updatedAt: new Date().toISOString() };
  appStorage.setItem(COLAB_INFO_LOCAL_KEY, JSON.stringify(map));
  if (!sbClient) return false;
  try {
    const uid = await _getUserId();
    if (!uid) return false;
    const existing = await sbClient.from('colaboradores_info').select('id').eq('user_id', uid).eq('nome', nome).maybeSingle();
    if (existing?.error) throw existing.error;
    const payload = {
      data_aniversario: data.data_aniversario || null,
      data_admissao: data.data_admissao || null,
      email: data.email || '',
      setor_atual: data.setor_atual || '',
      tarefas_desempenhadas: data.tarefas_desempenhadas || '',
      objetivos_futuros: data.objetivos_futuros || '',
      observacoes: data.observacoes || '',
      conduta_negativa: data.conduta_negativa || '',
      conduta_motivo: data.conduta_motivo || '',
      feito_relevante: data.feito_relevante || '',
      feito_descricao: data.feito_descricao || '',
      nivel: data.nivel || '',
      salario: data.salario == null || data.salario === '' ? null : Number(data.salario),
      updated_at: new Date().toISOString()
    };
    const persist = values => existing?.data?.id
      ? sbClient.from('colaboradores_info').update(values).eq('id', existing.data.id)
      : sbClient.from('colaboradores_info').insert({ user_id: uid, nome, ...values });
    let result = await persist(payload);
    // Compatibilidade enquanto a migration_v45 ainda não foi aplicada.
    if (result?.error && ['PGRST204', '42703'].includes(result.error.code)
        && /salario/i.test(result.error.message || '')) {
      const { salario, ...withoutSalary } = payload;
      result = await persist(withoutSalary);
      if (result?.error) throw result.error;
      return salario == null;
    }
    if (result?.error) throw result.error;
    return true;
  } catch (e) {
    console.error('[db-extra] Perfil mantido localmente; sincronização pendente:', e);
    return false;
  }
}


  root.AppRepositories = root.AppRepositories || {};
  root.AppRepositories.people = { dbFotosLoad, dbFotoSave, dbInativosLoad, dbInativosSave, dbSetorInativosLoad, dbSetorInativosSave, dbColabInfoLoad, dbColabInfoSave };
})(window);
