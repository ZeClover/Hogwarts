# Entrega F2.0b — NPCs reutilizáveis

Fase autorizada pelo pedido “Próxima”, seguindo a sequência aprovada. Implementação incremental sobre F2.0a, em branch/PR própria. As PRs anteriores, Hub RPG, fotografias dos protagonistas e identidade V4 permanecem preservados. Nenhum NPC de exemplo é criado no banco real.

## Uso pelo Painel do Mestre

1. Abra **Oficina Geral → NPCs → Novo NPC**. Informe nome, descrição e papel público (professor, comerciante, estudante ou outro).
2. Em **Retrato e vínculos públicos**, escolha opcionalmente Casa, local principal e vários locais associados. Envie um retrato, reutilize um arquivo da biblioteca ou selecione uma imagem V4. Retratos exigem texto alternativo antes de preparar/publicar. Não é preciso ter imagem para criar NPC.
3. Preencha **Segredos do Mestre**. Essas notas permanecem administrativas, inclusive após publicar.
4. Escolha o público do perfil. Grupos/personagens selecionados formam a seleção inicial; Casa, ano, turma, região e local acrescentam restrições. Exclusão individual prevalece. Associar um local público ao perfil é diferente de exigir aquele local como condição de acesso.
5. Salve o rascunho. Adicione informações progressivas, cada uma com título/texto e destinatários próprios opcionais. Por padrão, elas herdam o alcance do perfil; uma política do fragmento pode restringi-lo, nunca ampliar o acesso ao NPC.
6. Confira a prévia de rascunho ou publicado como personagem. Ela não grava revelação, leitura, descoberta, auditoria ou troca de sessão.
7. **Preparar NPC** não libera o conteúdo. **Revisar publicação do NPC → Confirmar publicação** libera somente o perfil autorizado. Os fragmentos continuam ocultos, sem título, ID ou contagem na resposta do jogador.
8. Abra uma informação publicada, selecione personagens e confirme **Revelar aos selecionados**. Só eles recebem o texto autorizado. **Revogar dos selecionados** retira esse conhecimento da consulta e da busca, mantendo o histórico administrativo.
9. Jogadores consultam **Acervos → Pessoas conhecidas** e contatos conhecidos nos locais. Um mesmo NPC mantém o mesmo ID em vários locais; a referência não concede acesso ao NPC nem abre uma região.

Salvar alterações de perfil, retrato, fragmentos ou público não modifica o snapshot publicado. **Republicar o texto de um fragmento também não substitui silenciosamente o conhecimento já revelado**: cada revelação guarda título/texto autorizados naquele momento. Revele novamente para atualizar o texto de um personagem; as políticas atuais continuam podendo restringir sua consulta. Excluir um fragmento do rascunho só o retira do jogador após republicação.

Os formulários de perfil e fragmentos podem ser salvos separadamente. Se dois estiverem em edição, salvar um preserva os valores não salvos do outro e mantém publicação/revelação bloqueadas até concluir. Um conflito entre sessões retorna 409 e mantém o formulário para revisão.

Duplicar cria um novo rascunho, novos IDs de fragmentos e nenhuma revelação. Arquivar retira o NPC da consulta atual sem apagar revisões, vínculos ou conhecimentos registrados. Restaurar volta a **rascunho**, exigindo publicação explícita; não recria nem duplica revelações.

## Persistência e segurança

A migração aditiva `003_npc_workshop.sql` cria `npcs`, `npc_revisions`, `npc_reveals` e `npc_location_links`. Não modifica as tabelas de personagens, retratos ou conteúdo editorial existente. Cada alteração guarda versão esperada, ator, ação e snapshot administrativo, na mesma transação.

Notas permanentes não entram no snapshot publicado. Respostas do jogador são montadas por lista explícita de campos: perfil, locais autorizados, retrato protegido e fragmentos efetivamente revelados. Busca, contagem, referências e URLs de imagem verificam as mesmas políticas. Um destinatário inválido faz a revelação em lote falhar integralmente. Repetir uma revelação atualiza uma única chave NPC/fragmento/personagem e não duplica conhecimento.

O retrato reutiliza a validação/regravação privada da Biblioteca de Mídia. A URL do perfil exige sessão, política e revisão publicada atual; o original continua reservado ao Mestre. Imagens V4 em `/assets/` já são ambientação pública, como informa o editor. Novos uploads permanecem fora de `public/`.

