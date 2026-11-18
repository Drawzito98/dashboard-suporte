# Estado atual — 1.36.0

Revisão de 30/10/2026. Este documento reúne as pendências atuais; entradas antigas do roadmap registram o estado de cada entrega na época.

As sete fases originais têm entregas funcionais nos escopos documentados. A consolidação permanece gradual: não há garantia universal de confirmação/fila para toda gravação do aplicativo.

## Entrega desta rodada

Home mostra atendimentos finalizados, em vez de linhas de CSV, e quantas pessoas têm Score no recorte. Zero continua válido e ausência aparece como travessão. A média simples por pessoa, filtros, alertas e fórmulas permanecem iguais. A contagem de linhas está nas fontes, explicitamente distinta de atendimentos/avaliações. Equipes pode ser expandida por teclado ou toque e mantém a abertura durante atualizações. Avisos de fonte/cobertura continuam visíveis. Agenda usa o cadastro confirmado, inclusive quando o cache não acompanha a atualização.

## Próximos ajustes, em ordem

1. Histórico/notificações receberam confirmação e mensagens de falha em 1.35.0; contratos e limites em [historico-notificacoes-confirmados.md](historico-notificacoes-confirmados.md). Seguem fora do escopo auditoria transacional do banco, entrega garantida de notificações e revisão integral de todos os fluxos automáticos.
2. Carga inicial: PNG/PDF/Excel passaram para demanda em 1.36.0, reduzindo os scripts remotos iniciais de 7 para 4. Evidência e limites em [carregamento-inicial.md](carregamento-inicial.md). Ainda há cerca de 1,16 MB de scripts locais iniciais; próxima redução exige mapear dependências de áreas/gráficos, sem estimar ganhos de tempo ainda não medidos.
3. CSS e componentes: continuar unificação gradual de modais/tabelas e conferir acessibilidade por fluxo. Testes amostrais não equivalem a certificação WCAG ou cobertura de todos os navegadores.

## Limites mantidos

Principais formulários receberam confirmação e rascunhos nas versões 1.21–1.33; outros fluxos automáticos/legados não foram auditados integralmente. A fila durável por revisão cobre indicadores; não prometer fila universal ou trava entre dispositivos. PDI permanece local por conta/dispositivo. Panorama continua desativado; reuso depende de definir o CSV e seu destino. Nenhuma migration/RLS ou regra de negócio foi alterada. Não executar testes de escrita em produção. Merge exige autorização explícita.

## Validação

npm test e release:check, fixture workspace com cockpit (desktop e 320px, incluindo troca de sessão), workspace geral, design-system, data-lifecycle e lazy-modules. Dados das fixtures são simulados; a publicação deve ser conferida pela identidade dos arquivos estáticos.
