# Dashboard de Suporte — Contexto do Projeto

## Stack
- **Front:** HTML + CSS + Vanilla JS (sem framework)
- **Charts:** Chart.js
- **Backend:** Vercel Serverless (`api/users.js`)
- **Database:** Supabase (PostgreSQL) + localStorage como fallback síncrono
- **Auth:** Supabase Email/Password (sem confirmação)

## Deploy
- **URL:** https://dashboard-suporte-iota.vercel.app
- **Vercel:** `andre-tavares/dashboard-suporte`
- **Repositório:** `https://github.com/Drawzito98/dashboard-suporte` (branch `main`)
- **Local:** `/home/ixcsoft/dashboard-suporte/`

## Supabase
- **URL:** `https://agvkmfusyetkicmuvumz.supabase.co`
- **Anon key:** hardcoded em `static/db.js` (pública por design)
- **Supabase URL:** lê de `SUPABASE_URL` env var no Vercel (fallback hardcoded)
- **Service Role Key:** env var no Vercel (`SERVICE_ROLE_KEY`)
- **PAT:** gerar em `https://supabase.com/dashboard/account/tokens`

## Credenciais (salvas externamente, NÃO commitar)
- Supabase Anon Key: em `static/db.js`
- Supabase Service Role: em Vercel env vars
- Supabase PAT: gerar por sessão

## Estrutura de Scripts (ordem de carregamento)
```
auth.js → db.js → db-extra.js → perfis.js → globalFilters.js → scoring.js → gamificacao.js → metas.js → comparativos.js → colab-detail.js → painelLider.js → insights.js → alertas.js → conquistas.js → projecao.js → historico.js → comentarios.js → notificacoes.js → feedbacks.js → anotacoes.js → tarefas.js → bonus.js → relatorio-setorial.js → avaliacao.js → colaboradores.js → usuarios.js → csv-validator.js → csv-import.js → reports.js → app.js
```

## Tabelas Supabase
| Tabela | Finalidade | CRUD |
|---|---|---|
| `registros` | Dados de desempenho (CSV) | `app.js` |
| `metas` | Metas por colaborador | `db-extra.js` |
| `comentarios` | Comentários por período | `db-extra.js` |
| `historico` | Histórico de alterações | `db-extra.js` |
| `scoring_config` | Regras de gamificação | `db-extra.js` |
| `alertas_config` | Config de alertas | `db-extra.js` |
| `colaborador_fotos` | Fotos dos colaboradores | `db-extra.js` |
| `colab_inativos` | Colaboradores inativos | `db-extra.js` + `app.js` |
| `setor_inativos` | Setores inativos | `db-extra.js` + `app.js` |
| `feedbacks` | Feedbacks salvos | `db-extra.js` + `feedbacks.js` |
| `anotacoes_diarias` | Anotações diárias | `db-extra.js` + `anotacoes.js` |
| `tarefas` | Tarefas/agenda | `db-extra.js` + `tarefas.js` |
| `pontos_extras` | Bônus manuais | `db-extra.js` + `bonus.js` |
| `colaboradores_info` | Cadastro de colaboradores | `db-extra.js` + `colaboradores.js` |
| `avaliacoes` | Avaliações de desempenho | `avaliacao.js` |
| `notificacoes` | Notificações audit trail | `notificacoes.js` |

## Arquitetura de Dados
- **Leitura:** localStorage primeiro (síncrono), Supabase atualiza em background
- **Escrita:** localStorage + Supabase em paralelo (app nunca quebra se Supabase offline)
- **Migração:** `migrateLocalToSupabase()` executa uma vez na primeira carga (flag `sistema_migrated_to_supabase_v1`)

## Funcionalidades Implementadas

### Abas
1. **Dashboard** — principal (chart + preview table, relatório executivo)
2. **Relatório Setorial** — visão por setor, Δ mês a mês, destaques, mini gráfico Chart.js, exportar PNG
3. **Gamificação** — ranking, medalhas, scoring rules, gestão de metas, bônus/penalidades
4. **Tarefas** — agenda com prioridades e status
5. **Anotações** — notas diárias privadas
6. **Colaboradores** — cadastro com foto, aniversário, admissão, conduta
7. **Liderança** — Δ colunas, alertas inteligentes (score <4.5, quedas >30%, produtividade abaixo da média)
8. **Insights** — análise automática, cruzamento quantidade × qualidade, mini tabela mês a mês, alertas configuráveis
9. **Avaliação** — avaliação de desempenho (14 competências) + geração de feedback textual
10. **Usuários** — gestão de acesso (admin/viewer)

### Recursos Transversais
- **Filtros Globais** — barra superior com período, setor, colaborador, score mínimo, meta, favoritos, pesquisa
- **Gerenciar Colaboradores** — botão "👥 Gerenciar colaboradores" na sidebar, overlay com checkboxes ativo/inativo, persistência localStorage + Supabase (`colab_inativos`)
- **Gerenciar Setores** — botão "🏢 Gerenciar setores" na sidebar, mesmo padrão dos colaboradores inativos (`setor_inativos`)
- **Exportar PNG** — html2canvas em relatório setorial
- **Modo Apresentação** — toggle na sidebar
- **Modo Reunião** — toggle que ativa apresentação + oculta dados sensíveis

