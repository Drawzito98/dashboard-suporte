# Roadmap de consolidação

Cada fase deve ter branch própria, diffs revisáveis e validação proporcional. Merge e deploy dependem de autorização explícita; não são consequência automática do push.

| Fase | Entrega e critério de saída | Estado |
|---|---|---|
| 1 — Foundation/Estabilização | baseline técnico, inventário, migrations documentadas, npm test agregado e cache verificável; validação registrada | Implementada em chore/foundation-estabilizacao (dee1cfb); resultados em testing-release.md |
| 2 — Shell e navegação | agrupar áreas por domínio, simplificar filtros/sidebar; validar todos os destinos e permissões | Implementada em feat/fase2-shell-navegacao; validação em navigation.md |
| 3 — Equipe 360º | centralizar visão da pessoa com vínculos explícitos; preservar históricos e fontes | Implementada em feat/fase3-equipe-360; validação em equipe-360.md |
| 4 — Dados | AppState/eventos/repositories graduais, Supabase oficial e cache/offline explícitos; validar falhas e troca de conta | Base integrada em feat/fase4-arquitetura-dados; adoção gradual documentada em data-architecture.md |
| 5 — Modularização | extrair responsabilidades de app.js/db-extra.js e carregar módulos sob demanda; preservar ordem/dependências | Implementada em refactor/fase5-modularizacao; contratos e limites em modularization.md |
| 6 — Design System / UX | tokens, controles, modais, tabelas, vazios, mobile e acessibilidade consistentes | Base implementada em feat/fase6-design-system; ciclo encerrado a pedido do usuário, refinamentos pendentes em design-system.md |
| 7 — Cockpit gerencial | pendências e alertas acionáveis com evidências e caminhos de resolução | Pendente |

## Continuidade

Antes de retomar: conferir status/origin/branch, ler estes documentos, executar npm test e consultar os commits. Atualizar o estado da fase e registrar limites conhecidos. Fase 1 não aplica migrations, não redesenha telas e não introduz framework, bundler ou alteração de scoring, permissões ou cálculo de ponto.
