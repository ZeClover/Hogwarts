# V5 — evolução incremental do portal

Fonte do pedido: texto V5 de 22/10/2026, lido integralmente. A transferência inicial do ZIP excedeu 32 MiB. O bloqueio foi resolvido com cinco volumes RAR enviados pelo usuário: 87 arquivos extraídos e conferidos. O protótipo e os documentos foram consultados como referência; o pedido do usuário continua sendo a fonte das alterações. O inventário público e a integração visual estão registrados na etapa E abaixo.

## Fundação preservada

Base inspecionada: `808d571`, PR21 (`feat/f6-vercel-persistencia`). Node 24/TypeScript, SPA modular em JavaScript, servidor HTTP, migrations explícitas, libSQL/Turso e Blob privado. PR20 e PR21 permanecem intactas. V5 usa branches e PRs próprias; a branch configurada em Production não recebe esses commits. QA usa fixtures descartáveis, sem credenciais ou alterações na campanha real.

Não há falta de backend para as oficinas: já existem editores, revisões, políticas e operações persistidas. O problema principal é a apresentação simultânea de campos, a separação insuficiente entre criação e edição e a navegação do jogador. Não se justifica refazer a arquitetura nem o banco. Nenhuma parte do Hub RPG/Wands & Wizards integra esta alteração.

## Inventário e lacunas reais

| Área | Implementação existente | Lacuna V5 / lote |
| --- | --- | --- |
| Navegação e início | `public/app.js`, `/api/state` | Menu inclui Hogsmeade; Diário enterrado; API inclui metadados de região fechada. B |
| Regiões, locais e lojas | `world.ts`, `content.js`; `/portal/hogsmeade`, `/portal/regiao/:id`, `/portal/local/:id`, `/portal/catalogo/:id` | Destino direto, mapa/lista, contexto ao voltar. B; criação mínima em D1 |
| Missões e histórias | `campaign.ts/js` | Criador e editor compartilham formulário extenso. C |
| Itens | `items.ts/js` | Preços/propriedades internos já opcionais; permissões expostas na criação. C |
| NPCs | `npcs.ts/js` | Foto e vínculos já opcionais; falta criação mínima e permissões compactas. C |
| Livros e aulas | `library.ts/js`, `content.ts/js` | Factory de rascunho e campos de edição progressivos. D1 |
| Ofertas | `world.ts`, `commerce.ts/js` | Preço obrigatório ao publicar; não confundir rascunho com oferta exposta. D1 |
| Calendário, anos, eventos e grades | `school.ts`, `calendar-model.ts`, `calendar.js` | Defaults narrativos, horários opcionais no rascunho; editor de grade existente. D2 |
| Profeta, murais e avisos | `journal.ts`, `boards.ts/js`, conteúdo genérico | Criação mínima, publicação manual e matérias em etapas. D2 |
| Anuários e retrospectivas | `yearbooks.ts`, conteúdo genérico | Defaults; conservar titular e privacidade individual. D2 |
| Sapos, pools e trocas | `chocolate.ts/js`, `collections.ts/js` | Não alterar probabilidades; moldura aprovada integrada em E. D3/E |
| Bestiário, raridades, recordações, curiosidades | `collections.ts/js` | Rascunhos mínimos, descoberta manual e campos avançados recolhidos. D3 |
| Correio | `mail.ts/js` | Simplificar rascunho sem confundir envio, leitura do Mestre e entrega. D4 |
| Pontos das Casas | `cup.ts/js` | Operação rápida já existe; motivo opcional e auditoria preservada. D4 |
| Mídia, modelos, turmas, backup | `workshop.ts/js`, `templates.ts/js`, `archives.ts/js` | Agrupamento por sete áreas, favoritos, busca, lista; progressão de campos sem perder operações. D4 |

São cerca de 26 acessos na oficina, e não 26 backends a criar. Os endpoints e registros existentes serão reutilizados. C/D não devem remover campos persistidos nem criar defaults fictícios de estoque, preço, recompensas, personagens, notícias ou datas.

