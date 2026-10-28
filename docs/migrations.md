# Migrations — catálogo e procedimento

Os arquivos históricos permanecem na raiz para preservar referências. Há uma sequência `migration.sql`, `migration_v2.sql` até `migration_v49.sql` e um consolidado `migration_completa.sql`. A ordem é numérica, não lexicográfica. O consolidado é legado: não presumir que substitui a sequência completa nem executar ambos sem comparar conteúdo e estado do banco.

Esta fase não executa, renomeia ou reescreve SQL. A existência de um arquivo não prova sua aplicação. O README anterior informa v49 aplicada em 22/10/2026; isso não foi verificado nesta sessão.

## Catálogo histórico

- `migration.sql` — Migration: Adicionar suporte a múltiplos usuários
- `migration_v2.sql` — Migration v2: Persistência de configurações, comentários, histórico e preferências
- `migration_v3.sql` — Migration v3: Tabela de feedbacks
- `migration_v4.sql` — migration_v4.sql — Anotações Diárias
- `migration_v5.sql` — migration_v5.sql — Tarefas / Agenda
- `migration_v6.sql` — migration_v6.sql — Tabela pontos_extras (bônus manuais)
- `migration_v7.sql` — migration_v7.sql — Tabela colaboradores_info (dados cadastrais)
- `migration_v8.sql` — migration_v8.sql — Adiciona colunas de conduta negativa
- `migration_v9.sql` — Migration v9: month reference for bonus/penalties
- `migration_v10.sql` — Migration v10: add IA suggestions and final comments columns to avaliacoes
- `migration_v11.sql` — Migration v11: ensure observacoes_competencias and add avaliacao_qualitativa column
- `migration_v12.sql` — Migration v12: Notificações + feedbacks/avaliações acessíveis por admin
- `migration_v13.sql` — Migration v13: Tabela reportes (canal de comunicação externo)
- `migration_v14.sql` — Migration v14: Adiciona campos data e imagem nos reportes + bucket storage
- `migration_v15.sql` — Migration v15: Simplifica RLS dos reportes
- `migration_v16.sql` — Migration v16: DELETE RLS para reportes
- `migration_v17.sql` — Migration v17: Adiciona categoria e prioridade aos reportes
- `migration_v18.sql` — Migration v18: Tabela links_importantes (links salvos pelo usuário)
- `migration_v19.sql` — migration_v19.sql — Tabela ausencias (registro de faltas/ausências)
- `migration_v20.sql` — migration_v20.sql — Tabela avaliacao_atendimentos + RLS
- `migration_v21.sql` — migration_v21.sql — Adiciona coluna imagem em avaliacao_atendimentos
- `migration_v22.sql` — migration_v22.sql — Tabela ferias + RLS
- `migration_v23.sql` — migration_v23.sql — Tabela acompanhamento_diario + RLS
- `migration_v24.sql` — migration_v24.sql — Adiciona coluna nivel em colaboradores_info
- `migration_v25.sql` — Migration v25: Índices para performance + limpeza de dados duplicados
- `migration_v26.sql` — Migration v26: Colunas TMA e TMR na tabela registros
- `migration_v27.sql` — Migration v27: Campos extras em avaliacao_atendimentos
- `migration_v28.sql` — Migration v28: Coluna status em avaliacoes
- `migration_v29.sql` — Migration v29: check-in de clima e desafio diário dos colaboradores
- `migration_v30.sql` — Migration v30: adiciona o registro positivo de feitos relevantes ao perfil
- `migration_v31.sql` — Migration v31: endurecimento de segurança e compatibilidade de feitos relevantes
- `migration_v32.sql` — Migration v32: setor atual informado no cadastro do colaborador
- `migration_v33.sql` — Rotinas recorrentes e chat privado entre administração e colaboradores.
- `migration_v34.sql` — Imagens e limpeza de mensagens do chat privado.
- `migration_v35.sql` — Notificações de novas mensagens do chat.
- `migration_v36.sql` — Limpeza individual do histórico do chat.
- `migration_v37.sql` — Reações privadas nas mensagens do chat.
- `migration_v38.sql` — Amplia as opções permitidas de reação no chat.
- `migration_v39.sql` — Chat completo: anexos privados, respostas, leitura e integridade de mensagens.
- `migration_v40.sql` — Uma reação por usuário em cada mensagem; trocar substitui a anterior.
- `migration_v41.sql` — Permite ao remetente editar apenas o texto da própria mensagem.
- `migration_v42.sql` — Volta a tornar o conteúdo das mensagens totalmente imutável após o envio.
- `migration_v43.sql` — Migration v43: quadro compartilhado de regras
- `migration_v44.sql` — Migration v44: etiquetas e favoritos nas anotações
- `migration_v45.sql` — Salário no cadastro de colaboradores; mantém as políticas de acesso existentes.
- `migration_v46.sql` — Auditoria de Ponto — MVP. Aditiva: não altera tabelas existentes.
- `migration_v47.sql` — Importação estruturada sem retenção de PDF + justificativas relacionadas.
- `migration_v48.sql` — Tolerâncias da auditoria por líder; preserva snapshots e análises anteriores.
- `migration_v49.sql` — Diagnóstico gerencial: somente revisões. Não altera tabelas ou políticas existentes.
- `migration_completa.sql` — consolidado legado; comparar com a sequência antes de qualquer uso

## Próxima mudança de esquema

Criar novo número sem editar migrations já aplicadas; documentar dependências, impacto, permissões e recuperação. Confirmar o histórico real no ambiente de destino, revisar SQL e testar em ambiente isolado antes de solicitar autorização para produção. Não usar ordenação alfabética nem scripts de aplicação automática indiscriminada. Testes SQL de RLS são separados e exigem banco apropriado; não integram npm test.
