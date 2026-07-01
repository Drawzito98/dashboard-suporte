const nodemailer = require('nodemailer');

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587');
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const NOTIFICATION_EMAIL = process.env.NOTIFICATION_EMAIL;

let transporter = null;

function getTransporter() {
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || !NOTIFICATION_EMAIL) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS }
    });
  }
  return transporter;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const transporter = getTransporter();
  if (!transporter) {
    return res.status(200).json({ ok: true, note: 'Email não configurado (defina SMTP_HOST, SMTP_USER, SMTP_PASS, NOTIFICATION_EMAIL)' });
  }

  const { nome, email, assunto, mensagem } = req.body || {};

  try {
    await transporter.sendMail({
      from: `"${nome}" <${SMTP_USER}>`,
      to: NOTIFICATION_EMAIL,
      subject: `[Reporte] ${assunto || 'Novo reporte'}`,
      html: `
        <h2>Novo reporte recebido</h2>
        <p><strong>Nome:</strong> ${nome}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Assunto:</strong> ${assunto}</p>
        <p><strong>Mensagem:</strong></p>
        <blockquote style="padding:12px;background:#f5f5f5;border-left:4px solid #3b82f6">${mensagem}</blockquote>
      `
    });
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[send-email]', err);
    res.status(200).json({ ok: true, note: 'Falha ao enviar email, mas reporte salvo.' });
  }
};
