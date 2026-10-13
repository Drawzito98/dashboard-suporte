/* Regras de análise: apenas fatos registrados, sem inferir personalidade. */
(function (root) {
  'use strict';
  const normalizar = value => String(value || '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').toLowerCase();
  const text = value => String(value ?? '').trim();
  const dateTime = value => Date.parse(value || '') || 0;
  function analisar({ nome, info = {}, registros = [], avaliacoes = [], competencias = [], complemento = {}, hoje = new Date() }) {
    const key = normalizar(nome);
    const rows = registros.filter(r => r && normalizar(r.Atendente) === key);
    const avals = avaliacoes.filter(a => a && normalizar(a.colaborador) === key)
      .sort((a, b) => dateTime(b.updatedAt || b.createdAt) - dateTime(a.updatedAt || a.createdAt));
    const avaliacao = avals[0] || null;
    const notas = competencias.filter(c => c.type === 'competency').flatMap(c => {
      const raw = avaliacao?.scores?.[c.id];
      if (raw == null || raw === '' || ![1, 2, 3, 4].includes(Number(raw))) return [];
      return [{ id: c.id, nome: c.nome, nota: Number(raw), evidencia: text(avaliacao?.observacoes_competencias?.[c.id]) }];
    });
    const prioridades = notas.filter(c => c.nota < 3).sort((a, b) => a.nota - b.nota);
    const fortes = notas.filter(c => c.nota >= 3).sort((a, b) => b.nota - a.nota);
    const objetivo = text(complemento.objetivo || info.objetivos_futuros);
    // O vínculo é explícito e pertence a este cadastro. Não procurar nomes abreviados.
    const mapeamento = complemento.mapeamento?.confirmadoEm && complemento.mapeamento?.cadastro === nome ? complemento.mapeamento : null;
    const pendencias = [];
    if (!info.data_admissao) pendencias.push('Preencher a data de admissão no cadastro.');
    if (!info.nivel) pendencias.push('Informar o nível de atendimento no cadastro.');
    if (!objetivo) pendencias.push('Combinar e registrar um objetivo de desenvolvimento com a pessoa.');
    if (!text(info.tarefas_desempenhadas)) pendencias.push('Registrar experiências e tarefas já desempenhadas.');
    if (!avaliacao || !notas.length) pendencias.push('Registrar uma avaliação de competências.');
    if (avaliacao && avaliacao.status !== 'revisado') pendencias.push('Revisar a avaliação usada como fonte antes de aprovar o plano.');
    if (avaliacao && notas.length < competencias.filter(c => c.type === 'competency').length) pendencias.push('Completar as competências ainda sem nota na avaliação.');
    if (prioridades.some(c => !c.evidencia)) pendencias.push('Adicionar exemplos observáveis às competências que precisam de desenvolvimento.');
    const avaliacaoData = dateTime(avaliacao?.updatedAt || avaliacao?.createdAt);
    if (avaliacao && (!avaliacaoData || hoje.getTime() - avaliacaoData > 120 * 86400000)) pendencias.push('Atualizar ou confirmar a avaliação: a evidência tem mais de 120 dias ou não possui data.');
    if (!text(complemento.autoavaliacao)) pendencias.push('Coletar a autoavaliação da pessoa.');
    if (!text(complemento.apoio)) pendencias.push('Combinar o apoio e o tempo disponível para desenvolvimento.');
    const meses = [...new Set(rows.map(r => text(r['Mês'])).filter(m => /^\d{4}-(0[1-9]|1[0-2])$/.test(m)))].sort();
    const ultimoMes = meses.at(-1) || '';
    const recentes = rows.filter(r => r['Mês'] === ultimoMes && ultimoMes);
    const scores = recentes.map(r => r.SCORE).filter(v => v != null && text(v) !== '' && Number.isFinite(Number(v))).map(Number);
    const finalizados = recentes.filter(r => r.Finalizados != null && text(r.Finalizados) !== '' && Number.isFinite(Number(r.Finalizados)));
    const indicadores = { mes: ultimoMes, registros: recentes.length, score: scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null,
      finalizados: finalizados.length ? finalizados.reduce((s, r) => s + Number(r.Finalizados), 0) : null };
    return { nome, info: { nivel: text(info.nivel), setor: text(info.setor_atual), admissao: text(info.data_admissao), experiencia: text(info.tarefas_desempenhadas) },
      objetivo, autoavaliacao: text(complemento.autoavaliacao), apoio: text(complemento.apoio), avaliacao: avaliacao ? { id: avaliacao.id, ciclo: avaliacao.ciclo, data: avaliacao.updatedAt || avaliacao.createdAt || '', status: avaliacao.status || 'pendente' } : null,
      prioridades, fortes, notas, pendencias, mapeamento, indicadores, observacoes: text(avaliacao?.observacoes_gerais), podeGerar: Boolean(prioridades.length || objetivo || text(mapeamento?.acao)) };
  }
  const acoes = {
    1: 'Revisar semanalmente cinco interações com um mentor, praticando escuta e confirmação da necessidade do cliente.',
    2: 'Participar de uma troca de conhecimento por semana e registrar uma contribuição aplicada pela equipe.',
    3: 'Combinar prioridades semanais com o líder e registrar o resultado das entregas e os impedimentos.',
    4: 'Assumir uma entrega acordada por semana, registrando decisões, impedimentos e comunicação do andamento.',
    5: 'Alinhar um protocolo de comunicação transparente e revisar semanalmente exemplos de sua aplicação.',
    6: 'Escolher um tema técnico com o mentor, praticá-lo em casos reais e compartilhar uma síntese semanal.',
    7: 'Revisar semanalmente cinco entregas com uma lista de qualidade, prazo e critérios acordados.',
    8: 'Revisar semanalmente cinco registros de atendimento para validar clareza, completude e próximos passos.',
    9: 'Mapear um fluxo entre áreas, validar com um colega e aplicar os ajustes em casos acompanhados.',
    10: 'Organizar prioridades no início da semana e revisar prazos e impedimentos com o líder ao final.',
    11: 'Documentar semanalmente um caso com problema, alternativas, solução aplicada e resultado validado.'
  };
  function gerar(analise, hoje = new Date()) {
    if (!analise.podeGerar) throw new Error('Registre um objetivo ou uma necessidade de desenvolvimento antes de gerar o PDI.');
    const prazo = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + 90);
    const data = `${prazo.getFullYear()}-${String(prazo.getMonth() + 1).padStart(2, '0')}-${String(prazo.getDate()).padStart(2, '0')}`;
    const objetivos = analise.prioridades.slice(0, 2).map(c => ({ competencia: c.nome, objetivo: `Desenvolver ${c.nome.replace(/ \(C1\)$/, '')}`,
      evidencia: `Avaliação ${analise.avaliacao?.ciclo || ''}: nota ${c.nota}/4. ${c.evidencia || 'Exemplo observável pendente de coleta.'}`,
      acao: acoes[c.id] || 'Combinar uma prática semanal com acompanhamento do líder.',
      indicador: 'Validar a amostra inicial com o líder e alcançar os critérios de nível 3 na próxima avaliação desta competência.',
      responsavel: analise.nome, prazo: data, apoio: analise.apoio, progresso: '' }));
    if (analise.objetivo) objetivos.push({ competencia: 'Objetivo de desenvolvimento', objetivo: analise.objetivo, evidencia: 'Objetivo registrado no perfil; confirmar o alinhamento com a pessoa.',
      acao: 'Combinar uma entrega prática relacionada ao objetivo e revisar o avanço semanalmente com um mentor.', indicador: '', responsavel: analise.nome, prazo: data, apoio: analise.apoio, progresso: '' });
    else if (analise.mapeamento?.acao && objetivos.length < 3) objetivos.push({ competencia: 'Mapeamento confirmado pelo líder', objetivo: analise.mapeamento.acao,
      evidencia: `Mapeamento de ${analise.mapeamento.nome}, confirmado em ${analise.mapeamento.confirmadoEm}: ${analise.mapeamento.perfil || 'Sem descrição.'}`,
      acao: analise.mapeamento.acao, indicador: '', responsavel: analise.nome, prazo: data, apoio: analise.apoio, progresso: '' });
    return { status: 'rascunho', geradoEm: hoje.toISOString(), snapshot: analise, revisoes: 'Revisar em 30, 60 e 90 dias com a pessoa e o líder.', objetivos: objetivos.slice(0, 3) };
  }
  function validarPlano(plano, aprovar = false) {
    if (!Array.isArray(plano?.objetivos) || !plano.objetivos.length || plano.objetivos.length > 3) return 'O PDI deve conter entre um e três objetivos.';
    for (const objetivo of plano.objetivos) {
      if (!text(objetivo.objetivo)) return 'Preencha o objetivo de cada ação.';
      if (aprovar && ['evidencia', 'acao', 'indicador', 'responsavel', 'prazo', 'apoio'].some(k => !text(objetivo[k]))) return 'Para aprovar, complete evidência, ação, indicador, responsável, prazo e apoio de todos os objetivos.';
      if (aprovar && text(objetivo.evidencia).includes('Exemplo observável pendente de coleta.')) return 'Substitua as evidências pendentes por exemplos observáveis antes de aprovar.';
      if (text(objetivo.prazo) && (!/^\d{4}-\d{2}-\d{2}$/.test(objetivo.prazo) || !Number.isFinite(Date.parse(objetivo.prazo)) || new Date(objetivo.prazo).toISOString().slice(0, 10) !== objetivo.prazo)) return 'Informe um prazo válido.';
    }
    if (aprovar && !text(plano.revisoes)) return 'Defina como ocorrerão as revisões do plano.';
    if (aprovar && !plano.alinhado) return 'Confirme que o plano foi revisado e alinhado com a pessoa.';
    return '';
  }
  root.PerfilPDIEngine = { normalizar, analisar, gerar, validarPlano };
})(typeof window !== 'undefined' ? window : globalThis);
