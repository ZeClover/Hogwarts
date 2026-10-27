# Entrega F2.0a — Oficina Geral e Biblioteca de Mídia

Implementa a próxima fase autorizada pelo Mestre. Reutiliza Node.js 24/TypeScript/SQLite, sessões, CSRF, Casas, grupos, regiões, locais, auditoria e assets V4 da F0/F1. A PR #1 e sua branch original não são alteradas. Esta entrega é uma branch/PR própria, baseada no planejamento aprovado.

## O que funciona

- **Oficina Geral**, separada da Central da Sessão, com a categoria Biblioteca de Mídia funcionando.
- Upload JPG/PNG/WebP de até 2 MiB/16 milhões de pixels, verificação de assinatura/tipo, imagem estática, orientação corrigida, remoção de metadados e regravação WebP até 2048×2048.
- Seleção de uma das imagens V4 já fornecidas e reutilização de arquivos enviados. Não cria conteúdo de exemplo nem registra todas as imagens automaticamente como publicações.
- Editor de nome, descrição pública, texto alternativo, categoria, crédito/origem, ano letivo inicial, notas privadas, corte percentual e quatro apresentações reutilizáveis: paisagem, retrato, capa e cartão.
- Rascunho, preparado, publicado e arquivado; duplicação como novo rascunho; restauração **sem republicação automática**. Rascunho incompleto volta como rascunho; caso esteja pronto, volta preparado.
- Rascunho separado do snapshot publicado. Editar nome, corte ou destinatários só muda o jogador depois de confirmar nova publicação.
- Controle por personagem/grupo, restrições por Casa/ano escolar/turma/região/local e exclusões individuais, com negação prevalecendo. Turmas têm cadastro e integrantes pelo painel.
- Prévia de rascunho ou publicado como personagem, com política real, sem gravação de leitura/revelação/auditoria. Não troca a sessão do Mestre.
- Histórico versionado com autor, horário e snapshots antes/depois preservados; conflitos entre edições retornam 409 e não sobrescrevem o conteúdo salvo por outro editor.
- Galeria do jogador, busca/filtros/paginação já autorizados no servidor. Originais, imagens cortadas e miniaturas são autenticados e sem cache. A galeria aberta consulta atualizações a cada cinco segundos.

## Como usar

1. Entre como Mestre e abra **Oficina Geral → Biblioteca de Mídia → Nova imagem**.
2. Preencha nome/descrição, envie ou selecione a imagem e informe o texto alternativo.
3. Em **Corte, apresentação e notas**, ajuste percentuais, apresentação, crédito e notas privadas se necessário. Salve para atualizar a prévia do corte.
4. Escolha o público. Personagens/grupos selecionados formam a seleção inicial; Casas/anos/turmas/contexto acrescentam restrições. Com público “Selecionados” e nenhuma seleção, ninguém recebe acesso.
5. Confira a prévia por personagem. A ausência de acesso na prévia usa as mesmas regras de leitura, sem enviar dados ao jogador real.
6. **Revisar publicação → Confirmar publicação** libera a revisão salva. Preparar ou duplicar não libera.
7. O jogador consulta **Acervos → Galeria de Imagens**. Outro personagem não recebe metadados, título, contagem ou arquivo do registro oculto.
8. Arquivar retira o registro da galeria e mantém bytes/revisões. Restaurar exige uma nova publicação para liberar novamente.

As notas privadas só existem na visão administrativa/histórico; não entram no snapshot público. O histórico e o arquivo preservam versões; esta fase não introduz editor de restauração de uma revisão arbitrária antiga.

## Migração e arquivos

`002_workshop_media.sql` é aditiva. Mantém a tabela `media` dos retratos intacta e cria:

| Tabela | Uso real nesta fase |
| --- | --- |
| `workshop_files` | Imagem de campanha imutável com proprietário administrativo, tamanho/dimensões e origem V4 opcional |
| `editorial_entries` | Registro de mídia, rascunho, política, notas internas, versão e snapshot publicado independente |
| `editorial_revisions` | Snapshot completo por alteração, autor e ação; somente Mestre |
| `school_cohorts`, `cohort_members` | Turmas e integrantes usados nas restrições das imagens |

Separar os arquivos narrativos dos retratos evita inventar um personagem para satisfazer a propriedade de mídia da F0/F1 e evita uma recriação destrutiva de tabelas com referências existentes. As duas finalidades têm autorizações próprias. Os novos bytes ficam no mesmo diretório **privado** `DATA_DIR/media/`, com nomes aleatórios e permissões restritas, já coberto pelo backup existente.

Não foram criadas tabelas de NPCs, missões, itens, lojas/ofertas, certificados, carteira, cartas ou coleções. `kind` editorial aceita apenas MEDIA nesta fase; a biblioteca não é um bypass genérico para ler rascunhos pessoais de futuros módulos.

