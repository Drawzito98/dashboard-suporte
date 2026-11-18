# Auditoria e redesign da interface

Revisão em 18/11/2026. Base bd3ddd2, versão 1.37.4. Backup completo verificado antes deste trabalho. Branch exclusiva de apresentação, com árvore inicialmente limpa.

## Diagnóstico antes da implementação

A aplicação usa HTML, CSS e JavaScript sem compilação. index.html é a entrada autenticada, reporte.html é uma saída de apresentação. Navegação usa IDs/data-tab e quatorze destinos, organizados em Início, Operação, Pessoas e Rotina. Ferramentas e o relatório Looker têm dialogs próprios. O manifest carrega áreas e repositories sob demanda. Supabase, sessão e cache privado ficam nas fachadas/repositories existentes.

A inspeção incluiu HTML, shell, tokens, componentes, styles.css, estilos dos módulos, manifest, ChartTheme, helpers, documentação de arquitetura e fixtures de navegador. Baseline executado com dados simulados percorreu os quatorze destinos, gráficos, exportação, relatórios e editores. Captura anterior da Home em 1440px foi inspecionada.

| Área | Preservar | Problema e prioridade |
| --- | --- | --- |
| Navegação | Quatro áreas, seleção ativa, atalhos, teclado e papéis | Cabeçalho concorre com as ações e ocupa espaço em notebook. P1 |
| Início | Pendências acionáveis, fontes e cobertura explícitas | Hierarquia entre boas-vindas, contexto, briefing e KPIs precisa de proporção consistente. P1 |
| Visão geral | Estados semânticos e detalhamento por setor | Metadados de 9–11px, valores desproporcionais, cores locais. P1 |
| Indicadores e relatório setorial | Ordenação, exportação, filtros e números | Tabelas precisam de leitura e alinhamento consistentes. P1 |
| Tendências e alertas | Evidências, hipóteses e ações | Tipografia pequena nos cards; excesso de caixas e gradientes locais. P1 |
| Metas | Edição confirmada e rascunhos | Padronizar controles e superfícies. P2 |
| Equipe e liderança | Identificação, Equipe360 e comparação | Texto pequeno em metadados e indicadores; nomes precisam continuar legíveis. P1 |
| Avaliação e PDI | Editores, histórico, origem dos dados e revisões | Espaçamentos e títulos variam. P2 |
| Mapeamento e Ponto | Interação especializada e tabelas largas | Conter rolagem, manter campos e alvos acessíveis. P1 |
| Tarefas, anotações e regras | Estados, ações e quadros | Badges muito pequenos e organização visual própria. P2 |
| Ferramentas e Looker | Fluxos reais, importação, cálculo e exportação | Harmonizar campos, tabelas e largura do dialog. P2 |
| Autenticação e área individual | Fluxos e permissões existentes | Compartilhar tokens legíveis, preservar a composição específica. P2 |

## Causas técnicas

styles.css mistura base, módulos e revisões históricas. components.css já centraliza contratos, mas ainda redefine várias regras da base. Há estilos inline e fontes abaixo de 12px em renderizadores. Alterar somente o final do CSS perpetuaria a disputa de especificidade.

Quatro seletores em components.css usam vírgulas no lugar de agrupar os contêineres. Assim aplicam min-width de tabela/campo aos próprios wrappers .projecao-table-scroll, .ponto-table e .diag-scroll. Há uma correção posterior de min-width:0 que mascara parte do problema. Corrigir a origem antes de ajustar responsividade.

Ícones principais já usam SVG com currentColor. Módulos antigos também têm emojis. Substituição integral exige inventário por significado e não deve apagar conteúdo. ChartTheme já define fontes de 13px e cores por tema; manter dados, séries e escalas.

## Direção e planejamento

Manter Inter e o destaque verde-petróleo. Usar superfícies neutras claras, tema escuro com contraste próprio, uma escala de títulos e metadados, raios menores e sombras discretas. Corpo de 14px, metadados de pelo menos 12px, seções de 18–20px e títulos de página de 24px em desktop. Espaçamento na escala existente de 4/8/12/16/24/32px.

