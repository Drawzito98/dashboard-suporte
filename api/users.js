const SUPABASE_URL = 'https://agvkmfusyetkicmuvumz.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFndmttZnVzeWV0a2ljbXV2dW16Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTc1OTE2NSwiZXhwIjoyMDk3MzM1MTY1fQ.UkpdoFGobxXsFl_L9CjfpdXgkU_Wm-MibuuAY_CT-fk';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
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

    if (req.method === 'POST') {
      const { email, password } = req.body || {};
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
          email_confirm: true
        })
      });
      const data = await response.json();
      return res.status(response.ok ? 200 : 400).json(data);
    }

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
