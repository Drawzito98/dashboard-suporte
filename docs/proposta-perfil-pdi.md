# Perfil e Plano de Desenvolvimento Individual

## Base disponível

O cadastro registra admissão, nível N1/N2/N3, setor, tarefas desempenhadas e objetivos futuros. Há avaliações de competências e dados de atendimento. O tempo de empresa é calculado ao exibir a pessoa a partir da admissão e da data atual, sem salvar uma duração fixa.

Os registros reais de admissão ficam no Supabase, filtrados pelo usuário autenticado. O código local não permite atestar quais pessoas possuem datas preenchidas. Pessoas sem admissão devem aparecer com a pendência explícita.

O Mapeamento de Time contém nomes abreviados, descrições e ações; usa localStorage e tem dados iniciais no código. Antes de incorporá-lo ao PDI, vincular cada registro ao cadastro correto com confirmação do líder. Não associar automaticamente nomes parecidos nem tratar os dados iniciais como avaliações atuais.

## Informações para coletar

1. Objetivo de carreira escolhido pela pessoa e horizonte esperado.
2. Pontos fortes e competências a desenvolver, com exemplos observáveis e data.
3. Autoavaliação e avaliação do líder, com escala definida por competência.
4. Competências esperadas para a função e para o nível desejado.
5. Barreiras atuais e apoio necessário (mentoria, treinamento, tempo de prática).
6. Disponibilidade para desenvolvimento e responsável pelo acompanhamento.

Não usar idade, salário ou tempo de empresa isoladamente para inferir capacidade, personalidade ou potencial. Tempo de empresa contextualiza integração e experiência; as prioridades dependem de objetivos e evidências.

## Experiência proposta

Uma análise de perfil por pessoa reúne cadastro, evidências datadas e pendências. Com informações suficientes, o líder gera um rascunho de PDI, revisa e combina o plano com a pessoa. Na ausência de evidências, solicitar preenchimento, sem inventar diagnóstico.

Cada PDI terá até três objetivos, competência, evidência de partida, ação prática, apoio, responsável, prazo, indicador de sucesso e revisões de 30/60/90 dias. Registrar progresso e versões, preservando o plano aprovado mesmo quando o perfil muda.

Exemplo: para um objetivo declarado de melhorar comunicação, revisar cinco atendimentos por semana com mentor durante 30 dias, aplicar uma lista de clareza e acompanhamento e comparar o resultado com a amostra inicial. Metas numéricas devem ser acordadas a partir da linha de base real.

## Persistência e acesso

Guardar perfil de desenvolvimento e PDIs no Supabase, seguindo as regras de acesso existentes; distinguir rascunho e plano aprovado. O armazenamento somente local do Mapeamento precisa ser resolvido antes de se tornar fonte compartilhada de planos. O módulo de geração de PDI ainda não está implementado.
