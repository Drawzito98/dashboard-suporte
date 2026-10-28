# Fase 6 — Design System / UX

Versão 1.19.0, branch `feat/fase6-design-system`, baseada na Fase 5 (b814a88).
O usuário solicitou encerrar este ciclo com commit e deploy e retomar após renovar créditos. A base compartilhada está implementada; os refinamentos restantes estão abaixo. Não foi solicitado merge.

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

## Retomada da Fase 6

1. Rever o submenu de Pessoas no celular: as seis opções ainda podem ocupar várias linhas. Avaliar rolagem horizontal com a opção ativa revelada, preservando navegação por teclado.
2. Refinar o botão de recolher filtros em telas de 320px para evitar quebra excessiva do texto.
3. Remover gradualmente as outras camadas históricas da antiga sidebar em styles.css. A remoção neste ciclo foi seletiva; não é uma reescrita completa do CSS.
4. Ampliar a revisão visual para estados com dados extensos, mensagens específicas e cada editor. A verificação de contraste atual é por amostras; não representa auditoria WCAG completa nem teste com leitor de tela.
5. Conferir gráficos reais/CDNs, exportações, impressão e teclado em outros navegadores. O smoke isolado não valida biblioteca de gráficos nem autorização/RLS publicados.

Depois desses refinamentos, atualizar o roadmap antes de seguir para o Cockpit gerencial (Fase 7).
