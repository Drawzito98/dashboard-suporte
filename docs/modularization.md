# Modularização — Fase 5

Branch: `refactor/fase5-modularizacao`. Versão 1.18.0, sem merge/deploy ou alteração de banco.

## Responsabilidades

Comparação com a Fase 4 (9d6791b): app.js passou de 3.680 linhas / 173.415 bytes para 2.239 linhas / 105.910 bytes; db-extra.js de 1.540 linhas / 59.014 bytes para 285 linhas / 11.124 bytes. O código foi distribuído, não eliminado.

- dashboard-charts.js e dashboard-report.js contêm gráficos e texto executivo; app.js conserva as entradas públicas e estado compartilhado.
- app-admin.js contém administração/histórico/inativos; app-interface.js contém tema, notificações, preferências e atalhos de interface.
- db-extra.js preserva constantes, helpers, fachada assíncrona e inicialização autenticada. repositories/{performance,people,development,routine,attendance,audit}.js recebem as implementações existentes. repositories/legacy.js somente carrega por chamada explícita da migração antiga, nunca na inicialização.

Não houve mudança intencional de scoring, cálculo de ponto, permissões ou formatos de escrita. A fila durável por revisão da Fase 4 continua limitada aos indicadores; extrair os demais métodos não lhes acrescenta essa garantia.

## Carregamento e contratos

module-manifest.js declara scripts, estilos, dependências e exports. module-loader.js valida caminhos locais, ordem, ciclos e exports; compartilha carregamentos concorrentes e permite repetir falhas de rede. Não usa eval. A inicialização autenticada carrega os seis domínios de persistência uma vez.

Ponto, Perfil/PDI, Equipe 360º e Relatório Setorial/Panorama deixam de constar como scripts/estilos iniciais no HTML. feature-bridges.js mantém seus nomes públicos até o primeiro acesso, apresenta status e oferece retentativa em falha. A primeira chamada passa a retornar uma Promise; chamadores existentes usam ações/efeitos. As implementações reais substituem as pontes. Inicializadores funcionam antes ou depois de DOMContentLoaded.

Callbacks pendentes verificam sessão e navegação para evitar abrir uma área abandonada ou usar a conta anterior. Isso complementa, sem substituir, RLS e verificações de sessão dos dados.

## Cache e limites

release.js inclui todos os assets do manifest na identidade determinística e valida existência, versões de URL, dependências e duplicação com scripts iniciais. Acrescentar um módulo exige atualizar manifest e regenerar o cache. Hash não significa pré-cache: primeira abertura offline de uma área ainda não visitada pode falhar e oferecer retentativa.

Chart.js, bibliotecas de CSV/exportação e vários módulos históricos ainda carregam inicialmente. Globais e dependências compartilhadas permanecem como compatibilidade; não há bundler ou conversão completa para ES modules. Falha de rede pode ser repetida; erro de execução dentro de um script pode exigir recarregar a página.

## Validação

`npm test` inclui os novos checks module-loader, repository-domains e dashboard-modules: ordem/carregamento único/retentativa/ciclos, contratos de leitura/escrita sem migração, totais/ranking/Score/evolução e relatório preservados.

`tests/lazy-modules.browser.html` usa scripts reais com servidor simulado: primeiro acesso, erro/retentativa, inicialização tardia, proteção de rascunho, concorrência, navegação abandonada, abertura de perfil e troca de sessão. Fixtures de shell, Equipe360, PDI, Ponto, diagnóstico, filtros de Panorama e ciclo de dados também passaram. Smoke do HTML completo percorreu as 13 abas e perfil com dados simulados; não valida integrações de produção ou aparência dos gráficos reais com CDN.

## Atualização 1.20.1

O bundle interno panorama conserva a chave por compatibilidade, mas carrega somente relatorio-setorial.js. O Panorama parcial deixou o HTML e o manifest de execução; seu parser/UI e testes isolados permanecem para reuso. A contagem de scripts iniciais e a modularização residual foram revistas em [revisao-pos-roadmap.md](revisao-pos-roadmap.md).

## Continuação 1.24.0

A persistência de avaliações saiu do arquivo de UI para o repository development, preservando os nomes públicos pela fachada db-extra. Não há novo script inicial ou domínio adicional; o manifest valida também os quatro exports de avaliações. Ver [avaliacoes-confirmadas.md](avaliacoes-confirmadas.md).
