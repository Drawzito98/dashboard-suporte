// Um mês vazio não possui métricas, tempos ou observações informadas.
function isEmptyPerformanceRecord(record) {
  const blank = value => value === null || value === undefined || String(value).trim() === '';
  const numbers = ['Assumidos', 'Finalizados', 'Transferidos', 'SCORE', 'Score', 'Nota1', 'Nota2', 'Nota3', 'Total', 'Clientes atendidos', 'Média avaliação'];
  if (numbers.some(key => !blank(record[key]) && Number(String(record[key]).replace(',', '.')) !== 0)) return false;
  if (['Observações', 'Observacao', 'Observação', 'Objetivo'].some(key => !blank(record[key]))) return false;
  return ['TMA', 'TMR'].every(key => {
    if (blank(record[key])) return true;
    const raw = String(record[key]).trim();
    if (/^0+(?::00){0,2}$/.test(raw)) return true;
    return typeof parseDurationToSeconds === 'function' && parseDurationToSeconds(raw) === 0;
  });
}
if (typeof module !== 'undefined' && module.exports) module.exports = { isEmptyPerformanceRecord };
