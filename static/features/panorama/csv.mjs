export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  let closed = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
        closed = true;
      } else {
        field += char;
      }
    } else if (char === ',' || char === '\n' || char === '\r') {
      row.push(field);
      field = '';
      closed = false;
      if (char !== ',') {
        if (row.some(value => value.trim())) rows.push(row);
        row = [];
        if (char === '\r' && text[i + 1] === '\n') i++;
      }
    } else if (char === '"' && !closed && !field) {
      quoted = true;
    } else {
      if (closed || char === '"') throw new Error('Aspas inválidas no CSV.');
      field += char;
    }
  }
  if (quoted) throw new Error('Campo CSV sem fechamento de aspas.');
  if (row.length || field || closed) rows.push([...row, field]);
  return rows;
}

export const normalize = value => value.replace(/^\uFEFF/, '').normalize('NFC').trim().toLowerCase();
