# Restauração da experiência — auditoria e entregas

Base conferida: `origin/feat/v5-9-acoes-explicadas`, d60be9f, 23/10/2026. Árvore limpa antes do trabalho. A consulta do deployment de Production foi recusada pela conexão Vercel (403 no escopo zezin2); o commit citado pelo pacote não foi tratado como confirmação remota. A referência V4 e a captura V5 foram fornecidas; capturas locais da base permitem comparação sem tocar na campanha real.

O pedido de implementação integral foi confirmado no chat. Sem merge ou promoção automática. Backend, IDs, conteúdo e Hub RPG preservados. As alterações serão divididas em commits/PRs revisáveis.

## Matriz de todas as 35 entradas

As 35 entradas permanecem acessíveis na Oficina Geral. As famílias editoriais entram também em Minhas Criações; operações conservam seu próprio fluxo. Todos os endpoints administrativos exigem MASTER e rejeitam view_as. A matriz foi extraída das entradas reais de public/workshop.js, comparadas aos handlers e testes existentes.

| Entrada atual | Onde encontrar | Estado/função futura | Imagem existente | Regressão a evitar |
|---|---|---|---|---|
| Mundo/NPCs | Hogwarts/Ensino; `/portal/mestre/oficinas/Comércio` | Editor existente + índice unificado do mesmo ID | `aula_classe_ornamentada.webp` | Rascunho privado, revisão pública independente, histórico e destinatários |
| Missões e Histórias | Narrativa; `/portal/mestre/oficinas/missoes` | Editor existente + índice unificado do mesmo ID | `correio_pergaminhos.webp` | Rascunho privado, revisão pública independente, histórico e destinatários |
| Histórias individuais | Narrativa; `/portal/mestre/oficinas/historias` | Editor existente + índice unificado do mesmo ID | `correio_pergaminhos.webp` | Rascunho privado, revisão pública independente, histórico e destinatários |
| Investigações | Narrativa; `/portal/mestre/investigacoes` | Operação: atalho dedicado, sem fingir rascunho editorial | `correio_pergaminhos.webp` | Confirmação manual, idempotência e permissões |
| NPCs | Mundo/NPCs; `/portal/mestre/oficinas/npcs` | Editor existente + índice unificado do mesmo ID | `hogwarts_claustro.webp` | Rascunho privado, revisão pública independente, histórico e destinatários |
| Regiões | Mundo/NPCs; `/portal/mestre/oficinas/conteudos/regions` | Editor existente + índice unificado do mesmo ID | `hogwarts_claustro.webp` | Rascunho privado, revisão pública independente, histórico e destinatários |
| Locais e marcadores | Mundo/NPCs; `/portal/mestre/oficinas/conteudos/places` | Editor existente + índice unificado do mesmo ID | `hogwarts_claustro.webp` | Rascunho privado, revisão pública independente, histórico e destinatários |
| Livros e Biblioteca | Hogwarts/Ensino; `/portal/mestre/oficinas/conteudos/books` | Editor existente + índice unificado do mesmo ID | `aula_classe_ornamentada.webp` | Rascunho privado, revisão pública independente, histórico e destinatários |
| Aulas | Hogwarts/Ensino; `/portal/mestre/oficinas/conteudos/lessons` | Editor existente + índice unificado do mesmo ID | `aula_classe_ornamentada.webp` | Rascunho privado, revisão pública independente, histórico e destinatários |
| Anos letivos | Hogwarts/Ensino; `/portal/mestre/oficinas/conteudos/years` | Editor existente + índice unificado do mesmo ID | `aula_classe_ornamentada.webp` | Rascunho privado, revisão pública independente, histórico e destinatários |
| Eventos | Hogwarts/Ensino; `/portal/mestre/oficinas/conteudos/events` | Editor existente + índice unificado do mesmo ID | `aula_classe_ornamentada.webp` | Rascunho privado, revisão pública independente, histórico e destinatários |
| Grades | Hogwarts/Ensino; `/portal/mestre/oficinas/conteudos/timetables` | Editor existente + índice unificado do mesmo ID | `aula_classe_ornamentada.webp` | Rascunho privado, revisão pública independente, histórico e destinatários |
| Data da campanha | Hogwarts/Ensino; `/portal/mestre/calendario` | Operação: atalho dedicado, sem fingir rascunho editorial | `aula_classe_ornamentada.webp` | Confirmação manual, idempotência e permissões |
| Pontos das Casas | Hogwarts/Ensino; `/portal/mestre/taca` | Operação: atalho dedicado, sem fingir rascunho editorial | `aula_classe_ornamentada.webp` | Confirmação manual, idempotência e permissões |
| Itens | Comércio; `/portal/mestre/oficinas/itens` | Editor existente + índice unificado do mesmo ID | `loja_olivaras.webp` | Rascunho privado, revisão pública independente, histórico e destinatários |
| Lojas | Comércio; `/portal/mestre/oficinas/conteudos/shops` | Editor existente + índice unificado do mesmo ID | `loja_olivaras.webp` | Rascunho privado, revisão pública independente, histórico e destinatários |
| Ofertas | Comércio; `/portal/mestre/oficinas/conteudos/offers` | Editor existente + índice unificado do mesmo ID | `loja_olivaras.webp` | Rascunho privado, revisão pública independente, histórico e destinatários |
| Sapos de Chocolate | Acervos/Coleções; `/portal/mestre/oficinas/conteudos/chocolatecards` | Editor existente + índice unificado do mesmo ID | `biblioteca_hogwarts.webp` | Rascunho privado, revisão pública independente, histórico e destinatários |
| Pools de Sapos | Acervos/Coleções; `/portal/mestre/oficinas/conteudos/chocolatepools` | Editor existente + índice unificado do mesmo ID | `biblioteca_hogwarts.webp` | Rascunho privado, revisão pública independente, histórico e destinatários |
| Pacotes e trocas de Sapos | Acervos/Coleções; `/portal/mestre/sapos` | Operação: atalho dedicado, sem fingir rascunho editorial | `biblioteca_hogwarts.webp` | Confirmação manual, idempotência e permissões |
| Bestiário Encantado | Acervos/Coleções; `/portal/mestre/oficinas/conteudos/bestiary` | Editor existente + índice unificado do mesmo ID | `biblioteca_hogwarts.webp` | Rascunho privado, revisão pública independente, histórico e destinatários |
| Biblioteca de Raridades | Acervos/Coleções; `/portal/mestre/oficinas/conteudos/rarities` | Editor existente + índice unificado do mesmo ID | `biblioteca_hogwarts.webp` | Rascunho privado, revisão pública independente, histórico e destinatários |
| Recordações | Acervos/Coleções; `/portal/mestre/oficinas/conteudos/memories` | Editor existente + índice unificado do mesmo ID | `biblioteca_hogwarts.webp` | Rascunho privado, revisão pública independente, histórico e destinatários |
| Gabinete de Curiosidades | Acervos/Coleções; `/portal/mestre/oficinas/conteudos/curiosities` | Editor existente + índice unificado do mesmo ID | `biblioteca_hogwarts.webp` | Rascunho privado, revisão pública independente, histórico e destinatários |
| Propostas de curiosidades | Acervos/Coleções; `/portal/mestre/curiosidades` | Operação: atalho dedicado, sem fingir rascunho editorial | `biblioteca_hogwarts.webp` | Confirmação manual, idempotência e permissões |
| Profeta Diário | Publicações; `/portal/mestre/oficinas/conteudos/newspapers` | Editor existente + índice unificado do mesmo ID | `correio_carta_hogwarts.webp` | Rascunho privado, revisão pública independente, histórico e destinatários |
| Murais | Publicações; `/portal/mestre/oficinas/conteudos/boards` | Editor existente + índice unificado do mesmo ID | `correio_carta_hogwarts.webp` | Rascunho privado, revisão pública independente, histórico e destinatários |
| Avisos | Publicações; `/portal/mestre/oficinas/conteudos/notices` | Editor existente + índice unificado do mesmo ID | `correio_carta_hogwarts.webp` | Rascunho privado, revisão pública independente, histórico e destinatários |
| Moderação de murais | Publicações; `/portal/mestre/murais` | Operação: atalho dedicado, sem fingir rascunho editorial | `correio_carta_hogwarts.webp` | Confirmação manual, idempotência e permissões |
| Anuários públicos | Publicações; `/portal/mestre/oficinas/conteudos/yearbooks` | Editor existente + índice unificado do mesmo ID | `correio_carta_hogwarts.webp` | Rascunho privado, revisão pública independente, histórico e destinatários |
| Retrospectivas individuais | Publicações; `/portal/mestre/oficinas/conteudos/retrospectives` | Editor existente + índice unificado do mesmo ID | `correio_carta_hogwarts.webp` | Rascunho privado, revisão pública independente, histórico e destinatários |
| Correspondências | Publicações; `/portal/correio` | Operação: atalho dedicado, sem fingir rascunho editorial | `correio_carta_hogwarts.webp` | Confirmação manual, idempotência e permissões |
| Fila do Correio | Publicações; `/portal/mestre/correio` | Operação: atalho dedicado, sem fingir rascunho editorial | `correio_carta_hogwarts.webp` | Confirmação manual, idempotência e permissões |
| Biblioteca de Mídia | Sistema; `/portal/mestre/oficinas/midias` | Editor existente + índice unificado do mesmo ID | `hogwarts_escadarias.webp` | Rascunho privado, revisão pública independente, histórico e destinatários |
| Modelos e ornamentos | Sistema; `/portal/mestre/oficinas/conteudos/templates` | Editor existente + índice unificado do mesmo ID | `hogwarts_escadarias.webp` | Rascunho privado, revisão pública independente, histórico e destinatários |
| Exportação e recuperação | Sistema; `/portal/mestre/arquivos` | Operação: atalho dedicado, sem fingir rascunho editorial | `hogwarts_escadarias.webp` | Confirmação manual, idempotência e permissões |

