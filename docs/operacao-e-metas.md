# Operação e acesso às metas — 1.22.0

29/10/2026. Branch feat/operacao-analises-metas, baseada em b2a6fe4. Continuação da simplificação de interface após a confirmação de salvamento e o contexto único do Relatório Setorial.

## Caminhos de trabalho

Operação tem três entradas principais:

| Entrada | Finalidade | Destinos preservados |
|---|---|---|
| Visão geral | leitura consolidada e pontos de atenção | saude-operacional |
| Análises | investigar indicadores, detalhar setores e comparar tendências | dashboard, relatorio-setorial, insights |
| Metas | consultar objetivos/progresso e cadastrar metas conforme permissão | metas (novo destino para o editor existente) |

Análises contém um seletor de visualização: Indicadores, Relatório por setor, Tendências e alertas. O primeiro acesso à área abre Visão geral; Análises abre inicialmente Relatório por setor e depois lembra sua última visualização na sessão. Trocar de área mantém a última tela da área, como antes.

Todos os IDs/data-tab anteriores continuam válidos para cockpit, busca, atalhos, geração de relatório e restauração de preferências. Um acesso direto a um destino analítico revela Análises e seleciona sua visualização. Não foram removidos gráficos, relatórios, diagnóstico, alertas ou exportadores. As fórmulas e fontes das análises não foram unificadas artificialmente.

## Metas

O editor existente ganha tab-metas/metasContent, inicialização de leitura e atualização ao mudar filtros. A criação e exclusão aparecem apenas para admin e continuam passando pelos contratos confirmados de 1.21.0; perfis de consulta não recebem controles de edição. A permissão do cliente não substitui autenticação/RLS do servidor.

O progresso mantém o cálculo existente e usa o recorte do topo. Todas as metas da conta continuam visíveis quando o recorte está vazio, com ausência de dados explícita e sem mostrar progresso zero como diagnóstico. O catálogo do formulário usa os indicadores disponíveis, preservando suas opções ao alterar o filtro de visualização. Não é necessário apagar metas ou importar dados para consultar objetivos já cadastrados.

Nova meta leva diretamente ao campo de título, sem exigir procura pelo formulário abaixo da lista. Campos do novo objetivo são preservados em rascunho privado ao digitar/selecionar e restaurados em reaberturas/trocas de filtro. A sugestão automática também atualiza o rascunho. O UUID permanece estável na retentativa. Não houve mudança na semântica semanal, métricas, periodicidade ou fila de envio; os limites de concorrência entre dispositivos e rascunho local de 1.21.0 continuam válidos.

## Navegação e acessibilidade

shell.js organiza os controles originais em grupos de tabs independentes. O controle Análises é a entrada do painel com o seletor analítico; a seleção de cada grupo é explícita. Setas/Home/End movimentam foco dentro do grupo atual, Enter/Espaço usam o comportamento nativo dos botões. Cada faixa tem rolagem horizontal própria no celular; focar/revelar uma opção não move a página. Pessoas, Rotina e Ferramentas mantêm seus destinos.

As regras de visibilidade por papel foram preservadas. O shell não concede acesso nem aplica permissões no servidor. O novo destino acrescenta uma tela aos treze destinos anteriores; não reativa a antiga aba de gamificação nem o Panorama parcial.

## Verificações

npm test inclui os checks de confirmação e cálculo existentes. shell.browser.html verifica 14 destinos, três entradas em Operação, primeira abertura, memória de Análises, rotas diretas, permissões, apresentação, foco e rolagem. workspace-ux.browser.html exercita os 14 destinos e o teclado dos dois grupos, relatórios e exportações reais. O modo ?saves=1 usa agora a tela de Metas real, com erros/retentativa, preservação ao trocar filtros, recorte vazio, viewer e confirmação de feedbacks/metas.

Fixtures usam dados simulados, sem escrita no banco de produção. Verificações de teclado/viewport em Chromium não equivalem a auditoria completa de leitor de tela ou RLS publicada. Nenhum SQL, merge ou mudança de regras de negócio faz parte desta entrega.

Validação final: npm test aprovado (171 testes históricos e checks adicionais), release:check e git diff --check aprovados. Shell aprovado em desktop e 320 px; workspace completo aprovado em desktop e 390 px/tema escuro, com 14 destinos. Metas/feedbacks em ?saves=1 aprovados em desktop e 320 px, incluindo Nova meta com foco no formulário, troca de filtros, recorte vazio e consulta por viewer. Fixtures de design-system e lazy-modules aprovadas. Capturas da nova tela de Metas inspecionadas.
