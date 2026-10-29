# Inventário funcional

Baseline local de 28/10/2026. As 13 entradas de navegação em `index.html` são:

| Área | Responsabilidade / fontes principais |
|---|---|
| Início | cockpit, atalhos e indicadores — home.js |
| Dashboard | importações, filtros, gráficos e tabela — app.js, csv-import.js, reports.js |
| Relatório setorial | análise por equipe/período — relatorio-setorial.js; Panorama parcial retirado da interface em 1.20.1, implementação preservada para eventual reuso |
| Saúde Operacional | indicadores e acompanhamento — saude-operacional.js, indicator-health-v3.js |
| Rotina / tarefas | agenda, atividades e notas — tarefas.js, rotina-cards.js, atividades-mes.js, anotacoes.js |
| Regras | regras operacionais — regras.js |
| Auditoria de Ponto | importação PDF, jornadas, conferência — ponto.js, ponto-engine.js |
| Colaboradores | cadastro, ausências, férias e detalhes — colaboradores.js, colab-detail.js, ferias.js, ausencias.js |
| Liderança | acompanhamento gerencial — painelLider.js |
| Insights | análises e diagnóstico — insights.js, diagnostico-*.js |
| Avaliação | competências e feedback — avaliacao.js, feedbacks.js |
| Perfil e PDI | fontes, planos e versões — perfil-pdi.js, perfil-pdi-engine.js |
| Mapeamento do time | associação de pessoas/fontes — mapeamento-time.js |

Gamificação, metas, bônus, histórico, comentários, notificações, usuários, reportes e ferramentas de gestão também existem como módulos, ações contextuais ou overlays. Filtros globais, autenticação, permissões, modo reunião, privacidade, sincronização e PWA atravessam várias áreas. Este inventário descreve o código, não garante disponibilidade igual para todos os papéis.

## Organização na Fase 2

As 13 telas acima permanecem, agora agrupadas em Início, Operação, Pessoas e Rotina. Ferramentas transversais ficam no painel sob demanda. Consulte [navegação](navigation.md) para o mapa e os contratos preservados.

## Organização na Fase 3

O acesso principal de cada pessoa abre a Equipe 360º: visão geral, desempenho, desenvolvimento, presença/ponto e histórico/fontes. Edição de cadastro continua explícita. Os módulos e históricos anteriores permanecem; o perfil não cria uma cópia persistida. Consulte [Equipe 360º](equipe-360.md).

## Continuação 1.22.0

Operação passa a Visão geral, Análises e Metas. A nova tela de Metas usa o editor existente e os contratos de confirmação de 1.21.0. Os 13 destinos anteriores permanecem, com três visualizações dentro de Análises. Ver [operacao-e-metas.md](operacao-e-metas.md).
