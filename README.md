# Dashboard de Suporte

App de dashboard para análise de indicadores de suporte, com autenticação Supabase, gestão de usuários com papéis (admin/viewer) e deploy no Vercel.

## Stack

- **Frontend:** HTML/CSS/JS vanilla (SPA, sem build step)
- **Backend:** Supabase (Auth, PostgreSQL, RLS, REST API)
- **Deploy:** Vercel (static + serverless functions)
- **CSV parse:** PapaParse (CDN) + fallback nativo

## Deploy

- **URL:** https://dashboard-suporte-iota.vercel.app
- **Vercel project:** `andre-tavares/dashboard-suporte`
- **Git remote:** `origin` → `https://github.com/andre-tavares/dashboard-suporte`
- **Branch:** `main`
- **Deploy manual:** `npx vercel deploy --prod --yes` (na raiz do projeto)

## Supabase

- **URL:** https://agvkmfusyetkicmuvumz.supabase.co
- **Dashboard:** https://supabase.com/dashboard/project/agvkmfusyetkicmuvumz
- **Anon key:** `static/db.js` (exposta — risco conhecido)
- **Service role key:** `api/users.js` (exposta — risco conhecido)
- **Auth:** Email/Password (confirmação de email **desabilitada**)

### Tabelas

| Tabela | Finalidade | RLS |
|---|---|---|
| `registros` | Dados CSV importados (~654 registros) | Por `user_id` |
| `metas` | Metas manuais/configuradas | Por `user_id` |
| `comentarios` | Anotações mensais | Authenticated |
| `historico` | Audit log de alterações | Authenticated |
| `scoring_config` | Regras de pontuação (1 row/user) | Por `user_id` |
| `alertas_config` | Configuração de alertas (1 row/user) | Por `user_id` |
| `colaborador_fotos` | URLs de fotos dos colaboradores | Authenticated |
| `colab_inativos` | Colaboradores inativos por usuário | Por `user_id` |

### Migrations

- `migration.sql` — tabela `registros` + RLS
- `migration_v2.sql` — 7 tabelas extras + RLS (executado em 19/06/2026)

### RLS Policies (`migration_v2.sql`)

Tabelas com `user_id`: SELECT/INSERT/UPDATE/DDELETE restritos ao próprio `auth.uid()`.
Tabelas compartilhadas (comentarios, historico, colaborador_fotos): acesso a todo `auth.role() = 'authenticated'`.

## Recursos

- **📊 Dashboard** — indicadores, gráficos, KPIs por período
- **🏆 Gamificação** — ranking, pódio, evolução individual, heatmap, medalhas
- **📋 Regras** — configuração de scoring e critérios
- **🎯 Metas** — metas manuais com sugestão automática (últimos 3 meses)
- **💡 Insights** — análises automáticas e projeções
- **👥 Usuários** (admin) — criar, remover, redefinir senha, alterar cargo
- **📄 Exportar PDF** — relatório com gráfico + KPIs
- **📸 Fotos** — URL do colaborador com fallback para iniciais
- **📝 Histórico** — audit log de edições/adições/exclusões
- **💬 Comentários** — anotações mensais
- **📅 Novo registro mensal** — adicionar dados para meses futuros
- **🔮 Tendências** — médias móveis + projeção linear
- **🧹 Limpar duplicatas** — remove registros duplicados no Supabase

## Papéis

- **admin** — acesso total (ver/editar/remover registros, gerenciar usuários)
- **viewer** — visualização apenas (sem botões de ação, sem aba Usuários)

## Estrutura de arquivos

