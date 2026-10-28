# Fase 2 — Shell e navegação

Implementação em `feat/fase2-shell-navegacao`, baseada no commit `dee1cfb` da Fase 1, sem merge. Versão funcional 1.15.0.

## Experiência

O menu permanente com 13 destinos e ferramentas laterais foi substituído por quatro áreas horizontais. O submenu mostra somente as telas da área atual; Início não tem submenu.

| Área | Telas |
|---|---|
| Início | Início |
| Operação | Indicadores, Relatório Setorial, Saúde Operacional, Análises avançadas |
| Pessoas | Equipe, Acompanhamento da equipe, Avaliação de desempenho, Análise de perfil e PDI, Mapeamento de Time, Auditoria de Ponto |
| Rotina | Rotina, Regras |

Clicar numa área abre sua última tela visitada nesta sessão ou a primeira tela permitida. Atalhos, busca rápida e restauração da última aba usam os mesmos botões/IDs e revelam automaticamente a área correspondente. A preferência antiga de recolher sidebar deixa de ser usada; nenhum dado local é apagado. Conta, tema, apresentação e busca permanecem no cabeçalho/menu de conta. A identidade grande da sidebar foi removida junto com essa sidebar.

**Ferramentas** abre um `dialog` nativo lateral, com foco contido, Escape, botão Fechar, fechamento pelo fundo e retorno de foco. As ações originais continuam nos mesmos elementos `.sidebar`, preservando handlers e restrições. O painel fecha antes da abertura de overlays de ações. Os grupos de ferramentas respondem a Enter/Espaço e informam o estado de expansão. O antigo menu mobile e os dois organizadores concorrentes foram removidos.

**Filtros** podem ser recolhidos sem limpar ou recalcular valores. Chips continuam visíveis; no celular os campos começam recolhidos. Não houve mudança na aplicação, escopo ou persistência dos filtros. Campos específicos dos módulos continuam onde estavam.

## Organização técnica

`shell.js` controla somente área visível e ferramentas; `app.js` continua responsável pela ativação das telas e callbacks. `shell.css` contém overrides limitados a `body.shell-v2`; o CSS legado será consolidado na Fase 6. Novas telas devem entrar no mapa de áreas de `shell.js` e manter o contrato `data-tab` / `tab-<nome>`. As permissões existentes continuam em auth-policy, CSS e nos handlers/servidor; shell não concede papéis nem substitui RLS.

## Validação

- `npm test`: 171 testes do runner e todos os checks locais aprovados; cache cobre 90 arquivos.
- Fixture `tests/shell.browser.html`: usa o HTML/CSS e shell reais e o bloco de roteamento de app.js; simula os renderizadores das telas para não acessar o banco. Confere os 13 destinos, callbacks, seleção única, última tela por área, filtros, ferramentas, teclado dos grupos, retorno de foco, papéis e apresentação.
- Navegador local: fixture aprovada em 1440×900 e 390×844, sem overflow horizontal; capturas inspecionadas.
- Fixtures existentes Panorama/filtros, Diagnóstico e Perfil/PDI aprovadas no navegador.
- Smoke adicional do index completo com Supabase/autenticação simulados: inicialização admin e abertura das 13 telas sem exceções não tratadas. Não valida biblioteca de gráficos, login real, escrita no servidor ou autorização publicada.

Para repetir a fixture, sirva o repositório em localhost, abra `/tests/shell.browser.html` e aguarde PASS. Com Chrome de teste na porta 9228 e servidor na 8765: `node --experimental-websocket tests/ponto-browser-runner.js shell.browser.html`. Repetir com viewport de celular. Fixtures de navegador permanecem separadas de npm test.

Não houve aplicação de migrations, alteração de regras de negócio, merge ou comando de deploy nesta fase. Publicação depende de autorização explícita.
