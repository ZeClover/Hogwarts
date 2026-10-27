# Entrega F2.1 — Oficina de Itens

Fase autorizada pelo pedido “Proxima fase”, após a entrega de NPCs. Branch própria sobre F2.0b; as PRs #1, #2 e #3, o Hub RPG e os assets V4 permanecem preservados. Nenhum item, preço ou estoque de exemplo é inserido no banco real.

## Operação pelo painel

1. Abra **Oficina Geral → Itens → Novo item**. Nome é obrigatório; descrição revelada e categoria interna podem ser preenchidas conforme o uso. Categoria aceita texto livre, sem precisar alterar código para cadastrar outra categoria.
2. Em **Imagem e corte**, envie JPG/PNG/WebP, escolha uma imagem V4 ou reutilize um arquivo privado da biblioteca. Imagem é facultativa. Informe alternativa textual quando houver imagem e ajuste o corte percentual; confira o resultado na prévia após salvar.
3. Em **Propriedades e fabricação**, edite qualidade, materiais, propriedades, grau da magia, ativação, usos/cargas, frequência, requisitos, complexidade, disponibilidade e raridade. São campos internos e opcionais, sem calculadora obrigatória ou aplicação mecânica automática.
4. Em **Efeitos do item**, adicione até 12 efeitos. Cada um tem nome, descrição interna e configuração própria de grau/ativação/usos/frequência/requisitos. Reordene pelos botões, remova ou edite. IDs estáveis são preservados em cada alteração; duplicar gera novos IDs.
5. Em **Valores e segredos do Mestre**, informe estimativa de referência e preço interno escolhido, separadamente. Os campos Galeões/Sicles/Nuques usam `1 G = 493 N` e `1 S = 29 N`; o banco guarda inteiros em Nuques. Deixar os três campos vazios significa valor não definido; zero é um valor explícito. O Mestre pode escolher qualquer valor válido, sem seguir a estimativa.
6. Escreva texto secreto e notas internas. Escolha os destinatários e as restrições por grupo, Casa, turma, ano, região/local e exclusões individuais. Salvar cria rascunho; preparar não libera acesso.
7. Confira a prévia de rascunho ou revisão publicada como personagem. Ela apresenta somente imagem/nome/descrição revelada, usando as permissões reais, sem gravar nada.
8. **Revisar publicação → Confirmar publicação** libera a revisão salva em **Acervos → Artigos revelados**. O jogador pode abrir o artigo e **Copiar descrição**; se a área de transferência estiver indisponível, pode selecionar o texto protegido retornado pelo servidor.
9. Pesquise por nome/descrição, filtre por categoria/estado e navegue pelas páginas administrativas. Duplique como novo rascunho, arquive ou restaure sem republicar. Histórico e conflitos entre sessões preservam o conteúdo anterior.

**Publicar um artigo não cria oferta, pedido, posse, estoque, descoberta, aprendizagem, recompensa ou saldo.** Lojas existentes continuam sem produtos até a fase de ofertas. Os artigos são consulta de conteúdo revelado; não são inventário.

Categoria, qualidade, propriedades, efeitos, requisitos, estimativa, preço e segredos permanecem exclusivos do Mestre. Para revelar algum detalhe técnico, o Mestre o inclui deliberadamente na **descrição revelada**. Essas escolhas não são inferidas nem copiadas automaticamente dos campos internos.

## Persistência e contratos

A migração aditiva `004_item_workshop.sql` cria somente:

| Tabela | Uso |
| --- | --- |
| `catalog_items` | ID estável do item, ator administrativo, estado/versão, rascunho/política, dados internos separados e snapshot público independente |
| `item_revisions` | Snapshot completo por alteração, ator e ação; acesso exclusivo do Mestre |

Personagens, retratos, mídia, NPCs, referências e revelações anteriores não são recriados. O item não exige um protagonista como proprietário. Os arquivos reutilizam a biblioteca privada e a validação/regravação de imagens existente.

Cada comando aplica sessão, papel, origem, CSRF, versão esperada e transação. Duas edições da mesma versão retornam um sucesso e um conflito 409; não há revisão parcial. Efeitos de outro item, IDs repetidos, valores negativos/fracionários, corte fora da imagem e campos inventados são recusados.

Somente `payload` público e política são publicados; `private_json` fica fora desse snapshot. Editar nome, descrição, imagem, corte ou público não muda a revisão liberada até republicar. Alterar dados internos gera revisão administrativa, sem transformar esses dados em conteúdo público. Arquivar retira o artigo da consulta atual, preservando dados/revisões/bytes. Restaurar volta a rascunho e exige publicação explícita.

Respostas públicas possuem apenas `id`, `name`, `description`, `image`, `alt`. Busca pública consulta só nome/descrição autorizados; categoria e estado administrativos não são usados como filtro lateral para inferir dados internos. Referências públicas são igualmente filtradas. Imagens exigem política e revisão atual; arquivos originais continuam exclusivos do Mestre. A cópia retorna só nome e descrição da revisão publicada, sem preço, segredo, propriedades internas ou metadados administrativos.

