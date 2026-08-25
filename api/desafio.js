const SUPABASE_URL = process.env.SUPABASE_URL || 'https://agvkmfusyetkicmuvumz.supabase.co';
const SERVICE_ROLE_KEY = process.env.SERVICE_ROLE_KEY;
const crypto = require('crypto');
const CHALLENGE_SECONDS = 10;
const DAILY_QUESTION_BANK = [
  { level: "fácil", question: "No IXC Provedor, em qual cadastro ficam reunidos os dados pessoais e de contato do assinante?", options: ["Cadastro do cliente", "Cadastro de produtos", "Cadastro de veículos", "Cadastro de fornecedores"], correct: 0, explanation: "O cadastro do cliente centraliza os dados do assinante e dá acesso às informações relacionadas a ele." },
  { level: "fácil", question: "No IXC Provedor, qual registro representa o serviço contratado pelo cliente?", options: ["Contrato do cliente", "Caixa de atendimento", "Patrimônio", "Plano de contas"], correct: 0, explanation: "O contrato vincula o cliente ao serviço prestado e às configurações comerciais da assinatura." },
  { level: "fácil", question: "Qual recurso do IXC Provedor é usado para registrar e acompanhar uma solicitação de suporte?", options: ["Atendimento", "Inventário", "Contabilidade", "Comissão"], correct: 0, explanation: "O atendimento registra a solicitação e permite acompanhar o contato e as providências tomadas." },
  { level: "média", question: "Quando um atendimento exige uma visita técnica, o que pode ser gerado no IXC Provedor?", options: ["Uma ordem de serviço", "Um novo fornecedor", "Uma conta bancária", "Um produto de estoque"], correct: 0, explanation: "Uma ordem de serviço organiza a execução em campo quando o atendimento exige atividade técnica." },
  { level: "média", question: "Onde o atendente deve consultar os títulos financeiros vinculados a um assinante no IXC Provedor?", options: ["No financeiro do cadastro do cliente", "No cadastro de veículos", "No monitoramento da OLT", "No controle patrimonial"], correct: 0, explanation: "Os títulos e cobranças relacionados ao assinante podem ser consultados na área financeira do cliente." },
  { level: "média", question: "Antes de alterar o vencimento de um boleto no IXC Provedor, qual é a atitude mais segura?", options: ["Confirmar o título e os dados do cliente", "Excluir o contrato", "Derrubar a conexão Radius", "Criar outro cliente"], correct: 0, explanation: "Confirmar o cliente e o título evita alterações no lançamento financeiro errado." },
  { level: "difícil", question: "Para investigar se um acesso autenticou no provedor, qual recurso do IXC é mais adequado consultar?", options: ["Conexões Radius", "Cadastro de feriados", "Contas a pagar", "Controle de combustível"], correct: 0, explanation: "A consulta de Conexões Radius ajuda a verificar sessões e autenticações dos acessos dos clientes." },
  { level: "difícil", question: "Qual é a finalidade do desbloqueio de confiança no IXC Provedor?", options: ["Liberar temporariamente um contrato bloqueado conforme as regras configuradas", "Apagar definitivamente a dívida", "Trocar o plano sem autorização", "Excluir o login do cliente"], correct: 0, explanation: "O desbloqueio de confiança permite uma liberação temporária, respeitando as configurações e políticas do provedor." },
  { level: "difícil", question: "Ao finalizar uma ordem de serviço no IXC Provedor, por que é importante registrar corretamente o que foi executado?", options: ["Para manter o histórico e permitir rastreabilidade do atendimento", "Para excluir o cadastro do cliente", "Para impedir novas cobranças", "Para alterar automaticamente o plano"], correct: 0, explanation: "O registro da execução mantém o histórico confiável para consultas, auditoria e próximos atendimentos." }
];

function jsonHeaders(extra = {}) {
  return {
    'Content-Type': 'application/json',
    apikey: SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    ...extra
  };
}

