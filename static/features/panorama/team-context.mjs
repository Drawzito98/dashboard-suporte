const NOTE_PREFIX = 'panorama-observacao:v1:';
const MAX_TEXT = 1200;
const types = {
  operacional: 'Problema operacional',
  ausencia: 'Ausência',
  atraso: 'Atraso',
  outro: 'Outro'
};

export function validateTeamNote(note, period) {
  const text = String(note.text ?? '').trim();
  const date = note.date ?? '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < period.start || date > period.end ||
      !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) {
    throw new Error('Escolha uma data dentro do período do ZIP.');
  }
  if (!Object.hasOwn(types, note.type) || !text || text.length > MAX_TEXT) {
    throw new Error('Escolha um tipo e escreva uma observação de até 1.200 caracteres.');
  }
  if (!note.person) throw new Error('Escolha um colaborador.');
  return { person: note.person, date, type: note.type, text };
}

export function decodeTeamNote(row, period) {
  if (!row.conteudo?.startsWith(NOTE_PREFIX)) return null;
  try {
    const note = JSON.parse(row.conteudo.slice(NOTE_PREFIX.length));
    if (typeof note.person !== 'string' || typeof note.text !== 'string') return null;
    return validateTeamNote({ ...note, date: row.data }, period);
  } catch { return null; }
}

async function readAll(query) {
  const rows = [];
  const limit = 500;
  for (let offset = 0; ; offset += limit) {
    const { data, error } = await query().order('data', { ascending: false }).order('id').range(offset, offset + limit - 1);
    if (error) throw error;
    rows.push(...data);
    if (data.length < limit) return rows;
  }
}

function renderList(target, items, empty) {
  target.replaceChildren();
  if (!items.length) {
    const message = document.createElement('p');
    message.textContent = empty;
    target.append(message);
    return;
  }
  const list = document.createElement('ul');
  for (const { date, label, text } of items) {
    const li = document.createElement('li');
    const heading = document.createElement('strong');
    heading.textContent = date.split('-').reverse().join('/') + ' · ' + label;
    li.append(heading);
    if (text) {
      const body = document.createElement('div');
      body.textContent = text;
      li.append(body);
    }
    list.append(li);
  }
  target.append(list);
}

