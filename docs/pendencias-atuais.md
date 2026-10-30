# Estado atual — 1.35.0

Revisão de 30/10/2026. Este documento reúne as pendências atuais; entradas antigas do roadmap registram o estado de cada entrega na época.

As sete fases originais têm entregas funcionais nos escopos documentados. A consolidação permanece gradual: não há garantia universal de confirmação/fila para toda gravação do aplicativo.

## Entrega desta rodada

Home mostra atendimentos finalizados, em vez de linhas de CSV, e quantas pessoas têm Score no recorte. Zero continua válido e ausência aparece como travessão. A média simples por pessoa, filtros, alertas e fórmulas permanecem iguais. A contagem de linhas está nas fontes, explicitamente distinta de atendimentos/avaliações. Equipes pode ser expandida por teclado ou toque e mantém a abertura durante atualizações. Avisos de fonte/cobertura continuam visíveis. Agenda usa o cadastro confirmado, inclusive quando o cache não acompanha a atualização.

## Próximos ajustes, em ordem

1. Histórico/notificações receberam confirmação e mensagens de falha em 1.35.0; contratos e limites em [historico-notificacoes-confirmados.md](historico-notificacoes-confirmados.md). Seguem fora do escopo auditoria transacional do banco, entrega garantida de notificações e revisão integral de todos os fluxos automáticos.
2. Carga inicial: medir dependências e tempos antes de reduzir scripts/globais. Inventário atual: 88 scripts externos ao HTML (81 locais e 7 remotos), app.js aproximadamente 106 KB, styles.css aproximadamente 184 KB. Nenhuma redução de tempo de carregamento foi medida nesta rodada.
3. CSS e componentes: continuar unificação gradual de modais/tabelas e conferir acessibilidade por fluxo. Testes amostrais não equivalem a certificação WCAG ou cobertura de todos os navegadores.

## Limites mantidos

Principais formulários receberam confirmação e rascunhos nas versões 1.21–1.33; outros fluxos automáticos/legados não foram auditados integralmente. A fila durável por revisão cobre indicadores; não prometer fila universal ou trava entre dispositivos. PDI permanece local por conta/dispositivo. Panorama continua desativado; reuso depende de definir o CSV e seu destino. Nenhuma migration/RLS ou regra de negócio foi alterada. Não executar testes de escrita em produção. Merge exige autorização explícita.

## Validação

npm test e release:check, fixture workspace com cockpit (desktop e 320px, incluindo troca de sessão), workspace geral, design-system, data-lifecycle e lazy-modules. Dados das fixtures são simulados; a publicação deve ser conferida pela identidade dos arquivos estáticos.
