# Confirmação de salvamento e contexto único — 1.21.0

29/10/2026. Branch fix/confirmacao-salvamento-contexto-analise, baseada em 47cca7a. Continuação dos dois primeiros itens da revisão pós-roadmap.

## Feedbacks e metas

As gravações retornam `{ status: 'confirmed', data }` somente após uma resposta sem error e com os IDs esperados. Falhas de autenticação, rede, RLS ou retorno incompleto rejeitam a operação; a interface apresenta erro e conserva o rascunho, sem inserir a alteração na lista confirmada. Feedbacks restauram também colaborador/período ao reabrir o editor. Alterações de texto feitas durante uma requisição não são apagadas por sua resposta.

O formulário guarda um UUID no rascunho privado antes de enviar. Retentativa usa o mesmo UUID com upsert: perder a resposta de uma inserção não cria outro registro ao tentar novamente. Datas de criação são preservadas. Notificações de feedback só são disparadas após confirmação; falha da notificação não invalida o feedback salvo.

Metas passam a salvar apenas os itens enviados. dbMetasSave continua aceitando arrays para compatibilidade, mas não representa substituição da coleção: array vazio não exclui nada. dbMetasDelete exclui somente o ID indicado e exige retorno dele. Nenhum salvamento faz DELETE da coleção por usuário. Feedbacks também só saem do cache após exclusão confirmada.

As operações são serializadas por domínio/conta/sessão nesta instância. Leituras iniciadas antes ou durante uma mutação não substituem seu resultado por um snapshot atrasado. A geração da sessão é conferida antes/depois da rede, impedindo publicação no cache após logout/troca de conta. O cache confirmado só é atualizado depois do retorno; falha de quota do cache não transforma uma gravação remota confirmada em erro de envio.

### Limites

Não foi adicionada fila de envio em background para esses domínios. Rascunhos são locais por conta/dispositivo; salvar offline continua apresentando falha e permite retentativa manual. Não há comparação de revisões no servidor para edições simultâneas em dispositivos diferentes: o último upsert pode prevalecer. A serialização não é trava entre abas/dispositivos. RLS e esquema publicados continuam sendo responsabilidades do servidor; não houve SQL ou gravação de teste em produção.

O editor de metas já não possui um destino visível no shell atual. Seu contrato e formulário legado foram corrigidos e exercitados em fixture, sem reintroduzir uma tela de metas nesta entrega. A localização desse fluxo precisa ser decidida na consolidação de navegação. IDs antigos locais que não são UUID não são tratados como IDs válidos do servidor; o formulário gera um UUID antes de enviar uma nova gravação.

## Relatório Setorial

A fonte é globalFilters.aplicar(rawRecords), com exclusões existentes de agregados/setores inativos. Os controles antigos ocultos dos Indicadores não acrescentam outro filtro ao relatório. Foram removidos Setor/De/Até/Gerar/Alterar Filtros locais. A análise é gerada e atualizada automaticamente com o contexto do topo: período, setor, nível, colaborador e busca.

Todos usa todos os meses encontrados no recorte; não há limite silencioso de seis meses. O resumo declara os meses efetivamente presentes nos dados, inclusive seleção não contígua. Uma seleção sem linhas apresenta Sem dados neste recorte e orienta rever o topo, sem restaurar dados de outro período.

O texto executivo também usa o recorte global e não restaura um texto gerado para outro conjunto de dados/filtros; Atualizar gera a nova versão. PNG captura o mesmo relatório e resumo. A captura converte cores modernas somente no clone, porque html2canvas não interpreta color(srgb), sem modificar a aparência da tela. PDF recebe as mesmas métricas/meses e declara os filtros aplicados; mantém a proposta sem nomes individuais, indicando filtro individual/busca aplicados de modo genérico. Os cálculos de métricas existentes permanecem. Comparações não buscam automaticamente dados fora do recorte global.

Não foram consolidadas as entradas de Operação, alterados o cockpit, PDI ou o formato futuro de CSV. Panorama continua desativado.

## Verificação

- confirmed-writes.check.js: falha de rede/servidor/RLS, ID ausente, resposta perdida e retentativa, serialização, exclusão por item, papel, leitura atrasada e sessão encerrada.
- report-context.check.js: fonte única, filtros antigos ignorados, Todos sem truncamento, meses não contíguos e contexto do PDF sem nome individual.
- workspace-ux.browser.html?saves=1: formulários reais com servidor simulado; falha, rascunho/restauração, confirmação e duplo clique. Para metas, o container legado é montado somente na fixture.
- workspace-ux.browser.html: regressão das 13 telas, recortes globais e exportações reais; complementar com lazy-modules e data-lifecycle.

Não é teste de RLS/concorrência entre dispositivos no banco de produção.

Validação final: npm test aprovado (171 testes históricos mais checks adicionais), release:check e diff sem erros. Workspace passou em desktop e celulares de 390/320 px, incluindo tema escuro, PDF/PNG reais e impressão. O modo saves passou com falhas/retentativa em desktop e celular. Lazy modules e data-lifecycle passaram no navegador. A validação usa Chromium e serviços simulados; não comprova RLS publicada nem acessibilidade completa.
