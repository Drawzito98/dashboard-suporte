# Fase 6 — Design System / UX

Versão inicial 1.19.0; conclusão 1.19.1, branch `feat/fase6-design-system`, baseada na Fase 5 (b814a88).
O primeiro ciclo foi encerrado com commit/deploy a pedido do usuário. A retomada concluiu os refinamentos registrados ao final deste documento. Não foi solicitado merge.

## Entrega deste ciclo

- tokens.css centraliza altura de controles (44px), raios, tipografia auxiliar, foco e aliases de superfícies; declara color-scheme por tema.
- css/components.css substitui visual-refresh.css: controles, cards, tabelas, estados vazios, mensagens, foco visível, dimensões de modais e movimento reduzido. A antiga camada Premium ADM v1 foi removida de styles.css (189 linhas). Regras mortas da sidebar foram retiradas do antigo visual-refresh; navegação atual permanece em shell.css.
- Cards com min-width:0 mantêm a rolagem de tabelas dentro da área. Regiões largas podem ser focadas pelo teclado, recebem nome por caption ou data-scroll-label e deixam a ordem de Tab quando não há overflow. Atributos definidos pelos módulos são preservados.
- ui-accessibility.js substitui o controlador duplicado de overlays em app-interface. Tab circula somente nos controles visíveis da janela superior, Escape usa o botão de fechamento existente (preservando guards), e o foco retorna ao acionador. Dialogs nativos conservam cancel/guards próprios; Escape não fecha editores inferiores. A busca rápida mantém foco contido e retorno ao acionador.
- Link “Ir para o conteúdo” aponta para a área principal. Ponto recebe superfícies/status por tokens e campos de 16px no celular; Equipe360 e Panorama usam tokens compartilhados.

IDs, handlers, papéis, dados e regras de cálculo permanecem. Não foram aplicadas migrations ou feitas alterações de dados reais nos testes.

## Contratos para continuidade

Carregar tokens antes dos estilos históricos/específicos e components.css após os estilos iniciais. Áreas sob demanda podem ter CSS próprio; usar tokens em vez de redefinir cores do tema. Ao mudar um asset, alinhar a URL em index/manifest/SHELL e executar npm run release:cache.

Usar btn-primary para ação principal, btn-secondary/btn-small para ações auxiliares; manter labels de campos e mensagem textual ao lado de erros. aria-invalid sinaliza campo inválido; aria-busy indica operação em andamento. empty-state/empty-title/empty-sub explicam o contexto vazio. ui-message aceita data-tone error/success, com papel de anúncio escolhido conforme o evento, sem anunciar toda a página.

Overlays legados devem ter nome acessível e botão de fechar ligado ao editor. Nunca fechar todos os overlays diretamente ao pressionar Escape. Dialogs nativos continuam preferíveis em módulos novos. Regiões de tabela precisam conter a tabela, sem transformar a tabela semântica em role region.

## Validação registrada

- npm test aprovado: 171 testes do runner, checks adicionais e identidade do cache (111 arquivos).
- design-system.browser.html + design-system-browser-runner.js: desktop 1440px e celulares 390/320px, claro/escuro, contraste mínimo 4,5:1 do botão principal e texto auxiliar amostrados, alvos de 44px, modais dentro da tela, foco/Tab/retorno, Escape real, cancel nativo com guard, tabelas e movimento reduzido.
- Fixtures shell, Equipe360, PDI, Ponto, diagnóstico, Panorama/filtros, atividades e lazy modules passaram em desktop e celular.
- Smoke do HTML completo com Supabase simulado: 13 abas sem exceções, perfil e busca rápida (Tab/Escape/retorno), sem overflow global nas amostras Home desktop, Ponto escuro 390px e Equipe 320px. Capturas dessas amostras e do catálogo foram inspecionadas.

Para repetir o runner, servir este repositório em localhost:8765 e usar um Chrome isolado na porta 9228; executar node --experimental-websocket tests/design-system-browser-runner.js. Fixtures não acessam o banco de produção. O runner de navegador permanece separado de npm test.

## Conclusão da Fase 6 — 1.19.1

Retomada na mesma branch dedicada, a partir de a78b1fb (1.19.0 publicada). Esta rodada conclui o escopo de consolidação planejado para a Fase 6. A Fase 7 ainda não foi iniciada.

