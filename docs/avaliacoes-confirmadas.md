# Avaliações com confirmação e rascunhos — 1.24.0

29/10/2026. Branch fix/avaliacoes-confirmacao-rascunhos, baseada em 481f354. Consolidação da persistência de avaliações; fórmulas, competências e escala de notas continuam as existentes.

## Fonte oficial e cache

A persistência saiu de avaliacao.js e passou para AppRepositories.development, pela fachada db-extra. dbAvaliacoesLoad lê páginas de 500 registros com ordenação estável, filtra proprietário no servidor e confere novamente o user_id. Falha em uma página não publica um parcial como completo; usa o último estado/cache confirmado da própria conta. Uma resposta vazia bem-sucedida substitui a lista confirmada por [].

AppState.avaliacoes contém somente avaliações confirmadas. O cache privado mantém o mesmo contrato. Rascunhos usam outra chave, sistema_avaliacao_rascunho_v1, automaticamente isolada por conta pelo appStorage; não aparecem nas contagens/históricos nem nas fontes do PDI como avaliações gravadas. Leituras vazias ou offline não apagam esse rascunho.

## Escritas

| Comando | Confirmação exigida |
|---|---|
| dbAvaliacaoSave | upsert com UUID estável; resposta sem error, ID esperado e proprietário correto |
| dbAvaliacaoStatus | UPDATE somente de status/updated_at, por ID e proprietário; retorno do registro esperado |
| dbAvaliacaoDelete | DELETE por ID e proprietário, com retorno daquele ID |

As funções retornam status confirmed apenas após essa validação; falhas rejeitam sem publicar uma alteração otimista. UI mostra sucesso somente após o retorno. O registro retornado pelo servidor é a projeção oficial, incluindo datas/status. Notificações de avaliação só são emitidas depois da confirmação; falha na notificação não invalida a gravação.

O formulário atribui um UUID antes do envio e o mantém no rascunho privado. Se o servidor aplicar uma inserção e a resposta se perder, tentar novamente usa o mesmo ID e não cria outra linha. Uma edição preserva a data de criação. IDs temporários legados são convertidos apenas em uma gravação explicitamente solicitada; não há migração automática nem união por pessoa/ciclo. Essa identidade nova não resolve inserções antigas cujo ID remoto nunca foi identificado.

Salvar textos/notas preserva o status já confirmado nesta instância. Marcar pendente/revisado não reenvia notas ou comentários do cache. Exclusão e alteração de status falhas mantêm a projeção anterior e permitem tentar novamente. Quando a exclusão foi aplicada mas sua resposta se perdeu, uma nova leitura deve reconciliar a lista; ausência de ID retornado não vira sucesso presumido.

Mutações são serializadas por domínio/conta/sessão pelo protocolo existente. A sessão é validada antes/depois das requisições. Uma leitura iniciada antes ou durante uma mutação não pode restaurar um snapshot antigo após sua conclusão. Escrita confirmada continua válida se a atualização do cache falhar; AppState mantém a projeção confirmada em memória. Isso não representa sincronização garantida de todo o app.

## Editor e recuperação

Notas, observações por competência, textos gerais/qualitativos, comentários e período compõem o rascunho privado. Comentário digitado ainda não incluído também é recuperado; antes de publicar, o usuário deve adicioná-lo à lista, como orienta a interface. Abrir/consultar uma avaliação sem editar não cria uma nova pendência de gravação.

Falha de envio mantém o formulário e o rascunho, com mensagem explícita e nova tentativa. Fechar edição preserva alterações reais; Retomar rascunho reconstrói os campos com o mesmo UUID. Descartar rascunho é uma ação explícita com confirmação e não exclui o registro no servidor. Substituir a edição por outra avaliação exige confirmação quando há rascunho. Os guards e o retorno ao Perfil 360º continuam válidos.

Enquanto um salvamento aguarda confirmação, controles do editor são bloqueados para impedir duplo envio e perda de uma edição mais nova. Navegar por tabs não descarta uma gravação em andamento. Se não for possível preservar o rascunho no navegador antes de enviar, a operação não é enviada e os campos permanecem na tela. Status/exclusão não removem um rascunho separado que esteja sendo editado.

Somente admin recebe ações de edição na interface e os comandos de mutação também verificam requireAdmin. Os escopos/RLS do servidor não foram alterados. Não há novas tabelas, migrations ou escrita de teste em produção.

## Limites preservados

- Rascunho é local por conta/dispositivo; não há fila automática de envio deste domínio nem cópia entre navegadores.
- A serialização/revisão é desta instância. Não existe bloqueio/CAS no servidor entre dispositivos; uma edição concorrente remota ainda pode prevalecer conforme a última escrita. Paginação também não é snapshot transacional do banco.
- Cache e rascunhos dependem do armazenamento do navegador. Não foram adotadas chaves antigas sem proprietário nem alteradas permissões de banco.
- Os demais domínios complementares continuam com seus contratos próprios; não foram declarados integralmente consolidados.

## Verificação

confirmed-writes.check.js cobre os quatro comandos, erros/RLS/rede, ID/dono ausentes ou incorretos, resposta perdida e retentativa, 1.101 registros/paginação, página posterior com erro, vazio oficial, preservação do rascunho, cache indisponível, status isolado, datas, serialização, leitura atrasada, autenticação divergente e sessão encerrada.

workspace-ux.browser.html?evaluations=1 usa formulário, runtime e repository reais com servidor simulado: valida notas/comentários, quota do rascunho sem envio, falha sem falso sucesso, retomada por UUID, resposta perdida, edição, status sem reenviar texto, consulta por viewer, exclusão confirmada e duplo clique. O modo &preview=1 mostra somente uma prévia de recuperação após falha simulada.

npm test e fixtures de workspace, Pessoas, salvamentos, ciclo de dados, Equipe360, PDI, carregamento e componentes complementam a regressão. Testes locais não comprovam a RLS publicada nem conflitos entre dispositivos em produção.

Validação final: npm test aprovado (171 testes históricos e checks adicionais), release:check, sintaxe dos scripts alterados e git diff --check aprovados. Fluxo de avaliações aprovado em desktop e 320 px/tema escuro, incluindo falhas, quota do rascunho, retomada e exclusão; workspace completo aprovado em desktop e 390 px. Pessoas, feedbacks/metas, data-lifecycle, Equipe360, PDI, lazy-modules e design-system aprovados no navegador. Prévia de retomada após falha simulada inspecionada. Nenhuma escrita de teste em produção.