export function mountTeamContext({ client, period, resolveNames, userId, currentUserId, isAdmin, openAbsences, formatAttendance }) {
  const element = document.createElement('details');
  element.className = 'panorama-team-context';
  element.hidden = true;
  element.innerHTML = '<summary>Observações e ausências do recorte</summary>' +
    '<p>Observações privadas da sua conta. A meta e o volume do ZIP são mantidos.</p>' +
    '<div class="panorama-report-filters"><label>Pessoa (N1)<select name="person"></select></label></div>' +
    '<div class="panorama-team-context-grid"><section><h4>Observações do Panorama</h4><div data-notes></div>' +
    '<form class="panorama-context-form"><div class="panorama-report-filters">' +
    '<label>Data da ocorrência<input name="date" type="date" required></label>' +
    '<label>Tipo de observação<select name="type"></select></label></div>' +
    '<label class="field">O que aconteceu?<textarea name="text" rows="3" maxlength="1200" required></textarea></label>' +
    '<button class="btn-primary" type="submit">Salvar observação</button><p role="status"></p></form></section>' +
    '<section><h4>Faltas e atrasos registrados</h4><div data-absences></div><div class="btn-row">' +
    '<button class="btn-small" type="button" data-open>Abrir Ausências</button>' +
    '<button class="btn-small" type="button" data-refresh>Atualizar registros</button></div></section></div>';
  const person = element.querySelector('[name="person"]');
  const form = element.querySelector('form');
  const { date, type, text } = form.elements;
  const save = form.querySelector('button');
  const feedback = form.querySelector('[role="status"]');
  const notes = element.querySelector('[data-notes]');
  const absences = element.querySelector('[data-absences]');
  const owner = currentUserId();
  let revision = 0;
  let draftId = null;
  let saving = false;
  date.min = period.start;
  date.max = period.end;
  date.value = period.end;
  for (const [key, label] of Object.entries(types)) type.add(new Option(label, key));
  element.querySelector('[data-open]').addEventListener('click', () => {
    if (isAdmin() && currentUserId() === owner) openAbsences();
  });
  element.querySelector('[data-refresh]').addEventListener('click', refresh);

  async function authorize() {
    const uid = await userId();
    if (!uid || uid !== owner || currentUserId() !== owner || !isAdmin()) {
      throw new Error('Entre novamente para acessar os registros privados.');
    }
    return uid;
  }

  async function refresh() {
    const request = ++revision;
    const name = person.value;
    if (!element.open || element.hidden || !name) return;
    notes.textContent = 'Carregando observações…';
    absences.textContent = 'Carregando ausências…';
    try {
      const uid = await authorize();
      const query = (table, columns) => client.from(table).select(columns).eq('user_id', uid)
        .gte('data', period.start).lte('data', period.end);
      const [observations, attendance] = await Promise.allSettled([
        readAll(() => query('anotacoes_diarias', 'id,data,conteudo').like('conteudo', NOTE_PREFIX + '%')),
        readAll(() => query('ausencias', 'id,colaborador,data,periodo,motivo,tipo,minutos_atraso'))
      ]);
      if (request !== revision || currentUserId() !== owner || !isAdmin()) return;
      if (observations.status === 'fulfilled') {
        const items = observations.value.map(row => decodeTeamNote(row, period))
          .filter(note => note?.person === name).map(note => ({ ...note, label: types[note.type] }));
        renderList(notes, items, 'Nenhuma observação para esta pessoa no período.');
      } else notes.textContent = 'Não foi possível carregar as observações.';
      if (attendance.status === 'fulfilled') {
        const names = resolveNames(attendance.value.map(row => row.colaborador));
        const items = attendance.value.filter((_, index) => names[index] === name)
          .map(row => ({ date: row.data, label: formatAttendance(row), text: row.motivo }));
        renderList(absences, items, 'Nenhuma ocorrência sincronizada para esta pessoa no período.');
      } else absences.textContent = 'Não foi possível consultar as ausências.';
    } catch {
      if (request !== revision) return;
      notes.textContent = 'Não foi possível carregar as observações. Atualize os registros para tentar novamente.';
      absences.textContent = 'Não foi possível consultar as ausências.';
    }
  }

  function clearDraft() {
    form.reset();
    date.value = period.end;
    draftId = null;
    feedback.textContent = '';
  }

  person.addEventListener('change', () => {
    clearDraft();
    refresh();
  });
  element.addEventListener('toggle', refresh);
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (saving) return;
    let note;
    try {
      note = validateTeamNote({ person: person.value, date: date.value, type: type.value, text: text.value }, period);
    } catch (error) {
      feedback.textContent = error.message;
      return;
    }
    const id = draftId ??= crypto.randomUUID();
    saving = true;
    for (const control of [person, date, type, text, save]) control.disabled = true;
    feedback.textContent = 'Salvando…';
    try {
      const uid = await authorize();
      if (element.hidden || person.value !== note.person) throw new Error('Seleção alterada.');
      const { error } = await client.from('anotacoes_diarias').upsert({
        id, user_id: uid, data: note.date,
        conteudo: NOTE_PREFIX + JSON.stringify({ person: note.person, type: note.type, text: note.text })
      }).select('id').single();
      if (error) throw error;
      if (draftId === id && currentUserId() === owner) {
        clearDraft();
        feedback.textContent = 'Observação salva.';
        refresh();
      }
    } catch {
      if (draftId === id) feedback.textContent = 'Não foi possível salvar. Confira a conexão e tente novamente.';
    } finally {
      saving = false;
      for (const control of [person, date, type, text, save]) control.disabled = false;
    }
  });

  return {
    element,
    setPeople(names) {
      const choices = [...new Set(names)].sort((a, b) => a.localeCompare(b, 'pt-BR'));
      const previous = person.value;
      element.hidden = !choices.length;
      person.replaceChildren(...choices.map(name => new Option(name, name)));
      if (choices.includes(previous)) person.value = previous;
      if (!choices.length) element.open = false;
      if (previous !== person.value) {
        notes.replaceChildren();
        absences.replaceChildren();
        clearDraft();
        refresh();
      }
    }
  };
}
