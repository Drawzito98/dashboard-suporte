# Dashboard de Suporte

App de dashboard para análise de indicadores de suporte, com autenticação Supabase, gestão de usuários com papéis (admin/viewer), gamificação, relatórios inteligentes, e deploy no Vercel.

**Versão atual:** `1.24.0` (constante `APP_VERSION` em `static/app.js`)

## Diagnóstico gerencial

A auditoria, metodologia, limitações e validação da nova seção estão em [docs/diagnostico-gerencial.md](docs/diagnostico-gerencial.md). A migração aditiva `migration_v49.sql` foi aplicada ao banco de produção em 22/10/2026, habilitando revisões privadas sincronizadas.

## Avaliações: confirmação e recuperação

Avaliações só entram na lista após confirmação do servidor. Falhas mantêm o rascunho privado com notas e comentários; Retomar permite continuar com o mesmo identificador. Status e exclusão também exigem confirmação. [Contratos e limites](docs/avaliacoes-confirmadas.md).

## Pessoas e Equipe 360º

Pessoas reúne Equipe e Gestão coletiva. O perfil oferece avaliações, feedbacks e PDI para a pessoa selecionada, com retorno e proteção dos rascunhos. [Mapa e limites](docs/pessoas-equipe360.md).

## Operação e metas

Operação reúne Visão geral, Análises e Metas. As visualizações analíticas existentes permanecem acessíveis dentro de Análises; metas têm tela própria com controles conforme o papel. [Mapa e validação](docs/operacao-e-metas.md).

## Salvamento e análises

Feedbacks/metas exigem confirmação do servidor; falhas preservam rascunhos. Relatório Setorial usa somente os filtros do topo, com meses e contexto explícitos nas exportações. [Contratos e limites](docs/confirmacao-e-contexto.md).

## Revisão após o roadmap

Panorama parcial retirado do Relatório Setorial, com implementação preservada para possível realocação após definir o CSV. Pendências técnicas e prioridades de interface estão em [revisao-pos-roadmap.md](docs/revisao-pos-roadmap.md).

## Cockpit gerencial — Fase 7

A Home reúne referência mensal explícita, tarefas acionáveis, diagnóstico com evidências, equipes por nível e avisos de cobertura/fontes. Veja [comportamento, regras e validação](docs/cockpit.md).

## Design System / UX — Fase 6

Base compartilhada de componentes, temas, estados vazios, tabelas e teclado de modais. Fase concluída com navegação compacta no celular, filtros legíveis e revisão dos gráficos e editores. Contratos e limites estão em [design-system.md](docs/design-system.md).

## Modularização — Fase 5

Gráficos, relatório, administração e interface foram extraídos do núcleo. Persistência foi dividida por domínio; Ponto, PDI, Equipe 360º e Panorama carregam no primeiro acesso. Veja [estrutura, contratos e limites](docs/modularization.md).

## Arquitetura de dados — Fase 4

AppState/eventos, armazenamento por conta e repository de indicadores separam fonte oficial, cache e pendências. Respostas vazias não restauram dados antigos; troca de sessão invalida o estado. A adoção pelos módulos é gradual. Veja [contratos, recuperação e validação](docs/data-architecture.md).

## Equipe 360º — Fase 3

O perfil central da pessoa reúne cadastro, desempenho, avaliações, feedbacks, PDI, férias, ausências, ponto e histórico. Fontes, vínculos e limitações ficam explícitos; os editores existentes são preservados. Veja [comportamento e validação](docs/equipe-360.md).

## Navegação por áreas — Fase 2

Início, Operação, Pessoas e Rotina organizam as 13 telas existentes. Ferramentas ficam em um painel sob demanda; filtros podem ser recolhidos. Veja [comportamento e validação](docs/navigation.md).

## Foundation / Estabilização

Baseline e continuidade: [arquitetura](docs/architecture.md), [inventário atual](docs/feature-inventory.md), [roadmap](docs/roadmap.md), [testes e cache](docs/testing-release.md), [catálogo de migrations](docs/migrations.md). Esses documentos atualizam as descrições históricas de módulos, abas e migrations abaixo. A Fase 1 não altera regras de negócio ou o banco.

## Changelog

