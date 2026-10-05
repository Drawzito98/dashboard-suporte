# Auditoria de Ponto — MVP e importação estruturada

Cadastro, jornadas por dia, tolerâncias, regras e snapshots anteriores são preservados. O motor de regras continua em mvp-1; o leitor recebe a versão multipagina-2. Não há migração de framework nem modificação das tabelas de desempenho.

## Processamento sem retenção

O PDF existe apenas na memória do navegador durante o processamento. Não há upload para Supabase Storage, persistência de binário/base64, localStorage, IndexedDB, arquivo temporário de servidor ou URL de documento. A aplicação não registra conteúdo integral do PDF em logs.

Todas as páginas são extraídas antes de separar tabela principal e justificativas. Em um bloco finally, o input é limpo, a referência ao File é descartada, o worker/documento PDF.js é destruído e o buffer é liberado/zerado quando não foi transferido. Cancelamento, saída da aba, encerramento de sessão e erro seguem o mesmo descarte. Os dados estruturados podem permanecer na prévia até confirmação. O arquivo original no computador do usuário não é apagado.

Importações armazenam somente nome original, hashes, colaborador, período, status, data e snapshots estruturados. O histórico usa registros e justificativas, sem precisar de PDF. O antigo botão de abertura do documento foi removido conforme a solicitação. Não foi adicionada importação em lote nesta etapa; sua implementação futura deverá reutilizar o descarte por arquivo, inclusive em falhas parciais.

## Leitura dinâmica

O nome vem do conteúdo, em rótulos Nome/Empregado/Funcionário/Colaborador, inclusive quando o valor está em linha inferior na mesma coluna. A associação exige nome completo único, normalizando acentos, caixa e espaços. O nome do arquivo nunca determina o colaborador. Associação ambígua exige seleção e confirmação humana.

O período impresso pode preencher os campos automaticamente. Datas sem ano só são resolvidas com um período que determine um único ano. Períodos conflitantes, datas inválidas/duplicadas e justificativas sem data ou sem registro diário correspondente impedem salvamento.

Cabeçalhos identificam colunas e posições, com Entrada/Saída numeradas e variantes dos totais: Normais/Horas Normais, BDEB./Débito, BCRED./Crédito, BSALDO/Saldo. Não há coordenadas, número de dias, nome ou jornada fixados para um cartão específico. Cabeçalhos repetidos permitem tabelas em páginas diferentes. Quando PDF.js combina rótulos vizinhos, as âncoras vêm do texto e geometria do item. Lacunas, batidas adicionais e marcações são preservadas.

A jornada impressa é extraída separadamente do cadastro e aparece como contexto. Sua leitura também considera diferentes baselines do rótulo de dia e horários. A jornada cadastrada e confirmada continua sendo a referência do motor. As definições de * e ^ vêm da legenda impressa, quando disponível.

Layouts sem cabeçalhos reconhecíveis conservam o mapeamento humano do MVP. Quando falta segurança, a mensagem é: **Não foi possível interpretar este cartão de ponto com segurança. Revise os dados antes de continuar.** Não há OCR nesta etapa. O cálculo do MVP continua limitado à jornada diurna com quatro batidas; outras quantidades são preservadas, mas ficam para conferência antes de decisões objetivas.

## Justificativas

A seção JUSTIFICATIVAS DE ALTERAÇÃO E INCLUSÃO DE PONTO é separada da tabela diária. Uma data abrange várias entradas e é carregada para a continuação da seção em outra página. Cabeçalhos/rodapés não viram registros diários.

São preservados data, hora, código literal, descrição, página e relações com campos de batida de hora idêntica. Horário sem correspondência permanece como contexto do dia. Nenhuma batida é substituída. Códigos O, D, I e outros não recebem significados inventados.

ponto_justificativas relaciona entrada, importação, registro e colaborador. Uma chave por importação/data/hora/código/descrição evita duplicação. A análise e justificativas são gravadas na mesma transação. O hash de dados inclui registros, justificativas e totais; o hash do arquivo permite detectar reprocessamento sem manter o PDF.

## Migrations e segurança

Aplicar migration_v46.sql, se ainda não executada, e depois migration_v47.sql antes de publicar o novo front-end. As migrations foram preparadas localmente e não executadas em produção nesta sessão.

v46 é a migration original do MVP. v47 adiciona ponto_justificativas, permite storage_path nulo e atualiza o RPC para gravar exclusivamente dados estruturados. A coluna legada é preservada para compatibilidade, sem utilização em novas importações. Chamadas contendo storage_path são rejeitadas. Registros e snapshots anteriores não são apagados ou recalculados.

v47 remove permissões antigas de upload/leitura de PDFs e adiciona políticas restritivas contra INSERT, UPDATE e SELECT no bucket legado para authenticated/anon, inclusive se houver outra política permissiva. A versão atual não chama Storage. Se houver arquivos de uma versão anterior, removê-los pela API Storage ou Dashboard administrativo antes da publicação, preservando as análises. Não excluir storage.objects diretamente por SQL. A limpeza de arquivos legados e a verificação de sua existência não foram executadas nesta sessão.

RLS exige autenticação, papel protegido app_metadata.role=admin e propriedade da análise. Justificativas devem corresponder ao registro/importação/colaborador/data. Não há chave administrativa no front-end. Validação de banco/RLS com usuários reais permanece necessária no Supabase de teste.

## Verificação realizada

