# Diagnóstico gerencial — auditoria e primeira implementação

Data: 22/10/2026. Auditoria e implementação inicialmente locais. Commit e deploy do aplicativo autorizados posteriormente pelo usuário; a migração v49 foi aplicada posteriormente, em 22/10/2026, mediante autorização do usuário.

## Auditoria anterior à implementação

README.md e AGENTS.md foram lidos. Estão parcialmente desatualizados: o repositório contém migrações até v48, testes automatizados, módulos de análise que substituem renderizadores antigos e perfil/PDI já existente. O novo trabalho não altera nem expande esse PDI.

| Módulo auditado | Funcionamento e decisão de integração |
| --- | --- |
| painelLider.js | Agrega por pessoa, calcula variações e alertas; usa o recorte global, o que pode ocultar o mês anterior. Acrescentar consolidado sem remover a visão existente. |
| insights.js | Contém análise mensal e cruzamento de métricas. Seu renderizador é substituído por advanced-analysis-v2.js e, depois, indicator-health-v3.js. Integrar depois desses módulos, preservando indicadores e alertas. |
| colaboradores.js | Cadastro em sistema_colaboradores_info_v1; setor_atual, nivel e observacoes. openColabDetailOverlay abre a edição do perfil. Acrescentar seção independente sem outro cadastro. |
| colab-detail.js | Histórico, médias e Chart.js; renderColabDetail é substituído por people-profile-notes-v2.js. Integrar ao renderizador efetivamente ativo e à edição. |
| comparativos.js | Comparação pessoa/setor/período. Funções são substituídas por advanced-analysis-v2.js. Preservar os comparativos existentes; dar ao diagnóstico controles mensais independentes. |
| avaliacao.js | Competências com escala 1–4, ciclo e observações, em avaliacoes/localStorage. Não são avaliações de satisfação e não podem ser usadas como peso do Score. |
| feedbacks.js | Sugestões e anotações por colaborador/mês. Reutilizar as anotações existentes como contexto, sem gerar outro feedback nem cadastrar cópias. |
| db.js | CRUD em registros; lê páginas de 1.000 linhas; converte Score do banco em SCORE. DB_COLUMNS restringe campos persistidos. Nenhuma chamada de alteração de registros pelo diagnóstico. |
| db-extra.js | Metas, cadastro e outras entidades em Supabase com cache/fallback local. Reutilizar chaves/formato de metas, cadastro e observações. |
| globalFilters.js | Período único, múltiplo ou intervalo mensal; setor, nível, colaborador e busca. getDataFiltered aplica esses filtros a rawRecords. Diagnóstico conserva filtros de contexto, mas consulta histórico fora do filtro de período para obter a base. |
| scoring.js/metas.js | Pontuação configurável e metas por pessoa/setor/período; métricas finalizados, score e produtividade. Não alterar pontuação. Usar Score oficial 4,70 no novo diagnóstico e metas compatíveis das outras métricas. |
| helpers.js/app.js | Reutilizar cadastro/nomes, aliases no modo apresentação e ChartTheme. As somas antigas com conversão de ausência para zero e médias diferentes entre módulos não são apropriadas ao novo diagnóstico. Nenhuma edição em app.js. |

### Dados e estrutura documentada no código

