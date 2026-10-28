# Roadmap de consolidação

Cada fase deve ter branch própria, diffs revisáveis e validação proporcional. Merge e deploy dependem de autorização explícita; não são consequência automática do push.

| Fase | Entrega e critério de saída | Estado |
|---|---|---|
| 1 — Foundation/Estabilização | baseline técnico, inventário, migrations documentadas, npm test agregado e cache verificável; validação registrada | Implementada nesta branch; resultados em testing-release.md |
| 2 — Shell e navegação | agrupar áreas por domínio, simplificar filtros/sidebar; validar todos os destinos e permissões | Pendente |
| 3 — Equipe 360º | centralizar visão da pessoa com vínculos explícitos; preservar históricos e fontes | Pendente |
| 4 — Dados | AppState/eventos/repositories graduais, Supabase oficial e cache/offline explícitos; validar falhas e troca de conta | Pendente |
| 5 — Modularização | extrair responsabilidades de app.js/db-extra.js e carregar módulos sob demanda; preservar ordem/dependências | Pendente |
| 6 — Design System / UX | tokens, controles, modais, tabelas, vazios, mobile e acessibilidade consistentes | Pendente |
| 7 — Cockpit gerencial | pendências e alertas acionáveis com evidências e caminhos de resolução | Pendente |

## Continuidade

Antes de retomar: conferir status/origin/branch, ler estes documentos, executar npm test e consultar os commits. Atualizar o estado da fase e registrar limites conhecidos. Fase 1 não aplica migrations, não redesenha telas e não introduz framework, bundler ou alteração de scoring, permissões ou cálculo de ponto.
