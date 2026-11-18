# Bônus e penalidades confirmados — 1.27.0

Bônus/penalidades usam a fachada db-extra e o repository performance. As outras operações do domínio (metas, scoring e alertas) mantêm seus contratos anteriores. Nenhuma regra de scoring, multiplicador, filtro de pessoa ou tratamento de transferências foi alterado.

## Fonte e confirmação

Leituras são paginadas em 500 linhas e filtradas pela conta, com ordenação estável, verificação de sessão e revisão local. Falha não publica lista parcial; vazio oficial substitui a lista anterior. O modelo agora inclui mes, que o loader antigo descartava. Isso corrige a associação dos lançamentos ao período após recarregar a página.

Gravação usa upsert do UUID reservado no rascunho; exige retorno do ID esperado e proprietário. Exclusão atua somente por ID/conta e exige aquele ID na resposta. Falhas de RLS, rede, retorno incompleto ou sessão encerrada não alteram a projeção confirmada. Uma resposta perdida após aplicar o upsert pode ser repetida com o mesmo UUID. Se a exclusão foi aplicada e a resposta se perdeu, Atualizar lista reconcilia o servidor; ausência de ID não é presumida como sucesso.

AppState.pontosExtras e getPontosExtrasLocal alimentam editor, scoring, histórico cadastral e detalhe legado. A confirmação invalida o cache de Gamificação; se a gravação do cache privado falhar, a confirmação remota continua disponível em memória. Antes da primeira substituição da cópia privada antiga, sistema_bonus_backup_v1 preserva essa cópia da conta, sem mesclá-la ou enviá-la automaticamente. Se a preservação falhar, o cache anterior fica intacto e o AppState recebe o resultado oficial.

## Editor e acesso

O acesso real é Pessoas → Equipe → Bônus e penalidades, no grupo de ferramentas de gestão do administrador. Gamificação não foi reintroduzida como uma tela. O overlay usa o contrato open/aria-hidden e o fechamento existente, com teclado/foco compartilhados. Os campos e ações recebem nomes acessíveis.

sistema_bonus_editando_v1 guarda campos brutos, mês, UUID, magnitude e tipo da edição. Fechar/reabrir preserva o rascunho. Trocar para outro lançamento pede descarte explícito. Descartar rascunho não exclui o lançamento; excluir um lançamento não apaga a edição separada. Falha de armazenamento impede enviar ou fechar perdendo a edição. Enquanto o servidor responde, controles e fechamento ficam bloqueados contra duplo clique e edição concorrente nesta instância.

Conceder bônus usa sinal positivo; Registrar penalidade usa sinal negativo. Depois de uma tentativa nova sem confirmação, repetir mantém o sinal reservado; mudar de tipo exige descarte explícito. Na edição, pessoa e sinal permanecem os do lançamento original, como no contrato anterior; o seletor da pessoa agora deixa isso claro em vez de aceitar uma mudança que era ignorada. Nomes/mês da edição continuam disponíveis mesmo quando não aparecem mais no CSV. Descrição, magnitude e mês podem ser alterados.

O cálculo continua somando os lançamentos da pessoa exata nos meses presentes no recorte e multiplicando pela configuração pontos_extras. Quando existem meses no recorte, lançamentos sem mês ficam fora dessa pontuação. Sem meses nas linhas, o tratamento histórico anterior é preservado. O editor esclarece a relevância do mês sem mudar essa regra.

## Limites e continuidade

Há serialização por conta/sessão nesta instância, sem trava entre dispositivos, comparação de revisão no servidor ou fila automática universal. Rascunho e cópia anterior dependem deste navegador. IDs temporários legados só são convertidos em UUID em uma edição/envio explícito; inserções antigas sem correspondência de ID remoto ainda exigem revisão humana e podem ter duplicações anteriores. Não há deduplicação/exclusão automática nem migração de cache sem dono.

Permanecem pendentes regras, férias/ausências, comentários e gerenciadores de ativos/inativos, além de scripts/globais e CSS. Panorama permanece desativado. Sem SQL ou merge.

## Testes

npm test cobre erros/rede/ID/conta, mês após leitura, UUID idempotente, sinais e multiplicador com pessoa/período exatos, cache indisponível, cópia anterior, paginação, exclusão, leitura antiga e sessão invalidada. workspace-ux.browser.html?bonus=1 exercita o acesso e formulários reais com backend simulado: quota, falhas, rascunho retomado, duplo clique, sinal reservado, resposta perdida, edição de penalidade, pontuação e exclusão reconciliada. Nenhum teste grava no banco de produção.

Validação da entrega: npm test aprovado (171 casos históricos e todos os checks adicionais), release:check e diff --check sem erros. Bônus em 1440/320px, com contenção do editor; workspace completo, Equipe360 e design-system em desktop/320px, além de Pessoas, data-lifecycle e lazy-modules. Essas simulações não comprovam a RLS ou integrações publicadas no servidor.