## Fases e dependências

1. **A — inventário e plano:** este documento; leitura das rotas, renderizadores, autorização e suítes reais.
2. **B — PR de navegação do jogador:** Início/Explorar/Diário/Acervos/Correio; Hogwarts com biblioteca/aulas/horários; Hogsmeade contextual e omitida se fechada; links antigos; lista/mapa e filtros; autorização no servidor. Não exige migration.
3. **C — PR QuickCreate:** componente/padrão compartilhado; criar missão, item e NPC com dados mínimos; ano corrente; rascunho privado; edição preserva campos, permissões compactas, prévias individuais e ações explícitas. Depende de A; pode se basear em B para revisão incremental. Não publica conteúdo nem migra dados.
4. **D1 — comércio e ensino:** aplicar padrão a livros, aulas, lojas, ofertas, regiões e locais; distinguir validação de rascunho/publicação. Migration somente se comprovadamente necessária para compatibilidade, nunca recriar tabelas da campanha.
5. **D2 — publicações e tempo narrativo:** Profeta, avisos/murais, anos/eventos/grades, anuários/retrospectivas. Reutilizar ano narrativo corrente; não usar relógio do servidor como data da campanha.
6. **D3 — coleções:** criadores mínimos e edição por etapas; manter descobertas, titularidade, chances e trocas. Moldura integrada na etapa E após receber os volumes.
7. **D4 — oficina organizada e operações:** sete áreas, busca, favoritos e modo lista; mídia/modelos, correio e pontos. Conservar todos os acessos administrativos.
8. **E — mídia em preview:** pacote acessível; inventário e integração implementados em PR própria. Comparar hashes e imagens. Substituir somente Gladrags, Salão Principal, aulas, Lago Negro, Floresta, Correio e Três Vassouras conforme os arquivos; preservar imagens corretas V4 e brasões. Referências privadas ficam fora de `public`, bundles, thumbnails e respostas a jogadores. Sala Precisa rejeitada não será integrada; personalização fica como requisito futuro.
9. **F — QA e publicação:** regressão local/libSQL, desktop/mobile, teclado/contraste, permissões e rede; prévia isolada, sem usar dados Production. Verificar Turso/Blob reais em ambiente isolado antes de promoção. Não confundir CI local com teste real de serviços.

## Critérios e evidências

Cada PR registra escopo, testes e limitações; testes temporários não semeiam a campanha. B cobre N1–N8 com casos autorizados, recusados e Mestre, mantendo testes de catálogo sem preço e coleções sem contadores ocultos. C cobre criação mínima, reabertura/persistência, campos antigos, privacidade de rascunhos, prévia sem concessão e publicação manual. Demais lotes reutilizam esses testes e verificam as suas regras de negócio (idempotência, conteúdo individual, referências e recuperação).

Receber um pacote visual não autoriza publicar conteúdo privado da pasta do Mestre. O HTML será tratado como referência, nunca como substituto do app. Não há promessa de Sala Precisa personalizável nem criação automática de notícias ou cartas canônicas.

## Evidência da PR B

Build/lint e 172 testes nativos + 172 pelo SDK libSQL passaram. A rodada completa de navegador verificou 32 cenários; 30 passaram na primeira execução. Dois testes de regressão foram ajustados à nova localização de Artigos (menu de usuário) e à espera das animações finitas antes de medir contraste. Os cinco cenários dos arquivos afetados passaram na repetição, incluindo as quatro Casas e o fluxo completo de itens. Nenhuma migration ou gravação na campanha real.

## PR C — criação mínima e edição progressiva

`public/quick-create.js` compartilha formulário e factories para missão, história individual, item e NPC, reutilizando os endpoints autenticados existentes. Missão pede título; história também pede protagonista; item/NPC pedem nome. Resumos, categoria e descrição são opcionais. Ano corrente vem do estado publicado da campanha. Sem foto, preço, estoque, efeitos ou concessões inventados. A opção de criação avançada preserva o texto digitado e todos os campos anteriores.

