# Arquitetura — baseline da Fase 1

Revisão local em 28/10/2026. Fonte: código desta branch; não é auditoria do banco ou do ambiente publicado.

## Execução

HTML/CSS/JavaScript vanilla, sem compilação. `index.html` declara a ordem de carregamento; há 74 arquivos JS diretamente em `static/` e 81 elementos script no HTML (incluindo inline e externos). `static/app.js` concentra inicialização, estado, filtros, navegação e renderização. Módulos comunicam-se por funções globais, eventos e DOM. Bibliotecas externas incluem Supabase, Chart.js, PapaParse e exportadores; PDF.js está em `static/vendor/`.

## Dados e identidade

`static/auth.js` e `auth-policy.js` tratam sessão/papéis; `db.js` faz leitura paginada, gravação e reenvio de pendências. `db-extra.js` reúne persistência de diversos recursos. Muitos módulos leem localStorage de forma síncrona e sincronizam com Supabase; módulos recentes têm contratos próprios, como `diagnostico-store.js`. Ainda não existe um repository ou estado central único. O cache local e as filas exigem cuidado com troca de usuário e confirmação de escrita.

Supabase fornece Auth e PostgreSQL/RLS. Ocultar controles na interface não substitui autorização no servidor. `api/users.js`, `api/send-email.js` e `api/desafio.js` são funções serverless. Segredos permanecem em variáveis do ambiente; não registrar valores em documentação ou testes.

## Entrega e cache

`APP_VERSION` em `static/app.js` identifica a versão funcional (baseline 1.14.0). Query strings de assets são históricas e continuam válidas. `scripts/release.js` verifica arquivos locais referenciados e correspondência dos CSS/JS do SHELL com o HTML; gera a identidade do cache a partir do conteúdo desses arquivos e da estratégia do worker. Não muda automaticamente a versão funcional nem as URLs.

`sw.js`: navegação network-first; demais GET stale-while-revalidate; API, Authorization e Supabase não são interceptados. Ativação remove somente caches antigos com prefixo `painel-suporte-`. Cache offline de HTML continua sendo parte do comportamento existente. Não há alteração de persistência de dados nesta fase.

## Limites e próximos pontos de atenção

Acoplamento a globais/DOM, carga inicial ampla, CSS acumulado e semântica desigual entre cache e persistência continuam como dívida. Testes Node usam funções puras, simulações e algumas extrações de código; não provam navegação real, RLS publicada, envio de email ou concorrência entre dispositivos. Não foi consultado nem modificado o banco em produção.

Consulte [inventário](feature-inventory.md), [validação e releases](testing-release.md), [migrations](migrations.md) e [roadmap](roadmap.md).

## Evolução — Fase 2

O baseline acima foi registrado na Fase 1. A versão funcional agora é 1.15.0; `static/shell.js` adiciona apresentação por áreas e dialog de ferramentas sem centralizar estado/dados. `static/shell.css` isola o novo layout. O app.js perdeu os organizadores antigos e a identidade da sidebar; conta permanece no cabeçalho. Consulte [navegação](navigation.md) para contratos e validação.

## Evolução — Fase 3

Versão 1.16.0. A Equipe 360º acrescenta uma projeção de leitura por pessoa (`equipe360-data.js`) e um dialog (`equipe360.js`/`.css`). A aplicação geral mantém seus loaders e persistência anteriores; esta fase não implementa o estado/repository global planejado para a Fase 4. Consulte [contratos de fontes e identidade](equipe-360.md).

## Evolução — Fase 4

Versão 1.17.0. `data-runtime.js` fornece sessão invalidável, cache por conta e AppState/eventos. `records-repository.js` assume indicadores, confirmação e fila por revisão; db.js mantém compatibilidade. Os módulos passaram a appStorage. O perfil 360º também publica sua projeção no estado. Os loaders/mutações complementares ainda serão extraídos gradualmente. Consulte [arquitetura de dados](data-architecture.md), especialmente a preservação de chaves antigas sem dono e os limites de recuperação/transações.

## Evolução — Fase 5

Versão 1.18.0. O núcleo delega gráficos/relatório e separa administração/interface. A fachada db-extra carrega implementações em repositories por domínio. O manifest/loader e pontes públicas abrem quatro áreas sob demanda. Contratos globais e estado compartilhado seguem como compatibilidade; consulte [modularização](modularization.md).

## Evolução — Fase 6 (base compartilhada)

Versão 1.19.0. css/components.css substitui visual-refresh, consolidando contratos sobre tokens e estilos históricos. ui-accessibility.js assume teclado/foco dos overlays e regiões de tabela. A consolidação do CSS é gradual; escopo, validação e continuidade em [design-system.md](design-system.md).
