# Guia do Mestre — Hogwarts 1890

A Central da Sessão fica em `/portal/mestre`; a Oficina Geral em `/portal/mestre/oficinas`. A primeira concentra decisões durante a narração. A Oficina prepara o conteúdo. Os cadastros são persistentes, não exigem alteração no código ou novo deploy a cada carta, missão, livro, NPC ou objeto.

## Preparar, publicar e revelar

Salve o rascunho, use a prévia por personagem e revise a publicação. Editar o rascunho não modifica a revisão publicada. Duplicar cria rascunho. Histórico registra versões e evita sobrescrever outra edição. Arquivar mantém o histórico; em livros, coleções, missões, correspondência e anuários, conhecimento e documentos já autorizados têm regras próprias de preservação.

Público selecionado combina personagens e grupos; Casa, turma, ano, região e local acrescentam restrições. Exclusão individual prevalece. Abrir uma região não revela um local secreto. “Visualizar como” é somente leitura e aplica as permissões do personagem também no servidor.

## As quinze oficinas

| Oficina | Onde preparar e operar | Resultado e decisão separada |
| --- | --- | --- |
| 01 — Missões e Histórias | Oficina → Missões e Histórias; Central → Conduzir missões | Missões em Grupo e Histórias Individuais separadas. Anúncio, participantes, início, objetivos manuais, pistas, capítulos, desfecho e reabertura são ações distintas. |
| 02 — Itens | Oficina → Itens | Nome/descrição, imagem facultativa e campos avançados, efeitos, segredos, estimativa e preço privado. Publicar não coloca em loja nem concede posse. |
| 03 — Regiões, locais, lojas e ofertas | Quatro editores da Oficina; Central → Regiões / Carteiras e pedidos | Marcadores fora da imagem, NPC e item reutilizados. Preço por oferta e estoque privados. Pedido não debita; aprovação confirma preço pago, saldo e estoque atomicamente. Recibo é privado. |
| 04 — NPCs | Oficina → NPCs | Cadastro único, locais, retrato e fragmentos. Publicação do perfil e revelação de fragmentos separadas. |
| 05 — Livros e aulas | Oficina → Livros e Biblioteca / Aulas | Páginas e capítulos reordenáveis, conteúdo e ilustração. Revelar páginas aos destinatários é separado de publicar a obra. Livro raro não entra automaticamente no catálogo normal. |
| 06 — Cinco coleções | Oficina → Sapos / Bestiário / Raridades / Recordações / Curiosidades | Descoberta e camadas separadas. Bestiário exige encontro presenciado confirmado. Recordações individuais não são inventário. Notas pessoais pertencem ao jogador. |
| 07 — Correio | Oficina → Correspondências; Central → Fila do Correio | Texto, assinatura, remetente, destinatários, imagem e modelo. Rascunho exclusivo do autor; envio permite leitura pelo Mestre; entrega manual permite leitura pelo destinatário. |
| 08 — Murais | Oficina → Murais / Avisos; Central → Propostas de avisos | Local e Casa restringem leitura. Propostas dos alunos só são publicadas após revisão. Anúncio de missão não inicia missão. |
| 09 — Calendário e grade | Oficina → Anos / Eventos / Grades; Central → Data da campanha | Data diegética e ano mudam apenas por publicação manual. Grade é tabela editável, com duplicação de horários. |
| 10 — Profeta Diário | Oficina → Profeta Diário | Edições, manchetes, artigos, autores, imagens e notas escolhidos manualmente. Publicar libera para todos; arquivo em `/portal/profeta`. |
| 11 — Taça das Casas | Oficina / Central → Pontos das Casas | Pontos manuais, motivo/auditoria privados. Jogadores veem totais e ranking. Mestre escolhe o vencedor e encerra a competição; correções preservam resultados anteriores. |
| 12 — Anuários | Oficina → Anuários públicos / Retrospectivas individuais | Destaques e imagens selecionados. Resultado oficial da Taça pode ser vinculado por snapshot. Retrospectiva só do dono, com publicação independente. |
| 13 — Mídia e modelos | Oficina → Biblioteca de Mídia / Modelos e ornamentos / Exportação e recuperação | Upload seguro, seleção V4, corte e oito famílias de modelos reutilizáveis. Publicações e PDFs conservam a versão aplicada. |
| 14 — Personagens e permissões | Central → Personagens / Convites / Grupos; Oficina → Turmas | Casa, ano, vínculos e acesso; bio/foto próprias imediatas, moderáveis pelo Mestre. Suspensão revoga sessões. |
| 15 — Investigação coletiva | `/portal/investigacoes`; Oficina → Moderar investigações | Jogadores criam casos e contribuições. Mestre oculta/restaura notas, arquiva/reabre casos e registra avisos privados. Sem validação automática de teorias. |

## Encerrar missão, emitir e conceder

1. Crie missão, participantes, objetivos e pistas. Publicar o anúncio não inscreve participantes nem inicia a missão.
2. Libere a missão aos escolhidos e inicie quando a aceitação ocorrer na sessão. Atualize objetivos e revele pistas manualmente.
3. Registre sucesso, sucesso parcial ou fracasso e epílogo. O resultado não concede recompensas.
4. No painel de documentos da missão, escreva cada certificado individual, selecione modelo/brasão se desejar e confira o PDF. Emitir e liberar ao titular são operações diferentes. Também é possível certificar uma participação em fracasso.
5. Planeje as recompensas por beneficiário. Revise e confirme a concessão separadamente. Confirmação repetida não concede novamente; moeda, item, coleção, recordação e prêmio narrativo seguem seus respectivos domínios. Bestiário não dispensa confirmação do encontro.

