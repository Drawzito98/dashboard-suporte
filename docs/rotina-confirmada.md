# Rotina confirmada — 1.25.0

Tarefas e anotações usam a fachada db-extra e o repository routine. Listas no AppState e cache privado contêm apenas respostas confirmadas. Leituras são paginadas em 500 linhas, preservam a última lista em falha e aceitam vazio oficial. Respostas de outra sessão ou anteriores a uma mutação são descartadas. Regras permanece com o contrato anterior.

## Escritas e edição

Salvar exige ID e proprietário retornados; excluir exige ID retornado com filtro de conta. As tarefas preservam a exigência de administrador. Notas continuam privadas da conta, com as mesmas permissões anteriores. Status e favorito têm operações próprias, sem reenviar título, descrição ou conteúdo antigo. Salvar texto preserva o status/favorito confirmado localmente. O cockpit e o badge consultam AppState, inclusive quando a atualização do cache falha após confirmação remota.

O editor ativo fica em rotina-cards.js. Renderizadores antigos duplicados foram removidos; tarefas.js mantém datas, badge e lembretes, e anotacoes.js mantém a abertura dos overlays. IDs, rotas, campos e fórmula de recorrência permanecem.

Rascunhos privados: sistema_tarefa_rascunho_v1 e sistema_anotacao_editando_v1. Campos são preservados ao digitar, alternar lista/kanban, pesquisar e reabrir a área. Abrir outra edição pede descarte explícito. Um UUID é reservado antes do envio e reutilizado na retentativa, inclusive quando a resposta se perde. Falha ao guardar o rascunho impede o envio e mantém os campos na tela. Cancelar descarta explicitamente; excluir um registro preserva a edição aberta. Não há adoção de armazenamento nativo antigo sem dono.

A conclusão recorrente guarda um destino fixo em sistema_tarefa_transicao_v1 antes do envio. A retentativa manual envia o mesmo patch, mesmo após uma nova leitura revelar que o servidor já aplicou a mudança. Há no máximo uma tentativa de status pendente por conta/dispositivo; o usuário pode confirmar novamente ou descartá-la explicitamente e consultar a lista. Não há envio automático. Bloqueio de controles evita duplo clique na instância aberta; falhas mostram mensagem e mantêm a lista anterior.

## Atividades e limites

anotacoes_diarias também contém atividades com prefixo atividade-colaborador:v1:. A biblioteca não as lista; salvar, favoritar e excluir notas protegem esse prefixo. O editor de atividades não foi modificado.

A confirmação usa as políticas de acesso existentes. Não há migration, trava entre dispositivos, comparação de revisão no servidor nem fila universal de sincronização. Edições simultâneas em dispositivos diferentes ainda precisam de revisão específica. O rascunho depende do armazenamento privado disponível neste navegador e não é um backup remoto.

## Validação

npm test agrega os casos simulados de confirmação, dono/ID, RLS/rede, resposta perdida, UUID, paginação completa, status/favorito isolados, exclusão, cache indisponível, atividade protegida e sessão invalidada. workspace-ux.browser.html?routine=1 exercita os formulários reais com servidor simulado: erros, retomada, busca/vista, quota, duplo clique e recorrência após resposta perdida. Regressões: workspace completo, cockpit/race, data-lifecycle, lazy-modules, design-system e atividades-mes. Nenhum teste grava em produção. Resultado desta rodada: npm test aprovado (171 casos históricos e todos os checks adicionais), release:check e diff --check sem erros. Os formulários passaram em 1440px e 320px; workspace completo passou em desktop e 320px, cockpit também cobriu sessão encerrada, e design-system passou em desktop/320px. Lazy-modules, data-lifecycle e atividades-mes aprovados.

## Continuidade

Revisar a confirmação dos demais cadastros, bônus, regras, férias/ausências e comentários por domínio. Reduzir scripts iniciais/globais e consolidar CSS continuam no roadmap. Panorama permanece desativado até definir o CSV. Merge continua dependendo de autorização explícita.