- node tests/runner.js: regras e regressões de leitura, cabeçalhos variados, geometria deslocada, páginas, alterações, códigos, duplicidades e ausência de seção.
- tests/ponto.browser.html: PDF sintético com Supabase simulado; falha se Storage for chamado e verifica descarte após extração, cancelamento e erro.
- tests/ponto.browser.html?real=dayane: fluxo completo com PDF real; somente a camada Supabase é simulada. Confere salvamento estruturado e histórico com justificativas.
- tests/ponto-real.browser.html: parser com dois PDFs externos, sem cópia de documentos no repositório. O servidor temporário é iniciado com python3 tests/ponto-test-server.py --pdf-a /caminho/cartao-a.pdf --pdf-b /caminho/cartao-b.pdf, usa localhost/cache no-store e deve ser encerrado ao terminar. Chrome requer --remote-debugging-port=9228. Node 20 executa node --experimental-websocket tests/ponto-browser-runner.js; Node 22+ dispensa a flag. O primeiro caso verifica os critérios solicitados para Dayane; o segundo verifica outro cartão sem justificativas. Esses nomes existem apenas nos endpoints locais de teste, nunca no parser.

Primeiro cartão real: 2 páginas, 33 dias, 52 justificativas, período 01/09/2026–03/10/2026 e saldo -00:09. A jornada de segunda a sexta foi conferida como 08:00–12:00 / 13:00–17:36; o documento também apresenta sábado separadamente. A batida 13:39* em 04/09 foi preservada, e as entradas 13:38/D e 13:39/I ficaram separadas. A continuação de 08/09 às 18:01 na segunda página foi validada.

Segundo cartão real: 2 páginas, 77 dias, sem justificativas, período 01/06/2026–16/08/2026 e saldo -12:00. Nome, jornada e colunas também são identificados dinamicamente.

**Ainda não liberado para produção:** foram validados dois colaboradores reais. São necessários mais 2–3 cartões com jornadas/situações diferentes para atingir o mínimo solicitado de 4–5. Testes sintéticos não contam como colaboradores reais. Etapas seguintes — revisão do líder, regras globais, lote e exportações — permanecem pendentes conforme o plano original.

PDF.js 5.4.149 é distribuído localmente com licença Apache 2.0. Referência: https://mozilla.github.io/pdf.js/examples/.


### Jornada fixa e trabalho eventual

O cadastro oferece horário fixo por colaborador nos dias trabalhados. Cadastros antigos com jornadas diferentes mantêm seus valores até edição explícita.

Na prévia da importação, “Jornadas excepcionais por data” permite informar o horário previsto para um sábado eventual ou outra data. A exceção não se repete nos demais dias e não é inferida das batidas realizadas. Aceita quatro batidas com intervalo ou duas sem intervalo. Os dados originais permanecem intactos; a jornada excepcional e sua observação ficam no snapshot da importação e no resultado calculado do dia, disponíveis no histórico. Não exige migration.

Sem uma exceção informada, trabalho em folga continua para conferência. Feriados e folgas explicitamente indicados no documento mantêm suas regras de conferência, mesmo com jornada excepcional. Documentos com estrutura incerta continuam para conferência.


### Integração com a equipe e o perfil

A lista da auditoria inclui os nomes ativos dos dados de desempenho e dos perfis da equipe, sem depender dos filtros de período ou setor. Nome e setor são preenchidos ao cadastrar a jornada. Os cadastros de ponto existentes são preservados e reutilizados por nome completo normalizado; associação ambígua exige revisão. Pessoas inativas não são incluídas automaticamente nem selecionadas na importação, e cadastros de ponto anteriores continuam acessíveis para edição.

O perfil da equipe apresenta as jornadas salvas e um botão para cadastrar/editar na auditoria. A fonte dos horários continua sendo `ponto_colaboradores` e `ponto_jornadas`, com as mesmas políticas privadas por administrador. Não se duplicam horários em localStorage ou no cadastro de desempenho. A relação usa o nome, seguindo a identificação atual dos perfis; renomeações devem ser revisadas explicitamente. Não exige migration.


### Tolerância por marcação e acumulada — motor mvp-3

A análise calcula a diferença assinada de cada marcação em relação à jornada prevista, o módulo de cada diferença e a soma desses módulos. Até 5 minutos por marcação e até 10 minutos na soma diária são os padrões inclusivos; ultrapassar qualquer limite gera uma ocorrência. Antecipações e atrasos não se cancelam na soma. Um atraso de 6 minutos na entrada ultrapassa o limite individual, mesmo estando abaixo de 10 no dia.

A classificação continua considerando compensação, crédito e conflito com totais do cartão. Déficit acompanhado de perda acima da tolerância gera inconsistência objetiva quando não há contexto de compensação; variações compensadas ou favoráveis acima dos limites vão para conferência. Hora extra continua tendo ocorrência informativa, mas uma variação acima da tolerância também gera a ocorrência de horário para conferir. A tolerância e seus detalhes ficam em `calculado.tolerancia`; `saldo_calculado` continua sendo a diferença bruta entre duração trabalhada e esperada, e os totais originais não são alterados.

Configurações → Regras de Ponto salva os dois limites em `ponto_configuracoes`, privada por líder administrador via RLS. A migration v48 foi aplicada em produção em 05/10/2026 e suas políticas foram testadas com rollback. A prévia recebe os valores salvos e permite ajuste somente para a análise atual. Cada importação preserva os limites aplicados e a versão do motor; análises antigas não são recalculadas.