```
/
├── index.html              → Página principal (SPA)
├── vercel.json             → Config Vercel
├── migration.sql           → Script SQL tabela `registros`
├── migration_v2.sql        → Script SQL 7 tabelas extras (19/06)
├── README.md               → Este arquivo
├── api/
│   └── users.js            → API serverless (CRUD usuários, alterar senha/cargo)
├── static/
│   ├── auth.js             → Login, cadastro, logout (Supabase Auth)
│   ├── db.js               → Conexão Supabase + CRUD `registros`
│   ├── db-extra.js         → CRUD 7 tabelas extras + migração única localStorage→Supabase
│   ├── app.js              → Lógica principal do dashboard (~3570 linhas)
│   ├── globalFilters.js    → Filtros globais (Período, Setor, Colaborador)
│   ├── styles.css          → Estilos com variáveis CSS, tema escuro, role badges
│   ├── scoring.js          → Regras de pontuação e ranking
│   ├── perfis.js           → Aliases de colaboradores
│   ├── gamificacao.js      → Ranking, pódio, evolução, heatmap
│   ├── metas.js            → Metas manuais e sugestão automática
│   ├── comparativos.js     → Comparativos avançados
│   ├── colab-detail.js     → Perfil do colaborador
│   ├── painelLider.js      → Painel do líder
│   ├── insights.js         → Central de insights
│   ├── alertas.js          → Sistema de alertas
│   ├── tendencia.js        → Projeções e tendências
│   ├── conquistas.js       → Badges/conquistas
│   ├── usuarios.js         → Gestão de usuários (admin)
│   ├── historico.js        → Audit log overlay
│   ├── comentarios.js      → Anotações mensais overlay
│   └── projecao.js         → Overlay de novo registro mensal
└── scripts/
    └── validate_csv.py     → Validador de CSV
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
   - `initDbExtra()` (em background) → migra localStorage → Supabase, depois carrega do Supabase para localStorage (metas, comentários, histórico, scoring, alertas, fotos, inativos)
   - `dbLoadRecords()` → carrega registros do Supabase (`registros`)
2. Dados de CSV passam por RLS (filtrados por `user_id` ou nulos)
3. Dados extras (metas, fotos, etc.) usam **localStorage como fallback** se Supabase offline
4. Escrita é **síncrona no localStorage** + **assíncrona no Supabase**

## Persistência (Migration v2 — 19/06/2026)

**Estratégia:** localStorage como fallback primário, Supabase como storage principal.

- Todas as funções de leitura lêem do localStorage primeiro (síncrono)
- Todas as funções de escrita salvam em ambos (localStorage + Supabase)
- `initDbExtra()` no DOMContentLoaded carrega dados do Supabase e popula localStorage
- `migrateLocalToSupabase()` roda **uma única vez** (flag `sistema_migrated_to_supabase_v1`) para migrar dados antigos do localStorage para o Supabase

**Arquivos modificados na migration v2:**
- `static/db-extra.js` (novo) — CRUD centralizado para as 7 novas tabelas
- `static/app.js` — `initDbExtra()`, `logHistorico()`, `setColabFoto()`, `saveInactiveColabs()`, `setColabActive()`
- `static/metas.js` — `loadMetas()` assíncrono, `saveMetas()` com Supabase
- `static/comentarios.js` — `addComentario()` e `delComentario()` com Supabase
- `static/historico.js` — helper `loadHistoricoFromStorage()` extraído
- `static/alertas.js` — `loadAlertasConfig()` e `saveAlertasConfig()` com Supabase
- `static/scoring.js` — `saveScoringRules()` com Supabase
- `index.html` — script tag `db-extra.js` adicionada

## Riscos conhecidos

1. **Service Role Key exposta** em `api/users.js` — permite bypass total de RLS
2. **Anon key exposta** em `static/db.js` — risco baixo (RLS bloqueia), mas idealmente ambas deveriam ser variáveis de ambiente do Vercel
3. **Sem build step** — sem typecheck, sem linter, sem testes automatizados
4. **`app.js` ~3570 linhas** — monolítico, difícil de manter

## Comandos úteis

```bash
# Deploy
npx vercel deploy --prod --yes

# Git
git status
git add -A
git commit -m "mensagem"
git push origin main
```