Na missão já salva, nove abas separam História, NPCs/locais, Objetivos, Pistas, Participantes, Desfechos, Recompensas, Certificados e Publicação. A mudança de aba conserva os mesmos controles no formulário e não salva nem publica. Permissões detalhadas ficam recolhidas em “Para quem?”. As ações de recompensa e PDF continuam nos editores persistidos existentes; não foram reimplementadas. O retorno de operações feitas na Central da Sessão conserva a rota dessa central. Informações progressivas do NPC começam recolhidas.

A validação inclui criação mínima/reabertura por API, recusa para PLAYER/prévia, isolamento de defaults, privacidade de rascunhos, texto mantido entre abas e ao abrir a criação avançada, clique duplo sem rascunho duplicado, prévias dos cinco personagens sem auditoria ou concessão e regressão dos campos avançados existentes. Nenhuma migration; dados antigos mantêm estrutura, IDs, autoria e revisões. A rodada final completa passou: 175 casos nativos, 175 pelo SDK libSQL e 35 casos de navegador/acessibilidade (7,5 minutos), além de build/lint. O ajuste móvel de Revelações herdado da PR B foi validado pelos três cenários de navegação, incluindo geometria do botão e lugares revelados de Hogwarts.

## Estado dos lotes

B/C e D1–D4 estão implementados em PRs incrementais. O funcionamento combinado é verificado na rodada final F; as evidências por lote aparecem abaixo. As PRs V5 não foram mescladas nem promovidas. E recebeu os volumes, separou referências privadas e integrou a seleção pública aprovada, conforme registro abaixo. O teste de Turso/Blob reais continua pendente em preview isolado: o SDK de arquivo não comprova transporte HTTPS ou permissões dos serviços.

## D1 — comércio e ensino

Livros, aulas, lojas, ofertas, regiões e locais usam o criador mínimo compartilhado. Salvar exige somente título; livros começam no acervo NORMAL, aulas usam o ano corrente, páginas ficam vazias, imagens são opcionais e nenhuma referência é selecionada silenciosamente. Novos marcadores criados pelo fluxo mínimo começam reservados. Edição, permissões, notas e liberação de páginas preservam os controles existentes e ficam recolhidos quando pertinente.

A flag declarativa `draftOptional` permite adiar somente campos específicos de publicação: vínculos e preço da oferta. Mapas e fotografias são opcionais também na publicação: regiões sem mapa abrem em lista e locais sem foto usam a composição tipográfica, sem URLs de imagem inválidas. Preparar/publicar valida esses campos, inclusive os aninhados, antes de alterar status, snapshot ou estoque na transação. Referências não vazias continuam sendo validadas no rascunho. A validação não reinterpreta modelos visuais já congelados nem modifica dados existentes. Nenhuma migration: só o JSON de novos rascunhos pode conter os valores ainda ausentes.

Testes: rodada completa com 179 casos nativos e 179 pelo SDK libSQL; seis cenários de navegador, repetidos integralmente com o SDK libSQL (6/6), cobrem os seis criadores, campos não associados automaticamente, preço/vínculos pendentes e os fluxos anteriores de livro/mapa/loja/oferta. Regiões sem mapa, locais sem foto e o bookmark antigo de Hogwarts foram verificados. A resposta lenta do criador também é verificada para não tirar o Mestre da página para a qual ele navegou enquanto o salvamento terminava. Sem edição da campanha real ou alteração do Hub RPG. Os lotes seguintes estão registrados abaixo; E continua dependendo do pacote visual em partes transferíveis.

## D2 — publicações e calendário

Oito oficinas adicionais usam criação mínima: Profeta, murais, avisos, anos, eventos, grades, anuários e retrospectivas. A edição do Profeta pode começar inteiramente vazia; o rótulo administrativo “Edição sem título” não vira notícia ou manchete. Título, número e manchete devem ser escritos antes de preparar/publicar. Vínculos de mural/aviso, ano inicial e dono da retrospectiva podem ser completados depois. Linhas incompletas da grade podem ser salvas, mas precisam de matéria e horário para publicar. Não são criadas datas narrativas ou presença. Publicar outro ano não avança o calendário.

