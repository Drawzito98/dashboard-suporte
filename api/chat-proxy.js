const API_BASE = 'https://lider.opasuite.com.br';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Session-Cookie');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  const path = req.query.path;
  if (!path) return res.status(400).json({ error: 'Query param "path" is required' });
  const sessionCookie = req.headers['x-session-cookie'];
  if (!sessionCookie) return res.status(401).json({ error: 'X-Session-Cookie header required. Set it with the connect.sid cookie from lider.opasuite.com.br' });
  try {
    const apiUrl = `${API_BASE}/${path}`;
    const response = await fetch(apiUrl, {
      headers: {
        'Cookie': `connect.sid=${sessionCookie}`,
        'User-Agent': 'Mozilla/5.0'
      }
    });
    if (!response.ok && response.status !== 304) {
      const text = await response.text();
      return res.status(response.status).json({ error: `API error: ${response.status}`, detail: text.slice(0, 300) });
    }
    const text = await response.text();
    try { res.status(200).json(JSON.parse(text)); }
    catch { res.status(200).send(text); }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
