# Atividades do mês

- Menu: Operação e pessoas → Atividades do mês.
- Persistência: subtipo privado de `anotacoes_diarias`, com `user_id` do gestor, `data` no primeiro dia do mês e `conteudo` com prefixo `atividade-colaborador:v1:` seguido de JSON (`colaborador`, `tipo`, `descricao`). Usa a política RLS existente de notas próprias. Nenhuma migração necessária.
- O carregador de anotações comuns exclui esse prefixo. Atividades são carregadas diretamente do servidor, sem cache local compartilhado entre contas; falhas não geram confirmação de salvamento.
- Feedbacks e Gerar sugestão do Relatório Feedback carregam os registros atuais e incluem apenas a pessoa e o mês selecionados. Feedbacks já salvos mantêm o texto até serem gerados/editados novamente.

## Validação

`node tests/runner.js` cobre normalização de período, conteúdo persistido e seleção para feedback.

Abra `tests/atividades-mes.browser.html` em um navegador com acesso aos scripts locais. O resultado deve ser `PASS`. A página usa dados fictícios e simula o Supabase; não acessa contas nem modifica dados reais. Valida criação, edição, exclusão, mês/pessoa, falha de salvamento, escape de HTML e geração de feedback sem métricas importadas. Não verifica a política RLS no servidor real.