- `registros`: id, user_id, Setor, Mês, Atendente, Assumidos, Transferidos, Finalizados, Score, Objetivo, Observações, Nota1–3, Total, Arquivo e TMA/TMR (v26). Dados mensais; não há contrato de contagem de avaliações nem cobertura diária garantida.
- `colaboradores_info`: cadastro por nome e usuário; nível (v24), setor atual (v32) e salário (v45), além de observações, admissão e outros dados cadastrais. O nível é atual, sem histórico de mudanças.
- `metas`: usuário, métrica, valor alvo, setor, colaborador, tipo e período.
- `feedbacks`: colaborador, mês, anotações e conteúdo sugerido/final, por usuário.
- `avaliacoes`: colaborador, ciclo, competências, observações e status, por usuário. Escala distinta do Score de satisfação.
- Migração v31 reforça políticas usando papel de `app_metadata` e restringe acesso anônimo. As v46–48 tratam da auditoria de ponto; não devem ser confundidas com diagnóstico de suporte.
- Foi tentada consulta somente dos metadados públicos via OpenAPI do Supabase, que retornou HTTP 401. Portanto, a estrutura acima é a verificada nas migrações e consumidores do repositório; **não foi confirmada a aplicação dessas migrações no banco ativo nem foram executadas políticas RLS contra esse ambiente**.
- O importador principal existente usa dbReplaceAll; este comportamento não foi alterado nem invocado pelo diagnóstico. O Panorama lê seu CSV apenas em memória; importar um Panorama não grava automaticamente esse conteúdo no histórico mensal de registros.

### Alterações propostas e implementadas

1. Motor puro e compartilhado em diagnostico-engine.js, com casos de dados ausentes, calendário, recorrência, filtros, metas e separação por setor/nível.
2. Integração aditiva em diagnostico-ui.js em Insights, Liderança e nos dois pontos de abertura do perfil; sem mudar app.js ou os módulos de gamificação.
3. Histórico, gráfico Chart.js com linha da meta e observações existentes no perfil. Cada sugestão traz indicador, evidência, interpretação, hipótese e ação recomendada.
4. Revisões privadas em diagnostico-store.js e migração aditiva v49, preservando sugestão original, snapshot e histórico de decisões.
5. CSS com tokens existentes e adaptação móvel. Cache PWA incrementado; arquivos novos carregados após os módulos existentes.

## Método e limites dos novos diagnósticos

- Meta oficial de Score: **4,70**. Médias simples individuais são calculadas com valores válidos 0–5; no consolidado simples, cada pessoa tem o mesmo peso. Esse número não recebe o rótulo de Score ponderado.
- Score consolidado ponderado exige a coluna explicitamente identificada como `Quantidade avaliações`, inteira e não negativa, em todas as linhas pertinentes. `Total`, quantidade de registros, atendimentos finalizados e competências não são pesos. Sem essa contagem, o ponderado é indisponível. O esquema/importador atual não persiste essa coluna: normalmente o indicador ficará indisponível, sem estimativa inventada.
- Campo ausente não vira zero. Contagens válidas de zero são preservadas. Não há divisão por zero.
- Mês anterior é o mês do calendário, sem pular lacunas. Períodos personalizados são intervalos **mensais**, porque o histórico não permite recortes diários confiáveis. Intervalos sobrepostos são rejeitados; limite de 120 meses por intervalo.
- Mês atual, futuro ou explicitamente parcial, durações diferentes, lacunas e mudança de composição da equipe são sinalizados. Nesses casos volumes são apenas descritivos, sem classificar variação de produtividade. Mesmo para meses passados há aviso de cobertura não confirmada, pois o CSV pode representar uma exportação parcial.
- N1/N2 e outros níveis têm grupos distintos. O nível vem do cadastro atual, com aviso da ausência de histórico. Não existe ranking de volume/produtividade entre níveis. Pessoas sem nível permanecem em grupo separado.
- Setor histórico vem do próprio registro, preservado. Cadastros podem ser encontrados pelo nome completo ou primeiro nome único, conforme a compatibilidade já solicitada para o app; ambiguidades não são resolvidas automaticamente.
- Recorrência exige três meses consecutivos com Score válido. Duas quedas sucessivas ou três resultados abaixo da meta geram sinais de investigação. Meses ausentes ou notas ausentes interrompem o critério.
- TMA/TMR são médias simples dos tempos disponíveis. Aumento superior a 15% gera hipótese de gargalo, não causa confirmada. Tempos em HH:MM:SS, inclusive arredondamento de segundos para 60, são aceitos.
- Transferências são apresentadas como contexto neutro. CADU é excluído das análises humanas. Não há atribuição automática de causa ou culpa por processo, bot, escala ou complexidade.
- Metas existentes de finalizados/produtividade e Objetivo dos registros são reutilizados quando há compatibilidade de pessoa/setor/período. Metas semanais não são avaliadas com dados mensais. Metas de volume em período parcial não recebem classificação de cumprimento.
- Sugestões podem existir com poucas notas porque a quantidade de avaliações não é conhecida; são explicitamente observacionais, com hipótese e recomendação de conferir a amostra. Ausência de referência não recebe classificação de estabilidade ou saúde.
- Os componentes antigos continuam disponíveis. Esta entrega não reescreve os métodos de saúde e pontuação legados; a nova seção explica sua própria metodologia e meta.