| Versão | Data | Alterações |
|--------|------|------------|
| 1.24.0 | 29/10/2026 | Avaliações com confirmação remota, rascunho separado/retomada, retentativa por UUID e status/exclusão sem sucesso otimista. |
| 1.23.0 | 29/10/2026 | Pessoas organizada em Equipe/Gestão coletiva, ações individuais contextualizadas e retorno ao perfil sem substituir rascunhos silenciosamente. |
| 1.22.0 | 29/10/2026 | Operação organizada em Visão geral, Análises e Metas; acesso próprio a metas e rascunhos preservados ao filtrar. |
| 1.21.0 | 29/10/2026 | Confirmação de feedbacks/metas, rascunhos para retentativa, metas por item e contexto único no Relatório Setorial. |
| 1.20.1 | 28/10/2026 | Retirada do Panorama parcial da tela setorial e revisão das pendências do roadmap e da interface. |
| 1.20.0 | 28/10/2026 | Cockpit gerencial: período encerrado por padrão, evidências e ações vinculadas, notas ausentes explícitas e atualização somente leitura por conta. |
| 1.19.1 | 28/10/2026 | Conclusão da Fase 6: submenu móvel com rolagem, filtros/cabeçalho responsivos, limpeza da sidebar, ciclo de gráficos e leitura de metas sem regravação. |
| 1.19.0 | 28/10/2026 | Base de componentes e tokens, tabelas acessíveis por teclado, foco de modais e consistência de temas; refinamentos da Fase 6 documentados. |
| 1.18.0 | 28/10/2026 | Extração dos módulos centrais, persistência por domínio e carregamento sob demanda com retentativa e proteção de sessão. |
| 1.17.0 | 28/10/2026 | Estado/eventos e repository de indicadores; cache por conta, sessão invalidável, vazios autoritativos e confirmação de pendências por revisão. |
| 1.16.0 | 28/10/2026 | Perfil Equipe 360º com fontes explícitas, histórico integrado, vínculos exatos e acesso aos editores existentes. |
| 1.15.0 | 28/10/2026 | Shell por áreas, submenu contextual, ferramentas sob demanda e filtros recolhíveis; mantém destinos, handlers e regras existentes. |
| 1.7.2 | 24/07/2026 | Performance: `defer` em 45 scripts do body. Visual: font-sizes `9px/10px` → `11px` mínimo, `transition: all` substituída por transições específicas (8 ocorrências), cores hardcoded no dark theme → tokens `--overlay`/`--overlay-soft`/`--overlay-table`, seletores frágeis `[style*]` substituídos por classes CSS (`.grid-2col`, `.global-filter-field--flex`). |
| 1.7.1 | 24/07/2026 | CSS: contraste `--text-muted` corrigido (WCAG AA), `@keyframes spin` duplicado removido, `var(--radius)`/`var(--surface)` indefinidos corrigidos, `transition: all` substituída por específicas, auth padronizado de `rem` para `px`. HTML: `aria-label="Fechar"` em 17 overlays, `<meta robots>`, typos corrigidos (acentos). |
| 1.7.0 | 24/07/2026 | CSS: fontes aumentadas ~1-2px em todo o app para legibilidade em Full HD (root 14→15px, KPIs 24→26px, labels 10→11px, badges 11→12px, tabs 12→13px, forms/btns 13→14px) |
| 1.1.0 | 22/07/2026 | CSS: variáveis quebradas definidas (`--primary`, `--bg`, `--bg-elevated`, `--border-color`); syntax error corrigido;6 regras `!important` eliminadas; font sizes fracionários padronizados; label de versão discreto na sidebar |
| 1.0.0 | — | Versão inicial |

## Stack

- **Frontend:** HTML/CSS/JS vanilla (SPA, módulos globais, sem build step)
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
- **Publicação:** merge e deploy somente com autorização explícita. Consulte [validação e release](docs/testing-release.md).

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

### Migrations

Consulte o [catálogo completo e procedimento](docs/migrations.md), que cobre a sequência até v49. A antiga tabela resumida não correspondia ao conteúdo de alguns arquivos e foi substituída por esse catálogo. Não executar SQL como parte de testes ou push.

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
6. Autorizações dependem dos metadados protegidos e das verificações do servidor; consulte `auth-policy.js` e `api/users.js`.

## Fluxo de dados

1. A autenticação vincula a conta antes de carregar dados.
2. Indicadores vêm da tabela registros via RecordsRepository/AppState, com cache por conta e fila de alterações por revisão. Resposta vazia do servidor é válida.
3. Módulos complementares usam a fachada db-extra e repositories por domínio, com contratos de escrita ainda heterogêneos. Nem todos têm confirmação remota/fila durável como os indicadores.
4. Migração automática de chaves legadas sem dono não é executada. PDI permanece local por conta/dispositivo.

Detalhes em [data-architecture.md](docs/data-architecture.md) e pendências em [revisao-pos-roadmap.md](docs/revisao-pos-roadmap.md).

## Papéis

- **admin** — acesso total (ver/editar/remover registros, gerenciar usuários)
- **viewer** — visualização apenas (sem botões de ação, sem aba Usuários)

## Riscos conhecidos

1. ~~**Service Role Key exposta** em `api/users.js`~~ ✅ **Corrigido** — lê de `process.env.SERVICE_ROLE_KEY` no Vercel
2. **Sem build step** — sem typecheck ou linter; testes locais disponíveis via `npm test`
3. **`app.js` concentra responsabilidades** — monolítico, difícil de manter

## Comandos úteis

```bash
npm test
npm run release:check
git status
git log --oneline -10
```
