# Redução do carregamento inicial — 1.36.0

Branch `perf/exportacoes-sob-demanda`, baseada em cac09b1. Medição de 30/10/2026. Sem SQL, regras de negócio, alteração de dados, merge, novas bibliotecas ou mudança de fornecedores/versões.

## Resultado medido

| Inventário inicial | Antes | Depois |
|---|---:|---:|
| Scripts no HTML com src | 88 | 86 |
| Scripts locais | 81 | 82 |
| Scripts remotos | 7 | 4 |
| Bytes dos scripts locais | 1.156.992 | 1.160.490 |

html2canvas 1.4.1: 198.689 bytes; jsPDF 2.5.1: 364.463 bytes; XLSX 0.18.5: 881.727 bytes. As três respostas CDN somam 1.444.879 bytes descompactados, agora fora da abertura. Considerando o acréscimo local de 3.498 bytes, a redução líquida de código inicial é 1.441.381 bytes. São bytes de arquivos/respostas descompactados, não tráfego comprimido. Não há alegação de redução percentual de tempo, LCP ou ganho igual em toda conexão/cache.

Evidência: [startup-measurement-1.36.0.json](startup-measurement-1.36.0.json). Repetir inventário local com `node scripts/startup-inventory.js`. Os tamanhos CDN foram obtidos por GET das URLs já presentes no projeto; bibliotecas remotas fora dessas três não foram somadas.

## Contrato

`export-tools.js` tem catálogo fechado com as mesmas URLs/versões de PNG, PDF e Excel. Não modifica o loader de módulos locais nem permite URL arbitrária. Não baixa bibliotecas ao iniciar, ao autenticar ou ao abrir uma área: cada exportação pede somente as dependências necessárias. PDF textual não carrega html2canvas; Excel não carrega PDF/PNG.

Requisições concorrentes compartilham a Promise da biblioteca. Verifica o export global após carregar; falha remove a tentativa e permite novo clique. O carregamento de rede tem limite de 30 segundos. Falha informa o usuário e não gera arquivo incompleto por ausência de biblioteca. O token de sessão é capturado antes do carregamento; resposta após invalidar a conta cancela a exportação sem aviso na outra sessão. Isso não introduz um controle transacional para alterações de filtros/DOM durante a geração de um relatório.

Integrados: relatório executivo/slides, PDF/PNG setorial, PDF de feedback, PDF coletivo/individual do mapeamento, PNG de colaborador/dashboard e Excel individual/consolidado de avaliações. Os botões PNG do setorial são vinculados mesmo antes de html2canvas existir. A impressão nativa e CSV continuam com seus fluxos anteriores. PapaParse, Chart.js/plugin e Supabase permanecem iniciais.

A primeira exportação pode aguardar a conexão para preparar as ferramentas. O worker não pré-carrega essas CDNs: primeira exportação offline pode falhar, com nova tentativa manual. URLs dinâmicas ficam no catálogo local, incluído na identidade do cache; o manifest de áreas mantém apenas caminhos locais e o setorial tem versão atualizada.

## Validação e limites

`npm test` inclui orçamento de scripts, nenhuma requisição antecipada, concorrência, falha/retry, export ausente e sessão invalidada. `tests/export-tools.browser.html` usa as três bibliotecas reais e gera PNG/PDF/XLSX em memória, conferindo reutilização e nota zero. Workspace geral desktop/320px valida inicialização sem exportadores, navegação, PNG/PDF setoriais, CSV/impressão e editores. `workspace-ux.browser.html?exports=1` (também `&mobile=1`) valida Excel individual/consolidado e PDF coletivo/individual do mapeamento com bibliotecas reais, interceptando somente o salvamento do arquivo. Lazy-modules e data-lifecycle continuam aprovados. Dados e servidor são simulados; nenhum teste grava em produção.

Ainda restam cerca de 1,16 MB de scripts locais iniciais, CSS amplo e gráficos iniciais. Próximas reduções devem medir dependências das áreas antes de retirar novos scripts; não considerar encerrada toda a modularização ou afirmar auditoria visual completa de cada formato exportado.
