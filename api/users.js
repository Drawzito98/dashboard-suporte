const SUPABASE_URL = process.env.SUPABASE_URL || 'https://agvkmfusyetkicmuvumz.supabase.co';
const SERVICE_ROLE_KEY = process.env.SERVICE_ROLE_KEY;

async function getCallerRole(req) {
  try {
    const auth = req.headers['authorization'] || req.headers['x-supabase-auth'] || '';
    const token = auth.replace('Bearer ', '');
    if (!token) return null;
    const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${token}`
      }
    });
    if (!response.ok) return null;
    const user = await response.json();
    return user?.user_metadata?.role || null;
  } catch {
    return null;
  }
}

async function requireAdminApi(req, res) {
  const role = await getCallerRole(req);
  if (role !== 'admin') {
    res.status(403).json({ error: 'Apenas administradores podem gerenciar usuários.' });
    return false;
  }
  return true;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-supabase-auth');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (!(await requireAdminApi(req, res))) return;

  try {
    // GET: listar usuários
    if (req.method === 'GET') {
      const response = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
        headers: {
          'apikey': SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`
        }
      });
      const data = await response.json();
      if (response.ok) {
        const users = data.users || (Array.isArray(data) ? data : []);
        await Promise.all(users.map(async user => {
          const legacyName = String(user.user_metadata?.csv_nome || '').trim();
          if (!legacyName || user.app_metadata?.csv_nome) return;
          const appMetadata = {
            ...(user.app_metadata || {}),
            role: user.user_metadata?.role || user.app_metadata?.role || 'viewer',
            csv_nome: legacyName,
            csv_setor: user.user_metadata?.csv_setor || null
          };
          const migration = await fetch(SUPABASE_URL + '/auth/v1/admin/users/' + user.id, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'apikey': SERVICE_ROLE_KEY,
              'Authorization': 'Bearer ' + SERVICE_ROLE_KEY
            },
            body: JSON.stringify({ app_metadata: appMetadata })
          });
          if (migration.ok) user.app_metadata = appMetadata;
        }));
      }
      return res.status(response.ok ? 200 : 400).json(data);
    }

    // POST: criar usuário individual ou sincronizar acessos da equipe
    if (req.method === 'POST') {
      if (req.body?.action === 'sync_active_team') {
        const collaborators = Array.isArray(req.body.collaborators) ? req.body.collaborators.slice(0, 300) : [];
        if (!collaborators.length) return res.status(400).json({ error: 'Nenhum colaborador ativo foi informado.' });
        const usersResponse = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=1000`, {
          headers: { 'apikey': SERVICE_ROLE_KEY, 'Authorization': `Bearer ${SERVICE_ROLE_KEY}` }
        });
        if (!usersResponse.ok) return res.status(400).json({ error: 'Não foi possível consultar os usuários atuais.' });
        const usersData = await usersResponse.json();
        const existingEmails = new Map((usersData.users || []).map(user => [String(user.email || '').toLowerCase(), user]));
        const seenEmails = new Set();
        const result = { created: [], existing: [], skipped: [], failed: [] };

        for (const item of collaborators) {
          const name = String(item?.name || '').trim();
          const email = String(item?.email || '').trim().toLowerCase();
          const sector = String(item?.sector || '').trim();
          if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            result.skipped.push({ name: name || 'Sem nome', reason: 'E-mail ausente ou inválido' });
            continue;
          }
          if (seenEmails.has(email)) {
            result.skipped.push({ name, reason: 'E-mail repetido na equipe' });
            continue;
          }
          seenEmails.add(email);
          if (existingEmails.has(email)) {
            const existing = existingEmails.get(email);
            const existingRole = existing.app_metadata?.role || existing.user_metadata?.role;
            if (existingRole !== 'admin') {
              const userMetadata = { ...(existing.user_metadata || {}), role: 'colaborador', ativo: true, name, csv_nome: name };
              const appMetadata = { ...(existing.app_metadata || {}), role: 'colaborador', csv_nome: name };
              if (sector) { userMetadata.csv_setor = sector; appMetadata.csv_setor = sector; }
              const linkage = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${existing.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'apikey': SERVICE_ROLE_KEY, 'Authorization': `Bearer ${SERVICE_ROLE_KEY}` },
                body: JSON.stringify({ user_metadata: userMetadata, app_metadata: appMetadata })
              });
              if (!linkage.ok) {
                result.failed.push({ name, email, reason: 'Conta existente, mas o vínculo falhou' });
                continue;
              }
            }
            result.existing.push({ name, email });
            continue;
          }
          const userMetadata = { role: 'colaborador', ativo: true, name, csv_nome: name, must_change_password: true };
          const appMetadata = { role: 'colaborador', csv_nome: name };
          if (sector) { userMetadata.csv_setor = sector; appMetadata.csv_setor = sector; }
          const creation = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': SERVICE_ROLE_KEY, 'Authorization': `Bearer ${SERVICE_ROLE_KEY}` },
            body: JSON.stringify({ email, password: '12345678', email_confirm: true, user_metadata: userMetadata, app_metadata: appMetadata })
          });
          if (creation.ok) {
            result.created.push({ name, email });
            existingEmails.set(email, await creation.json());
          } else {
            const error = await creation.json().catch(() => ({}));
            result.failed.push({ name, email, reason: error.msg || error.error || 'Falha ao criar usuário' });
          }
        }
        return res.status(200).json(result);
      }

      const { email, password, role, csv_nome, csv_setor, name } = req.body || {};
      if (!email || !password) return res.status(400).json({ error: 'Email e senha obrigatórios' });
      if (password.length < 6) return res.status(400).json({ error: 'Senha deve ter no mínimo 6 caracteres' });
      const user_metadata = { role: role || 'viewer' };
      const app_metadata = { role: role || 'viewer' };
      if (name) user_metadata.name = name;
      if (csv_nome) { user_metadata.csv_nome = csv_nome; app_metadata.csv_nome = csv_nome; }
      if (csv_setor) { user_metadata.csv_setor = csv_setor; app_metadata.csv_setor = csv_setor; }
      const response = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': SERVICE_ROLE_KEY, 'Authorization': `Bearer ${SERVICE_ROLE_KEY}` },
        body: JSON.stringify({ email, password, email_confirm: true, user_metadata, app_metadata })
      });
      const data = await response.json();
      return res.status(response.ok ? 200 : 400).json(data);
    }

    // PUT/PATCH: atualizar senha, cargo e/ou status
    if (req.method === 'PUT' || req.method === 'PATCH') {
      const { id, password, role, ativo, name, csv_nome, csv_setor } = req.body || {};
      if (!id) {
        return res.status(400).json({ error: 'ID do usuário obrigatório' });
      }
      if (password && password.length < 6) {
        return res.status(400).json({ error: 'Senha deve ter no mínimo 6 caracteres' });
      }

      // Busca metadados atuais para merge
      let currentMeta = {};
      let currentAppMeta = {};
      try {
        const currentRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${id}`, {
          headers: {
            'apikey': SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${SERVICE_ROLE_KEY}`
          }
        });
        if (currentRes.ok) {
          const currentData = await currentRes.json();
          currentMeta = currentData.user_metadata || {};
          currentAppMeta = currentData.app_metadata || {};
        }
      } catch {}

      const newMeta = { ...currentMeta };
      if (role !== undefined) newMeta.role = role;
      if (ativo !== undefined) newMeta.ativo = ativo;
      if (name !== undefined) newMeta.name = name;
      if (csv_nome !== undefined) newMeta.csv_nome = csv_nome;
      if (csv_setor !== undefined) newMeta.csv_setor = csv_setor;

      const newAppMeta = { ...currentAppMeta };
      if (role !== undefined) newAppMeta.role = role;
      if (csv_nome !== undefined) newAppMeta.csv_nome = csv_nome;
      if (csv_setor !== undefined) newAppMeta.csv_setor = csv_setor;

      const body = { user_metadata: newMeta, app_metadata: newAppMeta };
      if (password) body.password = password;

      const response = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`
        },
        body: JSON.stringify(body)
      });
      const data = await response.json();
      return res.status(response.ok ? 200 : 400).json(data);
    }

    // DELETE: remover usuário
    if (req.method === 'DELETE') {
      const { id } = req.body || {};
      if (!id) {
        return res.status(400).json({ error: 'ID do usuário obrigatório' });
      }
      const response = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${id}`, {
        method: 'DELETE',
        headers: {
          'apikey': SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`
        }
      });
      if (response.status === 204) {
        return res.status(200).json({ ok: true });
      }
      const data = await response.json();
      return res.status(response.ok ? 200 : 400).json(data);
    }

    res.status(405).json({ error: 'Método não permitido' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
