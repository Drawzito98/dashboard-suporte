# Testes e versionamento

Node.js 20 ou superior recomendado (baseline executada com v20.20.2; sem dependências adicionais para testes). `npm test` não instala pacotes, não acessa contas e não aplica SQL.

```bash
npm test                 # runner + todos os *.check.js em processos separados + cache
npm run test:unit        # *.test.js; suíte síncrona histórica
npm run test:checks      # verificações assíncronas isoladas + cache
npm run release:cache    # gerar identidade após mudar assets/HTML/worker
npm run release:check    # validar identidade e URLs do SHELL, sem escrita
```

O agregador continua após falhas e retorna código diferente de zero se qualquer processo falhar. As verificações `.check.js` usam simulações, sem Supabase real. Testes novos assíncronos devem ser `.check.js`; o runner histórico não aguarda Promises. Fixtures `.browser.html`, o runner de navegador e `diagnostico-rls.sql` são verificações separadas; consultar também ATIVIDADES-MES.md e os documentos específicos dos módulos. PDFs reais não entram no repositório.

## Preparação de release

1. Conferir origin, branch e status, preservar alterações preexistentes.
2. Ajustar APP_VERSION quando houver uma release funcional; manter changelog coerente. Na Fase 1 permaneceu 1.14.0; a Fase 2 usou 1.15.0; a Fase 3 usou 1.16.0; a Fase 4 usa 1.17.0 (ver data-architecture.md).
3. Após alterar assets, alinhar URLs do SHELL se necessário e executar `npm run release:cache`. A geração é determinística e inclui a estratégia do worker e os arquivos locais do shell; dependências remotas e imports indiretos precisam de revisão específica.
4. Executar npm test e git diff --check; revisar diff, arquivos incluídos e ausência de segredos.
5. Commit e push somente da branch dedicada ao origin conferido. Não fazer merge/deploy sem autorização. Integrações remotas podem gerar previews automaticamente; não foram alteradas nesta fase.

## Registro da Fase 1

Baseline anterior: runner com 171 testes aprovados. Validação final: `npm test` aprovado, incluindo 171 testes do runner, três checks assíncronos preexistentes, check do service worker e validação de cache (88 arquivos). `git diff --check` sem erros. Navegador, comportamento offline real e políticas no servidor não foram validados nesta rodada; a validação do worker usa simulações locais.

## Registro da Fase 3

Novo check `equipe360-data.check.js` incluído automaticamente em npm test. Validação de navegador em `tests/equipe360.browser.html`, repetida em desktop e celular. Escopo, testes e limites detalhados em [equipe-360.md](equipe-360.md). Nenhuma migration ou dado de produção foi alterado.

## Registro da Fase 4

Novos checks de runtime, repository, auth e cache privado entram automaticamente em npm test. A fixture `tests/data-lifecycle.browser.html` testa a camada real de sessão/armazenamento no navegador com servidor simulado. Escopo e limites em [data-architecture.md](data-architecture.md). Sem aplicação de SQL ou modificação de dados de produção.

## Registro da Fase 5

Versão 1.18.0. Checks de loader, domínios e gráficos/relatório agregados a npm test. Cache inclui o manifest e seus assets dinâmicos. Validação no navegador e limites em [modularization.md](modularization.md). Sem SQL, merge ou deploy.

## Registro da Fase 6 — ciclo inicial

Versão 1.19.0. npm test aprovado, fixtures de áreas em desktop/celular e runner de teclado/temas em 1440/390/320px. Ver [design-system.md](design-system.md). Commit/push e deploy foram autorizados pelo usuário ao encerrar este ciclo; merge continua sem autorização.

## Conclusão da Fase 6

1.19.1: npm test e cache aprovados; interface-assets e metas-read entram no agregador. Fixtures de áreas passaram em 320px/1440px. workspace-ux testa gráficos/CDNs reais, PNG, CSV, HTML de impressão e editores com dados simulados em 320/390/1440px. Detalhes e limites em [design-system.md](design-system.md). Esta rodada faz commit/push na branch da fase, sem merge ou novo deploy.

## Fase 7 — Cockpit gerencial

A conclusão da Fase 6 (c4c782a) foi publicada e conferida por hash antes de iniciar a Fase 7. A versão 1.20.0 agrega cockpit-engine.check.js a npm test. O cenário workspace-ux.browser.html?cockpit=1 valida as ações com backend simulado; &race=1 cobre resposta após encerrar sessão. Ver [cockpit.md](cockpit.md). Cache cobre 114 arquivos locais. Deploy autorizado neste ciclo; não houve merge ou migrations.

## Continuação 1.25.0 — Rotina

Confirmação e rascunhos de tarefas/notas com servidor simulado. npm test, release:check e diff --check aprovados; formulários em 1440/320px e regressões de workspace, cockpit/race, sessão, lazy-modules, design-system e atividades. Evidências e limites em [rotina-confirmada.md](rotina-confirmada.md). Publicação autorizada; nenhum merge ou teste de escrita em produção.

## Continuação 1.26.0 — Cadastro

Cadastro de colaboradores, foto e reativação na criação exigem confirmação, com rascunho privado e falhas parciais explícitas. A cópia privada anterior é preservada separadamente. Ver [cadastro-confirmado.md](cadastro-confirmado.md). Bônus, regras, presença e gerenciadores de inativos ainda aguardam revisão; carga inicial/CSS e Panorama mantêm os limites documentados.

## Continuação 1.27.0 — Bônus e penalidades

Bônus/penalidades com confirmação, rascunho privado, UUID/sinal estáveis e mês preservado na recarga. Acesso disponível em Pessoas → Equipe, sem reintroduzir a tela de Gamificação. Ver [bonus-confirmados.md](bonus-confirmados.md). Os demais domínios, carga inicial/CSS e Panorama mantêm as pendências documentadas.

## Continuação 1.28.0 — Férias e ausências

Confirmação, rascunhos e conferência de criações incertas implementadas, respeitando IDs numéricos existentes. Exclusões sobrepostas informam confirmações parciais. Ver [presenca-confirmada.md](presenca-confirmada.md). Retomar pelas pendências e verificações visuais ali registradas; sem merge ou SQL.

## Continuação 1.29.0 — Regras

Quadro com gravações confirmadas e rascunho privado; compartilhamento/autoria preservados, movimento separado de texto. Contratos, validação e limites em [regras-confirmadas.md](regras-confirmadas.md). Comentários e demais domínios continuam pendentes.
