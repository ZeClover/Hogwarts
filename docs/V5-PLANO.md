# V5 — evolução incremental do portal

Fonte do pedido: texto V5 de 22/10/2026, lido integralmente. O ZIP `Hogwarts_1890_V5_Pacote_Visual_e_Oficinas_NAV_ATUALIZADA.zip` excedeu o limite de transferência de 32 MiB e **não foi aberto**. As imagens e o HTML de referência ainda não foram examinados. Nenhuma imagem do ZIP foi publicada ou substituída por uma imagem gerada.

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
| Sapos, pools e trocas | `chocolate.ts/js`, `collections.ts/js` | Não alterar probabilidades; moldura aprovada depende do ZIP. D3/E |
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
6. **D3 — coleções:** criadores mínimos e edição por etapas; manter descobertas, titularidade, chances e trocas. Moldura depende da mídia recebida.
7. **D4 — oficina organizada e operações:** sete áreas, busca, favoritos e modo lista; mídia/modelos, correio e pontos. Conservar todos os acessos administrativos.
8. **E — mídia em preview:** depende do ZIP acessível e de inventário público/privado por arquivo. Comparar hashes e imagens. Substituir somente Gladrags, Salão Principal, aulas, Lago Negro, Floresta, Correio e Três Vassouras conforme os arquivos; preservar imagens corretas V4 e brasões. Referências privadas ficam fora de `public`, bundles, thumbnails e respostas a jogadores. Sala Precisa rejeitada não será integrada; personalização fica como requisito futuro.
9. **F — QA e publicação:** regressão local/libSQL, desktop/mobile, teclado/contraste, permissões e rede; prévia isolada, sem usar dados Production. Verificar Turso/Blob reais em ambiente isolado antes de promoção. Não confundir CI local com teste real de serviços.

## Critérios e evidências

Cada PR registra escopo, testes e limitações; testes temporários não semeiam a campanha. B cobre N1–N8 com casos autorizados, recusados e Mestre, mantendo testes de catálogo sem preço e coleções sem contadores ocultos. C cobre criação mínima, reabertura/persistência, campos antigos, privacidade de rascunhos, prévia sem concessão e publicação manual. Demais lotes reutilizam esses testes e verificam as suas regras de negócio (idempotência, conteúdo individual, referências e recuperação).

Receber um pacote visual não autoriza publicar conteúdo privado da pasta do Mestre. O HTML será tratado como referência, nunca como substituto do app. Não há promessa de Sala Precisa personalizável nem criação automática de notícias ou cartas canônicas.
