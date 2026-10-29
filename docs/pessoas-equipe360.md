# Pessoas a partir da Equipe 360º — 1.23.0

29/10/2026. Branch feat/pessoas-equipe360, baseada em d3ddf91. Simplificação da entrada de Pessoas e dos acessos individuais, sem migrations ou mudança das fórmulas/persistência das avaliações, PDI e ponto.

## Mapa de navegação

Pessoas tem duas entradas principais:

| Entrada | Uso |
|---|---|
| Equipe | escolher a pessoa e abrir seu Perfil 360º; editar cadastro continua explícito |
| Gestão coletiva | Visão da equipe, Mapeamento de Time e Auditoria de Ponto |

As antigas rotas lider, mapeamento-time, ponto, avaliacao e perfil-pdi continuam válidas. Gestão coletiva lembra sua última visualização na sessão. Avaliações e Perfil/PDI saem da lista principal; um acesso direto, busca ou preferência antiga revela o grupo Ferramentas individuais dentro do contexto Equipe. Não foram removidos os módulos ou históricos coletivos existentes.

Os cartões têm Perfil 360º como ação principal e Editar cadastro como ação secundária; o atalho duplicado de PDI foi retirado do cartão. Uma orientação junto da lista explica os caminhos individual e coletivo. O número de destinos continua 14; a mudança é na organização.

## Ações da pessoa

O perfil reúne desempenho e histórico consultados pelas fontes existentes, e oferece Avaliações, Preparar feedback e Perfil/PDI na seção de desenvolvimento e nos acessos da pessoa.

- Avaliações seleciona o nome completo exato no formulário e no filtro de histórico. Não cria uma avaliação, não escolhe um ciclo e não preenche notas automaticamente.
- Preparar feedback seleciona a mesma pessoa e mantém seu rascunho quando já existe. Rascunho de outra pessoa só é trocado após confirmação explícita de descarte. O novo contexto começa sem texto gerado e sem salvamento automático; Salvar permanece desabilitado enquanto o texto final estiver vazio.
- Perfil/PDI recebe o nome exato, inclusive quando ele não consta no catálogo local. Não cai silenciosamente na primeira pessoa disponível. A evidência pode continuar indisponível; não é inventada nem associada por semelhança.

Os três fluxos oferecem Voltar ao perfil de [nome], com retorno à seção Desenvolvimento. O retorno não apaga a edição em memória. Reabrir o editor da mesma pessoa preserva o rascunho; mudar de pessoa com alterações exige confirmação. Os controles de retorno conferem proprietário/sessão e são removidos em encerramento ou invalidação de acesso. Respostas atrasadas de abertura de feedback/PDI não devem executar a ação depois de fechar/trocar o perfil.

## Rascunhos e cancelamento

A entrada contextual em avaliação detecta edição de texto/competências e pede confirmação antes de substituir o formulário. Alterar filtros globais não refaz esse formulário enquanto há edição. O fluxo legado de salvamento continua sendo o existente: esta entrega não lhe acrescenta confirmação remota, fila durável ou bloqueio entre dispositivos. Edições internas da própria tela e falhas de persistência legadas continuam exigindo consolidação posterior.

O PDI mantém seus guards e armazenamento local por conta. O shell passa a refletir a rota efetivamente ativada; cancelar uma troca não seleciona a área solicitada como se ela tivesse aberto. A abertura automática do overlay global de feedback na troca de filtros de Avaliação foi removida: feedback agora é uma ação explícita.

## Acesso e limites

Equipe 360º e os novos atalhos privados continuam restritos a admin autenticado. Viewers/colaboradores conservam os caminhos e restrições anteriores, sem acesso adicional ao perfil privado. O shell não substitui as permissões/RLS de cada origem. Férias, ausências, diagnósticos e atividades mantêm seus editores e contratos anteriores; nenhuma política ou tabela foi modificada.

A identidade segue sendo o nome completo exato das fontes legadas. Duplicidade/homônimos continuam sendo limites do modelo original. Não foram unidos cadastros nem regravados históricos. A camada de dados do perfil permanece somente leitura.

## Verificações

- npm test: runner histórico e checks de dados/identidade, persistência, módulos e release.
- shell.browser.html: duas entradas em Pessoas, coletivos, rotas individuais antigas, seleção principal e navegação nas duas áreas.
- workspace-ux.browser.html?people=1: cartão → perfil → avaliação/feedback/PDI com nome exato, retorno, retomada, recusa de descarte, contexto coerente e zero escritas.
- equipe360.browser.html: fontes, isolamento, cadastro sem indicadores, ações individuais, editores, presença, corridas de resposta e sessão.
- perfil-pdi.browser.html: planos/versões/isolamento e nome contextual ausente do catálogo.
- Regressões de workspace, salvamentos, atividades, Ponto, design system e lazy modules conforme os módulos afetados.

Fixtures são locais com serviços simulados. Não comprovam RLS publicada, leitor de tela completo ou persistência de produção. Testes não escrevem no banco de produção.

Validação final: npm test aprovado (171 testes históricos mais checks adicionais), release:check, sintaxe dos scripts alterados e git diff --check aprovados. Fluxo individual com nomes extensos aprovado em desktop e 390/320 px; workspace completo, salvamentos e shell aprovados. Equipe360, PDI, Atividades (inclusive contexto sem CSV), Ponto sintético, lazy-modules e design-system aprovados; Equipe360/PDI/Ponto também em 390 px. A fixture de contraste passou a congelar transições somente durante a amostra dos estados finais, evitando medir uma cor intermediária. Captura da entrada Equipe inspecionada. Nenhuma validação de escrita foi feita em produção.