Antes de atualizar uma instalação com dados, pare o serviço e faça `npm run backup`; depois migre, compile e reinicie. O backup CLI existente já inclui estas tabelas e os bytes privados. A restauração foi verificada em uma instância isolada.

## Rotas e integração

| Rota | Comportamento |
| --- | --- |
| `/portal/mestre/oficinas/npcs[/:id]` e `/novo` | Lista com busca/filtros/páginas, editor, prévia, histórico e comandos |
| `/portal/personagens[/:id]` | Pessoas conhecidas e perfil filtrado do personagem autenticado |
| `/api/master/workshop/npcs` | GET lista administrativa; POST cria rascunho |
| `/api/master/workshop/npcs/:id` | GET detalhe; PATCH salva perfil/público/notas com versão |
| `POST /api/master/workshop/npcs/:id/{prepare,publish,duplicate,archive,restore}` | Comandos transacionais e auditados |
| `POST/DELETE /api/master/workshop/npcs/:id/fragments` | Criar/editar/remover informação do rascunho |
| `POST /api/master/workshop/npcs/:id/{reveal,revoke}` | Conhecimento explícito por personagem, com versão esperada |
| `GET /api/master/workshop/npcs/:id/{history,preview,preview-portrait}` | Histórico paginado e prévias protegidas, sem escrita |
| `GET /api/master/workshop/npcs/references` | Referências administrativas para os domínios que existirem |
| `GET /api/workshop/npcs[/:id][/portrait]` | Lista/detalhe/retrato com autorização por requisição |
| `GET /api/workshop/npcs/references[?locationId=...]` | Referências filtradas por NPC e contexto conhecido |
| `GET /api/locations/:id` | Acrescenta somente contatos autorizados ligados ao local |

`src/npcs.ts` contém o domínio e suas projeções; `public/npcs.js` contém os editores e a consulta. `public/editorial-ui.js` compartilha os campos de política entre mídia/NPCs, preservando os contratos de servidor. `renderImage` existente é reutilizado sem nova dependência. MASTER real é obrigatório nos endpoints administrativos; `view_as` continua estritamente de leitura.

## Verificação

- Lint, TypeScript e build verificados, incluindo os 28 assets WebP V4.
- Suíte de servidor/CLI: **50 testes**, sendo **13 novos de NPCs**. Cobertura de autorização, CSRF, prévia das quatro Casas sem escrita, publicação, snapshots, revelações/revogação, escopos, referências, concorrência e backup/restauração.
- Suíte de navegador: **7 fluxos**, sendo **2 novos de NPCs**. Criação com/sem retrato, vínculos, prévia, publicação por teclado, revelação/revisão/revogação, formulários simultâneos, duplicação, arquivo/restauração e conflito real entre editores.
- axe-core WCAG A/AA e verificação de largura nas telas examinadas, desktop 1440 px e celular 390 px; redução de movimento conferida. Os testes usam fixtures temporárias, nunca conteúdo canônico.

[Editor desktop](screenshots/f2-0b/editor-desktop.png) · [Editor celular](screenshots/f2-0b/editor-mobile.png) · [Pessoa conhecida no celular](screenshots/f2-0b/pessoa-mobile.png)

## Limites e próxima fase

- OF04-01 entregue. OF04-02 entrega vínculos reais por ID nos locais/estabelecimentos existentes e referências protegidas. Seletores em missões e no editor completo de lojas serão integrados nas respectivas fases, sem duplicar NPCs. Esses editores ainda não existem.
- Até 30 fragmentos por NPC, cada texto com até 4.000 caracteres; nome/título até 120, descrição até 3.000, notas privadas até 5.000. Paginação de 12 NPCs; interface mostra últimas 20 revisões, API de histórico permite páginas anteriores. Não há restauração arbitrária de uma revisão antiga.
- Atualização por consulta a cada cinco segundos enquanto a aba está visível. Fila persistente de revelações/animações pertence à F2.2; publicar/revelar NPC não fabrica notícia, prêmio, item ou progresso de missão.
- Arquivar preserva o registro histórico, mas retira sua consulta atual; restaurar não libera automaticamente. Não há exclusão destrutiva de NPC, limpeza de mídia ou importador pelo painel.
- Sem chat, resposta automática, IA de conteúdo, deploy, merge ou integração com Hub RPG.
- **Próxima fase: F2.1 — Itens. Aguarda nova autorização.** Side-Quests permanecem prioritárias na sequência F2.2a–c, seguidas das oficinas comerciais conforme as dependências aprovadas.