async function getCaller(req) {
  const auth = req.headers.authorization || req.headers['x-supabase-auth'] || '';
  const token = auth.replace(/^Bearer\s+/i, '');
  if (!token || !SERVICE_ROLE_KEY) return null;
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${token}` }
  });
  return response.ok ? response.json() : null;
}

async function rest(path, options = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: jsonHeaders(options.headers)
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!response.ok) throw new Error(data?.message || data?.error || `Supabase ${response.status}`);
  return data;
}

function localDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Recife', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(date);
}

function challengeOrder(userId, questionId, length) {
  return Array.from({ length }, (_, index) => index).sort((a, b) => {
    const left = crypto.createHash('sha256').update(userId + '|' + questionId + '|' + a).digest('hex');
    const right = crypto.createHash('sha256').update(userId + '|' + questionId + '|' + b).digest('hex');
    return left.localeCompare(right);
  });
}

function createChallengeToken(userId, questionId) {
  const payload = Buffer.from(JSON.stringify({ userId, questionId, startedAt: Date.now() })).toString('base64url');
  const signature = crypto.createHmac('sha256', SERVICE_ROLE_KEY).update(payload).digest('base64url');
  return payload + '.' + signature;
}

function verifyChallengeToken(token, userId, questionId) {
  const parts = String(token || '').split('.');
  if (parts.length !== 2) throw new Error('Sessão do desafio inválida. Atualize a página.');
  const expected = crypto.createHmac('sha256', SERVICE_ROLE_KEY).update(parts[0]).digest('base64url');
  const validSignature = parts[1].length === expected.length && crypto.timingSafeEqual(Buffer.from(parts[1]), Buffer.from(expected));
  if (!validSignature) throw new Error('Sessão do desafio inválida. Atualize a página.');
  const payload = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
  if (payload.userId !== userId || payload.questionId !== questionId) throw new Error('Sessão do desafio inválida. Atualize a página.');
  const elapsedSeconds = Math.max(0, Math.round((Date.now() - Number(payload.startedAt)) / 1000));
  if (elapsedSeconds > CHALLENGE_SECONDS + 3) throw new Error('O tempo do desafio terminou. Volte amanhã para uma nova pergunta.');
  return elapsedSeconds;
}

function publicQuestion(question, user) {
  if (!question) return null;
  const order = challengeOrder(user.id, question.id, question.alternativas.length);
  return { id: question.id, data: question.data, pergunta: question.pergunta, alternativas: order.map(index => question.alternativas[index]), challengeToken: createChallengeToken(user.id, question.id), timeLimit: CHALLENGE_SECONDS };
}

function dailyQuestionTemplate(today) {
  const levels = ["fácil", "média", "difícil"];
  const dayNumber = Math.floor(Date.parse(today + "T12:00:00Z") / 86400000);
  const level = levels[Math.abs(dayNumber) % levels.length];
  const available = DAILY_QUESTION_BANK.filter(item => item.level === level);
  return available[Math.abs(Math.floor(dayNumber / levels.length)) % available.length];
}

async function ensureDailyQuestion(today) {
  const existing = await rest(`perguntas_diarias?select=id&data=eq.${today}&limit=1`);
  if (existing[0]) return;
  const template = dailyQuestionTemplate(today);
  await rest("perguntas_diarias?on_conflict=data", {
    method: "POST",
    headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
    body: JSON.stringify({ data: today, pergunta: template.question, alternativas: template.options, resposta_correta: template.correct, explicacao: template.explanation, ativo: true })
  });
}

function previousBusinessDay(iso) {
  const date = new Date(`${iso}T12:00:00-03:00`);
  do date.setDate(date.getDate() - 1); while (date.getDay() === 0 || date.getDay() === 6);
  return localDate(date);
}

function calculateStreak(rows, today) {
  const answered = new Set(rows.map(row => row.data));
  let cursor = today;
  if (!answered.has(cursor)) cursor = previousBusinessDay(cursor);
  let streak = 0;
  while (answered.has(cursor)) {
    streak += 1;
    cursor = previousBusinessDay(cursor);
  }
  return streak;
}

function numberValue(value) {
  const text = String(value ?? '').trim().replace(/\s/g, '');
  if (!text) return 0;
  const normalized = text.includes(',') ? text.replace(/\./g, '').replace(',', '.') : text;
  const number = Number(normalized.replace(/[^0-9.-]/g, ''));
  return Number.isFinite(number) ? number : 0;
}

function normalizeMonthKey(value) {
  const text = String(value || '').trim();
  let match = text.match(/^(\d{4})-(\d{2})/);
  if (match) return match[1] + '-' + match[2];
  match = text.match(/^(\d{2})[\/-](\d{4})$/);
  if (match) return match[2] + '-' + match[1];
  match = text.match(/^\d{2}[\/-](\d{2})[\/-](\d{4})$/);
  return match ? match[2] + '-' + match[1] : '';
}

function previousMonthKey(today, offset = 1) {
  const date = new Date(today + 'T12:00:00-03:00');
  date.setMonth(date.getMonth() - offset);
  return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0');
}

function weekStartKey(today) {
  const date = new Date(today + 'T12:00:00-03:00');
  const day = date.getDay();
  date.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
  return localDate(date);
}

async function getPersonalResults(user) {
  const collaborator = String(user.app_metadata?.csv_nome || '').trim();
  if (!collaborator) return { linked: false, collaborator: '', months: [] };
  const encodedCollaborator = encodeURIComponent(collaborator);
  const [records, photos] = await Promise.all([
    rest('registros?select=Setor,Mês,Atendente,Assumidos,Transferidos,Finalizados,Score&Atendente=eq.' + encodedCollaborator + '&order=Mês.desc'),
    rest('colaborador_fotos?select=foto_url&nome=eq.' + encodedCollaborator + '&limit=1').catch(() => [])
  ]);
  const grouped = new Map();
  records.forEach(record => {
    const month = String(record['Mês'] || '').trim();
    if (!month) return;
    const item = grouped.get(month) || { month, sectors: new Set(), assumed: 0, transferred: 0, completed: 0, scores: [] };
    if (record.Setor) item.sectors.add(String(record.Setor));
    item.assumed += numberValue(record.Assumidos);
    item.transferred += numberValue(record.Transferidos);
    item.completed += numberValue(record.Finalizados);
    const score = numberValue(record.Score);
    if (score > 0) item.scores.push(score);
    grouped.set(month, item);
  });
  const months = Array.from(grouped.values()).map(item => ({
    month: item.month,
    monthKey: normalizeMonthKey(item.month),
    sectors: Array.from(item.sectors),
    assumed: item.assumed,
    transferred: item.transferred,
    completed: item.completed,
    averageScore: item.scores.length ? item.scores.reduce((sum, score) => sum + score, 0) / item.scores.length : null,
    productivity: item.assumed > 0 ? item.completed / item.assumed * 100 : null
  }));
  months.sort((a, b) => b.monthKey.localeCompare(a.monthKey));
  const previousMonth = months.find(item => item.monthKey === previousMonthKey(localDate(), 1)) || null;
  const comparisonMonth = months.find(item => item.monthKey === previousMonthKey(localDate(), 2)) || null;
  return { linked: true, collaborator, photoUrl: photos[0]?.foto_url || '', previousMonth, comparisonMonth, months };
}


async function getMonthlyRanking(currentUser, month = localDate().slice(0, 7), today = localDate()) {
  const [answers, usersResponse] = await Promise.all([
    rest('respostas_diarias?select=user_id,data,pontos,acertou&data=gte.' + month + '-01&data=lte.' + month + '-31'),
    fetch(SUPABASE_URL + '/auth/v1/admin/users?per_page=1000', { headers: jsonHeaders() }).then(async response => {
      if (!response.ok) throw new Error('Não foi possível atualizar o ranking.');
      return response.json();
    })
  ]);
  const users = (usersResponse.users || usersResponse || []).filter(user => user.app_metadata?.role === 'colaborador' && user.app_metadata?.ativo !== false);
  const userMap = Object.fromEntries(users.map(user => [user.id, user]));
  const rankingMap = answers.reduce((acc, row) => {
    if (!userMap[row.user_id]) return acc;
    const item = acc[row.user_id] || { userId: row.user_id, points: 0, participations: 0, correct: 0, dates: [] };
    item.points += 1 + Number(row.pontos || 0);
    item.participations += 1;
    if (row.acertou) item.correct += 1;
    item.dates.push(row.data);
    acc[row.user_id] = item;
    return acc;
  }, {});
  const ranking = Object.values(rankingMap).map(item => {
    const user = userMap[item.userId];
    const fullName = user.user_metadata?.name || user.app_metadata?.csv_nome || user.email || 'Colaborador';
    const parts = String(fullName).trim().split(/\s+/).filter(Boolean);
    return {
      ...item,
      name: parts[0] + (parts[1] ? ' ' + parts[1][0] + '.' : ''),
      streak: calculateStreak(item.dates.map(data => ({ data })), today),
      accuracy: item.participations ? Math.round(item.correct / item.participations * 100) : 0
    };
  }).sort((a, b) => b.points - a.points || b.streak - a.streak || b.correct - a.correct || a.name.localeCompare(b.name));
  const publicRow = (item, index) => item ? { position: index + 1, name: item.name, points: item.points, participations: item.participations, correct: item.correct, streak: item.streak, accuracy: item.accuracy, isCurrentUser: item.userId === currentUser.id } : null;
  const ownIndex = ranking.findIndex(item => item.userId === currentUser.id);
  return {
    month,
    total: ranking.length,
    top: ranking.slice(0, 3).map(publicRow),
    me: ownIndex >= 0 ? publicRow(ranking[ownIndex], ownIndex) : null,
    updatedAt: new Date().toISOString()
  };
}
async function getLeaderImageUrl() {
  const rows = await rest('notificacoes?select=descricao&tipo=eq.leader_image_config&order=created_at.desc&limit=1').catch(() => []);
  return String(rows[0]?.descricao || '');
}

async function saveLeaderImage(user, body) {
  const storagePath = 'reportes-imagens/desafio/leader-supremo.png';
  let publicUrl = '';
  if (body.remove === true) {
    const response = await fetch(`${SUPABASE_URL}/storage/v1/object/${storagePath}`, { method: 'DELETE', headers: jsonHeaders() });
    if (!response.ok && response.status !== 404) throw new Error('Não foi possível remover a imagem atual.');
  } else {
    const match = String(body.imageData || '').match(/^data:image\/png;base64,([A-Za-z0-9+/=]+)$/);
    if (!match) throw new Error('Envie uma imagem válida no formato PNG.');
    const buffer = Buffer.from(match[1], 'base64');
    if (!buffer.length || buffer.length > 1572864) throw new Error('A imagem deve ter no máximo 1,5 MB.');
    if (buffer.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error('O arquivo enviado não é um PNG válido.');
    const response = await fetch(`${SUPABASE_URL}/storage/v1/object/${storagePath}`, {
      method: 'POST',
      headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}`, 'Content-Type': 'image/png', 'x-upsert': 'true', 'Cache-Control': '3600' },
      body: buffer
    });
    if (!response.ok) throw new Error('Não foi possível enviar a imagem ao armazenamento.');
    publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${storagePath}?v=${Date.now()}`;
  }
  await rest('notificacoes', {
    method: 'POST', headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ tipo: 'leader_image_config', descricao: publicUrl, link: 'desafio-diario', lida: true, actor_id: user.id, actor_email: user.email || '' })
  });
  return { ok: true, leaderImageUrl: publicUrl };
}

async function ensureIxcChallengeTestReset(user) {
  const markerType = 'desafio_ixc_reset_v1';
  const markers = await rest(`notificacoes?select=id&tipo=eq.${markerType}&limit=1`);
  if (markers[0]) return;
  await rest('respostas_diarias?id=not.is.null', { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
  await rest('checkins_diarios?id=not.is.null', { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
  await rest('perguntas_diarias?id=not.is.null', { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
  await rest('notificacoes', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ tipo: markerType, descricao: 'Desafio diário reiniciado para o teste de perguntas sobre o IXC.', link: 'desafio-diario', lida: true, actor_id: user.id, actor_email: user.email || '' })
  });
}

async function getDaily(user) {
  const today = localDate();
  const month = today.slice(0, 7);
  await ensureIxcChallengeTestReset(user);
  await ensureDailyQuestion(today);
  const [questions, checkins, answers, history, personalResults, leaderImageUrl] = await Promise.all([
    rest(`perguntas_diarias?select=id,data,pergunta,alternativas,explicacao&data=eq.${today}&ativo=eq.true&limit=1`),
    rest(`checkins_diarios?select=humor&user_id=eq.${user.id}&data=eq.${today}&limit=1`),
    rest(`respostas_diarias?select=alternativa,acertou,pontos&user_id=eq.${user.id}&data=eq.${today}&limit=1`),
    rest(`respostas_diarias?select=data,pontos,acertou&user_id=eq.${user.id}&order=data.desc&limit=180`),
    getPersonalResults(user).catch(error => ({ linked: true, collaborator: String(user.app_metadata?.csv_nome || ''), months: [], previousMonth: null, error: error.message })),
    getLeaderImageUrl()
  ]);
  const previousAnswers = await rest(`respostas_diarias?select=data,acertou,pergunta_id&user_id=eq.${user.id}&data=lt.${today}&order=data.desc&limit=1`).catch(() => []);
  let learningRecap = null;
  if (previousAnswers[0]?.pergunta_id) {
    const recapQuestions = await rest(`perguntas_diarias?select=pergunta,explicacao&id=eq.${previousAnswers[0].pergunta_id}&limit=1`).catch(() => []);
    if (recapQuestions[0]?.explicacao) learningRecap = { data: previousAnswers[0].data, acertou: previousAnswers[0].acertou, pergunta: recapQuestions[0].pergunta, explicacao: recapQuestions[0].explicacao };
  }
  const monthHistory = history.filter(row => row.data.startsWith(month));
  const points = monthHistory.length + monthHistory.reduce((sum, row) => sum + Number(row.pontos || 0), 0);
  const streak = calculateStreak(history, today);
  const nextMilestone = [5, 10, 20].find(value => value > streak) || null;
  const weeklyHistory = history.filter(row => row.data >= weekStartKey(today) && row.data <= today);
  const correctAnswers = monthHistory.filter(row => row.acertou).length;
  const monthlyGoal = 15;
  const achievements = [
    monthHistory.length >= 1 && { icon: '✨', label: 'Primeiro passo' },
    streak >= 5 && { icon: '🔥', label: '5 dias seguidos' },
    correctAnswers >= 10 && { icon: '🎯', label: '10 acertos' },
    monthHistory.length >= monthlyGoal && { icon: '🏅', label: 'Meta do mês' }
  ].filter(Boolean).slice(-3);
  const ranking = answers[0] ? await getMonthlyRanking(user, month, today).catch(() => null) : null;
  return {
    date: today,
    name: user.user_metadata?.name || user.user_metadata?.csv_nome || user.email,
    question: answers[0] ? null : publicQuestion(questions[0], user),
    checkin: checkins[0] || null,
    answer: answers[0] || null,
    stats: { points, participations: monthHistory.length, streak, nextMilestone, monthlyGoal, correctAnswers, weeklyParticipations: weeklyHistory.length, weeklyCorrect: weeklyHistory.filter(row => row.acertou).length, achievements },
    personalResults,
    learningRecap,
    leaderImageUrl,
    ranking
  };
}

async function saveCheckin(user, body) {
  const humor = Number(body.humor);
  if (!Number.isInteger(humor) || humor < 1 || humor > 5) throw new Error('Humor inválido.');
  const today = localDate();
  const existing = await rest(`checkins_diarios?select=humor&user_id=eq.${user.id}&data=eq.${today}&limit=1`);
  if (existing[0]) return { ok: true, humor: existing[0].humor, alreadyRegistered: true };
  await rest('checkins_diarios', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ user_id: user.id, data: today, humor })
  });
  return { ok: true, humor };
}

async function answerQuestion(user, body) {
  const today = localDate();
  const questions = await rest(`perguntas_diarias?select=id,resposta_correta,explicacao,alternativas&data=eq.${today}&ativo=eq.true&limit=1`);
  const question = questions[0];
  if (!question) throw new Error('Não há desafio disponível hoje.');
  const existing = await rest(`respostas_diarias?select=alternativa,acertou,pontos&user_id=eq.${user.id}&pergunta_id=eq.${question.id}&limit=1`);
  if (existing[0]) return { ...existing[0], alreadyAnswered: true, explanationAvailableTomorrow: Boolean(question.explicacao) };
  const displayedAlternative = Number(body.alternativa);
  if (!Number.isInteger(displayedAlternative) || displayedAlternative < 0 || displayedAlternative >= question.alternativas.length) {
    throw new Error('Alternativa inválida.');
  }
  const responseTime = verifyChallengeToken(body.challengeToken, user.id, question.id);
  const order = challengeOrder(user.id, question.id, question.alternativas.length);
  const alternative = order[displayedAlternative];
  const correct = alternative === Number(question.resposta_correta);
  const saved = await rest('respostas_diarias', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      user_id: user.id, pergunta_id: question.id, data: today,
      alternativa: alternative, acertou: correct, pontos: correct ? 1 : 0
    })
  });
  return { ...saved[0], responseTime, explanationAvailableTomorrow: Boolean(question.explicacao) };
}


function buildAdminActivity(answers, checkins, questions, names, archived = false) {
  const questionMap = Object.fromEntries((questions || []).map(question => [question.id, question]));
  const rows = new Map();
  (checkins || []).forEach(checkin => {
    const key = checkin.user_id + '|' + checkin.data;
    rows.set(key, {
      userId: checkin.user_id,
      name: names[checkin.user_id] || 'Colaborador',
      date: checkin.data,
      mood: Number(checkin.humor),
      answered: false,
      archived
    });
  });
  (answers || []).forEach(answer => {
    const key = answer.user_id + '|' + answer.data;
    const question = questionMap[answer.pergunta_id] || {};
    const row = rows.get(key) || {
      userId: answer.user_id,
      name: names[answer.user_id] || 'Colaborador',
      date: answer.data,
      mood: null,
      archived
    };
    row.answered = true;
    row.correct = Boolean(answer.acertou);
    row.points = 1 + Number(answer.pontos || 0);
    row.question = question.pergunta || 'Pergunta não disponível';
    row.selectedAnswer = Array.isArray(question.alternativas) ? question.alternativas[Number(answer.alternativa)] || '' : '';
    rows.set(key, row);
  });
  return Array.from(rows.values()).sort((a, b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name));
}
async function getAdminData(requestedMonth) {
  const today = localDate();
  const month = /^\d{4}-\d{2}$/.test(String(requestedMonth || '')) ? String(requestedMonth) : today.slice(0, 7);
  const [questions, checkins, answers, usersResponse, resetHistory, leaderImageUrl] = await Promise.all([
    rest('perguntas_diarias?select=id,data,pergunta,alternativas,resposta_correta,explicacao,ativo&order=data.desc&limit=400'),
    rest('checkins_diarios?select=user_id,data,humor,created_at&data=gte.' + month + '-01&data=lte.' + month + '-31&order=data.desc'),
    rest('respostas_diarias?select=user_id,data,alternativa,acertou,pontos,pergunta_id,created_at&data=gte.' + month + '-01&data=lte.' + month + '-31&order=data.desc'),
    fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=1000`, { headers: jsonHeaders() }).then(async response => {
      if (!response.ok) throw new Error('Não foi possível listar colaboradores.');
      return response.json();
    }),
    rest('notificacoes?select=id,created_at,link,descricao,actor_email&tipo=eq.desafio_reset&order=created_at.desc&limit=24').catch(() => []),
    getLeaderImageUrl()
  ]);
  const users = (usersResponse.users || usersResponse || []).filter(user => user.app_metadata?.role !== 'admin');
  const names = Object.fromEntries(users.map(user => [user.id, user.user_metadata?.name || user.user_metadata?.csv_nome || user.email]));
  const ranking = Object.entries(answers.reduce((acc, row) => {
    const item = acc[row.user_id] || { user_id: row.user_id, name: names[row.user_id] || 'Colaborador', points: 0, participations: 0, correct: 0, dates: [] };
    item.points += 1 + Number(row.pontos || 0);
    item.participations += 1;
    if (row.acertou) item.correct += 1;
    item.dates.push(row.data);
    acc[row.user_id] = item;
    return acc;
  }, {})).map(([, item]) => ({ ...item, streak: calculateStreak(item.dates.map(data => ({ data })), item.dates.slice().sort().at(-1) || today), accuracy: item.participations ? Math.round(item.correct / item.participations * 100) : 0 }))
    .sort((a, b) => b.points - a.points || b.streak - a.streak || b.correct - a.correct || a.name.localeCompare(b.name));
  const liveActivity = buildAdminActivity(answers, checkins, questions, names);
  const archivedActivity = resetHistory.filter(row => row.link === month).flatMap(row => {
    try {
      const snapshot = JSON.parse(row.descricao || '{}');
      return Array.isArray(snapshot.activity) ? snapshot.activity.map(item => ({ ...item, archived: true })) : [];
    } catch { return []; }
  });
  const activity = [...liveActivity, ...archivedActivity].sort((a, b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name));
  const todayCheckins = checkins.filter(row => row.data === today);
  return {
    date: today,
    month,
    questions,
    resetHistory,
    leaderImageUrl,
    ranking,
    activity,
    summary: {
      collaborators: users.filter(user => user.app_metadata?.ativo !== false).length,
      checkinsToday: todayCheckins.length,
      averageMood: todayCheckins.length ? todayCheckins.reduce((sum, row) => sum + Number(row.humor), 0) / todayCheckins.length : null,
      answersToday: answers.filter(row => row.data === today).length
    }
  };
}

