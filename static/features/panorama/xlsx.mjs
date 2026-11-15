const mime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const decoder = new TextDecoder();
const encoder = new TextEncoder();
const integer = value => /^\d+(?:\.\d{3})*$/.test(String(value)) ? Number(String(value).replaceAll('.', '')) : null;
const score = value => {
  const raw = String(value ?? '').replace(',', '.');
  return /^[1-5](?:\.\d+)?$/.test(raw) && Number(raw) <= 5 ? Number(raw) : null;
};

function gap(value, target) {
  return value === null ? null : Math.round((value - target) * 100) / 100;
}

function sheetDefinitions(report, team, departments, n1Goal) {
  const { period, kpis, days, analysis } = report;
  const { target, confirmedMean, reported } = analysis.score;
  const summary = [
    ['Indicador', 'Valor'],
    ['Início do período', period?.start],
    ['Fim do período', period?.end],
    ['Finalizados conferidos', kpis.finalizados],
    ['Nota geral confirmada', confirmedMean],
    ['Meta de nota', target],
    ['Diferença para a meta', gap(confirmedMean, target)],
    ['Avaliações do cliente', kpis.avaliados],
    ['Nota do cartão do Looker', reported],
    ['Dias considerados na meta N1', n1Goal?.days],
    ['Meta N1 no recorte', n1Goal?.target || null]
  ];
  return [
    { name: 'Resumo', rows: summary, widths: [33, 22], decimals: ['B5', 'B6', 'B7', 'B9'] },
    { name: 'Equipe', rows: [
      ['Atendente', 'Nível', 'Finalizados', 'Nota', 'Diferença da meta', 'TMA', 'TMI', 'TMR', 'Meta N1 no recorte', 'Saldo da meta N1'],
      ...team.map(([name, level, volume, value, tma, tmi, tmr, volumeTarget, volumeGap]) =>
        [name, level, integer(volume), score(value), gap(score(value), target), tma, tmi, tmr, volumeTarget, volumeGap])
    ], widths: [38, 12, 14, 12, 21, 15, 15, 15, 22, 21], decimalColumns: ['D', 'E'] },
    { name: 'Departamentos', rows: [
      ['Departamento', 'Finalizados', 'Nota', 'Diferença da meta', 'Avaliados', 'TMA', 'TMR'],
      ...departments.map(([name, volume, value, count, tma, tmr]) =>
        [name, integer(volume), score(value), gap(score(value), target), integer(count), tma, tmr])
    ], widths: [39, 14, 12, 21, 14, 15, 15], decimalColumns: ['C', 'D'] },
    { name: 'Volume diário', rows: [
      ['Data', 'Finalizados', 'Assumidos'],
      ...days.map(day => [day.date, day.finalizados, day.assumidos])
    ], widths: [16, 15, 15] },
    { name: 'Motivos', rows: [
      ['Motivo', 'Finalizados', 'TME', 'TMR'],
      ...(analysis.tables.reasons?.rows ?? []).map(([name, volume, tme, tmr]) => [name, integer(volume), tme, tmr])
    ], widths: [62, 15, 15, 15] }
  ];
}

function patchXml(XLSX, zip, path, transform) {
  const entry = XLSX.CFB.find(zip, path);
  if (!entry) throw new Error('Estrutura da planilha indisponível.');
  entry.content = encoder.encode(transform(decoder.decode(entry.content)));
  entry.size = entry.content.length;
}

function styles(xml) {
  const font = '<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>';
  const fill = color => '<fill><patternFill patternType="solid"><fgColor rgb="' + color +
    '"/><bgColor indexed="64"/></patternFill></fill>';
  const cellStyle = (fontId, fillId, numFmtId) => '<xf fontId="' + fontId + '" fillId="' + fillId +
    '" numFmtId="' + numFmtId + '" borderId="0" xfId="0" applyFont="1" applyFill="1" applyNumberFormat="1"/>';
  return xml.replace('<fonts count="1">', '<fonts count="2">').replace('</fonts>', font + '</fonts>')
    .replace('<fills count="2">', '<fills count="4">')
    .replace('</fills>', fill('FF183654') + fill('FFF0F5FA') + '</fills>')
    .replace('<cellXfs count="1">', '<cellXfs count="5">')
    .replace('</cellXfs>', cellStyle(1, 2, 0) + cellStyle(0, 3, 0) +
      cellStyle(0, 0, 2) + cellStyle(0, 3, 2) + '</cellXfs>');
}

export function buildPanoramaWorkbook(XLSX, report, team, departments, n1Goal) {
  if (!XLSX?.utils || !XLSX?.CFB) throw new Error('Editor Excel indisponível. Recarregue a página e tente novamente.');
  const definitions = sheetDefinitions(report, team, departments, n1Goal);
  const book = XLSX.utils.book_new();
  for (const { name, rows, widths } of definitions) {
    const sheet = XLSX.utils.aoa_to_sheet(rows);
    sheet['!cols'] = widths.map(wch => ({ wch }));
    if (rows.length > 1 && name !== 'Resumo') sheet['!autofilter'] = { ref: sheet['!ref'] };
    XLSX.utils.book_append_sheet(book, sheet, name);
  }
  const plain = XLSX.write(book, { type: 'array', bookType: 'xlsx', cellStyles: true });
  const zip = XLSX.CFB.read(new Uint8Array(plain), { type: 'array' });
  patchXml(XLSX, zip, '/xl/styles.xml', styles);
  definitions.forEach(({ decimals = [], decimalColumns = [] }, index) => {
    patchXml(XLSX, zip, '/xl/worksheets/sheet' + (index + 1) + '.xml', xml =>
      xml.replace(/<c\b([^>]*\br="([A-Z]+)(\d+)"[^>]*)>/g, (_, attributes, column, row) => {
        const stripe = Number(row) % 2 === 0;
        const decimal = decimals.includes(column + row) || decimalColumns.includes(column);
        const style = row === '1' ? 1 : decimal ? (stripe ? 4 : 3) : stripe ? 2 : 0;
        return '<c' + attributes.replace(/\ss="\d+"/, '') + ' s="' + style + '">';
      }));
  });
  const bytes = XLSX.CFB.write(zip, { type: 'array', fileType: 'zip', compression: true });
  return new Uint8Array(bytes);
}

export function downloadPanoramaWorkbook(XLSX, report, team, departments, n1Goal) {
  const bytes = buildPanoramaWorkbook(XLSX, report, team, departments, n1Goal);
  const link = document.createElement('a');
  const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
  link.href = url;
  link.download = 'panorama-' + (report.period?.start ?? 'suporte') + '.xlsx';
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
