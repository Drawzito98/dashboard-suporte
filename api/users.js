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
      return res.status(response.ok ? 200 : 400).json(data);
    }

    // POST: criar usuário
    if (req.method === 'POST') {
      const { email, password, role } = req.body || {};
      if (!email || !password) {
        return res.status(400).json({ error: 'Email e senha obrigatórios' });
      }
      if (password.length < 6) {
        return res.status(400).json({ error: 'Senha deve ter no mínimo 6 caracteres' });
      }
      const response = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`
        },
        body: JSON.stringify({
          email,
          password,
          email_confirm: true,
          user_metadata: { role: role || 'viewer' }
        })
      });
      const data = await response.json();
      return res.status(response.ok ? 200 : 400).json(data);
    }

    // PUT/PATCH: atualizar senha e/ou cargo
    if (req.method === 'PUT' || req.method === 'PATCH') {
      const { id, password, role } = req.body || {};
      if (!id) {
        return res.status(400).json({ error: 'ID do usuário obrigatório' });
      }
      if (password && password.length < 6) {
        return res.status(400).json({ error: 'Senha deve ter no mínimo 6 caracteres' });
      }

      const body = {};
      if (password) body.password = password;
      if (role) body.user_metadata = { role };

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