async function resetChallengeMonth(user, body) {
  const month = String(body.month || '').trim();
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error('Selecione um mês válido.');
  const start = month + '-01';
  const end = month + '-31';
  const [answers, checkins, usersResponse, questions] = await Promise.all([
    rest('respostas_diarias?select=user_id,data,alternativa,acertou,pontos,pergunta_id&data=gte.' + start + '&data=lte.' + end),
    rest('checkins_diarios?select=user_id,data,humor&data=gte.' + start + '&data=lte.' + end),
    fetch(SUPABASE_URL + '/auth/v1/admin/users?per_page=1000', { headers: jsonHeaders() }).then(response => response.json()),
    rest('perguntas_diarias?select=id,pergunta,alternativas&data=gte.' + start + '&data=lte.' + end)
  ]);
  const users = usersResponse.users || usersResponse || [];
  const names = Object.fromEntries(users.map(item => [item.id, item.user_metadata?.name || item.user_metadata?.csv_nome || item.email]));
  const rankingMap = answers.reduce((acc, row) => {
    const item = acc[row.user_id] || { name: names[row.user_id] || 'Colaborador', points: 0, participations: 0, correct: 0 };
    item.points += 1 + Number(row.pontos || 0);
    item.participations += 1;
    if (row.acertou) item.correct += 1;
    acc[row.user_id] = item;
    return acc;
  }, {});
  const snapshot = {
    month,
    answers: answers.length,
    checkins: checkins.length,
    ranking: Object.values(rankingMap).sort((a, b) => b.points - a.points),
    activity: buildAdminActivity(answers, checkins, questions, names, true)
  };
  await rest('notificacoes', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      tipo: 'desafio_reset',
      descricao: JSON.stringify(snapshot),
      link: month,
      lida: false,
      actor_id: user.id,
      actor_email: user.email || ''
    })
  });
  await Promise.all([
    rest('respostas_diarias?data=gte.' + start + '&data=lte.' + end, { method: 'DELETE', headers: { Prefer: 'return=minimal' } }),
    rest('checkins_diarios?data=gte.' + start + '&data=lte.' + end, { method: 'DELETE', headers: { Prefer: 'return=minimal' } })
  ]);
  return { ok: true, snapshot };
}

