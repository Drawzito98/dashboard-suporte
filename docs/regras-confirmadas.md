# Regras confirmadas — 1.29.0

O quadro de regras mantém as três colunas, as rotas e as políticas existentes de migration_v43.sql: leitura compartilhada autenticada, alterações por administradores. Não foi aplicado SQL. O campo user_id identifica a autoria e não é filtro de propriedade neste domínio. Editar uma regra de outro administrador preserva sua autoria.

O repository routine e a fachada db-extra confirmam salvar/mover/excluir antes de publicar a lista. Exigem o ID retornado; erros de rede/RLS ou respostas sem ID não viram sucesso. Leituras são completas em páginas de 500, com sessão e revisão verificadas; vazio confirmado é oficial, falha não publica lista parcial. AppState.regras/getRegrasConfirmadas fornecem o estado, inclusive se o cache falhar após confirmação.

O cache confirmado usa sistema_regras_confirmadas_v1. O cache antigo sistema_regras_v1 permanece preservado, mas não é adotado nem enviado automaticamente: podia conter gravações otimistas não confirmadas. Recuperar itens antigos exige revisão explícita e não faz parte desta entrega.

O editor conserva rascunho privado em sistema_regra_rascunho_v1, com UUID reservado antes do envio. Trocar de área/reabrir não limpa a edição; abrir outra regra pede descarte. Erro mantém campos e UUID, evitando criar outro registro na retentativa. Falha ao guardar rascunho bloqueia o envio. Durante a operação, controles e arrastar ficam bloqueados. Não há fila automática, trava entre abas/dispositivos nem comparação de versão no servidor.

Mover envia somente status, posicao e updated_at. Editar o texto envia somente titulo, descricao, categoria e updated_at; a coluna é alterada pelo cartão. Uma edição de registro removido não o recria. Exclusão preserva o rascunho aberto para revisão. Há consulta prévia no salvamento, mas ela não é transação com a escrita: concorrência remota entre consulta/atualização ainda depende do banco e merece evolução própria. Uma criação com UUID após resposta perdida pode ser reconhecida pela consulta de ID; a retentativa reutiliza esse ID.

Validação: npm test; testes simulados de erro/RLS/rede, resposta perdida, confirmação/UUID, compartilhamento, autoria, patch de coluna, edição, exclusão, paginação, cache, leitura antiga e sessão. regras.browser.html exercita o formulário real com servidor simulado em desktop e 320px: rascunho, reabertura, quota, clique duplo, falha, movimento, texto preservado, exclusão e consulta. Não grava em produção. Regressões: workspace completo, data-lifecycle e lazy-modules. A cobertura não comprova políticas publicadas nem concorrência entre dispositivos.

Continuidade: comentários, gerenciadores gerais de ativos/inativos, demais gravações legadas, auditoria visual ampla e consolidação de scripts/globais/CSS. Panorama segue desativado aguardando definição do CSV. Merge exige autorização explícita.
