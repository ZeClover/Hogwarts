# Entrega F2.2a — Autoria de Missões e Histórias Individuais

Corte autorizado pelo pedido “Continue”, seguindo a próxima fase acordada após F2.1. Branch própria sobre a Oficina de Itens, preservando as PRs #1–#4, o Hub RPG, a fundação e os assets V4. Não cria conteúdo canônico de exemplo, participantes automáticos ou recompensas.

**OF01-01/02 entregues no corte de autoria. A Oficina de Missões integral ainda não está concluída:** objetivos, pistas de missão, fila de revelações, desfechos e reabertura pertencem à F2.2b; certificados/PDFs e concessões à F2.2c, com carteira monetária dependendo da F2.4.

## Missões em Grupo

1. Abra **Oficina Geral → Missões e Histórias → Missões → Nova missão**. Informe título e resumo; tipo narrativo é livre e o ano letivo disponível é 1890–1891.
2. Em **Capa e vínculos narrativos**, selecione imagem opcional e texto alternativo, um NPC real já cadastrado, local e gancho público. Associar NPC/local não concede conhecimento nem acesso ao contexto. O mesmo NPC é reutilizado por ID em quantas missões, arcos e entradas forem necessários.
3. Em **Planejamento privado do Mestre**, escreva sinopse, importância, condições de liberação e notas. Essas informações nunca entram na projeção pública. Condições são verificadas manualmente, sem gatilho por visita, clique ou relógio.
4. Escolha o público elegível para consultar o anúncio. Grupos/personagens se combinam com restrições por Casa, turma, ano, região/local e exclusão individual. Salve o rascunho; preparar continua sem acesso do jogador.
5. Confira a prévia por personagem. Rascunho é uma visão de preparação; o painel informa separadamente se já integra o Diário. A prévia publicada pode conferir anúncio ou Diário real.
6. **Revisar publicação → Confirmar ação** publica o anúncio autorizado em **Oportunidades**. Não atribui participantes nem inicia missão. Esta referência já é funcional sem depender do futuro mural; integrar avisos de mural/carta fica para seus editores.
7. Na seção **Participantes**, marque os personagens e confirme **Liberar aos selecionados**. O lote inteiro é validado contra a política publicada; uma pessoa inválida impede qualquer alteração. Os liberados recebem a missão no Diário como **Disponível**.
8. Selecione participantes já liberados e confirme **Iniciar para selecionados**. Só eles passam a **Em andamento**. Visitar anúncio, Diário, NPC ou local não aceita nem inicia a missão.
9. Revogar acesso retira imediatamente Diário e anexos daquela participação, preservando o registro administrativo. A pessoa pode continuar vendo o anúncio se ainda pertencer ao público desse anúncio; anúncio e participação têm autorizações distintas.

Cada cadastro representa uma missão da campanha com uma participação por personagem. Duplicar prepara uma nova missão sem participantes, início ou publicações copiados. Adicionar uma pessoa depois do início exige liberação explícita e começa em **Disponível**; ela não herda andamento. Reliberar uma participação ativa não reinicia quem já está em andamento. Reliberar após revogação volta a disponível, exigindo novo início manual.

O jogador recebe apenas seu próprio estado. Nomes, IDs, quantidade e andamento dos demais participantes não são enviados como parte da missão. Grupos não se tornam listas públicas de participantes.

## Histórias Individuais

1. Abra a aba própria **Histórias Individuais → Nova história**. Escolha o protagonista; o arco não é classificado automaticamente como side-quest, não exige objetivo fechado, certificado nem recompensa.
2. Salve resumo, vínculos, capa e notas conforme necessário. O público é uma restrição adicional ao protagonista, nunca uma autorização para colegas lerem o arco.
3. Use **Nova entrada** para capítulos, eventos ou revelações. Cada entrada tem título, texto, imagem opcional, NPC/local por ID e notas privadas. Editar uma entrada é uma página separada; salvar preserva a versão do arco e retorna à lista.
4. Reordene, edite ou remova entradas no rascunho. Publique o arco. Publicar não libera ao protagonista, e liberar o arco não revela títulos, textos, IDs, imagens ou contagem das entradas ocultas.
5. Confirme **Liberar ao protagonista**. Depois, confirme **Revelar entrada** em cada trecho preparado. O servidor registra a revisão efetivamente revelada para aquela pessoa, sem descoberta, prêmio ou progresso automático.
6. Editar e republicar uma entrada não substitui o texto que o protagonista conhece. Revele novamente para atualizar esse conhecimento. A posição da revelação também é registrada no snapshot.
7. Remover uma entrada do rascunho não apaga o conhecimento já revelado, mesmo depois de republicar. **Conhecimento preservado → Revogar entrada** é uma ação explícita para retirar a consulta. O histórico administrativo permanece.

