const SUPABASE_URL = process.env.SUPABASE_URL || 'https://agvkmfusyetkicmuvumz.supabase.co';
const SERVICE_ROLE_KEY = process.env.SERVICE_ROLE_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_QUESTION_MODEL || 'gpt-5-mini';
const IXC_DOMAIN = 'ixcsoft.com.br';

function localDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Recife', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(date);
}

function nextBusinessDate(from = new Date()) {
  const date = new Date(`${localDate(from)}T12:00:00-03:00`);
  do date.setDate(date.getDate() + 1); while (date.getDay() === 0 || date.getDay() === 6);
  return localDate(date);
}

async function rest(path, options = {}) {
  if (!SERVICE_ROLE_KEY) throw new Error('SERVICE_ROLE_KEY não configurada.');
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!response.ok) throw new Error(data?.message || data?.error || `Supabase ${response.status}`);
  return data;
}

function responseText(payload) {
  for (const item of payload.output || []) {
    if (item.type !== 'message') continue;
    for (const content of item.content || []) {
      if (content.type === 'output_text' && content.text) return content.text;
    }
  }
  return '';
}

function validateOfficialUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && (url.hostname === IXC_DOMAIN || url.hostname.endsWith(`.${IXC_DOMAIN}`));
  } catch { return false; }
}

async function createWithOpenAI(recentQuestions) {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY não configurada.');
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      tools: [{ type: 'web_search', filters: { allowed_domains: [IXC_DOMAIN] }, search_context_size: 'medium' }],
      input: [
        {
          role: 'system',
          content: 'Você cria questões educativas em português do Brasil para colaboradores que usam o IXC Provedor. Pesquise somente fontes oficiais da IXC Soft. Não invente telas, menus, atalhos ou funcionalidades. A pergunta deve ser objetiva, ter uma única resposta inequívoca e ser verificável na URL informada.'
        },
        {
          role: 'user',
          content: `Crie uma questão inédita sobre o IXC Provedor ou uma solução oficial relacionada. Evite repetir estes temas/perguntas recentes:\n${recentQuestions.join('\n') || 'Nenhuma pergunta anterior.'}\nUse quatro alternativas plausíveis, informe a posição correta de 0 a 3, uma explicação curta e a página oficial exata usada como fonte.`
        }
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'pergunta_ixc',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              pergunta: { type: 'string', minLength: 20 },
              alternativas: { type: 'array', minItems: 4, maxItems: 4, items: { type: 'string', minLength: 2 } },
              resposta_correta: { type: 'integer', minimum: 0, maximum: 3 },
              explicacao: { type: 'string', minLength: 15 },
              fonte_url: { type: 'string' },
              fonte_titulo: { type: 'string', minLength: 3 }
            },
            required: ['pergunta', 'alternativas', 'resposta_correta', 'explicacao', 'fonte_url', 'fonte_titulo']
          }
        }
      }
    })
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error?.message || `OpenAI ${response.status}`);
  const text = responseText(payload);
  if (!text) throw new Error('A IA não retornou uma pergunta.');
  const question = JSON.parse(text);
  if (!validateOfficialUrl(question.fonte_url)) throw new Error('A fonte retornada não pertence ao domínio oficial da IXC.');
  const sourceCheck = await fetch(question.fonte_url, { method: 'HEAD', redirect: 'follow' });
  if (!sourceCheck.ok) throw new Error('A fonte oficial retornada não está acessível.');
  return question;
}

async function generateQuestion({ targetDate, force = false, createdBy = null } = {}) {
  const data = targetDate || nextBusinessDate();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) throw new Error('Data de geração inválida.');
  const existing = await rest(`perguntas_diarias?select=id,gerada_automaticamente&data=eq.${data}&limit=1`);
  if (existing[0] && !force) return { ok: true, skipped: true, reason: 'Já existe uma pergunta para a data.', data };
  const recent = await rest('perguntas_diarias?select=pergunta&order=data.desc&limit=30');
  const generated = await createWithOpenAI(recent.map(item => `- ${item.pergunta}`));
  await rest('perguntas_diarias?on_conflict=data', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({
      data,
      pergunta: generated.pergunta.trim(),
      alternativas: generated.alternativas.map(item => item.trim()),
      resposta_correta: generated.resposta_correta,
      explicacao: generated.explicacao.trim(),
      ativo: true,
      created_by: createdBy,
      fonte_url: generated.fonte_url,
      fonte_titulo: generated.fonte_titulo.trim(),
      gerada_automaticamente: true,
      modelo_gerador: OPENAI_MODEL,
      gerada_em: new Date().toISOString()
    })
  });
  return { ok: true, skipped: false, data, question: generated };
}

module.exports = { generateQuestion, nextBusinessDate };
