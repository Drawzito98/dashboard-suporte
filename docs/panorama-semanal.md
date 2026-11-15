# Panorama semanal do suporte

Na aba **Desempenho → Panorama semanal**, selecione o ZIP de exportação do Looker/Opa! e clique em **Analisar ZIP**. A prévia mostra o período observado no relatório diário, os indicadores do recorte e as divergências. A leitura ocorre no navegador e a prévia fica em memória. O Panorama usa o ZIP como única entrada. O formulário avulso de CSV por colaborador fica recolhido no Relatório Setorial.

A seção **Análise da semana** resume os destaques do recorte e mostra volume diário, mapa de horários, departamentos, equipe, motivos, avaliações e plantão. Os nomes da equipe aparecem por padrão no Panorama semanal e podem ser ocultados na própria tabela. Os destaques informam a base usada nos percentuais.

A meta de nota média é 4,70 em escala de 1 a 5. O relatório confere o cartão do Looker com a média ponderada das estrelas quando a distribuição reconcilia com o total de avaliados. No ZIP de referência, o cartão tem 4,71 e as 129 avaliações da distribuição produzem 4,49. O destaque sinaliza a divergência e mostra a distância de cada valor à meta.

A visão inicial **Resumo** mostra período, finalizados, nota geral frente à meta e destaques. Use **Equipe**, **Departamentos**, **Operação** e **Conferência** para visualizar um recorte da interface por vez. A origem das notas fica em **Conferência dos dados e avisos**. Abra as seções de volume, equipe, motivos, avaliações e plantão para consultar os detalhes. Os cartões do Looker ficam em **Indicadores complementares e tempos**. A conferência reúne diferenças de escopo, cobertura e validação em uma seção própria.

O leitor aceita o período completo identificado no CSV de volume diário, inclusive recortes com mais de sete dias. A tabela de equipe usa a coluna **Média aval.** de **Performance por colaborador** e segue a ordem de assumidos. A média geral vem do cartão do cliente e é comparada com a média ponderada das estrelas.

As seções **Equipe** e **Departamentos** mostram notas, finalizados e tempos exportados. O filtro de departamento seleciona a linha exata do relatório do Looker. Na Equipe, combine pessoa, N1/N2 e departamento atual do cadastro. Os valores exibidos são os totais da pessoa no ZIP, inclusive quando o filtro de cadastro está ativo. O ZIP não traz um cruzamento completo de pessoa, departamento, horários e motivos. O filtro N1/N2 usa o cadastro do app e afeta a tabela de pessoas. O nome completo tem prioridade. Um nome abreviado com pelo menos duas palavras só é associado quando corresponde a um único cadastro. Sem contagens de avaliações por atendente, o filtro não recalcula as notas do setor nem a média geral. A meta usa a média das estrelas quando o cálculo é corroborado pelas notas dos departamentos ponderadas pela quantidade de avaliações.

A conferência de finalizados compara o cartão, o volume diário e as somas por pessoa e departamento. A concordância entre relatórios não valida a contagem de protocolos no Opa! Suite. As siglas dos tempos têm legenda nos cabeçalhos e em **Todos os indicadores**.

Na Equipe, ordene por volume de finalizados ou por nota, com maiores ou menores notas primeiro. Os tempos aparecem por padrão e podem ser recolhidos. **Exportar planilha** baixa um XLSX com o resumo, a equipe e os departamentos conforme os filtros, além do volume diário e dos motivos do recorte. No Google Planilhas, use **Arquivo → Importar → Fazer upload**.

Na Equipe, a meta de volume vale para quem está cadastrado como N1. A base é de 280 finalizados em 24 dias de trabalho. A projeção conta de segunda a sábado no intervalo inclusivo do ZIP, com teto de 24 dias por mês e arredondamento para cima. Feriados e escalas individuais não entram. Em um recorte de cinco dias de segunda a sábado, a meta é 59. O saldo compara o total da pessoa no ZIP com a meta proporcional. N2 e pessoas sem nível identificado ficam sem saldo. A exportação XLSX inclui a meta e o saldo numérico por pessoa. O saldo vermelho indica que faltam finalizados e o verde indica meta atingida ou superada. Em **Ordenar por**, escolha **Meta N1 · mais finalizados faltando** para ver os maiores déficits primeiro.

