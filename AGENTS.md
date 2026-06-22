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
- **Service Role Key:** env var no Vercel (`SERVICE_ROLE_KEY`)
- **PAT:** gerar em `https://supabase.com/dashboard/account/tokens`

## Credenciais (salvas externamente, NÃO commitar)
- Supabase Anon Key: em `static/db.js`
- Supabase Service Role: em Vercel env vars
- Supabase PAT: gerar por sessão

## Estrutura de Scripts (ordem de carregamento)
```
auth.js → db.js → db-extra.js → perfis.js → globalFilters.js → scoring.js → gamificacao.js → metas.js → comparativos.js → colab-detail.js → painelLider.js → insights.js → alertas.js → tendencia.js → conquistas.js → projecao.js → historico.js → comentarios.js → feedbacks.js → anotacoes.js → tarefas.js → bonus.js → usuarios.js → app.js
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

## Arquitetura de Dados
- **Leitura:** localStorage primeiro (síncrono), Supabase atualiza em background
- **Escrita:** localStorage + Supabase em paralelo (app nunca quebra se Supabase offline)
- **Migração:** `migrateLocalToSupabase()` executa uma vez na primeira carga (flag `sistema_migrated_to_supabase_v1`)

## Funcionalidades Implementadas

### Abas
1. **Dashboard** — principal (chart + preview table)
2. **Gamificação** — ranking, medalhas, scoring rules
3. **Metas** — gestão de metas por colaborador/setor
4. **Comparativos** — comparar colaboradores lado a lado
5. **Painel do Líder** — Δ colunas, alertas inteligentes (score <4.5, quedas >30%, produtividade abaixo da média), atalho 👤
6. **Insights** — análise automática, cruzamento quantidade × qualidade, mini tabela mês a mês com Δ%
7. **Alertas** — notificações configuráveis
8. **Tendências** — médias móveis + projeção linear
9. **Conquistas** — badges por desempenho
10. **Projeção Mensal** — registro manual de dados futuros
11. **Histórico** — log de alterações
12. **Comentários** — anotações por período
13. **Feedbacks** — geração de sugestão automática + CRUD
14. **Anotações** — notas diárias privadas
15. **Tarefas** — agenda com prioridades e status
16. **Bônus** — pontos extras manuais (integra gamificação)
17. **Relatório Setorial** — visão por setor, Δ mês a mês, destaques, mini gráfico Chart.js
18. **Colaboradores** — cadastro com foto, aniversário, admissão, conduta
19. **Usuários** — gestão de acesso (admin/viewer)

### Recursos Transversais
- **Filtros Globais** — barra superior com período, setor, colaborador, score mínimo, meta, favoritos, pesquisa
- **Gerenciar Colaboradores** — botão "👥 Gerenciar colaboradores" na sidebar, overlay com checkboxes ativo/inativo, persistência localStorage + Supabase (`colab_inativos`)
- **Gerenciar Setores** — botão "🏢 Gerenciar setores" na sidebar, mesmo padrão dos colaboradores inativos (`setor_inativos`)
- **Exportar PNG** — html2canvas em relatório setorial
- **Modo Apresentação** — toggle na sidebar
- **Modo Reunião** — toggle que ativa apresentação + oculta dados sensíveis

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
- `migration.sql` — tabela `registros` + RLS
- `migration_v2.sql` — 7 tabelas base (metas, comentarios, historico, scoring_config, alertas_config, colaborador_fotos, colab_inativos) + RLS
- `migration_v3.sql` — tabela `feedbacks`
- `migration_v4.sql` — tabela `anotacoes_diarias`
- `migration_v5.sql` — tabela `tarefas`
- `migration_v6.sql` — tabela `pontos_extras`
- `migration_v7.sql` — tabela `colaboradores_info`
- `migration_v8.sql` — colunas `conduta_negativa` e `conduta_motivo` em `colaboradores_info`
- `migration_v9.sql` — coluna `mes` em `pontos_extras`
- `migration_v10.sql` — tabela `setor_inativos` + RLS

## Observações
- **Migration v10 (setor_inativos):** já executada no Supabase
- **Regra de scoring `pontos_extras`:** lê do localStorage `sistema_pontos_extras_v1`; defaultValue na config (padrão 1x) multiplica os pontos lançados
- **Integração gamificação:** ao salvar/excluir bônus, `renderGamification()` é chamado automaticamente

## Comandos Úteis
```bash
# Deploy
git add -A && git commit -m "mensagem" && git push && npx vercel --prod

# Ver status
git status
git log --oneline -5
```
