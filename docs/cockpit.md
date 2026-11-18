# Fase 7 — Cockpit gerencial

Versão 1.20.0, branch feat/fase7-cockpit-gerencial, baseada em c4c782a (conclusão da Fase 6). A Fase 6 foi publicada antes desta implementação, no deployment dpl_9qEXwPMTG4bMT4PaunZvCiLcPTbK, e seu HTML/assets foram conferidos por hash na URL de produção. O usuário autorizou commit/deploy e continuidade para esta fase. Não houve merge.

## Experiência

A Home começa pelo contexto e briefing, com atalhos para tarefas e alertas. Abaixo ficam os indicadores, duas filas acionáveis, a visão das equipes por nível, as fontes/limitações, agenda, ações rápidas e tendência de seis meses do calendário. No celular, KPIs ficam em duas colunas e as filas em uma coluna.

Sem filtro temporal explícito, o cockpit escolhe o último mês encerrado que tenha registros no recorte. Se só existir o mês atual, usa-o com aviso de período parcial; dados apenas futuros não viram referência automática. Intervalos e meses específicos dos filtros globais são respeitados, inclusive quando não têm registros. O mês em andamento não substitui automaticamente um histórico encerrado disponível.

Setor, nível, colaborador, busca e inativos seguem o filtro existente. Tarefas e agenda abrangem a conta e a data de hoje, independentemente do período/setor dos indicadores; isso fica indicado na tela.

## Evidências e ações

- A fila de rotina mostra até seis tarefas vencidas ou para hoje, ordenadas por prazo. Concluídas/canceladas ficam fora; recorrências usam a próxima data válida de verificação. Sem prazo não é atraso. Abrir tarefa leva à Rotina e foca o registro exato, sem concluir ou editar automaticamente.
- A fila de investigação mostra até seis vínculos pessoa/setor/nível, com evidências de Score/meta, recorrência ou tempos, fornecidas por DiagnosticoEngine. Vários achados do mesmo vínculo aparecem em um cartão. A contagem de vínculos não equivale à de pessoas.
- Analisar pessoa abre a identidade exata na seção Desempenho da Equipe 360º; suas fontes/histórico continuam no perfil existente. Não cria novos vínculos por nome parecido.
- Abrir diagnóstico deste período aplica explicitamente os meses do cockpit aos filtros visíveis e abre Acompanhamento da equipe. Setor, nível e busca permanecem.
- A tabela de equipes separa níveis, informa pessoas com nota e volume descritivo; não cria ranking de produtividade entre N1 e N2. A investigação continua sendo revisão humana, sem alterar avaliação, metas ou status automaticamente.

## Indicadores e cobertura

A Home passou a reutilizar a metodologia do diagnóstico: média simples de Score por pessoa, sem usar Finalizados ou Total como peso. Isso substitui a antiga média de linhas da Home. Meta oficial 4,70 e regras do diagnóstico não foram alteradas. Ausência, valor inválido e nota explícita zero são distintos. CADU e agregados são excluídos da análise de pessoas.

As tendências usam seis meses do calendário, exibindo lacunas como null, sem inventar zeros. Volume com campos ausentes permanece sem informação. Os avisos incluem período parcial/futuro, lacunas, referência antiga, notas ausentes, cobertura da exportação não comprovada, cache e alterações de indicadores ainda não confirmadas. O cockpit não afirma que a operação está saudável apenas por não encontrar alertas.

Se o CSV preencher zero onde deveria haver ausência, esse zero continua sendo um valor explícito; não há evidência para reinterpretá-lo automaticamente. Confirmar quantidade de avaliações e contexto segue necessário.

## Organização e sessão

cockpit-engine.js é puro e somente leitura, reutilizando DiagnosticoEngine. cockpit.js adapta AppState/appStorage, normalização/deduplicação existentes, HTML e ações. cockpit.css usa os tokens compartilhados. home.js preserva seus nomes públicos, modais, agenda, ações e gráfico, delegando contexto e decisão ao módulo novo. DiagnosticoEngine carrega antes de CockpitEngine e Home.

Atualizar dados consulta indicadores, tarefas, férias e cadastro. Não chama fila de envio nem métodos de edição. Usa apenas dados da sessão ativa e descarta retorno após invalidação. O evento app-extra-data-loaded informa que os loaders iniciais terminaram; não promete sucesso remoto de todas as fontes. Eventos de dados/conexão atualizam a Home ativa; um modal aberto adia a reconstrução para não interromper a interação.

A fonte dos indicadores vem do repository: servidor, cache/indisponibilidade ou ainda não confirmada. Tarefas e agenda usam a projeção privada da conta; os loaders antigos podem retornar cache em falhas e não fornecem status remoto individual completo. Portanto a tela não declara sincronização uniforme de todos os módulos. Sem sessão, o modelo é vazio. Não há leitura de chaves legadas sem dono ou nova migração.

## Validação

- npm test: 171 testes do runner e todos os checks, incluindo cockpit-engine.check.js. Casos de período encerrado/parcial, filtros explícitos, notas vazias/zero/meta, níveis, CADU/agregados, lacunas, recorrência, tarefas, cache e imutabilidade.
- workspace-ux.browser.html?cockpit=1: HTML completo, bibliotecas reais e backend simulado. Exercita referência encerrada com mês atual disponível, ausência de nota, evidências escapadas, perfil exato em Desempenho, tarefa focada, diagnóstico com o período preservado, filtros, cache, vazio autoritativo e atualização sem insert/update/upsert/delete.
- Acrescentar &race=1 testa a invalidação durante uma consulta pendente: resposta atrasada não repopula AppState/modelo nem reabre a aplicação. O cenário congela somente a data civil de referência (28/10/2026); a temporização das bibliotecas permanece real.
- Cockpit validado em 320/390/1440px, com amostras nos temas claro/escuro. Shell, perfil, PDI, Ponto, diagnóstico, Panorama/filtros e lazy modules passaram nas verificações de regressão. O workspace padrão também passou com gráficos reais, PNG, CSV, HTML de impressão e editores.
- Identidade de cache determinística cobre 114 arquivos; scripts com sintaxe válida e git diff --check sem erros.

As fixtures só executam em localhost e não consultam/escrevem dados de produção. Não houve aplicação de SQL ou alteração de RLS. Testes no Chromium integrado não substituem auditoria WCAG completa, leitor de tela, revisão em Safari/Firefox ou validação de todas as integrações do servidor.

## Continuidade

A entrega do cockpit encerra as sete fases deste roadmap em seus escopos documentados. Adoção dos repositories/eventos pelos módulos antigos, CSS remanescente e confirmação remota individual das fontes continuam graduais, conforme os limites das fases anteriores. Melhorias futuras devem partir de uso real e de problemas observados, com branches e validação proporcionais.
