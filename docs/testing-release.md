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
