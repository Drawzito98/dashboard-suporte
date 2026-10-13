// Derivado da admissão: nunca persistir uma duração que ficará desatualizada.
function getTempoEmpresa(admissao, referencia = new Date()) {
  if (!admissao) return 'Admissão não informada';
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(admissao));
  if (!match || !Number.isFinite(referencia.getTime())) return 'Data de admissão inválida';
  const [, ano, mes, dia] = match.map(Number);
  const inicio = new Date(ano, mes - 1, dia);
  if (inicio.getFullYear() !== ano || inicio.getMonth() !== mes - 1 || inicio.getDate() !== dia) return 'Data de admissão inválida';
  const hoje = new Date(referencia.getFullYear(), referencia.getMonth(), referencia.getDate());
  if (inicio > hoje) return 'Admissão futura';
  let meses = (hoje.getFullYear() - ano) * 12 + hoje.getMonth() - (mes - 1);
  // Aniversários em fim de mês ocorrem no último dia disponível.
  const aniversario = new Date(hoje.getFullYear(), hoje.getMonth(), Math.min(dia, new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate()));
  if (hoje < aniversario) meses--;
  if (meses === 0) return 'Menos de 1 mês';
  const anos = Math.floor(meses / 12);
  const restante = meses % 12;
  return [anos ? `${anos} ${anos === 1 ? 'ano' : 'anos'}` : '', restante ? `${restante} ${restante === 1 ? 'mês' : 'meses'}` : ''].filter(Boolean).join(' e ');
}
