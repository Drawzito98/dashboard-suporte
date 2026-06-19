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
- **Local:** `/home/ixcsoft/Área de trabalho/Meu app csv/Versão 27/`

## Supabase
- **URL:** `https://agvkmfusyetkicmuvumz.supabase.co`
- **Anon key:** hardcoded em `static/db.js` (pública por design)
- **Service Role Key:** env var no Vercel (`SERVICE_ROLE_KEY`)

## Estrutura de Scripts (ordem de carregamento)
```
auth.js → db.js → db-extra.js → perfis.js → globalFilters.js → scoring.js → gamificacao.js → metas.js → comparativos.js → colab-detail.js → painelLider.js → insights.js → alertas.js → tendencia.js → conquistas.js → projecao.js → historico.js → comentarios.js → feedbacks.js → anotacoes.js → tarefas.js → usuarios.js → app.js
```

## Tabelas Supabase
| Tabela | Finalidade | CRUD |
|---|---|---|
| `metas` | Metas por colaborador | `db-extra.js` |
| `comentarios` | Comentários por período | `db-extra.js` |
| `historico` | Histórico de alterações | `db-extra.js` |
| `scoring_config` | Regras de gamificação | `db-extra.js` |
| `alertas_config` | Config de alertas | `db-extra.js` |
| `colaborador_fotos` | Fotos dos colaboradores | `db-extra.js` |
| `colab_inativos` | Colaboradores inativos | `db-extra.js` |
| `feedbacks` | Feedbacks salvos | `db-extra.js` + `feedbacks.js` |
| `anotacoes_diarias` | Anotações diárias | `db-extra.js` + `anotacoes.js` |
| `tarefas` | Tarefas/agenda | `db-extra.js` + `tarefas.js` |

## Arquitetura de Dados
- **Leitura:** localStorage primeiro (síncrono), Supabase atualiza em background
- **Escrita:** localStorage + Supabase em paralelo (app nunca quebra se Supabase offline)
- **Migração:** `migrateLocalToSupabase()` executa uma vez na primeira carga (flag `sistema_migrated_to_supabase_v1`)

## Funcionalidades Implementadas

### Abas
1. **Dashboard** — principal (chart + preview table)
2. **Gamificação** — ranking, medalhas, scoring rules
3. **Metas** — gestão de metas por colaborador
4. **Comparativos** — comparar colaboradores
5. **Painel do Líder** — visão do líder
6. **Insights** — análises automáticas
7. **Alertas** — notificações configuráveis
8. **Tendências** — projeções
9. **Conquistas** — badges
10. **Projeção Mensal** — registro manual
11. **Histórico** — log de alterações
12. **Comentários** — anotações por período
13. **Feedbacks** — geração de sugestão + CRUD
14. **Anotações** — notas diárias
15. **Tarefas** — agenda com prioridades e status
16. **Usuários** — gestão de acesso

### Melhorias Visuais (commit `49de789`)
- **Zebrado:** `:nth-child(even)` em todas as tabelas
- **Variação %:** colunas "Var.%" após Finalizados e SCORE no preview table
- **Sparklines:** mini SVG inline após Finalizados (tendência 6 meses)

### Split View Feedbacks (commit `6124c86`)
- Grid 2 colunas: formulário (esq) + lista (dir)
- Filtro por colaborador na lista
- Fix: `container` escopo em `bindFbEvents`

### Responsividade (commit `121ffc2`)
- Tab-bar wrapping <768px
- Padding reduzido (sidebar, cards, overlays)
- Breakpoint 480px
- Tarefas form empilha

### Loading States (commit `9e61b49`)
- Skeleton CSS com shimmer animation
- Overlay spinner em `initDbExtra()`
- Skeleton nas tabs Feedbacks, Anotações, Tarefas

### Tabelas Compactas (commit `6b28fca`)
- Botão "📏 Visão compacta" na sidebar
- Reduz padding e fonte das tabelas
- Persiste em localStorage

## Regras de Negócio
- **Transferências:** neutras na gamificação (defaultValue: 0) e feedbacks (dado informativo sem rating) — pois são frequentemente legítimas (redirecionamento ao setor correto)
- **Feedbacks privados:** RLS com `auth.uid() = user_id`
- **Anotações e Tarefas:** também privadas por `user_id`
- **Viewers:** role `viewer` esconde edição/admin

## Migrations
- `migration_v2.sql` — 7 tabelas base + RLS
- `migration_v3.sql` — tabela `feedbacks`
- `migration_v4.sql` — tabela `anotacoes_diarias`
- `migration_v5.sql` — tabela `tarefas`

## Comandos Úteis
```bash
# Deploy
git add -A && git commit -m "mensagem" && git push && npx vercel --prod

# Ver status
git status
git log --oneline -5
```