O titular decide se compartilha seu certificado com outros personagens. Outros participantes não ganham acesso ao PDF automaticamente.

## Sapos: descoberta e cópia física

Cadastre cartas, raridade, temporada e elegibilidade. Publique um pool com pesos por raridade; toda raridade de peso positivo precisa ter cartas elegíveis e autorizadas para os escolhidos. A Central confirma a origem/posse e concede pacotes lacrados. O dono abre; o servidor sorteia raridade e depois uma carta com chance igual dentro dela.

Repetir abertura retorna a mesma carta. Cada pacote aberto gera uma única cópia física. Trocas de cópias exigem confirmação do Mestre e não apagam a descoberta, mesmo ao trocar a última cópia. A retirada de pacote só é possível enquanto lacrado. Mudança de política que invalide o pool bloqueia a abertura sem consumir o pacote.

## Correio e caderno

Rascunho de carta só é acessível ao autor real, inclusive texto, histórico e imagem. Após enviar, o texto fica fixo; para reaproveitar, crie cópia como rascunho. O Mestre lê a versão enviada, retém/devolve/extravia ou entrega. O destinatário só lê depois da entrega. NPC só responde quando o Mestre escreve uma carta; não existe resposta automática.

No caderno coletivo, selecionar participantes e compartilhar uma contribuição torna aquele texto legível aos membros. Descobertas e notas pessoais nunca são copiadas automaticamente. Retirar um participante revoga seu acesso ao caso. Autor edita a própria contribuição visível; moderação e histórico preservam autoria. Avisos do Mestre são privados.

## Modelos reutilizáveis

Crie um modelo de livro, carta, jornal, certificado, criatura, cartão, vitrine ou scrapbook. Escolha composição e cor de bordas, cabeçalho e rodapé. Confira a prévia salva e publique para disponibilizá-lo nos seletores correspondentes. Imagens continuam facultativas e vêm de upload manual ou assets aprovados; não há geração de imagens.

Escolher um modelo captura sua revisão no rascunho. Publicar a obra, revelar uma coleção, enviar uma carta ou emitir PDF preserva esse estilo. Alterar o modelo depois não modifica exemplares anteriores. Para aplicar a revisão nova, edite/salve e revise uma nova publicação ou emissão.

## Exportar, importar e recuperar

Em **Oficina → Exportação e recuperação**, há dois formatos:

- **Conteúdos editáveis:** pacote das oficinas compartilhadas (regiões/locais/lojas/ofertas, livros/aulas, calendário, murais, coleções, jornal, anuários e modelos), com imagens referenciadas e notas do Mestre. Não inclui cartas, notas pessoais, contas, concessões ou transações. Missões, NPCs e itens têm domínios próprios e são preservados pelo backup completo.
- **Backup cifrado completo:** guarda o estado do banco e mídias privadas, incluindo jornadas, PDFs, cartas e rascunhos, sem revelar o texto ao baixar. Usa a chave privada `DATA_DIR/backup.key`; a cópia operacional deve guardar essa chave fora do host. O painel só restaura backups desta instalação e com a mesma versão das migrations.

Importar exige primeiro **Analisar sem aplicar**. Escolha ignorar IDs existentes ou criar cópias com novos IDs. A revisão mostra registros, imagens e conflitos; referências ausentes são recusadas sem aplicação parcial. A importação cria somente rascunhos, sem publicar, revelar, entregar ou conceder. Referências a regiões, locais e anos usam os cadastros nativos atuais; valide os vínculos antes de publicar cópias. Modelos importados precisam ser publicados antes de selecionar novamente nas obras indicadas na revisão.

Restaurar também exige análise e digitar `RESTAURAR`. A recuperação repõe o estado da campanha do backup, preservando contas, convites, sessões e auditoria atuais. Não reativa conta suspensa. Se a campanha mudar desde a análise, a aplicação é recusada e exige nova revisão. Antes de importar/restaurar, o servidor guarda cópia cifrada anterior em `DATA_DIR/recoveries/`.

O painel aceita importação até 64 MB e backup cifrado até 128 MB. Para cópia operacional maior ou migração de instalação, pare o servidor e use `npm run backup -- /caminho/privado`. Restaure banco, mídia e chave do mesmo conjunto em diretório novo, sem misturar WAL/SHM antigos; execute migrations e teste em ambiente isolado. Os backups operacionais incluem hashes de senha e rascunhos privados: acesso somente da operação do servidor, nunca por uma URL pública.

## Continuidade e limites

Mudar o ano não apaga missões, cartas, coleções, carteira ou casos. Arquive com as operações de cada módulo. A data visível é narrativa; datas técnicas ficam na auditoria administrativa.

O mapa V4 de Hogsmeade continua provisório artisticamente. Os cinco protagonistas e contêineres originais são a fundação confirmada; catálogos, preços, estoques, eventos, cartas e missões começam sem conteúdo fictício. O Hub mantém ficha, equipamento, consumo e regras mecânicas. Comprovantes oferecem cópia dos dados públicos para integração manual.