## Rotas e limites

| Rota | Comportamento |
| --- | --- |
| `/portal/mestre/oficinas/itens[/:id]` e `/novo` | Lista, criação/edição, efeitos, valores, ações, prévia e histórico |
| `/portal/artigos[/:id]` | Consulta autenticada de artigos liberados e cópia de descrição |
| `GET/POST /api/master/workshop/items` | Listar/criar rascunhos |
| `GET/PATCH /api/master/workshop/items/:id` | Ler/salvar cadastro completo com versão esperada |
| `POST /api/master/workshop/items/:id/{prepare,publish,duplicate,archive,restore}` | Comandos explícitos, transacionais e auditados |
| `GET /api/master/workshop/items/:id/{history,image,preview,preview-image}` | Histórico paginado e imagens/prévias protegidas, sem escrita |
| `GET /api/master/workshop/items/references` | IDs/nomes/estados para futuros editores autorizados |
| `GET /api/workshop/items[/:id][/image]` | Lista/detalhe/imagem com autorização por requisição |
| `GET /api/workshop/items/:id/copy` | Nome/descrição publicados, em texto, com a mesma autorização |
| `GET /api/workshop/items/references` | Referências públicas autorizadas, sem dados internos |

Limites: 12 itens por página, 12 efeitos por item, nome até 120 caracteres, descrição até 3.000, segredo até 4.000, notas até 2.000, materiais até 1.000 e propriedades até 1.500. Efeitos têm nome até 120 e descrição até 600; demais limites constam dos campos. Valores privados: até 1 trilhão de Nuques, inteiros não negativos. Corpo JSON de até 256 KiB somente no domínio de Itens, para suportar formulário completo Unicode; demais formulários mantêm 32 KiB. Upload permanece em até 2 MiB/16 milhões de pixels.

A interface mostra as últimas 20 revisões; API permite páginas anteriores. Não há restauração arbitrária de uma revisão antiga, exclusão destrutiva ou limpeza automática de arquivo. Atualizações chegam por consulta a cada cinco segundos enquanto a aba está visível. Nenhuma dependência nova ou imagem gerada por IA foi acrescentada.

## Migração e recuperação

Para atualizar uma instalação com dados, pare o serviço, faça `npm run backup`, aplique `npm run db:migrate`, compile e reinicie. O backup CLI já inclui itens, efeitos ordenados, preços privados, políticas, revisões e arquivos. Restauração foi testada em uma instância isolada, com autorização de imagem/cópia e integridade das referências.

## Verificação

- Lint, typecheck e build passaram; os 28 assets WebP V4 foram verificados.
- **65 testes de servidor/CLI**, sendo **15 novos de Itens**: migração desde F2.0b, nenhum vínculo automático, autorização/CSRF, segredos/preços fora de respostas/buscas/referências/cópias, imagens/corte, efeitos/IDs/ordem, dinheiro inteiro, Unicode/limites, conflitos, prévia pura nas quatro Casas, arquivo e backup/restauração.
- **9 fluxos de navegador**, sendo **2 novos de Itens**: cadastro completo com upload/corte, valores, múltiplos efeitos reordenáveis, publicação por teclado, consulta/cópia autorizada, atualização da revisão, item sem imagem, celular, conflito, duplicação, arquivo/restauração e filtros.
- axe-core WCAG A/AA sem violações automáticas nas telas examinadas; largura desktop 1440 px e celular 390 px sem overflow; redução de movimento conferida. Isso não substitui auditoria manual integral com leitor de tela.
- Todas as contas e os objetos desses testes são fixtures temporárias. As PRs anteriores não recebem novos commits.

[Oficina desktop](screenshots/f2-1/oficina-desktop.png) · [Editor desktop](screenshots/f2-1/editor-desktop.png) · [Editor celular](screenshots/f2-1/editor-mobile.png) · [Artigo no celular](screenshots/f2-1/artigo-mobile.png)

## Dependências que continuam nas próximas fases

- OF02-01/02 entregues no cadastro independente. Preço por oferta e associação do mesmo item a várias lojas entram na F2.3; pedidos, estoque, carteira e compras na F2.4.
- Cópia pública de nome/descrição é funcional agora. Comprovantes de aquisição/concessão serão emitidos somente com os domínios correspondentes; este botão não fabrica um recibo nem sincroniza o Hub RPG.
- A ação de sacola depende de oferta/pedido reais e não aparece como controle sem função nesta fase. O artigo oferece abrir/copiar a descrição, sem banners sobre Discord/RP ou preços internos.
- Recompensas dependem da autoria/condução/certificados e confirmação explícita de Missões; criar/preparar/publicar este item não concede nada a ninguém.
- **Próxima fase: F2.2a — autoria de Side-Quests e Histórias Individuais. Aguarda nova autorização.** Os cortes seguintes F2.2b/F2.2c continuam obrigatórios para considerar a Oficina de Missões completa.
- Sem deploy, merge, novas contas canônicas ou qualquer alteração no Hub RPG.