Após a primeira liberação, o protagonista fica fixo. Para adaptar o material a outro personagem, duplique como novo arco: novos IDs de entradas, nenhum acesso ou revelação herdados, protagonista editável antes da primeira liberação. Isso evita transferir a história privada de uma pessoa para outra por acidente.

Revogar o acesso ao arco bloqueia seus textos e anexos. Reliberar o mesmo arco ao mesmo protagonista permite consultar conhecimentos ainda ativos, sem reaplicar concessões. Revogar uma entrada impede sua leitura/imagem até uma nova revelação explícita.

## Diário, arquivo e privacidade

**Missões em Grupo** e **Histórias Individuais** têm abas e endpoints próprios. O Diário lista apenas registros efetivamente liberados ao personagem e compatíveis com a política atual. **Oportunidades** é uma consulta separada de anúncios, sem controle de aceite ou ação de jogador que altere andamento.

Arquivar retira a narrativa da operação ativa e o anúncio da consulta, mas preserva a leitura histórica de participações/arcos já autorizados, inclusive imagens e capítulos conhecidos. O jogador vê **Arquivo da jornada**; isso não fabrica um desfecho. Restaurar retorna a edição para rascunho, sem publicar anúncio nem acrescentar participantes ou conhecimento. Quem já tem direito histórico continua podendo consultar o último conteúdo liberado; revogação explícita e as políticas atuais sempre prevalecem.

NPCs e locais são projetados apenas se também forem conhecidos/autorizados naquele domínio. Um NPC desconhecido não envia nome nem ID por estar associado à missão. Referenciar local fechado não o revela; exigir contexto na política pode bloquear a narrativa inteira. A prévia não é uma forma de entrar no rascunho de outro autor: todos os editores deste corte são de autoria administrativa, e o contrato futuro de cartas pessoais permanece separado.

## Persistência e rotas

Migração aditiva `005_campaign_authorship.sql`:

| Tabela | Finalidade |
| --- | --- |
| `quests`, `quest_revisions` | Autoria da missão, rascunho/política, notas privadas separadas, publicação independente e revisões |
| `quest_participants` | Liberação/revogação, revisão de origem e estado manual por personagem |
| `personal_story_arcs`, `story_revisions` | Arcos próprios, protagonista, controle de acesso, conteúdo e revisões |
| `personal_story_entries` | Entradas ordenadas em preparação, vínculos e notas privadas |
| `personal_story_reveals` | Snapshot do conteúdo revelado, posição, protagonista, ator e estado ativo |

A revelação não possui FK destrutiva para a entrada em rascunho: esse rascunho pode ser removido enquanto o conhecimento legítimo permanece. O arco e o personagem continuam referenciados por FK. Nenhuma tabela de objetivo, recompensa, PDF ou carteira foi criada antecipadamente.

| Rota | Uso |
| --- | --- |
| `/portal/mestre/oficinas/missoes[/:id]`, `/novo` | Lista e editor de missões, participantes, ações, prévia e histórico |
| `/portal/mestre/oficinas/historias[/:id]`, `/novo` | Lista/editor de arcos, acesso do protagonista e entradas |
| `/portal/mestre/oficinas/historias/:id/entradas/{nova,:entryId}` | Criar/editar capítulo, evento ou revelação |
| `/portal/missoes`, `/portal/missoes/grupo`, `/portal/missoes/historias` e detalhes por ID | Diário e suas duas seções |
| `/portal/oportunidades[/:id]` | Anúncios autorizados, sem início automático |
| `GET /api/master/campaign/context` | Referências de NPCs reais para os seletores administrativos |
| `GET/POST /api/master/campaign/{quests,stories}` | Listar/criar rascunho |
| `GET/PATCH /api/master/campaign/{quests,stories}/:id` | Ler/editar, com versão esperada |
| `POST /:id/{prepare,publish,duplicate,archive,restore}` | Comandos editoriais explícitos |
| `POST /api/master/campaign/quests/:id/{release,start,revoke}` | Lote explícito de personagens, transação e revisão |
| `POST /api/master/campaign/stories/:id/{release,revoke}` | Acesso do protagonista |
| `POST/DELETE /api/master/campaign/stories/:id/entries` | Preparar/editar/remover entrada do rascunho |
| `POST /api/master/campaign/stories/:id/{reorder,reveal-entry,revoke-entry}` | Ordem e conhecimento explícito |
| `GET /api/master/campaign/{quests,stories}/:id/{history,preview,preview-image}` | Histórico paginado e prévias protegidas, sem escrita |
| `GET /api/campaign/{quests,stories,announcements}[/:id][/image]` | Consultas filtradas por contexto e personagem |
| `GET /api/campaign/stories/:id/entries/:entryId/image` | Imagem do snapshot efetivamente conhecido, com autorização própria |