## Revisão pela liderança

- Administrador autenticado pode validar, ajustar (justificativa obrigatória) ou descartar.
- Papel é verificado novamente por `auth.getUser()` e `app_metadata.role`; esconder botão não é a única proteção.
- A migração v49 cria somente diagnostico_revisoes, com RLS privada por user_id e papel admin para SELECT/INSERT. Não há UPDATE/DELETE: decisões posteriores são novas entradas; nenhuma política/tabela existente é modificada.
- Hash SHA-256 vincula a revisão ao indicador, recorte, setor, nível, evidências e métricas usadas. Mudança nos dados gera outra sugestão a revisar.
- Fallback local separado por usuário. Falha remota é exibida como sincronização pendente, nunca como gravação confirmada no banco. Ao carregar revisões com a migração disponível, pendências são reenviadas com UUID estável, sem duplicação.
- **Migração v49 aplicada em produção em 22/10/2026.** Tabela, índice, RLS e políticas de SELECT/INSERT conferidos no banco ativo. A sincronização remota está habilitada; falhas de conexão continuam usando o fallback local.

## Validação

```sh
node tests/runner.js
node tests/diagnostico-store.check.js
node tests/db-pagination.check.js
node tests/db-updates.check.js
```

Teste de interface local: servir a pasta em 127.0.0.1 e abrir `tests/diagnostico.browser.html`. Usa dados e autenticação simulados, sem chamada ao Supabase real. Verifica preservação de componentes, filtros, períodos, N1/N2, configuração do gráfico, escape, revisão e recusa de viewer. Testado em Chrome headless desktop e largura móvel. O teste de gráfico usa stub de Chart; a biblioteca Chart.js já usada no aplicativo não foi substituída.

Os testes de contrato da migração verificam restrições no SQL; não equivalem a um teste de RLS executado no PostgreSQL. Para habilitar a sincronização remota das revisões, aplicar v49 em ambiente de validação e confirmar com sessões reais admin/viewer que as revisões permanecem privadas antes de aplicar a migração em produção. A publicação do aplicativo foi autorizada separadamente, mantendo o fallback local e a indicação de sincronização pendente enquanto a tabela não estiver disponível.

## Habilitação da sincronização no banco ativo — 22/10/2026

Aplicada exclusivamente a migração v49 ao projeto dashboard-suporte (agvkmfusyetkicmuvumz), usando o acesso administrativo já disponível na CLI. Nenhuma alteração nas tabelas históricas.

Validação SQL transacional com papéis efetivos e claims de autenticação: admin gravou e leu a própria revisão; viewer e anônimo foram bloqueados; outro admin não leu nem gravou revisões do proprietário; ajuste sem texto foi rejeitado; UPDATE e DELETE não foram permitidos. Toda a transação de teste foi desfeita por ROLLBACK. O teste não criou sessões de login nem alterou usuários reais.

Conferência final: RLS ativa, duas políticas, SELECT/INSERT para authenticated sujeitos às políticas, sem SELECT para anon e zero registros de teste remanescentes. Não foi necessário novo deploy. Pendências locais são reenviadas ao carregar novamente a seção de diagnósticos.
