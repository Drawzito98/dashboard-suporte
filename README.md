# Dashboard de Suporte

App de dashboard para análise de indicadores de suporte, com autenticação Supabase, gestão de usuários com papéis (admin/viewer), gamificação, relatórios inteligentes, e deploy no Vercel.

**Versão atual:** `1.7.0` (constante `APP_VERSION` em `static/app.js`)

## Changelog

| Versão | Data | Alterações |
|--------|------|------------|
| 1.7.0 | 24/07/2026 | CSS: fontes aumentadas ~1-2px em todo o app para legibilidade em Full HD (root 14→15px, KPIs 24→26px, labels 10→11px, badges 11→12px, tabs 12→13px, forms/btns 13→14px) |
| 1.1.0 | 22/07/2026 | CSS: variáveis quebradas definidas (`--primary`, `--bg`, `--bg-elevated`, `--border-color`); syntax error corrigido;6 regras `!important` eliminadas; font sizes fracionários padronizados; label de versão discreto na sidebar |
| 1.0.0 | — | Versão inicial |

## Stack

- **Frontend:** HTML/CSS/JS vanilla (SPA, 29 módulos, sem build step)
- **Backend:** Supabase (Auth, PostgreSQL, RLS, REST API)
- **Deploy:** Vercel (static + serverless functions)
- **Charts:** Chart.js (CDN)
- **CSV parse:** PapaParse (CDN) + fallback nativo
- **PDF:** jsPDF + html2canvas (CDN)

## Deploy

- **URL:** https://dashboard-suporte-iota.vercel.app
- **Vercel project:** `andre-tavares/dashboard-suporte`
- **Git remote:** `origin` → `https://github.com/Drawzito98/dashboard-suporte`
- **Branch:** `main`
- **Deploy manual:** `git push origin main && npx vercel deploy --prod --yes`

## Supabase

- **URL:** https://agvkmfusyetkicmuvumz.supabase.co
- **Dashboard:** https://supabase.com/dashboard/project/agvkmfusyetkicmuvumz
- **Anon key:** `static/db.js` (pública por design — RLS bloqueia)
- **Service role key:** env var `SERVICE_ROLE_KEY` no Vercel 🔐
- **Supabase URL:** env var `SUPABASE_URL` no Vercel (fallback hardcoded)
- **Auth:** Email/Password (confirmação de email **desabilitada**)

### Tabelas

| Tabela | Finalidade | RLS |
|---|---|---|
| `registros` (importacoes) | Dados CSV importados | Por `user_id` |
| `metas` | Metas manuais/configuradas | Por `user_id` |
| `comentarios` | Anotações mensais | Authenticated |
| `historico` | Audit log de alterações | Authenticated |
| `scoring_config` | Regras de pontuação (1 row/user) | Por `user_id` |
| `alertas_config` | Configuração de alertas (1 row/user) | Por `user_id` |
| `colaborador_fotos` | URLs de fotos dos colaboradores | Authenticated |
| `colab_inativos` | Colaboradores inativos por usuário | Por `user_id` |
| `setor_inativos` | Setores inativos por usuário | Por `user_id` |
| `feedbacks` | Feedbacks e avaliações por colaborador | Por `user_id` |
| `anotacoes_diarias` | Anotações diárias privadas | Por `user_id` |
| `tarefas` | Tarefas/agenda com prioridades | Por `user_id` |
| `pontos_extras` | Bônus/penalidades manuais | Por `user_id` |
| `colaboradores_info` | Dados cadastrais (aniversário, admissão, observações, conduta) | Por `user_id` |
| `avaliacoes` | Avaliações de desempenho (14 competências) | Por `user_id` |
| `notificacoes` | Notificações de audit trail | Authenticated |

### Migrations (executar no SQL Editor do Supabase)

| Migration | Conteúdo |
|---|---|
| `migration.sql` | Tabela `registros` + RLS |
| `migration_v2.sql` | 7 tabelas extras + RLS (19/06) |
| `migration_v3.sql` | Tabela `feedbacks` + RLS |
| `migration_v4.sql` | Tabela `anotacoes_diarias` + RLS |
| `migration_v5.sql` | Tabela `tarefas` + RLS |
| `migration_v6.sql` | Tabela `pontos_extras` + RLS |
| `migration_v7.sql` | Tabela `colaboradores_info` + RLS |
| `migration_v8.sql` | Colunas `conduta_negativa` / `conduta_motivo` em `colaboradores_info` |
| `migration_v9.sql` | Coluna `mes` em `pontos_extras` |
| `migration_v10.sql` | Tabela `setor_inativos` + RLS |
| `migration_v11.sql` | Tabela `notificacoes` + RLS |
| `migration_v12.sql` | Tabela `avaliacoes` + RLS |

