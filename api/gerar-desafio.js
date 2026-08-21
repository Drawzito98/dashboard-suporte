const { generateQuestion } = require('./_desafio-generator');

module.exports = async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });
  const expected = process.env.CRON_SECRET;
  const authorization = req.headers.authorization || '';
  if (!expected || authorization !== `Bearer ${expected}`) return res.status(401).json({ error: 'Não autorizado.' });
  try {
    return res.status(200).json(await generateQuestion());
  } catch (error) {
    console.error('[Gerar desafio]', error);
    return res.status(500).json({ error: error.message });
  }
};
