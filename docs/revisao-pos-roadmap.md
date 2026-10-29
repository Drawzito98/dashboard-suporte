# Revisão após as sete fases e retirada do Panorama

Revisão de 28/10/2026, versão 1.20.1, branch refactor/retirar-panorama-revisao-ux, baseada em 5b175eb. Comparação com as sete fases combinadas na conversa original e com o código/documentação atuais. Não é auditoria do banco de produção.

## Retirada solicitada

O bloco Panorama parcial de suporte foi retirado do Relatório Setorial. Saíram o host panoramaSuporteRoot do HTML e os recursos panorama-suporte.js/.css do bundle carregado nessa tela. O aviso de carregamento agora diz somente Relatório Setorial. Não há placeholder ou nova entrada de navegação para o Panorama.

Implementação, parser, exportadores e testes isolados continuam no repositório para uma possível realocação depois de definir o CSV. O bundle interno ainda se chama panorama por compatibilidade, mas carrega somente relatorio-setorial.js. Não foi criado outro fluxo de importação nem feito mapeamento presumido para um CSV novo. O Panorama mantinha o CSV apenas em memória; esta alteração não exclui dados do banco ou caches privados.

## O planejamento ficou integralmente concluído?

As sete fases tiveram entregas funcionais. Isso não equivale a encerrar toda a consolidação proposta. As Fases 4, 5 e 6 têm trabalho residual relevante; o roadmap passa a apontar isso explicitamente.

| Fase | Entrega verificada | Continuidade real |
|---|---|---|
| 1 — Foundation | documentação, inventário, catálogo de migrations, npm test e cache determinístico | Manter documentação atual. Migrations não aplicadas deliberadamente não são falha da fase. |
| 2 — Navegação | quatro áreas, submenu, ferramentas sob demanda e filtros recolhíveis | Ainda há sobreposição entre telas analíticas e ações espalhadas. Agrupar destinos não eliminou essa complexidade. |
| 3 — Equipe 360º | perfil integrado com fontes, histórico e acesso aos editores | PDI permanece local por conta/dispositivo; identidade transversal por ID ainda é uma decisão de dados. Não foram prometidas ou feitas migrações silenciosas de nomes/históricos. |
| 4 — Dados | AppState/eventos, cache por conta e fila por revisão dos indicadores | Padronizar confirmação de gravação, erro, pendências e recuperação dos módulos complementares. Supabase como fonte oficial ainda tem exceções/semânticas legadas. |
| 5 — Modularização | extração de app/db-extra e lazy loading de áreas maiores | Reduzir carga inicial, dependências globais e pontes de compatibilidade. A divisão em arquivos não encerrou essa meta. |
| 6 — Design System | tokens, controles comuns, teclado dos modais e correções responsivas | CSS e HTML de modais ainda distribuídos; acessibilidade/cross-browser validados por amostras, sem auditoria completa. |
| 7 — Cockpit | contexto mensal, filas acionáveis, diagnóstico, fontes e cobertura | Validar densidade e utilidade no uso real; as fontes auxiliares ainda não têm confirmação remota uniforme. |

## Prioridade técnica: confirmação de salvamento

A fila durável por revisão cobre indicadores. Ela não foi estendida a todas as entidades. Por exemplo, repositories/development.js grava feedbacks no cache e executa insert/update sem validar o retorno error ou devolver uma confirmação uniforme. feedbacks.js aguarda esse método e mostra Feedback salvo com sucesso. Um erro retornado pelo serviço pode, portanto, resultar em uma mensagem de sucesso sem confirmação da gravação remota.

Outro contrato a revisar é dbMetasSave em repositories/performance.js: a edição explícita substitui a coleção por delete seguido de insert. A leitura já deixou de regravar metas na Fase 6, mas isso não tornou a escrita transacional ou protegida por revisão.

Próximo ciclo técnico recomendado: tratar inicialmente feedbacks e metas, com resultados explícitos de confirmação/falha e testes de erro de rede, erro retornado pelo servidor e concorrência. Depois aplicar o contrato gradualmente às demais entidades. Essas alterações de persistência não foram misturadas à retirada visual do Panorama.

## Modularização e métricas atuais

Contagem reproduzível de elementos script com src no HTML: 79 na base da Fase 1 (dee1cfb), 84 antes da Fase 5 (9d6791b), 83 após a Fase 5 (b814a88), 86 na Fase 7 e nesta revisão. São 79 locais e 7 remotos na versão atual. Elementos inline ficam fora dessa contagem.

O tamanho dos arquivos centrais caiu, mas a quantidade de scripts iniciais não ficou abaixo do ponto de partida. A contagem não prova lentidão; indica que ainda falta consolidar a carga inicial e medir bytes/tempo de abertura antes de afirmar ganho global de performance.