Refatorar os contratos em tokens.css e components.css e eliminar efeitos conflitantes na origem em styles.css. Reorganizar o shell no próprio shell.css. Melhorar o CSS específico sem trocar handlers, contratos ou modelos. Campos conservam altura mínima de 44px e 16px no celular. Tabelas rolam em região própria, títulos e nomes podem quebrar linha. Interações seguem botões, details e controles já existentes.

## Validação e limites

A conclusão deve registrar npm test, validação determinística de cache, diff, fixtures de shell/design system/dados/módulos e workspace nas larguras de 360, 768, 1024 e 1440px nos dois temas. Comparação visual antes/depois e console da fixture. Não existe script independente de lint, tipos ou build: o app é estático e release:check verifica o pacote de assets. Não confundir isso com deploy ou teste de banco real.

Capturas e scripts auxiliares ficam em /tmp. Dados das fixtures são simulados e os clientes de escrita de produção não são utilizados. Validação de contraste é amostral e Chromium é o navegador disponível. Login real, leitor de tela, Safari e Firefox exigem validação complementar.

## Melhorias implementadas

A Home apresenta os quatro indicadores antes dos textos de contexto e alertas. O período está explícito na introdução. Fontes, cobertura e caminhos para tarefas/diagnósticos continuam presentes. O cabeçalho permite quebra de ações em notebooks e as áreas principais têm seleção discreta.

Tipografia revisada em Home, Saúde Operacional, Indicadores, Relatório Setorial, Tendências, Liderança, Colaboradores, Avaliações, Feedbacks, Mapeamento, PDI, Ponto, Rotina, Regras, registro mensal e Looker, por seus estilos compartilhados ou templates específicos. A quantidade de declarações CSS com fontes abaixo de 12px caiu de 204 para 24. As restantes pertencem ao Panorama desativado e à experiência específica do colaborador. A leitura dos dois temas usa os mesmos contratos.

Tabelas mantêm alvos e rolagem interna. Ponto e Diagnóstico conservam suas larguras especializadas. Campos do registro mensal continuam amplos. No Looker, filtros se adaptam à largura, nomes podem quebrar linha e números ficam alinhados. Notificações sucessivas ocupam uma região limitada com rolagem e botões de fechamento de 44px.

## Identidade visual implementada

Inter foi preservada. Tokens de página (24px), seção (20px), card (18px), corpo (14px), texto secundário (13px), legenda (12px) e valor (28px) estão centralizados. Raios de 8/10/12/16px, espaçamento existente e superfícies neutras substituem a tonalidade creme. Verde-petróleo continua como destaque. O tema escuro preserva paleta própria. Cores de saúde operacional passaram a usar os tokens semânticos já existentes.

## Refatoração realizada

- tokens.css é a fonte de cores, escala tipográfica, raios e altura de controles.
- components.css mantém contratos de formulários, foco, tabelas, modais e notificações. Quatro seletores de largura foram corrigidos.
- styles.css perdeu efeitos de elevação/deslocamento e brilhos de cards/botões que eram anulados em outra camada. Gradientes em leituras gerenciais deram lugar a superfícies por tokens.
- shell.css trata o cabeçalho, áreas, filtros e adaptação em notebook. shell.js e app-interface.js coordenam foco e rolagem da faixa de abas, inclusive com teclado.
- CSS especializado de Home, cockpit, diagnóstico, Equipe360, PDI, Ponto, registro e Looker usa os contratos compartilhados.
- Templates JS alterados receberam somente a substituição de tamanhos tipográficos inline. home.js recebeu reordenação de apresentação.
- URLs dos assets e identidade do service worker foram atualizadas para a revisão local 1.38.0.

Os 120 usos históricos de !important não foram aumentados. Grande parte controla papéis, hidden, impressão e redução de movimento. A existência dessas regras não autoriza removê-las indiscriminadamente. A migração de todo estilo inline exige uma revisão específica por componente e permanece uma oportunidade posterior.

## Funcionalidades e dados

As alterações de execução se concentram em apresentação, ordem de leitura e foco de navegação. Contratos dos repositories, consultas Supabase, autenticação, RLS, migrations, pontuação, metas, cálculos, fontes e critérios de desempenho não foram editados. Os mesmos controles/data-tab e destinos continuam disponíveis. Testes de exportação verificam conteúdo e arquivos reais usando dados simulados.

## Validação realizada

