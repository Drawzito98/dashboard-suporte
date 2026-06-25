const KEYCLOAK_URL = 'https://sso.ixcsoft.com.br/realms/ixcsoft/protocol/openid-connect/token';
const API_BASE = 'https://lider.opasuite.com.br/api/chats';
const CLIENT_ID = 'lider.opasuite.com.br';

let cachedToken = null;
let tokenExpiresAt = 0;

async function getToken() {
  if (cachedToken && Date.now() < tokenExpiresAt) return cachedToken;
  const resp = await fetch(KEYCLOAK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      grant_type: 'password',
      username: process.env.LIDER_USERNAME,
      password: process.env.LIDER_PASSWORD
    })
  });
  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Keycloak auth failed: ${resp.status} ${errText.slice(0, 200)}`);
  }
  const data = await resp.json();
  cachedToken = data.access_token;
  tokenExpiresAt = Date.now() + (data.expires_in * 1000) - 60000;
  return cachedToken;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  const path = req.query.path;
  if (!path) return res.status(400).json({ error: 'Query param "path" is required (e.g. departments, agents, department/123, agent/456)' });
  try {
    const token = await getToken();
    const apiUrl = `${API_BASE}/${path}`;
    const response = await fetch(apiUrl, {
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
    });
    const data = await response.json();
    res.status(response.ok ? 200 : response.status).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
