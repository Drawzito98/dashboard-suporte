# Fase 4 — Arquitetura de dados

Branch `feat/fase4-arquitetura-dados`, baseada na Fase 3 (`10bfc12`). Versão 1.17.0. Implementação gradual, sem framework, migration, merge ou deploy.

## Responsabilidades introduzidas

| Componente | Responsabilidade |
|---|---|
| `data-runtime.js` / `AppDataSession` | Dono da sessão, geração de invalidação, armazenamento por conta e eventos |
| `AppState` | Snapshots defensivos dos indicadores e do perfil 360º em memória; publicação e assinatura por recurso |
| `appStorage` | Interface explícita de armazenamento dos módulos antigos, sem modificar a API nativa do navegador |
| `records-repository.js` | Leitura paginada, snapshot confirmado, projeção com pendências, persistência da fila e operações dos indicadores |
| `db.js` | Compatibilidade com nomes/retornos dos métodos antigos, delegando ao repository |
| `app.js` | Renderização legada com `rawRecords` como projeção de compatibilidade; atualização após retry e limpeza de sessão |
| `equipe360-data.js` / `equipe360.js` | Projeção de fontes já isolada; o perfil apresentado também passa por AppState |

Os módulos antigos continuam usando seus formatos de dados e funções. As referências diretas ao armazenamento nos módulos foram encaminhadas a `appStorage`. Extração dos demais loaders/repositories e redução dos globais continuam na modularização da Fase 5; não há alegação de que toda a aplicação já foi reescrita em um único estado.

## Fonte oficial, cache e pendência

Indicadores possuem três coleções distintas: **confirmados**, **pendências** e **view** (confirmados com as alterações pendentes aplicadas). Carregamento do servidor é paginado e completo antes de publicar. Uma página com erro não vira snapshot parcial. Uma resposta vazia bem-sucedida é oficial: substitui o cache confirmado por `[]` e não restaura uma sessão antiga.

Se o servidor falhar, a leitura usa somente o cache confirmado da própria conta e marca origem `cache` / estado `offline`. Pendências continuam identificadas separadamente. A aplicação não usa o snapshot de interface como substituto automático de um servidor vazio. Preferências e snapshots de interface continuam armazenados por conta, mas não têm autoridade sobre registros confirmados.

Edições de indicadores são gravadas na fila da sessão autenticada antes de tentar a rede. Se a autenticação de rede estiver indisponível, a sessão já vinculada pode preservar a edição sem afirmar que foi salva no servidor. Confirmação exige o ID retornado pelo banco; somente a revisão enviada é retirada da fila. Edições do mesmo ID são serializadas: uma resposta antiga não apaga uma revisão mais nova. Campos de várias edições pendentes são combinados. Após retry, a projeção atualiza os consumidores legados.

Inserções exigem retorno das linhas esperadas antes de serem confirmadas. Exclusões por ID exigem retorno daquele ID. Substituição de CSV não prossegue para inserção se a exclusão falhar. A substituição ainda é uma sequência de exclusão/inserção, **não uma transação**: falha na segunda etapa pode deixar o servidor vazio/parcial e exige conferência/reimportação do arquivo de origem. Não foi introduzido RPC nem uma chave de idempotência no servidor. Se uma inserção for aplicada e a resposta se perder, um retry de inserção ainda pode duplicá-la; não prometer semântica de envio único sem evolução do esquema. A fila de atualizações por ID não tem esse problema de duplicar linhas.

A deduplicação de exibição mantém a seleção existente, mas não emite DELETE em background durante uma leitura. A limpeza explícita continua disponível e só retira da projeção as exclusões confirmadas.

## Identidade e armazenamento

Chaves dos módulos passam a `app:user:v1:<user_id>:<chave antiga>`. Tema e proteção visual continuam preferências públicas do navegador. PDI e revisões diagnósticas já isolados por usuário mantêm as chaves anteriores, verificando que o sufixo corresponde à conta ativa. A API nativa `localStorage` não foi sobrescrita.

