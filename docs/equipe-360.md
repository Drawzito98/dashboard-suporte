# Fase 3 — Equipe 360º

Branch `feat/fase3-equipe-360`, baseada na Fase 2 (`1499ddd`). Versão funcional 1.16.0. Sem merge, deploy ou alteração de banco nesta fase.

## Entrada e navegação

Na Equipe, o botão **Perfil 360º** e o clique principal no cartão abrem o perfil. Os acessos existentes a `openColabDetail` (incluindo busca rápida e indicadores) passam pelo mesmo perfil quando o usuário é administrador autenticado. **Editar cadastro** permanece uma ação explícita. O perfil também funciona para quem possui cadastro sem CSV/indicadores.

O perfil é um dialog nativo com foco contido, Escape/Fechar, retorno de foco e cinco seções acessíveis por teclado. **Ocultar dados** fecha o perfil e aciona a proteção visual existente; o perfil não pode ser reaberto enquanto ela estiver ativa:

| Seção | Conteúdo |
|---|---|
| Visão geral | Cadastro, contagens por fonte, situação do vínculo e atalhos de gestão |
| Desempenho | Resumo, evolução e tabela histórica do renderizador existente, com os registros consultados desta pessoa |
| Desenvolvimento | Avaliações e evidências, feedbacks originais, versões/fontes do PDI e atividades estruturadas |
| Presença e ponto | Períodos de férias, ausências, jornada e análises ligadas ao cadastro de ponto |
| Histórico e fontes | Situação de cada consulta e linha do tempo de eventos, sem reescrever os registros |

A consulta cobre todo o histórico da pessoa e não muda os filtros globais. **Atualizar fontes** faz uma nova consulta. Cadastro, indicadores e fontes privadas não sincronizados ainda podem estar disponíveis apenas nos módulos de origem. Eles não são apresentados como confirmados no servidor por esta tela.

## Contratos de dados e identidade

`equipe360-data.js` é uma projeção de leitura isolada e testável; `equipe360.js` apresenta e encaminha ações. Não há nova tabela, migration, gravação, chave de cache, pontuação, cálculo de ponto ou geração de PDI. As origens permanecem oficiais. O estado/repository geral da aplicação continua para a Fase 4.

- Nome completo **exato**, incluindo caixa/acentos, liga as fontes legadas por nome. Não unir apelidos, primeiros nomes ou nomes parecidos. O nome vem do cartão/atalho existente; o servidor é consultado novamente.
- Cadastro duplicado com o mesmo nome ou múltiplos cadastros de ponto exatos torna o vínculo ambíguo; dados desse vínculo não são reunidos. Sem cadastro de ponto exato, as análises são marcadas como **sem vínculo**, e não como histórico inexistente.
- A jornada vem de `ponto_colaboradores`; as análises usam `colaborador_id`, com verificação do mesmo proprietário. O atalho novo de jornada usa resolução exata: uma variação normalizada de nome exige conferência na auditoria antes de editar. Fluxos antigos mantêm seus contratos.
- Mapeamento de Time não é vinculado automaticamente. O perfil apenas informa o vínculo declarado no PDI quando `cadastro` coincide e há confirmação registrada; sua atualidade deve ser revisada no módulo de origem.
- O sistema ainda não possui um identificador único transversal. Pessoas homônimas gravadas sob o mesmo nome em fontes legadas não podem ser distinguidas sem corrigir/modelar a origem. Esta fase não renomeia pessoas nem migra históricos silenciosamente.

## Fontes e acesso

É necessário papel `admin` nos metadados protegidos e sessão validada por `getUser`. A sessão é verificada antes e depois da leitura; respostas antigas são descartadas ao fechar, trocar de pessoa ou de conta. Consultas privadas usam `user_id` e são filtradas novamente antes da projeção. Cada fonte é paginada em blocos de 500 com ordenação estável; erro em página posterior invalida toda aquela fonte, sem exibir um total parcial como completo.