- npm test aprovado, incluindo 171 casos do runner e checks adicionais do projeto.
- node --check em shell.js e app-interface.js.
- release:check e git diff --check.
- Workspace completo com dados simulados em 360, 768, 1024 e 1440px, claro e escuro. Quatorze destinos, Chart.js real, PNG decodificável, CSV completo, impressão, contexto setorial, filtros, cadastro, editores, teclado e Ponto.
- Design system em 1440, 390 e 320px, claro e escuro. Contraste amostral, alvos, foco, retorno ao acionador, Escape real, guard nativo e redução de movimento.
- Shell, data-lifecycle e lazy-modules passaram. As duas últimas verificam cache por conta, vazio autoritativo, fila/retry e invalidação de sessão, além de carregamento tardio e falha/retentativa.
- Capturas anteriores e posteriores da Home foram geradas em /tmp e inspecionadas. As capturas posteriores usam notificações de teste fechadas pelos próprios botões. A comparação não usa dados de produção.
- Não existe lint, verificador de tipos ou build compilado configurado em package.json. O equivalente disponível para integridade do pacote estático é release:check. Deploy não faz parte dessa validação local.

## Pendências e limitações reais

A auditoria não certifica WCAG integral. O contraste é amostral, sem leitor de tela ou execução em Safari/Firefox. A integração real com Supabase foi preservada pelo diff e exercitada por clientes simulados; os testes não comprovam disponibilidade do servidor de produção. O fluxo de login real e a paginação física da impressão precisam de revisão no ambiente de uso.

Há estilos inline e regras históricas específicos, sobretudo na experiência do colaborador e em módulos desativados. Foram mantidos quando não havia evidência suficiente para removê-los sem afetar contratos. Não se declara eliminação completa de CSS legado.

## Recomendações futuras

Após revisar esta versão local, conferir os fluxos mais usados com a equipe e dados reais em ambiente autorizado. Priorizar extração dos estilos inline por componente, teste com leitor de tela e verificação cruzada nos navegadores usados pela equipe. Essas recomendações estão fora das alterações implementadas.

### Verificações complementares

Equipe360, Perfil/PDI, Ponto, Diagnóstico, Atividades do mês, Exportadores e Regras passaram nas fixtures específicas. O teste de Atividades usa o elemento result, enquanto o runner genérico consultava testResult; o timeout do runner foi resolvido adaptando somente o script temporário de execução, sem alterar a fixture ou o produto.

A matriz revelou uma opção de aba parcialmente fora da faixa ao navegar por teclado. O ajuste de foco com preventScroll e a chamada explícita ao revelador do shell corrigiram o cenário, que passou na repetição. Não houve erro não tratado no console nas execuções finais do workspace.

A entrega permanece local na branch de auditoria. As capturas são de uma conta e registros sintéticos das fixtures, com identificação visível de teste.

## Continuação 1.38.1 — Avaliações e Liderança

A revisão 1.38.0 foi publicada com autorização em 18/11/2026, commit ddef58d. As referências anteriores a entrega local descrevem o estado anterior à publicação.

Esta continuação usa a branch refactor/pessoas-componentes. people-workspace.css reúne a apresentação específica de Avaliações e Liderança sobre os controles compartilhados. Avaliações passou de 110 para 70 atributos style, e Liderança de 38 para zero. Os estilos restantes de Avaliações incluem ranking, consolidado e conteúdo específico que exigem revisão própria.

Correções desta rodada

- O formulário de Avaliações tinha um div extra que fechava o layout antes do editor e do histórico. A estrutura agora contém as três áreas no mesmo layout.
- A moldura externa redundante foi removida da página. Os painéis internos continuam com sua própria hierarquia.
- Seletores de mês têm nomes acessíveis distintos e altura compartilhada de 44px. No celular, o intervalo se organiza em linhas.
- Botões de comentários e sugestões usam os controles e cores semânticas do painel.
- A tabela de Liderança usa a região compartilhada de rolagem por teclado. Botões de perfil identificam a pessoa pelo nome acessível.
- Cards e pontos de atenção em Liderança permitem quebra de texto e organização em telas estreitas. A condição que destaca a linha continua igual, expressa por classe em vez de style.

Validação

npm test, release:check, diff e sintaxe dos dois renderizadores. Workspace completo passou nas quatro larguras e nos dois temas. Fixture evaluations passou em 360/1440px, claro/escuro, exercitando formulário real com servidor simulado, rascunho, quota/falha, resposta perdida, UUID estável, edição, status, exclusão e duplo envio. A estrutura HTML e alvos dos seletores foram conferidos no navegador. Captura móvel inspecionada.