### RLS Policies

Tabelas com `user_id`: SELECT/INSERT/UPDATE/DELETE restritos ao próprio `auth.uid()`.
Tabelas compartilhadas (comentarios, historico, colaborador_fotos): acesso a todo `auth.role() = 'authenticated'`.

## Recursos

### Abas (ordem da tab-bar)

1. **📊 Dashboard** — gráfico de desempenho (ranking por colaborador ou evolução mensal), tabela detalhada com edição inline, filtros por setor/mês/colaborador/arquivo, busca textual, relatório executivo com ✅ destaques e ⚠️ pontos de atenção, exportação para PDF
2. **📊 Relatório Setorial** — visão por setor, Δ mês a mês, destaques, mini gráfico Chart.js, exportar PNG
3. **🏆 Gamificação** — ranking com pontuação total, pódio, evolução individual por mês, heatmap de desempenho, medalhas por conquistas, scoring rules, gestão de metas, bônus/penalidades
4. **📅 Tarefas** — agenda com prioridades (alta/média/baixa) e status (pendente/andamento/concluído)
5. **📝 Anotações** — notas diárias privadas
6. **👥 Colaboradores** — gestão de cadastro (foto, aniversário, admissão, email, tarefas, objetivos, observações, conduta), relatório de desempenho individual
7. **👔 Liderança** — visão gerencial com Δ colunas (finalizações, score), alertas inteligentes (score <4.5, quedas consecutivas, produtividade abaixo da média)
8. **💡 Insights** — análises automáticas com cruzamento de métricas (quantidade vs qualidade), cards de destaque, alertas configuráveis
9. **📋 Avaliação** — avaliação de desempenho (14 competências, escala 1-4, ciclos de 4 meses) + geração de feedback textual por colaborador
10. **👥 Usuários** (admin) — criar, remover, redefinir senha, alterar cargo (admin/viewer)

> Recursos antigos (Metas, Comparativos, Alertas, Tendências, Conquistas, Projeção, Histórico, Comentários, Feedbacks, Bônus) foram consolidados como sub-seções ou overlays dentro das abas principais.

### Funcionalidades Transversais

- **Filtros Globais Inteligentes** — período (único ou múltiplo), setor, colaborador, score mínimo, meta atingida, favoritos, pesquisa textual. Dropdown de colaborador respeita setor + mês + colaboradores ativos.
- **Relatório Executivo** — texto gerado automaticamente com seções: resumo do período, dados por setor, ✅ destaques (melhores desempenhos), ⚠️ pontos de atenção (score baixo, transferências altas, produtividade baixa), top 5 finalizações/score, menores scores, resumo por colaborador com variação vs média do time.
- **Relatório por Colaborador** — overlay na dashboard (botão 📊 por linha ou dropdown) com avatar, métricas com variação, pontuação da gamificação, destaques, pontos de atenção, bônus/penalidades.
- **Exportar PDF** — abre em nova aba com HTML formatado (cards, cores, destaques). Use Ctrl+P → "Salvar como PDF" para baixar.
- **Gráfico adaptativo** — colaborador único → evolução mensal (timeline); setor/múltiplos → ranking por colaborador. Filtra inativos automaticamente.
- **Tema escuro/claro** — toggle na sidebar, persiste em localStorage.
- **Visão compacta** — toggle na sidebar para reduzir padding/fontes das tabelas.
- **Modo reunião** — oculta nomes para apresentação.
- **Edição inline** — células editáveis na tabela de preview com Enter/Tab para navegação.
- **Importar CSV** — arrastar/colar/selecionar arquivo, parse com PapaParse, normalização de cabeçalhos.
- **Limpar duplicatas** — remove registros duplicados no Supabase.
- **Favoritos** — ⭐ colaboradores favoritos, filtrável nos filtros globais.

## Scripts (ordem de carregamento)

```
auth.js → db.js → db-extra.js → perfis.js → globalFilters.js → scoring.js →
gamificacao.js → metas.js → comparativos.js → colab-detail.js → painelLider.js →
insights.js → alertas.js → conquistas.js → projecao.js → historico.js →
comentarios.js → notificacoes.js → feedbacks.js → anotacoes.js → tarefas.js →
bonus.js → relatorio-setorial.js → avaliacao.js → colaboradores.js →
usuarios.js → csv-import.js → reports.js → app.js
```