| Fonte | Origem / escopo |
|---|---|
| Cadastro | `colaboradores_info`, proprietário e nome exatos |
| Indicadores | `registros`, Atendente exato e RLS existente (inclui os registros legados compartilhados permitidos) |
| Avaliações, feedbacks, férias, ausências, bônus | Tabela correspondente, proprietário e colaborador exatos |
| Atividades | `anotacoes_diarias`, proprietário e prefixo estruturado de atividade; pessoa exata no conteúdo |
| Histórico de dados | `historico`, pessoa exata; trilha compartilhada sob a RLS existente, não necessariamente escrita apenas pelo gestor atual |
| Jornada e análises | Cadastros e importações privados de ponto, ligados por identificador |
| Perfil/PDI | Chave local já existente `sistema_perfil_pdi_v1_<user_id>`, pessoa exata e versões preservadas |

Caches privados globais antigos de feedback/avaliação/férias etc. não são usados como fallback no novo perfil. Se uma fonte falhar, aparece como indisponível, e não como zero. Fonte vazia, vínculo ambíguo, sem vínculo e falha de leitura são estados distintos. PDI local inválido é marcado como indisponível. Consultas não formam uma transação única entre todas as tabelas; mudanças concorrentes podem aparecer somente ao atualizar.

O perfil privado novo não é disponibilizado a viewer/colaborador. O caminho anterior para esses papéis continua sem ampliação de permissões. RLS e os handlers de origem seguem obrigatórios. Não foram alterados login, papéis, políticas ou sincronização global dos módulos antigos.

## Ações preservadas

- Editar cadastro abre o formulário existente; há retorno ao perfil com confirmação para descartar edição. Salvar com sucesso reabre e consulta o perfil. Se a gravação estiver pendente, o perfil avisa e continua mostrando os dados do servidor. Limpar cadastro permanece no fluxo original.
- Documento de perfil mantém o link configurado para o nome exato; diagnósticos abre a área existente, com seus filtros próprios. Perfil/PDI recebe o nome original. Atividades abre o formulário da pessoa. Férias, ausências e avaliações abrem a gestão existente, mantendo seus seletores e escopo originais.
- Jornada abre o editor existente. Uma análise salva abre o detalhe original pelo ID, inclusive quando não está entre as 100 análises mais recentes da listagem. Snapshots e cálculos não são alterados.
- A apresentação de desempenho é reutilizada via `renderColabPerformance`, com fonte explícita. A chamada legada continua funcionando; o novo perfil não inclui as antigas contagens privadas de cache do bloco 360 parcial. Diagnóstico, gráficos e notas existentes não foram reescritos; os fluxos legados e a área de Análises continuam disponíveis.

## Validação local

`npm test`: runner histórico (171 testes), checks existentes, novo `equipe360-data.check.js` e validação determinística de cache. O novo check cobre paginação acima de mil registros, acesso negado, conta trocada durante consulta, identidade exata, duplicidade de vínculo, falha parcial sem total enganoso e PDI isolado por usuário.

`tests/equipe360.browser.html` usa HTML/CSS e módulos reais, com servidor/autenticação simulados. Cobre fontes, escape de HTML, cadastro sem indicadores, desempenho da pessoa, feedback/PDI, retorno e salvamento no editor, atividade e jornada contextualizadas, análise original, teclado, falha de rede e corrida de respostas entre pessoas/contas. Aprovado em 1440×900 e 390×844 sem overflow horizontal; capturas inspecionadas.

Fixtures existentes aprovadas: Shell, Ponto (PDF sintético), Perfil/PDI, Atividades e Diagnóstico. Smoke do index completo com Supabase simulado também verificou inicialização e navegação. Não valida login real, RLS publicada, dados de produção ou integridade transacional entre fontes. A biblioteca de gráficos pode ficar indisponível no teste sem CDN; a tabela histórica continua acessível.

Para repetir: servir o repositório em localhost e abrir `/tests/equipe360.browser.html`, aguardando PASS. Com servidor na porta 8765 e Chrome de teste na 9228, usar `node --experimental-websocket tests/ponto-browser-runner.js equipe360.browser.html`. Repetir com viewport de celular. A fixture antiga de Atividades usa `#result` em vez de `#testResult`; seu resultado pode ser lido diretamente no navegador.