Antes de atualizar uma instalação com dados: pare o serviço, faça `npm run backup`, execute `npm run db:migrate`, compile e inicie novamente. Os testes verificam migração de um banco F0/F1 com retrato e publicação referenciada, além de backup/restauração com as mídias novas.

## Rotas

| Rota | Comportamento |
| --- | --- |
| `/portal/mestre/oficinas` | Entrada da Oficina e cadastro de turmas |
| `/portal/mestre/oficinas/midias` | Lista administrativa, busca/filtros/páginas |
| `/portal/mestre/oficinas/midias/nova` e `/:id` | Criar/editar, histórico, ações e prévia |
| `/portal/midias` | Galeria pública **dentro do portal autenticado**, filtrada por personagem |
| `GET /api/master/workshop/context` | Contexto administrativo e arquivos reutilizáveis; nunca retorna hashes/senhas |
| `POST /api/master/workshop/files` | Upload binário ou seleção por nome exato de asset V4 permitido |
| `GET /api/master/workshop/files/:id` | Original normalizado, somente Mestre |
| `GET/POST /api/master/workshop/media` | Listar e criar rascunho |
| `GET/PATCH /api/master/workshop/media/:id` | Consultar/editar com versão esperada |
| `POST /api/master/workshop/media/:id/{prepare,publish,duplicate,archive,restore}` | Comandos explícitos com versão esperada e auditoria |
| `GET /api/master/workshop/media/:id/{history,image,preview,preview-image}` | Histórico e prévias autenticadas, sem escrita |
| `POST /api/master/workshop/cohorts`, `PATCH /:id` | Turmas com integrantes e versão esperada |
| `GET /api/workshop/media[/:id][/image]` | Listagem/detalhe/derivado filtrados, inclusive em preview autorizado |

`src/http.ts` concentra leitura de formulários e respostas já usadas pelo servidor. `src/editorial.ts` contém versões/políticas; `src/workshop.ts` isola os handlers; `public/workshop.js` mantém o editor separado do shell original. Todas as mutações continuam sob sessão/origem/CSRF do servidor existente.

## Verificação

- Lint, typecheck e build passaram.
- **37 testes de servidor/CLI passaram**: 22 da fundação e 15 da Oficina, incluindo migração antiga, autorização, upload, revisão publicada, conflito, prévia sem escrita e backup/restauração.
- **5 fluxos de navegador passaram**: três da fundação e dois da Oficina, com criação/publicação, corte, upload, turmas, exceções, duplicação e conflito entre editores.
- axe-core sem violações automáticas WCAG A/AA nas telas examinadas; desktop 1440 px e celular 390 px sem overflow nos testes. Isso não substitui auditoria manual integral com leitor de tela.
- Quatro Casas e 28 assets WebP preservados/validados nos checks existentes. Fixtures são temporárias, com contas de teste, sem conteúdo canônico persistido na aplicação real.

[Oficina desktop](screenshots/f2-0a/oficina-desktop.png) · [Editor desktop](screenshots/f2-0a/editor-desktop.png) · [Editor celular](screenshots/f2-0a/editor-mobile.png) · [Galeria celular](screenshots/f2-0a/galeria-mobile.png)

## Limites explícitos

- Templates desta etapa são apresentações/cortes reutilizáveis da mídia. Editores completos de livro, carta, jornal e certificado/PDF pertencem às próximas fases.
- As novas políticas por Casa/turma/ano/exceção se aplicam à Biblioteca de Mídia. Não anunciam que todos os controles antigos de região ou todos os módulos futuros já foram migrados a esse contrato.
- Assets V4 já servidos em `/assets/` continuam públicos como ambientação. O editor informa isso ao selecionar um original aprovado; restringir um registro não transforma a imagem original já pública em segredo. Imagens novas enviadas à biblioteca não vão para `/assets/`.
- O ano letivo disponível é 1890–1891; o suporte administrativo a anos futuros permanece na F3. Sem avanço automático da campanha.
- Arquivos de uploads não associados e revisões antigas permanecem privados. Não há limpeza automática, exclusão destrutiva de arquivo ou exportação/importação pelo painel nesta etapa.
- Publicar mídia não cria carta, missão, item, recompensa ou descoberta. Não foi criada uma fila de revelações em tempo real; ela permanece na F2.2. Registro de publicação fica na revisão/auditoria, sem fabricar uma notícia da campanha.
- Rascunhos do Correio não existem nesta fase. Sua futura proteção inclusive contra o Mestre depende da política própria de autor real, conforme o planejamento; não deve reutilizar irrestritamente a leitura administrativa desta biblioteca.
- Sem deploy, merge automático ou alteração do Hub RPG. A PR da F0/F1 permanece preservada. A próxima etapa proposta é F2.0b (NPCs), que requer nova autorização.

Referência técnica do corte: [Sharp — extract/resize](https://sharp.pixelplumbing.com/api-resize/). Nenhuma imagem foi gerada por IA.
