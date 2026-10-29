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
- Indicadores: RecordsRepository/AppState, servidor como fonte oficial, cache privado e fila por revisão; resposta vazia é autoritativa.
- Complementares: fachada db-extra e repositories por domínio, com confirmação/fila ainda não uniformes; ver docs/data-architecture.md.
- Sem migração automática de dados legados sem dono. PDI continua local por conta/dispositivo.

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

Leia `docs/architecture.md`, `docs/feature-inventory.md`, `docs/roadmap.md`, `docs/testing-release.md` e `docs/migrations.md` antes de mudanças estruturais. As listas acima são históricas e parciais. APP_VERSION atual: 1.21.0. Preserve modificações locais, confira origin e trabalhe em branch dedicada. `npm test` agrega a suíte síncrona, checks assíncronos e validação de cache; após mudanças em assets, execute `npm run release:cache`. Merge/deploy exigem autorização explícita. Não aplicar migrations como parte de testes locais.

## Fase 2 — Navegação

Consulte `docs/navigation.md`. `shell.js` organiza as quatro áreas e ferramentas; `app.js` mantém callbacks de ativação. Preserve IDs/data-tab e restrições por papel. Não reintroduzir os antigos organizadores de sidebar/menu mobile. Antes de mudar o shell, execute também a fixture `tests/shell.browser.html` em desktop e celular. CSS legado ainda existe e será consolidado na Fase 6.

## Fase 3 — Equipe 360º

Leia `docs/equipe-360.md` antes de alterar perfis. `equipe360-data.js` é somente leitura, paginado, com sessão e identidade exatas; `equipe360.js` apresenta as fontes e usa os editores atuais. Não adicionar fallback de caches privados globais nem unir variantes de nome automaticamente. PDI permanece local e por usuário. Execute `npm test` e a fixture `tests/equipe360.browser.html` (desktop/celular); mudanças em Ponto/PDI/Atividades também exigem as fixtures desses módulos.

## Fase 4 — Dados

Leia `docs/data-architecture.md`. Use `appStorage` nos módulos; localStorage nativo fica restrito ao runtime (ou preferências públicas antes do bootstrap). Nunca adotar automaticamente chaves antigas sem dono. Indicadores usam RecordsRepository/AppState; resposta vazia do servidor é válida. Invalide operações na troca de sessão. Não reintroduza upload automático na inicialização ou DELETE durante deduplicação de leitura. A fila durável por revisão cobre indicadores; migre outros módulos gradualmente com confirmação explícita de escrita. Rode npm test e `tests/data-lifecycle.browser.html` para mudanças de dados/sessão.

## Fase 5 — Modularização

Leia `docs/modularization.md`. O manifest declara dependências, estilos e exports das áreas sob demanda; preserve as pontes públicas e a inicialização após DOMContentLoaded. Funções de persistência permanecem na fachada db-extra, com implementações em repositories por domínio. Não adicionar migração automática. Execute npm test, a fixture lazy-modules.browser.html e as fixtures das áreas afetadas; regenere o cache incluindo assets dinâmicos.

## Fase 6 — Base visual e continuidade

Leia docs/design-system.md antes de retomar. Fase concluída em 1.19.1; o cockpit da Fase 7 está documentado abaixo. A conclusão 1.19.1 foi publicada com autorização antes da Fase 7. Tokens/componentes compartilhados ficam em css/tokens.css e css/components.css; navegação em shell.css. ui-accessibility.js é o proprietário de teclado/foco dos overlays. Preserve guards, close handlers e semântica de tabelas. Rode npm test e fixtures de design-system, shell, workspace-ux e áreas afetadas em desktop/celular. A validação de contraste é amostral.

## Fase 7 — Cockpit gerencial

Leia docs/cockpit.md. HomeCockpit usa AppState/appStorage da conta e CockpitEngine, que reutiliza DiagnosticoEngine. Período padrão é o último mês encerrado com registros; filtros explícitos prevalecem. Ausência não é zero; não ponderar Score por volume nem rankear níveis por produtividade. Tarefas/agenda são da conta e de hoje, separadas do filtro temporal dos indicadores. Atualizar dados é somente leitura; preserve a proteção de sessão e os editores originais. Execute npm test e workspace-ux.browser.html?cockpit=1 (também &race=1), além das regressões em desktop/celular. O roadmap de sete fases está entregue nos escopos documentados; adoção gradual e limites continuam registrados.

## Revisão 1.20.1 — Panorama e continuidade

Leia docs/revisao-pos-roadmap.md. Panorama parcial foi retirado do HTML e dos recursos do bundle interno panorama, que agora serve apenas o Relatório Setorial. Preserve os arquivos/testes isolados para eventual realocação após definir o CSV. Não reativar automaticamente esse bloco. As sete entregas não encerram toda a consolidação: confirmar escritas dos complementares, reduzir carga inicial/globais e unificar contexto de análise são prioridades. Merge continua dependendo de autorização explícita.

## Continuação 1.21.0

Leia docs/confirmacao-e-contexto.md. Feedbacks/metas exigem IDs confirmados, UUID estável do rascunho e sessão atual; não reintroduzir salvamento otimista nem DELETE da coleção de metas. dbMetasSave faz upsert somente dos itens enviados, dbMetasDelete exclui por ID. A serialização é local; não alegar trava entre dispositivos/fila automática. Relatório Setorial usa apenas globalFilters e os meses presentes no recorte, sem filtros locais nem truncamento silencioso. Rode npm test, workspace-ux.browser.html (também ?saves=1), lazy-modules e data-lifecycle em desktop/celular. O editor de metas ainda não tem destino no shell; não adicioná-lo silenciosamente como parte de correções de persistência.