Edição dos registros salvos começa com conteúdo e vínculos recolhidos. Retrospectiva continua exclusiva ao titular, inclusive nas prévias; criar/editar não notifica. Novidades usa somente snapshots publicados de jornais/eventos/avisos e missões/histórias já autorizadas pelo Diário; aplica acesso ao mural/local e ano corrente dos eventos. Mostra cinco destaques e permite expandir os demais, com links reais. Não envia textos privados, imagens ou datas técnicas no feed.

Validação: build/lint, 183 testes nativos e 183 pelo SDK libSQL passaram. Seis cenários de navegador com SDK passaram, cobrindo os oito criadores e os fluxos completos anteriores de jornal, retrospectiva, mural moderado e calendário/grade. Sem migration ou dados fictícios na campanha; naquele lote a mídia ainda estava bloqueada (resolvido em E). D3 e D4 estão registrados abaixo.

Revisão de privacidade D2: Novidades e listagens públicas ordenam pela revisão publicada (ou criação para registros antigos sem histórico), nunca pela data da edição privada. Alterar só um rascunho não sinaliza atividade do Mestre pela ordenação. Nove casos dos arquivos de rascunhos/jornal passaram nos dois backends; quatro casos de publicações foram repetidos com uma regressão determinística que modifica a data técnica do rascunho e verifica a ordem estável.

## D3 — acervos e pools

Os cinco acervos e os pools de Sapos usam criação mínima por nome. Temporada e obra rara podem ficar pendentes no rascunho; preparar/publicar exige preenchimento. Pool vazio guarda pesos nulos e exibe “Não configurada”, sem adotar chances fictícias. Configurar pesos continua exigindo as cartas elegíveis e autorizadas do modelo existente. Obra escolar não é convertida em raridade ao vinculá-la.

Conteúdo/vínculos, permissões e liberação começam recolhidos. Criar ou publicar não revela coleção, camada, página, cópia física, pacote ou recompensa. Os fluxos anteriores de encontro, observadores, descoberta, notas individuais, sorteio e troca permanecem. A tabela de probabilidades pode ser focada e rolada por teclado no celular. A moldura, pendente naquele lote, foi integrada em E. Nenhuma imagem de personagem ou carta foi inventada.

Validação: build/lint, 16 casos de acervos/pools nos dois backends e três cenários de navegador com libSQL, incluindo os seis criadores e os fluxos completos de descoberta/camada/nota e pacote/sorteio. O caso novo foi repetido após corrigir a acessibilidade da tabela (1/1). Sem migration, campanha real ou Production. D4 registra a organização da Oficina, mídia/modelos, correio e pontos.


## D4 — oficina organizada e operações

A Oficina apresenta cinco favoritos iniciais (Missões, Itens, NPCs, Livros e Notícias), sete áreas recolhidas, busca sem depender de acentos e modos de cartões compactos/lista. Preserva os 26 acessos originais, os links auxiliares e os demais fluxos existentes, totalizando 35 destinos. Favoritos e modo são preferências opcionais deste navegador: armazenam somente IDs de módulos e não substituem a persistência do conteúdo. Turmas continuam disponíveis em um painel recolhido. Nenhuma foto decorativa é repetida no diretório.

Mídia pode começar por um upload e nome opcional derivado do arquivo, com uso privado por padrão. A reutilização seleciona o mesmo arquivo persistido. Todos os bytes continuam no armazenamento privado; escolher “Compartilhável após revisão” configura o público do registro, sem publicar o rascunho ou tornar a URL de armazenamento pública. Alt, corte, autoria, destinatários e revisão permanecem no editor; nome do registro aparece apenas como sugestão no campo de alt, sem virar texto automaticamente. Arte V4 já pública conserva o aviso sobre a origem. A criação avançada preserva texto, arquivo escolhido e intenção de público.

