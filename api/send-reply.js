const nodemailer = require('nodemailer');

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587');
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;

let transporter = null;

function getTransporter() {
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
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
    return res.status(200).json({ ok: false, note: 'Email não configurado (defina SMTP_HOST, SMTP_USER, SMTP_PASS)' });
  }

  const { nome, email, assunto, resposta } = req.body || {};
  if (!email || !resposta) {
    return res.status(400).json({ error: 'Email e resposta são obrigatórios' });
  }

  try {
    await transporter.sendMail({
      from: `"${SMTP_USER}" <${SMTP_USER}>`,
      to: email,
      subject: `Resposta ao seu reporte: ${assunto || 'Reporte'}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
          <div style="background:#3b82f6;color:#fff;padding:20px;border-radius:8px 8px 0 0">
            <h2 style="margin:0;font-size:18px">Resposta ao seu reporte</h2>
          </div>
          <div style="border:1px solid #e2e8f0;border-top:0;padding:24px;border-radius:0 0 8px 8px">
            <p>Olá <strong>${nome || 'usuário'}</strong>,</p>
            <p>Seu reporte com assunto <strong>${assunto || 'Reporte'}</strong> foi respondido:</p>
            <blockquote style="padding:12px 16px;background:#f8fafc;border-left:4px solid #3b82f6;border-radius:4px;margin:16px 0;color:#334155">
              ${resposta.replace(/\n/g, '<br>')}
            </blockquote>
            <p style="color:#64748b;font-size:13px;margin-top:24px">Atenciosamente,<br>Equipe de Suporte</p>
          </div>
        </div>
      `
    });
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[send-reply]', err);
    res.status(200).json({ ok: false, note: 'Falha ao enviar email, mas resposta salva.' });
  }
};