Na Equipe, administradores podem abrir **Observações e ausências do recorte** e registrar um contexto datado para um N1 identificado no cadastro. As observações são privadas da conta, reaparecem ao analisar outro ZIP que inclua a data e ficam fora da planilha. O painel também consulta as ausências sincronizadas no mesmo intervalo. Em **Ferramentas → Agenda e presença → Ausências**, registre a pessoa, data, período e motivo, incluindo atrasos no campo de motivo. Volte ao Panorama e clique em **Atualizar registros** para conferir. Observações e ausências contextualizam o resultado sem alterar a meta, o volume ou a nota.

O Resumo usa cartões compactos, barras diárias de assumidos e finalizados, mapa de horários e rankings de motivos e notas. Os valores vêm do ZIP atual. A conferência sinaliza divergências entre as fontes exportadas; a apresentação não replica números ou variações do HTML de referência.

## Catálogo dos relatórios

O ZIP de referência contém 35 CSVs UTF-8 separados por vírgula, dentro de uma pasta. O leitor aceita pastas internas e valida pelo nome do arquivo. Os dois heatmaps aceitam um subconjunto dos sete dias em qualquer ordem. Os relatórios diário e mensal podem trazer uma linha adicional de rótulos do Looker.

| CSV | Colunas, na ordem do exportador |
| --- | --- |
| `atendimentos_assumidos.csv` | `Support Volume Assumidos`, `Support Volume Assumidos Var. %` |
| `comparativo_de_período.csv` | `Indicador`, `Atual`, `Anterior`, `Var.` |
| `plantão__diurno_×_noturno.csv` | `Atendimento Turno do Plantão`, `Atendimentos` |
| `volume__assumidos_vs._finalizados_(12_meses).csv` | `Evento`, `Assumidos`, `Finalizados` |
| `atendimentos_finalizados.csv` | `Atendimento Detalhamento sobre atendimentos finalizados`, `Atendimento Finalizados Var. %` |
| `atendimentos_com_cartão.csv` | `Atendimento Cartão (situação)`, `Atendimentos` |
| `avaliação_por_colaborador__ia_×_cliente.csv` | `Atendente`, `Média IA`, `Notas baixas IA`, `Média cliente`, `Notas baixas cliente`, `Gap`, `Taxa aval.` |
| `custo_médio_por_atendimento.csv` | `Atendimento Detalhamento sobre o custo por atendimento`, `Atendimento Custo Médio Var. %` |
| `análise_livre.csv` | `Protocolo`, `Data de referência`, `Departamento`, `Atendente`, `Quem atendeu`, `Cliente`, `Motivo`, `Status`, `TME`, `Por que sem TME`, `TMI`, `TMR`, `★ Cliente`, `★ IA`, `Cartão`, `Transf.`, `Resolveu o problema?` |
| `atendimentos_por_dia.csv` | `Evento`, `Assumidos`, `Finalizados` |
| `transferências_enviadas_por_departamento.csv` | `Tipo de Transferência Enviada`, `Para outro atendente ou a I.A.`, `Para outro departamento` |
| `transferências_enviadas_por_colaborador.csv` | `Tipo de Transferência Enviada`, `Para outro atendente ou a I.A.`, `Para outro departamento` |
| `performance_por_colaborador.csv` | `Atendente`, `Assumidos`, `Finalizados`, `Transferidos`, `Clientes`, `Média aval.`, `TMA`, `TMA I.A.`, `TMI`, `TMR` |
| `encerrados_por_inatividade.csv` | `Atendimento Detalhamento sobre encerrados por inatividade`, `Atendimento % Encerrados por Inatividade` |
| `pesquisa_de_resolução_(fcr).csv` | `Atendimento Pesquisa de Resolução (situação)`, `Atendimentos` |
| `performance_por_departamento.csv` | `Departamento`, `Assumidos`, `Finalizados`, `Transferidos`, `TMA`, `TMA I.A.`, `TMR`, `Score`, `Avaliados`, `Enc. inatividade`, `% Enc.` |
| `tm_encerramento_por_inatividade.csv` | `Atendimento Detalhamento sobre o encerramento por inatividade`, `Atendimento Padrão de Encerramento por Inatividade` |
| `tme_·_tempo_médio_de_espera.csv` | `Atendimento Detalhamento sobre o tempo médio de espera (TME)`, `Atendimento TME Var. %` |
| `assumidos_por_dia_×_hora.csv` | `Dia da Semana do Evento`, `Ter`, `Qua`, `Qui`, `Sex`, `Sáb`, `Dom` |
| `score_médio_(cliente).csv` | `Atendimento Detalhamento sobre o score do cliente`, `Atendimento Score Médio Dif.` |
| `custo_com_integrações.csv` | `Custo da Integração Detalhamento sobre o custo com integrações`, `Custo da Integração Custo com Integrações Var. %` |
| `distribuição_de_notas_por_estrela.csv` | `★ Cliente (estrelas)`, `Notas 4 e 5 (cliente)`, `Nota 3 (cliente)`, `Notas Baixas Cliente (1–2)` |
| `motivos_de_atendimento.csv` | `Motivo`, `Finalizados`, `TME`, `TMR` |
| `recorrência_por_motivo.csv` | `Motivo`, `Taxa de Recorrência (mesmo motivo)` |
| `abertos_por_dia_×_hora.csv` | `Abertura Dia da Semana`, `Seg`, `Ter`, `Qua`, `Qui`, `Sex`, `Sáb` |
| `cartões_do_jira_citados.csv` | `Cartão`, `Projeto`, `Atendimentos` |
| `avaliação_do_cliente_(estrelas).csv` | `Atendimento Avaliação do Cliente (situação)`, `Atendimentos` |
| `clientes_atendidos.csv` | `Atendimento Detalhamento sobre clientes atendidos`, `Atendimento Clientes Atendidos Var. %` |
| `taxa_de_recorrência.csv` | `Atendimento Detalhamento sobre a taxa de recorrência`, `Atendimento Taxa de Recorrência mesmo motivo Var. %` |
| `tmi_·_tempo_médio_de_interação.csv` | `Turno de Conversa (TMI) Detalhamento sobre o tempo médio de interação (TMI)`, `Turno de Conversa (TMI) TMI Var. %` |
| `tempo_de_fila_por_faixa.csv` | `TME Faixa`, `Até 30 min`, `De 30 a 60 min`, `Acima de 60 min` |
| `total_de_atendimentos_no_recorte.csv` | `Atendimento Detalhamento sobre atendimentos` |
| `plantão__resolvidos_×_repassados.csv` | `Atendimento Desfecho do Plantão`, `Trechos` |
| `sla_do_plantão_(2h).csv` | `Atendimento % no SLA do Plantão (2h)`, `Atendimento % no SLA do Plantão Dif. (p.p.)` |
| `tmr_·_tempo_médio_de_resolução.csv` | `Atendimento Detalhamento sobre o tempo médio de resolução (TMR)`, `Atendimento TMR Var. %` |