- No celular, o submenu fica em uma faixa horizontal. A seleção ativa e a opção focada por setas são reveladas pela rolagem da própria faixa, sem rolar a página. IDs, callbacks e permissões permanecem.
- O botão Mostrar/Recolher filtros mantém o texto em uma linha; a explicação pode ocupar outra linha em telas estreitas. Abaixo de 600px, o título fica em uma linha própria do cabeçalho, sem sobreposição das ações.
- Foram removidas mais 387 linhas do antigo shell/sidebar ADM e de seu modo recolhido. shell.css passa a definir explicitamente os contratos atuais; estilos históricos de módulos ainda existem, sem necessidade de reescrever todo o CSS nesta entrega.
- Equipe e seu skeleton usam grade que respeita a largura disponível. Cards de Mapeamento aceitam nomes extensos e seus modais usam o controle compartilhado de foco; campos têm labels associados e botões usam a altura dos tokens.
- A Home destrói a instância anterior do gráfico antes de substituir o canvas e descarta callbacks cujo canvas já saiu da tela. O plugin de rótulos fica local aos gráficos setoriais, evitando registrar um plugin global depois que outros gráficos já existem.
- A leitura de metas deixou de chamar saveMetas: consultar metas vazias ou preenchidas não dispara regravação/DELETE no servidor. A edição explícita continua usando o contrato existente.
- Regiões de rolagem não substituem a semântica de elementos table. Fixtures que ainda usavam visual-refresh.css foram alinhadas a components.css; interface-assets.check.js impede referências locais ausentes.

## Validação da conclusão

npm test: 171 testes do runner e todos os checks, incluindo interface-assets e metas-read; release:check e git diff --check aprovados. A identidade do cache cobre 111 arquivos locais.

Fixtures de shell (13 destinos/papéis/filtros), Equipe360, PDI, Ponto, diagnóstico, Panorama, atividades e lazy modules passaram em 320px e 1440px. O shell acrescenta asserts de faixa única, seleção revelada e botão de filtros sem quebra. O catálogo verifica os temas, foco e semântica de tabelas.

workspace-ux.browser.html carrega o HTML completo e as bibliotecas CDN reais, com sessão e dados inteiramente simulados em memória. Testa 72 registros, 12 nomes extensos, 13 abas, gráficos reais, geração de PNG decodificável, backup CSV com todas as linhas, HTML de impressão com setor, relatório com filtros explícitos, cadastro, editores de perfil/Mapeamento, Ponto e setas no submenu. Métodos de escrita no cliente simulado lançam erro. Essa fixture passou em 320px, 390px e 1440px, com amostras nos temas claro/escuro.

## Limites e continuidade

A verificação de contraste é amostral, sem auditoria WCAG completa ou teste com leitor de tela. Os testes desta retomada usaram o navegador Chromium integrado; Firefox e Safari não foram executados. O HTML de impressão foi validado, sem imprimir fisicamente ou certificar paginação de PDF em todos os navegadores. Integrações/RLS de produção não são validadas pelas fixtures.

O próximo ciclo é a Fase 7 — Cockpit gerencial. Começar pelo roadmap e pelos contratos de dados existentes. Não mudar scoring, metas de negócio ou interpretação de volume como parte de um refinamento visual. Merge continua exigindo autorização explícita; esta rodada registra commit/push, sem novo deploy.

## Publicação posterior

A conclusão 1.19.1 (c4c782a) foi publicada em 28/10/2026, após autorização explícita, antes de iniciar a Fase 7. HTML, app, shell, Home e service worker foram conferidos por hash na URL de produção. Registro do cockpit em [cockpit.md](cockpit.md).

## Ajuste 1.36.1 — Campos do registro mensal

Campos numéricos de Novo registro ampliados para 8rem, tempos para 13rem e observações para 15rem, com fonte de 16px e algarismos tabulares. Nome do colaborador quebra linha; a primeira coluna acompanha a rolagem para não cobrir os campos. Sem alteração de valores, validações ou salvamento. Verificação visual com números de oito dígitos, notas decimais e tempos extensos em desktop e 320px; npm test e regressão workspace/design-system.

## Ajuste 1.40.0 — Refresh visual da casca