Modelos usam o criador mínimo com composição tipográfica padrão; família/composição e textos continuam editáveis. Cartas podem começar por uma frase sem assunto/destinatário e mantêm o ano atual. Destinatários, assinatura, remetente, apresentação e imagem ficam recolhidos. A ação de envio exige rascunho salvo e destinatários; entregar/moderar continua separado. Escritas pelo endpoint de cartas em prévia agora são recusadas antes de criar qualquer registro. Pontos aceitam motivo opcional; confirmação, auditoria append-only e idempotência permanecem, com apenas totais/ranking no jogador.

Validação do lote: build/lint; 11 casos de API (cartas/pontos/modelos) em cada backend; 13 cenários de navegador com libSQL, incluindo diretório, upload/reutilização, cartas, modelos e regressões completas de autoria, backup, pontos e mídia. Inspeção visual desktop/mobile com fixtures. A rodada integrada F está registrada abaixo. Nenhuma migration, mudança de identidade, edição da campanha real ou publicação em Production.


## F — validação integrada e pendências externas

Build, lint e verificação de assets passaram. A suíte integrada passou com **189 casos nativos e 189 pelo SDK libSQL**. Depois da revisão final da ordenação pública, **28 casos afetados passaram novamente em cada backend**, cobrindo rascunhos, jornais, coleções, pools, cartas, pontos e modelos.

Os **46 cenários únicos de navegador/acessibilidade foram verificados com SDK libSQL em execuções complementares**. A execução longa foi interrompida por reinício do ambiente perto do fim. Dois seletores antigos de atalhos administrativos (Biblioteca/Regiões) foram atualizados aos acessos V5, preservando os testes completos de publicação, leitura de páginas e catálogo sem preço. A execução complementar passou em nove dos dez cenários; o cenário restante de Regiões/comércio passou na repetição após esse ajuste (17,5 s). Os testes de teclado da missão aguardam o término real do salvamento antes de medir foco. Contraste, teclado, alvos móveis, ausência de rolagem horizontal, quatro Casas, privacidade individual, prévias sem efeitos, prêmios idempotentes, importação/backup, entrega manual e links anteriores integram a cobertura. Não há alegação de uma execução longa única 46/46 após a interrupção. A CI de cada PR registra separadamente as execuções remotas; as verificações finais das PRs 22–27 foram concluídas com sucesso, incluindo a suíte completa de navegador na PR27 (run 39880202479).

Não houve migration nova ou edição da campanha real. A branch usada em Production permanece no commit `808d571`; V5 continua em PRs draft incrementais (22 a 27, mais a etapa E), sem mesclagem ou promoção. Turso/Blob reais ainda exigem validação em preview isolado: os testes atuais usam transporte de arquivo do SDK, sem comprovar o transporte HTTPS ou as permissões dos serviços.

## E — mídia aprovada e moldura compartilhada

Os cinco volumes RAR foram extraídos com validação de integridade. A seleção pública contém **14 WebP novos**, copiados sem alterações dos bytes fornecidos: Gladrags, Salão Principal, sete ambientes de aula, Lago Negro, Floresta, Correio, Três Vassouras e a moldura transparente dos Sapos. Os **28 arquivos públicos V4 existentes permanecem idênticos**, incluindo Biblioteca, Tomos e Pergaminhos, Dedosdemel, Olivaras, brasões e mapa limpo. O [inventário público com SHA-256](V5-MIDIAS-PUBLICAS.json) permite revisão por arquivo; o build recusa bytes divergentes ou arquivos adicionais fora dele.

Salão Principal, calendário e caixa de Correio recebem imagens compactas (até 210 px), sem repetir fotografias nos formulários administrativos. Aulas usam o ambiente da disciplina já publicada e autorizada, quando reconhecida; capa escolhida pelo Mestre prevalece. Não foi criado um currículo demonstrativo. Todas as novas imagens públicas ficam disponíveis nos seletores reais de mídia/locais para reutilização.

