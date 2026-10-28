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
