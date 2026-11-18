# Histórico e notificações — 1.35.0

Branch `fix/historico-notificacoes-confirmados`, baseada em 737cf51. Sem alteração de SQL, RLS, regras de negócio ou merge.

## Histórico

`logHistorico` chama a fachada uma vez, sem adicionar uma cópia otimista ao cache. O repository audit usa UUID estável, consulta o ID antes de INSERT e confere ID, conteúdo e autor retornados. Zero é preservado. Autenticação, sessão e revisão impedem respostas atrasadas de substituir uma escrita nova ou publicar após logout.

Confirmados ficam em AppState.historico e `sistema_historico_confirmado_v1`. O cache anterior `sistema_historico_v1` permanece preservado, sem adoção automática: poderia conter duplicações e registros não confirmados. A leitura traz até 500 registros do servidor, ordenados por data/ID; a tela mostra os mais recentes primeiro. Vazio bem-sucedido substitui a projeção; falha mantém a lista anterior e informa indisponibilidade.

Depois de validar a autenticação e antes da escrita, o envio é preservado em `sistema_historico_pendente_v1`, privado da conta. Se não puder preservá-lo, não inicia INSERT. Não há reenvio automático. A tela separa pendências e confirmados; a ação manual consulta o mesmo ID e reconhece um INSERT cuja resposta se perdeu. Atualizar a lista também reconcilia pendências encontradas com o mesmo conteúdo entre os últimos 500 registros. Itens anteriores a esse recorte podem ser consultados individualmente pela retentativa. Uma falha antes da preservação (por exemplo, autenticação/carregamento do módulo) gera aviso, mas não cria uma pendência durável.

A trilha é independente da ação principal. Não há transação entre edição de indicadores e histórico; alguns chamadores registram a intenção local antes da confirmação dos indicadores. Não interpretar esta lista como auditoria transacional do banco. Nenhuma nova cobertura de auditoria foi adicionada a todos os módulos. Não há trava entre dispositivos. O antigo botão que apagava somente o cache foi substituído por Atualizar; nenhum histórico remoto é excluído.

## Notificações

A consulta administrativa mantém o recorte de 50, mostra falha e preserva a lista anterior; vazio confirmado limpa a lista. Estado em memória é protegido por conta/sessão, sem novo cache persistente. Atualizações de leitura passam por `_confirmedWrite`, exigem IDs válidos e retorno `{id,lida:true}`. Somente os IDs retornados são marcados localmente; retorno parcial informa falha parcial. Resposta perdida mantém o estado anterior até nova consulta. Repetir o patch `lida:true` é idempotente.

Botões mostram falha, bloqueiam repetição durante a operação e aceitam teclado. Inicializar a UI duas vezes não duplica seus listeners. Data aceita timestamps com ou sem timezone. Atualizar lista fica disponível no painel.

O autor não-admin pode inserir mas não selecionar notificações pela política existente. A criação confere erro do INSERT e sessão sem exigir SELECT proibido. Ausência de erro significa requisição aceita, não uma confirmação por leitura. Falha avisa que a ação principal foi salva mas a notificação não foi confirmada; não desfaz a ação, não reenvia automaticamente nem oferece garantia de entrega. A criação continua no módulo legado, sem alegação de repository universal.

## Validação

`npm test` inclui audit-notifications.check.js: resposta perdida, reconciliação, quota antes de INSERT, zero, cache legado preservado, vazio, falha, confirmação parcial, RLS de leitura do autor e sessão invalidada. Fixtures audit-notifications.browser.html e audit-notifications-mobile.browser.html validam a UI com servidor simulado em desktop/320px, incluindo falhas, teclado, fechamento e ausência de duplicação. Regressões: workspace geral desktop/mobile, comentários, data-lifecycle, lazy-modules e design-system. Nenhuma escrita de testes em produção, migration ou validação das políticas efetivamente publicadas.

## Complemento 1.35.1

Botão Histórico em Ferramentas conectado ao editor e incluído na regressão do workspace desktop/mobile: fechar o dialog de ferramentas, abrir histórico e fechar pelo botão. A checagem integrada encontrou o acesso desconectado, não coberto pela fixture isolada.
