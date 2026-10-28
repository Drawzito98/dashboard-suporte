# Inventário funcional

Baseline local de 28/10/2026. As 13 entradas de navegação em `index.html` são:

| Área | Responsabilidade / fontes principais |
|---|---|
| Início | cockpit, atalhos e indicadores — home.js |
| Dashboard | importações, filtros, gráficos e tabela — app.js, csv-import.js, reports.js |
| Panorama / relatório setorial | análise por equipe/período — panorama-suporte.js, relatorio-setorial.js |
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