## Estrutura de arquivos

```
/
├── index.html              → Página principal (SPA)
├── vercel.json             → Config Vercel
├── AGENTS.md               → Contexto do projeto para IA
├── README.md               → Este arquivo
├── local-proxy.js          → Proxy local para desenvolvimento
├── migration_v2-12.sql     → Scripts SQL para Supabase
├── api/
│   └── users.js            → API serverless (CRUD usuários, alterar senha/cargo)
├── static/
│   ├── auth.js             → Login, cadastro, logout (Supabase Auth)
│   ├── db.js               → Conexão Supabase + CRUD registros
│   ├── db-extra.js         → CRUD tabelas extras + migração localStorage→Supabase
│   ├── perfis.js           → Aliases de colaboradores (apelidos)
│   ├── globalFilters.js    → Filtros globais (Período, Setor, Colaborador)
│   ├── scoring.js          → Regras de pontuação e ranking
│   ├── gamificacao.js      → Ranking, pódio, evolução, heatmap, medalhas
│   ├── metas.js            → Metas manuais e sugestão automática
│   ├── comparativos.js     → Comparativos avançados
│   ├── colab-detail.js     → Perfil do colaborador (overlay)
│   ├── painelLider.js      → Painel do líder com Δ colunas e alertas
│   ├── insights.js         → Central de insights automáticos
│   ├── alertas.js          → Sistema de alertas configuráveis
│   ├── conquistas.js       → Badges/conquistas
│   ├── projecao.js         → Overlay de novo registro mensal
│   ├── historico.js        → Audit log overlay
│   ├── comentarios.js      → Anotações mensais overlay
│   ├── notificacoes.js     → Notificações para admin
│   ├── feedbacks.js        → Geração e registro de feedbacks
│   ├── anotacoes.js        → Anotações diárias privadas
│   ├── tarefas.js          → Tarefas/agenda com prioridades
│   ├── bonus.js            → Bônus/penalidades manuais com mês de referência
│   ├── relatorio-setorial.js → Relatório setorial
│   ├── avaliacao.js        → Avaliação de desempenho (14 competências)
│   ├── colaboradores.js    → Gestão de cadastro + relatório de desempenho
│   ├── usuarios.js         → Gestão de usuários (admin)
│   ├── csv-import.js       → Importação e normalização de CSV
│   ├── reports.js          → Relatórios auxiliares
│   ├── app.js              → Lógica principal (~3031 linhas)
│   └── styles.css          → Estilos com variáveis CSS, tema escuro, responsividade
├── scripts/
│   └── validate_csv.py     → Validador de CSV
```

## Fluxo de autenticação

1. `auth.js` → `initAuth()` verifica sessão existente
2. Se não há sessão → exibe overlay de login/cadastro
3. Login usa `sbClient.auth.signInWithPassword()`
4. Cadastro usa `sbClient.auth.signUp()` (sem confirmação de email)
5. Logout usa `sbClient.auth.signOut()` + reload
6. Admin é definido automaticamente via API quando papel está ausente

## Fluxo de dados

1. **DOMContentLoaded** em `app.js`:
   - `initAuth()` → verifica sessão
   - `initDbExtra()` (background) → migra localStorage → Supabase, carrega dados extras
   - `dbLoadRecords()` → carrega registros do Supabase (`importacoes`)
2. Dados de CSV passam por RLS (filtrados por `user_id` ou nulos)
3. Dados extras (metas, fotos, etc.) usam **localStorage como fallback** se Supabase offline
4. Escrita é **síncrona no localStorage** + **assíncrona no Supabase**

## Papéis

- **admin** — acesso total (ver/editar/remover registros, gerenciar usuários)
- **viewer** — visualização apenas (sem botões de ação, sem aba Usuários)

## Riscos conhecidos

1. ~~**Service Role Key exposta** em `api/users.js`~~ ✅ **Corrigido** — lê de `process.env.SERVICE_ROLE_KEY` no Vercel
2. **Sem build step** — sem typecheck, sem linter, sem testes automatizados
3. **`app.js` ~3031 linhas** — monolítico, difícil de manter

## Comandos úteis

```bash
# Deploy completo
git add -A && git commit -m "mensagem" && git push origin main && npx vercel deploy --prod --yes

# Apenas deploy (se já commitado)
npx vercel deploy --prod --yes

# Git
git status
git log --oneline -10
```
