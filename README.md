# Dashboard de Suporte — versao-27

App de dashboard para análise de indicadores de suporte, com autenticação Supabase e deploy no Vercel.

## Deploy

- **URL:** https://versao-27.vercel.app
- **Vercel project:** `versao-27` (org: `andre-tavares-projects`)
- **Deploy:** `npx vercel deploy --prod` na raiz do projeto

## Supabase

- **URL:** https://agvkmfusyetkicmuvumz.supabase.co
- **Dashboard:** https://supabase.com/dashboard/project/agvkmfusyetkicmuvumz
- **Tabela principal:** `registros`
- **Auth:** Email/Password (confirmação de email **desabilitada**)
- **Configurado em:** `static/db.js`

### RLS Policies aplicadas (via `migration.sql`)

```sql
ALTER TABLE registros ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE registros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own data" ON registros
  FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can insert their own data" ON registros
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own data" ON registros
  FOR UPDATE USING (auth.uid() = user_id OR user_id IS NULL)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own data" ON registros
  FOR DELETE USING (auth.uid() = user_id OR user_id IS NULL);
```

## Estrutura de arquivos

```
/
├── index.html              → Página principal (SPA)
├── vercel.json             → Config Vercel
├── migration.sql           → Script SQL para configurar o banco
├── static/
│   ├── auth.js             → Login, cadastro, logout (Supabase Auth)
│   ├── db.js               → Conexão e CRUD com Supabase (`registros`)
│   ├── app.js              → Lógica principal do dashboard (3150+ linhas)
│   ├── globalFilters.js    → Filtros globais (Período, Setor, Colaborador)
│   ├── styles.css          → Estilos
│   ├── scoring.js          → Regras de pontuação
│   ├── perfis.js           → Perfis de colaboradores
│   ├── gamificacao.js      → Gamificação/ranking
│   ├── metas.js            → Metas e objetivos
│   ├── comparativos.js     → Comparativos avançados
│   ├── colab-detail.js     → Detalhes do colaborador
│   ├── painelLider.js      → Painel do líder
│   ├── insights.js         → Central de insights
│   ├── alertas.js          → Sistema de alertas
│   ├── tendencia.js        → Análise de tendências
│   └── conquistas.js       → Badges/conquistas
└── scripts/
    └── validate_csv.py     → Validador de CSV
```

## Fluxo de autenticação

1. `auth.js` → `initAuth()` verifica sessão existente
2. Se não há sessão → exibe overlay de login/cadastro
3. Login usa `sbClient.auth.signInWithPassword()`
4. Cadastro usa `sbClient.auth.signUp()`
5. Logout usa `sbClient.auth.signOut()` + reload

## Fluxo de dados

1. `app.js` DOMContentLoaded → `initAuth()` → `dbLoadRecords()`
2. Se Supabase tem dados → carrega e popula filtros globais
3. Se Supabase vazio → tenta localStorage como fallback
4. Se logado no Supabase → sempre mostra o dashboard (mesmo sem dados)

## Alterações recentes

- Desabilitado "Confirm email" no Supabase Auth (usuários logam direto)
- Botão "Sair" movido do menu `⋯` para a barra superior
- Após login, vai direto para o dashboard (sem tela de import CSV)
- `globalFilters.popularOptions()` agora é chamado ao carregar dados do Supabase
- Console.logs extensivos para debug (F12 → Console)
