# Roadmap de consolidação

Cada fase deve ter branch própria, diffs revisáveis e validação proporcional. Merge e deploy dependem de autorização explícita; não são consequência automática do push.

| Fase | Entrega e critério de saída | Estado |
|---|---|---|
| 1 — Foundation/Estabilização | baseline técnico, inventário, migrations documentadas, npm test agregado e cache verificável; validação registrada | Implementada em chore/foundation-estabilizacao (dee1cfb); resultados em testing-release.md |
| 2 — Shell e navegação | agrupar áreas por domínio, simplificar filtros/sidebar; validar todos os destinos e permissões | Implementada em feat/fase2-shell-navegacao; validação em navigation.md |
| 3 — Equipe 360º | centralizar visão da pessoa com vínculos explícitos; preservar históricos e fontes | Implementada em feat/fase3-equipe-360; validação em equipe-360.md |
| 4 — Dados | AppState/eventos/repositories graduais, Supabase oficial e cache/offline explícitos; validar falhas e troca de conta | Base integrada em feat/fase4-arquitetura-dados; adoção nos módulos complementares ainda pendente; ver data-architecture.md e revisao-pos-roadmap.md |
| 5 — Modularização | extrair responsabilidades de app.js/db-extra.js e carregar módulos sob demanda; preservar ordem/dependências | Implementada em refactor/fase5-modularizacao; carga inicial/globais ainda em consolidação; ver modularization.md e revisao-pos-roadmap.md |
| 6 — Design System / UX | tokens, controles, modais, tabelas, vazios, mobile e acessibilidade consistentes | Concluída em feat/fase6-design-system (1.19.1); CSS/modais e auditoria ampla ainda em consolidação; ver design-system.md e revisao-pos-roadmap.md |
| 7 — Cockpit gerencial | pendências e alertas acionáveis com evidências e caminhos de resolução | Implementada em feat/fase7-cockpit-gerencial (1.20.0); contratos, validação e limites em cockpit.md |

## Continuidade

Antes de retomar: conferir status/origin/branch, ler estes documentos, executar npm test e consultar os commits. Atualizar o estado da fase e registrar limites conhecidos. Fase 1 não aplica migrations, não redesenha telas e não introduz framework, bundler ou alteração de scoring, permissões ou cálculo de ponto.

## Revisão após as sete entregas

As entregas funcionais não encerram toda a consolidação original. Pendências, evidências e prioridades estão em [revisao-pos-roadmap.md](revisao-pos-roadmap.md). Prioridade: confirmação de gravação dos módulos legados e contexto único das análises. Panorama parcial retirado da tela setorial em 1.20.1; reuso depende de definir o CSV.

### Continuação 1.21.0

Feedbacks/metas com confirmação, rascunhos e operações por item; Relatório Setorial com filtros globais como contexto único. Ver [confirmacao-e-contexto.md](confirmacao-e-contexto.md). Próximos escopos: demais escritas complementares e revisão das entradas de Operação/Pessoas, incluindo a localização das metas.

### Continuação 1.22.0

Organização de Operação e acesso às metas implementados: Visão geral, Análises com três visualizações e Metas. O editor deixa de depender de um container apenas de teste. Ver [operacao-e-metas.md](operacao-e-metas.md). Continuidade: caminhos de Pessoas/Equipe, demais escritas complementares, redução da carga inicial e consolidação de CSS.

## Continuação 1.23.0

Simplificação de Pessoas e ações individuais implementadas. Confirmação dos demais salvamentos complementares, redução de scripts iniciais e consolidação de CSS continuam pendentes. Ver [pessoas-equipe360.md](pessoas-equipe360.md).

## Continuação 1.24.0

Confirmação de salvamento de avaliações implementada, com rascunhos e retentativa. Próximos domínios devem ser revisados individualmente (tarefas/anotações e demais cadastros), além das pendências de carga inicial/CSS. Ver [avaliacoes-confirmadas.md](avaliacoes-confirmadas.md).

## Continuação 1.25.0

Tarefas/anotações passam a ter confirmação, rascunhos privados e retentativa estável de recorrência; atividades compartilhadas são protegidas. Ver [rotina-confirmada.md](rotina-confirmada.md). Demais cadastros, carga inicial/globais e CSS continuam em consolidação; Panorama permanece desativado.

## Continuação 1.26.0 — Cadastro

Cadastro de colaboradores, foto e reativação na criação exigem confirmação, com rascunho privado e falhas parciais explícitas. A cópia privada anterior é preservada separadamente. Ver [cadastro-confirmado.md](cadastro-confirmado.md). Bônus, regras, presença e gerenciadores de inativos ainda aguardam revisão; carga inicial/CSS e Panorama mantêm os limites documentados.

## Continuação 1.27.0 — Bônus e penalidades

Bônus/penalidades com confirmação, rascunho privado, UUID/sinal estáveis e mês preservado na recarga. Acesso disponível em Pessoas → Equipe, sem reintroduzir a tela de Gamificação. Ver [bonus-confirmados.md](bonus-confirmados.md). Os demais domínios, carga inicial/CSS e Panorama mantêm as pendências documentadas.

## Continuação 1.28.0 — Férias e ausências

Confirmação, rascunhos e conferência de criações incertas implementadas, respeitando IDs numéricos existentes. Exclusões sobrepostas informam confirmações parciais. Ver [presenca-confirmada.md](presenca-confirmada.md). Retomar pelas pendências e verificações visuais ali registradas; sem merge ou SQL.

## Continuação 1.29.0 — Regras

Quadro com gravações confirmadas e rascunho privado; compartilhamento/autoria preservados, movimento separado de texto. Contratos, validação e limites em [regras-confirmadas.md](regras-confirmadas.md). Comentários e demais domínios continuam pendentes.

## Continuação 1.30.0 — Comentários

Comentários por período com confirmação, UUID estável e rascunho privado; compartilhamento existente preservado. Contratos, validação e limites em [comentarios-confirmados.md](comentarios-confirmados.md). Próximos: gerenciadores de inativos e demais gravações legadas.

## Continuação 1.31.0 — Ativos/inativos

Gerenciadores com confirmação individual, escolhas privadas e publicação de filtros após confirmação; sem substituição de coleção. Contratos, testes e limites em [inativos-confirmados.md](inativos-confirmados.md). Próximos: configurações e demais gravações legadas.

## Continuação 1.32.0 — Configurações

Pontuação e alertas com rascunhos separados, salvamento confirmado e nenhuma gravação durante leitura/renderização. Contratos, validação e limites em [configuracoes-confirmadas.md](configuracoes-confirmadas.md). Próximos: demais gravações legadas de atendimento/acompanhamento.