## Conferências do ZIP de referência

- Total no recorte, assumidos e finalizados são indicadores distintos. Os relatórios diário, de colaboradores e de departamentos conferem 460 assumidos e 460 finalizados.
- As 129 avaliações conferem entre situação da avaliação, departamentos e distribuição por estrelas. Os departamentos conferem também os 354 encerramentos por inatividade. As faixas de TME somam 43 atendimentos.
- O comparativo aponta 1.308 finalizados, a série de 12 meses contém apenas novembro e a análise livre tem 200 linhas. Essas fontes geram avisos e seus valores não substituem os KPIs semanais.
- Ausência ou falha de schema em um relatório necessário aos indicadores gera erro. Avisos registram arquivos não reconhecidos, falhas em relatórios auxiliares e os recortes divergentes conhecidos.

## Contrato para a próxima etapa

`analyzeWeekly(entries)` recebe entradas `{ name, text }` e retorna `{ schemaVersion, period, kpis, days, analysis, files, issues, valid }`. O período usa datas ISO, as durações usam segundos e as taxas usam pontos percentuais na escala 0–100. Cada ocorrência tem `severity`, `code`, `file` e `message`. A análise da prévia usa agregados e linhas de relatórios resumidos. Ela pode conter nomes da equipe e fica somente em memória. Para persistência, definir uma projeção própria que exclua dados pessoais desnecessários.

Próxima etapa do roadmap: confirmar o período e o escopo operacional, projetar uma chave de importação idempotente, definir autorização e RLS, salvar somente agregados de prévias válidas com confirmação do usuário e adicionar histórico e comparações de semanas. Definir previamente o comportamento em caso de reimportação corrigida.

## Teste de regressão

Execute `node tests/panorama-semanal.check.mjs "/caminho/dados_da_semana.zip"` com Node.js 22 ou mais recente e o ZIP de referência original. O ZIP contém dados operacionais e fica fora do repositório.