Pendências que continuam abertas

Ranking/consolidado de avaliações e outros módulos ainda têm estilos inline. Não foi realizada certificação WCAG, teste com leitor de tela, Safari/Firefox ou paginação física de impressão. A padronização de ícones legados e a revisão da experiência específica do colaborador também precisam de rodadas próprias. Não se declara conclusão integral de todas as recomendações originais.

## Conclusão do ciclo — 1.39.0

Solicitação de executar as pendências e publicar ao final. Base c12f4b3, árvore inicialmente limpa, branch feat/conclusao-redesign-interface.

### Implementação

- Ranking, consolidado e visualização individual de avaliações passaram a usar people-workspace.css. De 70 atributos style anteriores, restam apenas cinco pontos dinâmicos de cor/largura, derivados dos mesmos valores de apresentação. O histórico expressa seu estado por data-status e tokens semânticos.
- Ordenação do consolidado usa botões reais, aria-sort e preserva o foco depois da renderização. Observações extensas podem quebrar linha e têm região de tabela com rolagem acessível.
- Relatórios de avaliação têm títulos e controles de fechamento acessíveis. As janelas legadas passam a ficar acima do cabeçalho fixo. A moldura e o padding duplicados foram corrigidos.
- O radar mantém séries, valores, escala 0–4 e rótulos completos nos dados/tooltips. Os eixos visuais são numerados e correspondem à tabela numerada, evitando nomes cortados no celular. O canvas tem descrição acessível.
- 79 ícones de ação/cabeçalho foram substituídos por SVG com símbolos compartilhados e currentColor. Emojis que expressam conteúdo, status e medalhas não foram transformados em decoração.
- A área de colaborador foi auditada com o papel real simulado. O fluxo vigente apresenta “Nenhum módulo está disponível para este perfil” e retorna antes dos filtros antigos. Seu estado vazio foi padronizado. O desafio diário não consta do HTML nem do manifest atual. Não foi reativado código inacessível nem alterada a autorização para apresentar uma funcionalidade diferente.
- Impressão do relatório executivo recebeu fundo branco também no elemento html, texto corrido legível e proteção contra quebra interna de itens. O conteúdo e os indicadores permanecem iguais.
- Não há novos scripts iniciais, biblioteca de ícones ou dependência de rede para SVG. O CSS específico utiliza os controles e tokens já existentes.

### Verificação

npm test aprovado com 171 casos do runner e checks adicionais; sintaxe dos scripts alterados, release:check e diff. Workspace completo em Chromium nas quatro larguras e nos dois temas. Firefox instalado executou o workspace em janela reduzida e desktop, nos dois temas. Seu modo headless impõe largura externa mínima de 500px; a área vazia de colaborador também foi verificada dentro de iframe limitado a 360px e em desktop.

Teste específico em 360/1440px, claro/escuro, abriu ranking/consolidado/detalhe com duas avaliações simuladas, conferiu médias, ordenação por Enter real, aria-sort, retorno de foco, janela contida e radar. Fixtures de avaliação exercitam falha/rascunho/edição/exclusão/duplo envio somente no cliente simulado. Design system e fixtures de shell, dados e módulos completam a regressão.

Um PDF real do relatório executivo, com registros simulados, foi gerado por impressão do Chromium. As quatro páginas da amostra foram renderizadas e inspecionadas. A paginação digital não representa um ensaio em impressora física.

### Limites de conclusão

A revisão implementa a padronização dos componentes prioritários e os ajustes verificáveis neste ambiente. Ainda existem estilos inline em módulos históricos e valores dinâmicos que não foram removidos indiscriminadamente. A extração adicional pode continuar por componente, sem ser necessária para utilizar esta versão.

Acessibilidade foi verificada automaticamente e por teclado, com amostragem de contraste. Não se declara certificação WCAG nem teste humano com leitor de tela. Safari e impressão física não estão disponíveis neste ambiente. Esses ensaios e a revisão assistida com a equipe em dados reais permanecem validações externas. Não houve alteração de banco, RLS, autenticação, regras de cálculo ou metas, nem testes de escrita em produção.