Todos os comandos usam ator MASTER real, origem/CSRF, versão esperada e transação com auditoria; conflitos retornam 409 sem perder a edição. Projeções são montadas por campos explícitos, sem enviar a resposta administrativa para esconder informações no cliente. Prévia, busca, imagens e listagens são somente leitura. Arquivos permanecem na biblioteca privada; V4 continua ambientação pública, sem imagens por IA.

## Operação e limites

- Faça backup com o serviço parado antes de atualizar uma instalação, aplique migrations, compile e reinicie. Backup/restauração CLI já inclui narrativas, participantes, entradas, revelações, revisões e bytes privados.
- Ano disponível 1890–1891; calendário administrativo para outros anos continua na F3. Não usa data real para avançar a narrativa.
- Até 30 entradas por arco, texto de entrada até 4.000 caracteres, notas privadas até 2.000. Título até 120; resumo até 3.000, gancho até 2.000, sinopse até 4.000 e condições/notas até 2.000.
- Lista paginada em 12 registros; histórico mostra últimas 20 revisões, com páginas anteriores na API. Sem restauração arbitrária de uma revisão antiga.
- JSON de perfil até 128 KiB para suportar os campos Unicode; comandos e entradas mantêm 32 KiB. Upload mantém o limite de 2 MiB/16 milhões de pixels do serviço existente.
- Atualizações por consulta a cada cinco segundos com a aba visível. Canal/outbox de apresentações online/offline e notificações persistentes ainda pertencem à F2.2b. O conhecimento já revelado deste corte persiste mesmo offline, mas não há animação/fila de apresentação anunciada como pronta.
- Estado editorial é separado do andamento por participante. Encerramento com resultado e reabertura não existem ainda; arquivar não substitui esses comandos.

## Verificação e próximos cortes

- Lint, typecheck e build passaram; 28 assets WebP V4 verificados.
- **86 testes de servidor/CLI**, sendo **21 novos narrativos**: migração desde F2.1, autorização, anúncio sem participação, lotes atômicos, início separado, novos participantes, revogação, arquivo histórico, NPC/local filtrados, snapshots, domínio pessoal, entradas, efeitos ausentes, concorrência, quatro Casas em prévia pura e backup/restauração.
- **12 fluxos de navegador**, sendo **3 novos narrativos**: criar missão com NPC/capa, consultar anúncio sem iniciar, liberar/iniciar manualmente, adicionar participante depois, arquivo/restauração, criar arco/entradas, reordenar, revelar/revisar/remover/revogar, isolamento do protagonista, conflito entre editores e filtros.
- Desktop 1440 px/celular 390 px, axe-core sem violações automáticas WCAG A/AA nas telas examinadas, teclado e redução de movimento conferidos. Fixtures temporárias; nada vira conteúdo canônico.

[Missão desktop](screenshots/f2-2a/missao-desktop.png) · [Diário celular](screenshots/f2-2a/diario-mobile.png) · [Editor de história celular](screenshots/f2-2a/historia-editor-mobile.png) · [História celular](screenshots/f2-2a/historia-mobile.png)

**Próxima fase: F2.2b — objetivos manuais, pistas, fila e desfechos. Aguarda nova autorização.** F2.2c continua necessária para certificados/PDFs e concessões. Sem deploy, merge, integração mecânica ou alteração do Hub RPG.
