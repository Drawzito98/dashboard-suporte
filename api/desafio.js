const SUPABASE_URL = process.env.SUPABASE_URL || 'https://agvkmfusyetkicmuvumz.supabase.co';
const SERVICE_ROLE_KEY = process.env.SERVICE_ROLE_KEY;

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

async function getDaily(user) {
  const today = localDate();
  const month = today.slice(0, 7);
  const [questions, checkins, answers, history, personalResults] = await Promise.all([
    rest(`perguntas_diarias?select=id,data,pergunta,alternativas,explicacao&data=eq.${today}&ativo=eq.true&limit=1`),
    rest(`checkins_diarios?select=humor&user_id=eq.${user.id}&data=eq.${today}&limit=1`),
    rest(`respostas_diarias?select=alternativa,acertou,pontos&user_id=eq.${user.id}&data=eq.${today}&limit=1`),
    rest(`respostas_diarias?select=data,pontos,acertou&user_id=eq.${user.id}&order=data.desc&limit=180`),
    getPersonalResults(user).catch(error => ({ linked: true, collaborator: String(user.app_metadata?.csv_nome || ''), months: [], previousMonth: null, error: error.message }))
  ]);
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
  return {
    date: today,
    name: user.user_metadata?.name || user.user_metadata?.csv_nome || user.email,
    question: questions[0] || null,
    checkin: checkins[0] || null,
    answer: answers[0] || null,
    stats: { points, participations: monthHistory.length, streak, nextMilestone, monthlyGoal, correctAnswers, weeklyParticipations: weeklyHistory.length, weeklyCorrect: weeklyHistory.filter(row => row.acertou).length, achievements },
    personalResults
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
  if (existing[0]) return { ...existing[0], alreadyAnswered: true, explanation: question.explicacao };
  const alternative = Number(body.alternativa);
  if (!Number.isInteger(alternative) || alternative < 0 || alternative >= question.alternativas.length) {
    throw new Error('Alternativa inválida.');
  }
  const correct = alternative === Number(question.resposta_correta);
  const saved = await rest('respostas_diarias', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      user_id: user.id, pergunta_id: question.id, data: today,
      alternativa: alternative, acertou: correct, pontos: correct ? 1 : 0
    })
  });
  return { ...saved[0], explanation: question.explicacao };
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
  const [questions, checkins, answers, usersResponse, resetHistory] = await Promise.all([
    rest('perguntas_diarias?select=id,data,pergunta,alternativas,resposta_correta,explicacao,ativo&order=data.desc&limit=400'),
    rest('checkins_diarios?select=user_id,data,humor,created_at&data=gte.' + month + '-01&data=lte.' + month + '-31&order=data.desc'),
    rest('respostas_diarias?select=user_id,data,alternativa,acertou,pontos,pergunta_id,created_at&data=gte.' + month + '-01&data=lte.' + month + '-31&order=data.desc'),
    fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=1000`, { headers: jsonHeaders() }).then(async response => {
      if (!response.ok) throw new Error('Não foi possível listar colaboradores.');
      return response.json();
    }),
    rest('notificacoes?select=id,created_at,link,descricao,actor_email&tipo=eq.desafio_reset&order=created_at.desc&limit=24').catch(() => [])
  ]);
  const users = (usersResponse.users || usersResponse || []).filter(user => user.user_metadata?.role !== 'admin');
  const names = Object.fromEntries(users.map(user => [user.id, user.user_metadata?.name || user.user_metadata?.csv_nome || user.email]));
  const ranking = Object.entries(answers.reduce((acc, row) => {
    const item = acc[row.user_id] || { user_id: row.user_id, name: names[row.user_id] || 'Colaborador', points: 0, participations: 0, dates: [] };
    item.points += 1 + Number(row.pontos || 0);
    item.participations += 1;
    item.dates.push(row.data);
    acc[row.user_id] = item;
    return acc;
  }, {})).map(([, item]) => ({ ...item, streak: calculateStreak(item.dates.map(data => ({ data })), item.dates.slice().sort().at(-1) || today) }))
    .sort((a, b) => b.points - a.points || b.participations - a.participations || a.name.localeCompare(b.name));
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
    ranking,
    activity,
    summary: {
      collaborators: users.filter(user => user.user_metadata?.ativo !== false).length,
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
  if (user.user_metadata?.ativo === false) return res.status(403).json({ error: 'Usuário bloqueado.' });

  try {
    if (req.method === 'GET') {
      if (req.query?.view === 'admin') {
        if (user.user_metadata?.role !== 'admin') return res.status(403).json({ error: 'Acesso restrito.' });
        return res.status(200).json(await getAdminData(req.query?.month));
      }
      if (user.user_metadata?.role === 'admin') return res.status(403).json({ error: 'Área exclusiva de usuários não administradores.' });
      return res.status(200).json(await getDaily(user));
    }

    if (req.method === 'POST') {
      const action = req.body?.action;
      if (action === 'reset_month') {
        if (user.user_metadata?.role !== 'admin') return res.status(403).json({ error: 'Acesso restrito.' });
        return res.status(200).json(await resetChallengeMonth(user, req.body));
      }
      if (action === 'question') {
        if (user.user_metadata?.role !== 'admin') return res.status(403).json({ error: 'Acesso restrito.' });
        return res.status(200).json(await saveQuestion(user, req.body));
      }
      if (user.user_metadata?.role === 'admin') return res.status(403).json({ error: 'Área exclusiva de usuários não administradores.' });
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