## Cobertura do prompt

| Área | Diagnóstico da base | Correção planejada e proteção |
|---|---|---|
| Hero e Casas | Banner pequeno sem composição dupla; cores pontuais | Duas imagens aprovadas com máscara, quatro salões/brasões, tema herdado em todas as páginas/modal/mobile |
| Home e destinos | Links sem ambientação | Três portas visuais Explorar/Diário/Acervos; Correio natural; Hogsmeade só quando autorizado |
| Navegação | Páginas profundas sem retorno | Trilha contextual, URLs antigas mantidas; histórico e posição preservados |
| NPC | Publicar e prévia pouco claros | Escolha rascunho/acervo privado/personagens; destinatários exatos; preparar secundário; prévia somente leitura |
| Criação e itens | Criação rápida já existe; edição com metadados em bloco | Manter criação mínima e organizar edição por intenção/tipo; foto opcional; dados avançados intactos |
| Salão/Murais | Foto isolada e ausência de volta | Murais da Casa autorizados pelo servidor; atalhos úteis; propostas sob moderação existente |
| Calendário/Aulas | Estados vazios repetitivos | Ano narrativo destacado; busca com conteúdo real; imagens por disciplina; eventos com detalhe |
| Acervos/Profeta/Correio | Funções existem, sem todos os contextos visuais | Identidade visual sem contagens de segredos; cartas e revisão permitidas intactas |
| Minhas Criações | Registros dispersos | Índice MASTER paginado de todas as famílias, filtros reais, edição do mesmo ID, sem carregamento no aluno/preview |

## Assets e dados

ZIP com 66 arquivos: 43 assets públicos (inclui PNG/WebP da mesma moldura), 9 referências privadas. 41 WebP são byte a byte iguais aos já presentes. A moldura WebP existente evita duplicar o PNG; torre_observatorio.webp só será incorporada se usada. As imagens privadas e protótipo HTML permanecem fora do repositório e bundle. Sala Precisa excluída. Sem geração de imagens, novos NPCs canônicos ou semeadura de aulas/missões/edições. As referências acadêmicas são material de orientação, não código executável.

## Verificação

Usar fixtures temporárias, testes de autorização negativa, preservação da revisão publicada e prévia sem escrita; capturas reais desktop/390px das quatro Casas e cinco personagens; teclado e axe. Comparar a captura V4 fornecida com base local e resultado. Build confere o manifesto de hashes V4/V5. Não afirmar teste em Turso/Blob reais nem inspeção de Production sem acesso.