Estado atual: app.js tem 2.239 linhas / 105.910 bytes; db-extra.js tem 287 linhas / 11.320 bytes; styles.css tem 4.789 linhas / 184.207 bytes. Há ainda globais, estilos inline/injetados e bibliotecas externas carregadas inicialmente. Próximas extrações devem seguir dependências medidas e casos reais, sem migração de framework obrigatória.

## Recomendações de interface

### 1. Um contexto de análise por tela

No Relatório Setorial, o topo contém período/equipe e a área interna contém novamente setor/De/Até/Gerar. Foi observado no teste integrado: o topo dizia período Todos enquanto o relatório local usava abril–setembro. As duas seleções se aplicam em sequência. Esse comportamento pode gerar um recorte diferente do que o usuário espera.

Recomendo um cabeçalho único com período, equipe, nível e pessoa; título/resumo sempre mostrando o recorte efetivo. Exportações devem declarar e usar esse mesmo contexto. CSVs com granularidades diferentes precisam de um fluxo de fonte/importação próprio; não devem ganhar um segundo período ambíguo no meio da análise.

### 2. Diminuir entradas analíticas concorrentes

Operação ainda oferece Indicadores, Relatório Setorial, Saúde Operacional e Análises avançadas. Recomendo uma entrada de Análise da operação com seções claras de Resumo, Evolução e Diagnóstico, preservando os cálculos e distinguindo fontes/granularidades. A proposta é consolidar a entrada e o contexto; remover ferramentas analíticas exige revisar seus casos de uso, não apenas esconder abas.

### 3. Começar o trabalho individual pela Equipe

Para avaliar, dar feedback ou trabalhar no PDI de uma pessoa, a entrada principal pode ser o perfil 360º. Visões coletivas e operações em lote, como auditoria/importação de ponto, continuam acessíveis. Isso evita obrigar o líder a escolher entre várias telas de Pessoas antes de definir quem está acompanhando.

### 4. Refinar a Home com indicadores gerenciais

A Home já mostra prioridades e fontes. Recomendo testar uma versão mais enxuta com Finalizados no período, Score/cobertura de notas e pendências; o contador técnico de registros pode ficar nos detalhes. Tabelas e explicações extensas podem ser abertas por aprofundamento. Critério sugerido: identificar o principal problema e abrir sua origem em poucos passos, no desktop e no celular.

### 5. Ações junto do conteúdo

Manter criar/importar/exportar no contexto da tela que usa essas ações. Reservar Ferramentas e menu de conta para utilidades/administração. Padronizar posição e nomes dos controles e reduzir mensagens técnicas na rotina do usuário.

## Sequência recomendada

1. Fechar confirmação de salvamento de feedbacks/metas, com validação de falhas.
2. Prototipar o contexto único no Relatório Setorial e validar exportações/escopo.
3. Revisar entradas de Operação e os caminhos por pessoa na Equipe, preservando operações coletivas.
4. Consolidar CSS/modais e reduzir carga inicial conforme os fluxos estabilizados.
5. Definir o CSV futuro e só então decidir onde e como reaproveitar o Panorama.

A linha validada ainda não foi integrada à main nesta sessão, por falta de autorização de merge. Há oito commits em main..5b175eb na referência local consultada; isso não afirma o estado remoto atual de main. Uma integração futura deve atualizar o remoto e revisar o diff antes de consolidar branches.

## Validação desta alteração

npm test aprovado (171 testes do runner e checks adicionais); release:check e git diff --check aprovados. O cache agora cobre 112 assets do shell/manifest, sem os dois recursos do Panorama. Lazy modules e workspace integrado verificam explicitamente que o host e os recursos do Panorama não aparecem, enquanto relatórios, filtros, gráficos, exportações e destinos existentes continuam funcionando. Testes isolados do Panorama permanecem disponíveis para reuso.

## Continuação em 29/10/2026 — 1.21.0

Os dois primeiros itens foram implementados: confirmação explícita para feedbacks/metas, gravação de metas por item e contexto único do Relatório Setorial. As evidências acima descrevem a base 1.20.1. O estado posterior e seus limites estão em [confirmacao-e-contexto.md](confirmacao-e-contexto.md). Confirmar escritas dos demais complementares, reduzir carga inicial e consolidar navegação/CSS continuam pendentes. O editor legado de metas não possui destino visível no shell; sua localização é uma decisão para o próximo ciclo.

## Continuação 1.22.0

Operação foi organizada em Visão geral, Análises e Metas. Metas têm acesso próprio; os destinos analíticos anteriores permanecem dentro de Análises. A lacuna de localização do editor foi resolvida nesta entrega; ver [operacao-e-metas.md](operacao-e-metas.md). Permanecem as demais pendências de dados, Pessoas e consolidação técnica.