Gladrags, Lago, Floresta e Três Vassouras não têm registros próprios na fundação inspecionada. Seus arquivos estão disponíveis para associação explícita pelo Mestre nos editores existentes, sem criar/abrir locais, mudar imagens de outros estabelecimentos ou acrescentar marcadores à campanha. Publicar/liberar esses locais continua sendo uma operação separada. Nenhuma identidade, data, estoque ou regra mecânica foi alterada; não há migration.

A galeria de Sapos aplica a mesma moldura azul/dourada às cartas presentes na projeção autorizada. O retrato opcional usa a URL protegida existente; o nome ocupa a placa e permanece completo no título acessível. O verso recolhido abre por teclado e contém somente o texto já conhecido. Nenhum catálogo adicional é buscado para compor a moldura. Carta não descoberta não produz face, silhueta, nome ou requisição de retrato; retirar a descoberta bloqueia leitura e mídia. Anotações, camadas e trocas continuam nas rotas anteriores.

As referências privadas permanecem fora do repositório e dos artefatos públicos. A conferência local por hashes não encontrou cópias em `public` ou `dist`. Originais, protótipo com imagens embutidas e documentos privados não foram incorporados ao bundle. Nenhuma imagem foi gerada. A Sala Precisa rejeitada permanece excluída; personalização futura continua somente como requisito separado.

Validação E: build/lint/assets e **191 testes nativos + 191 pelo SDK libSQL** passaram. Os dois novos cenários de navegador passaram com SDK, cobrindo desktop/celular, teclado/axe, retrato protegido, ausência de carta desconhecida, revogação, imagens contextuais e reutilização no editor sem criar locais. A primeira execução teve um erro no teste ao trocar a sessão sem sair da conta; o teste foi corrigido para fazer logout explícito e os dois cenários passaram na repetição. Oito cenários anteriores de navegador também passaram com SDK: navegação (três casos), pacote/sorteio, descoberta/camadas/anotações, Correio/entrega manual, calendário/grade e mundo/catálogo sem preço. Dois cenários adicionais de upload/edição de mídia também passaram após atualizar os seletores para “imagem aprovada”, que agora abrangem V4 e V5. São doze cenários afetados verificados em lotes.

A prévia local usa fixtures descartáveis. Turso/Blob reais e a prévia HTTPS isolada continuam pendentes por falta de credenciais desse ambiente. A produção não recebeu os commits V5.

## G — explicações compactas e orientação do endereço de acesso

Pedido posterior: explicar as opções da Oficina sem aumentar a complexidade. A página geral ganha uma frase sobre Oficina/Central e uma ajuda recolhida para escolher o tipo de conteúdo, entender rascunho/preparação/publicação/liberação, público, favoritos, criação avançada e prévia. Nas oficinas de criação e edição, uma frase explica a finalidade e “Entenda as opções” reúne os principais campos e escolhas daquele cadastro. A ajuda usa os editores e rotas existentes; não acrescenta ações de publicação, permissões, campos obrigatórios ou mudanças no banco. Abrir o texto por teclado preserva os valores digitados e não grava auditoria. Os seletores rápidos de Tipo e Protagonista receberam nomes acessíveis explícitos.

O endereço temporário da Vercel podia mostrar o formulário e recusar o login somente depois de enviar a senha. O app agora consulta apenas a origem pública configurada no servidor: fora dela, mostra um link para o endereço principal antes de pedir credenciais. O destino não é derivado de Host, cabeçalhos encaminhados ou parâmetros da URL. Convites conservam o fragmento ao seguir o link, inclusive ao tentar novamente após falha de rede. A validação estrita de origem e CSRF permanece igual; cookies, senhas, sessões e regras de convite não mudaram.

Validação: build/lint/assets; **192 testes nativos e 192 pelo SDK libSQL** passaram. **Oito cenários únicos de navegador** foram verificados com SDK em lotes, cobrindo endereço temporário/principal, convite, Oficina, upload privado, correspondência, modelos e criadores rápidos. A primeira execução revelou que o nome acessível de Tipo incorporava as opções do seletor; o nome explícito foi corrigido e os dois casos afetados passaram na repetição. Inclui teclado, axe, celular, ausência de rolagem horizontal e preservação de dados digitados. As verificações usam fixtures descartáveis, sem editar a campanha real. Publicação em Production é uma etapa separada.