Palette, raios, tipografia e elevação revisados nos tokens compartilhados. A casca ganha topbar com profundidade suave, domínios em pílula, abas ativas com limite explícito, filtros e cards com borda mais definida e KPIs com faixa superior. Login e tela de importação usam o mesmo acento institucional, com `theme-color` e manifest alinhados. Nenhum ID, dado, regra de cálculo ou handler foi alterado. Assets versionados em `?v=1394`; validar npm test, release:check e fixtures de design-system/shell/workspace em claro/escuro, desktop e celular.

## Ajuste 1.41.0 — Sistema visual de trabalho

Camada isolada em `static/css/visual-system.css`, carregada por último. A casca passa a usar hierarquia editorial com Plus Jakarta Sans em títulos e Inter em dados, topbar translúcida, navegação por áreas em segmentos, submenus em trilho único, barra de filtros elevada e conteúdo centralizado com largura máxima. Cards, KPIs, tabelas, botões, campos, diálogos, login e importação compartilham raios, superfícies, sombras e estados de foco coerentes. O tema escuro usa superfícies profundas e brilho contido; movimento respeita `prefers-reduced-motion`. Referências: Linear, Vercel/Geist, Stripe, Attio e Raycast. IDs, atributos ARIA, delegação de eventos, regras de negócio e persistência permanecem intactos. Assets versionados em `?v=1400`; validar npm test, release:check e fixtures de design-system/shell/workspace em claro/escuro, desktop e celular.

## Ajuste 1.42.0 — Alinhamento e interações

Barra global sem sobreposição entre busca e ação, com campo elástico e botões em largura fixa. Cards de Equipe usam grade flexível, rodapé de ações alinhado na base e botões de mesma largura. Score médio do Relatório Setorial e scores das tabelas abrem detalhamento: a média geral mostra os scores por setor; o score de um setor mostra média por pessoa e avaliações individuais. A preferência de cor de destaque fica no menu do usuário, com presets discretos e isolados por sessão via `appStorage`; a cor também é aplicada ao `theme-color`. Nenhuma regra de cálculo, filtro ou persistência de negócio foi alterada. Assets versionados em `?v=1401`; validar npm test, release:check, auditoria de sobreposição e fixtures de shell/workspace/design-system em claro/escuro, desktop e celular.

## Ajuste 1.43.0 — Ranking privado de destaques

Visão da equipe ganha ranking administrativo de reconhecimentos com ordenação explícita e filtro por mês. Colaborador, finalizações, score e produtividade vêm do recorte atual; contagens e motivos vêm das Atividades do mês da própria conta admin, sem leitura de registros de outras contas. O botão Anotar abre o registro já direcionado à pessoa e ao mês. Para viewers o bloco não existe. Validar npm test, release:check e fixtures de workspace/atividades em desktop e celular.

## Ajuste 1.43.1 — Destaque no ranking

O painel de ranking privado agora acompanha explicitamente a cor de destaque escolhida no menu do usuário: faixa superior, selo privado e posições usam `--accent`, respeitando os temas claro/escuro. Fixture `workspace-ux.browser.html?ranking=1` verifica a troca no seletor, o token CSS, o `theme-color`, a preferência salva e a reapresentação no ranking.

## Ajuste 1.44.0 — Cor de destaque fácil de encontrar

O seletor passou a ficar diretamente na barra superior, com ícone na cor ativa e rótulo curto "Cor" (oculto abaixo de 900px). O menu do usuário mantém apenas o atalho "Cor de destaque", que fecha o menu e foca/exibe o seletor visível. `app-interface.js` usa `.accent-select` para sincronizar valor, `theme-color`, `appStorage` e gráficos. Assets versionados em `?v=1395`; validar release:check, workspace-ux (`?ranking=1` e geral), shell, design-system e lazy-modules em desktop/celular.

## Ajuste 1.44.1 — Nome da cor sem corte

Largura do seletor ampliada para acomodar "Padrão", "Violeta", "Azul" e "Âmbar" inclusive com a seta nativa; em telas estreitas o rótulo "Cor" continua oculto, mas o campo mantém largura mínima. Assets versionados em `?v=1396`; fixture `workspace-ux.browser.html` verifica a largura mínima no fluxo geral e no modo `?ranking=1`.