### Mobile / PWA
- Layout responsivo até ~900px: topbar compacta, menu hambúrguer (gaveta lateral), barra de abas fixa no topo, filtros empilhados, modais como bottom sheet e tabelas com scroll horizontal
- Instalável como app: `manifest.json` + service worker (`sw.js`)
- Ícones PWA em `static/icons/` (icon-192/512, apple-touch-icon 180, icon-48)
- Service worker: network-first em navegação, stale-while-revalidate em estáticos, nunca intercepta `/api/*`; versão via `CACHE` em `sw.js` (bump ao mudar estáticos)
- Drawer: `body.sidebar-open` (JS em `app.js` — `initMobileMenu`)

## Regras de Negócio
- **Nota baixa:** penalidade aplicada para score < 4.5
- **Bônus manuais:** regra `pontos_extras` no scoring — soma manual × defaultValue da config
- **Transferências:** neutras na gamificação (defaultValue: 0) e feedbacks
- **Feedbacks privados:** RLS com `auth.uid() = user_id`
- **Anotações e Tarefas:** também privadas por `user_id`
- **Viewers:** role `viewer` esconde edição/admin
- **Setores inativos:** ocultados dos filtros, relatórios e análises via `isSetorActive()`
- **Colaboradores inativos:** mesmo padrão via `isColabActive()`

## Migrations

Consulte `docs/migrations.md` para a sequência até v49. Não presumir aplicação em produção pela existência do arquivo. A antiga lista parcial foi substituída pelo catálogo baseado no conteúdo dos SQLs.

## Observações

- A regra `pontos_extras` usa configuração e persistência existentes; não alterar durante estabilização.
- Ao salvar/excluir bônus, a integração atual atualiza a gamificação.

## Comandos Úteis
```bash
# Publicação somente com autorização explícita; nunca encadear push com deploy.

# Testes
npm test

# Ver status
git status
git log --oneline -5
```

## Baseline e continuidade (28/10/2026)

Leia `docs/architecture.md`, `docs/feature-inventory.md`, `docs/roadmap.md`, `docs/testing-release.md` e `docs/migrations.md` antes de mudanças estruturais. As listas acima são históricas e parciais. APP_VERSION atual: 1.19.1. Preserve modificações locais, confira origin e trabalhe em branch dedicada. `npm test` agrega a suíte síncrona, checks assíncronos e validação de cache; após mudanças em assets, execute `npm run release:cache`. Merge/deploy exigem autorização explícita. Não aplicar migrations como parte de testes locais.

## Fase 2 — Navegação

Consulte `docs/navigation.md`. `shell.js` organiza as quatro áreas e ferramentas; `app.js` mantém callbacks de ativação. Preserve IDs/data-tab e restrições por papel. Não reintroduzir os antigos organizadores de sidebar/menu mobile. Antes de mudar o shell, execute também a fixture `tests/shell.browser.html` em desktop e celular. CSS legado ainda existe e será consolidado na Fase 6.

## Fase 3 — Equipe 360º

Leia `docs/equipe-360.md` antes de alterar perfis. `equipe360-data.js` é somente leitura, paginado, com sessão e identidade exatas; `equipe360.js` apresenta as fontes e usa os editores atuais. Não adicionar fallback de caches privados globais nem unir variantes de nome automaticamente. PDI permanece local e por usuário. Execute `npm test` e a fixture `tests/equipe360.browser.html` (desktop/celular); mudanças em Ponto/PDI/Atividades também exigem as fixtures desses módulos.

## Fase 4 — Dados

Leia `docs/data-architecture.md`. Use `appStorage` nos módulos; localStorage nativo fica restrito ao runtime (ou preferências públicas antes do bootstrap). Nunca adotar automaticamente chaves antigas sem dono. Indicadores usam RecordsRepository/AppState; resposta vazia do servidor é válida. Invalide operações na troca de sessão. Não reintroduza upload automático na inicialização ou DELETE durante deduplicação de leitura. A fila durável por revisão cobre indicadores; migre outros módulos gradualmente com confirmação explícita de escrita. Rode npm test e `tests/data-lifecycle.browser.html` para mudanças de dados/sessão.

## Fase 5 — Modularização

Leia `docs/modularization.md`. O manifest declara dependências, estilos e exports das áreas sob demanda; preserve as pontes públicas e a inicialização após DOMContentLoaded. Funções de persistência permanecem na fachada db-extra, com implementações em repositories por domínio. Não adicionar migração automática. Execute npm test, a fixture lazy-modules.browser.html e as fixtures das áreas afetadas; regenere o cache incluindo assets dinâmicos.

## Fase 6 — Base visual e continuidade

Leia docs/design-system.md antes de retomar. Fase concluída em 1.19.1; o roadmap aponta a Fase 7 como próxima. A primeira entrega 1.19.0 foi publicada; a conclusão registra commit/push sem novo deploy. Tokens/componentes compartilhados ficam em css/tokens.css e css/components.css; navegação em shell.css. ui-accessibility.js é o proprietário de teclado/foco dos overlays. Preserve guards, close handlers e semântica de tabelas. Rode npm test e fixtures de design-system, shell, workspace-ux e áreas afetadas em desktop/celular. A validação de contraste é amostral.