## H — subtexto visível nas ações e revisão das diferenças entre oficinas

O usuário apontou que a ajuda recolhida não explicava os próprios botões. As ações de autoria e administração agora têm uma frase visível abaixo do botão, associada por `aria-describedby`. A explicação não fica dentro da área clicável: ler a frase não executa a operação. Os nomes, handlers, campos, valores enviados, validações e confirmações permanecem os existentes.

A revisão encontrou diferenças que impedem uma legenda única para tudo:

| Área | Distinção explicada no botão |
| --- | --- |
| Preparação e publicação | Preparar confere campos e marca o rascunho; é opcional e não publica. Revisar abre uma confirmação; confirmar executa. |
| NPCs e itens | Publicar libera perfil/descrição ao público permitido, sem revelar segredos progressivos nem conceder posse. Arquivar oculta, preservando cadastro e histórico. |
| Imagens | Publicar libera o registro da galeria; arquivar não apaga o arquivo original. |
| Livros, aulas e coleções | Publicação, descoberta e liberação de páginas/camadas são operações distintas. Arquivar preserva o material já publicado ou descoberto; retirar acesso exige a operação de retirada. |
| Regiões e locais | Publicar o cadastro não abre uma região. Arquivar região fecha o acesso; arquivar local o desativa. Salvar abertura/público na Central pode afetar acesso imediatamente. |
| Missões e histórias | Publicar, liberar o Diário, iniciar, revelar pista/capítulo e encerrar são etapas distintas. Arquivar preserva a jornada conhecida. Encerrar não concede prêmios. |
| Certificados e recompensas | Salvar o plano não concede; emitir PDF ainda o mantém privado; liberar PDF e conceder prêmio têm efeitos próprios. |
| Correio | Salvar rascunho, enviar à fila e entregar são operações separadas. Arquivar na própria caixa não apaga a cópia de outro destinatário. |
| Comércio, carteiras e Taça | Revisar não lança valores. Confirmar uma compra debita o preço final e registra estoque/entrega; lançamento de pontos e publicação do resultado também exigem confirmação. |
| Pacotes de Sapos | Publicar pool não entrega pacotes; conceder pacotes não sorteia as cartas. Troca física preserva o conhecimento no álbum. |
| Calendário | Salvar preparação não muda a data publicada. Publicar a data narrativa não cria avanço automático de tempo. |
| Propostas e investigações | Aprovar proposta cria rascunho, sem publicar/revelar. Ocultar contribuição preserva seu registro; moderação do caso tem efeito próprio. |
| Importação e recuperação | Analisar não aplica; aplicar executa o plano revisado e guarda uma cópia anterior. O backup/arquivo baixado permanece privado. |

As frases cobrem também salvar, duplicar, restaurar, prévias, revisão/cancelamento, convites, grupos/turmas e alterações de acesso. Controles óbvios de navegação, filtros, paginação e formatação não recebem parágrafos repetidos. A ajuda aparece somente para o Mestre fora da prévia de personagem.

Um observador acompanha confirmações inseridas sem reconstruir a página. A anotação é idempotente e preserva o foco do botão quando o editor foca a confirmação. Não adiciona requisições, eventos de clique ou submissões. O teste de publicação do NPC passa a exigir que a confirmação esteja focada antes de pressionar Enter; as descrições são visíveis e os jogadores não recebem essa ajuda administrativa.

Validação: build/lint/assets e **60 casos de API existentes com SDK libSQL** passaram para conferir as diferenças de publicação, arquivo, descoberta, posse e documentos. A regressão completa de **49 cenários de navegador/acessibilidade passou em uma execução única (8,6 min)**, incluindo desktop/celular, nomes e descrições acessíveis, foco da confirmação por teclado, formulários, prévias, permissões, prêmios, backups e navegação. Sem migrations ou alterações da campanha real.