Sem conta vinculada, dados privados não são lidos nem gravados. A geração de sessão invalida respostas e escritas atrasadas. Troca de conta, logout ou mudança de papel invalida AppState/cache acessível, oculta a tela e recarrega a aplicação, reiniciando também os estados privados que ainda vivem em módulos legados. Renovação normal da mesma conta não provoca esse reset. O observador de auth também existe para sessões restauradas; o callback do SDK não aguarda chamadas de auth dentro do próprio lock.

**Dados locais antigos sem identificação de proprietário foram preservados nas chaves nativas anteriores. Não são atribuídos automaticamente ao primeiro usuário, restaurados como fonte oficial nem reenviados.** A migração automática antiga foi desativada na inicialização. Recuperação de dados não sincronizados dessas chaves exige identificar e confirmar o proprietário e revisar o conteúdo antes de uma importação. PDI/revisões que já tinham proprietário continuam compatíveis. Nenhuma chave antiga foi apagada por esta fase.

As tabelas e políticas RLS existentes permanecem. `registros` e a trilha de histórico continuam com o compartilhamento legado permitido pelo banco; prefixar o cache não muda as permissões do servidor.

## Módulos complementares

Loaders de listas em `db-extra.js` e avaliações passam a aceitar arrays vazios bem-sucedidos como fonte válida. Cadastro e fotos não mantêm entradas removidas por meio de união com o cache anterior. Configurações removidas no servidor deixam de preservar valores antigos como se estivessem confirmados. Falha de rede ainda pode usar somente o cache da conta.

O restante dos contratos de salvamento desses módulos é preservado: **a fila durável e o protocolo de confirmação/revisão desta fase são dos indicadores**. Não há uma fila global cobrindo todas as mutações de metas, fotos, tarefas, avaliações etc. A próxima extração deve migrar essas gravações individualmente, com testes de confirmação, conflitos e recuperação. Suas limitações anteriores de salvamento otimista/paginação não foram disfarçadas como sincronização garantida.

O indicador do cabeçalho diz `Indicadores atualizados`, `N pendentes` ou `Usando dados locais`; não declara que todo o sistema está sincronizado. O cache continua sujeito à disponibilidade/quota do navegador. Se não for possível preservar a fila, a operação não é enviada como se tivesse persistência durável.

## Validação

`npm test` inclui os 171 testes do runner histórico e os checks existentes, além de:

- `data-runtime.check.js`: isolamento, preservação do legado, compatibilidade do PDI, snapshots/eventos e invalidação.
- `records-repository.check.js`: servidor vazio, fallback da própria conta, edição sem auth de rede, merge de campos, retry, concorrência de revisões, falhas e escrita atrasada após troca de sessão.
- `auth-session.check.js`: sessão restaurada observada, renovação normal, mudança de conta e eventos repetidos.
- `private-cache.check.js`: listas vazias confirmadas e ausência de upload automático na inicialização.

`tests/data-lifecycle.browser.html` usa runtime, repository, db e indicador reais, com Supabase simulado; cobre o ciclo servidor/cache/fila/retentativa/sessão. Fixtures antigas de módulos usam armazenamento de teste explicitamente injetado para testar seus contratos isolados; isso não substitui a fixture de ciclo de vida com a camada real.

Também foram aprovadas no navegador as fixtures de Shell, Equipe 360º, PDI, Ponto sintético, Diagnóstico e Atividades. Smoke do index completo verificou as 13 telas e o perfil com autenticação/dados simulados. Testes não acessam produção, não aplicam SQL e não comprovam a RLS publicada, transações ou concorrência de múltiplas abas/dispositivos. O controle por revisão protege atualizações concorrentes nesta instância; localStorage não oferece transação entre abas.

Para repetir o teste de navegador: servir o repositório em localhost e abrir `/tests/data-lifecycle.browser.html`, aguardando PASS, ou usar `node --experimental-websocket tests/ponto-browser-runner.js data-lifecycle.browser.html` com servidor 8765 / Chrome de teste 9228.

## Continuação 1.21.0

Feedbacks/metas agora confirmam IDs antes de atualizar cache/interface; falhas preservam rascunhos, metas deixam de substituir a coleção e a sessão invalida respostas atrasadas. Não há fila automática global nem bloqueio entre dispositivos. Contratos e testes em [confirmacao-e-contexto.md](confirmacao-e-contexto.md). Os demais módulos complementares continuam com adoção pendente.
