# Cadastro de colaboradores confirmado — 1.26.0

O cadastro usa a fachada db-extra e o repository people. Salvar, limpar campos, aplicar/remover foto e reativar durante a criação aguardam resposta do servidor. Falhas preservam o editor. Campos, nomes, regras de negócio, cálculo de ponto e políticas de acesso não foram alterados.

## Cadastro e fonte oficial

As leituras de colaboradores são paginadas em 500 linhas e filtradas pela conta. Publicação exige sessão atual e revisão de leitura compatível com as mutações locais; uma resposta vazia é oficial. O timestamp local deixa de sobrepor a resposta do servidor. Antes de substituir a cópia privada anterior à confirmação uniforme, ela é preservada em sistema_colaboradores_backup_v1, por conta. Esse arquivo de cache não é mesclado nem reenviado automaticamente; sua recuperação exige revisão explícita. Se não for possível preservá-lo, o cache anterior fica intacto e a resposta atual permanece no AppState.

A gravação usa a chave única existente user_id,nome, com retorno de ID, nome e proprietário. A retentativa após resposta perdida mantém a identidade dessa chave, sem reenviar a coleção ou gerar outro cadastro. Somente campos enviados são atualizados; criar/atualizar o setor não apaga salário ou observações. A tela mantém o critério histórico de localizar um cadastro existente ao criar pelo nome; não houve normalização nova no repository.

Cadastro, filtros, detalhe, cockpit e lista de pessoas do Ponto consultam o AppState confirmado, com cache privado como fallback. Falha de cache após confirmação remota não transforma a gravação em falha do servidor. O fallback antigo que removia salário da requisição foi retirado: se o esquema não aceitar um campo, a operação falha e a edição permanece no rascunho. Nenhum SQL é aplicado automaticamente.

## Editor e confirmações parciais

sistema_colaborador_rascunho_v1 guarda a edição privada, o tipo de editor, a pessoa, campos e foto preparada. Fechar e reabrir retoma a edição; trocar de pessoa/editor exige descarte explícito. Campos são preservados ao digitar e antes do envio. Falha de armazenamento impede envio e fechamento que perderia a edição. Preparação de foto tem controle de versão; erro/quota exige corrigir ou remover a seleção antes de salvar. As ações ficam bloqueadas durante a requisição para evitar duplo envio.

Dados pessoais, foto e reativação são operações distintas. A tela informa quando o cadastro foi confirmado e uma etapa posterior falhou; não promete transação atômica. O rascunho é mantido para tentar novamente. Limpar dados é uma gravação confirmada de campos vazios e não apaga o rascunho anterior; há ação explícita para descartar o rascunho. O retorno ao Perfil 360º respeita cancelamento e bloqueio do editor.

## Fotos e reativação

Fotos continuam compartilhadas conforme o esquema existente, sem inventar user_id na tabela. As escritas exigem administrador e sessão válida, usam nome exato e retorno de ID; leituras são paginadas e mantêm o critério anterior de equivalência de nomes dos avatares. setColabFoto não publica cache otimista. O atalho de foto na Gamificação também trata erro/duplo clique/sessão; ele continua usando o prompt anterior, sem rascunho durável de URL.

Ao cadastrar, a reativação lê os inativos da conta e exclui apenas os IDs correspondentes à pessoa, confirmando cada exclusão. Não apaga e recria a coleção inteira. O critério de equivalência da inativação permanece. O gerenciador geral de ativos/inativos e setores mantém sua implementação anterior e ainda deve ser revisado separadamente.

## Limites e continuidade

Não há trava entre dispositivos, transação entre cadastro/foto/inativação, envio automático ou fila universal. As fotos não têm unicidade de nome documentada no esquema; concorrência de criação entre dispositivos permanece um limite. O rascunho e a cópia privada anterior dependem do armazenamento deste navegador, não são backup remoto. O servidor continua responsável pela autorização real.

Próximos domínios: bônus, regras, férias/ausências, comentários e os gerenciadores de ativos/inativos. Redução de scripts/globais e consolidação de CSS continuam no roadmap. Panorama permanece desativado. Não houve merge ou migration.

## Verificação

npm test usa simulações e cobre confirmação/identidade/conta, patch parcial, salário, paginação completa/vazio, resposta perdida, cache indisponível, cópia anterior preservada, reativação por pessoa e sessão invalidada. workspace-ux.browser.html?cadastro=1 testa formulários reais, foto PNG processada pelo navegador, falhas/quota, rascunhos retomados, duplo clique, confirmação parcial, criação e limpeza. Demais fixtures verificam navegação, Equipe 360º, sessão, carregamento, PDI, Ponto e acessibilidade. Nenhum teste escreve no banco de produção.

Resultado: npm test aprovado (171 casos históricos e todos os checks adicionais), release:check e diff --check sem erros. Formulários passaram em 1440/320px; workspace completo e Equipe360 em desktop/320px, além de Pessoas, Ponto sintético, PDI, data-lifecycle, lazy-modules e design-system desktop/320px. As fixtures não comprovam as políticas ou integrações reais de produção.