async function saveQuestion(user, body) {
  const data = String(body.data || '');
  const pergunta = String(body.pergunta || '').trim();
  const alternativas = Array.isArray(body.alternativas) ? body.alternativas.map(value => String(value).trim()).filter(Boolean) : [];
  const correta = Number(body.resposta_correta);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || !pergunta || alternativas.length < 2 || !Number.isInteger(correta) || correta < 0 || correta >= alternativas.length) {
    throw new Error('Preencha data, pergunta, alternativas e resposta correta.');
  }
  await rest('perguntas_diarias?on_conflict=data', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({
      data, pergunta, alternativas, resposta_correta: correta,
      explicacao: String(body.explicacao || '').trim(), ativo: body.ativo !== false, created_by: user.id
    })
  });
  return { ok: true };
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-supabase-auth');
  if (req.method === 'OPTIONS') return res.status(200).end();
  const user = await getCaller(req);
  if (!user) return res.status(401).json({ error: 'Sessão inválida.' });
  if (user.app_metadata?.ativo === false) return res.status(403).json({ error: 'Usuário bloqueado.' });

  try {
    if (req.method === 'GET') {
      if (req.query?.view === 'ranking') {
        if (user.app_metadata?.role === 'admin') return res.status(403).json({ error: 'Acesso restrito.' });
        const today = localDate();
        const answered = await rest('respostas_diarias?select=id&user_id=eq.' + user.id + '&data=eq.' + today + '&limit=1');
        if (!answered[0]) return res.status(200).json({ locked: true });
        return res.status(200).json(await getMonthlyRanking(user, today.slice(0, 7), today));
      }
      if (req.query?.view === 'admin') {
        if (user.app_metadata?.role !== 'admin') return res.status(403).json({ error: 'Acesso restrito.' });
        return res.status(200).json(await getAdminData(req.query?.month));
      }
      if (user.app_metadata?.role === 'admin') return res.status(403).json({ error: 'Área exclusiva de usuários não administradores.' });
      return res.status(200).json(await getDaily(user));
    }

    if (req.method === 'POST') {
      const action = req.body?.action;
      if (action === 'reset_month') {
        if (user.app_metadata?.role !== 'admin') return res.status(403).json({ error: 'Acesso restrito.' });
        return res.status(200).json(await resetChallengeMonth(user, req.body));
      }
      if (action === 'leader_image') {
        if (user.app_metadata?.role !== 'admin') return res.status(403).json({ error: 'Acesso restrito.' });
        return res.status(200).json(await saveLeaderImage(user, req.body));
      }
      if (action === 'question') {
        if (user.app_metadata?.role !== 'admin') return res.status(403).json({ error: 'Acesso restrito.' });
        return res.status(200).json(await saveQuestion(user, req.body));
      }
      if (user.app_metadata?.role === 'admin') return res.status(403).json({ error: 'Área exclusiva de usuários não administradores.' });
      if (action === 'checkin') return res.status(200).json(await saveCheckin(user, req.body));
      if (action === 'answer') return res.status(200).json(await answerQuestion(user, req.body));
      return res.status(400).json({ error: 'Ação inválida.' });
    }
    return res.status(405).json({ error: 'Método não permitido.' });
  } catch (error) {
    const duplicate = String(error.message).includes('duplicate key');
    return res.status(duplicate ? 409 : 400).json({ error: duplicate ? 'Você já participou hoje.' : error.message });
  }
};
